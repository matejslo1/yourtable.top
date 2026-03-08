import { useState, useEffect, useCallback } from 'react';
import { DatePicker } from './DatePicker';
import { TimeSlotPicker } from './TimeSlotPicker';
import { PartySizeSelector } from './PartySizeSelector';
import { GuestForm } from './GuestForm';
import { SuccessScreen } from './SuccessScreen';
import { WaitlistPrompt } from './WaitlistPrompt';
import {
  fetchAvailability,
  createHold,
  completeHold,
  abandonHold,
  joinWaitlist,
  fetchConfig,
  type DayAvailability,
  type HoldResponse,
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

  const [areas, setAreas] = useState<string[]>([]);
  const [servicePeriods, setServicePeriods] = useState<string[]>([]);
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedServicePeriod, setSelectedServicePeriod] = useState('');
  const [specialOccasion, setSpecialOccasion] = useState('');

  const [depositInfo, setDepositInfo] = useState<{ amount: number; type: string } | null>(null);
  const [depositAccepted, setDepositAccepted] = useState(false);
  const [pendingTimeForDeposit, setPendingTimeForDeposit] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig(tenantSlug)
      .then(cfg => {
        setWaitlistEnabledConfig(!!cfg.waitlistEnabled);
        setAreas(cfg.areas || []);
        setServicePeriods(cfg.servicePeriods || []);
      })
      .catch(() => setWaitlistEnabledConfig(false));
  }, [tenantSlug]);

  useEffect(() => {
    if (!selectedDate) return;
    const load = async () => {
      setLoadingSlots(true);
      setError(null);
      setSelectedTime(null);
      try {
        const data = await fetchAvailability(tenantSlug, selectedDate, partySize, selectedArea || undefined);
        setAvailability(data);
      } catch (err: any) {
        setError(err.message || 'Napaka pri nalaganju terminov');
      } finally {
        setLoadingSlots(false);
      }
    };
    load();
  }, [selectedDate, partySize, tenantSlug, selectedArea]);

  useEffect(() => {
    if (!hold) return;
    const cleanup = () => abandonHold(tenantSlug, hold.reservationId, hold.sessionToken);
    window.addEventListener('beforeunload', cleanup);
    return () => {
      window.removeEventListener('beforeunload', cleanup);
      if (step === 'form') cleanup();
    };
  }, [hold, tenantSlug, step]);

  const handleTimeSelect = useCallback(async (time: string) => {
    if (!selectedDate) return;
    setSelectedTime(time);
    setLoadingHold(true);
    setError(null);
    setDepositInfo(null);
    setPendingTimeForDeposit(null);

    try {
      const holdData = await createHold(tenantSlug, {
        date: selectedDate,
        time,
        partySize,
        area: selectedArea || undefined,
        servicePeriod: selectedServicePeriod || undefined,
        specialOccasion: specialOccasion || undefined,
        depositAccepted: depositAccepted || undefined,
      });
      setHold(holdData);
      setStep('form');
    } catch (err: any) {
      if (err.code === 'DepositRequired') {
        setDepositInfo(err.deposit || null);
        setPendingTimeForDeposit(time);
        setSelectedTime(null);
        return;
      }

      const noTables = err.code === 'NO_TABLES' || /no tables available|ni prostih miz/i.test(err.message || '');
      if (noTables) {
        setCanWaitlist(err.canWaitlist ?? waitlistEnabledConfig);
        setAlternatives(err.alternatives || availability?.alternatives || []);
        setStep('no-tables');
      } else {
        setError(err.message || 'Termin ni vec na voljo');
        setSelectedTime(null);
      }
    } finally {
      setLoadingHold(false);
    }
  }, [
    availability,
    depositAccepted,
    partySize,
    selectedArea,
    selectedDate,
    selectedServicePeriod,
    specialOccasion,
    tenantSlug,
    waitlistEnabledConfig,
  ]);

  const handleAlternative = useCallback(async (time: string) => {
    setStep('select');
    setSelectedTime(null);
    handleTimeSelect(time);
  }, [handleTimeSelect]);

  const handleJoinWaitlist = useCallback(async (data: { guestName: string; guestEmail: string; guestPhone?: string }) => {
    if (!selectedDate || !selectedTime) return;
    setLoadingWaitlist(true);
    try {
      await joinWaitlist(tenantSlug, {
        date: selectedDate,
        time: selectedTime,
        partySize,
        ...data,
      });
      setGuestName(data.guestName);
      setStep('waitlist-success');
    } catch (err: any) {
      setError(err.message || 'Napaka pri prijavi na cakalno vrsto');
    } finally {
      setLoadingWaitlist(false);
    }
  }, [selectedDate, selectedTime, partySize, tenantSlug]);

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
        specialOccasion: specialOccasion || undefined,
      });
      setGuestName(data.guestName);
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Napaka pri potrjevanju rezervacije');
    } finally {
      setLoadingComplete(false);
    }
  }, [hold, specialOccasion, tenantSlug]);

  const handleCancel = useCallback(() => {
    if (hold) abandonHold(tenantSlug, hold.reservationId, hold.sessionToken);
    setHold(null);
    setSelectedTime(null);
    setStep('select');
  }, [hold, tenantSlug]);

  const handleReset = () => {
    setStep('select');
    setPartySize(2);
    setSelectedDate(null);
    setSelectedTime(null);
    setAvailability(null);
    setHold(null);
    setError(null);
    setGuestName('');
    setAlternatives([]);
    setSelectedArea('');
    setSelectedServicePeriod('');
    setSpecialOccasion('');
    setDepositInfo(null);
    setDepositAccepted(false);
    setPendingTimeForDeposit(null);
  };

  return (
    <div className="yourtable-widget yt-max-w-md yt-mx-auto yt-font-body">
      <div className="yt-rounded-2xl yt-border yt-border-gray-100 yt-shadow-lg yt-shadow-gray-900/5 yt-overflow-hidden yt-bg-white">
        <div className="yt-px-6 yt-py-4 yt-border-b yt-border-gray-100">
          <h2 className="yt-font-display yt-text-lg yt-font-bold yt-text-gray-900">Rezerviraj mizo</h2>
          <p className="yt-text-sm yt-text-gray-400 yt-mt-0.5">
            {step === 'select' && 'Izberi datum, cas in stevilo gostov'}
            {step === 'no-tables' && 'Ni prostih miz za ta termin'}
            {step === 'form' && 'Vnesite vase podatke'}
            {step === 'success' && 'Rezervacija potrjena'}
            {step === 'waitlist-success' && 'Prijavljeni na cakalno vrsto'}
          </p>
        </div>

        <div className="yt-p-6 yt-bg-[#F8F9FA]">
          {error && (
            <div className="yt-mb-4 yt-px-4 yt-py-3 yt-rounded-xl yt-bg-red-50 yt-border yt-border-red-200 yt-animate-fade-in">
              <p className="yt-text-sm yt-text-red-700">{error}</p>
            </div>
          )}

          {step === 'select' && (
            <div className="yt-space-y-5 yt-animate-fade-in">
              <div>
                <label className="yt-block yt-text-sm yt-font-semibold yt-text-gray-700 yt-mb-3">Stevilo gostov</label>
                <div className="yt-flex yt-justify-center">
                  <PartySizeSelector value={partySize} onChange={setPartySize} />
                </div>
              </div>

              {areas.length > 0 && (
                <div>
                  <label className="yt-block yt-text-sm yt-font-semibold yt-text-gray-700 yt-mb-2">Obmocje</label>
                  <select
                    value={selectedArea}
                    onChange={e => setSelectedArea(e.target.value)}
                    className="yt-w-full yt-px-3.5 yt-py-2.5 yt-rounded-xl yt-border yt-border-gray-200 yt-bg-white yt-text-sm"
                  >
                    <option value="">Vsa obmocja</option>
                    {areas.map(area => <option key={area} value={area}>{area}</option>)}
                  </select>
                </div>
              )}

              {servicePeriods.length > 0 && (
                <div>
                  <label className="yt-block yt-text-sm yt-font-semibold yt-text-gray-700 yt-mb-2">Service period</label>
                  <select
                    value={selectedServicePeriod}
                    onChange={e => setSelectedServicePeriod(e.target.value)}
                    className="yt-w-full yt-px-3.5 yt-py-2.5 yt-rounded-xl yt-border yt-border-gray-200 yt-bg-white yt-text-sm"
                  >
                    <option value="">Poljuben</option>
                    {servicePeriods.map(period => <option key={period} value={period}>{period}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="yt-block yt-text-sm yt-font-semibold yt-text-gray-700 yt-mb-2">Posebna priloznost</label>
                <input
                  value={specialOccasion}
                  onChange={e => setSpecialOccasion(e.target.value)}
                  placeholder="Npr. rojstni dan"
                  className="yt-w-full yt-px-3.5 yt-py-2.5 yt-rounded-xl yt-border yt-border-gray-200 yt-bg-white yt-text-sm"
                />
              </div>

              <div>
                <label className="yt-block yt-text-sm yt-font-semibold yt-text-gray-700 yt-mb-3">Datum</label>
                <div className="yt-bg-white yt-rounded-xl yt-p-3 yt-border yt-border-gray-100 yt-shadow-sm">
                  <DatePicker selectedDate={selectedDate} onSelect={setSelectedDate} />
                </div>
              </div>

              {selectedDate && (
                <div className="yt-animate-slide-up">
                  <label className="yt-block yt-text-sm yt-font-semibold yt-text-gray-700 yt-mb-3">Razpolozljivi termini</label>
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

              {depositInfo && pendingTimeForDeposit && (
                <div className="yt-rounded-xl yt-border yt-border-amber-200 yt-bg-amber-50 yt-p-4 yt-space-y-2">
                  <p className="yt-text-sm yt-font-semibold yt-text-amber-800">Za termin {pendingTimeForDeposit} je potreben depozit.</p>
                  <p className="yt-text-xs yt-text-amber-700">
                    Znesek: {depositInfo.amount} {depositInfo.type === 'percent' ? '%' : 'EUR'}
                  </p>
                  <label className="yt-flex yt-items-center yt-gap-2 yt-text-xs yt-text-amber-800">
                    <input
                      type="checkbox"
                      checked={depositAccepted}
                      onChange={e => setDepositAccepted(e.target.checked)}
                    />
                    Potrjujem depozit
                  </label>
                  <button
                    type="button"
                    disabled={!depositAccepted || loadingHold}
                    onClick={() => handleTimeSelect(pendingTimeForDeposit)}
                    className="yt-w-full yt-py-2 yt-rounded-lg yt-bg-amber-600 yt-text-white yt-text-sm yt-font-semibold disabled:yt-opacity-50"
                  >
                    Nadaljuj z depozitom
                  </button>
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

          {step === 'form' && hold && (
            <div className="yt-animate-slide-up">
              <div className="yt-flex yt-items-center yt-gap-2 yt-text-sm yt-text-gray-500 yt-mb-5 yt-pb-4 yt-border-b yt-border-gray-100">
                <span className="yt-font-medium yt-text-gray-900">{selectedDate}</span>
                <span>&middot;</span>
                <span className="yt-font-medium yt-text-gray-900">{selectedTime}</span>
                <span>&middot;</span>
                <span>{partySize} gostov</span>
              </div>
              <GuestForm holdExpiresAt={hold.holdExpiresAt} onSubmit={handleFormSubmit} onCancel={handleCancel} loading={loadingComplete} />
            </div>
          )}

          {step === 'success' && selectedDate && selectedTime && (
            <SuccessScreen date={selectedDate} time={selectedTime} partySize={partySize} guestName={guestName} onNewReservation={handleReset} />
          )}

          {step === 'waitlist-success' && (
            <div className="yt-text-center yt-py-6 yt-animate-fade-in">
              <div className="yt-w-16 yt-h-16 yt-mx-auto yt-mb-4 yt-rounded-full yt-bg-emerald-50 yt-flex yt-items-center yt-justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="yt-text-emerald-500">
                  <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="yt-font-display yt-text-xl yt-font-bold yt-text-gray-900 yt-mb-1">Na cakalni vrsti!</h3>
              <p className="yt-text-sm yt-text-gray-500 yt-mb-6">Obvestili vas bomo ko se sprosti mesto za {selectedTime}</p>
              <button onClick={handleReset} className="yt-text-sm yt-text-emerald-600 yt-font-medium hover:yt-text-emerald-700 yt-transition-colors">
                Nova rezervacija
              </button>
            </div>
          )}
        </div>

        <div className="yt-px-6 yt-py-3 yt-border-t yt-border-gray-100 yt-bg-white">
          <p className="yt-text-[10px] yt-text-gray-400 yt-text-center">
            Powered by <span className="yt-font-semibold yt-text-gray-500">YourTable</span>
          </p>
        </div>
      </div>
    </div>
  );
}