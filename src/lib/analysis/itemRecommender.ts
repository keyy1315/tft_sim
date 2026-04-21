import type { RawChampion, RawItem, ChampionStats, PlacedChampion, HexCoord } from '@/types';
import type {
  RoleCategory,
  Recommendation,
  VerifyContext,
  VerifiedResult,
  VerifiedPerItem,
} from '@/types/analysis';
import { estimateDps } from '@/lib/analysis/itemOptimizer';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';

/** champion.role → 추천 스코어링용 카테고리 매핑. */
export function classifyRole(champ: RawChampion): RoleCategory {
  const r = (champ.role ?? '') as string;
  if (r.includes('Tank')) return 'TANK';
  if (r.includes('Specialist')) return 'SUPPORT';
  return 'DAMAGE';
}

const AD_KEYS = ['AD', 'AttackSpeed', 'CritChance', 'CritDamage'];
const AP_KEYS = ['AP', 'SpellDamageAmp', 'ManaGain', 'ManaOnRoundStart'];
const TANK_KEYS = ['Health', 'Armor', 'MR', 'MagicResist'];

function hasAnyKey(item: RawItem, keys: string[]): boolean {
  const fx = item.effects ?? {};
  return keys.some(k => Object.keys(fx).some(fk => fk.includes(k)));
}

function isPureAP(item: RawItem): boolean {
  const fx = Object.keys(item.effects ?? {});
  return fx.some(k => k.includes('AP')) && !fx.some(k => AD_KEYS.some(ak => k.includes(ak)));
}
function isPureAD(item: RawItem): boolean {
  const fx = Object.keys(item.effects ?? {});
  return fx.some(k => AD_KEYS.some(ak => k.includes(ak))) && !fx.some(k => k.includes('AP'));
}

/** 역할 + damageType 기반 아이템 풀 필터. */
export function filterItemPool(
  all: RawItem[],
  role: RoleCategory,
  damageType: 'ad' | 'ap' | 'none',
): RawItem[] {
  if (role === 'TANK') return all.filter(i => hasAnyKey(i, TANK_KEYS));
  if (role === 'SUPPORT') return all.slice();
  if (damageType === 'ad') return all.filter(i => hasAnyKey(i, AD_KEYS) && !isPureAP(i));
  if (damageType === 'ap') return all.filter(i => hasAnyKey(i, AP_KEYS) && !isPureAD(i));
  return all.slice();
}

/** 각 아이템 단독 장착 시 DPS 에서 baseline 을 뺀 기여도. */
export function scoreItemsForDamage(
  stats: ChampionStats,
  isAP: boolean,
  starLevel: number,
  pool: RawItem[],
): Recommendation[] {
  const baseline = estimateDps(stats, isAP, starLevel, []);
  return pool.map(it => ({
    item: it,
    score: estimateDps(stats, isAP, starLevel, [it]) - baseline,
    reason: '',
  }));
}

/** TANK 역할용 effective-HP 근사 스코어. */
function scoreItemsForTank(stats: ChampionStats, pool: RawItem[]): Recommendation[] {
  return pool.map(it => {
    const fx = it.effects ?? {};
    const extraHp = fx.Health ?? 0;
    const extraArmor = fx.Armor ?? 0;
    const extraMR = fx.MagicResist ?? fx.MR ?? 0;
    const totalHp = stats.hp + extraHp;
    const totalDef = (stats.armor + extraArmor + stats.magicResist + extraMR) / 200;
    return { item: it, score: totalHp * (1 + totalDef), reason: '' };
  });
}

/** 상위 6개 후보에서 C(6,3)=20 조합 열거 → 3개 동시 장착 시 DPS 최대. */
export function pickTopCombo(
  scored: Recommendation[],
  stats: ChampionStats,
  isAP: boolean,
  starLevel: number,
): Recommendation[] {
  if (scored.length === 0) return [];
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  if (sorted.length <= 3) return sorted;
  const candidates = sorted.slice(0, 6);

  let best = candidates.slice(0, 3);
  let bestDps = estimateDps(stats, isAP, starLevel, best.map(r => r.item));

  for (let i = 0; i < candidates.length - 2; i++) {
    for (let j = i + 1; j < candidates.length - 1; j++) {
      for (let k = j + 1; k < candidates.length; k++) {
        const items = [candidates[i].item, candidates[j].item, candidates[k].item];
        const d = estimateDps(stats, isAP, starLevel, items);
        if (d > bestDps) {
          bestDps = d;
          best = [candidates[i], candidates[j], candidates[k]];
        }
      }
    }
  }
  return best;
}

/** 아이템 effects 키 주요 패턴 → 1줄 요약. */
export function tagReason(item: RawItem): string {
  const keys = Object.keys(item.effects ?? {});
  if (keys.length === 0) return '범용';

  const tokens: string[] = [];
  const has = (sub: string) => keys.some(k => k.includes(sub));

  if (has('Omnivamp') || has('Vamp')) tokens.push('피해 흡혈');
  if (has('ManaOnRoundStart') || has('ManaGain')) tokens.push('마나 가속');
  if (has('AD')) tokens.push('공격력');
  if (has('CritChance') || has('CritDamage')) tokens.push('치명타');
  if (has('AttackSpeed')) tokens.push('공격속도');
  if (has('AP') && !tokens.includes('공격력')) tokens.push('주문력 강화');
  if (has('Armor') || has('MR') || has('MagicResist')) tokens.push('방어');
  if (has('Health')) tokens.push('체력');
  if (has('ArmorPen') || has('MagicPen')) tokens.push('방어 관통');

  if (tokens.length === 0) return '범용';
  return tokens.slice(0, 2).join(' · ');
}

/** 챔피언 ability.variables 에서 AD/AP 판별. 역할이 AD/AP prefix 면 2차 보정. */
function detectDamageType(champ: RawChampion): 'ad' | 'ap' | 'none' {
  const varNames = (champ.ability?.variables ?? []).map(v => v.name);
  const hasAD = varNames.some(n => n.includes('AD'));
  const hasAP = varNames.some(n => n.includes('AP') || n.includes('SpellDamage'));
  if (hasAD && !hasAP) return 'ad';
  if (hasAP && !hasAD) return 'ap';
  const r = (champ.role ?? '') as string;
  if (r.startsWith('AD')) return 'ad';
  if (r.startsWith('AP')) return 'ap';
  return 'none';
}

/** 1차 추천 — 역할 필터 + DPS 스코어 + Top-3 조합 + reason 태깅. 즉시 응답. */
export function getStaticRecommendations(
  champ: RawChampion,
  stats: ChampionStats,
  starLevel: number,
  allItems: RawItem[],
): Recommendation[] {
  const role = classifyRole(champ);
  const damageType = detectDamageType(champ);
  const pool = filterItemPool(allItems, role, damageType);
  if (pool.length === 0) return [];

  const scored = role === 'TANK'
    ? scoreItemsForTank(stats, pool)
    : scoreItemsForDamage(stats, damageType === 'ap', starLevel, pool);

  const isAP = damageType === 'ap';
  const combo = pickTopCombo(scored, stats, isAP, starLevel);
  return combo.map(r => ({ ...r, reason: tagReason(r.item) }));
}

// ============================================================
// 2차: 엔진 시뮬 검증
// ============================================================

/** targetApiName + position 일치하는 PlacedChampion 의 items 를 치환한 새 배열. */
function mutateTeam(
  team: PlacedChampion[],
  targetApiName: string,
  targetPos: HexCoord,
  newItems: RawItem[],
): PlacedChampion[] {
  return team.map(p =>
    p.champion.apiName === targetApiName &&
    p.position.q === targetPos.q &&
    p.position.r === targetPos.r
      ? { ...p, items: newItems }
      : p,
  );
}

/** 한 팀 구성으로 N 회 시뮬 후 지표 집계. */
async function runSims(
  ctx: VerifyContext,
  playerTeam: PlacedChampion[],
  n: number,
  seedBase: number,
  onProgress?: (done: number) => void,
): Promise<{ winRate: number; avgOwnDmg: number; avgOwnTanked: number; avgDuration: number }> {
  let wins = 0;
  let totalOwnDmg = 0;
  let totalOwnTanked = 0;
  let totalDur = 0;

  for (let i = 0; i < n; i++) {
    const result = simulateCombat(
      playerTeam,
      ctx.enemyTeam,
      { ...ctx.simulateOptions, seed: seedBase + i },
    );
    if (result.winner === 'player') wins++;
    totalDur += result.duration;

    const target = result.playerUnits.find(u =>
      u.champion.apiName === ctx.targetApiName &&
      u.position.q === ctx.targetPosition.q &&
      u.position.r === ctx.targetPosition.r,
    );
    if (target) {
      totalOwnDmg += target.totalDamageDealt;
      totalOwnTanked += target.totalDamageTaken;
    }

    // 이벤트 루프 양보 — UI 프리징 방지
    await new Promise(r => setTimeout(r, 0));
    onProgress?.(i + 1);
  }

  return {
    winRate: wins / n,
    avgOwnDmg: totalOwnDmg / n,
    avgOwnTanked: totalOwnTanked / n,
    avgDuration: totalDur / n,
  };
}

/** 2차 — 1차 추천 후보 조합들을 엔진 시뮬로 비교. 승률 + 역할별 기여. */
export async function verifyWithSimulation(
  ctx: VerifyContext,
  candidates: RawItem[][],
  options?: { n?: number; seedBase?: number; onProgress?: (done: number, total: number) => void },
): Promise<VerifiedResult> {
  const n = options?.n ?? 10;
  const seedBase = options?.seedBase ?? 42;
  const totalBlocks = 1 + candidates.length;
  let done = 0;

  const targetPlaced = ctx.playerTeam.find(p =>
    p.champion.apiName === ctx.targetApiName &&
    p.position.q === ctx.targetPosition.q &&
    p.position.r === ctx.targetPosition.r,
  );
  const targetRole = targetPlaced ? classifyRole(targetPlaced.champion) : 'DAMAGE';

  // 1) baseline
  const baseline = await runSims(ctx, ctx.playerTeam, n, seedBase, (i) => {
    options?.onProgress?.(done * n + i, totalBlocks * n);
  });
  done++;

  // 2) 각 candidate 조합별
  const perItem: VerifiedPerItem[] = [];
  for (const combo of candidates) {
    const mutated = mutateTeam(ctx.playerTeam, ctx.targetApiName, ctx.targetPosition, combo);
    const res = await runSims(ctx, mutated, n, seedBase, (i) => {
      options?.onProgress?.(done * n + i, totalBlocks * n);
    });
    perItem.push({
      comboLabel: combo.map(i => i.name).join(' + '),
      items: combo,
      winRate: res.winRate,
      deltaWinRate: res.winRate - baseline.winRate,
      roleScore: 0,
      avgOwnDmg: res.avgOwnDmg,
      avgOwnTanked: res.avgOwnTanked,
    });
    done++;
  }

  // 3) roleScore 정규화
  const maxDmg = Math.max(1, ...perItem.map(p => p.avgOwnDmg));
  const maxTanked = Math.max(1, ...perItem.map(p => p.avgOwnTanked));
  for (const p of perItem) {
    if (targetRole === 'TANK') {
      p.roleScore = 0.7 * p.winRate + 0.3 * (p.avgOwnTanked / maxTanked);
    } else if (targetRole === 'SUPPORT') {
      p.roleScore = p.winRate;
    } else {
      p.roleScore = 0.7 * p.winRate + 0.3 * (p.avgOwnDmg / maxDmg);
    }
  }

  const bestIndex = perItem.length === 0
    ? 0
    : perItem.reduce((best, cur, i, arr) => cur.roleScore > arr[best].roleScore ? i : best, 0);

  return {
    baseline: { winRate: baseline.winRate, avgDuration: baseline.avgDuration },
    perItem,
    bestIndex,
  };
}
