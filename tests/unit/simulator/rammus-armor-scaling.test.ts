/**
 * 회귀 가드 — 라무스(Rammus) armor 비례 데미지 2종 (PR: Rammus armor-scaling + 정령 패시브).
 *
 * under-damage 재진단 2026-06-12: Rammus calibration -96% (절대 gap -22k, 2위).
 * 근본: getAbilityDamage 가 scaleArmor(자기 방어력 비례) 미지원 → armor 성분 통째 누락.
 *
 * 1) 액티브 「중력 회전」: damage = DamageAP×(1+ap/100) + DamageArmor_★ × caster.armor.
 *    fix: AbilityConfig.casterArmorScaleVar + combatLoop main/OOR cast path armor 성분 가산.
 * 2) 패시브 (정령족/Astronaut active 시만): AttacksPerPassiveTrigger(20)회 피격 후
 *    반경 2칸 적에게 PassivePercentArmor_★ × armor 마법 AoE.
 *    fix: applyAstronautEffects precompute(rammusPassiveArmorCoef) + 피격 카운터 hook.
 *
 * ⚠️ 두 메커니즘은 올바르나 calibration gap 의 지배 요인은 별개 — sim 전투 시간이 실전 대비
 *    5~10배 짧아(2~5s vs 20~30s) 패시브 20회 threshold 가 실전만큼 자주 안 채워짐 (systemic).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { setScalingData, type ScalingData } from '@/lib/simulator/systems/ability';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import scalingJson from '../../../public/data/tft_set17_scaling.json';
import type { PlacedChampion, RawChampion } from '@/types';

const { champions, traits } = loadServerCatalogs();
const get = (api: string) => champions.find(c => c.apiName === api)!;
const rammus = get('TFT17_Rammus');
const gnar = get('TFT17_Gnar');
const bard = get('TFT17_Bard');
const jinx = get('TFT17_Jinx');
const cho = get('TFT17_Chogath');

beforeAll(() => {
  setScalingData(scalingJson as unknown as ScalingData);
});

function placed(c: RawChampion, q: number, r: number, star: 1 | 2 | 3 = 2): PlacedChampion {
  return { champion: c, starLevel: star, position: { q, r }, items: [] };
}

describe('라무스 액티브 caster 방어력 비례 (armor-scaling 회귀 가드)', () => {
  it('적 다수에 둘러싸여 cast 시 armor 비례 성분 반영 — DamageAP 단독 대비 대폭 증가', () => {
    const r = simulateCombat(
      [placed(rammus, 5, 3, 2)],
      [placed(jinx, 6, 3, 2), placed(jinx, 6, 2, 2), placed(jinx, 6, 4, 2)],
      { seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5 },
    );
    const t = r.playerUnits.find(u => u.champion.apiName === 'TFT17_Rammus')!;
    const casts = r.logs.filter(l => l.type === 'ability' && l.sourceId === t.id && !/정령 패시브/.test(l.message));
    expect(casts.length).toBeGreaterThanOrEqual(1);
    // DamageAP 성분만(armor 미반영) 이면 cast 1회 수십 수준. armor(★2 ~60)×DamageArmor 더해져 수백.
    expect(casts[0].value ?? 0).toBeGreaterThan(300);
  });
});

describe('라무스 정령 패시브 — 20회 피격 후 armor 비례 AoE (정령족 active 게이트)', () => {
  it('정령족 active(Rammus/Gnar/Bard=3) + 포위 피격 시 패시브 AoE 발동·딜 귀속', () => {
    // Rammus(5,3) 를 6방향 포위해 고정 → 20+회 피격 보장. Gnar/Bard 후방(정령족만 active).
    const r = simulateCombat(
      [placed(rammus, 5, 3, 2), placed(gnar, 0, 0, 2), placed(bard, 0, 6, 2)],
      [
        placed(cho, 6, 3, 3), placed(cho, 4, 3, 3), placed(cho, 5, 4, 3),
        placed(cho, 5, 2, 3), placed(cho, 6, 2, 3), placed(cho, 4, 4, 3),
      ],
      { seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5 },
    );
    const t = r.playerUnits.find(u => u.champion.apiName === 'TFT17_Rammus')!;
    // 정령족 active → coef 설정 (PassivePercentArmor★2 = 0.3).
    expect(t.rammusPassiveArmorCoef).toBeGreaterThan(0);
    const passiveLogs = r.logs.filter(
      l => l.type === 'ability' && l.sourceId === t.id && /정령 패시브/.test(l.message),
    );
    // 20회 피격 threshold 를 여러 번 넘겨 AoE 발동.
    expect(passiveLogs.length).toBeGreaterThanOrEqual(1);
    // 패시브 데미지가 totalDamageDealt 에 귀속.
    const passiveDmg = passiveLogs.reduce((a, l) => a + (l.value ?? 0), 0);
    expect(passiveDmg).toBeGreaterThan(0);
  });

  it('정령족 미발동(Rammus 단독) 시 패시브 비활성 — coef 0', () => {
    const r = simulateCombat(
      [placed(rammus, 5, 3, 2)],
      [placed(cho, 6, 3, 3), placed(cho, 4, 3, 3), placed(cho, 5, 4, 3)],
      { seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5 },
    );
    const t = r.playerUnits.find(u => u.champion.apiName === 'TFT17_Rammus')!;
    expect(t.rammusPassiveArmorCoef).toBe(0);
    const passiveLogs = r.logs.filter(
      l => l.type === 'ability' && l.sourceId === t.id && /정령 패시브/.test(l.message),
    );
    expect(passiveLogs.length).toBe(0);
  });
});
