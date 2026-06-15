/**
 * 회귀 가드 — 잭스(Jax) 「별의 반격」 armor+MR 비례 마법 피해 (under-damage fix, 2026-06-15).
 *
 * 버그: Jax 어빌리티는 방어 태세 종료 시 주변 적에 ModifiedDamage(scaleArmor scaleMR)
 *   = ArmorMRScale★ × (caster.armor + caster.magicResist) 마법 피해를 입히는데, sim config 에
 *   damageVar 가 없어 어빌리티 데미지가 통째로 미모델 (selfBuff+stun 만) → Jax -57% under.
 * fix: AbilityConfig.casterMrScaleVar 추가 + damageVar 없는 순수 스케일은 base 0(magic).
 *   damage = ArmorMRScale × armor (casterArmorScaleVar) + ArmorMRScale × MR (casterMrScaleVar).
 *
 * 검증: calibration Jax -57%→-49% (sim +19%), overshoot 0. game-423 2-5 simTotal≈actual.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { setScalingData, type ScalingData } from '@/lib/simulator/systems/ability';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import scalingJson from '../../../public/data/tft_set17_scaling.json';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';

const { champions, traits, items } = loadServerCatalogs();
const jax = champions.find(c => c.apiName === 'TFT17_Jax')!;
const cho = champions.find(c => c.apiName === 'TFT17_Chogath')!;
// armor+MR +100/+100 — armor/MR 스케일 신호 증폭용.
const omni = items.find(i => i.apiName === 'TFT17_AnimaSquadItem_Tier4_Omniweapon')!;

beforeAll(() => {
  setScalingData(scalingJson as unknown as ScalingData);
});

function placed(c: RawChampion, q: number, r: number, star: 1 | 2 | 3, it: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel: star, position: { q, r }, items: it };
}

function jaxCastValue(jaxItems: RawItem[]): number {
  // Jax 포위 → 마나 충전 + 3초 방어 태세 생존 → cast.
  const r = simulateCombat(
    [placed(jax, 5, 3, 2, jaxItems)],
    [placed(cho, 6, 3, 2), placed(cho, 4, 3, 2), placed(cho, 5, 4, 2), placed(cho, 5, 2, 2)],
    { seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5 },
  );
  const t = r.playerUnits[0];
  const cast = r.logs.find(l => l.type === 'ability' && l.sourceId === t.id);
  return cast?.value ?? 0;
}

describe('잭스 armor+MR 비례 마법 피해 (회귀 가드)', () => {
  it('어빌리티가 armor+MR 비례 마법 피해를 입힘 — damageVar 없어도 base 0 + 스케일', () => {
    const base = jaxCastValue([]);
    // 버그(어빌리티 데미지 미모델) 시 cast 데미지 0/없음. 정상 시 > 0.
    expect(base).toBeGreaterThan(0);
  });

  it('armor+MR 증가 시 어빌리티 피해 증가 (scaleArmor + scaleMR 검증)', () => {
    const base = jaxCastValue([]);
    const buffed = jaxCastValue([omni]); // +100 armor +100 MR
    // ArmorMRScale★2(1.15) × +200(armor+MR) ≈ +230 pre-mitig → mitigated 후에도 유의미 증가.
    expect(buffed).toBeGreaterThan(base * 1.2);
  });
});
