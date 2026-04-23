'use client';
import type { HexModifier } from '@/lib/actualData/types';

export default function HexModifierOverlay({ modifiers }: { modifiers: HexModifier[] }) {
  if (modifiers.length === 0) return null;
  return (
    <div className="text-xs bg-yellow-50 border border-yellow-200 rounded p-1">
      <strong>야스오 칸:</strong>
      <ul className="ml-2">
        {modifiers.map((m, i) => (
          <li key={i}>
            ({m.hex.q},{m.hex.r}) {m.tileId} [stage {m.stageGranted}]
          </li>
        ))}
      </ul>
    </div>
  );
}
