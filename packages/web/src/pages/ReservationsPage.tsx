import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';
import { Badge, Button } from '@/components/ui';
import { NewReservationModal } from '@/components/reservations/NewReservationModal';

interface Reservation {
  id: string;
  date: string;
  time: string;
  partySize: number;
  status: string;
  source: string;
  notes: string | null;
  guest: { id: string; name: string; email: string; phone: string; tags: unknown; visitCount: number; noShowCount: number; isBlacklisted: boolean };
  tables: Array<{ table: { id: string; label: string } }>;
}

interface TimelineSlot {
  time: string;
  reservations: Reservation[];
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' }> = {
  HOLD: { label: 'Na čakanju', variant: 'warning' },
  PENDING: { label: 'V obdelavi', variant: 'info' },
  CONFIRMED: { label: 'Potrjena', variant: 'success' },
  SEATED: { label: 'Sedijo', variant: 'purple' },
  COMPLETED: { label: 'Zaključena', variant: 'default' },
  CANCELLED: { label: 'Preklicana', variant: 'danger' },
  NO_SHOW: { label: 'Ni prišel', variant: 'danger' },
};

const SOURCE_LABELS: Record<string, string> = {
  online: '🌐 Online',
  phone: '📞 Telefon',
  walk_in: '🚶 Walk-in',
  manual: '✍️ Ročno',
};

export function ReservationsPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState<TimelineSlot[]>([]);
  const [stats, setStats] = useState<{ totalReservations: number; totalGuests: number; byStatus: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

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

  const prevDay = () => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().split('T')[0]); };
  const nextDay = () => { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d.toISOString().split('T')[0]); };
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-900">Rezervacije</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={prevDay} className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-500">‹</button>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <button onClick={nextDay} className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-500">›</button>
            {date !== todayStr && (
              <Button variant="secondary" size="sm" onClick={() => setDate(todayStr)}>Danes</Button>
            )}
          </div>
          <Button onClick={() => setNewOpen(true)}>+ Nova rezervacija</Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="flex items-center gap-4 mb-6 text-sm flex-wrap">
          <span className="font-semibold text-gray-900">{stats.totalReservations} rezervacij</span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-500">{stats.totalGuests} gostov</span>
          {Object.entries(stats.byStatus).map(([status, count]) => {
            const info = STATUS_MAP[status];
            return info ? (
              <Badge key={status} variant={info.variant}>{count} {info.label.toLowerCase()}</Badge>
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
          <span className="text-4xl block mb-4">📋</span>
          <p className="text-lg font-medium text-gray-900 mb-1">Ni rezervacij</p>
          <p className="text-sm mb-4">Za ta dan še ni rezervacij</p>
          <Button onClick={() => setNewOpen(true)}>+ Nova rezervacija</Button>
        </div>
      ) : (
        <div className="space-y-1">
          {slots.map(slot => (
            <div key={slot.time} className="flex gap-4">
              <div className="w-16 flex-shrink-0 pt-3">
                <span className="font-display font-bold text-lg text-gray-900">{slot.time}</span>
              </div>
              <div className="flex-1 space-y-2 pb-4 border-l-2 border-gray-100 pl-4">
                {slot.reservations.map(res => {
                  const statusInfo = STATUS_MAP[res.status] || { label: res.status, variant: 'default' as const };
                  const canSeat = res.status === 'CONFIRMED';
                  const canComplete = res.status === 'SEATED';
                  const isActive = ['CONFIRMED', 'PENDING'].includes(res.status);

                  return (
                    <div key={res.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-medium text-gray-900">{res.guest.name}</span>
                            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                            {res.guest.isBlacklisted && <Badge variant="danger">⛔ Črna lista</Badge>}
                            {res.guest.noShowCount > 0 && (
                              <span className="text-xs text-red-500">{res.guest.noShowCount}× no-show</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
                            <span>{res.partySize} {res.partySize <= 4 ? 'osebe' : 'oseb'}</span>
                            <span className="text-gray-300">·</span>
                            <span className="text-brand-600 font-medium">{res.tables.map(t => t.table.label).join(', ')}</span>
                            <span className="text-gray-300">·</span>
                            <span className="text-xs">{SOURCE_LABELS[res.source] || res.source}</span>
                          </div>
                          {res.notes && <p className="text-xs text-gray-400 mt-1 italic">"{res.notes}"</p>}
                        </div>

                        <div className="flex items-center gap-1.5 ml-4 flex-shrink-0">
                          {canSeat && (
                            <Button size="sm" onClick={() => updateStatus(res.id, 'SEATED')} loading={actionLoading === res.id}>
                              Sedijo
                            </Button>
                          )}
                          {canComplete && (
                            <Button size="sm" onClick={() => updateStatus(res.id, 'COMPLETED')} loading={actionLoading === res.id}>
                              Zaključi
                            </Button>
                          )}
                          {isActive && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => updateStatus(res.id, 'NO_SHOW')} loading={actionLoading === res.id}>
                                No-show
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => updateStatus(res.id, 'CANCELLED')} loading={actionLoading === res.id}>
                                Prekliči
                              </Button>
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

      {/* New reservation modal */}
      <NewReservationModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={fetchTimeline}
        defaultDate={date}
      />
    </div>
  );
}
