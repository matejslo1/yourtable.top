import prisma from '../lib/prisma.js';
import { getAvailability } from '../services/availability.js';
import { cleanupExpiredOffers, offerSpot } from '../services/waitlistService.js';
import { sendWaitlistOfferNotifications } from '../services/notificationService.js';

const WAITLIST_INTERVAL_MS = 5 * 60 * 1000; // every 5 min

let intervalId: NodeJS.Timeout | null = null;

export function startWaitlistOfferJob() {
  console.log('[Cron] Waitlist auto-offer job started (every 5min)');
  runWaitlistAutoOffer();
  intervalId = setInterval(runWaitlistAutoOffer, WAITLIST_INTERVAL_MS);
}

export function stopWaitlistOfferJob() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[Cron] Waitlist auto-offer job stopped');
  }
}

async function runWaitlistAutoOffer() {
  try {
    await cleanupExpiredOffers();

    const entries = await prisma.waitlistEntry.findMany({
      where: { status: 'waiting' },
      include: {
        tenant: { include: { seatingConfig: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 50,
    });

    let offered = 0;

    for (const entry of entries) {
      if (!entry.tenant.seatingConfig?.waitlistEnabled) continue;

      const date = new Date(entry.date);
      const day = new Date(`${date.toISOString().slice(0, 10)}T00:00:00`);
      const [h, m] = entry.time.split(':').map(Number);
      const slotAt = new Date(day);
      slotAt.setHours(h, m, 0, 0);
      if (slotAt.getTime() < Date.now() - 15 * 60 * 1000) continue;

      const availability = await getAvailability({
        tenantId: entry.tenantId,
        date: day,
        partySize: entry.partySize,
      });

      const requestedSlot = availability.slots.find(s => s.time === entry.time);
      if (!requestedSlot?.available) continue;

      const updated = await offerSpot(entry.id, entry.tenantId);
      await sendWaitlistOfferNotifications(updated.id);
      offered++;
    }

    if (offered > 0) {
      console.log(`[Cron] Waitlist auto-offer sent ${offered} offers`);
    }
  } catch (error) {
    console.error('[Cron] Waitlist auto-offer failed:', error);
  }
}
