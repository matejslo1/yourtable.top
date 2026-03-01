import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../utils/supabase.js';
import { prisma } from '../utils/prisma.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import type { UserRole } from '@yourtable/shared';

// Extend Express Request with our auth context
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;           // our User.id
        supabaseUserId: string;
        email: string;
        name: string;
        role: UserRole;
        tenantId: string;
        permissions: Record<string, boolean>;
      };
      tenantId?: string;
    }
  }
}

/**
 * Middleware: Verify Supabase JWT and load user + tenant context
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);

    // Verify JWT with Supabase
    const { data: { user: supabaseUser }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !supabaseUser) {
      throw new UnauthorizedError('Invalid or expired token');
    }

    // Load our user record with tenant
    const user = await prisma.user.findUnique({
      where: { supabaseUserId: supabaseUser.id },
      include: { tenant: { select: { id: true, isActive: true } } },
    });

    if (!user) {
      throw new UnauthorizedError('User not found in system. Please contact your administrator.');
    }

    if (!user.isActive) {
      throw new ForbiddenError('Your account has been deactivated');
    }

    if (!user.tenant.isActive) {
      throw new ForbiddenError('This restaurant account has been deactivated');
    }

    // Set auth context on request
    req.user = {
      id: user.id,
      supabaseUserId: user.supabaseUserId,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      tenantId: user.tenantId,
      permissions: user.permissions as Record<string, boolean>,
    };
    req.tenantId = user.tenantId;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware factory: Require specific role(s)
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError(`This action requires one of these roles: ${roles.join(', ')}`));
    }

    next();
  };
}

/**
 * Middleware: Resolve tenant from slug (for public endpoints like booking widget)
 */
export async function resolveTenant(req: Request, _res: Response, next: NextFunction) {
  try {
    const slug = req.params.tenantSlug;
    if (!slug) {
      throw new UnauthorizedError('Missing tenant identifier');
    }

    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, isActive: true, settings: true },
    });

    if (!tenant || !tenant.isActive) {
      throw new UnauthorizedError('Restaurant not found or inactive');
    }

    req.tenantId = tenant.id;
    next();
  } catch (error) {
    next(error);
  }
}
