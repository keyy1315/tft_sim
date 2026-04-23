'use client';
import Image from 'next/image';
import type { UnitDamageEntry, PlacedUnit, HexCoord } from '@/lib/actualData/types';
import type { RawChampion } from '@/types';
import { getChampionImage } from '@/data/imageMap';

interface Props {
  label: string;
  units: PlacedUnit[];
  entries: UnitDamageEntry[];
  onChange: (entries: UnitDamageEntry[]) => void;
  championCatalog: Map<string, RawChampion>;
}

function hexMatches(a: HexCoord, b: HexCoord): boolean {
  return a.q === b.q && a.r === b.r;
}

export default function DamageChartInput({ label, units, entries, onChange, championCatalog }: Props) {
  function setDamage(unit: PlacedUnit, damage: number) {
    const existing = entries.find(e => hexMatches(e.unitHex, unit.hex));
    if (existing) {
      onChange(entries.map(e =>
        hexMatches(e.unitHex, unit.hex)
          ? { ...e, damage, championId: unit.championId }
          : e,
      ));
    } else {
      onChange([...entries, { unitHex: unit.hex, championId: unit.championId, damage }]);
    }
  }

  function clearEntry(unit: PlacedUnit) {
    onChange(entries.filter(e => !hexMatches(e.unitHex, unit.hex)));
  }

  return (
    <div className="border border-gray-700 rounded p-2 space-y-1 text-gray-100">
      <h4 className="text-sm font-semibold">{label}</h4>
      {units.length === 0 ? (
        <p className="text-xs text-gray-400">보드에 배치된 유닛이 없습니다.</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-gray-300">
            <tr>
              <th className="text-left p-1">유닛</th>
              <th className="text-left p-1">위치</th>
              <th className="text-right p-1">데미지</th>
              <th className="p-1" />
            </tr>
          </thead>
          <tbody>
            {units.map((u) => {
              const champ = championCatalog.get(u.championId);
              const entry = entries.find(e => hexMatches(e.unitHex, u.hex));
              const damage = entry?.damage ?? 0;
              const key = `${u.hex.q},${u.hex.r}`;
              return (
                <tr key={key} className="border-t border-gray-800">
                  <td className="p-1 flex items-center gap-1">
                    {champ ? (
                      <Image
                        src={getChampionImage(champ.apiName)}
                        alt={champ.name}
                        width={24}
                        height={24}
                        className="rounded object-contain"
                        unoptimized
                      />
                    ) : null}
                    <span>{champ?.name ?? u.championId}</span>
                    <span className="text-amber-400">
                      {'★'.repeat(u.starLevel)}
                    </span>
                  </td>
                  <td className="p-1 text-gray-400">({u.hex.q},{u.hex.r})</td>
                  <td className="p-1">
                    <input
                      type="number"
                      min={0}
                      value={damage}
                      onChange={e => setDamage(u, Math.max(0, Number(e.target.value)))}
                      className="border border-gray-700 bg-gray-900 text-gray-100 p-0.5 w-full text-xs text-right rounded"
                    />
                  </td>
                  <td className="p-1">
                    {entry && (
                      <button
                        type="button"
                        onClick={() => clearEntry(u)}
                        className="text-red-400 hover:text-red-300"
                        title="데미지 기록 제거"
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
