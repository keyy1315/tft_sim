'use client';
import type { YasuoTileId, YasuoTilePlacement, HexCoord } from '@/lib/actualData/types';

const TILE_BY_STAGE: Record<2 | 3 | 4, YasuoTileId[]> = {
  2: ['solar', 'cryo', 'starlight', 'accel', 'storm', 'cosmic'],
  3: ['solar', 'cryo', 'starlight', 'accel', 'storm'],
  4: ['solar', 'cryo', 'starlight', 'accel', 'storm'],
};

interface Props {
  stage: 2 | 3 | 4;
  value?: YasuoTilePlacement;
  onChange: (placement: YasuoTilePlacement | undefined) => void;
}

export default function YasuoTilePicker({ stage, value, onChange }: Props) {
  const tileOptions = TILE_BY_STAGE[stage];

  function setTileId(id: YasuoTileId) {
    onChange({ hex: value?.hex ?? { q: 0, r: 0 }, tileId: id });
  }
  function setHex(part: Partial<HexCoord>) {
    if (!value) {
      onChange({ hex: { q: part.q ?? 0, r: part.r ?? 0 }, tileId: tileOptions[0] });
      return;
    }
    onChange({ ...value, hex: { ...value.hex, ...part } });
  }

  return (
    <div className="border border-gray-700 rounded p-2 space-y-2 text-gray-100">
      <label className="flex items-center gap-2 text-sm">
        <span className="text-gray-300">칸:</span>
        <select value={value?.tileId ?? ''} onChange={e => setTileId(e.target.value as YasuoTileId)}
          className="border border-gray-700 bg-gray-900 text-gray-100 p-1 rounded">
          <option value="" disabled>선택</option>
          {tileOptions.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-300">위치:</span>
        <input type="number" value={value?.hex.q ?? 0}
          onChange={e => setHex({ q: Number(e.target.value) })}
          className="border border-gray-700 bg-gray-900 text-gray-100 p-1 rounded w-16" placeholder="q" />
        <input type="number" value={value?.hex.r ?? 0}
          onChange={e => setHex({ r: Number(e.target.value) })}
          className="border border-gray-700 bg-gray-900 text-gray-100 p-1 rounded w-16" placeholder="r" />
        <button type="button" onClick={() => onChange(undefined)}
          className="text-xs text-red-400 underline">지우기</button>
      </div>
    </div>
  );
}
