/**
 * Timer primitive Golden Scenarios.
 *
 * IntervalTimer 기반 아이템(드론 업링크) 검증용 시나리오.
 * - 전투 3초 이상 지속 → 최소 1회 timer 발동 보장
 * - 공격/스킬 피해 누적 → timer tick 에서 20% 재현 피해 확인
 */

import type { Scenario } from '../helpers';

/** 드론 업링크 장착 — Aurora(캐스터) 가 Rammus(탱커) 상대로 긴 전투, 드론 여러 번 발동 */
export const AURORA_WITH_DRONE: Scenario = {
  name: 'Aurora+DroneUplink vs Rammus (Timer)',
  seed: 7,
  player: [
    {
      apiName: 'TFT17_Aurora',
      position: { q: 0, r: 0 },
      starLevel: 2,
      items: ['TFT17_Item_PsyOps_DroneMod'],
    },
  ],
  enemy: [{ apiName: 'TFT17_Rammus', position: { q: 0, r: 7 }, starLevel: 2 }],
};

/** 찬란 드론 — 동일 로직, 별도 apiName 경로 확인 */
export const AURORA_WITH_DRONE_RADIANT: Scenario = {
  name: 'Aurora+RadiantDrone vs Rammus',
  seed: 7,
  player: [
    {
      apiName: 'TFT17_Aurora',
      position: { q: 0, r: 0 },
      starLevel: 2,
      items: ['TFT17_Item_PsyOps_DroneMod_Radiant'],
    },
  ],
  enemy: [{ apiName: 'TFT17_Rammus', position: { q: 0, r: 7 }, starLevel: 2 }],
};

export const TIMER_SCENARIOS: Scenario[] = [
  AURORA_WITH_DRONE,
  AURORA_WITH_DRONE_RADIANT,
];
