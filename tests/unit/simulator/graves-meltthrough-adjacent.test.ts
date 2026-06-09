/**
 * 회귀 가드 — 최신상 Meltthrough 인접 적 2배 armor/MR 감소.
 *
 * raw desc: "Every second, reduce the Armor of enemies within 2-hexes by 4,
 *   doubled for adjacent enemies." → 인접(hexDistance===1) 적은 -8, 2칸 적은 -4.
 * 버그: combatLoop.ts Meltthrough 블록이 hexDistance>2 가드만 있고 인접 2배 분기 없어
 *   범위 내 적 균등 -4. 인접 교전(맹공 프레임) 시 실제 방어감소 절반.
 * fix: dist===1 시 gravesMeltthroughArmorMR × 2 적용.
 *
 * graves-armory.md mechanic 검증 (PR #211) lint P1 발견 → sim fix.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion } from '@/types';

const { champions, traits } = loadServerCatalogs();
const apGraves = champions.find(c => c.apiName === 'TFT17_Graves')!;
const dummyEnemy = champions.find(c => c.apiName === 'TFT17_Aatrox')!;

function placed(c: RawChampion, q: number, r: number, starLevel = 2): PlacedChampion {
  return { champion: c, starLevel, position: { q, r }, items: [] };
}

function runWith(upgrades: string[], enemies: PlacedChampion[]) {
  const team: PlacedChampion[] = [placed(apGraves, 0, 0)];
  return simulateCombat(team, enemies, {
    seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    playerGravesUpgrades: upgrades,
  });
}

describe('Meltthrough 인접 2배 (PR #211 lint P1 fix)', () => {
  it('Meltthrough flag → armorMR reduction=4 set', () => {
    const grav = runWith(['Meltthrough'], [placed(dummyEnemy, 1, 0)]).playerUnits[0];
    expect(grav.gravesMeltthroughArmorMR).toBe(4);
  });

  it('인접(dist=1) 적은 armor/MR 매초 8 감소 (2배 — fix 전이면 4)', () => {
    // graves(0,0)·인접 적(1,0) 모두 교전 거리라 고정 → 결정론적 -8/초.
    // (2칸 적은 1초 내 graves 로 이동해 인접되므로 대조군 불안정 → 인접 -8 자체로 분기 검증.)
    const melt = runWith(['Meltthrough'], [placed(dummyEnemy, 1, 0)]);
    const id = melt.enemyUnits[0].id;
    const stat = (t: number, key: 'armor' | 'magicResist') =>
      melt.snapshots.find(s => s.tick === t)?.units[id]?.stats[key];
    const a0 = stat(0, 'armor')!;
    const a30 = stat(30, 'armor')!;
    const a60 = stat(60, 'armor')!;
    // ArmorMRReduction(4) × 2 = 8/초 영구 감소 (인접). fix 전 균등 -4 였음.
    expect(a0 - a30).toBe(8);
    expect(a30 - a60).toBe(8);
    // magicResist 도 동일하게 2배 적용.
    expect(stat(0, 'magicResist')! - stat(30, 'magicResist')!).toBe(8);
  });
});
