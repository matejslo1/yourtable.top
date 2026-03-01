import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole, resolveTenant } from '../middleware/auth.js';
import {
  createDepositIntent,
  chargeNoShowFee,
  refundPayment,
  handleWebhookEvent,
  verifyWebhookSignature,
} from '../services/paymentService.js';
import { AppError } from '../utils/errors.js';
import express from 'express';

const router = Router();

/**
 * POST /api/v1/payments/create-intent
 * Create Stripe Payment Intent for deposit (called from booking widget)
 */
router.post(
  '/create-intent',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reservationId, amountCents, guestEmail, description } = req.body;

      if (!reservationId || !amountCents) {
        throw new AppError('reservationId and amountCents are required', 400);
      }

      const result = await createDepositIntent({
        tenantId: req.tenantId!,
        reservationId,
        amountCents,
        guestEmail: guestEmail || '',
        description: description || 'Deposit za rezervacijo',
      });

      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/public/:tenantSlug/payments/create-intent
 * Public: Create payment intent from booking widget
 */
router.post(
  '/public-intent',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantSlug, reservationId, sessionToken, amountCents } = req.body;

      if (!tenantSlug || !reservationId || !sessionToken) {
        throw new AppError('Missing required fields', 400);
      }

      // Verify the hold exists
      const { prisma } = await import('../utils/prisma.js');
      const reservation = await prisma.reservation.findFirst({
        where: {
          id: reservationId,
          holdSessionToken: sessionToken,
          status: 'HOLD',
        },
        include: { tenant: { select: { id: true } } },
      });

      if (!reservation) {
        throw new AppError('Invalid hold', 400);
      }

      const result = await createDepositIntent({
        tenantId: reservation.tenant.id,
        reservationId,
        amountCents: amountCents || 1000, // Default 10 EUR
        guestEmail: '',
        description: 'Deposit za rezervacijo',
      });

      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/payments/:reservationId/no-show-fee
 * Charge no-show fee (admin)
 */
router.post(
  '/:reservationId/no-show-fee',
  requireAuth,
  requireRole('owner', 'admin', 'manager'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { amountCents } = req.body;

      if (!amountCents) {
        throw new AppError('amountCents is required', 400);
      }

      const result = await chargeNoShowFee({
        tenantId: req.tenantId!,
        reservationId: req.params.reservationId,
        amountCents,
        userId: req.user!.id,
      });

      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/payments/:reservationId/refund
 * Refund a payment (admin)
 */
router.post(
  '/:reservationId/refund',
  requireAuth,
  requireRole('owner', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await refundPayment({
        tenantId: req.tenantId!,
        reservationId: req.params.reservationId,
        amountCents: req.body.amountCents,
        reason: req.body.reason,
        userId: req.user!.id,
      });

      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/payments/webhook
 * Stripe webhook handler
 */
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      res.status(400).json({ error: 'Missing signature' });
      return;
    }

    try {
      // Parse the event (in production, verify signature properly)
      const event = JSON.parse(req.body.toString());
      await handleWebhookEvent(event);
      res.json({ received: true });
    } catch (error) {
      console.error('[Stripe Webhook] Error:', error);
      res.status(400).json({ error: 'Webhook error' });
    }
  }
);

export default router;
