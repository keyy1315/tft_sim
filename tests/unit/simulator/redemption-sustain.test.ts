/**
 * 회귀 가드 — 정령의 형상(Redemption) sustain proc 모델링 (under-damage calibration).
 *
 * project_underdamage_calibration: 탱커 sustain(매초 잃은체력 2% 회복) 미반영 → 적 빨리 죽어
 * combat 단축 → AD 캐리 누적 데미지 컷. base HP 300/ManaRegen 2 는 legacy 로 이미 적용됐으나
 * registry 등록 시 legacy 멈추므로 statPatch 로 명시(codex P1 #217 교훈) + 누락 heal proc 추가.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { calculateStats } from '@/lib/simulator/systems/stat';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';

const { champions, traits, items } = loadServerCatalogs();
const tank = champions.find(c => c.apiName === 'TFT17_Shen')!;
const attacker = champions.find(c => c.apiName === 'TFT17_Xayah')!;
const redemption = items.find(i => i.apiName === 'TFT_Item_Redemption')!;

function placed(c: RawChampion, q: number, r: number, eq: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel: 2, position: { q, r }, items: eq };
}

describe('정령의 형상 (Redemption) sustain', () => {
  it('base 스탯 보존 — registry 등록 후에도 HP +300 (legacy 미적용 회귀 방지)', () => {
    const { stats: withItem } = calculateStats(tank, 2, [redemption], [], {});
    const { stats: noItem } = calculateStats(tank, 2, [], [], {});
    // flat HP 300 가산 (registry statPatch 명시로 보존)
    expect(withItem.hp - noItem.hp).toBeGreaterThanOrEqual(300);
  });

  it('heal proc — Redemption 보유 탱커가 더 오래 생존/높은 HP (매초 잃은체력 2% 회복)', () => {
    function survive(eq: RawItem[]): number {
      const r = simulateCombat([placed(tank, 0, 0, eq)], [placed(attacker, 6, 3)], {
        seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
      });
      const t = r.playerUnits.find(u => u.champion.apiName === 'TFT17_Shen')!;
      // 생존 시 현재 HP, 사망 시 0 — 생존력 지표
      return t.state === 'dead' ? 0 : t.currentHp;
    }
    // base HP 차이를 제거하려면 둘 다 동일 base 이므로, Redemption 의 heal proc 만으로
    // 생존 HP 가 더 높아야 함 (없을 때보다 회복분만큼 우위).
    expect(survive([redemption])).toBeGreaterThan(survive([]));
  });
});
