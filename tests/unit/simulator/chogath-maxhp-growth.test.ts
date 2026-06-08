/**
 * 회귀 가드 — 초가스 응축 전투 중 maxHp 영구 증가 (BonusHealthPerCast / BonusHealthOnKill).
 *
 * desc "최대 체력을 영구적으로 BonusHealthPerCast 획득. 이 효과로 처치하면 대신 BonusHealthOnKill 획득".
 * 버그: 전투 중 cast/처치 시 maxHp 증가 sim 부재 (grep 0). chogath_hp(:359 applyPermanentStacks)는
 *   라운드 간 입력만이고 전투 내 자체 증가 없음.
 * fix: cast loop 사망 처리 직후 — 처치 시 BonusHealthOnKill, 아니면 BonusHealthPerCast → maxHp+currentHp 가산.
 *
 * Chogath ingest (PR #207) lint P1 발견 → sim fix.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion } from '@/types';

const { champions, traits } = loadServerCatalogs();
const chogath = champions.find(c => c.apiName === 'TFT17_Chogath')!;
const enemy = champions.find(c => c.apiName === 'TFT17_Graves')!; // 딜러 적 — Chogath 피해받아 mana 충전 → cast

function placed(c: RawChampion, q: number, r: number, starLevel = 2): PlacedChampion {
  return { champion: c, starLevel, position: { q, r }, items: [] };
}

describe('초가스 응축 전투 중 maxHp 영구 증가 (PR #207 lint P1 fix)', () => {
  it('Chogath 가 cast 발동 후 maxHp 증가 (초기 대비 커짐)', () => {
    const team: PlacedChampion[] = [placed(chogath, 4, 3, 2)];
    const enemyTeam: PlacedChampion[] = [placed(enemy, 4, 4, 2)];
    const result = simulateCombat(team, enemyTeam, {
      seed: 0, allTraits: traits, skipMirror: true, stageNumber: 5,
    });
    const c = result.playerUnits.find(u => u.champion.apiName === 'TFT17_Chogath')!;
    expect(c).toBeDefined();
    expect(result.duration).toBeGreaterThan(0);
    // ★2 base maxHp = 700 × 1.8 = 1260 (싸움꾼 단독 비활성). 응축 cast 발동 시
    // BonusHealthPerCast(★2=18)/OnKill(★2=40) 만큼 maxHp 영구 증가 → base 초과.
    // fix 전(미반영)이면 maxHp == 1260 (증가 없음). 실측 1278 (cast 1회 +18).
    expect(c.maxHp).toBeGreaterThan(1260);
  });

  it('BonusHealthPerCast / BonusHealthOnKill raw filler 정합', () => {
    const vars = chogath.ability.variables ?? [];
    const perCast = vars.find(v => v.name === 'BonusHealthPerCast');
    const onKill = vars.find(v => v.name === 'BonusHealthOnKill');
    // BonusHealthPerCast [0,12,18,33] v0=0 filler → ★1=12/★2=18/★3=33
    expect(perCast?.value[1]).toBe(12);
    expect(perCast?.value[2]).toBe(18);
    expect(perCast?.value[3]).toBe(33);
    // BonusHealthOnKill [35,30,40,70] v0(35)>v1(30) filler → ★1=30/★2=40/★3=70
    expect(onKill?.value[1]).toBe(30);
    expect(onKill?.value[2]).toBe(40);
    expect(onKill?.value[3]).toBe(70);
  });
});
