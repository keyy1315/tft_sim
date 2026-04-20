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

/** 표적 고정 — Jinx 의 2v2 에서 각 적에게 첫 공격 +150% AD */
export const JINX_WITH_TARGETLOCK_2V2: Scenario = {
  name: 'Jinx+Targetlock 2v2 (per-target first hit)',
  seed: 7,
  player: [
    {
      apiName: 'TFT17_Jinx', position: { q: 0, r: 0 }, starLevel: 2,
      items: ['TFT17_Item_PsyOps_TargetlockMod'],
    },
  ],
  enemy: [
    { apiName: 'TFT17_Rammus', position: { q: 0, r: 7 }, starLevel: 2 },
    { apiName: 'TFT17_Illaoi', position: { q: 1, r: 7 }, starLevel: 2 },
  ],
};

/** 악성코드 매트릭스 — Jinx on_hit 마다 Rammus armor -2 (ICD 0.75s) */
export const JINX_WITH_CHEMICAL: Scenario = {
  name: 'Jinx+ChemicalCapacitor vs Rammus (armor shred)',
  seed: 7,
  player: [
    {
      apiName: 'TFT17_Jinx',
      position: { q: 0, r: 0 },
      starLevel: 2,
      items: ['TFT17_Item_PsyOps_ChemicalCapacitorMod'],
    },
  ],
  enemy: [{ apiName: 'TFT17_Rammus', position: { q: 0, r: 7 }, starLevel: 2 }],
};

export const PSYOPS_SCENARIOS: Scenario[] = [
  JINX_WITH_SEMICONDUCTOR,
  JINX_WITH_SEMICONDUCTOR_RADIANT,
  RAMMUS_WITH_SEMICONDUCTOR,
  AURORA_WITH_EMPATHIC,
  JINX_WITH_CHEMICAL,
  JINX_WITH_TARGETLOCK_2V2,
];
