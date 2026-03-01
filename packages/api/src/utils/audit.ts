import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

interface AuditParams {
  tenantId: string;
  userId?: string | null;
  action: 'create' | 'update' | 'delete' | 'status_change';
  entityType: string;
  entityId: string;
  changes?: Prisma.InputJsonValue | null;
}

export async function createAuditLog(params: AuditParams) {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        changes: params.changes ?? Prisma.JsonNull,
      },
    });
  } catch (error) {
    console.error('[AuditLog] Failed to create audit log:', error);
  }
}
