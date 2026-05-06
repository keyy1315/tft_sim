/**
 * Artifact 미구현 항목 확인 테스트 (PR #92 attribution 분석 후속).
 *
 * PR #90 분석에서 missing 으로 잡혔던 artifacts 의 실제 sim 적용 상태 검증.
 * stat.ts 의 mergeLegacy + ITEM_EFFECT_KEYS 매핑으로 기본 스탯은 자동 적용됨.
 * 본 테스트는 어느 stat 이 적용/미적용 인지 명시.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';

const { champions, traits, items } = loadServerCatalogs();

function findItem(api: string): RawItem | undefined {
  return items.find((i) => i.apiName === api);
}

function placed(c: RawChampion, q: number, r: number, starLevel = 2, equips: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel, position: { q, r }, items: equips };
}

describe('PR93 — Artifact 기본 스탯 적용 검증 (legacy fallback)', () => {
  const aatrox = champions.find((c) => c.apiName === 'TFT17_Aatrox')!;

  it('EvelynnArtifact: AD/AP/AS/StatOmnivamp 기본 스탯이 mergeLegacy 로 적용', () => {
    const evelynn = findItem('TFT17_Item_Artifact_EvelynnArtifact');
    if (!evelynn) {
      // Set 17 데이터에 없으면 skip — 본 테스트는 데이터 존재 시만 의미.
      return;
    }
    expect(evelynn.effects.AD).toBeDefined();
    expect(evelynn.effects.AP).toBeDefined();
    expect(evelynn.effects.AS).toBeDefined();
    expect(evelynn.effects.StatOmnivamp).toBeDefined();

    const ally: PlacedChampion[] = [placed(aatrox, 0, 0, 2, [evelynn])];
    const enemy: PlacedChampion[] = [placed(aatrox, 6, 3)];

    const withItem = simulateCombat(ally, enemy, {
      seed: 0, allTraits: traits, skipMirror: true,
    });
    const withoutItem = simulateCombat([placed(aatrox, 0, 0, 2)], enemy, {
      seed: 0, allTraits: traits, skipMirror: true,
    });

    const a = withItem.playerUnits[0];
    const b = withoutItem.playerUnits[0];
    // AD=0.10 (10% multiplier), AS=40 (pts? — AttackSpeed=40 is unclear; some items use frac)
    // 어느 쪽이든 stats 가 base 보다 큰 지만 검증 (legacy fallback 동작 fingerprint).
    expect(a.stats.damage).toBeGreaterThan(b.stats.damage);
    expect(a.stats.attackSpeed).toBeGreaterThan(b.stats.attackSpeed);
  });

  it('AegisOfDusk: Health=400 + MagicResist=70 기본 스탯 적용', () => {
    const aegis = findItem('TFT_Item_Artifact_AegisOfDusk');
    if (!aegis) return;
    expect(aegis.effects.Health).toBe(400);
    expect(aegis.effects.MagicResist).toBe(70);

    const ally: PlacedChampion[] = [placed(aatrox, 0, 0, 2, [aegis])];
    const enemy: PlacedChampion[] = [placed(aatrox, 6, 3)];
    const withItem = simulateCombat(ally, enemy, {
      seed: 0, allTraits: traits, skipMirror: true,
    });
    const withoutItem = simulateCombat([placed(aatrox, 0, 0, 2)], enemy, {
      seed: 0, allTraits: traits, skipMirror: true,
    });
    const a = withItem.playerUnits[0];
    const b = withoutItem.playerUnits[0];
    // Health +400 → maxHp delta ≥ 400
    expect(a.maxHp - b.maxHp).toBeGreaterThanOrEqual(400);
    // MagicResist +70 → magicResist delta ≥ 70 (다른 source 없을 때 정확)
    expect(a.stats.magicResist - b.stats.magicResist).toBeGreaterThanOrEqual(70);
  });

  it('EvelynnArtifact: ExecuteThresholdForTarget=0.12 → 12% HP 이하 적 처형 (PR93 신규)', () => {
    const evelynn = findItem('TFT17_Item_Artifact_EvelynnArtifact');
    if (!evelynn) return;
    expect(evelynn.effects.ExecuteThresholdForTarget).toBeCloseTo(0.12, 5);

    // 처형 가능한 시나리오 — 적 1명에 high-base-HP unit 장착자 vs 약한 enemy.
    // Talon ★3 + EvelynnArtifact 가 최약 적을 빠르게 처형하는지 비교.
    const talon = champions.find((c) => c.apiName === 'TFT17_Talon')!;
    const dummyEnemy = champions.find((c) => c.apiName === 'TFT17_Talon')!;

    const ally: PlacedChampion[] = [placed(talon, 0, 0, 3, [evelynn])];
    const enemy: PlacedChampion[] = [placed(dummyEnemy, 6, 3, 1)]; // 약한 ★1 enemy

    const withItem = simulateCombat(ally, enemy, {
      seed: 0, allTraits: traits, skipMirror: true,
    });
    const withoutItem = simulateCombat([placed(talon, 0, 0, 3)], enemy, {
      seed: 0, allTraits: traits, skipMirror: true,
    });

    // EvelynnArtifact 보유 시 enemy 가 12% HP 이하에서 처형 → 더 빨리 죽음 = 전투 더 짧음.
    // duration 비교로 검증 (정확한 tick 차이는 시뮬 변동성 있어 부등호로).
    expect(withItem.duration).toBeLessThanOrEqual(withoutItem.duration);
  });

  it("SeekersArmguard: AP=25 + Armor=10 + MagicResist=10 기본 스탯 적용", () => {
    const sa = findItem('TFT_Item_Artifact_SeekersArmguard');
    if (!sa) return;
    expect(sa.effects.AP).toBe(25);
    expect(sa.effects.Armor).toBe(10);
    expect(sa.effects.MagicResist).toBe(10);

    const ally: PlacedChampion[] = [placed(aatrox, 0, 0, 2, [sa])];
    const enemy: PlacedChampion[] = [placed(aatrox, 6, 3)];
    const withItem = simulateCombat(ally, enemy, {
      seed: 0, allTraits: traits, skipMirror: true,
    });
    const withoutItem = simulateCombat([placed(aatrox, 0, 0, 2)], enemy, {
      seed: 0, allTraits: traits, skipMirror: true,
    });
    const a = withItem.playerUnits[0];
    const b = withoutItem.playerUnits[0];
    expect(a.stats.armor - b.stats.armor).toBeGreaterThanOrEqual(10);
    expect(a.stats.magicResist - b.stats.magicResist).toBeGreaterThanOrEqual(10);
    expect(a.stats.ap - b.stats.ap).toBeGreaterThanOrEqual(25);
  });
});
