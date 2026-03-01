import { Router, Request, Response, NextFunction } from 'express';
import { loginSchema, registerSchema, createTenantSchema } from '@yourtable/shared';
import { supabaseAdmin } from '../utils/supabase.js';
import { prisma } from '../utils/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError, ConflictError } from '../utils/errors.js';

const router = Router();

/**
 * POST /api/v1/auth/register
 * Register new restaurant owner + create tenant
 * This is the onboarding endpoint - creates Supabase user, Tenant, and User record
 */
router.post(
  '/register',
  validate(registerSchema.merge(createTenantSchema)),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, name, slug, address, phone, timezone } = req.body;

      // Check if slug is taken
      const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
      if (existingTenant) {
        throw new ConflictError(`The slug "${slug}" is already taken`);
      }

      // Create Supabase auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm for now; enable verification later
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          throw new ConflictError('An account with this email already exists');
        }
        throw new AppError(authError.message, 400);
      }

      // Create Tenant + User in a transaction
      const result = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: name || slug,
            slug,
            address: address || '',
            phone: phone || null,
            email,
            timezone: timezone || 'Europe/Ljubljana',
          },
        });

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
          data: { tenantId: tenant.id },
        });

        // Create default operating hours (Mon-Sun, 11:00-23:00)
        const defaultHours = Array.from({ length: 7 }, (_, i) => ({
          tenantId: tenant.id,
          dayOfWeek: i,
          openTime: '11:00',
          closeTime: '23:00',
          lastReservation: '21:30',
          isClosed: false,
          slotDurationMin: 30,
        }));

        await tx.operatingHours.createMany({ data: defaultHours });

        return { tenant, user };
      });

      // Sign in to get session token
      const { data: session, error: signInError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email,
      });

      res.status(201).json({
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            role: result.user.role,
          },
          tenant: {
            id: result.tenant.id,
            name: result.tenant.name,
            slug: result.tenant.slug,
          },
          message: 'Registration successful. Please sign in.',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/login
 * Login with email + password via Supabase
 */
router.post(
  '/login',
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      // Authenticate with Supabase
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new AppError('Invalid email or password', 401);
      }

      // Load our user record
      const user = await prisma.user.findUnique({
        where: { supabaseUserId: data.user.id },
        include: {
          tenant: { select: { id: true, name: true, slug: true, isActive: true } },
        },
      });

      if (!user || !user.isActive) {
        throw new AppError('Account not found or deactivated', 401);
      }

      if (!user.tenant.isActive) {
        throw new AppError('Restaurant account is deactivated', 403);
      }

      res.json({
        data: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: data.session.expires_at,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
          tenant: {
            id: user.tenant.id,
            name: user.tenant.name,
            slug: user.tenant.slug,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw new AppError('Missing refresh token', 400);
    }

    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    res.json({
      data: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/me
 * Get current user profile
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: {
      tenant: {
        select: { id: true, name: true, slug: true, logoUrl: true, settings: true, timezone: true },
      },
    },
  });

  res.json({ data: user });
});

/**
 * POST /api/v1/auth/logout
 * Logout (invalidate session server-side)
 */
router.post('/logout', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.substring(7);
    if (token) {
      await supabaseAdmin.auth.admin.signOut(token);
    }
    res.json({ data: { message: 'Logged out successfully' } });
  } catch (error) {
    next(error);
  }
});

export default router;
