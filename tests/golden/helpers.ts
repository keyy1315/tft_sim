/**
 * Golden Test Helpers
 *
 * PlacedChampion 배열을 시나리오 선언에서 쉽게 만들기 위한 helper 모음.
 * 챔피언/아이템 JSON을 apiName 인덱싱해 한 번 로드 후 재사용.
 */

import fs from 'node:fs';
import path from 'node:path';
import type {
  RawChampion,
  RawItem,
  RawItemsData,
  RawTrait,
  RawTraitsData,
  PlacedChampion,
  HexCoord,
  CombatResult,
  CombatUnit,
} from '@/types';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';

/* ──────────────── Data loading (once per test process) ──────────────── */

const DATA_DIR = path.join(process.cwd(), 'public', 'data');

function readJson<T>(filename: string): T {
  const raw = fs.readFileSync(path.join(DATA_DIR, filename), 'utf-8');
  return JSON.parse(raw) as T;
}

interface ChampionsFile {
  champions?: RawChampion[];
}

const championsRaw = readJson<RawChampion[] | ChampionsFile>('tft_set17_champions.json');
const CHAMPIONS: RawChampion[] = Array.isArray(championsRaw)
  ? championsRaw
  : championsRaw.champions ?? [];
const ITEMS: RawItemsData = readJson<RawItemsData>('tft_set17_items.json');
const TRAITS: RawTraitsData = readJson<RawTraitsData>('tft_set17_traits.json');

const CHAMPIONS_BY_API: Map<string, RawChampion> = new Map(
  CHAMPIONS.map(c => [c.apiName, c]),
);
const ITEMS_BY_API: Map<string, RawItem> = new Map(
  ITEMS.items.map(i => [i.apiName, i]),
);

/** 테스트용 — 전 trait 배열 반환 (simulateCombat options.allTraits) */
export function allTraits(): RawTrait[] {
  return TRAITS.traits;
}

/* ──────────────── Scenario DSL ──────────────── */

export interface ScenarioUnit {
  /** 챔피언 apiName (예: 'TFT17_Aatrox') */
  apiName: string;
  /** Hex 좌표 (axial q,r). enemy 팀은 자동 mirror 되지 않으므로 skipMirror 기본 false 사용 */
  position: HexCoord;
  starLevel?: 1 | 2 | 3;
  /** 아이템 apiName 배열 (최대 3개) */
  items?: string[];
}

export interface Scenario {
  name: string;
  /** 시드 고정 필수 — Golden 결정론 전제 */
  seed: number;
  player: ScenarioUnit[];
  enemy: ScenarioUnit[];
}

/** ScenarioUnit → PlacedChampion 변환 */
function buildPlacedChampion(u: ScenarioUnit): PlacedChampion {
  const champion = CHAMPIONS_BY_API.get(u.apiName);
  if (!champion) {
    throw new Error(`Champion not found: ${u.apiName}`);
  }
  const items: RawItem[] = (u.items ?? []).map(itemApi => {
    const item = ITEMS_BY_API.get(itemApi);
    if (!item) throw new Error(`Item not found: ${itemApi}`);
    return item;
  });
  return {
    champion,
    position: u.position,
    starLevel: u.starLevel ?? 1,
    items,
  };
}

/* ──────────────── Runner + Summary ──────────────── */

/**
 * 시뮬 결과의 핵심 invariant 만 뽑은 요약.
 * 전체 CombatResult (모든 tick snapshot 포함) 를 snapshot 하면 diff 노이즈가 크고 파일이 비대함.
 */
export interface ScenarioSummary {
  scenarioName: string;
  seed: number;
  winner: 'player' | 'enemy' | 'draw';
  /** 초 단위 (소수 4자리 유지) */
  duration: number;
  /** tickSnapshot 개수 — 전투 틱 수 간접 지표 */
  snapshotCount: number;
  /** 로그 이벤트 개수 종류별 */
  logCounts: Record<string, number>;
  /** 유닛별 최종 상태 요약 */
  units: UnitSummary[];
}

export interface UnitSummary {
  id: string;
  championApi: string;
  team: 'player' | 'enemy';
  starLevel: number;
  finalHp: number;
  maxHp: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  castCount: number;
  attackCount: number;
  killCount: number;
  alive: boolean;
}

function summarizeUnit(u: CombatUnit): UnitSummary {
  return {
    id: u.id,
    championApi: u.champion.apiName,
    team: u.team,
    starLevel: u.starLevel,
    finalHp: Math.round(u.currentHp * 100) / 100,
    maxHp: Math.round(u.maxHp * 100) / 100,
    totalDamageDealt: Math.round(u.totalDamageDealt * 100) / 100,
    totalDamageTaken: Math.round(u.totalDamageTaken * 100) / 100,
    castCount: u.castCount,
    attackCount: u.attackCount,
    killCount: u.killCount,
    alive: u.state !== 'dead',
  };
}

function summarizeLogs(result: CombatResult): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const log of result.logs) {
    counts[log.type] = (counts[log.type] ?? 0) + 1;
  }
  return counts;
}

/** 시나리오 실행 → 결정론적 요약 반환 */
export function runScenario(scenario: Scenario): ScenarioSummary {
  const player = scenario.player.map(buildPlacedChampion);
  const enemy = scenario.enemy.map(buildPlacedChampion);
  const result = simulateCombat(player, enemy, {
    seed: scenario.seed,
    allTraits: allTraits(),
    // skipMirror: true 안 주면 enemy 위치가 mirror 처리됨.
    // Golden 은 명시적 위치 쓰는 편이 디버깅 쉬워 skipMirror 켠다.
    skipMirror: true,
  });
  return {
    scenarioName: scenario.name,
    seed: scenario.seed,
    winner: result.winner,
    duration: result.duration,
    snapshotCount: result.snapshots.length,
    logCounts: summarizeLogs(result),
    units: [...result.playerUnits, ...result.enemyUnits].map(summarizeUnit),
  };
}
