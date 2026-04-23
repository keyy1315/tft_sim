import type { RawChampion, RawTrait } from '@/types';
import { resolveTraits } from '@/lib/simulator/systems/trait';
import { BOARD_COLS } from '@/lib/simulator/models/constants';
import type { PlacedUnit, TeamSnapshot } from './types';

const VOYAGER_SUMMON_API = 'TFT17_Summon';
const MAX_R = 3;  // 각 팀 data-row 0..3 (SetupBoardCore가 player는 +4 offset 렌더)

function isValidHex(q: number, r: number): boolean {
  if (r < 0 || r > MAX_R) return false;
  const col = q + Math.floor(r / 2);
  return col >= 0 && col < BOARD_COLS;
}

function getVoyagerSummonStarLevel(activeVoyagerCount: number): 1 | 2 | 3 | null {
  if (activeVoyagerCount >= 7) return 3;
  if (activeVoyagerCount >= 5) return 2;
  if (activeVoyagerCount >= 3) return 1;
  return null;
}

function findEmptyHexNearFirstUnit(units: PlacedUnit[]): { q: number; r: number } | null {
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
      if (!isValidHex(c.q, c.r)) continue;
      if (!occupied.has(`${c.q},${c.r}`)) return c;
    }
  }
  // fallback: 보드 전체 스캔 (col 기반, 0..BOARD_COLS-1)
  for (let r = 0; r <= MAX_R; r++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const q = col - Math.floor(r / 2);
      if (!occupied.has(`${q},${r}`)) return { q, r };
    }
  }
  return null;  // 보드 가득 참 — 소환체 배치 불가
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
    const existing = units[existingIdx];
    const hexValid = isValidHex(existing.hex.q, existing.hex.r);
    if (existing.starLevel === targetStar && hexValid) return units;
    // starLevel 이 맞아도 위치가 보드 밖이면 재배치
    const others = units.filter((_, i) => i !== existingIdx);
    if (!hexValid) {
      const pos = findEmptyHexNearFirstUnit(others);
      if (!pos) return units;
      return [...others, { ...existing, hex: pos, starLevel: targetStar }];
    }
    return units.map((u, i) =>
      i === existingIdx ? { ...u, starLevel: targetStar } : u,
    );
  }

  // 신규 소환체 추가 — 빈 자리 없으면 포기 (희귀 edge case)
  const pos = findEmptyHexNearFirstUnit(units);
  if (!pos) return units;
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
