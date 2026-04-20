/**
 * PsyOps Golden Scenarios (Phase 4).
 *
 * Counter primitive (반도체) + Timer primitive (공감 임플란트) 검증.
 * 긴 전투 시나리오로 counter 다회 proc 과 timer 발동 확인.
 */

import type { Scenario } from '../helpers';

/** 반도체 base — Jinx(marksman) 의 on_attack 카운터 4회마다 proc */
export const JINX_WITH_SEMICONDUCTOR: Scenario = {
  name: 'Jinx+Semiconductor vs Rammus (Counter)',
  seed: 7,
  player: [
    {
      apiName: 'TFT17_Jinx',
      position: { q: 0, r: 0 },
      starLevel: 2,
      items: ['TFT17_Item_PsyOps_SemiconductorMod'],
    },
  ],
  enemy: [{ apiName: 'TFT17_Rammus', position: { q: 0, r: 7 }, starLevel: 2 }],
};

/** 반도체 찬란 — 같은 매치업, 변종 비교 */
export const JINX_WITH_SEMICONDUCTOR_RADIANT: Scenario = {
  name: 'Jinx+Semiconductor(Radiant) vs Rammus',
  seed: 7,
  player: [
    {
      apiName: 'TFT17_Jinx',
      position: { q: 0, r: 0 },
      starLevel: 2,
      items: ['TFT17_Item_PsyOps_SemiconductorMod_Radiant'],
    },
  ],
  enemy: [{ apiName: 'TFT17_Rammus', position: { q: 0, r: 7 }, starLevel: 2 }],
};

/** 피격 카운터 검증 — Rammus(tank) 에 반도체 장착, Jinx 에게 피격 누적 */
export const RAMMUS_WITH_SEMICONDUCTOR: Scenario = {
  name: 'Rammus+Semiconductor vs Jinx (on_hit_taken counter)',
  seed: 7,
  player: [
    {
      apiName: 'TFT17_Rammus',
      position: { q: 0, r: 0 },
      starLevel: 2,
      items: ['TFT17_Item_PsyOps_SemiconductorMod'],
    },
  ],
  enemy: [{ apiName: 'TFT17_Jinx', position: { q: 0, r: 7 }, starLevel: 2 }],
};

/** 공감 임플란트 — Aurora(caster) 5초마다 +1 mana. 긴 전투로 timer 다회 */
export const AURORA_WITH_EMPATHIC: Scenario = {
  name: 'Aurora+EmpathicImplant vs Rammus (Timer mana)',
  seed: 7,
  player: [
    {
      apiName: 'TFT17_Aurora',
      position: { q: 0, r: 0 },
      starLevel: 2,
      items: ['TFT17_Item_PsyOps_SympatheticImplantMod'],
    },
  ],
  enemy: [{ apiName: 'TFT17_Rammus', position: { q: 0, r: 7 }, starLevel: 2 }],
};

export const PSYOPS_SCENARIOS: Scenario[] = [
  JINX_WITH_SEMICONDUCTOR,
  JINX_WITH_SEMICONDUCTOR_RADIANT,
  RAMMUS_WITH_SEMICONDUCTOR,
  AURORA_WITH_EMPATHIC,
];
