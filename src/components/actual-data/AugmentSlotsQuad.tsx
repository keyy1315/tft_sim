'use client';
import type { AugmentId } from '@/lib/actualData/types';

type AugmentQuad = [AugmentId | undefined, AugmentId | undefined, AugmentId | undefined, AugmentId | undefined];

interface Props {
  augments: AugmentQuad;
  onChange: (augments: AugmentQuad) => void;
}

export default function AugmentSlotsQuad({ augments, onChange }: Props) {
  const updateSlot = (idx: number, v: string) => {
    const next = [...augments] as AugmentQuad;
    next[idx] = v.trim() || undefined;
    onChange(next);
  };
  return (
    <div className="flex gap-1">
      {[0, 1, 2, 3].map(i => (
        <input key={i}
          value={augments[i] ?? ''}
          onChange={e => updateSlot(i, e.target.value)}
          placeholder={i === 3 ? '은총' : `증강 ${i + 1}`}
          className={`border p-1 rounded text-xs w-20 ${i === 3 ? 'border-amber-400 bg-amber-50' : ''}`}
        />
      ))}
    </div>
  );
}
