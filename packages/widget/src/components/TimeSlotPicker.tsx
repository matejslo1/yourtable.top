import type { TimeSlot } from '../lib/api';

interface TimeSlotPickerProps {
  slots: TimeSlot[];
  selectedTime: string | null;
  onSelect: (time: string) => void;
  loading?: boolean;
}

export function TimeSlotPicker({ slots, selectedTime, onSelect, loading }: TimeSlotPickerProps) {
  if (loading) {
    return (
      <div className="yt-grid yt-grid-cols-3 sm:yt-grid-cols-4 yt-gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="yt-h-11 yt-rounded-lg yt-bg-surface-100 yt-animate-pulse-soft" />
        ))}
      </div>
    );
  }

  const available = slots.filter(s => s.available);
  const unavailable = slots.filter(s => !s.available);

  if (slots.length === 0) {
    return (
      <div className="yt-text-center yt-py-8 yt-text-surface-400">
        <p className="yt-text-sm">Za ta datum ni prostih terminov</p>
      </div>
    );
  }

  return (
    <div>
      {available.length > 0 && (
        <div className="yt-grid yt-grid-cols-3 sm:yt-grid-cols-4 yt-gap-2">
          {available.map(slot => {
            const isSelected = selectedTime === slot.time;
            const occupancy = slot.occupancyPercent;

            return (
              <button
                key={slot.time}
                onClick={() => onSelect(slot.time)}
                className={`
                  yt-relative yt-h-11 yt-rounded-lg yt-text-sm yt-font-medium
                  yt-transition-all yt-duration-150 yt-border
                  ${isSelected
                    ? 'yt-bg-brand-600 yt-text-white yt-border-brand-600 yt-shadow-md yt-shadow-brand-200'
                    : 'yt-bg-white yt-text-surface-700 yt-border-surface-200 hover:yt-border-brand-400 hover:yt-text-brand-700'
                  }
                `}
              >
                {slot.time}
                {/* Occupancy indicator */}
                {!isSelected && occupancy > 60 && (
                  <span className={`
                    yt-absolute yt-top-1 yt-right-1 yt-w-1.5 yt-h-1.5 yt-rounded-full
                    ${occupancy > 85 ? 'yt-bg-red-400' : 'yt-bg-amber-400'}
                  `} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {available.length === 0 && (
        <div className="yt-text-center yt-py-6 yt-text-surface-400">
          <p className="yt-text-sm">Vsi termini so zasedeni za izbrano število gostov</p>
          <p className="yt-text-xs yt-mt-1">Poskusite z drugačnim datumom ali manjšo skupino</p>
        </div>
      )}

      {/* Legend */}
      {available.length > 0 && (
        <div className="yt-flex yt-items-center yt-gap-4 yt-mt-3 yt-text-xs yt-text-surface-400">
          <span className="yt-flex yt-items-center yt-gap-1">
            <span className="yt-w-1.5 yt-h-1.5 yt-rounded-full yt-bg-amber-400" />
            Skoraj zasedeno
          </span>
          <span className="yt-flex yt-items-center yt-gap-1">
            <span className="yt-w-1.5 yt-h-1.5 yt-rounded-full yt-bg-red-400" />
            Zadnja mesta
          </span>
        </div>
      )}
    </div>
  );
}
