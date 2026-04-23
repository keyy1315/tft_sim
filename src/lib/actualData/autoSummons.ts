import type { RawChampion, RawTrait } from '@/types';
import { resolveTraits } from '@/lib/simulator/systems/trait';
import type { PlacedUnit, TeamSnapshot } from './types';

const VOYAGER_SUMMON_API = 'TFT17_Summon';

function getVoyagerSummonStarLevel(activeVoyagerCount: number): 1 | 2 | 3 | null {
  if (activeVoyagerCount >= 7) return 3;
  if (activeVoyagerCount >= 5) return 2;
  if (activeVoyagerCount >= 3) return 1;
  return null;
}

function findEmptyHexNearFirstUnit(units: PlacedUnit[]): { q: number; r: number } {
  // 간단한 빈 칸 찾기: 첫 유닛 주위 6방향 중 empty, 없으면 r=0,q=0..7 스캔.
  const occupied = new Set(units.map(u => `${u.hex.q},${u.hex.r}`));
  const first = units[0];
  if (first) {
    const offsets = [
      { q: 1, r: 0 }, { q: -1, r: 0 },
      { q: 0, r: 1 }, { q: 0, r: -1 },
      { q: 1, r: -1 }, { q: -1, r: 1 },
    ];
    for (const off of offsets) {
      const c = { q: first.hex.q + off.q, r: first.hex.r + off.r };
      if (c.r < 0 || c.r > 3) continue;
      if (!occupied.has(`${c.q},${c.r}`)) return c;
    }
  }
  // fallback: 보드 스캔 (r 0-3, q -2..7)
  for (let r = 0; r <= 3; r++) {
    for (let q = -Math.floor(r / 2); q < 7 - Math.floor(r / 2); q++) {
      if (!occupied.has(`${q},${r}`)) return { q, r };
    }
  }
  return { q: 0, r: 0 };
}

/**
 * 길잡이 시너지 소환체 (비아와 바이엔, TFT17_Summon) 자동 싱크.
 *
 * activeVoyagerCount (resolveTraits 결과 기준, 상징 포함):
 *   >= 7 → 3성 소환
 *   >= 5 → 2성 소환
 *   >= 3 → 1성 소환
 *   < 3  → 기존 소환체 제거
 *
 * championCatalog는 championId → RawChampion 매핑. 카탈로그가 비어있으면
 * resolveTraits 호출 불가하므로 unchanged 반환 (safety).
 */
export function syncVoyagerSummon(
  units: PlacedUnit[],
  championCatalog: Map<string, RawChampion>,
  traits: RawTrait[],
): PlacedUnit[] {
  if (championCatalog.size === 0 || traits.length === 0) return units;

  // PlacedUnit → resolveTraits가 받는 { champion } 래퍼로 변환
  const wrappers: { champion: RawChampion }[] = [];
  for (const u of units) {
    if (u.championId === VOYAGER_SUMMON_API) continue; // 소환체 자신은 제외
    const c = championCatalog.get(u.championId);
    if (c) wrappers.push({ champion: c });
  }

  const active = resolveTraits(wrappers, traits);
  const voyagerCount = active.find(t => t.trait.name === '길잡이')?.count ?? 0;
  const targetStar = getVoyagerSummonStarLevel(voyagerCount);
  const existingIdx = units.findIndex(u => u.championId === VOYAGER_SUMMON_API);

  if (targetStar === null) {
    return existingIdx >= 0 ? units.filter((_, i) => i !== existingIdx) : units;
  }

  if (existingIdx >= 0) {
    if (units[existingIdx].starLevel === targetStar) return units;
    return units.map((u, i) =>
      i === existingIdx ? { ...u, starLevel: targetStar } : u,
    );
  }

  // 신규 소환체 추가
  const pos = findEmptyHexNearFirstUnit(units);
  const newUnit: PlacedUnit = {
    championId: VOYAGER_SUMMON_API,
    hex: pos,
    starLevel: targetStar,
    items: [undefined, undefined, undefined],
  };
  return [...units, newUnit];
}

/**
 * 팀 스냅샷 patch에 units 변경이 있으면 소환체 싱크를 적용한 units로 교체.
 * updatePlayerTeam/updateOpponent가 받기 직전 호출.
 */
export function withAutoSummons<T extends Partial<TeamSnapshot>>(
  patch: T,
  championCatalog: Map<string, RawChampion>,
  traits: RawTrait[],
): T {
  if (!patch.units) return patch;
  return { ...patch, units: syncVoyagerSummon(patch.units, championCatalog, traits) };
}
