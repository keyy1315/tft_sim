/**
 * Specialist Anomaly Golden Scenario (Phase 5 Part 2).
 *
 * Gnar (ADSpecialist) 가 Anomaly 장착 시 1초마다 별 1개씩 발사 (최대 6회).
 * 공전/반경 확장은 근사하지 않음 — 단순 periodic magic damage.
 */

import type { Scenario } from '../helpers';

const ANOMALY = 'TFT17_EkkoOffering_AnomalyItem';

/** Specialist: Gnar 장착 — 6초간 1초마다 별 (85 magic) */
export const GNAR_ANOMALY_SPECIALIST: Scenario = {
  name: 'Anomaly: Gnar(Specialist) vs Rammus',
  seed: 7,
  player: [
    { apiName: 'TFT17_Gnar', position: { q: 0, r: 0 }, starLevel: 2, items: [ANOMALY] },
  ],
  enemy: [{ apiName: 'TFT17_Rammus', position: { q: 0, r: 7 }, starLevel: 2 }],
};

export const ANOMALY_SPECIALIST_SCENARIOS: Scenario[] = [
  GNAR_ANOMALY_SPECIALIST,
];
