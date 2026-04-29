/**
 * F2 회귀 가드 — GrenadeMod_Radiant IncreasedHealing 0.22 (회복량 +22%).
 *
 * 17.2 게임 spec:
 *   유기물 보존기 Radiant: (4) 초능력 + 초능력 unit 장착 시 회복량 22% 증폭.
 *
 * 시뮬 구현:
 *   - GrenadeMod_Radiant statPatch.healAmp = 0.22 적용
 *   - PsyOps (4) tier + 초능력 unit 자동 swap → _Radiant 사용 → healAmp 적용
 *   - execHeal 에서 (1 + healAmp) 곱셈으로 회복량 증폭
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';

const { champions, traits, items } = loadServerCatalogs();
const apViktor = champions.find(c => c.apiName === 'TFT17_Viktor')!;
const apPyke = champions.find(c => c.apiName === 'TFT17_Pyke')!;
const apMasterYi = champions.find(c => c.apiName === 'TFT17_MasterYi')!;
const apGragas = champions.find(c => c.apiName === 'TFT17_Gragas')!;
const apTwistedFate = champions.find(c => c.apiName === 'TFT17_TwistedFate')!;
const dummyEnemy = champions.find(c => c.apiName === 'TFT17_Aatrox')!;
const grenadeMod = items.find(i => i.apiName === 'TFT17_Item_PsyOps_GrenadeMod')!;

function placed(c: RawChampion, q: number, r: number, eqItems: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel: 2, position: { q, r }, items: eqItems };
}

describe('F2 — GrenadeMod IncreasedHealing 0.22 (Radiant 한정)', () => {
  it('PsyOps (4) tier + 초능력 unit + GrenadeMod → swap 후 healAmp=0.22 적용', () => {
    const team: PlacedChampion[] = [
      placed(apViktor, 0, 0, [grenadeMod]),
      placed(apPyke, 1, 0),
      placed(apMasterYi, 2, 0),
      placed(apGragas, 3, 0),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const viktor = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Viktor')!;
    // swap 발동 → _Radiant 적용 → healAmp 0.22
    expect(viktor.items[0].apiName).toBe('TFT17_Item_PsyOps_GrenadeMod_Radiant');
    expect(viktor.healAmp).toBeCloseTo(0.22, 2);
  });

  it('PsyOps (4) tier + 비-초능력 unit + GrenadeMod → swap 안 함, healAmp=0', () => {
    const team: PlacedChampion[] = [
      placed(apViktor, 0, 0),
      placed(apPyke, 1, 0),
      placed(apMasterYi, 2, 0),
      placed(apGragas, 3, 0),
      placed(apTwistedFate, 4, 0, [grenadeMod]), // 비-초능력
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const tf = result.playerUnits.find(u => u.champion.apiName === 'TFT17_TwistedFate')!;
    // 일반 GrenadeMod → healAmp 없음 (statPatch.healAmp 미정의)
    expect(tf.items[0].apiName).toBe('TFT17_Item_PsyOps_GrenadeMod');
    expect(tf.healAmp).toBe(0);
  });

  it('PsyOps (2) tier ((4) 미활성) + 초능력 unit + GrenadeMod → swap 안 함, healAmp=0', () => {
    const team: PlacedChampion[] = [
      placed(apViktor, 0, 0, [grenadeMod]),
      placed(apPyke, 1, 0),
      placed(apTwistedFate, 2, 0),
    ];
    const enemy = [placed(dummyEnemy, 6, 3)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const viktor = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Viktor')!;
    expect(viktor.items[0].apiName).toBe('TFT17_Item_PsyOps_GrenadeMod');
    expect(viktor.healAmp).toBe(0);
  });
});
