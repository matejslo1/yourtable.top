import { useState } from 'react';

interface WaitlistPromptProps {
  date: string;
  time: string;
  partySize: number;
  alternatives?: string[];
  onSelectAlternative: (time: string) => void;
  onJoinWaitlist: (data: { guestName: string; guestEmail: string; guestPhone?: string }) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function WaitlistPrompt({
  date, time, partySize, alternatives, onSelectAlternative, onJoinWaitlist, onCancel, loading,
}: WaitlistPromptProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Ime je obvezno';
    if (!email.trim()) errs.email = 'E-mail je obvezen';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Neveljaven e-mail';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onJoinWaitlist({
      guestName: name.trim(),
      guestEmail: email.trim(),
      guestPhone: phone.trim() || undefined,
    });
  };

  return (
    <div className="yt-animate-fade-in">
      {/* Alert */}
      <div className="yt-bg-amber-50 yt-border yt-border-amber-200 yt-rounded-xl yt-p-4 yt-mb-5">
        <div className="yt-flex yt-items-start yt-gap-3">
          <div className="yt-w-8 yt-h-8 yt-rounded-lg yt-bg-amber-100 yt-flex yt-items-center yt-justify-center yt-flex-shrink-0 yt-mt-0.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="yt-text-amber-600">
              <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <p className="yt-text-sm yt-font-semibold yt-text-amber-800">
              Za {time} ni prostih miz
            </p>
            <p className="yt-text-xs yt-text-amber-600 yt-mt-0.5">
              {partySize} {partySize === 1 ? 'oseba' : partySize <= 4 ? 'osebe' : 'oseb'} · {formatDateShort(date)}
            </p>
          </div>
        </div>
      </div>

      {/* Alternatives */}
      {alternatives && alternatives.length > 0 && (
        <div className="yt-mb-5">
          <p className="yt-text-sm yt-font-semibold yt-text-gray-700 yt-mb-2">
            Prosti termini:
          </p>
          <div className="yt-flex yt-flex-wrap yt-gap-2">
            {alternatives.map(alt => (
              <button
                key={alt}
                onClick={() => onSelectAlternative(alt)}
                className="yt-px-4 yt-py-2 yt-rounded-lg yt-border yt-border-emerald-200 yt-bg-emerald-50 yt-text-sm yt-font-medium yt-text-emerald-700 hover:yt-bg-emerald-100 hover:yt-border-emerald-300 yt-transition-colors"
              >
                {alt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="yt-flex yt-items-center yt-gap-3 yt-my-4">
        <div className="yt-flex-1 yt-h-px yt-bg-gray-200" />
        <span className="yt-text-xs yt-text-gray-400">ali</span>
        <div className="yt-flex-1 yt-h-px yt-bg-gray-200" />
      </div>

      {/* Waitlist CTA */}
      {!showForm ? (
        <div className="yt-text-center">
          <button
            onClick={() => setShowForm(true)}
            className="yt-w-full yt-py-3 yt-rounded-xl yt-bg-gray-900 yt-text-white yt-text-sm yt-font-semibold hover:yt-bg-gray-800 yt-transition-colors yt-shadow-sm"
          >
            Vpišite se na čakalno vrsto
          </button>
          <p className="yt-text-xs yt-text-gray-400 yt-mt-2">
            Obvestili vas bomo ko se sprosti mesto
          </p>
        </div>
      ) : (
        <div className="yt-space-y-3 yt-animate-fade-in">
          <p className="yt-text-sm yt-font-semibold yt-text-gray-700">Čakalna vrsta</p>
          <div>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ime in priimek *"
              className={`yt-w-full yt-px-3.5 yt-py-2.5 yt-rounded-lg yt-border yt-text-sm yt-outline-none yt-transition-colors ${errors.name ? 'yt-border-red-300 yt-bg-red-50' : 'yt-border-gray-200 focus:yt-border-emerald-400 focus:yt-ring-2 focus:yt-ring-emerald-100'}`} />
            {errors.name && <p className="yt-text-xs yt-text-red-500 yt-mt-1">{errors.name}</p>}
          </div>
          <div>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail *"
              className={`yt-w-full yt-px-3.5 yt-py-2.5 yt-rounded-lg yt-border yt-text-sm yt-outline-none yt-transition-colors ${errors.email ? 'yt-border-red-300 yt-bg-red-50' : 'yt-border-gray-200 focus:yt-border-emerald-400 focus:yt-ring-2 focus:yt-ring-emerald-100'}`} />
            {errors.email && <p className="yt-text-xs yt-text-red-500 yt-mt-1">{errors.email}</p>}
          </div>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Telefon (neobvezno)"
            className="yt-w-full yt-px-3.5 yt-py-2.5 yt-rounded-lg yt-border yt-border-gray-200 yt-text-sm yt-outline-none focus:yt-border-emerald-400 focus:yt-ring-2 focus:yt-ring-emerald-100 yt-transition-colors" />
          <div className="yt-flex yt-gap-3 yt-pt-1">
            <button onClick={onCancel} className="yt-flex-1 yt-py-2.5 yt-rounded-lg yt-border yt-border-gray-200 yt-text-sm yt-font-medium yt-text-gray-600 hover:yt-bg-gray-50 yt-transition-colors">
              Nazaj
            </button>
            <button onClick={handleSubmit} disabled={loading}
              className="yt-flex-[2] yt-py-2.5 yt-rounded-xl yt-bg-gray-900 yt-text-white yt-text-sm yt-font-semibold hover:yt-bg-gray-800 yt-transition-colors disabled:yt-opacity-50">
              {loading ? 'Prijavljam...' : 'Prijavite se'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}
