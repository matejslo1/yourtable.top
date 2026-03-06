import { useState, useMemo } from 'react';

interface DatePickerProps {
  selectedDate: string | null;
  onSelect: (date: string) => void;
  minDate?: Date;
  maxDate?: Date;
}

const DAYS_SL = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned'];
const MONTHS_SL = ['Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij', 'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December'];

export function DatePicker({ selectedDate, onSelect, minDate, maxDate }: DatePickerProps) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  const min = minDate || today;
  const max = maxDate || new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);

  const days = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const result: Array<{ date: Date; inMonth: boolean; disabled: boolean }> = [];

    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth, -i);
      result.push({ date: d, inMonth: false, disabled: true });
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(viewYear, viewMonth, i);
      const disabled = d < new Date(min.getFullYear(), min.getMonth(), min.getDate()) || d > max;
      result.push({ date: d, inMonth: true, disabled });
    }

    const remaining = 7 - (result.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const d = new Date(viewYear, viewMonth + 1, i);
        result.push({ date: d, inMonth: false, disabled: true });
      }
    }

    return result;
  }, [viewMonth, viewYear, min, max]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  const isToday = (d: Date) => formatDate(d) === formatDate(today);
  const isSelected = (d: Date) => selectedDate === formatDate(d);

  return (
    <div className="yt-select-none">
      <div className="yt-flex yt-items-center yt-justify-between yt-mb-4">
        <button onClick={prevMonth}
          className="yt-w-9 yt-h-9 yt-flex yt-items-center yt-justify-center yt-rounded-full hover:yt-bg-gray-100 yt-transition-colors yt-text-gray-500">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span className="yt-font-display yt-font-semibold yt-text-gray-900">{MONTHS_SL[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth}
          className="yt-w-9 yt-h-9 yt-flex yt-items-center yt-justify-center yt-rounded-full hover:yt-bg-gray-100 yt-transition-colors yt-text-gray-500">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      <div className="yt-grid yt-grid-cols-7 yt-mb-1">
        {DAYS_SL.map(d => (
          <div key={d} className="yt-text-center yt-text-xs yt-font-medium yt-text-gray-400 yt-py-1">{d}</div>
        ))}
      </div>

      <div className="yt-grid yt-grid-cols-7 yt-gap-0.5">
        {days.map(({ date, inMonth, disabled }, i) => (
          <button
            key={i}
            disabled={disabled}
            onClick={() => !disabled && onSelect(formatDate(date))}
            className={`
              yt-w-full yt-aspect-square yt-flex yt-items-center yt-justify-center
              yt-rounded-lg yt-text-sm yt-transition-all yt-duration-150
              ${!inMonth ? 'yt-text-gray-200' : ''}
              ${disabled && inMonth ? 'yt-text-gray-300 yt-cursor-not-allowed' : ''}
              ${!disabled && inMonth && !isSelected(date) ? 'yt-text-gray-700 hover:yt-bg-emerald-50 hover:yt-text-emerald-700 yt-cursor-pointer' : ''}
              ${isSelected(date) ? 'yt-bg-emerald-600 yt-text-white yt-font-semibold yt-shadow-sm' : ''}
              ${isToday(date) && !isSelected(date) ? 'yt-ring-1 yt-ring-emerald-300 yt-font-semibold' : ''}
            `}
          >
            {date.getDate()}
          </button>
        ))}
      </div>
    </div>
  );
}
