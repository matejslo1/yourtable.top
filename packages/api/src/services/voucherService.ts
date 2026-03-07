import { prisma } from '../utils/prisma.js';
import { createAuditLog } from '../utils/audit.js';
import { AppError, NotFoundError } from '../utils/errors.js';
import { sendEmail } from './emailService.js';

// ============================================
// CODE GENERATION
// ============================================

function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segment = (len: number) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `YT-${segment(4)}-${segment(4)}`;
}

async function uniqueCode(tenantId: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateVoucherCode();
    const exists = await prisma.voucher.findUnique({ where: { tenantId_code: { tenantId, code } } });
    if (!exists) return code;
  }
  throw new AppError('Failed to generate unique voucher code', 500);
}

// ============================================
// CREATE VOUCHER
// ============================================

interface CreateVoucherParams {
  tenantId: string;
  userId: string;
  name?: string;
  value: number;
  validDays?: number;
  validUntil?: Date;
  deliveryMethod?: string;
  dedication?: string;
  recipientName?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  buyerName: string;
  buyerEmail: string;
}

export async function createVoucher(params: CreateVoucherParams) {
  const {
    tenantId, userId, value, validDays = 365,
    deliveryMethod = 'email', dedication, 
    recipientName, recipientEmail, recipientPhone,
    buyerName, buyerEmail,
  } = params;

  if (value <= 0) throw new AppError('Vrednost mora biti pozitivna', 400);

  const code = await uniqueCode(tenantId);
  const now = new Date();
  const validUntil = params.validUntil || new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000);
  const name = params.name || `Darilni bon ${value} EUR`;

  const voucher = await prisma.voucher.create({
    data: {
      tenantId,
      code,
      name,
      type: 'digital',
      status: 'active',
      initialValue: value,
      remainingValue: value,
      deliveryMethod: deliveryMethod as any,
      dedication,
      recipientName,
      recipientEmail,
      recipientPhone,
      buyerName,
      buyerEmail,
      validFrom: now,
      validUntil,
    },
  });

  // Log purchase transaction
  await prisma.voucherTransaction.create({
    data: {
      voucherId: voucher.id,
      amount: value,
      type: 'purchase',
      performedBy: userId,
      notes: `Ustvaril ${buyerName}`,
    },
  });

  await createAuditLog({
    tenantId, userId,
    action: 'create',
    entityType: 'voucher',
    entityId: voucher.id,
    changes: { code, value, validUntil },
  });

  // Send voucher email to recipient
  if (recipientEmail) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    sendVoucherEmail({
      recipientEmail,
      recipientName: recipientName || 'Spoštovani',
      buyerName,
      code,
      value,
      dedication,
      validUntil,
      tenantName: tenant?.name || '',
    }).catch(err => console.error('[Voucher] Email failed:', err));
  }

  return voucher;
}

// ============================================
// VALIDATE VOUCHER
// ============================================

export async function validateVoucher(tenantId: string, code: string) {
  const voucher = await prisma.voucher.findUnique({
    where: { tenantId_code: { tenantId, code } },
    include: { transactions: { orderBy: { createdAt: 'desc' } } },
  });

  if (!voucher) throw new NotFoundError('Voucher', code);

  const now = new Date();
  const issues: string[] = [];

  if (voucher.status === 'cancelled') issues.push('Bon je preklican');
  if (voucher.status === 'used') issues.push('Bon je že v celoti porabljen');
  if (voucher.status === 'expired' || voucher.validUntil < now) issues.push('Bon je potekel');
  if (Number(voucher.remainingValue) <= 0) issues.push('Na bonu ni več sredstev');

  return {
    valid: issues.length === 0,
    voucher: {
      id: voucher.id,
      code: voucher.code,
      name: voucher.name,
      status: voucher.status,
      initialValue: Number(voucher.initialValue),
      remainingValue: Number(voucher.remainingValue),
      validUntil: voucher.validUntil,
      recipientName: voucher.recipientName,
      buyerName: voucher.buyerName,
    },
    issues,
  };
}

// ============================================
// REDEEM VOUCHER
// ============================================

interface RedeemVoucherParams {
  tenantId: string;
  userId: string;
  code: string;
  amount: number;
  notes?: string;
}

export async function redeemVoucher(params: RedeemVoucherParams) {
  const { tenantId, userId, code, amount, notes } = params;

  const validation = await validateVoucher(tenantId, code);
  if (!validation.valid) {
    throw new AppError(`Bon ni veljaven: ${validation.issues.join(', ')}`, 400);
  }

  const voucher = await prisma.voucher.findUnique({
    where: { tenantId_code: { tenantId, code } },
  });

  if (!voucher) throw new NotFoundError('Voucher', code);

  const remaining = Number(voucher.remainingValue);
  const redeemAmount = Math.min(amount, remaining);

  if (redeemAmount <= 0) throw new AppError('Na bonu ni več sredstev', 400);

  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.voucherTransaction.create({
      data: {
        voucherId: voucher.id,
        amount: redeemAmount,
        type: 'redemption',
        performedBy: userId,
        notes: notes || null,
      },
    });

    const newRemaining = Math.max(0, remaining - redeemAmount);
    const isFullyUsed = newRemaining <= 0;

    await tx.voucher.update({
      where: { id: voucher.id },
      data: {
        remainingValue: newRemaining,
        status: isFullyUsed ? 'used' : 'active',
      },
    });

    return { transaction, redeemAmount, newRemaining, isFullyUsed };
  });

  await createAuditLog({
    tenantId, userId,
    action: 'redeem',
    entityType: 'voucher',
    entityId: voucher.id,
    changes: { code, amount: redeemAmount, remaining: result.newRemaining },
  });

  return {
    transactionId: result.transaction.id,
    redeemedAmount: result.redeemAmount,
    remainingValue: result.newRemaining,
    fullyRedeemed: result.isFullyUsed,
  };
}

// ============================================
// LIST / GET VOUCHERS
// ============================================

export async function listVouchers(tenantId: string, filters: {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const { status, search, page = 1, pageSize = 20 } = filters;

  const where: any = { tenantId };
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { buyerName: { contains: search, mode: 'insensitive' } },
      { recipientName: { contains: search, mode: 'insensitive' } },
      { recipientEmail: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [vouchers, total] = await Promise.all([
    prisma.voucher.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: { select: { transactions: true } },
      },
    }),
    prisma.voucher.count({ where }),
  ]);

  return { vouchers, total, page, pageSize };
}

export async function getVoucher(tenantId: string, voucherId: string) {
  const voucher = await prisma.voucher.findFirst({
    where: { id: voucherId, tenantId },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!voucher) throw new NotFoundError('Voucher', voucherId);
  return voucher;
}

// ============================================
// CANCEL VOUCHER
// ============================================

export async function cancelVoucher(tenantId: string, userId: string, voucherId: string) {
  const voucher = await prisma.voucher.findFirst({
    where: { id: voucherId, tenantId },
  });

  if (!voucher) throw new NotFoundError('Voucher', voucherId);
  if (voucher.status === 'cancelled') throw new AppError('Bon je že preklican', 400);

  await prisma.voucher.update({
    where: { id: voucherId },
    data: { status: 'cancelled' },
  });

  await createAuditLog({
    tenantId, userId,
    action: 'cancel',
    entityType: 'voucher',
    entityId: voucherId,
    changes: { previousStatus: voucher.status },
  });

  return { success: true };
}

// ============================================
// STATS
// ============================================

export async function getVoucherStats(tenantId: string) {
  const [total, active, used, expired, cancelled, totalValue, redeemedValue] = await Promise.all([
    prisma.voucher.count({ where: { tenantId } }),
    prisma.voucher.count({ where: { tenantId, status: 'active' } }),
    prisma.voucher.count({ where: { tenantId, status: 'used' } }),
    prisma.voucher.count({ where: { tenantId, status: 'expired' } }),
    prisma.voucher.count({ where: { tenantId, status: 'cancelled' } }),
    prisma.voucher.aggregate({ where: { tenantId }, _sum: { initialValue: true } }),
    prisma.voucherTransaction.aggregate({ where: { voucher: { tenantId }, type: 'redemption' }, _sum: { amount: true } }),
  ]);

  return {
    total, active, redeemed: used, expired, cancelled,
    totalIssuedValue: Number(totalValue._sum.initialValue || 0),
    totalRedeemedValue: Number(redeemedValue._sum.amount || 0),
  };
}

// ============================================
// EXPIRY CLEANUP
// ============================================

export async function expireVouchers() {
  const result = await prisma.voucher.updateMany({
    where: {
      status: 'active',
      validUntil: { lt: new Date() },
    },
    data: { status: 'expired' },
  });

  if (result.count > 0) {
    console.log(`[Voucher] Expired ${result.count} vouchers`);
  }

  return result.count;
}

// ============================================
// EMAIL TEMPLATE
// ============================================

async function sendVoucherEmail(data: {
  recipientEmail: string;
  recipientName: string;
  buyerName: string;
  code: string;
  value: number;
  dedication?: string;
  validUntil: Date;
  tenantName: string;
}) {
  const validDate = data.validUntil.toLocaleDateString('sl-SI', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="background:#111827;padding:24px 28px;">
        <h1 style="margin:0;color:#fff;font-size:20px;">🎁 Darilni bon</h1>
        <p style="margin:4px 0 0;color:#9ca3af;font-size:13px;">${data.tenantName}</p>
      </div>
      <div style="padding:28px;">
        <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">
          Spoštovani ${data.recipientName},
        </p>
        <p style="margin:0 0 24px;color:#374151;font-size:14px;">
          ${data.buyerName} vam je podaril darilni bon za restavracijo ${data.tenantName}!
        </p>
        ${data.dedication ? `
        <div style="background:#f9fafb;border-left:3px solid #22c55e;padding:12px 16px;margin-bottom:24px;border-radius:0 8px 8px 0;">
          <p style="margin:0;color:#374151;font-size:14px;font-style:italic;">"${data.dedication}"</p>
        </div>` : ''}
        <div style="background:#f0fdf4;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
          <p style="margin:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Vrednost bona</p>
          <p style="margin:0 0 16px;color:#111827;font-size:28px;font-weight:700;">${data.value} EUR</p>
          <div style="background:#fff;border-radius:8px;padding:12px;display:inline-block;">
            <p style="margin:0;font-family:monospace;font-size:20px;font-weight:700;color:#111827;letter-spacing:2px;">${data.code}</p>
          </div>
        </div>
        <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
          Bon velja do ${validDate}
        </p>
      </div>
      <div style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">Powered by YourTable</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  await sendEmail({
    to: data.recipientEmail,
    subject: `🎁 Darilni bon za ${data.tenantName} - ${data.value} EUR`,
    html,
  });
}
