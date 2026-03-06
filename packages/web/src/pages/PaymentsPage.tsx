import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';

interface Transaction {
  id: string; amount: number; type: string; notes: string | null; createdAt: string;
  voucher?: { code: string; name: string; buyerName: string };
}

interface PaymentStats {
  totalIssuedValue: number; totalRedeemedValue: number; total: number; active: number; redeemed: number;
}

export function PaymentsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const vStats = await apiFetch<{ data: PaymentStats }>('/api/v1/vouchers/stats').catch(() => ({ data: null as any }));
        if (vStats.data) setStats(vStats.data);

        const vRes = await apiFetch<{ data: any[]; meta: any }>('/api/v1/vouchers?pageSize=50').catch(() => ({ data: [], meta: {} }));
        const allTx: Transaction[] = [];
        for (const v of (vRes.data || [])) {
          if (v._count?.transactions > 0) {
            try {
              const det = await apiFetch<{ data: any }>(`/api/v1/vouchers/${v.id}`);
              for (const tx of (det.data?.transactions || [])) {
                allTx.push({ ...tx, voucher: { code: v.code, name: v.name, buyerName: v.buyerName } });
              }
            } catch {}
          }
        }
        allTx.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTransactions(allTx);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-[#F4F6F8]">
      <div className="max-w-[1400px] mx-auto px-8 py-8">
        <div className="mb-8">
          <h1 className="font-display text-[22px] font-semibold text-[#1E293B] tracking-tight">Plačila & Transakcije</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">Pregled vseh finančnih transakcij</p>
        </div>

        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            <StatCard label="Izdani boni" value={`${stats.totalIssuedValue.toFixed(0)} €`} detail={`${stats.total} bonov`} accent="bg-blue-400" />
            <StatCard label="Unovčeno" value={`${stats.totalRedeemedValue.toFixed(0)} €`} detail={`${stats.redeemed} porabljenih`} accent="bg-emerald-400" />
            <StatCard label="Aktivni boni" value={String(stats.active)} detail="trenutno aktivnih" accent="bg-amber-400" />
            <StatCard label="Odprto" value={`${(stats.totalIssuedValue - stats.totalRedeemedValue).toFixed(0)} €`} detail="neizkoriščeno" accent="bg-gray-300" />
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
          <div className="px-6 py-4 border-b border-gray-50">
            <h3 className="text-[13px] font-semibold text-[#1E293B]">Transakcije</h3>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-50 rounded-lg animate-pulse" />)}</div>
          ) : transactions.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </div>
              <p className="text-[13px] text-gray-400">Ni transakcij</p>
              <p className="text-[11px] text-gray-300 mt-1">Transakcije se ustvarijo ob nakupu in unovčenju bonov</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="text-left px-6 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Datum</th>
                  <th className="text-left px-6 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Tip</th>
                  <th className="text-left px-6 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Bon</th>
                  <th className="text-left px-6 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Kupec</th>
                  <th className="text-right px-6 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Znesek</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.id} className="border-t border-gray-50 hover:bg-gray-50/40 transition-colors">
                    <td className="px-6 py-3">
                      <span className="text-[12px] text-gray-400 tabular-nums">
                        {new Date(tx.createdAt).toLocaleString('sl-SI', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                        tx.type === 'purchase' ? 'text-emerald-600 border-emerald-200' :
                        tx.type === 'redemption' ? 'text-blue-500 border-blue-200' :
                        'text-amber-500 border-amber-200'
                      }`}>{tx.type === 'purchase' ? 'Nakup' : tx.type === 'redemption' ? 'Unovčenje' : 'Vračilo'}</span>
                    </td>
                    <td className="px-6 py-3"><span className="text-[12px] font-mono text-[#1E293B] font-medium">{tx.voucher?.code || '—'}</span></td>
                    <td className="px-6 py-3"><span className="text-[12px] text-gray-500">{tx.voucher?.buyerName || '—'}</span></td>
                    <td className="px-6 py-3 text-right">
                      <span className={`text-[13px] font-semibold tabular-nums ${
                        tx.type === 'purchase' ? 'text-emerald-600' : 'text-red-500'
                      }`}>
                        {tx.type === 'purchase' ? '+' : '-'}{Number(tx.amount).toFixed(2)} €
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-3" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
      <div className={`w-1 self-stretch rounded-full ${accent}`} />
      <div>
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
        <p className="font-display text-[20px] font-semibold text-[#1E293B] leading-tight">{value}</p>
        <p className="text-[11px] text-gray-300 mt-1">{detail}</p>
      </div>
    </div>
  );
}
