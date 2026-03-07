import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';
import { Badge, Button } from '@/components/ui';
import { NewReservationModal } from '@/components/reservations/NewReservationModal';
import { EditReservationModal } from '@/components/reservations/EditReservationModal';

interface Reservation {
  id: string;
  date: string;
  time: string;
  partySize: number;
  status: string;
  source: string;
  notes: string | null;
  internalNotes: string | null;
  durationMinutes: number;
  guest: { id: string; name: string; email: string; phone: string; tags: unknown; visitCount: number; noShowCount: number; isBlacklisted: boolean };
  tables: Array<{ table: { id: string; label: string } }>;
}

interface TimelineSlot { time: string; reservations: Reservation[]; }

const STATUS: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'; dot: string }> = {
  HOLD: { label: 'Zadržano', variant: 'warning', dot: 'bg-gray-400' },
  PENDING: { label: 'Na čakanju', variant: 'info', dot: 'bg-amber-400' },
  CONFIRMED: { label: 'Potrjena', variant: 'success', dot: 'bg-emerald-400' },
  SEATED: { label: 'Sedijo', variant: 'purple', dot: 'bg-blue-400' },
  COMPLETED: { label: 'Zaključena', variant: 'default', dot: 'bg-gray-300' },
  CANCELLED: { label: 'Preklicana', variant: 'danger', dot: 'bg-red-400' },
  NO_SHOW: { label: 'Ni prišel', variant: 'danger', dot: 'bg-red-500' },
};

const SOURCES: Record<string, string> = { online: 'Online', phone: 'Telefon', walk_in: 'Walk-in', manual: 'Ročno' };

export function ReservationsPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState<TimelineSlot[]>([]);
  const [stats, setStats] = useState<{ totalReservations: number; totalGuests: number; byStatus: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [editOpen, setEditOpen] = useState(false);
  const [editReservation, setEditReservation] = useState<Reservation | null>(null);

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: { slots: TimelineSlot[]; stats: any } }>(`/api/v1/reservations/timeline?date=${date}`);
      setSlots(res.data.slots);
      setStats(res.data.stats);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTimeline(); }, [date]);

  const updateStatus = async (id: string, status: string) => {
    setActionLoading(id);
    try {
      await apiFetch(`/api/v1/reservations/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      await fetchTimeline();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const prevDay = () => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().split('T')[0]); };
  const nextDay = () => { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d.toISOString().split('T')[0]); };
  const todayStr = new Date().toISOString().split('T')[0];
  const isToday = date === todayStr;

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long' });

  // Filter
  const filteredSlots = filter === 'all' ? slots : slots.map(s => ({
    ...s,
    reservations: s.reservations.filter(r => r.status === filter),
  })).filter(s => s.reservations.length > 0);

  const allRes = slots.flatMap(s => s.reservations);

  return (
    <div className="min-h-screen bg-[#F4F6F8]">
      <div className="max-w-[1400px] mx-auto px-8 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-[22px] font-semibold text-[#1E293B] tracking-tight">Rezervacije</h1>
            <p className="text-[13px] text-gray-400 mt-0.5 capitalize">{dateLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white rounded-lg border border-gray-100" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <button onClick={prevDay} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-2 py-1.5 text-[13px] border-none outline-none bg-transparent" />
              <button onClick={nextDay} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              </button>
              {!isToday && (
                <button onClick={() => setDate(todayStr)} className="px-2.5 py-1.5 text-[11px] font-medium text-emerald-600 hover:text-emerald-700 border-l border-gray-100">
                  Danes
                </button>
              )}
            </div>
            <button
              onClick={() => setNewOpen(true)}
              className="px-4 py-2 rounded-lg bg-[#1E293B] text-white text-[13px] font-medium hover:bg-[#334155] transition-colors"
            >
              + Nova rezervacija
            </button>
          </div>
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <div className="bg-white rounded-lg border border-gray-100 px-3.5 py-2 flex items-center gap-2" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <span className="text-[13px] font-semibold text-[#1E293B]">{stats.totalReservations}</span>
              <span className="text-[11px] text-gray-400">rezervacij</span>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 px-3.5 py-2 flex items-center gap-2" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <span className="text-[13px] font-semibold text-[#1E293B]">{stats.totalGuests}</span>
              <span className="text-[11px] text-gray-400">gostov</span>
            </div>
            <div className="h-5 w-px bg-gray-200" />
            {/* Filter buttons */}
            {[
              { key: 'all', label: 'Vse', count: allRes.length },
              { key: 'CONFIRMED', label: 'Potrjene', count: stats.byStatus['CONFIRMED'] || 0 },
              { key: 'SEATED', label: 'Sedijo', count: stats.byStatus['SEATED'] || 0 },
              { key: 'COMPLETED', label: 'Zaključene', count: stats.byStatus['COMPLETED'] || 0 },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                  filter === f.key
                    ? 'bg-[#1E293B] text-white'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-white'
                }`}
              >
                {f.label} {f.count > 0 && <span className="opacity-60 ml-0.5">{f.count}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Timeline */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-20 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
          </div>
        ) : filteredSlots.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <p className="text-[14px] font-medium text-[#1E293B] mb-1">Ni rezervacij</p>
            <p className="text-[12px] text-gray-400 mb-4">Za ta dan še ni rezervacij</p>
            <button
              onClick={() => setNewOpen(true)}
              className="px-4 py-2 rounded-lg bg-[#1E293B] text-white text-[12px] font-medium hover:bg-[#334155] transition-colors"
            >
              + Nova rezervacija
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredSlots.map(slot => (
              <div key={slot.time} className="flex gap-4">
                {/* Time */}
                <div className="w-14 flex-shrink-0 pt-4">
                  <span className="font-display text-[18px] font-semibold text-[#1E293B] tabular-nums">{slot.time}</span>
                </div>

                {/* Cards */}
                <div className="flex-1 space-y-2 pb-3 border-l border-gray-200 pl-4">
                  {slot.reservations.map(r => {
                    const s = STATUS[r.status] || { label: r.status, variant: 'default' as const, dot: 'bg-gray-300' };
                    const canSeat = r.status === 'CONFIRMED';
                    const canComplete = r.status === 'SEATED';
                    const isActive = ['CONFIRMED', 'PENDING', 'HOLD'].includes(r.status);

                    return (
                      <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:border-gray-200 transition-all" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <div className={`w-2 h-2 rounded-full ${s.dot}`} />
                              <span className="text-[13px] font-semibold text-[#1E293B]">{r.guest?.name || '—'}</span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                                s.variant === 'success' ? 'text-emerald-600 border-emerald-200' :
                                s.variant === 'warning' ? 'text-amber-500 border-amber-200' :
                                s.variant === 'danger' ? 'text-red-500 border-red-200' :
                                s.variant === 'purple' ? 'text-blue-500 border-blue-200' :
                                s.variant === 'info' ? 'text-blue-400 border-blue-200' :
                                'text-gray-400 border-gray-200'
                              }`}>{s.label}</span>
                              {r.guest?.isBlacklisted && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-red-500 border-red-200">Črna lista</span>}
                              {r.guest?.noShowCount > 0 && <span className="text-[10px] text-red-400">{r.guest.noShowCount}× no-show</span>}
                            </div>
                            <div className="flex items-center gap-2 text-[12px] text-gray-400 flex-wrap">
                              <span>{r.partySize} {r.partySize === 1 ? 'oseba' : r.partySize <= 4 ? 'osebe' : 'oseb'}</span>
                              {r.tables?.length > 0 && (
                                <>
                                  <span className="text-gray-200">·</span>
                                  <span className="text-emerald-600 font-medium">{r.tables.map(t => t.table?.label).join(', ')}</span>
                                </>
                              )}
                              <span className="text-gray-200">·</span>
                              <span>{SOURCES[r.source] || r.source}</span>
                              {r.durationMinutes && (
                                <>
                                  <span className="text-gray-200">·</span>
                                  <span>{r.durationMinutes} min</span>
                                </>
                              )}
                            </div>
                            {r.notes && <p className="text-[11px] text-gray-300 mt-1.5 italic">"{r.notes}"</p>}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                            {canSeat && (
                              <button
                                onClick={() => updateStatus(r.id, 'SEATED')}
                                disabled={actionLoading === r.id}
                                className="px-3 py-1.5 rounded-md bg-blue-50 text-blue-600 text-[11px] font-semibold hover:bg-blue-100 transition-colors disabled:opacity-50"
                              >Sedijo</button>
                            )}
                            {canComplete && (
                              <button
                                onClick={() => updateStatus(r.id, 'COMPLETED')}
                                disabled={actionLoading === r.id}
                                className="px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-600 text-[11px] font-semibold hover:bg-emerald-100 transition-colors disabled:opacity-50"
                              >Zaključi</button>
                            )}
                            {isActive && (
                              <>
                                <button
                                  onClick={() => { setEditReservation(r); setEditOpen(true); }}
                                  className="px-2.5 py-1.5 rounded-md text-gray-400 text-[11px] font-medium hover:bg-gray-50 hover:text-blue-500 transition-colors"
                                >Uredi</button>
                                <button
                                  onClick={() => updateStatus(r.id, 'NO_SHOW')}
                                  disabled={actionLoading === r.id}
                                  className="px-2.5 py-1.5 rounded-md text-gray-400 text-[11px] font-medium hover:bg-gray-50 hover:text-red-500 transition-colors disabled:opacity-50"
                                >No-show</button>
                                <button
                                  onClick={() => updateStatus(r.id, 'CANCELLED')}
                                  disabled={actionLoading === r.id}
                                  className="px-2.5 py-1.5 rounded-md text-gray-400 text-[11px] font-medium hover:bg-gray-50 hover:text-red-500 transition-colors disabled:opacity-50"
                                >Prekliči</button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <NewReservationModal open={newOpen} onClose={() => setNewOpen(false)} onCreated={fetchTimeline} defaultDate={date} />
        <EditReservationModal open={editOpen} reservation={editReservation} onClose={() => { setEditOpen(false); setEditReservation(null); }} onUpdated={fetchTimeline} />
      </div>
    </div>
  );
}
