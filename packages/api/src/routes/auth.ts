import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { supabasePublic } from '../utils/supabase.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();


// POST /api/v1/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'ValidationError', message: 'Email and password required', statusCode: 400 });
      return;
    }

    const { data, error } = await supabasePublic.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      res.status(401).json({ error: 'Unauthorized', message: error?.message ?? 'Login failed', statusCode: 401 });
      return;
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: data.user.id },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
    });
    if (!dbUser || !dbUser.isActive) {
      res.status(403).json({ error: 'Forbidden', message: 'User not found or inactive', statusCode: 403 });
      return;
    }

    // Matches frontend: const { accessToken, user, tenant } = json.data
    res.status(200).json({
      data: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        user: { id: dbUser.id, email: dbUser.email, name: dbUser.name, role: dbUser.role, tenantId: dbUser.tenantId },
        tenant: dbUser.tenant,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'ValidationError', message: 'Refresh token required', statusCode: 400 });
      return;
    }

    const { data, error } = await supabasePublic.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) {
      res.status(401).json({ error: 'Unauthorized', message: 'Token refresh failed', statusCode: 401 });
      return;
    }

    res.status(200).json({
      data: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/me
// Frontend: const { data } = await res.json(); set({ user: data, accessToken: ... })
router.get('/me', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
    });
    if (!user) {
      res.status(404).json({ error: 'NotFound', message: 'User not found', statusCode: 404 });
      return;
    }
    res.status(200).json({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        tenant: user.tenant,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/logout
router.post('/logout', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
