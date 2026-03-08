import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

function extractMeta(notes: string | null | undefined): { preferences?: Record<string, any>; houseNotes?: string } {
  if (!notes) return {};
  const marker = '\n__meta__:';
  const idx = notes.indexOf(marker);
  if (idx < 0) return { houseNotes: notes };
  const plain = notes.slice(0, idx).trim();
  const json = notes.slice(idx + marker.length).trim();
  try {
    const parsed = JSON.parse(json);
    return { preferences: parsed.preferences ?? {}, houseNotes: plain || parsed.houseNotes };
  } catch {
    return { houseNotes: notes };
  }
}

function mergeMeta(notes: string | null | undefined, data: { preferences?: Record<string, any>; houseNotes?: string }) {
  const prefs = data.preferences ?? {};
  const house = data.houseNotes ?? extractMeta(notes).houseNotes ?? '';
  const meta = JSON.stringify({ preferences: prefs, houseNotes: house });
  return `${house}\n__meta__:${meta}`;
}

// GET /api/v1/guests
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { search, page = '1', pageSize = '20' } = req.query as Record<string, string | undefined>;
    const pageNum = Math.max(parseInt(page ?? '1', 10) || 1, 1);
    const sizeNum = Math.min(Math.max(parseInt(pageSize ?? '20', 10) || 20, 1), 100);
    const skip = (pageNum - 1) * sizeNum;

    const where: any = { tenantId: req.user!.tenantId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search } },
      ];
    }

    const [data, total] = await prisma.$transaction([
      prisma.guest.findMany({
        where, orderBy: { name: 'asc' }, skip, take: sizeNum,
        include: { _count: { select: { reservations: true } } },
      }),
      prisma.guest.count({ where }),
    ]);

    res.status(200).json({ data, meta: { total, page: pageNum, pageSize: sizeNum } });
  } catch (err) { next(err); }
});

// GET /api/v1/guests/:id — includes reservation history
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const guest = await prisma.guest.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
      include: {
        reservations: {
          orderBy: { date: 'desc' },
          take: 20,
          include: { tables: { include: { table: { select: { label: true } } } } },
        },
      },
    });
    if (!guest) {
      res.status(404).json({ error: 'NotFound', message: 'Guest not found', statusCode: 404 });
      return;
    }
    res.status(200).json({ data: guest });
  } catch (err) { next(err); }
});

// POST /api/v1/guests
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const guest = await prisma.guest.create({ data: { ...req.body, tenantId: req.user!.tenantId } });
    res.status(201).json({ data: guest });
  } catch (err) { next(err); }
});

// PATCH /api/v1/guests/:id
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const updated = await prisma.guest.updateMany({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
      data: req.body,
    });
    res.status(200).json({ data: updated });
  } catch (err) { next(err); }
});

// PUT /api/v1/guests/:id/blacklist — toggle blacklist
router.put('/:id/blacklist', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const guest = await prisma.guest.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
    if (!guest) {
      res.status(404).json({ error: 'NotFound', message: 'Guest not found', statusCode: 404 });
      return;
    }
    const updated = await prisma.guest.update({
      where: { id: req.params.id },
      data: { isBlacklisted: !guest.isBlacklisted },
    });
    res.status(200).json({ data: updated });
  } catch (err) { next(err); }
});

// GET /api/v1/guests/:id/profile — CRM v2 profile
router.get('/:id/profile', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const guest = await prisma.guest.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
      include: {
        reservations: {
          where: { status: { in: ['CONFIRMED', 'SEATED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'] } },
          orderBy: { date: 'desc' },
          take: 100,
        },
      },
    });
    if (!guest) {
      res.status(404).json({ error: 'NotFound', message: 'Guest not found', statusCode: 404 });
      return;
    }

    const tags = (guest.tags as string[] | null) ?? [];
    const vipTag = tags.find(t => t.startsWith('VIP:'));
    const vipLevel = vipTag ? vipTag.split(':')[1] : 'none';
    const meta = extractMeta(guest.notes);

    const completed = guest.reservations.filter(r => r.status === 'COMPLETED').length;
    const noShows = guest.reservations.filter(r => r.status === 'NO_SHOW').length;
    const cancellations = guest.reservations.filter(r => r.status === 'CANCELLED').length;
    const ltvScore = Math.max(0, Math.min(100, completed * 8 - noShows * 15 - cancellations * 5 + guest.visitCount * 2));

    res.status(200).json({
      data: {
        guestId: guest.id,
        vipLevel,
        preferences: meta.preferences ?? {},
        houseNotes: meta.houseNotes ?? '',
        metrics: {
          completed,
          noShows,
          cancellations,
          visitCount: guest.visitCount,
          ltvScore,
        },
      },
    });
  } catch (err) { next(err); }
});

// PUT /api/v1/guests/:id/profile — CRM v2 update
router.put('/:id/profile', requireRole('owner', 'admin', 'manager', 'staff'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { vipLevel, preferences, houseNotes } = req.body as {
      vipLevel?: 'none' | 'silver' | 'gold' | 'platinum';
      preferences?: Record<string, any>;
      houseNotes?: string;
    };
    const guest = await prisma.guest.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
    if (!guest) {
      res.status(404).json({ error: 'NotFound', message: 'Guest not found', statusCode: 404 });
      return;
    }

    const tags = ((guest.tags as string[] | null) ?? []).filter(t => !t.startsWith('VIP:'));
    if (vipLevel && vipLevel !== 'none') tags.push(`VIP:${vipLevel}`);

    const updated = await prisma.guest.update({
      where: { id: guest.id },
      data: {
        tags: tags as any,
        notes: mergeMeta(guest.notes, { preferences, houseNotes }),
      },
    });

    res.status(200).json({ data: updated });
  } catch (err) { next(err); }
});

export default router;
