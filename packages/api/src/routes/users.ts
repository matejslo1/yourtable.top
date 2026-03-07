import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../utils/supabase.js';

const router = Router();
router.use(requireAuth);

// GET /api/v1/users
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({ where: { tenantId: req.user!.tenantId } });
    res.status(200).json(users);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/users/:id
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
    if (!user) { res.status(404).json({ error: 'NotFound', message: 'User not found', statusCode: 404 }); return; }
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/users — Create new user in this tenant
router.post('/', requireRole('owner', 'admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, role = 'staff' } = req.body as {
      email?: string; password?: string; name?: string; role?: string;
    };

    if (!email || !password || !name) {
      res.status(400).json({ error: 'BadRequest', message: 'email, password and name are required', statusCode: 400 });
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
      res.status(400).json({ error: 'BadRequest', message: authError?.message ?? 'Failed to create auth user', statusCode: 400 });
      return;
    }

    // Create user in DB
    const user = await prisma.user.create({
      data: {
        tenantId: req.user!.tenantId,
        supabaseUserId: authData.user.id,
        email,
        name,
        role,
      },
    });

    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/users/:id — Update name/role
router.patch('/:id', requireRole('owner', 'admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, role } = req.body as { name?: string; role?: string };

    const existing = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
    if (!existing) { res.status(404).json({ error: 'NotFound', message: 'User not found', statusCode: 404 }); return; }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { ...(name && { name }), ...(role && { role }) },
    });

    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/users/:id/change-password — Change password for a user
router.post('/:id/change-password', requireRole('owner', 'admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { password } = req.body as { password?: string };

    if (!password || password.length < 6) {
      res.status(400).json({ error: 'BadRequest', message: 'Password must be at least 6 characters', statusCode: 400 });
      return;
    }

    const existing = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
    if (!existing) { res.status(404).json({ error: 'NotFound', message: 'User not found', statusCode: 404 }); return; }

    const admin = supabaseAdmin();
    const { error } = await admin.auth.admin.updateUserById(existing.supabaseUserId, { password });

    if (error) {
      res.status(400).json({ error: 'BadRequest', message: error.message, statusCode: 400 });
      return;
    }

    res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/users/me/change-password — Change own password
router.post('/me/change-password', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { password } = req.body as { password?: string };

    if (!password || password.length < 6) {
      res.status(400).json({ error: 'BadRequest', message: 'Password must be at least 6 characters', statusCode: 400 });
      return;
    }

    const admin = supabaseAdmin();
    const { error } = await admin.auth.admin.updateUserById(req.user!.supabaseUserId, { password });

    if (error) {
      res.status(400).json({ error: 'BadRequest', message: error.message, statusCode: 400 });
      return;
    }

    res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/users/:id — Delete user
router.delete('/:id', requireRole('owner'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Prevent deleting yourself
    if (req.params.id === req.user!.id) {
      res.status(400).json({ error: 'BadRequest', message: 'Cannot delete your own account', statusCode: 400 });
      return;
    }

    const existing = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
    if (!existing) { res.status(404).json({ error: 'NotFound', message: 'User not found', statusCode: 404 }); return; }

    // Delete from Supabase auth
    const admin = supabaseAdmin();
    await admin.auth.admin.deleteUser(existing.supabaseUserId);

    // Delete from DB
    await prisma.user.delete({ where: { id: req.params.id } });

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
