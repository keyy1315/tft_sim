/**
 * Combined Item Golden Scenarios
 *
 * 이관된 10개 조합템 (definitions/combined.ts) 가 legacy path 와 동일한 결과를
 * 내는지 검증하기 위한 시나리오들. 각 시나리오가 하나 이상의 이관 아이템을 포함.
 */

import type { Scenario } from '../helpers';

/** 피바라기 장착 carry — AD/AP/MR 복합 StatPatch */
export const AKALI_WITH_BT: Scenario = {
  name: 'Akali+Bloodthirster vs Illaoi',
  seed: 7,
  player: [
    {
      apiName: 'TFT17_Akali',
      position: { q: 0, r: 0 },
      starLevel: 2,
      items: ['TFT_Item_Bloodthirster'],
    },
  ],
  enemy: [{ apiName: 'TFT17_Illaoi', position: { q: 0, r: 7 }, starLevel: 2 }],
};

/** 라바돈 — AP only (BonusDamage 는 Phase 3) */
export const AURORA_WITH_RABADON: Scenario = {
  name: 'Aurora+Rabadon vs Rammus',
  seed: 7,
  player: [
    {
      apiName: 'TFT17_Aurora',
      position: { q: 0, r: 0 },
      starLevel: 2,
      items: ['TFT_Item_RabadonsDeathcap'],
    },
  ],
  enemy: [{ apiName: 'TFT17_Rammus', position: { q: 0, r: 7 }, starLevel: 2 }],
};

/** 죽음의 검 */
export const BELVETH_WITH_DEATHBLADE: Scenario = {
  name: 'Belveth+Deathblade vs Briar',
  seed: 42,
  player: [
    {
      apiName: 'TFT17_Belveth',
      position: { q: 0, r: 0 },
      starLevel: 2,
      items: ['TFT_Item_Deathblade'],
    },
  ],
  enemy: [{ apiName: 'TFT17_Briar', position: { q: 0, r: 7 }, starLevel: 2 }],
};

/** 구인수 — Phase 3 이전 AP/AS 만 반영 (AttackSpeedPerStack 은 Phase 3 Trigger 로) */
export const JINX_WITH_GUINSOOS: Scenario = {
  name: 'Jinx+Guinsoos vs Illaoi',
  seed: 101,
  player: [
    {
      apiName: 'TFT17_Jinx',
      position: { q: 0, r: 0 },
      starLevel: 2,
      items: ['TFT_Item_GuinsoosRageblade'],
    },
  ],
  enemy: [{ apiName: 'TFT17_Illaoi', position: { q: 0, r: 7 }, starLevel: 2 }],
};

/** 거인의 결의 — Phase 3 이전 AS/Armor 만 반영 */
export const BRIAR_WITH_TITANS: Scenario = {
  name: 'Briar+Titans vs Jinx',
  seed: 101,
  player: [
    {
      apiName: 'TFT17_Briar',
      position: { q: 0, r: 0 },
      starLevel: 2,
      items: ['TFT_Item_TitansResolve'],
    },
  ],
  enemy: [{ apiName: 'TFT17_Jinx', position: { q: 0, r: 7 }, starLevel: 2 }],
};

/** 다중 아이템 — IE + Deathblade 동시 장착 (StatPatch 누적 확인) */
export const JINX_WITH_IE_AND_DEATHBLADE: Scenario = {
  name: 'Jinx+IE+Deathblade vs Illaoi (누적 StatPatch)',
  seed: 11,
  player: [
    {
      apiName: 'TFT17_Jinx',
      position: { q: 0, r: 0 },
      starLevel: 2,
      items: ['TFT_Item_InfinityEdge', 'TFT_Item_Deathblade'],
    },
  ],
  enemy: [{ apiName: 'TFT17_Illaoi', position: { q: 0, r: 7 }, starLevel: 2 }],
};

/** Registry 경로 + Legacy 경로 혼합 — BrambleVest(이관) + ArchangelsStaff(이관) + 미이관 아이템 */
export const ILLAOI_MIXED_ITEMS: Scenario = {
  name: 'Illaoi+BrambleVest+Archangels vs Akali (혼합 경로)',
  seed: 5,
  player: [
    {
      apiName: 'TFT17_Illaoi',
      position: { q: 0, r: 0 },
      starLevel: 2,
      items: ['TFT_Item_BrambleVest', 'TFT_Item_ArchangelsStaff'],
    },
  ],
  enemy: [{ apiName: 'TFT17_Akali', position: { q: 0, r: 7 }, starLevel: 2 }],
};

export const COMBINED_SCENARIOS: Scenario[] = [
  AKALI_WITH_BT,
  AURORA_WITH_RABADON,
  BELVETH_WITH_DEATHBLADE,
  JINX_WITH_GUINSOOS,
  BRIAR_WITH_TITANS,
  JINX_WITH_IE_AND_DEATHBLADE,
  ILLAOI_MIXED_ITEMS,
];
