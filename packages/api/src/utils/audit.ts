import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

interface AuditParams {
  tenantId: string;
  userId?: string | null;
  action: 'create' | 'update' | 'delete' | 'status_change';
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown> | null;
}

export async function createAuditLog(params: AuditParams) {
  try {
    const changes: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue =
      params.changes ?? Prisma.JsonNull;

    await prisma.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        changes,
      },
    });
  } catch (error) {
    // Audit log should never break the main flow
    console.error('[AuditLog] Failed to create audit log:', error);
  }
}
