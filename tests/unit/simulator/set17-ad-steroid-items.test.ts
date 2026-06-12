/**
 * 회귀 가드 — set17 AD 스테로이드 아이템 모델링 (under-damage calibration).
 *
 * project_underdamage_calibration: AD 캐리 평타 데미지 과소의 systemic 원인 =
 * 미모델 AD 아이템. 본 PR 에서 2종 모델:
 * - 크라켄의 분노 (apiName TFT_Item_RunaansHurricane, set17 재활용 — Runaan's 효과 아님!):
 *   AD 0.10 base + 평타당 +3.5% AD(damageAmp, max 15스택) + 15스택 후 AS +15%
 * - 귀여운 발사기 (TFT17_AnimaSquadItem_Tier2_UwuBlaster): AD 0.25 / AS 45 +
 *   평타마다 레이저 3발 × 40% AD 물리 (randomEnemy proc)
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';

const { champions, traits, items } = loadServerCatalogs();
const adCarry = champions.find(c => c.apiName === 'TFT17_Xayah')!; // AD 원거리 캐리
const tankDummy = champions.find(c => c.apiName === 'TFT17_Shen')!; // 생존 → 평타 다수 누적
const kraken = items.find(i => i.apiName === 'TFT_Item_RunaansHurricane')!;
const uwu = items.find(i => i.apiName === 'TFT17_AnimaSquadItem_Tier2_UwuBlaster')!;

function placed(c: RawChampion, q: number, r: number, eq: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel: 2, position: { q, r }, items: eq };
}

function carryDamage(eq: RawItem[]): number {
  const r = simulateCombat([placed(adCarry, 0, 0, eq)], [placed(tankDummy, 6, 3)], {
    seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
  });
  const x = r.playerUnits.find(u => u.champion.apiName === 'TFT17_Xayah')!;
  return x.totalDamageDealt;
}

describe('set17 AD 스테로이드 아이템 모델링', () => {
  it('카탈로그에 두 아이템 존재', () => {
    expect(kraken).toBeDefined();
    expect(uwu).toBeDefined();
  });

  it('UwuBlaster → 레이저 proc 으로 총 데미지 증가 + itemDamageDealt > 0', () => {
    const r = simulateCombat([placed(adCarry, 0, 0, [uwu])], [placed(tankDummy, 6, 3)], {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const x = r.playerUnits.find(u => u.champion.apiName === 'TFT17_Xayah')!;
    // 레이저 3발/평타는 dealDamage primitive → itemDamageDealt 에 누적
    expect(x.itemDamageDealt).toBeGreaterThan(0);
    // 아이템 없을 때보다 총 데미지 증가
    expect(carryDamage([uwu])).toBeGreaterThan(carryDamage([]));
  });

  it('크라켄의 분노 → 평타 스택으로 총 데미지 증가 (damageAmp 누적)', () => {
    const r = simulateCombat([placed(adCarry, 0, 0, [kraken])], [placed(tankDummy, 6, 3)], {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const x = r.playerUnits.find(u => u.champion.apiName === 'TFT17_Xayah')!;
    // 평타 누적 → damageAmp 양수 (스택), 총 데미지도 아이템 없을 때보다 증가
    expect(x.damageAmp).toBeGreaterThan(0);
    expect(carryDamage([kraken])).toBeGreaterThan(carryDamage([]));
  });
});
