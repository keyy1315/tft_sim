/**
 * simulateCombat per-round performance benchmark (Phase 0 / Task 0).
 *
 * 목적: 실측 라운드 1회를 10번 돌려 평균 per-round 실행 시간을 측정.
 *       Phase 4 에서 채택할 N(반복 횟수) 가정을 검증하기 위한 베이스라인.
 *
 * 실행:
 *   pnpm test tests/calibration/simulate-round-bench.test.ts --run
 */

import { describe, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import type { RawChampion, RawTrait, RawTraitsData } from '@/types';

const PUBLIC_DATA = path.join(process.cwd(), 'public', 'data');

function readJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(PUBLIC_DATA, rel), 'utf-8')) as T;
}

function loadChampionsSync(): RawChampion[] {
  const raw = readJson<RawChampion[] | { champions?: RawChampion[] }>(
    'tft_set17_champions.json'
  );
  return Array.isArray(raw) ? raw : raw.champions ?? [];
}

function loadTraitsSync(): RawTrait[] {
  return readJson<RawTraitsData>('tft_set17_traits.json').traits;
}

describe('simulateCombat benchmark', () => {
  it('measures 10 runs on a late-game pvp round', () => {
    // game-20260424-001.json 은 아직 upstream 에 없어서 23일 파일 사용 (E2)
    const gamePath = path.join(
      process.cwd(),
      'actual-data',
      'game-20260423-001.json'
    );
    const data = JSON.parse(fs.readFileSync(gamePath, 'utf-8'));
    const pvpRounds = data.rounds.filter(
      (r: { type: string }) => r.type === 'pvp'
    );
    const late = pvpRounds[pvpRounds.length - 1]; // 팀 구성이 가장 꽉 찬 라운드

    const champions = loadChampionsSync();
    const traits = loadTraitsSync();

    // 벤치에서는 아이템 배열을 비워두고 엔진 코어 비용만 측정.
    // 실제 Phase 4 테스트에서는 아이템 포함.
    const toPlaced = (u: {
      championId: string;
      starLevel: 1 | 2 | 3;
      hex: { q: number; r: number };
    }) => {
      const champion = champions.find(c => c.apiName === u.championId);
      if (!champion) return null;
      return { champion, starLevel: u.starLevel, position: u.hex, items: [] };
    };

    const ally = late.playerTeam.units
      .map(toPlaced)
      .filter((p: unknown): p is NonNullable<ReturnType<typeof toPlaced>> => !!p);
    const enemy = late.opponent.units
      .map(toPlaced)
      .filter((p: unknown): p is NonNullable<ReturnType<typeof toPlaced>> => !!p);
    const stage = parseInt(late.roundName.split('-')[0], 10);

    const t0 = performance.now();
    for (let i = 0; i < 10; i++) {
      simulateCombat(ally, enemy, {
        seed: i,
        allTraits: traits,
        skipMirror: true,
        stageNumber: stage,
      });
    }
    const ms = performance.now() - t0;
    // 순수 측정 — calibration 예외 (E3)
    // eslint-disable-next-line no-console
    console.log(
      `[BENCH] 10 runs = ${ms.toFixed(0)}ms (avg ${(ms / 10).toFixed(0)}ms per round, stage=${stage}, ally=${ally.length}, enemy=${enemy.length})`
    );
  });
});
