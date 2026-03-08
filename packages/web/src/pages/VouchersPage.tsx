import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';
import { Badge, Button, Input, Select, Modal, EmptyState } from '@/components/ui';

interface Voucher {
  id: string;
  code: string;
  name: string;
  status: string;
  type: string;
  initialValue: number;
  remainingValue: number;
  validFrom: string;
  validUntil: string;
  deliveryMethod: string;
  dedication: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  buyerName: string;
  buyerEmail: string;
  createdAt: string;
  _count: { transactions: number };
}

interface VoucherStats {
  total: number;
  active: number;
  redeemed: number;
  expired: number;
  cancelled: number;
  totalIssuedValue: number;
  totalRedeemedValue: number;
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }> = {
  active: { label: 'Aktiven', variant: 'success' },
  used: { label: 'Porabljen', variant: 'default' },
  expired: { label: 'Potekel', variant: 'warning' },
  cancelled: { label: 'Preklican', variant: 'danger' },
};

export function VouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [stats, setStats] = useState<VoucherStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '', value: '50', validDays: '365',
    deliveryMethod: 'email', dedication: '',
    recipientName: '', recipientEmail: '',
    buyerName: '', buyerEmail: '',
  });
  const [createLoading, setCreateLoading] = useState(false);

  // Validate/Redeem modal
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemResult, setRedeemResult] = useState<any>(null);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);

  // Detail modal
  const [detailVoucher, setDetailVoucher] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);

      const [vRes, sRes] = await Promise.all([
        apiFetch<{ data: Voucher[]; meta: { total: number } }>(`/api/v1/vouchers?${params}`),
        apiFetch<{ data: VoucherStats }>('/api/v1/vouchers/stats'),
      ]);
      setVouchers(vRes.data);
      setTotal(vRes.meta.total);
      setStats(sRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchVouchers(); }, [page, statusFilter, search]);

  const handleCreate = async () => {
    if (!createForm.buyerName || !createForm.buyerEmail || !createForm.value) {
      alert('Ime kupca, email kupca in vrednost so obvezni');
      return;
    }
    setCreateLoading(true);
    try {
      await apiFetch('/api/v1/vouchers', {
        method: 'POST',
        body: JSON.stringify({
          name: createForm.name || `Darilni bon ${createForm.value} EUR`,
          value: parseFloat(createForm.value),
          validDays: parseInt(createForm.validDays),
          deliveryMethod: createForm.deliveryMethod,
          dedication: createForm.dedication || undefined,
          recipientName: createForm.recipientName || undefined,
          recipientEmail: createForm.recipientEmail || undefined,
          buyerName: createForm.buyerName,
          buyerEmail: createForm.buyerEmail,
        }),
      });
      setCreateOpen(false);
      setCreateForm({ name: '', value: '50', validDays: '365', deliveryMethod: 'email', dedication: '', recipientName: '', recipientEmail: '', buyerName: '', buyerEmail: '' });
      fetchVouchers();
    } catch (err: any) { alert(err.message); }
    finally { setCreateLoading(false); }
  };

  const handleValidate = async () => {
    if (!redeemCode.trim()) return;
    setRedeemLoading(true);
    try {
      const res = await apiFetch<{ data: any }>('/api/v1/vouchers/validate', {
        method: 'POST',
        body: JSON.stringify({ code: redeemCode.trim() }),
      });
      setRedeemResult(res.data);
    } catch (err: any) { alert(err.message); }
    finally { setRedeemLoading(false); }
  };

  const handleRedeem = async () => {
    if (!redeemAmount) { alert('Vnesite znesek'); return; }
    setRedeemLoading(true);
    try {
      const normalizedAmount = redeemAmount.replace(',', '.').trim();
      await apiFetch('/api/v1/vouchers/redeem', {
        method: 'POST',
        body: JSON.stringify({ code: redeemCode.trim(), amount: normalizedAmount }),
      });
      setRedeemOpen(false);
      setRedeemCode('');
      setRedeemResult(null);
      setRedeemAmount('');
      fetchVouchers();
    } catch (err: any) { alert(err.message); }
    finally { setRedeemLoading(false); }
  };

  const openDetail = async (id: string) => {
    try {
      const res = await apiFetch<{ data: any }>(`/api/v1/vouchers/${id}`);
      setDetailVoucher(res.data);
      setDetailOpen(true);
    } catch (err) { console.error(err); }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Ste prepričani da želite preklicati ta bon?')) return;
    try {
      await apiFetch(`/api/v1/vouchers/${id}/cancel`, { method: 'PUT' });
      fetchVouchers();
      setDetailOpen(false);
    } catch (err: any) { alert(err.message); }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Darilni boni</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} bonov</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setRedeemOpen(true)}>🔍 Preveri bon</Button>
          <Button onClick={() => setCreateOpen(true)}>+ Nov bon</Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-2xl font-display font-bold text-gray-900">{stats.active}</p>
            <p className="text-xs text-gray-500">Aktivnih</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-2xl font-display font-bold text-gray-900">{stats.redeemed}</p>
            <p className="text-xs text-gray-500">Porabljenih</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-2xl font-display font-bold text-gray-900">{stats.expired}</p>
            <p className="text-xs text-gray-500">Poteklih</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-2xl font-display font-bold text-gray-900">{stats.totalIssuedValue.toFixed(0)} €</p>
            <p className="text-xs text-gray-500">Izdano</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <p className="text-2xl font-display font-bold text-gray-900">{stats.totalRedeemedValue.toFixed(0)} €</p>
            <p className="text-xs text-gray-500">Porabljeno</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <Input placeholder="Iskanje po kodi, imenu..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="max-w-xs" />
        <Select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          options={[
            { value: '', label: 'Vsi statusi' },
            { value: 'active', label: 'Aktivni' },
            { value: 'used', label: 'Porabljeni' },
            { value: 'expired', label: 'Potekli' },
            { value: 'cancelled', label: 'Preklicani' },
          ]}
          className="w-auto"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : vouchers.length === 0 ? (
        <EmptyState icon="🎁" title="Ni darilnih bonov" description="Ustvarite prvi darilni bon" action={{ label: '+ Nov bon', onClick: () => setCreateOpen(true) }} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Koda</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Ime</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Vrednost</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Kupec</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Prejemnik</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Velja do</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map(v => {
                const statusInfo = STATUS_MAP[v.status] || { label: v.status, variant: 'default' as const };
                return (
                  <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer" onClick={() => openDetail(v.id)}>
                    <td className="px-5 py-3.5"><span className="font-mono text-sm font-bold text-gray-900">{v.code}</span></td>
                    <td className="px-5 py-3.5"><span className="text-sm text-gray-600">{v.name}</span></td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-gray-900">{Number(v.initialValue)} €</span>
                      {Number(v.remainingValue) < Number(v.initialValue) && (
                        <span className="text-xs text-gray-400 ml-1">(ostane {Number(v.remainingValue)} €)</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5"><span className="text-sm text-gray-600">{v.buyerName}</span></td>
                    <td className="px-5 py-3.5"><span className="text-sm text-gray-600">{v.recipientName || '—'}</span></td>
                    <td className="px-5 py-3.5"><Badge variant={statusInfo.variant}>{statusInfo.label}</Badge></td>
                    <td className="px-5 py-3.5"><span className="text-sm text-gray-500">{new Date(v.validUntil).toLocaleDateString('sl-SI')}</span></td>
                    <td className="px-5 py-3.5 text-right"><span className="text-gray-300">›</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
              <span className="text-sm text-gray-500">Stran {page} od {totalPages}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}>‹</Button>
                <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}>›</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nov darilni bon" width="max-w-xl">
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Vrednost</h3>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Vrednost (EUR) *" type="number" value={createForm.value} onChange={e => setCreateForm(f => ({ ...f, value: e.target.value }))} />
              <Input label="Veljavnost (dni)" type="number" value={createForm.validDays} onChange={e => setCreateForm(f => ({ ...f, validDays: e.target.value }))} />
            </div>
            <div className="mt-3">
              <Input label="Ime bona" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="npr. Darilni bon 50 EUR (neobvezno)" />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Kupec *</h3>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Ime kupca *" value={createForm.buyerName} onChange={e => setCreateForm(f => ({ ...f, buyerName: e.target.value }))} placeholder="Janez Novak" />
              <Input label="Email kupca *" type="email" value={createForm.buyerEmail} onChange={e => setCreateForm(f => ({ ...f, buyerEmail: e.target.value }))} placeholder="janez@email.com" />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Prejemnik</h3>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Ime prejemnika" value={createForm.recipientName} onChange={e => setCreateForm(f => ({ ...f, recipientName: e.target.value }))} placeholder="Ana Novak" />
              <Input label="Email prejemnika" type="email" value={createForm.recipientEmail} onChange={e => setCreateForm(f => ({ ...f, recipientEmail: e.target.value }))} placeholder="ana@email.com" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Posvetilo</label>
            <textarea
              value={createForm.dedication}
              onChange={e => setCreateForm(f => ({ ...f, dedication: e.target.value }))}
              rows={2}
              placeholder="Vse najboljše za rojstni dan!"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand-400 resize-none"
            />
          </div>
          <Select
            label="Dostava"
            value={createForm.deliveryMethod}
            onChange={e => setCreateForm(f => ({ ...f, deliveryMethod: e.target.value }))}
            options={[
              { value: 'email', label: '📧 Email' },
              { value: 'print', label: '🖨️ Tisk' },
              { value: 'pickup', label: '🏪 Prevzem' },
              { value: 'delivery', label: '📦 Dostava' },
            ]}
          />
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setCreateOpen(false)} className="flex-1">Prekliči</Button>
            <Button onClick={handleCreate} loading={createLoading} className="flex-[2]">Ustvari bon</Button>
          </div>
        </div>
      </Modal>

      {/* Validate / Redeem modal */}
      <Modal open={redeemOpen} onClose={() => { setRedeemOpen(false); setRedeemResult(null); setRedeemCode(''); setRedeemAmount(''); }} title="Preveri & Uveljavi bon">
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                label="Koda bona"
                value={redeemCode}
                onChange={e => setRedeemCode(e.target.value.toUpperCase())}
                placeholder="YT-XXXX-XXXX"
                className="font-mono"
                onKeyDown={e => { if (e.key === 'Enter') handleValidate(); }}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleValidate} loading={redeemLoading} variant="secondary">Preveri</Button>
            </div>
          </div>

          {redeemResult && (
            <div className={`rounded-xl p-4 ${redeemResult.valid ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
              {redeemResult.valid ? (
                <>
                  <p className="text-sm font-medium text-emerald-700 mb-2">✅ Bon je veljaven</p>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>Ime: {redeemResult.voucher.name}</p>
                    <p>Preostanek: <strong>{redeemResult.voucher.remainingValue} EUR</strong></p>
                    <p>Kupec: {redeemResult.voucher.buyerName}</p>
                    {redeemResult.voucher.recipientName && <p>Prejemnik: {redeemResult.voucher.recipientName}</p>}
                  </div>
                  <div className="mt-3">
                    <Input label={`Znesek za uveljavitev (max ${redeemResult.voucher.remainingValue} EUR)`} type="number" value={redeemAmount} onChange={e => setRedeemAmount(e.target.value)} placeholder="npr. 35.00" />
                  </div>
                  <Button onClick={handleRedeem} loading={redeemLoading} className="mt-3 w-full">Uveljavi bon</Button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-red-700 mb-1">❌ Bon ni veljaven</p>
                  {redeemResult.issues.map((issue: string, i: number) => (
                    <p key={i} className="text-sm text-red-600">• {issue}</p>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={`Bon ${detailVoucher?.code || ''}`} width="max-w-2xl">
        {detailVoucher && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400">Vrednost</p>
                <p className="text-sm font-medium">{Number(detailVoucher.initialValue)} EUR</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400">Preostanek</p>
                <p className="text-sm font-medium">{Number(detailVoucher.remainingValue)} EUR</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400">Velja do</p>
                <p className="text-sm font-medium">{new Date(detailVoucher.validUntil).toLocaleDateString('sl-SI')}</p>
              </div>
            </div>

            {detailVoucher.dedication && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Posvetilo</p>
                <p className="text-sm italic text-gray-600">"{detailVoucher.dedication}"</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-gray-400">Kupec</p><p className="text-sm">{detailVoucher.buyerName} ({detailVoucher.buyerEmail})</p></div>
              <div><p className="text-xs text-gray-400">Prejemnik</p><p className="text-sm">{detailVoucher.recipientName || '—'} {detailVoucher.recipientEmail ? `(${detailVoucher.recipientEmail})` : ''}</p></div>
            </div>

            {/* Transaction history */}
            {detailVoucher.transactions?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Zgodovina transakcij</h3>
                <div className="space-y-2">
                  {detailVoucher.transactions.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg text-sm">
                      <div>
                        <span className={t.type === 'purchase' ? 'text-emerald-600' : t.type === 'redemption' ? 'text-blue-600' : 'text-amber-600'}>
                          {t.type === 'purchase' ? '💰 Nakup' : t.type === 'redemption' ? '🎫 Uveljavitev' : '↩️ Vračilo'}
                        </span>
                        {t.notes && <span className="text-gray-400 ml-2">— {t.notes}</span>}
                      </div>
                      <span className="font-medium">{Number(t.amount)} EUR</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detailVoucher.status === 'active' && (
              <Button variant="danger" size="sm" onClick={() => handleCancel(detailVoucher.id)}>Prekliči bon</Button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
