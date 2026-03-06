import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { supabasePublic, supabaseAdmin } from '../utils/supabase.js';
import { UnauthorizedError, AppError } from '../utils/errors.js';

const router = Router();

// POST /api/v1/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'BadRequest', message: 'Email and password are required', statusCode: 400 });
      return;
    }
    const { data, error } = await supabasePublic.auth.signInWithPassword({ email, password });
    if (error || !data?.session) throw new UnauthorizedError(error?.message ?? 'Invalid credentials');
    res.status(200).json({
      data: { accessToken: data.session.access_token, refreshToken: data.session.refresh_token, expiresAt: data.session.expires_at, user: data.user },
    });
  } catch (err) { next(err); }
});

// POST /api/v1/auth/register — Create new user + tenant (blank workspace)
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, restaurantName, restaurantSlug, address, phone: restaurantPhone } = req.body as {
      email?: string; password?: string; name?: string; restaurantName?: string; restaurantSlug?: string; address?: string; phone?: string;
    };

    if (!email || !password || !name || !restaurantName) {
      res.status(400).json({ error: 'BadRequest', message: 'email, password, name, and restaurantName are required', statusCode: 400 });
      return;
    }

    // Generate slug from restaurant name if not provided
    const slug = restaurantSlug || restaurantName.toLowerCase()
      .replace(/[čć]/g, 'c').replace(/[šś]/g, 's').replace(/[žź]/g, 'z').replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Check slug uniqueness
    const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
    if (existingTenant) {
      res.status(409).json({ error: 'Conflict', message: 'Restaurant slug already exists', statusCode: 409 });
      return;
    }

    // Create Supabase auth user
    const admin = supabaseAdmin();
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData?.user) {
      throw new AppError(authError?.message ?? 'Failed to create auth user', 400);
    }

    // Create tenant + user + default config in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: restaurantName,
          slug,
          address: address || '',
          phone: restaurantPhone || null,
          email,
          timezone: 'Europe/Ljubljana',
          settings: { languages: ['sl', 'en'], currency: 'EUR', notificationsEnabled: true, bookingWidgetEnabled: true },
        },
      });

      // Create user (owner)
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          supabaseUserId: authData.user.id,
          email,
          name,
          role: 'owner',
        },
      });

      // Create default seating config
      await tx.seatingConfig.create({
        data: {
          tenantId: tenant.id,
          holdTtlSeconds: 420,
          maxJoinTables: 3,
          autoConfirm: true,
          defaultDurationMin: 90,
          maxPartySize: 12,
          minAdvanceHours: 2,
          maxAdvanceDays: 60,
        },
      });

      // Create default operating hours (Mon-Sat 11:00-22:00, Sun closed)
      const defaultHours = [
        { dayOfWeek: 0, openTime: '11:00', closeTime: '22:00', lastReservation: '21:00', isClosed: false, slotDurationMin: 30 },
        { dayOfWeek: 1, openTime: '11:00', closeTime: '22:00', lastReservation: '21:00', isClosed: false, slotDurationMin: 30 },
        { dayOfWeek: 2, openTime: '11:00', closeTime: '22:00', lastReservation: '21:00', isClosed: false, slotDurationMin: 30 },
        { dayOfWeek: 3, openTime: '11:00', closeTime: '22:00', lastReservation: '21:00', isClosed: false, slotDurationMin: 30 },
        { dayOfWeek: 4, openTime: '11:00', closeTime: '23:00', lastReservation: '22:00', isClosed: false, slotDurationMin: 30 },
        { dayOfWeek: 5, openTime: '11:00', closeTime: '23:00', lastReservation: '22:00', isClosed: false, slotDurationMin: 30 },
        { dayOfWeek: 6, openTime: '11:00', closeTime: '22:00', lastReservation: '21:00', isClosed: true, slotDurationMin: 30 },
      ];

      for (const h of defaultHours) {
        await tx.operatingHours.create({ data: { tenantId: tenant.id, ...h } });
      }

      return { tenant, user };
    });

    // Auto-login
    const { data: loginData } = await supabasePublic.auth.signInWithPassword({ email, password });

    res.status(201).json({
      data: {
        tenant: result.tenant,
        user: result.user,
        accessToken: loginData?.session?.access_token,
        refreshToken: loginData?.session?.refresh_token,
      },
      message: 'Registration successful',
    });
  } catch (err) { next(err); }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      res.status(400).json({ error: 'BadRequest', message: 'refreshToken is required', statusCode: 400 });
      return;
    }
    const { data, error } = await supabasePublic.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data?.session) throw new UnauthorizedError(error?.message ?? 'Failed to refresh session');
    res.status(200).json({
      data: { accessToken: data.session.access_token, refreshToken: data.session.refresh_token, expiresAt: data.session.expires_at },
    });
  } catch (err) { next(err); }
});

// GET /api/v1/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.user!.id, tenantId: req.user!.tenantId },
      include: { tenant: true },
    });
    if (!user) throw new UnauthorizedError('User not found');
    res.status(200).json({ data: user });
  } catch (err) { next(err); }
});

// POST /api/v1/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.status(200).json({ success: true });
});

export default router;
