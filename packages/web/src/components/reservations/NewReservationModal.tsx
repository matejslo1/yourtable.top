import { useState } from 'react';
import { Modal, Input, Select, Button } from '../ui';
import { apiFetch } from '@/lib/auth';

interface NewReservationModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  defaultDate?: string;
}

export function NewReservationModal({ open, onClose, onCreated, defaultDate }: NewReservationModalProps) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    date: defaultDate || today,
    time: '19:00',
    partySize: '2',
    durationMinutes: '90',
    source: 'manual',
    notes: '',
    internalNotes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    if (!form.guestName.trim()) { setError('Ime gosta je obvezno'); return; }
    if (!form.date || !form.time) { setError('Datum in čas sta obvezna'); return; }

    setLoading(true);
    setError('');

    try {
      await apiFetch('/api/v1/reservations', {
        method: 'POST',
        body: JSON.stringify({
          guestName: form.guestName,
          guestEmail: form.guestEmail || undefined,
          guestPhone: form.guestPhone || undefined,
          date: form.date,
          time: form.time,
          partySize: parseInt(form.partySize),
          durationMinutes: parseInt(form.durationMinutes),
          source: form.source,
          notes: form.notes || undefined,
          internalNotes: form.internalNotes || undefined,
        }),
      });
      onCreated();
      onClose();
      // Reset form
      setForm({
        guestName: '', guestEmail: '', guestPhone: '',
        date: defaultDate || today, time: '19:00', partySize: '2',
        durationMinutes: '90', source: 'manual', notes: '', internalNotes: '',
      });
    } catch (err: any) {
      setError(err.message || 'Napaka pri ustvarjanju rezervacije');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nova rezervacija" width="max-w-xl">
      <div className="space-y-5">
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Guest info */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Podatki gosta</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Ime in priimek *"
              value={form.guestName}
              onChange={e => update('guestName', e.target.value)}
              placeholder="Janez Novak"
            />
            <Input
              label="E-mail"
              type="email"
              value={form.guestEmail}
              onChange={e => update('guestEmail', e.target.value)}
              placeholder="janez@email.com"
            />
            <Input
              label="Telefon"
              type="tel"
              value={form.guestPhone}
              onChange={e => update('guestPhone', e.target.value)}
              placeholder="+386 41 123 456"
            />
            <Select
              label="Vir"
              value={form.source}
              onChange={e => update('source', e.target.value)}
              options={[
                { value: 'manual', label: 'Ročno' },
                { value: 'phone', label: 'Telefon' },
                { value: 'walk_in', label: 'Walk-in' },
                { value: 'online', label: 'Online' },
              ]}
            />
          </div>
        </div>

        {/* Reservation details */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Rezervacija</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Datum *"
              type="date"
              value={form.date}
              onChange={e => update('date', e.target.value)}
            />
            <Input
              label="Čas *"
              type="time"
              value={form.time}
              onChange={e => update('time', e.target.value)}
            />
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
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Interne opombe</label>
              <textarea
                value={form.internalNotes}
                onChange={e => update('internalNotes', e.target.value)}
                rows={2}
                placeholder="Opombe za osebje..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose} className="flex-1">Prekliči</Button>
          <Button onClick={handleSubmit} loading={loading} className="flex-[2]">
            Ustvari rezervacijo
          </Button>
        </div>
      </div>
    </Modal>
  );
}
