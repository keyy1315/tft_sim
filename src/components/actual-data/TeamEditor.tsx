'use client';
import type { TeamSnapshot } from '@/lib/actualData/types';
import AugmentSlotsQuad from './AugmentSlotsQuad';
import HexModifierOverlay from './HexModifierOverlay';

interface Props {
  label: string;
  team: TeamSnapshot;
  onChange: (team: TeamSnapshot) => void;
}

export default function TeamEditor({ label, team, onChange }: Props) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">{label}</h3>

      <div className="flex gap-2">
        <label className="flex flex-col">
          <span className="text-xs">Level</span>
          <input type="number" min={1} max={10} value={team.level}
            onChange={e => onChange({ ...team, level: Number(e.target.value) })}
            className="border p-1 rounded w-16 text-sm" />
        </label>
        <label className="flex flex-col">
          <span className="text-xs">HP</span>
          <input type="number" min={0} value={team.hp}
            onChange={e => onChange({ ...team, hp: Number(e.target.value) })}
            className="border p-1 rounded w-20 text-sm" />
        </label>
      </div>

      <AugmentSlotsQuad
        augments={team.augments}
        onChange={augments => onChange({ ...team, augments })}
      />

      <HexModifierOverlay modifiers={team.hexModifiers} />

      <div className="border rounded p-2 text-xs text-gray-500">
        유닛 배치 보드 (SetupBoardCore 통합은 Task 17에서 수행).
        현재 유닛 수: {team.units.length}
      </div>
    </div>
  );
}
