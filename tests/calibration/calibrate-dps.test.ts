/**
 * DPS Calibration Script (Phase 6-B Part 2)
 *
 * Plan: docs/01-plan/features/estimateDps-magic-numbers.plan.md
 *
 * 목적: itemOptimizer.ts 의 DPS_CALIBRATION 6개 매직 넘버를 시뮬 기반 실측치로 역산.
 *
 * 측정 가능 (엔진 구현됨):
 *   #2 AVG_ENEMY_HP_FOR_BURN — 챔피언 데이터 평균 maxHp (시뮬 불필요)
 *   #4 AVG_MISSING_HP_PCT    — 시뮬 snapshot 의 (1 - hp/maxHp) 평균
 *   #5 MANA_REGEN_EFFICIENCY — manaRegen 아이템 ON/OFF 의 castCount 차이로 역산
 *   #6 AVG_KILLS_PER_COMBAT  — 시뮬 캐리 killCount 평균
 *
 * 측정 곤란 (엔진 미구현/부분 구현 — baseline 유지 + 사유 기록):
 *   #1 FLAT_DAMAGE_PROC_RATE — BaseDamage 직접 처리 미구현. CleaveDamage 일부 (psyops radiant)
 *   #3 BONUS_ATTACK_DPS_MULT — NumBonusAttacks (야스오 검술) 엔진 미구현
 *
 * 실행:
 *   pnpm exec vitest run scripts/calibrate-dps.ts
 *   (vitest config include 패턴이 tests/만 잡으므로 명시 경로로 실행)
 *
 * 결과: docs/03-analysis/calibration-dps-results.json 으로 저장
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';
import type {
  RawChampion,
  RawItem,
  RawItemsData,
  RawTraitsData,
  PlacedChampion,
  HexCoord,
  CombatResult,
} from '@/types';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';

/* ──────────────── Data loading ──────────────── */

const DATA_DIR = path.join(process.cwd(), 'public', 'data');

function readJson<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), 'utf-8')) as T;
}

interface ChampionsFile {
  champions?: RawChampion[];
}
const championsRaw = readJson<RawChampion[] | ChampionsFile>('tft_set17_champions.json');
const CHAMPIONS: RawChampion[] = Array.isArray(championsRaw)
  ? championsRaw
  : championsRaw.champions ?? [];
const ITEMS_DATA: RawItemsData = readJson<RawItemsData>('tft_set17_items.json');
const TRAITS_DATA: RawTraitsData = readJson<RawTraitsData>('tft_set17_traits.json');

const CHAMP_BY_API = new Map(CHAMPIONS.map(c => [c.apiName, c]));
const ITEM_BY_API = new Map(ITEMS_DATA.items.map(i => [i.apiName, i]));

function champ(api: string): RawChampion {
  const c = CHAMP_BY_API.get(api);
  if (!c) throw new Error(`champion not found: ${api}`);
  return c;
}
function item(api: string): RawItem {
  const i = ITEM_BY_API.get(api);
  if (!i) throw new Error(`item not found: ${api}`);
  return i;
}

const SEEDS = [1, 7, 13, 42, 99, 137, 211];

/* ──────────────── Scenario builders ──────────────── */

interface UnitSpec {
  api: string;
  position: HexCoord;
  star?: 1 | 2 | 3;
  items?: string[];
}

function placed(spec: UnitSpec): PlacedChampion {
  return {
    champion: champ(spec.api),
    position: spec.position,
    starLevel: spec.star ?? 2,
    items: (spec.items ?? []).map(item),
  };
}

function runSim(player: UnitSpec[], enemy: UnitSpec[], seed: number): CombatResult {
  return simulateCombat(player.map(placed), enemy.map(placed), {
    seed,
    allTraits: TRAITS_DATA.traits,
    skipMirror: true,
  });
}

/* ──────────────── Standard mid-game team mixes ──────────────── */

// Player carry team — AD/AP 캐리 + 탱커 2명, 모두 2성 mid-game
const PLAYER_AD_CARRY: UnitSpec = {
  api: 'TFT17_Jhin',
  position: { q: 0, r: 7 },
  star: 2,
};
const PLAYER_AP_CARRY: UnitSpec = {
  api: 'TFT17_Karma',
  position: { q: 1, r: 7 },
  star: 2,
};
const PLAYER_TANK_1: UnitSpec = {
  api: 'TFT17_Rammus',
  position: { q: 3, r: 4 },
  star: 2,
};
const PLAYER_TANK_2: UnitSpec = {
  api: 'TFT17_Pantheon',
  position: { q: 4, r: 4 },
  star: 2,
};

// Enemy mix — 다양한 cost/role
const ENEMY_TEAM: UnitSpec[] = [
  { api: 'TFT17_Maokai', position: { q: 3, r: 0 }, star: 2 },
  { api: 'TFT17_Aurora', position: { q: 4, r: 0 }, star: 2 },
  { api: 'TFT17_Akali', position: { q: 0, r: 1 }, star: 2 },
  { api: 'TFT17_Caitlyn', position: { q: 6, r: 1 }, star: 2 },
];

const PLAYER_BASE: UnitSpec[] = [PLAYER_AD_CARRY, PLAYER_AP_CARRY, PLAYER_TANK_1, PLAYER_TANK_2];

// Late-game 7v7 — 더 큰 팀 → 캐리당 평균 킬 수, missing hp% 패턴 다름
const PLAYER_LATE: UnitSpec[] = [
  { api: 'TFT17_Jhin', position: { q: 0, r: 7 }, star: 2 },
  { api: 'TFT17_Karma', position: { q: 1, r: 7 }, star: 2 },
  { api: 'TFT17_Aurora', position: { q: 2, r: 7 }, star: 2 },
  { api: 'TFT17_Kindred', position: { q: 6, r: 7 }, star: 2 },
  { api: 'TFT17_Rammus', position: { q: 3, r: 4 }, star: 2 },
  { api: 'TFT17_Pantheon', position: { q: 4, r: 4 }, star: 2 },
  { api: 'TFT17_Maokai', position: { q: 5, r: 4 }, star: 2 },
];
const ENEMY_LATE: UnitSpec[] = [
  { api: 'TFT17_Akali', position: { q: 0, r: 0 }, star: 2 },
  { api: 'TFT17_Caitlyn', position: { q: 1, r: 0 }, star: 2 },
  { api: 'TFT17_Vex', position: { q: 2, r: 0 }, star: 2 },
  { api: 'TFT17_Xayah', position: { q: 6, r: 0 }, star: 2 },
  { api: 'TFT17_Galio', position: { q: 3, r: 3 }, star: 2 },
  { api: 'TFT17_Illaoi', position: { q: 4, r: 3 }, star: 2 },
  { api: 'TFT17_Maokai', position: { q: 5, r: 3 }, star: 2 },
];

/* ──────────────── Measurement utilities ──────────────── */

interface MeasurementResult {
  metric: string;
  current: number;
  measured: number;
  samples: number;
  stddev: number;
  notes: string;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map(x => (x - m) ** 2)));
}

/* ──────────────── #2 AVG_ENEMY_HP_FOR_BURN ──────────────── */
//
// 측정 기준:
//   - mid-game (stage 4-5) 일반 매치 시 적 평균 maxHp
//   - 비용별 분포 (cost 1~5) 가중 평균
//   - 보통 빌드: 2성 cost 2~4 위주 → 평균 hp ~ 1500~1800
//
function measureAvgEnemyHpForBurn(): MeasurementResult {
  // 시뮬 unique 적 챔피언들의 평균 maxHp
  const playable = CHAMPIONS.filter(c => c.cost >= 1 && c.cost <= 5 && c.stats?.hp);
  // mid-game weighting: cost 1=10%, 2=25%, 3=30%, 4=25%, 5=10%
  const weight: Record<number, number> = { 1: 0.1, 2: 0.25, 3: 0.3, 4: 0.25, 5: 0.1 };
  const STAR2 = 1.8;
  let weightedSum = 0;
  let weightTotal = 0;
  for (const cost of [1, 2, 3, 4, 5]) {
    const cohort = playable.filter(c => c.cost === cost);
    if (cohort.length === 0) continue;
    const avgHp = mean(cohort.map(c => c.stats!.hp)) * STAR2; // 2성 기준
    weightedSum += avgHp * weight[cost];
    weightTotal += weight[cost];
  }
  const measured = weightedSum / weightTotal;
  return {
    metric: 'AVG_ENEMY_HP_FOR_BURN',
    current: 2000,
    measured: Math.round(measured),
    samples: playable.length,
    stddev: 0,
    notes: 'mid-game 2성 가중평균 (cost 1:10%, 2:25%, 3:30%, 4:25%, 5:10%)',
  };
}

/* ──────────────── #4 AVG_MISSING_HP_PCT ──────────────── */
//
// 시뮬 진행 중 매 snapshot 에서 (1 - currentHp/maxHp) × 100 평균
// 양 팀 캐리/탱커 다양한 시나리오
//
function measureAvgMissingHpPct(): MeasurementResult {
  const samples: number[] = [];
  const scenarios: [UnitSpec[], UnitSpec[], string][] = [
    [PLAYER_BASE, ENEMY_TEAM, 'mid-4v4'],
    [PLAYER_LATE, ENEMY_LATE, 'late-7v7'],
  ];
  for (const [pl, en] of scenarios) {
    for (const seed of SEEDS) {
      const result = runSim(pl, en, seed);
      if (result.snapshots.length === 0) continue;
      const maxHpById = new Map<string, number>();
      for (const u of [...result.playerUnits, ...result.enemyUnits]) {
        maxHpById.set(u.id, u.maxHp);
      }
      let totalMissing = 0;
      let count = 0;
      for (const snap of result.snapshots) {
        for (const [uid, snapUnit] of Object.entries(snap.units)) {
          const maxHp = maxHpById.get(uid);
          if (!maxHp || maxHp <= 0) continue;
          const missing = 1 - snapUnit.currentHp / maxHp;
          totalMissing += Math.max(0, Math.min(1, missing)) * 100;
          count++;
        }
      }
      if (count > 0) samples.push(totalMissing / count);
    }
  }
  return {
    metric: 'AVG_MISSING_HP_PCT',
    current: 50,
    measured: Math.round(mean(samples) * 10) / 10,
    samples: samples.length,
    stddev: Math.round(stddev(samples) * 10) / 10,
    notes: 'mid-4v4 + late-7v7, 양팀 snapshot missing hp% 평균',
  };
}

/* ──────────────── #6 AVG_KILLS_PER_COMBAT ──────────────── */
//
// 캐리(비탱커) 평균 killCount.  탱커는 별도 통계.
//
function measureAvgKillsPerCombat(): MeasurementResult {
  const carrySamples: number[] = [];
  const tankSamples: number[] = [];
  const scenarios: [UnitSpec[], UnitSpec[]][] = [
    [PLAYER_BASE, ENEMY_TEAM],
    [PLAYER_LATE, ENEMY_LATE],
  ];

  for (const [pl, en] of scenarios) {
    for (const seed of SEEDS) {
      const result = runSim(pl, en, seed);
      for (const u of [...result.playerUnits, ...result.enemyUnits]) {
        const isTank = u.role === 'Tank';
        if (isTank) tankSamples.push(u.killCount);
        else carrySamples.push(u.killCount);
      }
    }
  }

  return {
    metric: 'AVG_KILLS_PER_COMBAT',
    current: 2,
    measured: Math.round(mean(carrySamples) * 100) / 100,
    samples: carrySamples.length,
    stddev: Math.round(stddev(carrySamples) * 100) / 100,
    notes: `mid+late 통합. carry 평균=${mean(carrySamples).toFixed(2)}, tank 평균=${mean(tankSamples).toFixed(2)}`,
  };
}

/* ──────────────── #5 MANA_REGEN_EFFICIENCY ──────────────── */
//
// 엔진 직접 분석으로 결정 (시뮬 측정 대신).
//
// combatLoop.ts:1572-1574:
//   if (unit.augmentManaRegen > 0) {
//     unit.currentMana += unit.augmentManaRegen × TICK_DURATION;
//   }
//
// ItemEffect.manaRegen → augmentManaRegen 매핑 (combatLoop.ts:116, getItemEffects 경로) 1:1.
// 따라서 manaRegen=1 → 초당 1 mana. AVG_COMBAT_DURATION=15s → 15 mana 절약.
// estimateDps 식: effectiveMana = maxMana - manaRegen × duration × EFFICIENCY
//   → EFFICIENCY = 절약된 mana / (manaRegen × duration) = 15 / (1×15) = 1.0
//
// stat-equivalent control 시뮬은 AP stat 차이로 항상 noise. 엔진 코드 분석이 정답.
//
// 검증: 짧은 시뮬 (Karma 단독 + 강한 enemy=Galio 2성)에서 manaRegen 효과 단방향 확인.
//
function measureManaRegenEfficiency(): MeasurementResult {
  // 1초간 mana 변화 검증 — Karma 가 cast 전에 측정해야 정확. 첫 cast time 비교.
  // ON: 대천사 3개 (manaRegen=3 → 초당 3 mana)
  // OFF: 라바돈 3개 (manaRegen=0)
  // duration 차이로 cast 빈도 비교 (ratio)
  //
  // 이 측정은 control 안 깨끗하지만 엔진 동작의 sanity check 용으로만 보고.

  const onCasts: number[] = [];
  const offCasts: number[] = [];
  const playerOn = PLAYER_BASE.map(u =>
    u === PLAYER_AP_CARRY
      ? { ...u, items: ['TFT_Item_ArchangelsStaff', 'TFT_Item_ArchangelsStaff', 'TFT_Item_ArchangelsStaff'] }
      : u,
  );
  const playerOff = PLAYER_BASE.map(u =>
    u === PLAYER_AP_CARRY
      ? { ...u, items: ['TFT_Item_RabadonsDeathcap', 'TFT_Item_RabadonsDeathcap', 'TFT_Item_RabadonsDeathcap'] }
      : u,
  );

  for (const seed of SEEDS) {
    const rOn = runSim(playerOn, ENEMY_TEAM, seed);
    const rOff = runSim(playerOff, ENEMY_TEAM, seed);
    const onAp = rOn.playerUnits.find(u => u.champion.apiName === PLAYER_AP_CARRY.api);
    const offAp = rOff.playerUnits.find(u => u.champion.apiName === PLAYER_AP_CARRY.api);
    if (!onAp || !offAp) continue;
    // cast/sec
    onCasts.push(rOn.duration > 0 ? onAp.castCount / rOn.duration : 0);
    offCasts.push(rOff.duration > 0 ? offAp.castCount / rOff.duration : 0);
  }

  return {
    metric: 'MANA_REGEN_EFFICIENCY',
    current: 0.1,
    measured: 1.0, // 엔진 코드 분석 기반 확정값
    samples: onCasts.length,
    stddev: 0,
    notes:
      `엔진 직접 분석: combatLoop.ts:1573 mana += augmentManaRegen × TICK_DURATION (1:1). EFFICIENCY=1.0 확정. ` +
      `Sanity sim (대천사3 vs 라바돈3) cast/s ON=${mean(onCasts).toFixed(3)}, OFF=${mean(offCasts).toFixed(3)} (control 비-stat-equivalent).`,
  };
}

/* ──────────────── #1 FLAT_DAMAGE_PROC_RATE (Part 4 isolated measurement) ──────────────── */
//
// Phase 6-B Part 4: itemDamageDealt 카운터로 루덴 proc 기여만 직접 측정.
//
// 시나리오: Belveth (melee AD carry, ability magic) 에게 루덴의 폭풍 1개 + BFSword 2개 장착.
// 루덴은 on_kill 시 adjacentEnemies(source 주변) 에게 100 magic flat. 다른 trigger 아이템
// 없으므로 Belveth.itemDamageDealt = 루덴 proc 누적 dmg.
//
// proc_rate (estimateDps 식 의미): contribution_dps / (flatDamage × totalAS)
//   contribution_dps = itemDamageDealt / duration
//   즉 "초당 'flatDamage × totalAS' 가 실제 DPS 로 얼마나 환산되는가" 계수.
//
function measureFlatDamageProcRate(): MeasurementResult {
  const procRates: number[] = [];
  const flatDamage = 100; // 루덴의 폭풍 BaseDamage

  // Fiora = 4 cost ADFighter, melee range 1. 2성 dmg=144 — 강한 carry 로 kill 빈도 ↑.
  // Enemy 는 1성으로 약화해서 kill 빈도 안정 확보.
  const measureCarry: UnitSpec = { api: 'TFT17_Fiora', position: { q: 3, r: 4 }, star: 2 };
  const playerOn: UnitSpec[] = [
    { ...measureCarry, items: ['TFT_Item_Artifact_LudensTempest', 'TFT_Item_BFSword', 'TFT_Item_BFSword'] },
    { api: 'TFT17_Rammus', position: { q: 1, r: 5 }, star: 2 },
    { api: 'TFT17_Pantheon', position: { q: 5, r: 5 }, star: 2 },
  ];
  const enemyWeak: UnitSpec[] = [
    { api: 'TFT17_Aatrox', position: { q: 2, r: 0 }, star: 1 },
    { api: 'TFT17_Veigar', position: { q: 4, r: 0 }, star: 1 },
    { api: 'TFT17_Talon', position: { q: 0, r: 1 }, star: 1 },
  ];

  for (const seed of SEEDS) {
    const rOn = runSim(playerOn, enemyWeak, seed);
    const carry = rOn.playerUnits.find(u => u.champion.apiName === measureCarry.api);
    if (!carry || rOn.duration <= 0) continue;
    const totalAS = carry.stats.attackSpeed;
    if (totalAS === 0) continue;
    const contributionDps = carry.itemDamageDealt / rOn.duration;
    const proc = contributionDps / (flatDamage * totalAS);
    procRates.push(proc);
  }

  const measured = mean(procRates);
  return {
    metric: 'FLAT_DAMAGE_PROC_RATE',
    current: 0.3,
    measured: Math.round(measured * 1000) / 1000,
    samples: procRates.length,
    stddev: Math.round(stddev(procRates) * 1000) / 1000,
    notes:
      `Part 4 isolated: Fiora 2성 + 루덴 + BFSword2 vs 약한 enemy 3명 1성. ` +
      `itemDamageDealt 카운터로 루덴 on_kill proc 만 분리.`,
  };
}

/* ──────────────── #3 BONUS_ATTACK_DPS_MULT (Part 4 isolated measurement) ──────────────── */
//
// Phase 6-B Part 4: itemDamageDealt 카운터로 야스오 timer fire 기여만 직접 측정.
//
// 야스오 검술 (artifacts.ts): 3.5s timer 로 attackTarget 에게 AD × 1.0 physical.
// estimateDps 식: bonusAttackMul = 1 + N × MULT (N = NumBonusAttacks = 1).
// 기여 DPS = baseAdDps × N × MULT
//   baseAdDps = stats.damage × stats.attackSpeed × critMul
//   야스오 contribution = itemDamageDealt / duration
//   → MULT = contribution / (baseAdDps × N)
//
function measureBonusAttackDpsMult(): MeasurementResult {
  const mults: number[] = [];
  const N = 1; // NumBonusAttacks

  // timer 3.5s → duration ≥ ~7s 필요. enemy 에 tank(Galio 2성) 추가해 duration 확보.
  const measureCarry: UnitSpec = { api: 'TFT17_Fiora', position: { q: 3, r: 4 }, star: 2 };
  const playerOn: UnitSpec[] = [
    { ...measureCarry, items: ['TFT17_Item_Artifact_YasuoArtifact', 'TFT_Item_BFSword', 'TFT_Item_BFSword'] },
    { api: 'TFT17_Rammus', position: { q: 1, r: 5 }, star: 2 },
    { api: 'TFT17_Pantheon', position: { q: 5, r: 5 }, star: 2 },
  ];
  const enemyDurable: UnitSpec[] = [
    { api: 'TFT17_Galio', position: { q: 3, r: 0 }, star: 2 },  // tanky
    { api: 'TFT17_Illaoi', position: { q: 2, r: 1 }, star: 2 }, // tanky
    { api: 'TFT17_Rammus', position: { q: 4, r: 1 }, star: 2 }, // tanky
  ];

  // baseAdDps 비교는 동일 basis (post-resistance) 여야 정확.
  // carry.totalDamageDealt - carry.itemDamageDealt = basic + ability actual (post-resistance).
  const durations: number[] = [];
  for (const seed of SEEDS) {
    const rOn = runSim(playerOn, enemyDurable, seed);
    const carry = rOn.playerUnits.find(u => u.champion.apiName === measureCarry.api);
    if (!carry || rOn.duration <= 0) continue;
    durations.push(rOn.duration);
    const basicActualDps = (carry.totalDamageDealt - carry.itemDamageDealt) / rOn.duration;
    if (basicActualDps <= 0) continue;
    const contribution = carry.itemDamageDealt / rOn.duration;
    mults.push(contribution / (basicActualDps * N));
  }

  const measured = mean(mults);
  return {
    metric: 'BONUS_ATTACK_DPS_MULT',
    current: 0.3,
    measured: Math.round(measured * 1000) / 1000,
    samples: mults.length,
    stddev: Math.round(stddev(mults) * 1000) / 1000,
    notes:
      `Part 4 isolated: Fiora + 야스오 + BFSword2 vs 탱키 enemy (Galio/Illaoi/Rammus 2성). ` +
      `avg duration=${mean(durations).toFixed(1)}s. 야스오 timer 3.5s fire 반영.`,
  };
}

/* ──────────────── Main ──────────────── */

describe('DPS Calibration (Phase 6-B)', () => {
  it('measure all 6 magic numbers and dump JSON', () => {
    const results: MeasurementResult[] = [
      measureAvgEnemyHpForBurn(),       // #2
      measureAvgMissingHpPct(),         // #4
      measureAvgKillsPerCombat(),       // #6
      measureManaRegenEfficiency(),     // #5
      measureFlatDamageProcRate(),      // #1
      measureBonusAttackDpsMult(),      // #3
    ];

    const lines: string[] = [];
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push(' DPS Calibration Results (Phase 6-B Part 2)');
    lines.push(' Date: ' + new Date().toISOString());
    lines.push(' Seeds: [' + SEEDS.join(', ') + ']');
    lines.push('═══════════════════════════════════════════════════════════════');
    for (const r of results) {
      lines.push('');
      lines.push(`▸ ${r.metric}`);
      lines.push(`    current   = ${r.current}`);
      lines.push(`    measured  = ${r.measured} (n=${r.samples}, σ=${r.stddev})`);
      lines.push(`    notes     = ${r.notes}`);
    }
    lines.push('');
    lines.push('═══════════════════════════════════════════════════════════════');

    console.log(lines.join('\n'));

    const outDir = path.join(process.cwd(), 'docs', '03-analysis');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, 'calibration-dps-results.json');
    fs.writeFileSync(
      outFile,
      JSON.stringify(
        {
          date: new Date().toISOString(),
          seeds: SEEDS,
          playerTeam: PLAYER_BASE.map(u => ({ api: u.api, star: u.star ?? 2 })),
          enemyTeam: ENEMY_TEAM.map(u => ({ api: u.api, star: u.star ?? 2 })),
          results,
        },
        null,
        2,
      ),
    );
    console.log(`\n→ saved: ${outFile}`);
  });
});
