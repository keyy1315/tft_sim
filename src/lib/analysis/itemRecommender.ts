import type { RawChampion, RawItem, ChampionStats, PlacedChampion, HexCoord, ActiveTrait } from '@/types';
import type {
  RoleCategory,
  Recommendation,
  VerifyContext,
  VerifiedResult,
  VerifiedPerItem,
} from '@/types/analysis';
import { estimateDps } from '@/lib/analysis/itemOptimizer';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { getItemCategory, isDisabledItem } from '@/lib/simulator/systems/item';
import { SPELL_CRIT_ITEMS, SPELL_CRIT_UNLOCK_BONUS } from '@/lib/combat/spellCrit';

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

/** 트레잇 활성 수준 — apiName → 활성된 breakpoint minUnits (비활성 0). */
export interface FilterContext {
  psyOpsLevel: number;
  animaSquadLevel: number;
}

/** ActiveTrait[] 에서 특정 trait apiName 의 활성 minUnits 를 조회. 비활성이면 0. */
export function activeMinUnits(activeTraits: ActiveTrait[], apiName: string): number {
  const t = activeTraits.find(x => x.trait.apiName === apiName && x.activeEffect);
  return t?.activeEffect?.minUnits ?? 0;
}

/** 시너지 활성 상태에 따라 불가능한 아이템 제외.
 *  - 유물(Artifact) 완전 제외
 *  - 찬란한(Radiant) / 타락한(Corrupted) 변종 완전 제외 — 일반 플레이에서 드롭 불가
 *    (단 TFT17_Item_PsyOps_*_Radiant 는 PsyOps 규칙 우선 적용)
 *  - 동물특공대 만능 무기 완전 제외
 *  - AnimaSquad 아이템: 동물특공대 ≥ 3 활성 시에만
 *  - PsyOps 아이템: 초능력 ≥ 2 활성 시에만 */
function filterByTraitRules(items: RawItem[], ctx: FilterContext): RawItem[] {
  return items.filter(it => {
    const api = it.apiName;
    // PsyOps 는 시너지 규칙 우선 (Radiant 변종 포함)
    if (api.startsWith('TFT17_Item_PsyOps_')) return ctx.psyOpsLevel >= 2;
    // 유물 / 찬란한 / 타락한 (찬란한의 변종) 전면 제외
    if (api.includes('_Artifact_') || api.includes('Artifact')) return false;
    if (api.startsWith('TFT_Item_Radiant_')) return false;
    if (api.startsWith('TFT_Item_Corrupted')) return false;
    // 동물특공대 만능 무기 + 조건부 AnimaSquad
    if (api === 'TFT17_AnimaSquadItem_Tier4_Omniweapon') return false;
    if (api.startsWith('TFT17_AnimaSquadItem_')) return ctx.animaSquadLevel >= 3;
    return true;
  });
}

/** Riot 번역/데이터가 불완전한 아이템 — name 이 번역키 fallback 이거나 비어 있으면 게임에서 비활성 상태로 간주. */
function isDataIncomplete(item: RawItem): boolean {
  const name = item.name ?? '';
  return name === '' || name.startsWith('tft_item_name_');
}

/** 추천 풀에 들어갈 수 있는 카테고리인가.
 *  편집 탭의 아이템 그리드에 실제로 나오는 "완성 아이템" 만 허용.
 *  유물 / 찬란한 / 타락한 / 재료 / 시너지 상징 / 발명품 / 빌지워터 / 비활성 아이템은 모두 제외.
 *  Set 17 동물특공대(animasquad) / 초능력(psyops) 전용 아이템도 완성템 취급으로 추천 가능. */
function isRecommendable(item: RawItem): boolean {
  if (isDisabledItem(item)) return false;
  const cat = getItemCategory(item);
  return cat === 'combined' || cat === 'animasquad' || cat === 'psyops';
}

/** 역할 + damageType 기반 아이템 풀 필터. ctx 주입 시 트레잇 규칙도 적용. */
export function filterItemPool(
  all: RawItem[],
  role: RoleCategory,
  damageType: 'ad' | 'ap' | 'none',
  ctx?: FilterContext,
): RawItem[] {
  // 1) 카테고리 필터 — 편집 탭의 완성 아이템만 추천 풀로 허용
  //    (유물/찬란한/타락한/재료/상징/발명품/빌지워터/비활성 아이템 전면 제외)
  // 2) 데이터 불완전 (번역 안 된 비활성) 아이템 제거
  const valid = all.filter(i => isRecommendable(i) && !isDataIncomplete(i));

  let pool: RawItem[];
  if (role === 'TANK') pool = valid.filter(i => hasAnyKey(i, TANK_KEYS));
  else if (role === 'SUPPORT') pool = valid.slice();
  else if (damageType === 'ad') pool = valid.filter(i => hasAnyKey(i, AD_KEYS) && !isPureAP(i));
  else if (damageType === 'ap') pool = valid.filter(i => hasAnyKey(i, AP_KEYS) && !isPureAD(i));
  else pool = valid.slice();
  return ctx ? filterByTraitRules(pool, ctx) : pool;
}

/** 각 아이템 단독 장착 시 DPS 기여도 + flat 스탯 보정.
 *  estimateDps 는 AttackSpeed/Stacking 같은 배율 효과는 잘 반영하지만 단순 AD/CritChance/CritDamage 같은
 *  플랫 스탯 증가는 누락하는 편이라 IE/피바라기/죽음의 검 등 핵심 AD 캐리템이 과소평가됨.
 *  effects 키 기반 휴리스틱을 가산해 Top-N 후보에 포함되도록 균형. */
export function scoreItemsForDamage(
  stats: ChampionStats,
  isAP: boolean,
  starLevel: number,
  pool: RawItem[],
): Recommendation[] {
  const baseline = estimateDps(stats, isAP, starLevel, []);
  return pool.map(it => ({
    item: it,
    score: (estimateDps(stats, isAP, starLevel, [it]) - baseline) + flatStatBonus(it, isAP),
    reason: '',
  }));
}

/** effects 키별 경험적 가중치 — 단순 flat 스탯을 DPS 기여로 환산. */
function flatStatBonus(item: RawItem, isAP: boolean): number {
  const fx = item.effects ?? {};
  let bonus = 0;
  if (isAP) {
    bonus += (fx.AP ?? 0) * 3;
    bonus += (fx.ManaOnRoundStart ?? 0) * 2;
    bonus += (fx.ManaGain ?? 0) * 2;
    bonus += (fx.SpellDamageAmp ?? 0) * 150;
    // 보건/무대는 AP 캐리의 스킬 크리 언락 가치 (플랫 스탯 외 추가 프리미엄).
    if (SPELL_CRIT_ITEMS.has(item.apiName)) bonus += SPELL_CRIT_UNLOCK_BONUS;
  } else {
    bonus += (fx.AD ?? 0) * 2;
    bonus += (fx.AS ?? 0) * 100;             // '%' 값이라 배수
    bonus += (fx.AttackSpeed ?? 0) * 100;
    bonus += (fx.CritChance ?? 0) * 3;
    bonus += (fx.CritDamage ?? fx.CritDamageToGive ?? 0) * 2;
    bonus += (fx.LifeSteal ?? 0) * 1.5;
    bonus += (fx.Omnivamp ?? fx.StatOmnivamp ?? 0) * 2;
    bonus += (fx.ArmorReductionPercent ?? 0) * 2;
    bonus += (fx.BonusDamage ?? 0) * 1;
    bonus += (fx.StackingAD ?? 0) * 3;
    bonus += (fx.StackedAmp ?? 0) * 150;
  }
  return bonus;
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

/** 조합 선택 제약. maxPsyOps — 조합 내 PsyOps 아이템 최대 개수. */
export interface ComboConstraint {
  maxPsyOps?: number;
}

function isPsyOpsItem(r: Recommendation): boolean {
  return r.item.apiName.startsWith('TFT17_Item_PsyOps_');
}

function satisfiesConstraint(combo: Recommendation[], constraint?: ComboConstraint): boolean {
  if (!constraint) return true;
  if (constraint.maxPsyOps !== undefined) {
    const psyCount = combo.filter(isPsyOpsItem).length;
    if (psyCount > constraint.maxPsyOps) return false;
  }
  return true;
}

/** 상위 6개 후보에서 C(6,3)=20 조합 열거 → 3개 동시 장착 시 DPS 최대.
 *  제약(maxPsyOps 등) 위반 조합은 스킵. */
export function pickTopCombo(
  scored: Recommendation[],
  stats: ChampionStats,
  isAP: boolean,
  starLevel: number,
  constraint?: ComboConstraint,
): Recommendation[] {
  if (scored.length === 0) return [];
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  if (sorted.length <= 3) {
    return satisfiesConstraint(sorted, constraint) ? sorted : sorted.filter(r => !isPsyOpsItem(r));
  }
  const candidates = sorted.slice(0, 6);

  let best: Recommendation[] | null = null;
  let bestDps = -Infinity;

  for (let i = 0; i < candidates.length - 2; i++) {
    for (let j = i + 1; j < candidates.length - 1; j++) {
      for (let k = j + 1; k < candidates.length; k++) {
        const combo = [candidates[i], candidates[j], candidates[k]];
        if (!satisfiesConstraint(combo, constraint)) continue;
        const d = estimateDps(stats, isAP, starLevel, combo.map(r => r.item));
        if (d > bestDps) {
          bestDps = d;
          best = combo;
        }
      }
    }
  }
  // 제약 때문에 유효 조합이 전혀 없었다면 PsyOps 를 제거한 fallback
  if (!best) {
    const nonPsy = sorted.filter(r => !isPsyOpsItem(r)).slice(0, 3);
    return nonPsy;
  }
  return best;
}

/** 아이템 effects 키 주요 패턴 → 1줄 요약. */
export function tagReason(item: RawItem): string {
  // 보건/무대는 AP 캐리 스킬 크리 언락 — 최우선 태그
  if (SPELL_CRIT_ITEMS.has(item.apiName)) return '스킬 치명타 언락';

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

/** 1차 추천 — 역할 필터 + 시너지 규칙 + DPS 스코어 + Top-3 조합 + reason 태깅.
 *  activeTraits 주입 시 초능력/동물특공대 조건부 풀 + PsyOps 슬롯 상한 적용. */
export function getStaticRecommendations(
  champ: RawChampion,
  stats: ChampionStats,
  starLevel: number,
  allItems: RawItem[],
  activeTraits?: ActiveTrait[],
): Recommendation[] {
  const psyOpsLevel = activeTraits ? activeMinUnits(activeTraits, 'TFT17_PsyOps') : 0;
  const animaSquadLevel = activeTraits ? activeMinUnits(activeTraits, 'TFT17_AnimaSquad') : 0;
  const ctx: FilterContext = { psyOpsLevel, animaSquadLevel };

  const role = classifyRole(champ);
  const damageType = detectDamageType(champ);
  const pool = filterItemPool(allItems, role, damageType, ctx);
  if (pool.length === 0) return [];

  const scored = role === 'TANK'
    ? scoreItemsForTank(stats, pool)
    : scoreItemsForDamage(stats, damageType === 'ap', starLevel, pool);

  const isAP = damageType === 'ap';
  const maxPsyOps = psyOpsLevel >= 4 ? 2 : psyOpsLevel >= 2 ? 1 : 0;
  const combo = pickTopCombo(scored, stats, isAP, starLevel, { maxPsyOps });
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
