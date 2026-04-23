'use client';
import type { PlacedUnit, TeamSnapshot } from '@/lib/actualData/types';
import AugmentSlotsQuad from './AugmentSlotsQuad';
import HexModifierOverlay from './HexModifierOverlay';

interface Props {
  label: string;
  team: TeamSnapshot;
  onChange: (team: TeamSnapshot) => void;
}

export default function TeamEditor({ label, team, onChange }: Props) {
  const updateUnit = (index: number, patch: Partial<PlacedUnit>) => {
    onChange({
      ...team,
      units: team.units.map((u, j) => (j === index ? { ...u, ...patch } : u)),
    });
  };

  const addUnit = () => {
    const newUnit: PlacedUnit = {
      championId: '',
      hex: { q: 0, r: 0 },
      starLevel: 1,
      items: [undefined, undefined, undefined],
    };
    onChange({ ...team, units: [...team.units, newUnit] });
  };

  const removeUnit = (index: number) => {
    onChange({ ...team, units: team.units.filter((_, j) => j !== index) });
  };

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

      <div className="border rounded p-2 space-y-1 text-xs">
        <div className="flex justify-between items-center">
          <span className="font-semibold">유닛 배치</span>
          <button
            type="button"
            onClick={addUnit}
            className="text-blue-600 underline"
          >
            + 유닛 추가
          </button>
        </div>
        {team.units.length === 0 && (
          <p className="text-gray-500">유닛이 없습니다.</p>
        )}
        {team.units.map((u, i) => (
          <div key={i} className="flex gap-1 items-center">
            <input
              value={u.championId}
              onChange={e => updateUnit(i, { championId: e.target.value })}
              placeholder="championId"
              className="border p-0.5 w-28"
            />
            <input
              type="number"
              value={u.hex.q}
              onChange={e => updateUnit(i, { hex: { ...u.hex, q: Number(e.target.value) } })}
              className="border p-0.5 w-12"
              placeholder="q"
            />
            <input
              type="number"
              value={u.hex.r}
              onChange={e => updateUnit(i, { hex: { ...u.hex, r: Number(e.target.value) } })}
              className="border p-0.5 w-12"
              placeholder="r"
            />
            <select
              value={u.starLevel}
              onChange={e => updateUnit(i, { starLevel: Number(e.target.value) as 1 | 2 | 3 })}
              className="border p-0.5"
            >
              <option value={1}>★</option>
              <option value={2}>★★</option>
              <option value={3}>★★★</option>
            </select>
            <button
              type="button"
              onClick={() => removeUnit(i)}
              className="text-red-600"
              aria-label="유닛 제거"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
