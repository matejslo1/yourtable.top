import { useEffect, useMemo, useState } from 'react';
import { apiFetch, useAuthStore } from '@/lib/auth';

interface OverviewResponse {
  data: {
    totals: {
      reservations: number;
      confirmed: number;
      guests: number;
      noShow: number;
      cancelled: number;
      noShowRate: number;
      cancellationRate: number;
      revenuePerSeatProxy: number;
    };
    bySource: Record<string, number>;
    byDay: Record<string, { reservations: number; guests: number; noShows: number; cancelled: number }>;
    tableEfficiency: Record<string, { label: string; seatsServed: number; turns: number }>;
  };
}

export function ReportsPage() {
  const { accessToken } = useAuthStore();
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewResponse['data'] | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiFetch<OverviewResponse>(`/api/v1/analytics/overview?days=${days}`);
        setOverview(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [days]);

  const topTables = useMemo(() => {
    const entries = Object.values(overview?.tableEfficiency || {});
    return entries.sort((a, b) => b.turns - a.turns).slice(0, 6);
  }, [overview]);

  const dailyRows = useMemo(() => {
    const map = overview?.byDay || {};
    return Object.entries(map)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 10);
  }, [overview]);

  const downloadCsv = () => {
    const base = import.meta.env.VITE_API_URL || '';
    const url = `${base}/api/v1/analytics/export.csv?days=${days}`;
    fetch(url, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    })
      .then(async r => {
        const blob = await r.blob();
        const href = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = href;
        a.download = `analytics-${days}d.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
      })
      .catch(console.error);
  };

  return (
    <div className="min-h-screen bg-[#F4F6F8]">
      <div className="max-w-[1400px] mx-auto px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-[22px] font-semibold text-[#1E293B] tracking-tight">Porocila</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">Analitika rezervacij in izvoz</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
            >
              <option value={7}>7 dni</option>
              <option value={30}>30 dni</option>
              <option value={90}>90 dni</option>
            </select>
            <button
              onClick={downloadCsv}
              className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium"
            >
              Izvoz CSV
            </button>
          </div>
        </div>

        {loading || !overview ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-xl bg-white border border-gray-100 animate-pulse" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Stat title="Rezervacije" value={String(overview.totals.reservations)} />
              <Stat title="Gosti" value={String(overview.totals.guests)} />
              <Stat title="No-show" value={`${(overview.totals.noShowRate * 100).toFixed(1)}%`} />
              <Stat title="Cancellation" value={`${(overview.totals.cancellationRate * 100).toFixed(1)}%`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Booking source</h3>
                <div className="space-y-2">
                  {Object.entries(overview.bySource).map(([source, count]) => (
                    <div key={source} className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{source}</span>
                      <span className="font-medium text-gray-800">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Ucinkovitost miz</h3>
                <div className="space-y-2">
                  {topTables.map((table, idx) => (
                    <div key={`${table.label}-${idx}`} className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{table.label}</span>
                      <span className="font-medium text-gray-800">{table.turns} turns</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4 mt-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Po dnevih</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400">
                    <th className="py-2">Datum</th>
                    <th className="py-2">Rezervacije</th>
                    <th className="py-2">Gosti</th>
                    <th className="py-2">No-show</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyRows.map(([date, row]) => (
                    <tr key={date} className="border-t border-gray-100 text-gray-600">
                      <td className="py-2">{date}</td>
                      <td className="py-2">{row.reservations}</td>
                      <td className="py-2">{row.guests}</td>
                      <td className="py-2">{row.noShows}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-semibold text-[#1E293B] mt-1">{value}</p>
    </div>
  );
}
