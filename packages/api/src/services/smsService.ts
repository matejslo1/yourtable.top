import { prisma } from '../utils/prisma.js';

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER; // e.g. +38640123456
const TWILIO_API = 'https://api.twilio.com/2010-04-01';

interface SendSmsParams {
  to: string;
  body: string;
  tenantId?: string;
  reservationId?: string;
  type?: string;
}

/**
 * Send SMS via Twilio API (REST, no SDK)
 */
export async function sendSms(params: SendSmsParams): Promise<boolean> {
  if (!TWILIO_SID || !TWILIO_AUTH || !TWILIO_FROM) {
    console.log('[SMS] Twilio not configured, skipping:', params.body.slice(0, 60), '→', params.to);
    return false;
  }

  // Normalize phone number
  const to = normalizePhone(params.to);
  if (!to) {
    console.error('[SMS] Invalid phone number:', params.to);
    return false;
  }

  try {
    const res = await fetch(`${TWILIO_API}/Accounts/${TWILIO_SID}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to,
        From: TWILIO_FROM,
        Body: params.body,
      }).toString(),
    });

    const data: any = await res.json();

    if (!res.ok) {
      console.error('[SMS] Twilio error:', data);
      if (params.tenantId && params.reservationId) {
        await logNotification(params.tenantId, params.reservationId, params.type || 'confirmation', params.to, 'failed');
      }
      return false;
    }

    console.log(`[SMS] Sent to ${to}: "${params.body.slice(0, 60)}..." SID: ${data.sid}`);
    if (params.tenantId && params.reservationId) {
      await logNotification(params.tenantId, params.reservationId, params.type || 'confirmation', params.to, 'sent');
    }
    return true;
  } catch (error) {
    console.error('[SMS] Send failed:', error);
    return false;
  }
}

/**
 * Normalize phone number to E.164 format
 * Handles Slovenian (+386) numbers
 */
function normalizePhone(phone: string): string | null {
  // Strip all non-digit except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // Already E.164
  if (cleaned.startsWith('+') && cleaned.length >= 10) return cleaned;

  // Slovenian mobile: 0X... → +386X...
  if (cleaned.startsWith('0') && cleaned.length >= 9) {
    cleaned = '+386' + cleaned.slice(1);
    return cleaned;
  }

  // Just digits, assume Slovenian
  if (/^\d{8,9}$/.test(cleaned)) {
    return '+386' + cleaned;
  }

  return null;
}

async function logNotification(
  tenantId: string,
  reservationId: string,
  type: string,
  recipient: string,
  status: 'sent' | 'failed'
) {
  try {
    await prisma.notification.create({
      data: {
        tenantId,
        reservationId,
        type: type as any,
        channel: 'sms',
        recipient,
        status: status as any,
        sentAt: status === 'sent' ? new Date() : null,
      },
    });
  } catch (err) {
    console.error('[SMS] Failed to log notification:', err);
  }
}

// ─── SMS Templates (Slovenian) ───────────────────────────────────────────────

const DAYS_SL = ['ned', 'pon', 'tor', 'sre', 'čet', 'pet', 'sob'];

function shortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${DAYS_SL[d.getDay()]}, ${d.getDate()}.${d.getMonth() + 1}.`;
}

export function confirmationSmsBody(data: {
  guestName: string;
  date: string;
  time: string;
  partySize: number;
  tenantName: string;
}): string {
  return `${data.tenantName}: Potrjena rez. ${shortDate(data.date)} ob ${data.time}, ${data.partySize} os. Dobrodošli! Za preklic kliči restavracijo.`;
}

export function reminderSmsBody(data: {
  date: string;
  time: string;
  partySize: number;
  tenantName: string;
}): string {
  return `Opomnik: Jutri ob ${data.time} imate rez. v ${data.tenantName} (${data.partySize} os.). Veselimo se vašega obiska!`;
}

export function cancellationSmsBody(data: {
  date: string;
  time: string;
  tenantName: string;
}): string {
  return `${data.tenantName}: Vaša rez. ${shortDate(data.date)} ob ${data.time} je bila preklicana. Za novo rez. obiščite našo spletno stran.`;
}

export function waitlistOfferSmsBody(data: {
  date: string;
  time: string;
  tenantName: string;
}): string {
  return `${data.tenantName}: Sproščena miza ${shortDate(data.date)} ob ${data.time}! Potrdite v 15 min ali mesto odstopite. Odgovorite DA za potrditev.`;
}

/**
 * Send confirmation SMS when reservation is confirmed
 */
export async function sendConfirmationSms(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      guest: true,
      tenant: { select: { name: true, settings: true } },
    },
  });

  if (!reservation?.guest.phone) return;

  const settings = reservation.tenant.settings as Record<string, unknown>;
  if (settings?.notificationsEnabled === false) return;

  const body = confirmationSmsBody({
    guestName: reservation.guest.name,
    date: reservation.date.toISOString().split('T')[0],
    time: reservation.time,
    partySize: reservation.partySize,
    tenantName: reservation.tenant.name,
  });

  await sendSms({
    to: reservation.guest.phone,
    body,
    tenantId: reservation.tenantId,
    reservationId: reservation.id,
    type: 'confirmation',
  });
}

/**
 * Send reminder SMS (called by reminder job)
 */
export async function sendReminderSms(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      guest: true,
      tenant: { select: { name: true, settings: true } },
    },
  });

  if (!reservation?.guest.phone) return false;

  const settings = reservation.tenant.settings as Record<string, unknown>;
  if (settings?.notificationsEnabled === false) return false;

  const body = reminderSmsBody({
    date: reservation.date.toISOString().split('T')[0],
    time: reservation.time,
    partySize: reservation.partySize,
    tenantName: reservation.tenant.name,
  });

  return sendSms({
    to: reservation.guest.phone,
    body,
    tenantId: reservation.tenantId,
    reservationId: reservation.id,
    type: 'reminder',
  });
}
