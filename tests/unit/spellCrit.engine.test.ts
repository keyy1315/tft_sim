/**
 * Spell Crit — 엔진 독립 테스트.
 *
 * golden snapshot 에 의존하지 않고 spell-crit-mechanic 엔진 동작을 직접 검증.
 * - spellCanCrit 플래그가 아이템 착용 기반으로 정확히 세팅되는지
 * - 동일 seed 2회 실행 시 결정론 보장
 * - 보건(JG) 착용 시 ability crit 이 평균 피해에 반영되는지 (cross-seed 통계)
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type {
  RawChampion, RawItem, RawItemsData, RawTraitsData, PlacedChampion,
} from '@/types';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';

/* ──────────────── Data 로더 (테스트 전용, 한 번만 읽음) ──────────────── */

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
const ITEMS: RawItemsData = readJson<RawItemsData>('tft_set17_items.json');
const TRAITS: RawTraitsData = readJson<RawTraitsData>('tft_set17_traits.json');

const CHAMP = (api: string): RawChampion => {
  const c = CHAMPIONS.find(x => x.apiName === api);
  if (!c) throw new Error(`champion not found: ${api}`);
  return c;
};
const ITEM = (api: string): RawItem => {
  const i = ITEMS.items.find(x => x.apiName === api);
  if (!i) throw new Error(`item not found: ${api}`);
  return i;
};

/* ──────────────── 시나리오 빌더 ──────────────── */

// Veigar (1-cost APCaster, range=4, critChance 0.25, critMult 1.4, mana 10/50).
// AP 스킬 crit 검증용으로 적합.
function veigar(items: string[]): PlacedChampion {
  return {
    champion: CHAMP('TFT17_Veigar'),
    position: { q: 0, r: 3 },
    starLevel: 2,
    items: items.map(ITEM),
  };
}

// 일라오이 ★2 — 충분한 HP 로 베이가가 여러 번 ability 시전할 동안 생존.
// 1성은 1회 시전만으로 즉사해 crit 판정이 모든 seed 에 대해 동일해질 수 있어 ★2 사용.
function illaoi(): PlacedChampion {
  return {
    champion: CHAMP('TFT17_Illaoi'),
    position: { q: 3, r: 3 },
    starLevel: 2,
    items: [],
  };
}

function run(items: string[], seed: number) {
  return simulateCombat([veigar(items)], [illaoi()], {
    seed,
    allTraits: TRAITS.traits,
    skipMirror: true,
  });
}

/* ──────────────── Tests ──────────────── */

describe('spellCanCrit 플래그 세팅 (createCombatUnit)', () => {
  it('아이템 없음 → false', () => {
    const result = run([], 1111);
    expect(result.playerUnits[0].spellCanCrit).toBe(false);
  });

  it('보건(JG) 장착 → true', () => {
    const result = run(['TFT_Item_JeweledGauntlet'], 1111);
    expect(result.playerUnits[0].spellCanCrit).toBe(true);
  });

  it('무대(IE) 장착 → true (AD 스탯이지만 spell crit 언락됨)', () => {
    const result = run(['TFT_Item_InfinityEdge'], 1111);
    expect(result.playerUnits[0].spellCanCrit).toBe(true);
  });

  it('타락한 보건(CorruptedJG) → true', () => {
    // Set 17 데이터에 Radiant 변종 apiName 은 등록되어 있지 않음 (상수 선언만 유지).
    // 실제 데이터에 존재하는 Corrupted 변종으로 커버리지 확인.
    const result = run(['TFT_Item_CorruptedJeweledGauntlet'], 1111);
    expect(result.playerUnits[0].spellCanCrit).toBe(true);
  });

  it('라바돈(AP 아이템이지만 crit 언락 아님) → false', () => {
    const result = run(['TFT_Item_RabadonsDeathcap'], 1111);
    expect(result.playerUnits[0].spellCanCrit).toBe(false);
  });

  it('타겟(일라오이) 는 아이템 없음 → false', () => {
    const result = run(['TFT_Item_JeweledGauntlet'], 1111);
    expect(result.enemyUnits[0].spellCanCrit).toBe(false);
  });
});

describe('결정론 — 동일 seed 2회 실행 시 정확히 일치', () => {
  it('JG 없음: totalDamageDealt 완전 일치', () => {
    const a = run([], 42);
    const b = run([], 42);
    expect(b.playerUnits[0].totalDamageDealt).toBe(a.playerUnits[0].totalDamageDealt);
    expect(b.enemyUnits[0].totalDamageTaken).toBe(a.enemyUnits[0].totalDamageTaken);
    expect(b.duration).toBe(a.duration);
    expect(b.winner).toBe(a.winner);
  });

  it('JG 포함: crit 판정이 있어도 동일 seed → 동일 결과', () => {
    const a = run(['TFT_Item_JeweledGauntlet'], 42);
    const b = run(['TFT_Item_JeweledGauntlet'], 42);
    expect(b.playerUnits[0].totalDamageDealt).toBe(a.playerUnits[0].totalDamageDealt);
    expect(b.enemyUnits[0].totalDamageTaken).toBe(a.enemyUnits[0].totalDamageTaken);
  });

  it('다른 seed → 다른 결과 (rng 가 실제로 seed 에 의존함 검증)', () => {
    const a = run(['TFT_Item_JeweledGauntlet'], 42);
    const b = run(['TFT_Item_JeweledGauntlet'], 99);
    // 둘 다 JG 있으면 crit 확률 존재 — 다른 seed 면 crit 여부 달라져 damage 다름.
    // (극히 드물게 일치할 수도 있으나 베이가 수 회 시전 × 25% crit 으로 실질적으로 0%)
    expect(b.playerUnits[0].totalDamageDealt).not.toBe(a.playerUnits[0].totalDamageDealt);
  });
});

describe('보건 crit 언락 효과 — cross-seed 평균 피해', () => {
  /** 50개 seed 평균 피해량. critChance 0.25 기반 통계 안정화용. */
  function avgDamage(items: string[], seedBase: number, n: number): number {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += run(items, seedBase + i).playerUnits[0].totalDamageDealt;
    }
    return sum / n;
  }

  it('JG 장착 vs 아이템 없음: JG 의 기댓값이 더 높음 (AP 보너스 + crit 프리미엄)', () => {
    const avgWithJG = avgDamage(['TFT_Item_JeweledGauntlet'], 1000, 30);
    const avgNone = avgDamage([], 1000, 30);

    // JG 는 (a) AP 20 플랫 + (b) spell crit 언락 — 둘 다 피해 상승 요인.
    // Illaoi ★2 기준 ~5% 수준 상승 (적이 빨리 죽으면 상승폭 작아짐).
    expect(avgWithJG).toBeGreaterThan(avgNone);
    expect(avgWithJG / avgNone).toBeGreaterThan(1.02);
  });

  it('spellCanCrit 은 ability 피해 경로에 작용 — 다수 seed 에서 피해 variance 발생', () => {
    // JG 있을 때 30 seed 의 피해 표본표준편차가 0 이 아님 (crit 판정이 실제로 변동성 도입)
    const samples: number[] = [];
    for (let i = 0; i < 30; i++) {
      samples.push(run(['TFT_Item_JeweledGauntlet'], 5000 + i).playerUnits[0].totalDamageDealt);
    }
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((sum, v) => sum + (v - mean) ** 2, 0) / samples.length;
    const stddev = Math.sqrt(variance);

    // variance 가 의미 있게 존재 — 모두 동일한 값이면 crit 영향이 없다는 뜻.
    expect(stddev).toBeGreaterThan(0);
    expect(stddev / mean).toBeGreaterThan(0.005); // 최소 0.5% 변동계수
  });
});
