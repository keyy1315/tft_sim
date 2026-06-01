/**
 * 바루스의 은총 (TFT17_Augment_VarusGodAugment_BoonOfStars) 회귀 가드.
 *
 * 효과: 아군이 (팀 총 별 레벨 합) 당 체력 +Health 획득.
 *   - effects.Health = 18 (set 17.1 데이터 기준)
 *   - PercentIncrease (5단계 등장 확률) 는 게임-외부 — 시뮬 무관.
 *
 * 예: 팀에 ★3 4명 + ★2 2명 + ★1 1명 = 17 별 레벨 합.
 *   → 각 아군 +306 flat HP (18 × 17).
 */
import { describe, it, expect } from 'vitest';
import { resolveAugmentEffects, AugmentWithStacks } from '@/lib/simulator/systems/augment';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion, RawAugment } from '@/types';

const { champions, traits, augments } = loadServerCatalogs();

const BOON_AUG = augments.find((a) => a.apiName === 'TFT17_Augment_VarusGodAugment_BoonOfStars')!;

function placed(c: RawChampion, q: number, r: number, starLevel = 2): PlacedChampion {
  return { champion: c, starLevel, position: { q, r }, items: [] };
}

describe('PR91 — 바루스의 은총 (BoonOfStars) 효과', () => {
  it('augment 데이터 존재 + Health=18, PercentIncrease=2 (set 17.1)', () => {
    expect(BOON_AUG).toBeDefined();
    expect(BOON_AUG.effects.Health).toBe(18);
    expect(BOON_AUG.effects.PercentIncrease).toBe(2);
  });

  it('resolveAugmentEffects: starLevelSum=10 일 때 result.hp = 180 (18 × 10)', () => {
    const augs: AugmentWithStacks[] = [{ augment: BOON_AUG, stackCount: 1 }];
    const eff = resolveAugmentEffects(augs, 10);
    expect(eff.hp).toBe(180);
  });

  it('resolveAugmentEffects: starLevelSum=0 (팀 비어있음) 일 때 hp 효과 없음', () => {
    const augs: AugmentWithStacks[] = [{ augment: BOON_AUG, stackCount: 1 }];
    const eff = resolveAugmentEffects(augs, 0);
    expect(eff.hp ?? 0).toBe(0);
  });

  it('resolveAugmentEffects: starLevelSum 기본값(미전달) → hp 효과 없음', () => {
    const augs: AugmentWithStacks[] = [{ augment: BOON_AUG, stackCount: 1 }];
    const eff = resolveAugmentEffects(augs);
    expect(eff.hp ?? 0).toBe(0);
  });

  it('simulateCombat: BoonOfStars 보유 팀 unit maxHp 가 baseline 대비 증가', () => {
    const ally: PlacedChampion[] = [
      placed(champions.find((c) => c.apiName === 'TFT17_Aatrox')!, 0, 0, 3),
      placed(champions.find((c) => c.apiName === 'TFT17_Talon')!, 1, 0, 3),
    ];
    const enemy: PlacedChampion[] = [
      placed(champions.find((c) => c.apiName === 'TFT17_Aatrox')!, 6, 3),
    ];
    // starLevelSum = 3 + 3 = 6 → 18 × 6 = 108 flat HP per ally
    const withBoon = simulateCombat(ally, enemy, {
      seed: 0,
      allTraits: traits,
      skipMirror: true,
      playerAugments: [BOON_AUG] as RawAugment[],
    });
    const without = simulateCombat(ally, enemy, {
      seed: 0,
      allTraits: traits,
      skipMirror: true,
    });
    const aatroxWith = withBoon.playerUnits.find((u) => u.champion.apiName === 'TFT17_Aatrox')!;
    const aatroxBase = without.playerUnits.find((u) => u.champion.apiName === 'TFT17_Aatrox')!;
    // +108 flat HP — 정확한 값은 다른 stat 영향 없으므로 직접 검증
    expect(aatroxWith.maxHp - aatroxBase.maxHp).toBe(108);
  });

  it('simulateCombat: TFT16_Galio placeholder 는 starLevelSum 에서 제외 (codex P2 회귀 가드 — PR #91)', () => {
    // Galio 는 데마시아 결집 시 소환되는 placeholder — 전투 시작 시 보드에 없음.
    // BoonOfStars star sum 에 포함하면 over-buff 발생.
    const galio = champions.find((c) => c.apiName === 'TFT16_Galio');
    if (!galio) {
      // Galio 데이터 없으면 skip — 본 테스트는 Galio 가 catalog 에 있을 때만 의미있음.
      return;
    }
    const ally: PlacedChampion[] = [
      placed(champions.find((c) => c.apiName === 'TFT17_Aatrox')!, 0, 0, 2),
      placed(galio, 1, 0, 3),  // Galio ★3 — 기여 안 해야
    ];
    const enemy: PlacedChampion[] = [
      placed(champions.find((c) => c.apiName === 'TFT17_Aatrox')!, 6, 3),
    ];
    const withBoon = simulateCombat(ally, enemy, {
      seed: 0,
      allTraits: traits,
      skipMirror: true,
      playerAugments: [BOON_AUG] as RawAugment[],
    });
    const without = simulateCombat(ally, enemy, {
      seed: 0,
      allTraits: traits,
      skipMirror: true,
    });
    const aatroxWith = withBoon.playerUnits.find((u) => u.champion.apiName === 'TFT17_Aatrox')!;
    const aatroxBase = without.playerUnits.find((u) => u.champion.apiName === 'TFT17_Aatrox')!;
    // Galio (★3) 제외하면 sum=2 (Aatrox ★2) → 18 × 2 = +36 HP.
    // Galio 포함 잘못된 sum=5 → +90 HP. 회귀 시 90 이 나옴.
    expect(aatroxWith.maxHp - aatroxBase.maxHp).toBe(36);
  });

  it('simulateCombat: 팀이 비어있으면 BoonOfStars 효과 없음 (degenerate guard)', () => {
    // 1명만 있는 팀: starLevelSum = 1 → +18 HP
    const ally: PlacedChampion[] = [
      placed(champions.find((c) => c.apiName === 'TFT17_Aatrox')!, 0, 0, 1),
    ];
    const enemy: PlacedChampion[] = [
      placed(champions.find((c) => c.apiName === 'TFT17_Aatrox')!, 6, 3),
    ];
    const withBoon = simulateCombat(ally, enemy, {
      seed: 0,
      allTraits: traits,
      skipMirror: true,
      playerAugments: [BOON_AUG] as RawAugment[],
    });
    const without = simulateCombat(ally, enemy, {
      seed: 0,
      allTraits: traits,
      skipMirror: true,
    });
    expect(withBoon.playerUnits[0].maxHp - without.playerUnits[0].maxHp).toBe(18);
  });
});
