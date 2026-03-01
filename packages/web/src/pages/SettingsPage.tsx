import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';
import { Button, Input, Select } from '@/components/ui';

const DAYS_SL = ['Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota', 'Nedelja'];

interface OperatingHour {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  lastReservation: string;
  isClosed: boolean;
  slotDurationMin: number;
}

interface SeatingConfig {
  holdTtlSeconds: number;
  maxJoinTables: number;
  autoConfirm: boolean;
  defaultDurationMin: number;
  maxPartySize: number;
  noShowTimeoutMin: number;
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'hours' | 'seating' | 'restaurant'>('hours');
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
          apiFetch<{ data: OperatingHour[] }>('/api/v1/config/hours'),
          apiFetch<{ data: SeatingConfig }>('/api/v1/config/seating'),
        ]);
        setHours(hRes.data);
        setSeating(sRes.data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const updateHour = (dayOfWeek: number, field: string, value: unknown) => {
    setHours(prev => prev.map(h =>
      h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h
    ));
  };

  const saveHours = async () => {
    setSaving(true);
    try {
      await apiFetch('/api/v1/config/hours', {
        method: 'PUT',
        body: JSON.stringify({ hours }),
      });
      flashSaved();
    } catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  };

  const updateSeating = (field: string, value: unknown) => {
    setSeating(prev => prev ? { ...prev, [field]: value } : null);
  };

  const saveSeating = async () => {
    if (!seating) return;
    setSaving(true);
    try {
      await apiFetch('/api/v1/config/seating', {
        method: 'PUT',
        body: JSON.stringify(seating),
      });
      flashSaved();
    } catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  };

  const flashSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const tabs = [
    { key: 'hours', label: '🕐 Delovni čas' },
    { key: 'seating', label: '🪑 Seating nastavitve' },
  ] as const;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-900">Nastavitve</h1>
        {saved && (
          <span className="text-sm text-emerald-600 font-medium animate-pulse">✓ Shranjeno</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Operating Hours */}
          {activeTab === 'hours' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase w-32">Dan</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase w-20">Odprto</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Odprtje</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Zaprtje</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Zadnja rez.</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Interval</th>
                  </tr>
                </thead>
                <tbody>
                  {hours.map(h => (
                    <tr key={h.dayOfWeek} className={`border-b border-gray-50 ${h.isClosed ? 'opacity-40' : ''}`}>
                      <td className="px-5 py-3">
                        <span className="text-sm font-medium text-gray-900">{DAYS_SL[h.dayOfWeek]}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={!h.isClosed}
                          onChange={e => updateHour(h.dayOfWeek, 'isClosed', !e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="time"
                          value={h.openTime}
                          onChange={e => updateHour(h.dayOfWeek, 'openTime', e.target.value)}
                          disabled={h.isClosed}
                          className="px-2 py-1.5 rounded border border-gray-200 text-sm disabled:bg-gray-50"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="time"
                          value={h.closeTime}
                          onChange={e => updateHour(h.dayOfWeek, 'closeTime', e.target.value)}
                          disabled={h.isClosed}
                          className="px-2 py-1.5 rounded border border-gray-200 text-sm disabled:bg-gray-50"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="time"
                          value={h.lastReservation}
                          onChange={e => updateHour(h.dayOfWeek, 'lastReservation', e.target.value)}
                          disabled={h.isClosed}
                          className="px-2 py-1.5 rounded border border-gray-200 text-sm disabled:bg-gray-50"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <select
                          value={h.slotDurationMin}
                          onChange={e => updateHour(h.dayOfWeek, 'slotDurationMin', parseInt(e.target.value))}
                          disabled={h.isClosed}
                          className="px-2 py-1.5 rounded border border-gray-200 text-sm disabled:bg-gray-50"
                        >
                          <option value="15">15 min</option>
                          <option value="30">30 min</option>
                          <option value="60">60 min</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-4 border-t border-gray-100 flex justify-end">
                <Button onClick={saveHours} loading={saving}>Shrani delovni čas</Button>
              </div>
            </div>
          )}

          {/* Seating Config */}
          {activeTab === 'seating' && seating && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="grid grid-cols-2 gap-6 max-w-2xl">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">HOLD trajanje (sekunde)</label>
                  <input
                    type="number"
                    value={seating.holdTtlSeconds}
                    onChange={e => updateSeating('holdTtlSeconds', parseInt(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">Koliko časa ima gost za vnos podatkov ({Math.round(seating.holdTtlSeconds / 60)} min)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Max. združenih miz</label>
                  <input
                    type="number"
                    value={seating.maxJoinTables}
                    onChange={e => updateSeating('maxJoinTables', parseInt(e.target.value))}
                    min={1} max={5}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Privzeto trajanje (min)</label>
                  <input
                    type="number"
                    value={seating.defaultDurationMin}
                    onChange={e => updateSeating('defaultDurationMin', parseInt(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Max. velikost skupine</label>
                  <input
                    type="number"
                    value={seating.maxPartySize}
                    onChange={e => updateSeating('maxPartySize', parseInt(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">No-show timeout (min)</label>
                  <input
                    type="number"
                    value={seating.noShowTimeoutMin}
                    onChange={e => updateSeating('noShowTimeoutMin', parseInt(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm"
                  />
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="autoConfirm"
                    checked={seating.autoConfirm}
                    onChange={e => updateSeating('autoConfirm', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-brand-600"
                  />
                  <label htmlFor="autoConfirm" className="text-sm font-medium text-gray-700">
                    Avtomatsko potrdi rezervacije
                  </label>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
                <Button onClick={saveSeating} loading={saving}>Shrani nastavitve</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
