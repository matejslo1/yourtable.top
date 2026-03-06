import { useEffect, useState } from 'react';
import { apiFetch, useAuthStore } from '@/lib/auth';
import { Input, Select, Button } from '@/components/ui';

const DAYS_SL = ['Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota', 'Nedelja'];

interface OperatingHour {
  dayOfWeek: number; openTime: string; closeTime: string; lastReservation: string; isClosed: boolean; slotDurationMin: number;
}
interface SeatingConfig {
  holdTtlSeconds: number; maxJoinTables: number; autoConfirm: boolean; defaultDurationMin: number; maxPartySize: number; noShowTimeoutMin: number;
}

export function SettingsPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'restaurant' | 'hours' | 'seating'>('restaurant');
  const [hours, setHours] = useState<OperatingHour[]>([]);
  const [seating, setSeating] = useState<SeatingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [hRes, sRes] = await Promise.all([
          apiFetch<{ data: OperatingHour[] }>('/api/v1/config/hours').catch(() => ({ data: [] as OperatingHour[] })),
          apiFetch<{ data: SeatingConfig }>('/api/v1/config/seating').catch(() => ({ data: null as any })),
        ]);
        setHours(hRes.data || []);
        setSeating(sRes.data || null);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const flashSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const updateHour = (dayOfWeek: number, field: string, value: unknown) => {
    setHours(prev => prev.map(h => h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h));
  };

  const saveHours = async () => {
    setSaving(true);
    try { await apiFetch('/api/v1/config/hours', { method: 'PUT', body: JSON.stringify({ hours }) }); flashSaved(); }
    catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  };

  const updateSeating = (field: string, value: unknown) => setSeating(prev => prev ? { ...prev, [field]: value } : null);

  const saveSeating = async () => {
    if (!seating) return;
    setSaving(true);
    try { await apiFetch('/api/v1/config/seating', { method: 'PUT', body: JSON.stringify(seating) }); flashSaved(); }
    catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  };

  const TABS = [
    { key: 'restaurant' as const, label: 'Restavracija', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg> },
    { key: 'hours' as const, label: 'Delovni čas', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg> },
    { key: 'seating' as const, label: 'Sedežni red', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  ];

  return (
    <div className="min-h-screen bg-[#F4F6F8]">
      <div className="max-w-[1400px] mx-auto px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-[22px] font-semibold text-[#1E293B] tracking-tight">Nastavitve</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">{user?.tenant?.name || 'Nastavitve restavracije'}</p>
          </div>
          {saved && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-[12px] font-medium">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20,6 9,17 4,12"/></svg>
              Shranjeno
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                tab === t.key ? 'bg-white text-[#1E293B] border border-gray-100' : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
              }`}
              style={tab === t.key ? { boxShadow: '0 1px 4px rgba(0,0,0,0.04)' } : undefined}
            >
              <span className={tab === t.key ? 'text-emerald-500' : ''}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 animate-pulse">
            <div className="h-6 w-40 bg-gray-100 rounded mb-4" />
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 bg-gray-50 rounded-lg" />)}</div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-6" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>

            {/* Restaurant info */}
            {tab === 'restaurant' && (
              <div className="space-y-5">
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em] mb-3">Podatki restavracije</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50/60 rounded-lg px-4 py-3">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Ime</p>
                      <p className="text-[14px] font-medium text-[#1E293B]">{user?.tenant?.name || '—'}</p>
                    </div>
                    <div className="bg-gray-50/60 rounded-lg px-4 py-3">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Slug</p>
                      <p className="text-[14px] font-medium text-[#1E293B]">{user?.tenant?.slug || '—'}</p>
                    </div>
                    <div className="bg-gray-50/60 rounded-lg px-4 py-3">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Admin</p>
                      <p className="text-[14px] font-medium text-[#1E293B]">{user?.email || '—'}</p>
                    </div>
                    <div className="bg-gray-50/60 rounded-lg px-4 py-3">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Vloga</p>
                      <p className="text-[14px] font-medium text-[#1E293B] capitalize">{user?.role || '—'}</p>
                    </div>
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-50">
                  <p className="text-[11px] text-gray-300">Spremembe imena in slug-a še niso na voljo. Prihaja v prihodnji verziji.</p>
                </div>
              </div>
            )}

            {/* Operating hours */}
            {tab === 'hours' && (
              <div className="space-y-5">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em] mb-1">Delovni čas</p>
                {hours.length === 0 ? (
                  <p className="text-[13px] text-gray-400 py-4">Ni podatkov o delovnem času. Kliknite Shrani za ustvarjanje privzetih vrednosti.</p>
                ) : (
                  <div className="space-y-2">
                    {hours.map(h => (
                      <div key={h.dayOfWeek} className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-colors ${h.isClosed ? 'bg-gray-50/60' : 'bg-white border border-gray-50'}`}>
                        <div className="w-28 flex-shrink-0">
                          <span className={`text-[13px] font-medium ${h.isClosed ? 'text-gray-300' : 'text-[#1E293B]'}`}>{DAYS_SL[h.dayOfWeek]}</span>
                        </div>
                        <label className="flex items-center gap-2 flex-shrink-0">
                          <input type="checkbox" checked={!h.isClosed} onChange={e => updateHour(h.dayOfWeek, 'isClosed', !e.target.checked)} className="w-4 h-4 rounded accent-emerald-500" />
                          <span className="text-[11px] text-gray-400">Odprto</span>
                        </label>
                        {!h.isClosed && (
                          <div className="flex items-center gap-2 flex-1">
                            <input type="time" value={h.openTime} onChange={e => updateHour(h.dayOfWeek, 'openTime', e.target.value)} className="px-2 py-1 rounded border border-gray-100 text-[12px] w-24 outline-none" />
                            <span className="text-gray-300">—</span>
                            <input type="time" value={h.closeTime} onChange={e => updateHour(h.dayOfWeek, 'closeTime', e.target.value)} className="px-2 py-1 rounded border border-gray-100 text-[12px] w-24 outline-none" />
                            <span className="text-[10px] text-gray-300 ml-2">Zadnja rez.</span>
                            <input type="time" value={h.lastReservation} onChange={e => updateHour(h.dayOfWeek, 'lastReservation', e.target.value)} className="px-2 py-1 rounded border border-gray-100 text-[12px] w-24 outline-none" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-end pt-3">
                  <button onClick={saveHours} disabled={saving} className="px-5 py-2 rounded-lg bg-[#1E293B] text-white text-[13px] font-medium hover:bg-[#334155] transition-colors disabled:opacity-50">
                    {saving ? 'Shranjujem...' : 'Shrani delovni čas'}
                  </button>
                </div>
              </div>
            )}

            {/* Seating config */}
            {tab === 'seating' && seating && (
              <div className="space-y-5">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em] mb-1">Konfiguracija sedežnega reda</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-medium text-gray-500 mb-1">Privzeto trajanje (min)</label>
                    <input type="number" value={seating.defaultDurationMin} onChange={e => updateSeating('defaultDurationMin', parseInt(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-gray-100 text-[13px] outline-none" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-500 mb-1">Max. velikost skupine</label>
                    <input type="number" value={seating.maxPartySize} onChange={e => updateSeating('maxPartySize', parseInt(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-gray-100 text-[13px] outline-none" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-500 mb-1">Hold TTL (sekunde)</label>
                    <input type="number" value={seating.holdTtlSeconds} onChange={e => updateSeating('holdTtlSeconds', parseInt(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-gray-100 text-[13px] outline-none" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-500 mb-1">No-show timeout (min)</label>
                    <input type="number" value={seating.noShowTimeoutMin} onChange={e => updateSeating('noShowTimeoutMin', parseInt(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-gray-100 text-[13px] outline-none" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-500 mb-1">Max. združljivih miz</label>
                    <input type="number" value={seating.maxJoinTables} onChange={e => updateSeating('maxJoinTables', parseInt(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-gray-100 text-[13px] outline-none" />
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={seating.autoConfirm} onChange={e => updateSeating('autoConfirm', e.target.checked)} className="w-4 h-4 rounded accent-emerald-500" />
                      <span className="text-[13px] text-gray-600">Samodejno potrdi</span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end pt-3">
                  <button onClick={saveSeating} disabled={saving} className="px-5 py-2 rounded-lg bg-[#1E293B] text-white text-[13px] font-medium hover:bg-[#334155] transition-colors disabled:opacity-50">
                    {saving ? 'Shranjujem...' : 'Shrani nastavitve'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
