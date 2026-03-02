import { Router, Request, Response, NextFunction } from 'express';
import {
  createFloorPlanSchema, updateFloorPlanSchema,
  createTableSchema, updateTableSchema,
  createAdjacencySchema,
} from '@yourtable/shared';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createAuditLog } from '../utils/audit.js';
import { NotFoundError, AppError } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);

// ============================================
// FLOOR PLANS
// ============================================

/**
 * GET /api/v1/floor-plans
 * List all floor plans with tables
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const floorPlans = await prisma.floorPlan.findMany({
      where: { tenantId: req.tenantId!, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        tables: {
          where: { isActive: true },
          orderBy: { label: 'asc' },
        },
        _count: { select: { tables: true } },
      },
    });

    res.json({ data: floorPlans });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/floor-plans/:id
 * Get floor plan with tables and adjacency
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const floorPlan = await prisma.floorPlan.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId! },
      include: {
        tables: {
          where: { isActive: true },
          orderBy: { label: 'asc' },
          include: {
            adjacencyA: true,
            adjacencyB: true,
          },
        },
      },
    });

    if (!floorPlan) throw new NotFoundError('FloorPlan', req.params.id);

    // Flatten adjacency into a clean format
    const adjacency: Array<{ tableAId: string; tableBId: string; canJoin: boolean; joinMaxSeats: number | null }> = [];
    const seen = new Set<string>();

    for (const table of floorPlan.tables) {
      for (const adj of [...table.adjacencyA, ...table.adjacencyB]) {
        const key = [adj.tableAId, adj.tableBId].sort().join(':');
        if (!seen.has(key)) {
          seen.add(key);
          adjacency.push({
            tableAId: adj.tableAId,
            tableBId: adj.tableBId,
            canJoin: adj.canJoin,
            joinMaxSeats: adj.joinMaxSeats,
          });
        }
      }
    }

    res.json({
      data: {
        ...floorPlan,
        adjacency,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/floor-plans
 * Create new floor plan
 */
router.post(
  '/',
  requireRole('owner', 'admin', 'manager'),
  validate(createFloorPlanSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const floorPlan = await prisma.floorPlan.create({
        data: {
          tenantId: req.tenantId!,
          ...req.body,
        },
      });

      await createAuditLog({
        tenantId: req.tenantId!,
        userId: req.user!.id,
        action: 'create',
        entityType: 'floor_plan',
        entityId: floorPlan.id,
      });

      res.status(201).json({ data: floorPlan });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/floor-plans/:id
 * Update floor plan (name, layout config)
 */
router.put(
  '/:id',
  requireRole('owner', 'admin', 'manager'),
  validate(updateFloorPlanSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.floorPlan.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId! },
      });
      if (!existing) throw new NotFoundError('FloorPlan', req.params.id);

      const floorPlan = await prisma.floorPlan.update({
        where: { id: req.params.id },
        data: req.body,
      });

      await createAuditLog({
        tenantId: req.tenantId!,
        userId: req.user!.id,
        action: 'update',
        entityType: 'floor_plan',
        entityId: floorPlan.id,
        changes: { before: existing, after: floorPlan },
      });

      res.json({ data: floorPlan });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/floor-plans/:id
 * Soft-delete floor plan
 */
router.delete(
  '/:id',
  requireRole('owner', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.floorPlan.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId! },
      });
      if (!existing) throw new NotFoundError('FloorPlan', req.params.id);

      await prisma.floorPlan.update({
        where: { id: req.params.id },
        data: { isActive: false },
      });

      await createAuditLog({
        tenantId: req.tenantId!,
        userId: req.user!.id,
        action: 'delete',
        entityType: 'floor_plan',
        entityId: req.params.id,
      });

      res.json({ data: { message: 'Floor plan deactivated' } });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// TABLES
// ============================================

/**
 * POST /api/v1/floor-plans/:id/tables
 * Add table to floor plan
 */
router.post(
  '/:id/tables',
  requireRole('owner', 'admin', 'manager'),
  validate(createTableSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Verify floor plan belongs to tenant
      const floorPlan = await prisma.floorPlan.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId! },
      });
      if (!floorPlan) throw new NotFoundError('FloorPlan', req.params.id);

      const table = await prisma.restaurantTable.create({
        data: {
          ...req.body,
          floorPlanId: req.params.id,
        },
      });

      await createAuditLog({
        tenantId: req.tenantId!,
        userId: req.user!.id,
        action: 'create',
        entityType: 'table',
        entityId: table.id,
      });

      res.status(201).json({ data: table });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/floor-plans/:id/tables/batch
 * Batch update table positions (drag & drop from floor editor)
 */
router.put(
  '/:id/tables/batch',
  requireRole('owner', 'admin', 'manager'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tables } = req.body;
      if (!Array.isArray(tables) || tables.length === 0) {
        throw new AppError('tables array is required', 400);
      }

      // Verify floor plan
      const floorPlan = await prisma.floorPlan.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId! },
      });
      if (!floorPlan) throw new NotFoundError('FloorPlan', req.params.id);

      // Batch update in transaction
      const results = await prisma.$transaction(
        tables.map((t: { id: string; positionX?: number; positionY?: number; width?: number; height?: number }) =>
          prisma.restaurantTable.update({
            where: { id: t.id },
            data: {
              ...(t.positionX !== undefined && { positionX: t.positionX }),
              ...(t.positionY !== undefined && { positionY: t.positionY }),
              ...(t.width !== undefined && { width: t.width }),
              ...(t.height !== undefined && { height: t.height }),
            },
          })
        )
      );

      res.json({ data: results });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/floor-plans/:floorPlanId/tables/:tableId
 * Update table (position, capacity, shape, etc.)
 */
router.put(
  '/:floorPlanId/tables/:tableId',
  requireRole('owner', 'admin', 'manager'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const table = await prisma.restaurantTable.findFirst({
        where: {
          id: req.params.tableId,
          floorPlanId: req.params.floorPlanId,
          floorPlan: { tenantId: req.tenantId! },
        },
      });
      if (!table) throw new NotFoundError('Table', req.params.tableId);

      const updated = await prisma.restaurantTable.update({
        where: { id: req.params.tableId },
        data: req.body,
      });

      await createAuditLog({
        tenantId: req.tenantId!,
        userId: req.user!.id,
        action: 'update',
        entityType: 'table',
        entityId: updated.id,
        changes: { before: table, after: updated },
      });

      res.json({ data: updated });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/floor-plans/:floorPlanId/tables/:tableId
 * Soft-delete table
 */
router.delete(
  '/:floorPlanId/tables/:tableId',
  requireRole('owner', 'admin', 'manager'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const table = await prisma.restaurantTable.findFirst({
        where: {
          id: req.params.tableId,
          floorPlanId: req.params.floorPlanId,
          floorPlan: { tenantId: req.tenantId! },
        },
      });
      if (!table) throw new NotFoundError('Table', req.params.tableId);

      await prisma.restaurantTable.update({
        where: { id: req.params.tableId },
        data: { isActive: false },
      });

      await createAuditLog({
        tenantId: req.tenantId!,
        userId: req.user!.id,
        action: 'delete',
        entityType: 'table',
        entityId: req.params.tableId,
      });

      res.json({ data: { message: 'Table deactivated' } });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// ADJACENCY
// ============================================

/**
 * POST /api/v1/floor-plans/:id/adjacency
 * Create adjacency rule between two tables
 */
router.post(
  '/:id/adjacency',
  requireRole('owner', 'admin', 'manager'),
  validate(createAdjacencySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tableAId, tableBId, canJoin, joinMaxSeats } = req.body;

      // Verify both tables belong to this floor plan and tenant
      const tables = await prisma.restaurantTable.findMany({
        where: {
          id: { in: [tableAId, tableBId] },
          floorPlanId: req.params.id,
          floorPlan: { tenantId: req.tenantId! },
        },
      });

      if (tables.length !== 2) {
        throw new AppError('Both tables must belong to this floor plan', 400);
      }

      // Always store with smaller ID first for consistency
      const [aId, bId] = [tableAId, tableBId].sort();

      const adjacency = await prisma.tableAdjacency.upsert({
        where: { tableAId_tableBId: { tableAId: aId, tableBId: bId } },
        update: { canJoin, joinMaxSeats },
        create: { tableAId: aId, tableBId: bId, canJoin, joinMaxSeats },
      });

      res.status(201).json({ data: adjacency });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/floor-plans/:id/adjacency
 * Remove adjacency rule
 */
router.delete(
  '/:id/adjacency',
  requireRole('owner', 'admin', 'manager'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tableAId, tableBId } = req.body;
      if (!tableAId || !tableBId) {
        throw new AppError('tableAId and tableBId are required', 400);
      }

      const [aId, bId] = [tableAId, tableBId].sort();

      await prisma.tableAdjacency.delete({
        where: { tableAId_tableBId: { tableAId: aId, tableBId: bId } },
      });

      res.json({ data: { message: 'Adjacency removed' } });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
