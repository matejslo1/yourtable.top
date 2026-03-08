import { useState, useEffect, useCallback } from 'react';
import { DatePicker } from './DatePicker';
import { TimeSlotPicker } from './TimeSlotPicker';
import { PartySizeSelector } from './PartySizeSelector';
import { GuestForm } from './GuestForm';
import { SuccessScreen } from './SuccessScreen';
import { WaitlistPrompt } from './WaitlistPrompt';
import {
  fetchAvailability, createHold, completeHold, abandonHold, joinWaitlist, fetchConfig,
  type DayAvailability, type HoldResponse,
} from '../lib/api';

type Step = 'select' | 'no-tables' | 'form' | 'success' | 'waitlist-success';

interface BookingWidgetProps {
  tenantSlug: string;
  theme?: 'light' | 'dark';
  accentColor?: string;
}

export function BookingWidget({ tenantSlug, theme = 'light' }: BookingWidgetProps) {
  const [step, setStep] = useState<Step>('select');
  const [partySize, setPartySize] = useState(2);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availability, setAvailability] = useState<DayAvailability | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [hold, setHold] = useState<HoldResponse | null>(null);
  const [loadingHold, setLoadingHold] = useState(false);
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [loadingWaitlist, setLoadingWaitlist] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [canWaitlist, setCanWaitlist] = useState(false);
  const [waitlistEnabledConfig, setWaitlistEnabledConfig] = useState(false);

  useEffect(() => {
    fetchConfig(tenantSlug)
      .then(cfg => setWaitlistEnabledConfig(!!cfg.waitlistEnabled))
      .catch(() => setWaitlistEnabledConfig(false));
  }, [tenantSlug]);

  // Fetch availability when date or party size changes
  useEffect(() => {
    if (!selectedDate) return;
    const load = async () => {
      setLoadingSlots(true);
      setError(null);
      setSelectedTime(null);
      try {
        const data = await fetchAvailability(tenantSlug, selectedDate, partySize);
        setAvailability(data);
      } catch (err: any) {
        setError(err.message || 'Napaka pri nalaganju terminov');
      } finally {
        setLoadingSlots(false);
      }
    };
    load();
  }, [selectedDate, partySize, tenantSlug]);

  // Abandon hold on unmount / page close
  useEffect(() => {
    if (!hold) return;
    const cleanup = () => abandonHold(tenantSlug, hold.reservationId, hold.sessionToken);
    window.addEventListener('beforeunload', cleanup);
    return () => {
      window.removeEventListener('beforeunload', cleanup);
      if (step === 'form') cleanup();
    };
  }, [hold, tenantSlug, step]);

  // Handle time selection → create HOLD
  const handleTimeSelect = useCallback(async (time: string) => {
    if (!selectedDate) return;
    setSelectedTime(time);
    setLoadingHold(true);
    setError(null);

    try {
      const holdData = await createHold(tenantSlug, { date: selectedDate, time, partySize });
      setHold(holdData);
      setStep('form');
    } catch (err: any) {
      const noTables = err.code === 'NO_TABLES' || /no tables available|ni prostih miz/i.test(err.message || '');
      if (noTables) {
        // No tables available — show waitlist prompt
        setCanWaitlist(err.canWaitlist ?? waitlistEnabledConfig);
        setAlternatives(err.alternatives || availability?.alternatives || []);
        setStep('no-tables');
        // NOTE: Do NOT null selectedTime here — WaitlistPrompt needs it
      } else {
        setError(err.message || 'Termin ni več na voljo');
        setSelectedTime(null);
      }
    } finally {
      setLoadingHold(false);
    }
  }, [selectedDate, partySize, tenantSlug, availability, waitlistEnabledConfig]);

  // Handle alternative time selection
  const handleAlternative = useCallback(async (time: string) => {
    setStep('select');
    setSelectedTime(null);
    handleTimeSelect(time);
  }, [handleTimeSelect]);

  // Handle waitlist join
  const handleJoinWaitlist = useCallback(async (data: { guestName: string; guestEmail: string; guestPhone?: string }) => {
    if (!selectedDate || !selectedTime) return;
    setLoadingWaitlist(true);
    try {
      await joinWaitlist(tenantSlug, {
        date: selectedDate, time: selectedTime, partySize,
        ...data,
      });
      setGuestName(data.guestName);
      setStep('waitlist-success');
    } catch (err: any) {
      setError(err.message || 'Napaka pri prijavi na čakalno vrsto');
    } finally {
      setLoadingWaitlist(false);
    }
  }, [selectedDate, selectedTime, partySize, tenantSlug]);

  // Handle form submission → complete HOLD
  const handleFormSubmit = useCallback(async (data: {
    guestName: string; guestEmail: string; guestPhone?: string; notes?: string;
  }) => {
    if (!hold) return;
    setLoadingComplete(true);
    setError(null);
    try {
      await completeHold(tenantSlug, hold.reservationId, { ...data, sessionToken: hold.sessionToken });
      setGuestName(data.guestName);
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Napaka pri potrjevanju rezervacije');
    } finally {
      setLoadingComplete(false);
    }
  }, [hold, tenantSlug]);

  const handleCancel = useCallback(() => {
    if (hold) abandonHold(tenantSlug, hold.reservationId, hold.sessionToken);
    setHold(null);
    setSelectedTime(null);
    setStep('select');
  }, [hold, tenantSlug]);

  const handleReset = () => {
    setStep('select'); setPartySize(2); setSelectedDate(null); setSelectedTime(null);
    setAvailability(null); setHold(null); setError(null); setGuestName(''); setAlternatives([]);
  };

  return (
    <div className="yourtable-widget yt-max-w-md yt-mx-auto yt-font-body">
      <div className="yt-rounded-2xl yt-border yt-border-gray-100 yt-shadow-lg yt-shadow-gray-900/5 yt-overflow-hidden yt-bg-white">

        {/* Header — Pro light theme */}
        <div className="yt-px-6 yt-py-4 yt-border-b yt-border-gray-100">
          <h2 className="yt-font-display yt-text-lg yt-font-bold yt-text-gray-900">
            Rezerviraj mizo
          </h2>
          <p className="yt-text-sm yt-text-gray-400 yt-mt-0.5">
            {step === 'select' && 'Izberi datum, čas in število gostov'}
            {step === 'no-tables' && 'Ni prostih miz za ta termin'}
            {step === 'form' && 'Vnesite vaše podatke'}
            {step === 'success' && 'Rezervacija potrjena'}
            {step === 'waitlist-success' && 'Prijavljeni na čakalno vrsto'}
          </p>
        </div>

        {/* Content */}
        <div className="yt-p-6 yt-bg-[#F8F9FA]">
          {/* Error banner */}
          {error && (
            <div className="yt-mb-4 yt-px-4 yt-py-3 yt-rounded-xl yt-bg-red-50 yt-border yt-border-red-200 yt-animate-fade-in">
              <p className="yt-text-sm yt-text-red-700">{error}</p>
            </div>
          )}

          {/* Step 1: Selection */}
          {step === 'select' && (
            <div className="yt-space-y-5 yt-animate-fade-in">
              <div>
                <label className="yt-block yt-text-sm yt-font-semibold yt-text-gray-700 yt-mb-3">Število gostov</label>
                <div className="yt-flex yt-justify-center">
                  <PartySizeSelector value={partySize} onChange={setPartySize} />
                </div>
              </div>

              <div>
                <label className="yt-block yt-text-sm yt-font-semibold yt-text-gray-700 yt-mb-3">Datum</label>
                <div className="yt-bg-white yt-rounded-xl yt-p-3 yt-border yt-border-gray-100 yt-shadow-sm">
                  <DatePicker selectedDate={selectedDate} onSelect={setSelectedDate} />
                </div>
              </div>

              {selectedDate && (
                <div className="yt-animate-slide-up">
                  <label className="yt-block yt-text-sm yt-font-semibold yt-text-gray-700 yt-mb-3">Razpoložljivi termini</label>
                  {availability?.isClosed ? (
                    <div className="yt-text-center yt-py-6 yt-bg-white yt-rounded-xl yt-border yt-border-gray-100">
                      <p className="yt-text-sm yt-font-medium yt-text-gray-500">Zaprto</p>
                      {availability.specialNote && <p className="yt-text-xs yt-text-gray-400 yt-mt-1">{availability.specialNote}</p>}
                    </div>
                  ) : (
                    <TimeSlotPicker slots={availability?.slots || []} selectedTime={selectedTime} onSelect={handleTimeSelect} loading={loadingSlots} />
                  )}
                </div>
              )}

              {loadingHold && (
                <div className="yt-flex yt-items-center yt-justify-center yt-gap-2 yt-py-4 yt-animate-fade-in">
                  <div className="yt-w-4 yt-h-4 yt-border-2 yt-border-emerald-500 yt-border-t-transparent yt-rounded-full yt-animate-spin" />
                  <span className="yt-text-sm yt-text-gray-500">Rezerviram mizo...</span>
                </div>
              )}
            </div>
          )}

          {/* No tables — waitlist prompt */}
          {step === 'no-tables' && selectedDate && selectedTime && (
            <WaitlistPrompt
              date={selectedDate}
              time={selectedTime}
              partySize={partySize}
              alternatives={alternatives}
              canWaitlist={canWaitlist}
              onSelectAlternative={handleAlternative}
              onJoinWaitlist={handleJoinWaitlist}
              onCancel={handleCancel}
              loading={loadingWaitlist}
            />
          )}

          {/* Step 2: Guest form */}
          {step === 'form' && hold && (
            <div className="yt-animate-slide-up">
              <div className="yt-flex yt-items-center yt-gap-2 yt-text-sm yt-text-gray-500 yt-mb-5 yt-pb-4 yt-border-b yt-border-gray-100">
                <span className="yt-font-medium yt-text-gray-900">{selectedDate}</span>
                <span>·</span>
                <span className="yt-font-medium yt-text-gray-900">{selectedTime}</span>
                <span>·</span>
                <span>{partySize} {partySize === 1 ? 'gost' : partySize <= 4 ? 'gostje' : 'gostov'}</span>
              </div>
              <GuestForm holdExpiresAt={hold.holdExpiresAt} onSubmit={handleFormSubmit} onCancel={handleCancel} loading={loadingComplete} />
            </div>
          )}

          {/* Success */}
          {step === 'success' && selectedDate && selectedTime && (
            <SuccessScreen date={selectedDate} time={selectedTime} partySize={partySize} guestName={guestName} onNewReservation={handleReset} />
          )}

          {/* Waitlist success */}
          {step === 'waitlist-success' && (
            <div className="yt-text-center yt-py-6 yt-animate-fade-in">
              <div className="yt-w-16 yt-h-16 yt-mx-auto yt-mb-4 yt-rounded-full yt-bg-emerald-50 yt-flex yt-items-center yt-justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="yt-text-emerald-500">
                  <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="yt-font-display yt-text-xl yt-font-bold yt-text-gray-900 yt-mb-1">Na čakalni vrsti!</h3>
              <p className="yt-text-sm yt-text-gray-500 yt-mb-6">Obvestili vas bomo ko se sprosti mesto za {selectedTime}</p>
              <button onClick={handleReset} className="yt-text-sm yt-text-emerald-600 yt-font-medium hover:yt-text-emerald-700 yt-transition-colors">
                Nova rezervacija
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="yt-px-6 yt-py-3 yt-border-t yt-border-gray-100 yt-bg-white">
          <p className="yt-text-[10px] yt-text-gray-400 yt-text-center">
            Powered by <span className="yt-font-semibold yt-text-gray-500">YourTable</span>
          </p>
        </div>
      </div>
    </div>
  );
}

