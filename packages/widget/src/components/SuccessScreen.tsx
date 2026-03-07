interface SuccessScreenProps {
  date: string;
  time: string;
  partySize: number;
  guestName: string;
  onNewReservation: () => void;
}

const DAYS_SL = ['nedelja', 'ponedeljek', 'torek', 'sreda', 'četrtek', 'petek', 'sobota'];
const MONTHS_SL = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december'];

function formatDateSl(dateStr: string): string {
  // Parse as local date to avoid UTC timezone offset shifting the day
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return `${DAYS_SL[d.getDay()]}, ${d.getDate()}. ${MONTHS_SL[d.getMonth()]} ${d.getFullYear()}`;
}

export function SuccessScreen({ date, time, partySize, guestName, onNewReservation }: SuccessScreenProps) {
  return (
    <div className="yt-text-center yt-py-6 yt-animate-fade-in">
      <div className="yt-w-16 yt-h-16 yt-mx-auto yt-mb-4 yt-rounded-full yt-bg-emerald-50 yt-flex yt-items-center yt-justify-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="yt-text-emerald-500">
          <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <h3 className="yt-font-display yt-text-xl yt-font-bold yt-text-gray-900 yt-mb-1">Rezervacija potrjena!</h3>
      <p className="yt-text-sm yt-text-gray-500 yt-mb-6">Potrditev je bila poslana na vaš e-mail</p>

      <div className="yt-bg-white yt-rounded-xl yt-border yt-border-gray-100 yt-p-5 yt-text-left yt-mb-6 yt-shadow-sm">
        <div className="yt-space-y-3">
          <div className="yt-flex yt-items-center yt-gap-3">
            <div className="yt-w-8 yt-h-8 yt-rounded-lg yt-bg-emerald-50 yt-flex yt-items-center yt-justify-center yt-flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="yt-text-emerald-500">
                <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
                <path d="M16 2V6M8 2V6M3 10H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p className="yt-text-xs yt-text-gray-400">Datum</p>
              <p className="yt-text-sm yt-font-medium yt-text-gray-900 yt-capitalize">{formatDateSl(date)}</p>
            </div>
          </div>

          <div className="yt-flex yt-items-center yt-gap-3">
            <div className="yt-w-8 yt-h-8 yt-rounded-lg yt-bg-emerald-50 yt-flex yt-items-center yt-justify-center yt-flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="yt-text-emerald-500">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p className="yt-text-xs yt-text-gray-400">Čas</p>
              <p className="yt-text-sm yt-font-medium yt-text-gray-900">{time}</p>
            </div>
          </div>

          <div className="yt-flex yt-items-center yt-gap-3">
            <div className="yt-w-8 yt-h-8 yt-rounded-lg yt-bg-emerald-50 yt-flex yt-items-center yt-justify-center yt-flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="yt-text-emerald-500">
                <path d="M17 21V19C17 16.7909 15.2091 15 13 15H5C2.79086 15 1 16.7909 1 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <div>
              <p className="yt-text-xs yt-text-gray-400">Gosti</p>
              <p className="yt-text-sm yt-font-medium yt-text-gray-900">{guestName} · {partySize} {partySize === 1 ? 'oseba' : partySize <= 4 ? 'osebe' : 'oseb'}</p>
            </div>
          </div>
        </div>
      </div>

      <button onClick={onNewReservation} className="yt-text-sm yt-text-emerald-600 yt-font-medium hover:yt-text-emerald-700 yt-transition-colors">
        Nova rezervacija
      </button>
    </div>
  );
}
