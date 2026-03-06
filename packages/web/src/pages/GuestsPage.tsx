import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';
import { Modal } from '@/components/ui';

interface Guest {
  id: string; name: string; email: string | null; phone: string | null;
  tags: string[]; visitCount: number; noShowCount: number; isBlacklisted: boolean;
  notes: string | null; createdAt: string;
  _count?: { reservations: number };
}

interface GuestDetail extends Guest {
  reservations: Array<{ id: string; date: string; time: string; partySize: number; status: string; tables: Array<{ table: { label: string } }> }>;
}

export function GuestsPage() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<GuestDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchGuests = async () => {
    setLoading(true);
    try {
      const q = search ? `&search=${encodeURIComponent(search)}` : '';
      const res = await apiFetch<{ data: Guest[]; meta: { total: number } }>(`/api/v1/guests?page=${page}&pageSize=20${q}`);
      setGuests(res.data || []);
      setTotal(res.meta?.total || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchGuests(); }, [page, search]);

  const openDetail = async (id: string) => {
    try {
      const res = await apiFetch<{ data: GuestDetail }>(`/api/v1/guests/${id}`);
      setDetail(res.data);
      setDetailOpen(true);
    } catch (err: any) { alert(err.message); }
  };

  const toggleBlacklist = async (id: string) => {
    try {
      await apiFetch(`/api/v1/guests/${id}/blacklist`, { method: 'PUT' });
      fetchGuests();
      if (detail?.id === id) {
        setDetail(d => d ? { ...d, isBlacklisted: !d.isBlacklisted } : null);
      }
    } catch (err: any) { alert(err.message); }
  };

  const pages = Math.ceil(total / 20);

  return (
    <div className="min-h-screen bg-[#F4F6F8]">
      <div className="max-w-[1400px] mx-auto px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-[22px] font-semibold text-[#1E293B] tracking-tight">Gosti</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">{total} gostov v bazi</p>
          </div>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input
              type="text"
              placeholder="Išči po imenu, emailu, telefonu..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 pr-4 py-2 rounded-lg border border-gray-100 bg-white text-[13px] outline-none w-72 focus:border-gray-200"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            />
          </div>
        </div>

        {/* Guests table */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
          {loading ? (
            <div className="p-6 space-y-3">
              {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-gray-50 rounded-lg animate-pulse" />)}
            </div>
          ) : guests.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              </div>
              <p className="text-[14px] font-medium text-[#1E293B] mb-1">{search ? 'Ni zadetkov' : 'Ni gostov'}</p>
              <p className="text-[12px] text-gray-400">{search ? 'Poskusite z drugim iskalnim nizom' : 'Gosti se ustvarijo ob rezervacijah'}</p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-50">
                    <th className="text-left px-6 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Gost</th>
                    <th className="text-left px-6 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Kontakt</th>
                    <th className="text-center px-6 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Obiskov</th>
                    <th className="text-center px-6 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">No-show</th>
                    <th className="text-left px-6 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Oznake</th>
                    <th className="text-right px-6 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Akcije</th>
                  </tr>
                </thead>
                <tbody>
                  {guests.map(g => (
                    <tr key={g.id} className="border-t border-gray-50 hover:bg-gray-50/40 transition-colors cursor-pointer" onClick={() => openDetail(g.id)}>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold ${
                            g.isBlacklisted ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-400'
                          }`}>
                            {g.isBlacklisted ? '⛔' : g.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-[#1E293B]">{g.name}</p>
                            {g.isBlacklisted && <p className="text-[10px] text-red-400">Črna lista</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <p className="text-[12px] text-gray-500">{g.email || '—'}</p>
                        <p className="text-[11px] text-gray-300">{g.phone || ''}</p>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span className="text-[13px] font-medium text-[#1E293B]">{g.visitCount || g._count?.reservations || 0}</span>
                      </td>
                      <td className="px-6 py-3 text-center">
                        {g.noShowCount > 0 ? (
                          <span className="text-[12px] font-medium text-red-500">{g.noShowCount}</span>
                        ) : (
                          <span className="text-[12px] text-gray-300">0</span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {(g.tags || []).map(t => (
                            <span key={t} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-100">{t}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={e => { e.stopPropagation(); toggleBlacklist(g.id); }}
                          className={`text-[10px] font-medium px-2 py-1 rounded transition-colors ${
                            g.isBlacklisted ? 'text-emerald-600 hover:bg-emerald-50' : 'text-gray-400 hover:bg-red-50 hover:text-red-500'
                          }`}
                        >
                          {g.isBlacklisted ? 'Odblokraj' : 'Blokiraj'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {pages > 1 && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-gray-50">
                  <span className="text-[11px] text-gray-400">Stran {page} od {pages}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-2.5 py-1 rounded text-[11px] font-medium text-gray-400 hover:bg-gray-50 disabled:opacity-30"
                    >← Nazaj</button>
                    <button
                      onClick={() => setPage(p => Math.min(pages, p + 1))}
                      disabled={page === pages}
                      className="px-2.5 py-1 rounded text-[11px] font-medium text-gray-400 hover:bg-gray-50 disabled:opacity-30"
                    >Naprej →</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail modal */}
        <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={detail?.name || 'Gost'} width="max-w-xl">
          {detail && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <InfoBox label="Email" value={detail.email || '—'} />
                <InfoBox label="Telefon" value={detail.phone || '—'} />
                <InfoBox label="Obiskov" value={String(detail.visitCount || 0)} />
                <InfoBox label="No-show" value={String(detail.noShowCount || 0)} highlight={detail.noShowCount > 0} />
              </div>

              {detail.tags?.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {detail.tags.map(t => (
                    <span key={t} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-100">{t}</span>
                  ))}
                </div>
              )}

              {detail.notes && <p className="text-[12px] text-gray-400 italic">"{detail.notes}"</p>}

              {/* Reservation history */}
              {detail.reservations?.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em] mb-2">Zgodovina rezervacij</p>
                  <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
                    {detail.reservations.map(r => (
                      <div key={r.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50/60">
                        <span className="text-[12px] text-gray-400 tabular-nums w-20">
                          {new Date(r.date).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' })}
                        </span>
                        <span className="text-[12px] font-medium text-[#1E293B] w-12 tabular-nums">{r.time}</span>
                        <span className="text-[11px] text-gray-400">{r.partySize} os.</span>
                        <span className="text-[11px] text-gray-300">{r.tables?.map(t => t.table?.label).join(', ') || ''}</span>
                        <span className={`ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded-full border uppercase tracking-wider ${
                          r.status === 'CONFIRMED' || r.status === 'COMPLETED' ? 'text-emerald-500 border-emerald-200' :
                          r.status === 'CANCELLED' || r.status === 'NO_SHOW' ? 'text-red-400 border-red-200' :
                          'text-gray-400 border-gray-200'
                        }`}>
                          {r.status === 'CONFIRMED' ? 'Potrjena' : r.status === 'COMPLETED' ? 'Zaključena' : r.status === 'CANCELLED' ? 'Preklicana' : r.status === 'NO_SHOW' ? 'No-show' : r.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => toggleBlacklist(detail.id)}
                  className={`px-4 py-2 rounded-lg text-[12px] font-medium transition-colors ${
                    detail.isBlacklisted ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-red-50 text-red-500 hover:bg-red-100'
                  }`}
                >{detail.isBlacklisted ? 'Odblokraj gosta' : 'Dodaj na črno listo'}</button>
                <button onClick={() => setDetailOpen(false)} className="flex-1 px-4 py-2 rounded-lg bg-gray-50 text-gray-500 text-[12px] font-medium hover:bg-gray-100 transition-colors">
                  Zapri
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}

function InfoBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-gray-50/60 rounded-lg px-3 py-2.5">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-[13px] font-medium ${highlight ? 'text-red-500' : 'text-[#1E293B]'}`}>{value}</p>
    </div>
  );
}
