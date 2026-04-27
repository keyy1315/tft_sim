import { describe, it, expect } from 'vitest';
import { runN } from '@/lib/validation/nRunSimulator';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { RawChampion } from '@/types';
import type { NRunInput } from '@/types/validation';

const { champions, traits } = loadServerCatalogs();

function makeInput(): NRunInput {
  const jinx = champions.find(c => c.apiName === 'TFT17_Jinx')!;
  const leona = champions.find(c => c.apiName === 'TFT17_Leona')!;
  return {
    playerTeam: [{ champion: jinx, starLevel: 2, position: { q: 0, r: 3 }, items: [] }],
    opponentTeam: [{ champion: leona, starLevel: 2, position: { q: 3, r: 3 }, items: [] }],
    simulateOptions: { allTraits: traits, skipMirror: true, stageNumber: 3 },
  };
}

describe('nRunSimulator.runN', () => {
  it('returns Distribution with correct nRuns', () => {
    const dist = runN(makeInput(), 5, 0);
    expect(dist.nRuns).toBe(5);
    expect(dist.winnerCounts.player + dist.winnerCounts.opponent + dist.winnerCounts.draw).toBe(5);
  });

  it('is deterministic for same seedBase', () => {
    const a = runN(makeInput(), 5, 42);
    const b = runN(makeInput(), 5, 42);
    expect(a.winnerCounts).toEqual(b.winnerCounts);
    expect(a.playerWinRate).toBe(b.playerWinRate);
    expect(a.combatDurationTicks.mean).toBe(b.combatDurationTicks.mean);
  });

  it('differs with different seedBase', () => {
    const a = runN(makeInput(), 5, 0);
    const b = runN(makeInput(), 5, 1000);
    // Not guaranteed different in every scenario, but samples should not all match
    const aSamples = a.combatDurationTicks.samples.join(',');
    const bSamples = b.combatDurationTicks.samples.join(',');
    expect(aSamples === bSamples && aSamples.length > 0).toBe(false);
  });

  it('collects per-unit damage stats keyed by hex', () => {
    const dist = runN(makeInput(), 3, 0);
    expect(dist.playerDamage.has('0,3')).toBe(true);
    const jinxStats = dist.playerDamage.get('0,3')!;
    expect(jinxStats.samples).toHaveLength(3);
    expect(jinxStats.mean).toBeGreaterThanOrEqual(0);
  });

  it('collects survivor HpStats per team', () => {
    const dist = runN(makeInput(), 3, 0);
    const leonaHp = dist.survivors.opponent.get('3,3');
    expect(leonaHp).toBeDefined();
    expect(leonaHp!.aliveCount).toBeGreaterThanOrEqual(0);
    expect(leonaHp!.aliveCount).toBeLessThanOrEqual(3);
  });

  it('TFT16_Galio entry 가 앞에 있어도 hex key 가 올바른 유닛에 매핑됨', () => {
    // simulateCombat 는 TFT16_Galio 를 placed 배열에서 필터링 후 인덱스로
    // CombatUnit.id 부여. nRunSimulator 도 같은 필터를 거쳐 id→hexKey 매핑을
    // 만들지 않으면 모든 후속 unit 의 stat 가 잘못된 hex 에 귀속.
    const jinx = champions.find(c => c.apiName === 'TFT17_Jinx')!;
    const leona = champions.find(c => c.apiName === 'TFT17_Leona')!;
    // Galio raw stub — sim 이 필터링하므로 stats/ability 정확성은 무관하지만
    // RawChampion 타입은 충족해야 한다.
    const galio: RawChampion = {
      name: 'Galio', apiName: 'TFT16_Galio', cost: 0, traits: [], role: null,
      stats: { armor: 0, attackSpeed: 0.5, critChance: 0, critMultiplier: 1.4, damage: 0, hp: 1, initialMana: 0, magicResist: 0, mana: 0, range: 1 },
      ability: { name: '', desc: '', icon: '', variables: [] },
    };
    const input: NRunInput = {
      playerTeam: [
        { champion: galio, starLevel: 1, position: { q: -2, r: 3 }, items: [] },  // 인덱스 0 — 필터 대상
        { champion: jinx, starLevel: 2, position: { q: 0, r: 3 }, items: [] },     // 필터 후 인덱스 0
      ],
      opponentTeam: [{ champion: leona, starLevel: 2, position: { q: 3, r: 3 }, items: [] }],
      simulateOptions: { allTraits: traits, skipMirror: true, stageNumber: 3 },
    };
    const dist = runN(input, 1, 0);
    // jinx 는 필터 후 player-0 → hexKey '0,3' 로 등록돼야 함.
    expect(dist.playerDamage.has('0,3')).toBe(true);
    expect(dist.playerDamage.has('-2,3')).toBe(false);
  });
});

describe('runN smoke test with real late-game round', () => {
  it('completes late-game round within 5s at N=3', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const raw = fs.readFileSync(
      path.join(process.cwd(), 'actual-data', 'game-20260423-001.json'),
      'utf-8',
    );
    const data = JSON.parse(raw);
    const pvpRounds = data.rounds.filter((r: { type: string }) => r.type === 'pvp');
    const late = pvpRounds[pvpRounds.length - 1];

    // Smoke test — items empty for speed. Real adapter test is in schemaAdapter.test.ts
    const ally = late.playerTeam.units
      .map((u: { championId: string; starLevel: 1 | 2 | 3; hex: { q: number; r: number } }) => ({
        champion: champions.find(c => c.apiName === u.championId)!,
        starLevel: u.starLevel,
        position: u.hex,
        items: [],
      }))
      .filter((p: { champion: RawChampion | undefined }) => !!p.champion);
    const enemy = late.opponent.units
      .map((u: { championId: string; starLevel: 1 | 2 | 3; hex: { q: number; r: number } }) => ({
        champion: champions.find(c => c.apiName === u.championId)!,
        starLevel: u.starLevel,
        position: u.hex,
        items: [],
      }))
      .filter((p: { champion: RawChampion | undefined }) => !!p.champion);

    const t0 = performance.now();
    const dist = runN(
      { playerTeam: ally, opponentTeam: enemy, simulateOptions: { allTraits: traits, skipMirror: true, stageNumber: 5 } },
      3,
      0,
    );
    const ms = performance.now() - t0;

    expect(dist.nRuns).toBe(3);
    expect(ms).toBeLessThan(5000);
  }, 10_000);
});
