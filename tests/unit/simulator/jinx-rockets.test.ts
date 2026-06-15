/**
 * 회귀 가드 — 징크스(Jinx) 「폭발적 성향」 로켓 다발 (under-damage fix, 2026-06-15).
 *
 * 버그: Jinx 어빌리티는 원뿔에 NumRockets(BaseBullets 16 + ASPerBullet×AS)발 발사, 각 ADDamage(scaleAD)
 *   를 입히는데, sim config 가 `cone` 만(hitCount 없음) → 원뿔 타겟당 1× ADDamage 만 → ~16× under (-55%).
 * fix: hitCount: 16 (BaseBullets) + damageVar 'ADDamage'. 총 = 16 × ADDamage split.
 *   (ASPerBullet AS-스케일 추가 로켓은 P2 — hitCount static 한계, 보수적으로 base 16 만.)
 *
 * 검증: Jinx -55%→-28% (sim +60%), game-424 -21.55%→-17.03%, overshoot 0.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { getAbilityDamage, setScalingData, type ScalingData } from '@/lib/simulator/systems/ability';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import scalingJson from '../../../public/data/tft_set17_scaling.json';
import type { PlacedChampion, RawChampion } from '@/types';

const { champions, traits } = loadServerCatalogs();
const jinx = champions.find(c => c.apiName === 'TFT17_Jinx')!;
const cho = champions.find(c => c.apiName === 'TFT17_Chogath')!;

beforeAll(() => {
  setScalingData(scalingJson as unknown as ScalingData);
});

function placed(c: RawChampion, q: number, r: number, star: 1 | 2 | 3): PlacedChampion {
  return { champion: c, starLevel: star, position: { q, r }, items: [] };
}

describe('징크스 로켓 다발 (hitCount 회귀 가드)', () => {
  it('cast 가 ADDamage 단발이 아닌 16발 로켓(hitCount) 총량 — 단일 타겟 ~16×', () => {
    const r = simulateCombat(
      [placed(jinx, 5, 3, 2)],
      [placed(cho, 6, 3, 3)],
      { seed: 0, allTraits: traits, skipMirror: true, stageNumber: 6 },
    );
    const t = r.playerUnits[0];
    const cast = r.logs.find(l => l.type === 'ability' && l.sourceId === t.id);
    expect(cast).toBeDefined();
    // 단일 타겟 → hitCountTotal = ADDamage★2 × 16 (split 분모 1). 버그(hitCount 없음) 시 ×1.
    const adDmg = getAbilityDamage(jinx, 2, 0, 0).damage; // ADDamage★2
    expect(cast!.value ?? 0).toBeGreaterThan(adDmg * 10); // ×16 (mitigation 후에도 ≫ ×1)
  });
});
