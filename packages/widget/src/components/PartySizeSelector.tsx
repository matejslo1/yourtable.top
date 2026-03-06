interface PartySizeSelectorProps {
  value: number;
  onChange: (size: number) => void;
  min?: number;
  max?: number;
}

export function PartySizeSelector({ value, onChange, min = 1, max = 12 }: PartySizeSelectorProps) {
  return (
    <div className="yt-flex yt-items-center yt-gap-3">
      <button
        onClick={() => value > min && onChange(value - 1)}
        disabled={value <= min}
        className={`
          yt-w-10 yt-h-10 yt-rounded-full yt-flex yt-items-center yt-justify-center
          yt-border yt-transition-all yt-duration-150 yt-text-lg yt-font-medium
          ${value <= min
            ? 'yt-border-gray-200 yt-text-gray-300 yt-cursor-not-allowed'
            : 'yt-border-gray-300 yt-text-gray-600 hover:yt-border-emerald-400 hover:yt-text-emerald-600 hover:yt-bg-emerald-50'
          }
        `}
      >
        −
      </button>

      <div className="yt-flex yt-flex-col yt-items-center yt-min-w-[60px]">
        <span className="yt-text-2xl yt-font-display yt-font-bold yt-text-gray-900">{value}</span>
        <span className="yt-text-xs yt-text-gray-400 yt--mt-0.5">
          {value === 1 ? 'gost' : value <= 4 ? 'gostje' : 'gostov'}
        </span>
      </div>

      <button
        onClick={() => value < max && onChange(value + 1)}
        disabled={value >= max}
        className={`
          yt-w-10 yt-h-10 yt-rounded-full yt-flex yt-items-center yt-justify-center
          yt-border yt-transition-all yt-duration-150 yt-text-lg yt-font-medium
          ${value >= max
            ? 'yt-border-gray-200 yt-text-gray-300 yt-cursor-not-allowed'
            : 'yt-border-gray-300 yt-text-gray-600 hover:yt-border-emerald-400 hover:yt-text-emerald-600 hover:yt-bg-emerald-50'
          }
        `}
      >
        +
      </button>
    </div>
  );
}
