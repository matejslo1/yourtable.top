import { prisma } from '../utils/prisma.js';
import {
  sendEmail,
  confirmationEmailHtml,
  cancellationEmailHtml,
  reminderEmailHtml,
} from './emailService.js';

/**
 * Send confirmation email when reservation is confirmed
 */
export async function sendConfirmationEmail(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      guest: true,
      tenant: { select: { name: true, address: true, settings: true } },
      tables: { include: { table: { select: { label: true } } } },
    },
  });

  if (!reservation || !reservation.guest.email) return;

  const settings = reservation.tenant.settings as Record<string, unknown>;
  if (settings?.notificationsEnabled === false) return;

  const html = confirmationEmailHtml({
    guestName: reservation.guest.name,
    date: reservation.date.toISOString().split('T')[0],
    time: reservation.time,
    partySize: reservation.partySize,
    tenantName: reservation.tenant.name,
    tenantAddress: reservation.tenant.address,
    tables: reservation.tables.map(t => t.table.label).join(', '),
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

/**
 * Send cancellation email
 */
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

/**
 * Send reminder emails for tomorrow's reservations
 * Called by cron job daily
 */
export async function sendReminderEmails() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const reservations = await prisma.reservation.findMany({
    where: {
      date: new Date(tomorrowStr),
      status: { in: ['CONFIRMED', 'PENDING'] },
      reminderSentAt: null,
    },
    include: {
      guest: true,
      tenant: { select: { name: true, address: true, settings: true } },
    },
  });

  let sent = 0;

  for (const res of reservations) {
    if (!res.guest.email) continue;

    const settings = res.tenant.settings as Record<string, unknown>;
    if (settings?.notificationsEnabled === false) continue;

    const html = reminderEmailHtml({
      guestName: res.guest.name,
      date: res.date.toISOString().split('T')[0],
      time: res.time,
      partySize: res.partySize,
      tenantName: res.tenant.name,
      tenantAddress: res.tenant.address,
    });

    const success = await sendEmail({
      to: res.guest.email,
      subject: `Opomnik: Jutri ob ${res.time} - ${res.tenant.name}`,
      html,
      tenantId: res.tenantId,
      reservationId: res.id,
      type: 'reminder',
    });

    if (success) {
      await prisma.reservation.update({
        where: { id: res.id },
        data: { reminderSentAt: new Date() },
      });
      sent++;
    }
  }

  if (sent > 0) {
    console.log(`[Reminders] Sent ${sent} reminder emails for ${tomorrowStr}`);
  }

  return sent;
}
