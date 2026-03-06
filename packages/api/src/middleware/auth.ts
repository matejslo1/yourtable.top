import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { supabasePublic } from '../utils/supabase.js';
import { AppError, UnauthorizedError, ForbiddenError } from '../utils/errors.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    role: string;
    supabaseUserId: string;
    email?: string | null;
  };
}

function bearerToken(req: Request) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1];
}

export async function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const token = bearerToken(req);
    if (!token) throw new UnauthorizedError('Missing Authorization: Bearer <token>');

    const { data, error } = await supabasePublic.auth.getUser(token);
    if (error || !data?.user) throw new UnauthorizedError(error?.message ?? 'Invalid token');

    const supabaseUserId = data.user.id;

    let user;
    try {
      user = await prisma.user.findFirst({
        where: { supabaseUserId },
        select: { id: true, tenantId: true, role: true, supabaseUserId: true, email: true },
      });
    } catch (e: any) {
      throw new AppError(
        `Prisma failed in requireAuth. Check DATABASE_URL and run migrations. Details: ${e?.message ?? String(e)}`,
        500
      );
    }

    if (!user) throw new ForbiddenError('SetupRequired: app user missing (seed required)');
    if (!user.tenantId) throw new ForbiddenError('SetupRequired: user has no tenantId (seed required)');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Backwards-compatible export used in routes
export function requireRole(...allowedRoles: string[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    const role = req.user?.role;

    if (!role) {
      return next(new UnauthorizedError('Missing auth context (requireAuth must run first)'));
    }

    // admin always allowed
    if (role === 'admin') return next();

    if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
      return next(new UnauthorizedError('Insufficient permissions'));
    }

    return next();
  };
}
