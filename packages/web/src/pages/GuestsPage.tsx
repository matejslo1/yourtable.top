import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';
import { Badge, Button, Input, Modal, EmptyState } from '@/components/ui';

interface Guest {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tags: string[];
  visitCount: number;
  noShowCount: number;
  isBlacklisted: boolean;
  notes: string | null;
  createdAt: string;
  _count: { reservations: number };
}

interface GuestDetail extends Guest {
  reservations: Array<{
    id: string;
    date: string;
    time: string;
    partySize: number;
    status: string;
    source: string;
    notes: string | null;
    tables: Array<{ table: { label: string } }>;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: 'success', COMPLETED: 'default', CANCELLED: 'danger',
  NO_SHOW: 'danger', SEATED: 'purple', PENDING: 'info', HOLD: 'warning',
};

export function GuestsPage() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedGuest, setSelectedGuest] = useState<GuestDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', email: '', phone: '', tags: '' });
  const [newLoading, setNewLoading] = useState(false);

  const fetchGuests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (search) params.set('search', search);
      const res = await apiFetch<{ data: Guest[]; meta: { total: number } }>(`/api/v1/guests?${params}`);
      setGuests(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGuests(); }, [page, search]);

  const openDetail = async (id: string) => {
    try {
      const res = await apiFetch<{ data: GuestDetail }>(`/api/v1/guests/${id}`);
      setSelectedGuest(res.data);
      setDetailOpen(true);
    } catch (err) { console.error(err); }
  };

  const toggleBlacklist = async (id: string) => {
    try {
      await apiFetch(`/api/v1/guests/${id}/blacklist`, { method: 'PUT' });
      fetchGuests();
      if (selectedGuest?.id === id) {
        const res = await apiFetch<{ data: GuestDetail }>(`/api/v1/guests/${id}`);
        setSelectedGuest(res.data);
      }
    } catch (err) { console.error(err); }
  };

  const createGuest = async () => {
    if (!newForm.name.trim()) return;
    setNewLoading(true);
    try {
      await apiFetch('/api/v1/guests', {
        method: 'POST',
        body: JSON.stringify({
          name: newForm.name,
          email: newForm.email || null,
          phone: newForm.phone || null,
          tags: newForm.tags ? newForm.tags.split(',').map(t => t.trim()) : [],
        }),
      });
      setNewOpen(false);
      setNewForm({ name: '', email: '', phone: '', tags: '' });
      fetchGuests();
    } catch (err) { console.error(err); }
    finally { setNewLoading(false); }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Gosti</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} gostov v bazi</p>
        </div>
        <Button onClick={() => setNewOpen(true)}>+ Nov gost</Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <Input
          placeholder="Iskanje po imenu, emailu ali telefonu..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="max-w-md"
        />
      </div>

      {/* Guest list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : guests.length === 0 ? (
        <EmptyState
          icon="👥"
          title="Ni najdenih gostov"
          description={search ? 'Poskusite z drugačnim iskalnim nizom' : 'Dodajte prvega gosta'}
          action={!search ? { label: '+ Nov gost', onClick: () => setNewOpen(true) } : undefined}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Gost</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Kontakt</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Obiski</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">No-show</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Oznake</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {guests.map(guest => (
                <tr
                  key={guest.id}
                  className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-colors"
                  onClick={() => openDetail(guest.id)}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">
                        {guest.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {guest.name}
                          {guest.isBlacklisted && <span className="ml-2 text-red-500 text-xs">⛔</span>}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-sm text-gray-600">{guest.email || '—'}</p>
                    <p className="text-xs text-gray-400">{guest.phone || ''}</p>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="text-sm font-medium text-gray-900">{guest.visitCount}</span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`text-sm font-medium ${guest.noShowCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {guest.noShowCount}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-1 flex-wrap">
                      {(guest.tags || []).map(tag => (
                        <Badge key={tag} variant={tag === 'VIP' ? 'success' : 'default'}>{tag}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-gray-300">›</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
              <span className="text-sm text-gray-500">Stran {page} od {totalPages}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}>‹ Nazaj</Button>
                <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}>Naprej ›</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Guest detail modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={selectedGuest?.name || ''} width="max-w-2xl">
        {selectedGuest && (
          <div className="space-y-6">
            {/* Info grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400">E-mail</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{selectedGuest.email || '—'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400">Telefon</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{selectedGuest.phone || '—'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400">Obiski / No-show</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">
                  {selectedGuest.visitCount} / <span className={selectedGuest.noShowCount > 0 ? 'text-red-600' : ''}>{selectedGuest.noShowCount}</span>
                </p>
              </div>
            </div>

            {/* Tags */}
            <div className="flex items-center gap-2 flex-wrap">
              {(selectedGuest.tags || []).map(tag => (
                <Badge key={tag} variant={tag === 'VIP' ? 'success' : 'default'} size="md">{tag}</Badge>
              ))}
              <Button
                variant={selectedGuest.isBlacklisted ? 'danger' : 'ghost'}
                size="sm"
                onClick={() => toggleBlacklist(selectedGuest.id)}
              >
                {selectedGuest.isBlacklisted ? '⛔ Odstrani s črne liste' : '⛔ Črna lista'}
              </Button>
            </div>

            {/* Reservation history */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Zgodovina rezervacij</h3>
              {selectedGuest.reservations.length === 0 ? (
                <p className="text-sm text-gray-400">Ni preteklih rezervacij</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {selectedGuest.reservations.map(res => (
                    <div key={res.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {new Date(res.date).toLocaleDateString('sl-SI')} ob {res.time}
                          </p>
                          <p className="text-xs text-gray-400">
                            {res.partySize} oseb · {res.tables.map(t => t.table.label).join(', ')} · {res.source}
                          </p>
                        </div>
                      </div>
                      <Badge variant={(STATUS_COLORS[res.status] || 'default') as any}>{res.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* New guest modal */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Nov gost">
        <div className="space-y-4">
          <Input label="Ime in priimek *" value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} placeholder="Janez Novak" />
          <Input label="E-mail" type="email" value={newForm.email} onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))} placeholder="janez@email.com" />
          <Input label="Telefon" type="tel" value={newForm.phone} onChange={e => setNewForm(f => ({ ...f, phone: e.target.value }))} placeholder="+386 41 123 456" />
          <Input label="Oznake (ločene z vejico)" value={newForm.tags} onChange={e => setNewForm(f => ({ ...f, tags: e.target.value }))} placeholder="VIP, alergija-gluten" />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setNewOpen(false)} className="flex-1">Prekliči</Button>
            <Button onClick={createGuest} loading={newLoading} className="flex-[2]">Ustvari gosta</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
