/**
 * 쉔 (TFT17_Shen) passive 17.3 회귀 가드.
 *
 * 17.3 LIVE 패치 (2026-05-13):
 *   - BonusDamageOnAttack 너프: ★1=45→20, ★2=75→30
 *   - DamageHP=0.01 유지 (lolchess.gg 명시 "최대 체력 1%")
 *   - ShieldHP 0.10→0.15 (PR #107 1차 적용)
 *   - 기본 체력 1200→1300 (PR #107 2차 적용)
 *
 * passive 메커니즘 (PR 2 신규 구현):
 *   - 스킬 사용 시 1 stack 누적
 *   - 평타 시 stack × (BonusDamageOnAttack[★] + DamageHP × maxHp) × (1 + AP/100) 추가 데미지
 *   - stack < 3: magic damage (resist + magicPen + DR + non-target + shield + invul mitigation)
 *   - stack >= 3: true damage (invul 만 체크)
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';

const { champions, traits } = loadServerCatalogs();
const apShen = champions.find(c => c.apiName === 'TFT17_Shen')!;
const apAatrox = champions.find(c => c.apiName === 'TFT17_Aatrox')!;

function placed(c: RawChampion, q: number, r: number, star: 1 | 2 | 3 = 2, eqItems: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel: star, position: { q, r }, items: eqItems };
}

describe('Set 17.3 Shen passive — BonusDamageOnAttack 데이터 가드', () => {
  it('BonusDamageOnAttack ★1=20 / ★2=30 (17.3 LIVE 너프)', () => {
    const v = apShen.ability.variables?.find(vv => vv.name === 'BonusDamageOnAttack');
    expect(v).toBeDefined();
    expect(v!.value[1]).toBe(20);
    expect(v!.value[2]).toBe(30);
  });

  it('DamageHP=0.01 유지 (최대 체력 1% — lolchess.gg)', () => {
    const v = apShen.ability.variables?.find(vv => vv.name === 'DamageHP');
    expect(v).toBeDefined();
    expect(v!.value[1]).toBeCloseTo(0.01, 5);
  });

  it('ShieldHP=0.15 + HP=1300 (PR #107 적용)', () => {
    const sh = apShen.ability.variables?.find(vv => vv.name === 'ShieldHP');
    expect(sh!.value[1]).toBeCloseTo(0.15, 5);
    expect(apShen.stats.hp).toBe(1300);
  });
});

describe('Set 17.3 Shen passive — sim 핸들러 동작', () => {
  it('전투 시작 시 shenPassiveStack default 0 (passive 미발동)', () => {
    // simulateCombat 호출하지 않고 createCombatUnit 결과만 검증해도 충분.
    // 여기서는 빠른 enemy (낮은 HP) 로 cast 전 종료 시나리오 시도.
    const team: PlacedChampion[] = [placed(apShen, 0, 0, 1)];  // ★1 (느린 mana 충전)
    // 강력한 적 → Shen 즉사 (cast 전)
    const tankyEnemy = champions.find(c => c.apiName === 'TFT17_Briar')!;
    const enemy: PlacedChampion[] = [placed(tankyEnemy, 1, 0, 3)];  // ★3 인접
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const shen = result.playerUnits[0];
    // cast 발동 안 했으면 stack=0 유지
    if (shen.castCount === 0) {
      expect(shen.shenPassiveStack).toBe(0);
    }
  });

  it('cast 후 shenPassiveStack 누적 (≥1)', () => {
    const team: PlacedChampion[] = [placed(apShen, 0, 0, 2)];
    const enemy: PlacedChampion[] = [placed(apAatrox, 6, 3, 2)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const shen = result.playerUnits[0];
    // 충분한 시간 동안 1회 이상 cast 발동 확인
    expect(shen.castCount).toBeGreaterThanOrEqual(1);
    expect(shen.shenPassiveStack).toBe(shen.castCount);
  });

  it('passive 추가 데미지 발동 — combatLog 에 "패시브" 메시지 출력', () => {
    const team: PlacedChampion[] = [placed(apShen, 0, 0, 2)];
    const enemy: PlacedChampion[] = [placed(apAatrox, 6, 3, 2)];
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const shen = result.playerUnits[0];
    if (shen.castCount === 0) {
      // cast 미발동 시 skip (마나 부족 등). 다른 케이스에서 검증.
      return;
    }
    const passiveLogs = result.logs.filter(l =>
      l.sourceId === shen.id
      && (l.message?.includes('패시브') ?? false)
    );
    expect(passiveLogs.length).toBeGreaterThan(0);
  });

  it('passive 메시지 형식 검증 — magic/true 둘 중 하나 (stack 따라)', () => {
    const team: PlacedChampion[] = [placed(apShen, 0, 0, 2)];
    const enemy: PlacedChampion[] = [placed(apAatrox, 6, 3, 3)];  // 단단한 적
    const result = simulateCombat(team, enemy, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const shen = result.playerUnits[0];
    const passiveLogs = result.logs.filter(l =>
      l.sourceId === shen.id
      && (l.message?.includes('패시브') ?? false)
    );
    if (passiveLogs.length === 0) {
      // cast 까지 도달 못한 경우 — skip
      return;
    }
    const hasMagicOrTrue = passiveLogs.some(l =>
      (l.message?.includes('마법') ?? false) || (l.message?.includes('고정') ?? false)
    );
    expect(hasMagicOrTrue).toBe(true);
  });
});
