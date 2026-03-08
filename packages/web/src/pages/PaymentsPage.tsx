import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';

interface Transaction {
  id: string;
  amount: number;
  type: string;
  createdAt: string;
  voucher?: { code: string; name: string; buyerName: string };
}

interface PaymentStats {
  totalIssuedValue: number;
  totalRedeemedValue: number;
  total: number;
  active: number;
  redeemed: number;
}

interface DepositPolicy {
  enabled: boolean;
  defaultType: 'fixed' | 'percent';
  defaultAmount: number;
  rules: Array<{
    label?: string;
    minPartySize?: number;
    servicePeriod?: string;
    daysOfWeek?: number[];
    amount?: number;
    type?: 'fixed' | 'percent';
  }>;
}

export function PaymentsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);

  const [policy, setPolicy] = useState<DepositPolicy>({ enabled: false, defaultType: 'fixed', defaultAmount: 0, rules: [] });
  const [savingPolicy, setSavingPolicy] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const policyRes = await apiFetch<{ data: DepositPolicy }>('/api/v1/payments/deposit-policy').catch(() => null);
        if (policyRes?.data) setPolicy(policyRes.data);

        const vStats = await apiFetch<{ data: PaymentStats }>('/api/v1/vouchers/stats').catch(() => ({ data: null as any }));
        if (vStats.data) setStats(vStats.data);

        const vRes = await apiFetch<{ data: any[] }>('/api/v1/vouchers?pageSize=50').catch(() => ({ data: [] }));
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
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const savePolicy = async () => {
    setSavingPolicy(true);
    try {
      await apiFetch('/api/v1/payments/deposit-policy', {
        method: 'PUT',
        body: JSON.stringify(policy),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPolicy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F8]">
      <div className="max-w-[1400px] mx-auto px-8 py-8">
        <div className="mb-8">
          <h1 className="font-display text-[22px] font-semibold text-[#1E293B] tracking-tight">Placila in transakcije</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">Pregled transakcij in nastavitev depozita</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-semibold text-[#1E293B]">Deposit policy</h3>
            <button
              className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-60"
              disabled={savingPolicy}
              onClick={savePolicy}
            >
              {savingPolicy ? 'Shranjujem...' : 'Shrani'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <label className="text-sm text-gray-600 flex items-center gap-2">
              <input
                type="checkbox"
                checked={policy.enabled}
                onChange={e => setPolicy(prev => ({ ...prev, enabled: e.target.checked }))}
              />
              Aktiviraj depozit
            </label>

            <select
              value={policy.defaultType}
              onChange={e => setPolicy(prev => ({ ...prev, defaultType: e.target.value as 'fixed' | 'percent' }))}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
            >
              <option value="fixed">Fixed amount</option>
              <option value="percent">Percent</option>
            </select>

            <input
              type="number"
              value={policy.defaultAmount}
              min={0}
              onChange={e => setPolicy(prev => ({ ...prev, defaultAmount: Number(e.target.value) || 0 }))}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
              placeholder="Default amount"
            />
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            <StatCard label="Izdani boni" value={`${stats.totalIssuedValue.toFixed(0)} EUR`} detail={`${stats.total} bonov`} accent="bg-blue-400" />
            <StatCard label="Unovceno" value={`${stats.totalRedeemedValue.toFixed(0)} EUR`} detail={`${stats.redeemed} porabljenih`} accent="bg-emerald-400" />
            <StatCard label="Aktivni boni" value={String(stats.active)} detail="trenutno aktivnih" accent="bg-amber-400" />
            <StatCard label="Odprto" value={`${(stats.totalIssuedValue - stats.totalRedeemedValue).toFixed(0)} EUR`} detail="neizkorisceno" accent="bg-gray-300" />
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
          <div className="px-6 py-4 border-b border-gray-50">
            <h3 className="text-[13px] font-semibold text-[#1E293B]">Transakcije</h3>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-50 rounded-lg animate-pulse" />)}</div>
          ) : transactions.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[13px] text-gray-400">Ni transakcij</p>
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
                    <td className="px-6 py-3 text-[12px] text-gray-400 tabular-nums">
                      {new Date(tx.createdAt).toLocaleString('sl-SI', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-3 text-[11px] text-gray-500">{tx.type}</td>
                    <td className="px-6 py-3 text-[12px] font-mono text-[#1E293B]">{tx.voucher?.code || '-'}</td>
                    <td className="px-6 py-3 text-[12px] text-gray-500">{tx.voucher?.buyerName || '-'}</td>
                    <td className="px-6 py-3 text-right text-[13px] font-semibold tabular-nums">
                      {tx.type === 'purchase' ? '+' : '-'}{Number(tx.amount).toFixed(2)} EUR
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