import type { StargazerConstellationId } from './types';
import type { HexCoord } from '@/types';
import { offsetToAxial } from '@/types';

/**
 * 별돌보미 별자리 (게임 데이터 schema enum) ↔ trait apiName 매핑.
 *
 * Riot internal apiName 과 인게임 한글 표기가 일관되지 않아 (`Wolf` apiName 이
 * 실제로는 "멧돼지" 별자리) 명시적 매핑 필요.
 *
 * 7개 변종은 base trait `TFT17_Stargazer` 위에 적용되는 컨스텔레이션. 게임마다
 * 하나씩 randomized — game-level field `ActualGameData.stargazerConstellation`
 * 에 사용자가 입력.
 */
export const CONSTELLATION_TO_TRAIT_API: Record<StargazerConstellationId, string> = {
  altar: 'TFT17_Stargazer_Shield',
  boar: 'TFT17_Stargazer_Wolf',
  huntress: 'TFT17_Stargazer_Huntress',
  medal: 'TFT17_Stargazer_Medallion',
  mountain: 'TFT17_Stargazer_Mountain',
  snake: 'TFT17_Stargazer_Serpent',
  well: 'TFT17_Stargazer_Fountain',
};

/** 인게임 한글 표기. UI dropdown / 디스플레이용. */
export const CONSTELLATION_KOREAN_NAME: Record<StargazerConstellationId, string> = {
  altar: '제단',
  boar: '멧돼지',
  huntress: '여사냥꾼',
  medal: '메달',
  mountain: '산',
  snake: '뱀',
  well: '우물',
};

/** 모든 별자리 id 를 한글 알파벳 순으로 정렬한 배열 — UI dropdown 옵션 순서. */
export const CONSTELLATION_IDS: StargazerConstellationId[] = (
  Object.keys(CONSTELLATION_KOREAN_NAME) as StargazerConstellationId[]
).sort((a, b) =>
  CONSTELLATION_KOREAN_NAME[a].localeCompare(CONSTELLATION_KOREAN_NAME[b], 'ko'),
);

/** trait apiName → constellation id 역매핑 (필요 시). */
export function traitApiToConstellationId(apiName: string): StargazerConstellationId | null {
  for (const [id, api] of Object.entries(CONSTELLATION_TO_TRAIT_API)) {
    if (api === apiName) return id as StargazerConstellationId;
  }
  return null;
}

/**
 * 별자리별 강화 칸 (offset) 패턴.
 * 4 행 × 7 열 (player half-board). 각 row 의 col 0~6 중 활성 칸을 명시.
 *
 * 단순화 (PR-3 v1):
 * - 게임 진행 중 player level 따라 점진 추가되지만 현재는 **고정 풀 패턴** 으로
 *   적용. 정밀화는 후속 PR.
 * - 별돌보미 trait 활성된 팀만 적용 (minUnits >= 3).
 *
 * 좌표 시스템 (`src/types/index.ts:offsetToAxial`):
 *   q = col - floor(row / 2), r = row
 *
 * 이미지 출처: docs/sim-accuracy/stargazer-tile-images.* (사용자 제공)
 */
const TILE_PATTERNS_OFFSET: Record<StargazerConstellationId, ReadonlyArray<readonly [row: number, col: number]>> = {
  // 멧돼지 (Wolf) — 좌측·중앙 집중 17칸
  // r=0 ·X·XXX· / r=1 XXXXX·· / r=2 XXXXX·· / r=3 X·XX···
  boar: [
    [0, 1], [0, 3], [0, 4], [0, 5],
    [1, 0], [1, 1], [1, 2], [1, 3], [1, 4],
    [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],
    [3, 0], [3, 2], [3, 3],
  ],
  // 메달 (Medallion) — 보드 전반 분산 17칸
  // r=0 ··XXXX· / r=1 XX···X· / r=2 XXXX··X / r=3 XX·XXX·
  medal: [
    [0, 2], [0, 3], [0, 4], [0, 5],
    [1, 0], [1, 1], [1, 5],
    [2, 0], [2, 1], [2, 2], [2, 3], [2, 6],
    [3, 0], [3, 1], [3, 3], [3, 4], [3, 5],
  ],
  // 여사냥꾼 (Huntress) — 중앙·후열 carry 보호 14칸
  // r=0 ··X··X· / r=1 ·XXXXX· / r=2 ··X·XX· / r=3 ···XXXX
  huntress: [
    [0, 2], [0, 5],
    [1, 1], [1, 2], [1, 3], [1, 4], [1, 5],
    [2, 2], [2, 4], [2, 5],
    [3, 3], [3, 4], [3, 5], [3, 6],
  ],
  // 뱀 (Serpent) — 바둑판 분산 14칸
  // r=0 ··XX·XX / r=1 ·X·X·X· / r=2 ··X·X·X / r=3 XX··XX·
  snake: [
    [0, 2], [0, 3], [0, 5], [0, 6],
    [1, 1], [1, 3], [1, 5],
    [2, 2], [2, 4], [2, 6],
    [3, 0], [3, 1], [3, 4], [3, 5],
  ],
  // 제단 (Shield) — 보드 대칭 + 전열 풀 18칸
  // r=0 ·X·XX·X / r=1 X·X·X·X / r=2 ·X·XX·X / r=3 XXX·XXX
  altar: [
    [0, 1], [0, 3], [0, 4], [0, 6],
    [1, 0], [1, 2], [1, 4], [1, 6],
    [2, 1], [2, 3], [2, 4], [2, 6],
    [3, 0], [3, 1], [3, 2], [3, 4], [3, 5], [3, 6],
  ],
  // 우물 (Fountain) — 후열·전열 풀, 행 2 거의 비음 14칸
  // r=0 ·XX·XX· / r=1 X·XX·X· / r=2 ···X··· / r=3 XXXXXX·
  well: [
    [0, 1], [0, 2], [0, 4], [0, 5],
    [1, 0], [1, 2], [1, 3], [1, 5],
    [2, 3],
    [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5],
  ],
  // 산 (Mountain) — 중앙 라인 + 양 가장자리 12칸
  // r=0 ··XXXX· / r=1 ·X···X· / r=2 ·X····X / r=3 XX···XX
  mountain: [
    [0, 2], [0, 3], [0, 4], [0, 5],
    [1, 1], [1, 5],
    [2, 1], [2, 6],
    [3, 0], [3, 1], [3, 5], [3, 6],
  ],
};

/**
 * 별자리별 강화 칸 axial 좌표 (q, r) 배열. 사용자 측은 hex 의 q/r 로 검사.
 */
export const CONSTELLATION_TILE_PATTERN: Record<StargazerConstellationId, ReadonlyArray<HexCoord>> = (() => {
  const out = {} as Record<StargazerConstellationId, ReadonlyArray<HexCoord>>;
  for (const id of Object.keys(TILE_PATTERNS_OFFSET) as StargazerConstellationId[]) {
    out[id] = TILE_PATTERNS_OFFSET[id].map(([row, col]) => offsetToAxial({ row, col }));
  }
  return out;
})();

/** 주어진 unit position 이 별자리의 강화 칸인지 검사. O(N) — N=12~18 작음. */
export function isOnEmpoweredTile(
  position: HexCoord,
  constellation: StargazerConstellationId,
): boolean {
  const tiles = CONSTELLATION_TILE_PATTERN[constellation];
  return tiles.some((t) => t.q === position.q && t.r === position.r);
}

/**
 * 별자리별 효과 요약 텍스트 생성. UI tooltip 표시용.
 * activeEffectVariables 가 null/undefined 이면 별자리 한글명만 반환.
 */
export function formatStargazerEffectSummary(
  constellation: StargazerConstellationId,
  activeEffectVariables: Record<string, number | null | undefined> | null | undefined,
  count: number,
): string {
  const name = CONSTELLATION_KOREAN_NAME[constellation];
  if (!activeEffectVariables) return `별돌보미 ${name}`;
  const v = activeEffectVariables;
  const lines: string[] = [`별돌보미 ${name} (${count})`];
  const pct = (n: number | null | undefined): string => {
    if (n == null) return '0';
    // 1 미만 fraction → percent. 1 이상은 그대로 (이미 percentage points).
    return n < 1 ? `${Math.round(n * 100)}%` : `${Math.round(n)}%`;
  };
  switch (constellation) {
    case 'mountain': {
      // Mountain: 강화 칸 별돌보미 stat 누적 + StatIncrease 증폭
      const hp = v.Mountain_Health, ad = v.Mountain_ADAP, as = v.Mountain_AS;
      const dr = v.Mountain_DR, res = v.Mountain_Resists, inc = v.Mountain_StatIncrease;
      lines.push('강화 칸 별돌보미:');
      if (hp) lines.push(`  체력 +${pct(hp)}`);
      if (ad) lines.push(`  공격력/주문력 +${pct(ad)}`);
      if (as) lines.push(`  공격속도 +${pct(as)}`);
      if (dr) lines.push(`  내구력 +${pct(dr)}`);
      if (res) lines.push(`  방어/마저 +${res}`);
      if (inc) lines.push(`  추가 효과 +${pct(inc)} 증폭`);
      break;
    }
    case 'boar': {
      // Wolf: teamwide HP/AD/AP + 별돌보미 추가 HP/ADAP
      const tw = v.Wolf_Health_Teamwide, hp = v.Wolf_Health, ad = v.Wolf_ADAP;
      if (tw) lines.push(`강화 칸 모든 아군: 체력/공/주 +${pct(tw)}`);
      lines.push('+ 별돌보미 추가:');
      if (hp) lines.push(`  체력 +${pct(hp)}`);
      if (ad) lines.push(`  공격력/주문력 +${ad}%`);
      break;
    }
    case 'medal': {
      // Medallion: teamwide damageAmp + 3성당 증가
      const da = v.Medallion_DA, inc3 = v.Medallion_IncreasePer3Star;
      if (da) lines.push(`강화 칸 모든 아군 피해증폭 +${pct(da)}`);
      if (inc3) lines.push(`3성 1명당 추가 +${inc3}%`);
      break;
    }
    case 'huntress': {
      // Huntress: teamwide AS + 별돌보미 추가 AS + mark + heal
      const tw = v.Huntress_AS_Teamwide, own = v.Huntress_AS, heal = v.Huntress_Heal;
      const marks = v.NumMarks;
      if (tw) lines.push(`강화 칸 모든 아군 공속 +${pct(tw)}`);
      if (own) lines.push(`별돌보미 공속 추가 +${pct(own)}`);
      if (marks) lines.push(`전투 시작: 적 maxHp 상위 ${marks}명 표식`);
      if (heal) lines.push(`표식 적 사망 시 별돌보미 maxHp ${pct(heal)} 회복`);
      break;
    }
    case 'snake': {
      // Serpent: teamwide DR + 별돌보미 추가 DR + poison
      const tw = v.Serpent_DR_Teamwide, own = v.Serpent_DR;
      const poison = v.Serpent_Poison, dur = v.Serpent_Duration;
      if (tw) lines.push(`강화 칸 모든 아군 내구력 +${pct(tw)}`);
      if (own) lines.push(`별돌보미 내구력 추가 +${pct(own)}`);
      if (poison && dur) lines.push(`별돌보미 명중 적: 입힌 피해 ${pct(poison)} 를 ${dur}초 마법 DOT`);
      break;
    }
    case 'altar': {
      // Shield: teamwide HP/AS + 60회 사망 cashout
      const hp = v.Shield_Health_Teamwide, as = v.Shield_AS_Teamwide;
      const cHp = v.Shield_CashoutHP, cAs = v.Shield_CashoutAS, n = v.Shield_NumDeaths;
      if (hp) lines.push(`강화 칸 모든 아군 체력 +${hp}%`);
      if (as) lines.push(`강화 칸 모든 아군 공속 +${as}%`);
      if (n && (cHp || cAs)) {
        lines.push(`사망 ${n}회 누적 시 별돌보미 추가:`);
        if (cHp) lines.push(`  체력 +${cHp}%`);
        if (cAs) lines.push(`  공속 +${cAs}%`);
      }
      break;
    }
    case 'well': {
      // Fountain: teamwide ManaRegen + 별돌보미 추가 + 스킬 시전 시 lowest HP heal
      const tw = v.Fountain_ManaRegen_Teamwide, own = v.Fountain_ManaRegen;
      const heal = v.Fountain_HealPercent;
      if (tw) lines.push(`강화 칸 모든 아군 마나재생 +${tw}/초`);
      if (own) lines.push(`별돌보미 마나재생 추가 +${own}/초`);
      if (heal) lines.push(`별돌보미 스킬 시전 시 즉발 피해의 ${pct(heal)} 만큼 가장 낮은 아군 회복`);
      break;
    }
  }
  return lines.join('\n');
}
