/**
 * 전투 초기 스냅샷 보존 — tick 0 이전 배치 상태를 snapshots[0] 에 기록하는지 검증.
 *
 * 기능: initial-snapshot-fix
 *
 * 핵심 보증:
 * - snapshots[0].tick === -1 (pre-combat 표식)
 * - snapshots[0].units[*].position === 배치 당시 position (이동 적용 전)
 * - snapshots[1].tick === 0 (tick 0 처리 후 상태, 기존 snapshots[0] 역할)
 * - 결정론 유지 — 동일 시드 2회 실행 시 스냅샷 배열 완전 일치
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type {
  RawChampion, RawItemsData, RawTraitsData, PlacedChampion, HexCoord,
} from '@/types';
import { offsetToAxial } from '@/types';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';

/* ──────────────── Data 로더 ──────────────── */

const DATA_DIR = path.join(process.cwd(), 'public', 'data');

function readJson<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf-8')) as T;
}

const champsRaw = readJson<RawChampion[] | { champions?: RawChampion[] }>(
  'tft_set17_champions.json',
);
const CHAMPIONS: RawChampion[] = Array.isArray(champsRaw)
  ? champsRaw
  : (champsRaw.champions ?? []);
const TRAITS: RawTraitsData = readJson<RawTraitsData>('tft_set17_traits.json');
// 아이템 파일 존재 확인(로드 에러 감지) — simulateCombat 는 items 옵션 미필요.
readJson<RawItemsData>('tft_set17_items.json');

const CHAMP = (api: string): RawChampion => {
  const c = CHAMPIONS.find(x => x.apiName === api);
  if (!c) throw new Error(`champion not found: ${api}`);
  return c;
};

/* ──────────────── 시나리오 빌더 ──────────────── */

/** 아트록스 — 돌진/대쉬 없는 근접 (range=1) Set17 챔피언. 배치 위치 자유 지정. */
function aatrox(pos: HexCoord): PlacedChampion {
  return {
    champion: CHAMP('TFT17_Aatrox'),
    position: pos,
    starLevel: 2,
    items: [],
  };
}

/** 포피 — 돌진 없는 범위 1 탱커. 거리 멀리 두기 위한 적 유닛. */
function poppy(pos: HexCoord): PlacedChampion {
  return {
    champion: CHAMP('TFT17_Poppy'),
    position: pos,
    starLevel: 2,
    items: [],
  };
}

function runScenario(
  player: PlacedChampion[],
  enemy: PlacedChampion[],
  seed = 42,
) {
  return simulateCombat(player, enemy, {
    seed,
    allTraits: TRAITS.traits,
    skipMirror: true,
  });
}

/* ──────────────── Tests ──────────────── */

describe('초기 스냅샷 — 기본 보증', () => {
  it('snapshots[0].tick === -1 (pre-combat 표식)', () => {
    // player r=4..7, enemy r=0..3 관례. skipMirror=true 로 명시적 위치.
    const playerPos = offsetToAxial({ row: 4, col: 0 });
    const enemyPos = offsetToAxial({ row: 0, col: 6 });
    const result = runScenario([aatrox(playerPos)], [poppy(enemyPos)]);

    expect(result.snapshots.length).toBeGreaterThan(1);
    expect(result.snapshots[0].tick).toBe(-1);
    expect(result.snapshots[0].events).toEqual([]);
  });

  it('snapshots[0].units[*].position 이 배치 당시 위치와 일치 (이동 전)', () => {
    const playerPos = offsetToAxial({ row: 4, col: 0 });
    const enemyPos = offsetToAxial({ row: 0, col: 6 });
    const result = runScenario([aatrox(playerPos)], [poppy(enemyPos)]);

    const playerId = result.playerUnits[0].id;
    const enemyId = result.enemyUnits[0].id;

    // 배치 위치 그대로 (tick 0 에서 이동이 발생했어도 초기 스냅샷에는 미반영)
    expect(result.snapshots[0].units[playerId].position).toEqual(playerPos);
    expect(result.snapshots[0].units[enemyId].position).toEqual(enemyPos);
  });

  it('snapshots[1].tick === 0 (tick 0 처리 후가 index 1 로 이동)', () => {
    const playerPos = offsetToAxial({ row: 4, col: 0 });
    const enemyPos = offsetToAxial({ row: 0, col: 6 });
    const result = runScenario([aatrox(playerPos)], [poppy(enemyPos)]);

    expect(result.snapshots[1].tick).toBe(0);
  });

  it('배치 원본 스냅샷 이후 유닛이 실제로 이동했음을 확인 (패치 효과 가시화)', () => {
    // 거리 2 초과 배치 → tick 0 에 일반 이동 1칸 발생 → snapshots[1] 은 달라져야 함.
    const playerPos = offsetToAxial({ row: 4, col: 0 });
    const enemyPos = offsetToAxial({ row: 2, col: 0 });  // 거리 2
    const result = runScenario([aatrox(playerPos)], [poppy(enemyPos)]);

    const playerId = result.playerUnits[0].id;
    const initialPos = result.snapshots[0].units[playerId].position;
    const afterTick0Pos = result.snapshots[1].units[playerId].position;

    // 초기는 배치 위치, tick 0 후는 1칸 전진 — 두 스냅샷이 다름이 패치의 의도.
    // 공격 사거리 밖(거리 2 > range 1)이라 tick 0 에 이동 경로 진입.
    expect(initialPos).toEqual(playerPos);
    expect(afterTick0Pos).not.toEqual(initialPos);
  });
});

describe('초기 스냅샷 — 결정론 유지', () => {
  it('동일 seed 2회 실행 시 snapshots 배열 동일', () => {
    const playerPos = offsetToAxial({ row: 4, col: 0 });
    const enemyPos = offsetToAxial({ row: 2, col: 0 });
    const a = runScenario([aatrox(playerPos)], [poppy(enemyPos)], 777);
    const b = runScenario([aatrox(playerPos)], [poppy(enemyPos)], 777);

    expect(b.snapshots.length).toBe(a.snapshots.length);
    expect(b.snapshots[0]).toEqual(a.snapshots[0]);
    expect(b.snapshots[1]).toEqual(a.snapshots[1]);
    expect(b.duration).toBe(a.duration);
    expect(b.winner).toBe(a.winner);
  });
});

describe('초기 스냅샷 — 다수 유닛', () => {
  it('모든 플레이어/적 유닛이 배치 위치로 초기 스냅샷에 기록됨', () => {
    const p1 = aatrox(offsetToAxial({ row: 4, col: 0 }));
    const p2 = aatrox(offsetToAxial({ row: 4, col: 3 }));
    const e1 = poppy(offsetToAxial({ row: 0, col: 0 }));
    const e2 = poppy(offsetToAxial({ row: 0, col: 3 }));
    const result = runScenario([p1, p2], [e1, e2]);

    const p1Id = result.playerUnits[0].id;
    const p2Id = result.playerUnits[1].id;
    const e1Id = result.enemyUnits[0].id;
    const e2Id = result.enemyUnits[1].id;

    expect(result.snapshots[0].units[p1Id].position).toEqual(p1.position);
    expect(result.snapshots[0].units[p2Id].position).toEqual(p2.position);
    expect(result.snapshots[0].units[e1Id].position).toEqual(e1.position);
    expect(result.snapshots[0].units[e2Id].position).toEqual(e2.position);
  });
});
