import { prisma } from '../utils/prisma.js';

// Resend API client (lightweight, no SDK needed)
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@yourtable.top';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  tenantId?: string;
  reservationId?: string;
  type?: string;
  templateData?: unknown;
}

/**
 * Send email via Resend API
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log('[Email] RESEND_API_KEY not set, skipping email:', params.subject, '→', params.to);
    return false;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[Email] Resend error:', data);
      // Log notification as failed
      if (params.tenantId) {
        await logNotification(
          params.tenantId,
          params.reservationId,
          params.type || 'confirmation',
          params.to,
          'failed',
          params.templateData
        );
      }
      return false;
    }

    // Log successful notification
    if (params.tenantId) {
      await logNotification(
        params.tenantId,
        params.reservationId,
        params.type || 'confirmation',
        params.to,
        'sent',
        params.templateData
      );
    }

    console.log(`[Email] Sent "${params.subject}" to ${params.to}`);
    return true;
  } catch (error) {
    console.error('[Email] Send failed:', error);
    return false;
  }
}

async function logNotification(
  tenantId: string,
  reservationId: string | undefined,
  type: string,
  recipient: string,
  status: 'sent' | 'failed',
  templateData?: unknown
) {
  try {
    await prisma.notification.create({
      data: {
        tenantId,
        reservationId: reservationId || null,
        type: type as any,
        channel: 'email',
        recipient,
        status: status as any,
        sentAt: status === 'sent' ? new Date() : null,
        templateData: templateData as any,
      },
    });
  } catch (err) {
    console.error('[Email] Failed to log notification:', err);
  }
}

// ============================================
// EMAIL TEMPLATES
// ============================================

const DAYS_SL = ['nedelja', 'ponedeljek', 'torek', 'sreda', 'četrtek', 'petek', 'sobota'];
const MONTHS_SL = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december'];

function formatDateSl(dateStr: string): string {
  const d = new Date(dateStr);
  return `${DAYS_SL[d.getDay()]}, ${d.getDate()}. ${MONTHS_SL[d.getMonth()]} ${d.getFullYear()}`;
}

function baseTemplate(content: string, tenantName: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="background:#111827;padding:24px 28px;">
        <h1 style="margin:0;color:#fff;font-size:20px;">🍽️ ${tenantName}</h1>
      </div>
      <div style="padding:28px;">
        ${content}
      </div>
      <div style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">
          Powered by YourTable
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Confirmation email template
 */
export function confirmationEmailHtml(data: {
  guestName: string;
  date: string;
  time: string;
  partySize: number;
  tenantName: string;
  tenantAddress: string;
  tables?: string;
  cancelUrl?: string;
}): string {
  const content = `
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">Rezervacija potrjena!</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
      Spoštovani ${data.guestName}, vaša rezervacija je potrjena.
    </p>
    <div style="background:#f0fdf4;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;color:#6b7280;font-size:13px;width:100px;">📅 Datum</td>
          <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${formatDateSl(data.date)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;font-size:13px;">🕐 Čas</td>
          <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${data.time}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;font-size:13px;">👥 Gosti</td>
          <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${data.partySize} ${data.partySize === 1 ? 'oseba' : data.partySize <= 4 ? 'osebe' : 'oseb'}</td>
        </tr>
        ${data.tables ? `<tr>
          <td style="padding:8px 0;color:#6b7280;font-size:13px;">🪑 Miza</td>
          <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${data.tables}</td>
        </tr>` : ''}
      </table>
    </div>
    <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#6b7280;">📍 ${data.tenantAddress}</p>
    </div>
    <p style="margin:0;font-size:13px;color:#9ca3af;">
      Če želite spremeniti ali preklicati rezervacijo, nas kontaktirajte.
    </p>
    ${data.cancelUrl ? `
    <div style="margin-top:16px;text-align:center;">
      <a href="${data.cancelUrl}" style="display:inline-block;padding:10px 24px;background:#ef4444;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">
        Prekliči rezervacijo
      </a>
    </div>` : ''}
  `;
  return baseTemplate(content, data.tenantName);
}

/**
 * Cancellation email template
 */
export function cancellationEmailHtml(data: {
  guestName: string;
  date: string;
  time: string;
  tenantName: string;
  reason?: string;
}): string {
  const content = `
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">Rezervacija preklicana</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
      Spoštovani ${data.guestName}, vaša rezervacija je bila preklicana.
    </p>
    <div style="background:#fef2f2;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 4px;color:#111827;font-size:14px;font-weight:600;">
        ${formatDateSl(data.date)} ob ${data.time}
      </p>
      ${data.reason ? `<p style="margin:8px 0 0;color:#6b7280;font-size:13px;">Razlog: ${data.reason}</p>` : ''}
    </div>
    <p style="margin:0;font-size:13px;color:#9ca3af;">
      Za novo rezervacijo obiščite našo spletno stran.
    </p>
  `;
  return baseTemplate(content, data.tenantName);
}

/**
 * Reminder email template (sent 24h before)
 */
export function reminderEmailHtml(data: {
  guestName: string;
  date: string;
  time: string;
  partySize: number;
  tenantName: string;
  tenantAddress: string;
  windowLabel?: string;
}): string {
  const content = `
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">Opomnik za rezervacijo</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
      Spo�tovani ${data.guestName}, opominjamo vas na rezervacijo${data.windowLabel ? ` (${data.windowLabel})` : ''}.
    </p>
    <div style="background:#eff6ff;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;color:#6b7280;font-size:13px;width:100px;">Datum</td>
          <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">${formatDateSl(data.date)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#6b7280;font-size:13px;">�as</td>
          <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">${data.time}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#6b7280;font-size:13px;">Gosti</td>
          <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">${data.partySize}</td>
        </tr>
      </table>
    </div>
    <div style="background:#f9fafb;border-radius:8px;padding:16px;">
      <p style="margin:0;font-size:13px;color:#6b7280;">${data.tenantAddress}</p>
    </div>
  `;
  return baseTemplate(content, data.tenantName);
}

export function waitlistOfferEmailHtml(data: {
  guestName: string;
  date: string;
  time: string;
  partySize: number;
  tenantName: string;
}): string {
  const content = `
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">Prosta miza je na voljo</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
      Pozdravljeni ${data.guestName}, za va� termin se je sprostila miza.
    </p>
    <div style="background:#fffbeb;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0;color:#111827;font-size:14px;font-weight:600;">
        ${formatDateSl(data.date)} ob ${data.time} � ${data.partySize} gostov
      </p>
      <p style="margin:8px 0 0;color:#92400e;font-size:13px;">
        Prosimo, potrdite v najkraj�em �asu, sicer ponudba pote�e.
      </p>
    </div>
  `;
  return baseTemplate(content, data.tenantName);
}

export function reviewRequestEmailHtml(data: {
  guestName: string;
  tenantName: string;
  reviewUrl?: string;
}): string {
  const content = `
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">Hvala za obisk</h2>
    <p style="margin:0 0 18px;color:#6b7280;font-size:14px;">
      Pozdravljeni ${data.guestName}, veseli bomo va�e kratke ocene obiska.
    </p>
    ${data.reviewUrl ? `
      <div style="text-align:center;margin:10px 0 20px;">
        <a href="${data.reviewUrl}" style="display:inline-block;padding:10px 24px;background:#111827;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">
          Oddaj oceno
        </a>
      </div>
    ` : ''}
    <p style="margin:0;color:#9ca3af;font-size:13px;">
      Hvala, ker nam pomagate izbolj�ati izku�njo.
    </p>
  `;
  return baseTemplate(content, data.tenantName);
}
