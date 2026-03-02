import { expireVouchers } from '../services/voucherService.js';

const EXPIRY_INTERVAL_MS = 6 * 60 * 60 * 1000;
let intervalId: NodeJS.Timeout | null = null;

export function startVoucherExpiryJob() {
  console.log('[Cron] Voucher expiry job started (every 6h)');
  runExpiry();
  intervalId = setInterval(runExpiry, EXPIRY_INTERVAL_MS);
}

export function stopVoucherExpiryJob() {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}

async function runExpiry() {
  try {
    const count = await expireVouchers();
    if (count > 0) console.log(`[Cron] Expired ${count} vouchers`);
  } catch (error) { console.error('[Cron] Voucher expiry failed:', error); }
}
