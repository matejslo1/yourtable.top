import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { supabaseAdmin } from '../utils/supabase.js';
import { AppError } from '../utils/errors.js';

const router = Router();

// POST /api/v1/setup/superadmin
// One-time endpoint to create the platform superadmin.
// Protected by SETUP_SECRET environment variable.
router.post('/superadmin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const secret = process.env.SETUP_SECRET;
    if (!secret) {
      res.status(503).json({ error: 'NotConfigured', message: 'SETUP_SECRET is not set', statusCode: 503 });
      return;
    }

    const providedSecret = req.headers['x-setup-secret'];
    if (providedSecret !== secret) {
      res.status(403).json({ error: 'Forbidden', message: 'Invalid setup secret', statusCode: 403 });
      return;
    }

    const { email, password, name } = req.body as { email?: string; password?: string; name?: string };
    if (!email || !password || !name) {
      res.status(400).json({ error: 'BadRequest', message: 'email, password, and name are required', statusCode: 400 });
      return;
    }

    // Check if superadmin already exists
    const existing = await prisma.user.findFirst({ where: { role: 'superadmin' } });
    if (existing) {
      res.status(409).json({ error: 'Conflict', message: 'Superadmin already exists', statusCode: 409 });
      return;
    }

    // Ensure platform tenant exists
    let platformTenant = await prisma.tenant.findUnique({ where: { slug: '__platform__' } });
    if (!platformTenant) {
      platformTenant = await prisma.tenant.create({
        data: {
          name: 'Platform',
          slug: '__platform__',
          address: 'Platform',
          email,
          timezone: 'Europe/Ljubljana',
        },
      });
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

    // Create superadmin user record
    const user = await prisma.user.create({
      data: {
        tenantId: platformTenant.id,
        supabaseUserId: authData.user.id,
        email,
        name,
        role: 'superadmin',
      },
    });

    res.status(201).json({
      message: 'Superadmin created successfully',
      userId: user.id,
      email: user.email,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
