'use client';
import Image from 'next/image';
import type { TeamSnapshot, PlacedUnit, HexCoord } from '@/lib/actualData/types';
import type { RawChampion } from '@/types';
import { getChampionImage } from '@/data/imageMap';
import { resolveChampion } from '@/lib/actualData/unitAdapter';

interface Props {
  label: string;
  team: TeamSnapshot;
  onChange: (team: TeamSnapshot) => void;
  championCatalog: Map<string, RawChampion>;
}

function hexMatches(a: HexCoord, b: HexCoord): boolean {
  return a.q === b.q && a.r === b.r;
}

/**
 * Round-end survivor state input — alive/dead radio + HP% input per placed unit.
 * Replaces the entire `team.survivors` array on each change to keep the parent
 * snapshot immutable. Untouched units do not generate survivor entries.
 */
export default function SurvivorListPanel({ label, team, onChange, championCatalog }: Props) {
  const survivors = team.survivors ?? [];

  function upsertSurvivor(unit: PlacedUnit, alive: boolean, hpPercent: number): void {
    const filtered = survivors.filter(s => !hexMatches(s.hex, unit.hex));
    const next = [
      ...filtered,
      { hex: unit.hex, championId: unit.championId, alive, hpPercent },
    ];
    onChange({ ...team, survivors: next });
  }

  function clearSurvivor(unit: PlacedUnit): void {
    const next = survivors.filter(s => !hexMatches(s.hex, unit.hex));
    onChange({ ...team, survivors: next });
  }

  return (
    <div className="border border-gray-700 rounded p-2 space-y-1 text-gray-100">
      <h4 className="text-sm font-semibold">{label}</h4>
      {team.units.length === 0 ? (
        <p className="text-xs text-gray-400">보드에 배치된 유닛이 없습니다.</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-gray-300">
            <tr>
              <th className="text-left p-1">유닛</th>
              <th className="text-left p-1">상태</th>
              <th className="text-right p-1">HP %</th>
              <th className="p-1" />
            </tr>
          </thead>
          <tbody>
            {team.units.map((u) => {
              const champ = resolveChampion(u.championId, championCatalog);
              const survivor = survivors.find(s => hexMatches(s.hex, u.hex));
              const alive = survivor?.alive ?? true;
              const hpPercent = survivor?.hpPercent ?? 100;
              const key = `${u.hex.q},${u.hex.r}`;
              const radioName = `survivor-${label}-${key}`;
              return (
                <tr key={key} className="border-t border-gray-800">
                  <td className="p-1">
                    <div className="flex items-center gap-1">
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
                      <span className="text-amber-400">{'★'.repeat(u.starLevel)}</span>
                      <span className="text-gray-500">({u.hex.q},{u.hex.r})</span>
                    </div>
                  </td>
                  <td className="p-1">
                    <label className="inline-flex items-center gap-1 mr-2">
                      <input
                        type="radio"
                        name={radioName}
                        checked={alive}
                        onChange={() => upsertSurvivor(u, true, hpPercent)}
                      />
                      <span>생존</span>
                    </label>
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="radio"
                        name={radioName}
                        checked={!alive}
                        onChange={() => upsertSurvivor(u, false, 0)}
                      />
                      <span>사망</span>
                    </label>
                  </td>
                  <td className="p-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={alive ? hpPercent : 0}
                      disabled={!alive}
                      onChange={e => {
                        const v = Math.max(0, Math.min(100, Number(e.target.value)));
                        upsertSurvivor(u, true, v);
                      }}
                      className="border border-gray-700 bg-gray-900 text-gray-100 p-0.5 w-full text-xs text-right rounded disabled:opacity-50"
                    />
                  </td>
                  <td className="p-1">
                    {survivor && (
                      <button
                        type="button"
                        onClick={() => clearSurvivor(u)}
                        className="text-red-400 hover:text-red-300"
                        title="생존 기록 제거"
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
