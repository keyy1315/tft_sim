/**
 * 초능력(PsyOps) (4) tier 자동 Radiant swap 회귀 가드 (17.2).
 *
 * 게임 시스템:
 *   - (2) 시너지: 5종 PsyOps 아이템 중 1개 획득. 비-초능력 unit 도 장착 가능.
 *     일반 4-tier 효과만 적용.
 *   - (4) 시너지: 추가 1개 (총 2개). 초능력 unit 이 장착 시 Radiant 강화 효과.
 *     비-초능력 unit 은 일반 효과만.
 *
 * 시뮬: createCombatUnit 호출 직전 applyPsyOpsRadiantSwap 가
 *       조건 충족 시 일반 PsyOps 아이템의 apiName 을 `_Radiant` 로 swap.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';

const { champions, traits, items } = loadServerCatalogs();

// 초능력 챔프 (5명: Viktor/Pyke/MasterYi/Gragas/Sona) — (4) tier 활성용 4명 필요.
const apViktor = champions.find(c => c.apiName === 'TFT17_Viktor')!;
const apPyke = champions.find(c => c.apiName === 'TFT17_Pyke')!;
const apMasterYi = champions.find(c => c.apiName === 'TFT17_MasterYi')!;
const apGragas = champions.find(c => c.apiName === 'TFT17_Gragas')!;
const apSona = champions.find(c => c.apiName === 'TFT17_Sona')!;
// 비-초능력 챔프
const apTwistedFate = champions.find(c => c.apiName === 'TFT17_TwistedFate')!;
const dummyEnemy = champions.find(c => c.apiName === 'TFT17_Aatrox')!;

// 일반 PsyOps 아이템 (사용자 빌더에서 장착 가능)
const droneMod = items.find(i => i.apiName === 'TFT17_Item_PsyOps_DroneMod')!;
const targetlockMod = items.find(i => i.apiName === 'TFT17_Item_PsyOps_TargetlockMod')!;

function placed(c: RawChampion, q: number, r: number, eqItems: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel: 2, position: { q, r }, items: eqItems };
}

describe('PsyOps (4) tier 자동 Radiant swap', () => {
  it('초능력 4명 + 초능력 unit 일반 PsyOps 아이템 장착 → _Radiant 로 swap', () => {
    const team: PlacedChampion[] = [
      placed(apViktor, 0, 0, [droneMod]), // PsyOps unit + 일반 PsyOps 아이템
      placed(apPyke, 1, 0),
      placed(apMasterYi, 2, 0),
      placed(apGragas, 3, 0),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const viktor = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Viktor')!;
    // swap 적용: items[0].apiName 가 Radiant 변종으로 변경
    expect(viktor.items[0].apiName).toBe('TFT17_Item_PsyOps_DroneMod_Radiant');
  });

  it('초능력 4명 + 비-초능력 unit 일반 PsyOps 아이템 장착 → swap 안 함 (일반 유지)', () => {
    const team: PlacedChampion[] = [
      placed(apViktor, 0, 0),
      placed(apPyke, 1, 0),
      placed(apMasterYi, 2, 0),
      placed(apGragas, 3, 0),
      placed(apTwistedFate, 4, 0, [droneMod]), // 비-초능력 + 일반 PsyOps 아이템
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const tf = result.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    // swap 미적용: items[0].apiName 그대로 일반.
    expect(tf.items[0].apiName).toBe('TFT17_Item_PsyOps_DroneMod');
  });

  it('초능력 2명 ((4) tier 비활성) + 초능력 unit 장착 → swap 안 함', () => {
    const team: PlacedChampion[] = [
      placed(apViktor, 0, 0, [droneMod]),
      placed(apPyke, 1, 0),
      placed(apTwistedFate, 2, 0), // 비-초능력
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const viktor = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Viktor')!;
    // (4) tier 미활성 → swap 안 함
    expect(viktor.items[0].apiName).toBe('TFT17_Item_PsyOps_DroneMod');
  });

  it('초능력 4명 + 초능력 unit 여러 PsyOps 아이템 장착 → 모두 _Radiant 로 swap', () => {
    const team: PlacedChampion[] = [
      placed(apViktor, 0, 0, [droneMod, targetlockMod]),
      placed(apPyke, 1, 0),
      placed(apMasterYi, 2, 0),
      placed(apGragas, 3, 0),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const viktor = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Viktor')!;
    expect(viktor.items[0].apiName).toBe('TFT17_Item_PsyOps_DroneMod_Radiant');
    expect(viktor.items[1].apiName).toBe('TFT17_Item_PsyOps_TargetlockMod_Radiant');
  });

  it('Radiant 변종은 빌더 catalog 에서 제외됨 (loadServerCatalogs disabledContent 필터)', () => {
    // disabledContent.ts 의 DISABLED_ITEM_API_NAMES 에 등록된 _Radiant 변종 6종은
    // serverCatalogs.items 결과에 포함되지 않음.
    const radiantApis = [
      'TFT17_Item_PsyOps_DroneMod_Radiant',
      'TFT17_Item_PsyOps_TargetlockMod_Radiant',
      'TFT17_Item_PsyOps_SympatheticImplantMod_Radiant',
      'TFT17_Item_PsyOps_ChemicalCapacitorMod_Radiant',
      'TFT17_Item_PsyOps_GrenadeMod_Radiant',
      'TFT17_Item_PsyOps_SemiconductorMod_Radiant',
    ];
    for (const api of radiantApis) {
      expect(items.find(i => i.apiName === api)).toBeUndefined();
    }
  });
});
