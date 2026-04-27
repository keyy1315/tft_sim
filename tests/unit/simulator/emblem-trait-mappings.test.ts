/**
 * Set 17 emblem 아이템 19종이 각자의 trait 카운트에 +1 부여하고 unit 자체도
 * 해당 trait 보유 unit 으로 처리되는지 회귀 가드.
 *
 * resolveTraits 가 champion.traits + emblem 합산 카운트 산출.
 */
import { describe, it, expect } from 'vitest';
import { resolveTraits } from '@/lib/simulator/systems/trait';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { RawChampion, RawItem } from '@/types';

const { champions, traits, items } = loadServerCatalogs();

function findChamp(api: string): RawChampion {
  const c = champions.find((x) => x.apiName === api);
  if (!c) throw new Error(`champion ${api} missing`);
  return c;
}

function findItem(api: string): RawItem {
  const it = items.find((x) => x.apiName === api);
  if (!it) throw new Error(`item ${api} missing`);
  return it;
}

/**
 * Set 17 emblem 19종 + 부여 trait 한글명. resolveTraits 결과의 카운트가 +1
 * 되어야 한다 (champion 자체에 그 trait 없는 unit 이 emblem 통해 trait 보유).
 */
const EMBLEM_CASES: ReadonlyArray<readonly [emblemApi: string, traitName: string]> = [
  ['TFT17_Item_AnimaSquadEmblemItem', '동물특공대'],
  ['TFT17_Item_ASTraitEmblemItem', '도전자'],
  ['TFT17_Item_AssassinTraitEmblemItem', '불한당'],
  ['TFT17_Item_AstronautEmblemItem', '정령족'],
  ['TFT17_Item_DarkStarEmblemItem', '암흑의 별'],
  ['TFT17_Item_DRXEmblemItem', 'N.O.V.A.'],
  ['TFT17_Item_FavoredEmblemItem', '중재자'],
  ['TFT17_Item_FlexTraitEmblemItem', '여행자'],
  ['TFT17_Item_HPTankEmblemItem', '싸움꾼'],
  ['TFT17_Item_MeleeTraitEmblemItem', '습격자'],
  ['TFT17_Item_PrimordianEmblemItem', '태고족'],
  ['TFT17_Item_PsyOpsEmblemItem', '초능력'],
  ['TFT17_Item_PulsefireEmblemItem', '시간 균열자'],
  ['TFT17_Item_RangedTraitEmblemItem', '저격수'],
  ['TFT17_Item_ResistTankEmblemItem', '요새'],
  ['TFT17_Item_ShieldTankEmblemItem', '선봉대'],
  ['TFT17_Item_SpaceGrooveEmblemItem', '우주 그루브'],
  ['TFT17_Item_StargazerEmblemItem', '별돌보미'],
  ['TFT17_Item_SummonTraitEmblemItem', '길잡이'],
];

describe('Emblem 19종 → trait 카운트 매핑', () => {
  // Caitlyn 은 N.O.V.A. + 운명술사 trait 보유. emblem 없는 단일 unit baseline 으로 사용 —
  // emblem 부여 시 champion 의 기본 trait 외에 추가 trait 카운트가 발생하는지 확인.
  const baselineChamp = findChamp('TFT17_Caitlyn');

  it.each(EMBLEM_CASES)(
    '%s → trait "%s" 카운트 +1',
    (emblemApi, traitName) => {
      const emblem = findItem(emblemApi);
      // emblem 보유 unit
      const teamWithEmblem = [
        { champion: baselineChamp, items: [emblem] },
      ];
      // baseline (champion 자체 trait 만)
      const teamWithout = [{ champion: baselineChamp }];

      const withEmblem = resolveTraits(teamWithEmblem, traits);
      const without = resolveTraits(teamWithout, traits);

      const withCount = withEmblem.find((t) => t.trait.name === traitName)?.count ?? 0;
      const withoutCount = without.find((t) => t.trait.name === traitName)?.count ?? 0;

      // emblem 보유 시 정확히 +1
      expect(withCount - withoutCount).toBe(1);
    },
  );

  it('같은 unit 의 여러 emblem 은 각자 카운트 (Set 17 룰)', () => {
    const team = [
      {
        champion: baselineChamp,
        items: [
          findItem('TFT17_Item_StargazerEmblemItem'),
          findItem('TFT17_Item_AnimaSquadEmblemItem'),
        ],
      },
    ];
    const active = resolveTraits(team, traits);
    expect(active.find((t) => t.trait.name === '별돌보미')?.count).toBe(1);
    expect(active.find((t) => t.trait.name === '동물특공대')?.count).toBe(1);
  });

  it('emblem 보유 unit 의 resolvedTraits 에 부여 trait 가 포함되어야 함 (champion 자체 trait 미보유 케이스)', async () => {
    // codex P1: trait 카운트는 +1 되지만 unit 의 resolvedTraits 에 emblem trait 가
    // 누락되면 combat-time per-unit 효과 (도전자/불한당/시너지 buff / arbiter law)
    // 가 그 unit 자체를 제외 — sim 모순. createCombatUnit 시점에 emblem trait 합산
    // 되어 있어야 unitHasTrait 일관성 유지.
    const { simulateCombat } = await import('@/lib/simulator/engine/combatLoop');
    const challengerEmblem = findItem('TFT17_Item_ASTraitEmblemItem');
    // Caitlyn 은 도전자 trait 미보유. emblem 으로 도전자 받음.
    const ally = [
      { champion: baselineChamp, starLevel: 2 as const, position: { q: 0, r: 3 }, items: [challengerEmblem] },
    ];
    const enemy = [
      { champion: findChamp('TFT17_Aatrox'), starLevel: 1 as const, position: { q: 6, r: 3 }, items: [] },
    ];
    const result = simulateCombat(ally, enemy, {
      seed: 0,
      allTraits: traits,
      skipMirror: true,
      stageNumber: 5,
    });
    const unit = result.playerUnits.find((u) => u.champion.apiName === 'TFT17_Caitlyn')!;
    expect(unit.resolvedTraits).toBeDefined();
    expect(unit.resolvedTraits).toContain('도전자');
    // champion 의 기본 trait (N.O.V.A., 운명술사) 도 보존
    expect(unit.resolvedTraits).toContain('N.O.V.A.');
    expect(unit.resolvedTraits).toContain('운명술사');
  });

  it('emblem 외 일반 아이템은 trait 카운트 무영향', () => {
    const team = [
      {
        champion: baselineChamp,
        items: [findItem('TFT_Item_BFSword'), findItem('TFT_Item_GargoyleStoneplate')],
      },
    ];
    const active = resolveTraits(team, traits);
    // Caitlyn 의 기본 trait (N.O.V.A., 운명술사) 만 카운트
    const traitNames = active.map((t) => t.trait.name).sort();
    expect(traitNames).toContain('N.O.V.A.');
    expect(traitNames).toContain('운명술사');
    // emblem 으로 부여될 만한 다른 trait 들은 카운트 0
    expect(active.find((t) => t.trait.name === '별돌보미')).toBeUndefined();
    expect(active.find((t) => t.trait.name === '도전자')).toBeUndefined();
  });
});
