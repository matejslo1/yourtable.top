import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';

interface Stats {
  today: { reservations: number; guests: number };
  last7Days: number;
  last30Days: number;
  noShowsLast30Days: number;
  cancelledLast30Days: number;
  noShowRate: number;
  cancellationRate: number;
}

export function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: Stats }>('/api/v1/reservations/stats')
      .then(res => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toLocaleDateString('sl-SI', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-gray-900">Nadzorna plošča</h1>
        <p className="text-sm text-gray-500 mt-1 capitalize">{today}</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : stats && (
        <>
          {/* Today's stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Danes rezervacij" value={stats.today.reservations} icon="📋" color="brand" />
            <StatCard label="Danes gostov" value={stats.today.guests} icon="👥" color="blue" />
            <StatCard label="Zadnjih 7 dni" value={stats.last7Days} icon="📈" color="purple" />
            <StatCard label="Zadnjih 30 dni" value={stats.last30Days} icon="📊" color="gray" />
          </div>

          {/* Rates */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="No-show stopnja" value={`${stats.noShowRate}%`} icon="🚫" color="red" subtitle={`${stats.noShowsLast30Days} no-showov`} />
            <StatCard label="Preklic stopnja" value={`${stats.cancellationRate}%`} icon="❌" color="amber" subtitle={`${stats.cancelledLast30Days} preklicanih`} />
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color, subtitle }: {
  label: string;
  value: number | string;
  icon: string;
  color: string;
  subtitle?: string;
}) {
  const colors: Record<string, string> = {
    brand: 'bg-green-50 border-green-200',
    blue: 'bg-blue-50 border-blue-200',
    purple: 'bg-purple-50 border-purple-200',
    gray: 'bg-gray-50 border-gray-200',
    red: 'bg-red-50 border-red-200',
    amber: 'bg-amber-50 border-amber-200',
  };

  return (
    <div className={`rounded-xl border p-5 ${colors[color] || colors.gray}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="font-display text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}
