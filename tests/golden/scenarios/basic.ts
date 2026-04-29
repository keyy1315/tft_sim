/**
 * Basic Golden Scenarios
 *
 * Phase 2 plumbing 검증용 샘플. 실제 100 시나리오는 후속 커밋에서 확장.
 *
 * 시나리오 추가 가이드: tests/golden/README.md
 */

import type { Scenario } from '../helpers';

/** 1:1 단순 대치 — 같은 챔피언으로 stat 대칭성 확인 */
export const AATROX_MIRROR: Scenario = {
  name: '1v1 Briar mirror (대칭)',
  seed: 42,
  player: [{ apiName: 'TFT17_Briar', position: { q: 0, r: 0 }, starLevel: 1 }],
  enemy: [{ apiName: 'TFT17_Briar', position: { q: 0, r: 7 }, starLevel: 1 }],
};

/** AD carry + IE — 단순 스탯 아이템 경로 검증 */
export const JINX_WITH_IE: Scenario = {
  name: '1v1 Jinx+IE vs Briar (단일 스탯 아이템)',
  seed: 42,
  player: [
    {
      apiName: 'TFT17_Jinx',
      position: { q: 0, r: 0 },
      starLevel: 2,
      items: ['TFT_Item_InfinityEdge'],
    },
  ],
  enemy: [
    {
      apiName: 'TFT17_Briar',
      position: { q: 0, r: 7 },
      starLevel: 2,
    },
  ],
};

/** 2v2 — 타게팅 + 복수 유닛 결정론 */
export const AKALI_AND_JINX_VS_BELVETH_ILLAOI: Scenario = {
  name: '2v2 Akali+Jinx vs Belveth+Illaoi',
  seed: 1337,
  player: [
    { apiName: 'TFT17_Akali', position: { q: 0, r: 0 }, starLevel: 2 },
    { apiName: 'TFT17_Jinx', position: { q: 1, r: 0 }, starLevel: 2 },
  ],
  enemy: [
    { apiName: 'TFT17_Belveth', position: { q: 0, r: 7 }, starLevel: 2 },
    { apiName: 'TFT17_Illaoi', position: { q: 1, r: 7 }, starLevel: 2 },
  ],
};

export const BASIC_SCENARIOS: Scenario[] = [
  AATROX_MIRROR,
  JINX_WITH_IE,
  AKALI_AND_JINX_VS_BELVETH_ILLAOI,
];
