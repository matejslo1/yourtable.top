import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';
import { Badge, Button, Input, EmptyState } from '@/components/ui';

interface WaitlistEntry {
  id: string;
  date: string;
  time: string;
  partySize: number;
  priority: number;
  status: string;
  offeredAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  guest: { id: string; name: string; email: string; phone: string; tags: string[] };
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' }> = {
  waiting: { label: 'Čaka', variant: 'info' },
  offered: { label: 'Ponujeno', variant: 'warning' },
  accepted: { label: 'Sprejeto', variant: 'success' },
  expired: { label: 'Poteklo', variant: 'default' },
};

export function WaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchWaitlist = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: WaitlistEntry[] }>(`/api/v1/waitlist?date=${date}`);
      setEntries(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchWaitlist(); }, [date]);

  const offerSpot = async (id: string) => {
    setActionLoading(id);
    try {
      await apiFetch(`/api/v1/waitlist/${id}/offer`, { method: 'POST' });
      fetchWaitlist();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const removeEntry = async (id: string) => {
    setActionLoading(id);
    try {
      await apiFetch(`/api/v1/waitlist/${id}`, { method: 'DELETE' });
      fetchWaitlist();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const waiting = entries.filter(e => e.status === 'waiting');
  const offered = entries.filter(e => e.status === 'offered');
  const rest = entries.filter(e => !['waiting', 'offered'].includes(e.status));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Čakalna vrsta</h1>
          <p className="text-sm text-gray-500 mt-0.5">{waiting.length} na čakanju, {offered.length} ponujenih</p>
        </div>
        <Input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-auto"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon="⏳"
          title="Čakalna vrsta je prazna"
          description="Trenutno ni nikogar na čakanju za ta datum"
        />
      ) : (
        <div className="space-y-6">
          {/* Waiting */}
          {waiting.length > 0 && (
            <Section title="Na čakanju" count={waiting.length}>
              {waiting.map(entry => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  actionLoading={actionLoading}
                  onOffer={() => offerSpot(entry.id)}
                  onRemove={() => removeEntry(entry.id)}
                />
              ))}
            </Section>
          )}

          {/* Offered */}
          {offered.length > 0 && (
            <Section title="Ponujeno" count={offered.length}>
              {offered.map(entry => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  actionLoading={actionLoading}
                  onRemove={() => removeEntry(entry.id)}
                />
              ))}
            </Section>
          )}

          {/* Resolved */}
          {rest.length > 0 && (
            <Section title="Zaključeno" count={rest.length}>
              {rest.map(entry => (
                <EntryCard key={entry.id} entry={entry} actionLoading={actionLoading} />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        {title} <span className="text-gray-300">({count})</span>
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function EntryCard({ entry, actionLoading, onOffer, onRemove }: {
  entry: WaitlistEntry;
  actionLoading: string | null;
  onOffer?: () => void;
  onRemove?: () => void;
}) {
  const statusInfo = STATUS_MAP[entry.status] || { label: entry.status, variant: 'default' as const };
  const isVip = entry.guest.tags?.includes('VIP');
  const isLoading = actionLoading === entry.id;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">
          {entry.priority > 0 ? '⭐' : entry.guest.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{entry.guest.name}</span>
            {isVip && <Badge variant="success">VIP</Badge>}
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {entry.partySize} oseb · {entry.time} · dodan {new Date(entry.createdAt).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}
            {entry.expiresAt && entry.status === 'offered' && (
              <span className="text-amber-600 ml-2">
                poteče {new Date(entry.expiresAt).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {entry.guest.phone && (
          <a href={`tel:${entry.guest.phone}`} className="text-xs text-gray-400 hover:text-gray-600">{entry.guest.phone}</a>
        )}
        {onOffer && entry.status === 'waiting' && (
          <Button size="sm" onClick={onOffer} loading={isLoading}>Ponudi mesto</Button>
        )}
        {onRemove && ['waiting', 'offered'].includes(entry.status) && (
          <Button variant="ghost" size="sm" onClick={onRemove} loading={isLoading}>Odstrani</Button>
        )}
      </div>
    </div>
  );
}
