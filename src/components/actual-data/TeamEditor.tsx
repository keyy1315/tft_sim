'use client';
import type { TeamSnapshot } from '@/lib/actualData/types';
import AugmentSlotsQuad from './AugmentSlotsQuad';
import GraceStatus from './GraceStatus';
import HexModifierOverlay from './HexModifierOverlay';

interface Props {
  label: string;
  team: TeamSnapshot;
  onChange: (team: TeamSnapshot) => void;
  showGrace?: { roundIndex: number };
}

/**
 * Team info bar — level, HP, augments × 4, hex modifiers, grace status.
 * Unit placement lives on the hex board (ActualBoard); this component is
 * the compact top/bottom strip around it.
 */
export default function TeamEditor({ label, team, onChange, showGrace }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-gray-100">
      <h3 className="font-semibold text-sm whitespace-nowrap">{label}</h3>

      <label className="flex items-center gap-1 text-xs">
        <span className="text-gray-300">Lv</span>
        <input type="number" min={1} max={10} value={team.level}
          onChange={e => onChange({ ...team, level: Number(e.target.value) })}
          className="border border-gray-700 bg-gray-900 text-gray-100 p-1 rounded w-14 text-sm" />
      </label>
      <label className="flex items-center gap-1 text-xs">
        <span className="text-gray-300">HP</span>
        <input type="number" min={0} value={team.hp}
          onChange={e => onChange({ ...team, hp: Number(e.target.value) })}
          className="border border-gray-700 bg-gray-900 text-gray-100 p-1 rounded w-16 text-sm" />
      </label>

      <AugmentSlotsQuad
        augments={team.augments}
        onChange={augments => onChange({ ...team, augments })}
        stacks={team.augmentStacks}
        onStacksChange={s => onChange({ ...team, augmentStacks: s })}
      />

      <HexModifierOverlay modifiers={team.hexModifiers} />

      {showGrace && <GraceStatus currentRoundIndex={showGrace.roundIndex} />}
    </div>
  );
}
