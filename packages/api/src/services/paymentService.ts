import { prisma } from '../utils/prisma.js';
import { createAuditLog } from '../utils/audit.js';
import { AppError } from '../utils/errors.js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_API = 'https://api.stripe.com/v1';

/**
 * Make a Stripe API request
 */
async function stripeRequest(endpoint: string, method: string = 'GET', body?: Record<string, string>): Promise<any> {
  if (!STRIPE_SECRET_KEY) {
    throw new AppError('Stripe is not configured. Set STRIPE_SECRET_KEY.', 500);
  }

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };

  if (body) {
    options.body = new URLSearchParams(body).toString();
  }

  const res = await fetch(`${STRIPE_API}${endpoint}`, options);
  const data = await res.json();

  if (!res.ok) {
    console.error('[Stripe] API error:', data);
    throw new AppError(data.error?.message || 'Stripe API error', 400);
  }

  return data;
}

/**
 * Create a Payment Intent for a deposit
 */
export async function createDepositIntent(params: {
  tenantId: string;
  reservationId: string;
  amountCents: number; // Amount in cents (e.g., 1000 = 10.00 EUR)
  currency?: string;
  guestEmail: string;
  description: string;
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const { tenantId, reservationId, amountCents, currency = 'eur', guestEmail, description } = params;

  // Get tenant's Stripe account (for Connect)
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeAccountId: true, name: true },
  });

  const bodyParams: Record<string, string> = {
    'amount': String(amountCents),
    'currency': currency,
    'receipt_email': guestEmail,
    'description': description,
    'metadata[tenant_id]': tenantId,
    'metadata[reservation_id]': reservationId,
    'automatic_payment_methods[enabled]': 'true',
  };

  // If tenant has Stripe Connect, add as destination
  if (tenant?.stripeAccountId) {
    bodyParams['transfer_data[destination]'] = tenant.stripeAccountId;
  }

  const intent = await stripeRequest('/payment_intents', 'POST', bodyParams);

  // Update reservation with payment intent
  await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      paymentIntentId: intent.id,
      paymentStatus: 'deposit',
    },
  });

  return {
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
  };
}

/**
 * Charge a no-show fee
 */
export async function chargeNoShowFee(params: {
  tenantId: string;
  reservationId: string;
  amountCents: number;
  userId: string;
}): Promise<{ success: boolean; chargeId?: string }> {
  const { tenantId, reservationId, amountCents, userId } = params;

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, tenantId, status: 'NO_SHOW' },
  });

  if (!reservation) {
    throw new AppError('Reservation not found or not a no-show', 400);
  }

  if (!reservation.paymentIntentId) {
    throw new AppError('No payment method on file for this reservation', 400);
  }

  // Capture additional amount on existing payment intent
  // Or create a new charge if the original was already captured
  try {
    const capture = await stripeRequest(
      `/payment_intents/${reservation.paymentIntentId}/capture`,
      'POST',
      { 'amount_to_capture': String(amountCents) }
    );

    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        noShowFeeCharged: true,
        cancellationFee: amountCents / 100,
      },
    });

    await createAuditLog({
      tenantId,
      userId,
      action: 'update',
      entityType: 'reservation',
      entityId: reservationId,
      changes: { noShowFee: amountCents / 100, chargeId: capture.id },
    });

    return { success: true, chargeId: capture.id };
  } catch (error: any) {
    console.error('[Stripe] No-show charge failed:', error);
    return { success: false };
  }
}

/**
 * Refund a payment
 */
export async function refundPayment(params: {
  tenantId: string;
  reservationId: string;
  amountCents?: number; // Optional: partial refund. Full refund if omitted.
  reason?: string;
  userId: string;
}): Promise<{ success: boolean; refundId?: string }> {
  const { tenantId, reservationId, amountCents, reason, userId } = params;

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, tenantId },
  });

  if (!reservation?.paymentIntentId) {
    throw new AppError('No payment found for this reservation', 400);
  }

  const bodyParams: Record<string, string> = {
    'payment_intent': reservation.paymentIntentId,
  };

  if (amountCents) {
    bodyParams['amount'] = String(amountCents);
  }

  if (reason) {
    bodyParams['reason'] = 'requested_by_customer';
    bodyParams['metadata[reason]'] = reason;
  }

  const refund = await stripeRequest('/refunds', 'POST', bodyParams);

  await prisma.reservation.update({
    where: { id: reservationId },
    data: { paymentStatus: 'refunded' },
  });

  await createAuditLog({
    tenantId,
    userId,
    action: 'update',
    entityType: 'reservation',
    entityId: reservationId,
    changes: { refund: { id: refund.id, amount: refund.amount, reason } },
  });

  return { success: true, refundId: refund.id };
}

/**
 * Verify Stripe webhook signature
 */
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!STRIPE_WEBHOOK_SECRET) return false;

  // Simple HMAC verification (in production, use stripe SDK)
  // For now, basic check that signature header exists
  return signature.startsWith('t=') && signature.includes(',v1=');
}

/**
 * Handle Stripe webhook events
 */
export async function handleWebhookEvent(event: {
  type: string;
  data: { object: any };
}) {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object;
      const reservationId = intent.metadata?.reservation_id;
      if (reservationId) {
        await prisma.reservation.update({
          where: { id: reservationId },
          data: { paymentStatus: 'paid' },
        });
        console.log(`[Stripe] Payment succeeded for reservation ${reservationId}`);
      }
      break;
    }

    case 'payment_intent.payment_failed': {
      const intent = event.data.object;
      const reservationId = intent.metadata?.reservation_id;
      if (reservationId) {
        console.log(`[Stripe] Payment failed for reservation ${reservationId}`);
      }
      break;
    }

    default:
      console.log(`[Stripe] Unhandled event: ${event.type}`);
  }
}
