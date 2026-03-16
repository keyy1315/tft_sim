'use client';

interface StarSelectorProps {
  starLevel: number;
  onChange: (level: number) => void;
}

export default function StarSelector({ starLevel, onChange }: StarSelectorProps) {
  return (
    <div className="flex gap-1.5 items-center">
      {[1, 2, 3].map((level) => (
        <button
          key={level}
          onClick={() => onChange(level)}
          className={`px-2 py-1 rounded text-xs font-medium transition-all ${
            starLevel === level
              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
              : 'bg-[#1f2937] text-gray-500 hover:text-yellow-400 border border-transparent'
          }`}
        >
          {'★'.repeat(level)}
        </button>
      ))}
    </div>
  );
}
