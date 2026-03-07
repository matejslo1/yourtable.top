import { useState, useEffect } from 'react';
import { Modal, Input, Select, Button } from '../ui';
import { apiFetch } from '@/lib/auth';

interface Reservation {
  id: string;
  date: string;
  time: string;
  partySize: number;
  durationMinutes: number;
  notes: string | null;
  internalNotes: string | null;
  status: string;
  source: string;
  guest: { id: string; name: string; email: string; phone: string };
  tables: Array<{ table: { id: string; label: string } }>;
}

interface EditReservationModalProps {
  open: boolean;
  reservation: Reservation | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditReservationModal({ open, reservation, onClose, onUpdated }: EditReservationModalProps) {
  const [form, setForm] = useState({
    date: '',
    time: '',
    partySize: '2',
    durationMinutes: '90',
    notes: '',
    internalNotes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (reservation) {
      setForm({
        date: reservation.date,
        time: reservation.time,
        partySize: String(reservation.partySize),
        durationMinutes: String(reservation.durationMinutes),
        notes: reservation.notes || '',
        internalNotes: reservation.internalNotes || '',
      });
      setError('');
    }
  }, [reservation]);

  const update = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    if (!reservation || !form.date || !form.time) { setError('Datum in čas sta obvezna'); return; }
    setLoading(true);
    setError('');
    try {
      await apiFetch(`/api/v1/reservations/${reservation.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          date: form.date,
          time: form.time,
          partySize: parseInt(form.partySize),
          durationMinutes: parseInt(form.durationMinutes),
          notes: form.notes || undefined,
          internalNotes: form.internalNotes || undefined,
        }),
      });
      onUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Napaka pri posodabljanju rezervacije');
    } finally {
      setLoading(false);
    }
  };

  if (!reservation) return null;

  return (
    <Modal open={open} onClose={onClose} title="Uredi rezervacijo" width="max-w-xl">
      <div className="space-y-5">
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Guest info (read-only) */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Gost</h3>
          <div className="bg-gray-50/60 rounded-lg px-4 py-3">
            <p className="text-[13px] font-medium text-[#1E293B]">{reservation.guest?.name}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{reservation.guest?.email || ''} {reservation.guest?.phone ? `· ${reservation.guest.phone}` : ''}</p>
          </div>
        </div>

        {/* Reservation details */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Rezervacija</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Datum *" type="date" value={form.date} onChange={e => update('date', e.target.value)} />
            <Input label="Čas *" type="time" value={form.time} onChange={e => update('time', e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Število gostov *</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { const v = Math.max(1, parseInt(form.partySize) - 1); update('partySize', String(v)); }}
                  className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"
                >−</button>
                <span className="w-12 text-center font-display text-xl font-bold">{form.partySize}</span>
                <button
                  type="button"
                  onClick={() => { const v = Math.min(50, parseInt(form.partySize) + 1); update('partySize', String(v)); }}
                  className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"
                >+</button>
              </div>
            </div>
            <Select
              label="Trajanje"
              value={form.durationMinutes}
              onChange={e => update('durationMinutes', e.target.value)}
              options={[
                { value: '60', label: '1 ura' },
                { value: '90', label: '1.5 ure' },
                { value: '120', label: '2 uri' },
                { value: '150', label: '2.5 ure' },
                { value: '180', label: '3 ure' },
              ]}
            />
          </div>
        </div>

        {/* Current tables (read-only) */}
        {reservation.tables?.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Dodeljene mize</p>
            <div className="flex gap-2 flex-wrap">
              {reservation.tables.map(t => (
                <span key={t.table.id} className="text-[12px] font-medium px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {t.table.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Opombe</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Opombe gosta</label>
              <textarea
                value={form.notes}
                onChange={e => update('notes', e.target.value)}
                rows={2}
                placeholder="Alergije, posebne želje..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Interne opombe</label>
              <textarea
                value={form.internalNotes}
                onChange={e => update('internalNotes', e.target.value)}
                rows={2}
                placeholder="Opombe za osebje..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose} className="flex-1">Prekliči</Button>
          <Button onClick={handleSubmit} loading={loading} className="flex-[2]">
            Shrani spremembe
          </Button>
        </div>
      </div>
    </Modal>
  );
}
