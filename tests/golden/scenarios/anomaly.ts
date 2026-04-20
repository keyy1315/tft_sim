/**
 * Anomaly Golden Scenarios (Phase 5).
 *
 * Role 별 Anomaly 효과 검증 — 장착 챔피언의 UnitRole 에 따라 다른 trigger 발동.
 * 같은 매치업 seed 에서 장착 유닛 role 만 변경 → 효과 분기 확인.
 */

import type { Scenario } from '../helpers';

const ANOMALY = 'TFT17_EkkoOffering_AnomalyItem';

/** Tank: Rammus (APTank) 장착 — HP +1100 */
export const RAMMUS_ANOMALY_TANK: Scenario = {
  name: 'Anomaly: Rammus(Tank) vs Jinx',
  seed: 7,
  player: [
    { apiName: 'TFT17_Rammus', position: { q: 0, r: 0 }, starLevel: 2, items: [ANOMALY] },
  ],
  enemy: [{ apiName: 'TFT17_Jinx', position: { q: 0, r: 7 }, starLevel: 2 }],
};

/** Marksman: Jinx (ADCarry) 장착 — AS +60% */
export const JINX_ANOMALY_MARKSMAN: Scenario = {
  name: 'Anomaly: Jinx(Marksman) vs Rammus',
  seed: 7,
  player: [
    { apiName: 'TFT17_Jinx', position: { q: 0, r: 0 }, starLevel: 2, items: [ANOMALY] },
  ],
  enemy: [{ apiName: 'TFT17_Rammus', position: { q: 0, r: 7 }, starLevel: 2 }],
};

/** Fighter: Briar (ADFighter) 장착 — damageAmp +30%, AP +30 (HP<85% 3배) */
export const BRIAR_ANOMALY_FIGHTER: Scenario = {
  name: 'Anomaly: Briar(Fighter) vs Illaoi',
  seed: 7,
  player: [
    { apiName: 'TFT17_Briar', position: { q: 0, r: 0 }, starLevel: 2, items: [ANOMALY] },
  ],
  enemy: [{ apiName: 'TFT17_Illaoi', position: { q: 0, r: 7 }, starLevel: 2 }],
};

/** Caster: Aurora (APCaster) 장착 — 마나 50 소모마다 6% maxHP 고정피해 */
export const AURORA_ANOMALY_CASTER: Scenario = {
  name: 'Anomaly: Aurora(Caster) vs Rammus',
  seed: 7,
  player: [
    { apiName: 'TFT17_Aurora', position: { q: 0, r: 0 }, starLevel: 2, items: [ANOMALY] },
  ],
  enemy: [{ apiName: 'TFT17_Rammus', position: { q: 0, r: 7 }, starLevel: 2 }],
};

export const ANOMALY_SCENARIOS: Scenario[] = [
  RAMMUS_ANOMALY_TANK,
  JINX_ANOMALY_MARKSMAN,
  BRIAR_ANOMALY_FIGHTER,
  AURORA_ANOMALY_CASTER,
];
