import { useState, useEffect, useCallback } from 'react';
import { DatePicker } from './DatePicker';
import { TimeSlotPicker } from './TimeSlotPicker';
import { PartySizeSelector } from './PartySizeSelector';
import { GuestForm } from './GuestForm';
import { SuccessScreen } from './SuccessScreen';
import {
  fetchAvailability, createHold, completeHold, abandonHold,
  type DayAvailability, type HoldResponse,
} from '../lib/api';

type Step = 'select' | 'form' | 'success';

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
  const [error, setError] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');

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

    const cleanup = () => {
      abandonHold(tenantSlug, hold.reservationId, hold.sessionToken);
    };

    window.addEventListener('beforeunload', cleanup);
    return () => {
      window.removeEventListener('beforeunload', cleanup);
      // If component unmounts while hold is active, abandon it
      if (step === 'form') cleanup();
    };
  }, [hold, tenantSlug, step]);

  // Handle time selection -> create HOLD
  const handleTimeSelect = useCallback(async (time: string) => {
    if (!selectedDate) return;

    setSelectedTime(time);
    setLoadingHold(true);
    setError(null);

    try {
      const holdData = await createHold(tenantSlug, {
        date: selectedDate,
        time,
        partySize,
      });
      setHold(holdData);
      setStep('form');
    } catch (err: any) {
      setError(err.message || 'Termin ni več na voljo');
      setSelectedTime(null);
    } finally {
      setLoadingHold(false);
    }
  }, [selectedDate, partySize, tenantSlug]);

  // Handle form submission -> complete HOLD
  const handleFormSubmit = useCallback(async (data: {
    guestName: string;
    guestEmail: string;
    guestPhone?: string;
    notes?: string;
  }) => {
    if (!hold) return;

    setLoadingComplete(true);
    setError(null);

    try {
      await completeHold(tenantSlug, hold.reservationId, {
        ...data,
        sessionToken: hold.sessionToken,
      });
      setGuestName(data.guestName);
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Napaka pri potrjevanju rezervacije');
    } finally {
      setLoadingComplete(false);
    }
  }, [hold, tenantSlug]);

  // Cancel hold and go back
  const handleCancel = useCallback(() => {
    if (hold) {
      abandonHold(tenantSlug, hold.reservationId, hold.sessionToken);
    }
    setHold(null);
    setSelectedTime(null);
    setStep('select');
  }, [hold, tenantSlug]);

  // Reset everything
  const handleReset = () => {
    setStep('select');
    setPartySize(2);
    setSelectedDate(null);
    setSelectedTime(null);
    setAvailability(null);
    setHold(null);
    setError(null);
    setGuestName('');
  };

  const isDark = theme === 'dark';

  return (
    <div className={`yourtable-widget yt-max-w-md yt-mx-auto ${isDark ? 'yt-bg-surface-900 yt-text-white' : 'yt-bg-white'}`}>
      <div className="yt-rounded-2xl yt-border yt-border-surface-200 yt-shadow-lg yt-shadow-surface-900/5 yt-overflow-hidden">
        {/* Header */}
        <div className="yt-bg-surface-900 yt-px-6 yt-py-4">
          <h2 className="yt-font-display yt-text-lg yt-font-bold yt-text-white">
            Rezerviraj mizo
          </h2>
          <p className="yt-text-sm yt-text-surface-400 yt-mt-0.5">
            {step === 'select' && 'Izberi datum, čas in število gostov'}
            {step === 'form' && 'Vnesite vaše podatke'}
            {step === 'success' && 'Rezervacija potrjena'}
          </p>
        </div>

        {/* Content */}
        <div className="yt-p-6">
          {/* Error banner */}
          {error && (
            <div className="yt-mb-4 yt-px-4 yt-py-3 yt-rounded-lg yt-bg-red-50 yt-border yt-border-red-200 yt-animate-fade-in">
              <p className="yt-text-sm yt-text-red-700">{error}</p>
            </div>
          )}

          {/* Step 1: Selection */}
          {step === 'select' && (
            <div className="yt-space-y-6 yt-animate-fade-in">
              {/* Party size */}
              <div>
                <label className="yt-block yt-text-sm yt-font-semibold yt-text-surface-700 yt-mb-3">
                  Število gostov
                </label>
                <div className="yt-flex yt-justify-center">
                  <PartySizeSelector value={partySize} onChange={setPartySize} />
                </div>
              </div>

              {/* Date picker */}
              <div>
                <label className="yt-block yt-text-sm yt-font-semibold yt-text-surface-700 yt-mb-3">
                  Datum
                </label>
                <DatePicker
                  selectedDate={selectedDate}
                  onSelect={setSelectedDate}
                />
              </div>

              {/* Time slots */}
              {selectedDate && (
                <div className="yt-animate-slide-up">
                  <label className="yt-block yt-text-sm yt-font-semibold yt-text-surface-700 yt-mb-3">
                    Razpoložljivi termini
                  </label>

                  {availability?.isClosed ? (
                    <div className="yt-text-center yt-py-6 yt-text-surface-400">
                      <p className="yt-text-sm yt-font-medium">Zaprto</p>
                      {availability.specialNote && (
                        <p className="yt-text-xs yt-mt-1">{availability.specialNote}</p>
                      )}
                    </div>
                  ) : (
                    <TimeSlotPicker
                      slots={availability?.slots || []}
                      selectedTime={selectedTime}
                      onSelect={handleTimeSelect}
                      loading={loadingSlots}
                    />
                  )}
                </div>
              )}

              {/* Hold loading */}
              {loadingHold && (
                <div className="yt-flex yt-items-center yt-justify-center yt-gap-2 yt-py-4 yt-animate-fade-in">
                  <div className="yt-w-4 yt-h-4 yt-border-2 yt-border-brand-600 yt-border-t-transparent yt-rounded-full yt-animate-spin" />
                  <span className="yt-text-sm yt-text-surface-500">Rezerviram mizo...</span>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Guest form */}
          {step === 'form' && hold && (
            <div className="yt-animate-slide-up">
              {/* Selected summary */}
              <div className="yt-flex yt-items-center yt-gap-2 yt-text-sm yt-text-surface-500 yt-mb-5 yt-pb-4 yt-border-b yt-border-surface-100">
                <span className="yt-font-medium yt-text-surface-900">{selectedDate}</span>
                <span>·</span>
                <span className="yt-font-medium yt-text-surface-900">{selectedTime}</span>
                <span>·</span>
                <span>{partySize} {partySize === 1 ? 'gost' : partySize <= 4 ? 'gostje' : 'gostov'}</span>
                <span>·</span>
                <span className="yt-text-xs yt-text-brand-600">
                  {hold.assignedTables.map(t => t.label).join(', ')}
                </span>
              </div>

              <GuestForm
                holdExpiresAt={hold.holdExpiresAt}
                onSubmit={handleFormSubmit}
                onCancel={handleCancel}
                loading={loadingComplete}
              />
            </div>
          )}

          {/* Step 3: Success */}
          {step === 'success' && selectedDate && selectedTime && (
            <SuccessScreen
              date={selectedDate}
              time={selectedTime}
              partySize={partySize}
              guestName={guestName}
              onNewReservation={handleReset}
            />
          )}
        </div>

        {/* Footer */}
        <div className="yt-px-6 yt-py-3 yt-border-t yt-border-surface-100 yt-bg-surface-50">
          <p className="yt-text-[10px] yt-text-surface-400 yt-text-center">
            Powered by <span className="yt-font-semibold">YourTable</span>
          </p>
        </div>
      </div>
    </div>
  );
}
