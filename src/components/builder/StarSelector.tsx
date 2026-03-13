'use client';

interface StarSelectorProps {
  starLevel: number;
  onChange: (level: number) => void;
}

export default function StarSelector({ starLevel, onChange }: StarSelectorProps) {
  return (
    <div className="flex gap-2 items-center">
      <span className="text-sm text-gray-400">성급:</span>
      {[1, 2, 3].map((level) => (
        <button
          key={level}
          onClick={() => onChange(level)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            starLevel === level
              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
              : 'bg-[#1f2937] text-gray-400 hover:text-yellow-400 border border-transparent'
          }`}
        >
          {'★'.repeat(level)}
        </button>
      ))}
    </div>
  );
}
