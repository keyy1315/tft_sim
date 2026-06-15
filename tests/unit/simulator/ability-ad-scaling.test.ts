/**
 * 회귀 가드 — raw AD-scaling 어빌리티가 caster 보너스 AD 를 반영 (under-damage fix, 2026-06-15).
 *
 * 버그: resolveAbilityDamage 가 getAbilityDamage 에 bonusAdPercent=0 하드코딩 → scaleAD 어빌리티
 * (Talon 출혈/Jhin 등)가 아이템/trait 보너스 AD 를 전혀 반영 못 함. AD 캐리 ability 데미지 과소.
 * fix: bonusAdPercentOf(unit) = total AD / (baseAd × STAR_SCALING) − 1 을 계산해 main/OOR cast path
 * 에서 전달. getAbilityDamage 의 `baseValue × (1 + bonusAdPercent)` (scalingType 'ad') 정상 동작.
 *
 * 검증: Talon★3 bleed castDmg 가 AD 증가에 비례 (BFSword 등 AD 아이템 시 ~2배). calibration
 * game-424 -23.19%→-21.94% (AD-어빌리티 챔프 전반 개선, overshoot 0).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { setScalingData, type ScalingData } from '@/lib/simulator/systems/ability';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import scalingJson from '../../../public/data/tft_set17_scaling.json';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';

const { champions, traits, items } = loadServerCatalogs();
const talon = champions.find(c => c.apiName === 'TFT17_Talon')!;
const cho = champions.find(c => c.apiName === 'TFT17_Chogath')!;
const bfSword = items.find(i => i.apiName === 'TFT_Item_BFSword')!;

beforeAll(() => {
  setScalingData(scalingJson as unknown as ScalingData);
});

function placed(c: RawChampion, q: number, r: number, star: 1 | 2 | 3 = 2, it: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel: star, position: { q, r }, items: it };
}

describe('raw AD-scaling 어빌리티 bonus AD 반영 (회귀 가드)', () => {
  it('Talon 출혈 cast 데미지가 보너스 AD(BFSword)에 비례 증가', () => {
    const enemies = () => [placed(cho, 6, 3, 3), placed(cho, 6, 2, 3), placed(cho, 6, 4, 3)];
    const opts = { seed: 0, allTraits: traits, skipMirror: true, stageNumber: 6 } as const;

    const noItem = simulateCombat([placed(talon, 5, 3, 3)], enemies(), opts);
    const withAd = simulateCombat([placed(talon, 5, 3, 3, [bfSword, bfSword, bfSword])], enemies(), opts);

    const castVal = (r: ReturnType<typeof simulateCombat>) => {
      const t = r.playerUnits.find(u => u.champion.apiName === 'TFT17_Talon')!;
      const cast = r.logs.find(l => l.type === 'ability' && l.sourceId === t.id);
      return cast?.value ?? 0;
    };
    const base = castVal(noItem);
    const amped = castVal(withAd);
    expect(base).toBeGreaterThan(0);
    // BFSword 3개 = +30% AD → bleed cast 값 +30%(1000→1300). 버그(bonusAdPercent=0) 시 동일.
    expect(amped).toBeGreaterThan(base * 1.2);
  });
});
