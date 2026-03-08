import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '@/lib/auth';

// ============================================
// TYPES
// ============================================

interface Stats {
  today: { reservations: number; guests: number };
  last7Days: number;
  last30Days: number;
  noShowsLast30Days: number;
  cancelledLast30Days: number;
  noShowRate: number;
  cancellationRate: number;
}

interface TimelineSlot {
  time: string;
  reservations: Array<{
    id: string;
    time: string;
    partySize: number;
    status: string;
    source: string;
    guest: { name: string };
    tables: Array<{ table: { label: string } }>;
  }>;
}

interface ShiftSummary {
  summary: string;
  recommendations: string[];
}

// ============================================
// DASHBOARD PAGE
// ============================================

export function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [timeline, setTimeline] = useState<TimelineSlot[]>([]);
  const [shiftSummary, setShiftSummary] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      apiFetch<{ data: Stats }>('/api/v1/reservations/stats'),
      apiFetch<{ data: { slots: TimelineSlot[]; stats: any } }>(`/api/v1/reservations/timeline?date=${today}`),
      apiFetch<{ data: ShiftSummary }>(`/api/v1/ai/shift-summary?date=${today}`).catch(() => ({ data: null as any })),
    ])
      .then(([sRes, tRes, aiRes]) => {
        setStats(sRes.data);
        setTimeline(tRes.data.slots || []);
        if (aiRes?.data) setShiftSummary(aiRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const todayStr = new Date().toLocaleDateString('sl-SI', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  // Flatten timeline for recent reservations
  const allReservations = timeline.flatMap(s => s.reservations).slice(0, 8);

  // Simulated occupancy (based on today's data - in production you'd calculate from table count)
  const occupancy = stats ? Math.min(Math.round((stats.today.reservations / Math.max(stats.today.reservations + 4, 10)) * 100), 100) : 0;

  // Yesterday comparison (simulated from 7-day average)
  const avgDaily7 = stats ? Math.round(stats.last7Days / 7) : 0;
  const resTrend = stats && avgDaily7 > 0 ? Math.round(((stats.today.reservations - avgDaily7) / avgDaily7) * 100) : 0;
  const guestTrend = stats && avgDaily7 > 0 ? Math.round(((stats.today.guests - avgDaily7 * 2.5) / (avgDaily7 * 2.5)) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#F4F6F8]">
      <div className="max-w-[1400px] mx-auto px-8 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-[22px] font-semibold text-[#1E293B] tracking-tight">Nadzorna plošča</h1>
          <p className="text-[13px] text-gray-400 mt-0.5 capitalize">{todayStr}</p>
        </div>

        {loading ? <LoadingSkeleton /> : stats && (
          <>
            {/* ═══════════════════════════════════════ */}
            {/* PRIMARY KPI — 4 cards */}
            {/* ═══════════════════════════════════════ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
              <PrimaryKPI
                icon={<IcCalendar />}
                value={stats.today.reservations}
                label="Rezervacije danes"
                trend={resTrend}
                trendLabel="vs. 7-dnevno povprečje"
              />
              <PrimaryKPI
                icon={<IcUsers />}
                value={stats.today.guests}
                label="Gostje danes"
                trend={guestTrend}
                trendLabel="vs. 7-dnevno povprečje"
              />
              <PrimaryKPI
                icon={<IcGrid />}
                value={`${occupancy}%`}
                label="Zasedenost"
                trend={null}
                trendLabel="danes"
                gauge={occupancy}
              />
              <PrimaryKPI
                icon={<IcTrend />}
                value={stats.last7Days}
                label="Zadnjih 7 dni"
                trend={null}
                trendLabel={`${stats.last30Days} zadnjih 30 dni`}
              />
            </div>

            {/* ═══════════════════════════════════════ */}
            {/* SECONDARY KPI — 4 smaller cards */}
            {/* ═══════════════════════════════════════ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              <SecondaryKPI
                label="No-show stopnja"
                value={`${(stats.noShowRate * 100).toFixed(1)}%`}
                detail={`${stats.noShowsLast30Days} v zadnjih 30 dneh`}
                accent={stats.noShowRate > 0.1 ? 'red' : stats.noShowRate > 0.05 ? 'amber' : 'blue'}
              />
              <SecondaryKPI
                label="Preklic stopnja"
                value={`${(stats.cancellationRate * 100).toFixed(1)}%`}
                detail={`${stats.cancelledLast30Days} v zadnjih 30 dneh`}
                accent={stats.cancellationRate > 0.15 ? 'red' : stats.cancellationRate > 0.08 ? 'amber' : 'blue'}
              />
              <SecondaryKPI
                label="Zadnjih 7 dni"
                value={String(stats.last7Days)}
                detail="potrjenih rezervacij"
                accent="blue"
              />
              <SecondaryKPI
                label="Zadnjih 30 dni"
                value={String(stats.last30Days)}
                detail="skupno rezervacij"
                accent="blue"
              />
            </div>

            {/* ═══════════════════════════════════════ */}
            {/* BOTTOM SECTION — Chart + Recent */}
            {/* ═══════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

              {/* Occupancy visual */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
                <h3 className="text-[13px] font-semibold text-[#1E293B] mb-5">Pregled dneva</h3>

                {/* Mini stat grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <MiniStat label="Aktivne" value={allReservations.filter(r => ['CONFIRMED', 'SEATED'].includes(r.status)).length} color="emerald" />
                  <MiniStat label="Na čakanju" value={allReservations.filter(r => r.status === 'PENDING').length} color="amber" />
                  <MiniStat label="Zaključene" value={allReservations.filter(r => r.status === 'COMPLETED').length} color="blue" />
                  <MiniStat label="No-show" value={allReservations.filter(r => r.status === 'NO_SHOW').length} color="red" />
                </div>

                {/* Occupancy bar */}
                <div className="mb-2">
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Zasedenost</span>
                    <span className="text-[13px] font-semibold text-[#1E293B]">{occupancy}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        occupancy > 85 ? 'bg-red-400' : occupancy > 60 ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${occupancy}%` }}
                    />
                  </div>
                </div>

                {/* Source breakdown */}
                <div className="mt-5 pt-4 border-t border-gray-50">
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3">Viri</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Online', count: allReservations.filter(r => r.source === 'online').length, color: 'bg-blue-400' },
                      { label: 'Telefon', count: allReservations.filter(r => r.source === 'phone').length, color: 'bg-emerald-400' },
                      { label: 'Walk-in', count: allReservations.filter(r => r.source === 'walk_in').length, color: 'bg-amber-400' },
                      { label: 'Ročno', count: allReservations.filter(r => r.source === 'manual').length, color: 'bg-gray-400' },
                    ].filter(s => s.count > 0).map(s => (
                      <div key={s.label} className="flex items-center gap-2.5">
                        <div className={`w-2 h-2 rounded-full ${s.color}`} />
                        <span className="text-[12px] text-gray-500 flex-1">{s.label}</span>
                        <span className="text-[12px] font-medium text-[#1E293B]">{s.count}</span>
                      </div>
                    ))}
                    {allReservations.length === 0 && (
                      <p className="text-[12px] text-gray-300">Ni rezervacij za danes</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Recent reservations */}
              <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 p-6" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-[13px] font-semibold text-[#1E293B]">Današnje rezervacije</h3>
                  <button
                    onClick={() => navigate('/reservations')}
                    className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                  >
                    Vse rezervacije →
                  </button>
                </div>

                {allReservations.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                      <IcCalendar />
                    </div>
                    <p className="text-[13px] text-gray-400">Danes ni rezervacij</p>
                    <button
                      onClick={() => navigate('/reservations')}
                      className="mt-3 text-[12px] font-medium text-emerald-600 hover:text-emerald-700"
                    >
                      + Nova rezervacija
                    </button>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {/* Table header */}
                    <div className="grid grid-cols-12 gap-3 px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      <div className="col-span-1">Čas</div>
                      <div className="col-span-3">Gost</div>
                      <div className="col-span-2">Miza</div>
                      <div className="col-span-2 text-center">Osebe</div>
                      <div className="col-span-2">Vir</div>
                      <div className="col-span-2 text-right">Status</div>
                    </div>

                    {allReservations.map(r => (
                      <div
                        key={r.id}
                        onClick={() => navigate('/reservations')}
                        className="grid grid-cols-12 gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50/60 cursor-pointer transition-colors items-center"
                      >
                        <div className="col-span-1">
                          <span className="text-[13px] font-medium text-[#1E293B] tabular-nums">{r.time}</span>
                        </div>
                        <div className="col-span-3">
                          <span className="text-[13px] text-[#1E293B] font-medium truncate block">{r.guest?.name || '—'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[12px] text-gray-400">
                            {r.tables?.map(t => t.table?.label).join(', ') || '—'}
                          </span>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="text-[12px] text-gray-500">{r.partySize}</span>
                        </div>
                        <div className="col-span-2">
                          <SourceLabel source={r.source} />
                        </div>
                        <div className="col-span-2 text-right">
                          <StatusBadge status={r.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {shiftSummary && (
              <div className="mt-5 bg-white rounded-2xl border border-gray-100 p-6" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
                <h3 className="text-[13px] font-semibold text-[#1E293B] mb-2">AI Shift Summary</h3>
                <p className="text-[12px] text-gray-600 mb-3">{shiftSummary.summary}</p>
                <ul className="space-y-1">
                  {shiftSummary.recommendations.slice(0, 3).map((item, idx) => (
                    <li key={idx} className="text-[12px] text-gray-500">{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================
// PRIMARY KPI CARD
// ============================================

function PrimaryKPI({ icon, value, label, trend, trendLabel, gauge }: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  trend: number | null;
  trendLabel: string;
  gauge?: number;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col justify-between min-h-[160px]" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
      {/* Icon */}
      <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 mb-4">
        {icon}
      </div>

      {/* Value */}
      <div>
        <p className="font-display text-[32px] font-semibold text-[#1E293B] leading-none tracking-tight">{value}</p>
        <p className="text-[12px] text-gray-400 mt-1.5">{label}</p>
      </div>

      {/* Trend or gauge */}
      <div className="mt-3 pt-3 border-t border-gray-50">
        {gauge !== undefined ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${gauge > 85 ? 'bg-red-400' : gauge > 60 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                style={{ width: `${gauge}%` }}
              />
            </div>
            <span className="text-[11px] text-gray-400">{trendLabel}</span>
          </div>
        ) : trend !== null ? (
          <div className="flex items-center gap-1.5">
            {trend > 0 ? (
              <span className="text-[11px] font-medium text-emerald-500 flex items-center gap-0.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 15l-6-6-6 6"/></svg>
                {trend}%
              </span>
            ) : trend < 0 ? (
              <span className="text-[11px] font-medium text-red-400 flex items-center gap-0.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>
                {Math.abs(trend)}%
              </span>
            ) : (
              <span className="text-[11px] text-gray-300">—</span>
            )}
            <span className="text-[10px] text-gray-300">{trendLabel}</span>
          </div>
        ) : (
          <span className="text-[11px] text-gray-300">{trendLabel}</span>
        )}
      </div>
    </div>
  );
}

// ============================================
// SECONDARY KPI CARD
// ============================================

function SecondaryKPI({ label, value, detail, accent }: {
  label: string;
  value: string;
  detail: string;
  accent: 'red' | 'amber' | 'blue';
}) {
  const accentColors = {
    red: 'bg-red-400',
    amber: 'bg-amber-400',
    blue: 'bg-blue-400',
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-3" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
      <div className={`w-1 self-stretch rounded-full ${accentColors[accent]}`} />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
        <p className="font-display text-[20px] font-semibold text-[#1E293B] leading-tight">{value}</p>
        <p className="text-[11px] text-gray-300 mt-1">{detail}</p>
      </div>
    </div>
  );
}

// ============================================
// MINI STAT
// ============================================

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  const dotColors: Record<string, string> = {
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    blue: 'bg-blue-400',
    red: 'bg-red-400',
  };

  return (
    <div className="flex items-center gap-2.5">
      <div className={`w-2 h-2 rounded-full ${dotColors[color]}`} />
      <div>
        <p className="text-[18px] font-semibold text-[#1E293B] leading-tight">{value}</p>
        <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

// ============================================
// STATUS BADGE
// ============================================

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    HOLD: { label: 'Zadržano', className: 'text-gray-400 border-gray-200' },
    PENDING: { label: 'Na čakanju', className: 'text-amber-500 border-amber-200' },
    CONFIRMED: { label: 'Potrjeno', className: 'text-emerald-600 border-emerald-200' },
    SEATED: { label: 'Sedijo', className: 'text-blue-500 border-blue-200' },
    COMPLETED: { label: 'Zaključeno', className: 'text-gray-400 border-gray-200' },
    CANCELLED: { label: 'Preklicano', className: 'text-red-400 border-red-200' },
    NO_SHOW: { label: 'No-show', className: 'text-red-500 border-red-200' },
  };

  const info = map[status] || { label: status, className: 'text-gray-400 border-gray-200' };

  return (
    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${info.className} uppercase tracking-wider`}>
      {info.label}
    </span>
  );
}

// ============================================
// SOURCE LABEL
// ============================================

function SourceLabel({ source }: { source: string }) {
  const map: Record<string, { label: string; color: string }> = {
    online: { label: 'Online', color: 'bg-blue-400' },
    phone: { label: 'Telefon', color: 'bg-emerald-400' },
    walk_in: { label: 'Walk-in', color: 'bg-amber-400' },
    manual: { label: 'Ročno', color: 'bg-gray-400' },
  };

  const info = map[source] || { label: source || '—', color: 'bg-gray-300' };

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-1.5 h-1.5 rounded-full ${info.color}`} />
      <span className="text-[11px] text-gray-400">{info.label}</span>
    </div>
  );
}

// ============================================
// LOADING SKELETON
// ============================================

function LoadingSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 min-h-[160px] animate-pulse">
            <div className="w-9 h-9 rounded-xl bg-gray-100 mb-4" />
            <div className="h-8 w-16 bg-gray-100 rounded mb-2" />
            <div className="h-3 w-24 bg-gray-50 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 h-[88px] animate-pulse" />
        ))}
      </div>
    </>
  );
}

// ============================================
// ICONS (18x18, consistent)
// ============================================

function IcCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

function IcUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  );
}

function IcGrid() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}

function IcTrend() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/>
    </svg>
  );
}
