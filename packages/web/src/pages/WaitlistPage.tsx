import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';
import { Button, EmptyState } from '@/components/ui';

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

export function WaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchWaitlist = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: WaitlistEntry[] }>(`/api/v1/waitlist?date=${date}`);
      setEntries(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchWaitlist(); }, [date]);

  const offerSpot = async (id: string) => {
    setActionLoading(id);
    try { await apiFetch(`/api/v1/waitlist/${id}/offer`, { method: 'POST' }); fetchWaitlist(); }
    catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const removeEntry = async (id: string) => {
    setActionLoading(id);
    try { await apiFetch(`/api/v1/waitlist/${id}`, { method: 'DELETE' }); fetchWaitlist(); }
    catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const waiting = entries.filter(e => e.status === 'waiting');
  const offered = entries.filter(e => e.status === 'offered');
  const rest = entries.filter(e => !['waiting', 'offered'].includes(e.status));

  return (
    <div className="min-h-screen bg-[#F4F6F8]">
      <div className="max-w-[1400px] mx-auto px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-[22px] font-semibold text-[#1E293B] tracking-tight">Čakalna vrsta</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">
              {waiting.length} na čakanju{offered.length > 0 ? `, ${offered.length} ponujenih` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-100 bg-white text-[13px] outline-none"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
            </div>
            <p className="text-[14px] font-medium text-[#1E293B] mb-1">Čakalna vrsta je prazna</p>
            <p className="text-[12px] text-gray-400">Trenutno ni nikogar na čakanju za ta datum</p>
          </div>
        ) : (
          <div className="space-y-6">
            {waiting.length > 0 && (
              <Section title="Na čakanju" count={waiting.length} color="bg-blue-400">
                {waiting.map(e => <EntryCard key={e.id} entry={e} actionLoading={actionLoading} onOffer={() => offerSpot(e.id)} onRemove={() => removeEntry(e.id)} />)}
              </Section>
            )}
            {offered.length > 0 && (
              <Section title="Ponujeno" count={offered.length} color="bg-amber-400">
                {offered.map(e => <EntryCard key={e.id} entry={e} actionLoading={actionLoading} onRemove={() => removeEntry(e.id)} />)}
              </Section>
            )}
            {rest.length > 0 && (
              <Section title="Zaključeno" count={rest.length} color="bg-gray-300">
                {rest.map(e => <EntryCard key={e.id} entry={e} actionLoading={actionLoading} />)}
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, count, color, children }: { title: string; count: number; color: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
        <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em]">{title}</h2>
        <span className="text-[11px] text-gray-300">({count})</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function EntryCard({ entry, actionLoading, onOffer, onRemove }: {
  entry: WaitlistEntry; actionLoading: string | null; onOffer?: () => void; onRemove?: () => void;
}) {
  const isVip = entry.guest?.tags?.includes('VIP');
  const isLoading = actionLoading === entry.id;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between hover:border-gray-200 transition-all" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
      <div className="flex items-center gap-3.5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-[12px] font-bold ${
          entry.priority > 0 ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-400'
        }`}>
          {entry.priority > 0 ? '★' : entry.guest?.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[#1E293B]">{entry.guest?.name || '—'}</span>
            {isVip && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 uppercase tracking-wider">VIP</span>}
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border uppercase tracking-wider ${
              entry.status === 'waiting' ? 'text-blue-500 border-blue-200' :
              entry.status === 'offered' ? 'text-amber-500 border-amber-200' :
              entry.status === 'accepted' ? 'text-emerald-500 border-emerald-200' :
              'text-gray-400 border-gray-200'
            }`}>{entry.status === 'waiting' ? 'Čaka' : entry.status === 'offered' ? 'Ponujeno' : entry.status === 'accepted' ? 'Sprejeto' : entry.status}</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {entry.partySize} oseb · {entry.time} · dodan {new Date(entry.createdAt).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}
            {entry.expiresAt && entry.status === 'offered' && (
              <span className="text-amber-500 ml-2">poteče {new Date(entry.expiresAt).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {entry.guest?.phone && (
          <a href={`tel:${entry.guest.phone}`} className="text-[11px] text-gray-300 hover:text-gray-500 transition-colors">{entry.guest.phone}</a>
        )}
        {onOffer && entry.status === 'waiting' && (
          <button onClick={onOffer} disabled={isLoading} className="px-3 py-1.5 rounded-md bg-[#1E293B] text-white text-[11px] font-medium hover:bg-[#334155] transition-colors disabled:opacity-50">
            Ponudi mesto
          </button>
        )}
        {onRemove && ['waiting', 'offered'].includes(entry.status) && (
          <button onClick={onRemove} disabled={isLoading} className="px-2.5 py-1.5 rounded-md text-gray-400 text-[11px] font-medium hover:bg-gray-50 hover:text-red-500 transition-colors disabled:opacity-50">
            Odstrani
          </button>
        )}
      </div>
    </div>
  );
}
