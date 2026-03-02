import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import prisma from '../lib/prisma.js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export interface AuthRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    role: string;
    supabaseUserId: string;
  };
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized', message: 'Missing token', statusCode: 401 });
      return;
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid token', statusCode: 401 });
      return;
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: user.id },
    });

    if (!dbUser || !dbUser.isActive) {
      res.status(403).json({ error: 'Forbidden', message: 'User not found or inactive', statusCode: 403 });
      return;
    }

    req.user = {
      id: dbUser.id,
      tenantId: dbUser.tenantId,
      role: dbUser.role,
      supabaseUserId: dbUser.supabaseUserId,
    };

    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions', statusCode: 403 });
      return;
    }
    next();
  };
}
