import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';

interface Reservation {
  id: string;
  date: string;
  time: string;
  partySize: number;
  status: string;
  source: string;
  notes: string | null;
  guest: { id: string; name: string; email: string; phone: string; tags: unknown; visitCount: number; noShowCount: number };
  tables: Array<{ table: { id: string; label: string } }>;
}

interface TimelineSlot {
  time: string;
  reservations: Reservation[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  HOLD: { label: 'Na čakanju', color: 'bg-yellow-100 text-yellow-700' },
  PENDING: { label: 'V obdelavi', color: 'bg-blue-100 text-blue-700' },
  CONFIRMED: { label: 'Potrjena', color: 'bg-green-100 text-green-700' },
  SEATED: { label: 'Sedijo', color: 'bg-purple-100 text-purple-700' },
  COMPLETED: { label: 'Zaključena', color: 'bg-gray-100 text-gray-600' },
  CANCELLED: { label: 'Preklicana', color: 'bg-red-100 text-red-600' },
  NO_SHOW: { label: 'Ni prišel', color: 'bg-red-100 text-red-700' },
};

export function ReservationsPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState<TimelineSlot[]>([]);
  const [stats, setStats] = useState<{ totalReservations: number; totalGuests: number; byStatus: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: { slots: TimelineSlot[]; stats: any } }>(
        `/api/v1/reservations/timeline?date=${date}`
      );
      setSlots(res.data.slots);
      setStats(res.data.stats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTimeline(); }, [date]);

  const updateStatus = async (id: string, status: string) => {
    setActionLoading(id);
    try {
      await apiFetch(`/api/v1/reservations/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      await fetchTimeline();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const prevDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().split('T')[0]);
  };

  const nextDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    setDate(d.toISOString().split('T')[0]);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-900">Rezervacije</h1>
        <div className="flex items-center gap-2">
          <button onClick={prevDay} className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-500">‹</button>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
          />
          <button onClick={nextDay} className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-500">›</button>
          {date !== todayStr && (
            <button onClick={() => setDate(todayStr)} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800">
              Danes
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="flex items-center gap-6 mb-6 text-sm">
          <span className="font-medium text-gray-900">{stats.totalReservations} rezervacij</span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-500">{stats.totalGuests} gostov</span>
          {Object.entries(stats.byStatus).map(([status, count]) => {
            const info = STATUS_LABELS[status];
            return info ? (
              <span key={status} className={`px-2 py-0.5 rounded text-xs font-medium ${info.color}`}>
                {count} {info.label.toLowerCase()}
              </span>
            ) : null;
          })}
        </div>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : slots.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-1">Ni rezervacij za ta dan</p>
          <p className="text-sm">Izberite drug datum ali ustvarite novo rezervacijo</p>
        </div>
      ) : (
        <div className="space-y-1">
          {slots.map(slot => (
            <div key={slot.time} className="flex gap-4">
              {/* Time label */}
              <div className="w-16 flex-shrink-0 pt-3">
                <span className="font-display font-bold text-lg text-gray-900">{slot.time}</span>
              </div>

              {/* Reservations */}
              <div className="flex-1 space-y-2 pb-4 border-l-2 border-gray-100 pl-4">
                {slot.reservations.map(res => {
                  const statusInfo = STATUS_LABELS[res.status] || { label: res.status, color: 'bg-gray-100 text-gray-600' };
                  const isActive = ['CONFIRMED', 'PENDING'].includes(res.status);
                  const canSeat = res.status === 'CONFIRMED';
                  const canComplete = res.status === 'SEATED';

                  return (
                    <div key={res.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">{res.guest.name}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                            {res.guest.noShowCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-red-50 text-red-600">
                                {res.guest.noShowCount}× no-show
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            <span>{res.partySize} {res.partySize === 1 ? 'oseba' : res.partySize <= 4 ? 'osebe' : 'oseb'}</span>
                            <span>·</span>
                            <span>{res.tables.map(t => t.table.label).join(', ')}</span>
                            <span>·</span>
                            <span>{res.source}</span>
                          </div>
                          {res.notes && <p className="text-xs text-gray-400 mt-1">{res.notes}</p>}
                        </div>

                        {/* Quick actions */}
                        <div className="flex items-center gap-1.5 ml-4">
                          {canSeat && (
                            <button
                              onClick={() => updateStatus(res.id, 'SEATED')}
                              disabled={actionLoading === res.id}
                              className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 disabled:opacity-50"
                            >
                              Sedijo
                            </button>
                          )}
                          {canComplete && (
                            <button
                              onClick={() => updateStatus(res.id, 'COMPLETED')}
                              disabled={actionLoading === res.id}
                              className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
                            >
                              Zaključi
                            </button>
                          )}
                          {isActive && (
                            <>
                              <button
                                onClick={() => updateStatus(res.id, 'NO_SHOW')}
                                disabled={actionLoading === res.id}
                                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                              >
                                No-show
                              </button>
                              <button
                                onClick={() => updateStatus(res.id, 'CANCELLED')}
                                disabled={actionLoading === res.id}
                                className="px-3 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                Prekliči
                              </button>
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
    </div>
  );
}
