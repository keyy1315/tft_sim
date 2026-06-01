import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion } from '@/types';
import { offsetToAxial } from '@/types';

const { champions, traits } = loadServerCatalogs();

function findChamp(api: string): RawChampion {
  const c = champions.find((x) => x.apiName === api);
  if (!c) throw new Error(`champion ${api} missing`);
  return c;
}

function makeStargazerTeam(team: 'player' | 'enemy'): PlacedChampion[] {
  // PR10 spec — A팀 / B팀 각자 own-frame 에서 Mountain 강화 칸에 배치.
  // Mountain 패턴 r=0 cols {2,3,4,5} (A팀 own-frame).
  // 180° 회전 → B팀 own-frame tiles: r=3 cols {1,2,3,4}.
  // 별돌보미 챔프 3명 배치.
  const cols = team === 'player' ? [2, 3, 4] : [1, 2, 3];
  const row = team === 'player' ? 0 : 3;
  return [
    { champion: findChamp('TFT17_TwistedFate'), position: offsetToAxial({ row, col: cols[0] }), starLevel: 2, items: [] },
    { champion: findChamp('TFT17_Talon'), position: offsetToAxial({ row, col: cols[1] }), starLevel: 2, items: [] },
    { champion: findChamp('TFT17_Jax'), position: offsetToAxial({ row, col: cols[2] }), starLevel: 2, items: [] },
  ];
}

describe('simulateCombat — 팀별 별자리 분리', () => {
  it('A팀만 별자리 선택 + 별돌보미 활성 → A팀에만 변종 effect 적용', () => {
    const player = makeStargazerTeam('player');
    const enemy = makeStargazerTeam('enemy');
    const result = simulateCombat(player, enemy, {
      seed: 42,
      allTraits: traits,
      skipMirror: true,
      playerStargazerConstellation: 'mountain',
      // enemy 별자리 미지정 → base trait 만 활성, 변종 effect 미적용
    });
    // mountain 변종은 minUnits=3 부터 효과 — A팀 유닛 HP 가 강화되어야 함
    const playerHP = result.playerUnits.reduce((s, u) => s + u.maxHp, 0);
    const enemyHP = result.enemyUnits.reduce((s, u) => s + u.maxHp, 0);
    expect(playerHP).toBeGreaterThan(enemyHP);
  });

  it('양 팀 다른 별자리 → 각자 다른 변종 effect 받음', () => {
    const player = makeStargazerTeam('player');
    const enemy = makeStargazerTeam('enemy');
    const result1 = simulateCombat(player, enemy, {
      seed: 42, allTraits: traits, skipMirror: true,
      playerStargazerConstellation: 'mountain',
      enemyStargazerConstellation: 'mountain',
    });
    const result2 = simulateCombat(player, enemy, {
      seed: 42, allTraits: traits, skipMirror: true,
      playerStargazerConstellation: 'mountain',
      enemyStargazerConstellation: 'well',
    });
    const r1PlayerHP = result1.playerUnits.reduce((s, u) => s + u.maxHp, 0);
    const r1EnemyHP = result1.enemyUnits.reduce((s, u) => s + u.maxHp, 0);
    const r2EnemyHP = result2.enemyUnits.reduce((s, u) => s + u.maxHp, 0);
    // 양팀 mountain → 진영만 다르고 effect 동일
    expect(r1PlayerHP).toBe(r1EnemyHP);
    // player mountain / enemy well → enemy HP 는 mountain 만큼 강화되지 않음
    expect(r2EnemyHP).toBeLessThan(r1EnemyHP);
  });
});
