import { useState, useEffect } from 'react';

interface GuestFormProps {
  holdExpiresAt: string;
  onSubmit: (data: { guestName: string; guestEmail: string; guestPhone?: string; notes?: string }) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function GuestForm({ holdExpiresAt, onSubmit, onCancel, loading }: GuestFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);

  // Countdown timer
  useEffect(() => {
    const update = () => {
      const remaining = Math.max(0, Math.floor((new Date(holdExpiresAt).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [holdExpiresAt]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isUrgent = timeLeft < 120; // Less than 2 min
  const isExpired = timeLeft <= 0;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Ime je obvezno';
    if (!email.trim()) errs.email = 'E-mail je obvezen';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Neveljaven e-mail';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isExpired) return;
    onSubmit({
      guestName: name.trim(),
      guestEmail: email.trim(),
      guestPhone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="yt-space-y-4">
      {/* Countdown */}
      <div className={`
        yt-flex yt-items-center yt-justify-between yt-px-4 yt-py-2.5 yt-rounded-lg
        ${isExpired ? 'yt-bg-red-50 yt-text-red-700' : isUrgent ? 'yt-bg-amber-50 yt-text-amber-700' : 'yt-bg-brand-50 yt-text-brand-700'}
      `}>
        <span className="yt-text-sm yt-font-medium">
          {isExpired ? 'Čas za rezervacijo je potekel' : 'Vaša miza je rezervirana'}
        </span>
        {!isExpired && (
          <span className={`yt-font-display yt-font-bold yt-text-lg yt-tabular-nums ${isUrgent ? 'yt-animate-pulse-soft' : ''}`}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        )}
      </div>

      {isExpired && (
        <div className="yt-text-center yt-py-4">
          <p className="yt-text-sm yt-text-surface-500 yt-mb-3">Prosimo, začnite postopek znova</p>
          <button
            type="button"
            onClick={onCancel}
            className="yt-px-6 yt-py-2 yt-rounded-lg yt-bg-surface-900 yt-text-white yt-text-sm yt-font-medium hover:yt-bg-surface-800 yt-transition-colors"
          >
            Nazaj na izbiro termina
          </button>
        </div>
      )}

      {!isExpired && (
        <>
          {/* Name */}
          <div>
            <label className="yt-block yt-text-sm yt-font-medium yt-text-surface-700 yt-mb-1.5">
              Ime in priimek *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Janez Novak"
              className={`
                yt-w-full yt-px-3.5 yt-py-2.5 yt-rounded-lg yt-border yt-text-sm
                yt-transition-colors yt-outline-none
                ${errors.name ? 'yt-border-red-300 yt-bg-red-50' : 'yt-border-surface-200 focus:yt-border-brand-400 focus:yt-ring-2 focus:yt-ring-brand-100'}
              `}
            />
            {errors.name && <p className="yt-text-xs yt-text-red-500 yt-mt-1">{errors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="yt-block yt-text-sm yt-font-medium yt-text-surface-700 yt-mb-1.5">
              E-mail *
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="janez@email.com"
              className={`
                yt-w-full yt-px-3.5 yt-py-2.5 yt-rounded-lg yt-border yt-text-sm
                yt-transition-colors yt-outline-none
                ${errors.email ? 'yt-border-red-300 yt-bg-red-50' : 'yt-border-surface-200 focus:yt-border-brand-400 focus:yt-ring-2 focus:yt-ring-brand-100'}
              `}
            />
            {errors.email && <p className="yt-text-xs yt-text-red-500 yt-mt-1">{errors.email}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="yt-block yt-text-sm yt-font-medium yt-text-surface-700 yt-mb-1.5">
              Telefon <span className="yt-text-surface-400">(neobvezno)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+386 41 123 456"
              className="yt-w-full yt-px-3.5 yt-py-2.5 yt-rounded-lg yt-border yt-border-surface-200 yt-text-sm focus:yt-border-brand-400 focus:yt-ring-2 focus:yt-ring-brand-100 yt-outline-none yt-transition-colors"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="yt-block yt-text-sm yt-font-medium yt-text-surface-700 yt-mb-1.5">
              Opombe <span className="yt-text-surface-400">(alergije, posebne želje...)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Npr. alergija na gluten, otroški stol..."
              className="yt-w-full yt-px-3.5 yt-py-2.5 yt-rounded-lg yt-border yt-border-surface-200 yt-text-sm focus:yt-border-brand-400 focus:yt-ring-2 focus:yt-ring-brand-100 yt-outline-none yt-transition-colors yt-resize-none"
            />
          </div>

          {/* Actions */}
          <div className="yt-flex yt-gap-3 yt-pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="yt-flex-1 yt-py-2.5 yt-rounded-lg yt-border yt-border-surface-200 yt-text-sm yt-font-medium yt-text-surface-600 hover:yt-bg-surface-50 yt-transition-colors"
            >
              Prekliči
            </button>
            <button
              type="submit"
              disabled={loading}
              className="yt-flex-[2] yt-py-2.5 yt-rounded-lg yt-bg-brand-600 yt-text-white yt-text-sm yt-font-semibold hover:yt-bg-brand-700 yt-transition-colors disabled:yt-opacity-50 disabled:yt-cursor-not-allowed yt-shadow-sm"
            >
              {loading ? 'Potrjujem...' : 'Potrdi rezervacijo'}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
