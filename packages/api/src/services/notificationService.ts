import { prisma } from '../utils/prisma.js';
import {
  sendEmail,
  confirmationEmailHtml,
  cancellationEmailHtml,
  reminderEmailHtml,
  waitlistOfferEmailHtml,
  reviewRequestEmailHtml,
} from './emailService.js';
import {
  sendConfirmationSms,
  sendSms,
  reminderSmsBody,
  sendWaitlistOfferSms,
  sendReviewRequestSms,
} from './smsService.js';

function reservationStartAt(date: Date, time: string) {
  const [h, m] = time.split(':').map(Number);
  const dt = new Date(date);
  dt.setHours(h, m, 0, 0);
  return dt;
}

async function hasSentNotification(params: {
  reservationId: string;
  type: 'reminder' | 'review_request';
  channel: 'email' | 'sms';
  window?: '24h' | '3h';
}) {
  return prisma.notification.findFirst({
    where: {
      reservationId: params.reservationId,
      type: params.type,
      channel: params.channel,
      status: 'sent',
      ...(params.window ? { templateData: { equals: { window: params.window, channel: params.channel } } as any } : {}),
    },
    select: { id: true },
  });
}

export async function sendConfirmationEmail(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      guest: true,
      tenant: { select: { name: true, address: true, settings: true, slug: true } },
      tables: { include: { table: { select: { label: true } } } },
    },
  });

  if (!reservation) return;

  const settings = reservation.tenant.settings as Record<string, unknown>;
  if (settings?.notificationsEnabled === false) return;

  if (reservation.guest.email) {
    const cancelToken = reservation.holdSessionToken;
    const cancelUrl = cancelToken
      ? `${process.env.APP_URL || 'http://localhost:5173'}/cancel?token=${cancelToken}&slug=${encodeURIComponent(reservation.tenant.slug || '')}`
      : undefined;

    const html = confirmationEmailHtml({
      guestName: reservation.guest.name,
      date: reservation.date.toISOString().split('T')[0],
      time: reservation.time,
      partySize: reservation.partySize,
      tenantName: reservation.tenant.name,
      tenantAddress: reservation.tenant.address,
      tables: reservation.tables.map(t => t.table.label).join(', '),
      cancelUrl,
    });

    await sendEmail({
      to: reservation.guest.email,
      subject: `Potrjena rezervacija - ${reservation.tenant.name}`,
      html,
      tenantId: reservation.tenantId,
      reservationId: reservation.id,
      type: 'confirmation',
    });
  }

  if (reservation.guest.phone) {
    sendConfirmationSms(reservationId).catch(err =>
      console.error('[Notification] Confirmation SMS failed:', err)
    );
  }
}

export async function sendCancellationEmail(reservationId: string, reason?: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      guest: true,
      tenant: { select: { name: true } },
    },
  });

  if (!reservation || !reservation.guest.email) return;

  const html = cancellationEmailHtml({
    guestName: reservation.guest.name,
    date: reservation.date.toISOString().split('T')[0],
    time: reservation.time,
    tenantName: reservation.tenant.name,
    reason,
  });

  await sendEmail({
    to: reservation.guest.email,
    subject: `Preklicana rezervacija - ${reservation.tenant.name}`,
    html,
    tenantId: reservation.tenantId,
    reservationId: reservation.id,
    type: 'cancellation',
  });
}

async function sendReminderWindow(window: '24h' | '3h') {
  const now = new Date();
  const targetMins = window === '24h' ? 24 * 60 : 3 * 60;
  const toleranceMins = 20;

  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - 1);
  fromDate.setHours(0, 0, 0, 0);

  const toDate = new Date(now);
  toDate.setDate(toDate.getDate() + 2);
  toDate.setHours(23, 59, 59, 999);

  const reservations = await prisma.reservation.findMany({
    where: {
      date: { gte: fromDate, lte: toDate },
      status: { in: ['CONFIRMED', 'PENDING'] },
    },
    include: {
      guest: true,
      tenant: { select: { name: true, address: true, settings: true } },
    },
  });

  let sent = 0;

  for (const res of reservations) {
    const settings = res.tenant.settings as Record<string, unknown>;
    if (settings?.notificationsEnabled === false) continue;

    const startAt = reservationStartAt(res.date, res.time);
    const diffMins = Math.round((startAt.getTime() - now.getTime()) / 60000);
    if (Math.abs(diffMins - targetMins) > toleranceMins) continue;

    if (res.guest.email) {
      const alreadyEmail = await hasSentNotification({
        reservationId: res.id,
        type: 'reminder',
        channel: 'email',
        window,
      });

      if (!alreadyEmail) {
        const html = reminderEmailHtml({
          guestName: res.guest.name,
          date: res.date.toISOString().split('T')[0],
          time: res.time,
          partySize: res.partySize,
          tenantName: res.tenant.name,
          tenantAddress: res.tenant.address,
          windowLabel: window,
        });

        const ok = await sendEmail({
          to: res.guest.email,
          subject: `Opomnik (${window}) - ${res.tenant.name} ob ${res.time}`,
          html,
          tenantId: res.tenantId,
          reservationId: res.id,
          type: 'reminder',
          templateData: { window, channel: 'email' },
        });
        if (ok) sent++;
      }
    }

    if (res.guest.phone) {
      const alreadySms = await hasSentNotification({
        reservationId: res.id,
        type: 'reminder',
        channel: 'sms',
        window,
      });

      if (!alreadySms) {
        const body = reminderSmsBody({
          date: res.date.toISOString().split('T')[0],
          time: res.time,
          partySize: res.partySize,
          tenantName: res.tenant.name,
        });

        const ok = await sendSms({
          to: res.guest.phone,
          body,
          tenantId: res.tenantId,
          reservationId: res.id,
          type: 'reminder',
          templateData: { window, channel: 'sms' },
        });
        if (ok) sent++;
      }
    }

    await prisma.reservation.update({
      where: { id: res.id },
      data: { reminderSentAt: new Date() },
    });
  }

  return sent;
}

export async function sendReminderEmails() {
  const sent24h = await sendReminderWindow('24h');
  const sent3h = await sendReminderWindow('3h');
  const total = sent24h + sent3h;
  if (total > 0) {
    console.log(`[Reminders] Sent ${total} reminders (24h: ${sent24h}, 3h: ${sent3h})`);
  }
  return total;
}

export async function sendWaitlistOfferNotifications(entryId: string) {
  const entry = await prisma.waitlistEntry.findUnique({
    where: { id: entryId },
    include: {
      guest: true,
      tenant: { select: { name: true, settings: true } },
    },
  });

  if (!entry) return false;
  const settings = entry.tenant.settings as Record<string, unknown>;
  if (settings?.notificationsEnabled === false) return false;

  let sent = false;

  if (entry.guest.email) {
    const html = waitlistOfferEmailHtml({
      guestName: entry.guest.name,
      date: entry.date.toISOString().split('T')[0],
      time: entry.time,
      partySize: entry.partySize,
      tenantName: entry.tenant.name,
    });

    const ok = await sendEmail({
      to: entry.guest.email,
      subject: `Sproscena miza - ${entry.tenant.name}`,
      html,
      tenantId: entry.tenantId,
      type: 'waitlist_offer',
      templateData: { entryId, channel: 'email' },
    });

    if (ok) sent = true;
  }

  if (entry.guest.phone) {
    const ok = await sendWaitlistOfferSms({
      tenantId: entry.tenantId,
      phone: entry.guest.phone,
      date: entry.date.toISOString().split('T')[0],
      time: entry.time,
      tenantName: entry.tenant.name,
      entryId,
    });
    if (ok) sent = true;
  }

  return sent;
}

export async function sendReviewFollowups() {
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const reservations = await prisma.reservation.findMany({
    where: {
      status: 'COMPLETED',
      updatedAt: { lte: cutoff },
    },
    include: {
      guest: true,
      tenant: { select: { name: true, settings: true } },
    },
  });

  let sent = 0;

  for (const res of reservations) {
    const settings = res.tenant.settings as Record<string, unknown>;
    if (settings?.notificationsEnabled === false) continue;

    const alreadySent = await prisma.notification.findFirst({
      where: {
        reservationId: res.id,
        type: 'review_request',
        status: 'sent',
      },
      select: { id: true },
    });

    if (alreadySent) continue;

    const reviewUrl = typeof settings?.reviewUrl === 'string' ? settings.reviewUrl : undefined;

    if (res.guest.email) {
      const html = reviewRequestEmailHtml({
        guestName: res.guest.name,
        tenantName: res.tenant.name,
        reviewUrl,
      });

      const ok = await sendEmail({
        to: res.guest.email,
        subject: `Hvala za obisk - ${res.tenant.name}`,
        html,
        tenantId: res.tenantId,
        reservationId: res.id,
        type: 'review_request',
        templateData: { channel: 'email' },
      });
      if (ok) sent++;
    }

    if (res.guest.phone) {
      const ok = await sendReviewRequestSms({
        tenantId: res.tenantId,
        reservationId: res.id,
        phone: res.guest.phone,
        tenantName: res.tenant.name,
        reviewUrl,
      });
      if (ok) sent++;
    }
  }

  if (sent > 0) {
    console.log(`[ReviewFollowup] Sent ${sent} follow-up notifications`);
  }

  return sent;
}
