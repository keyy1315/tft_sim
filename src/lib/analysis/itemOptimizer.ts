import type { RawChampion, RawItem, RawTrait, ChampionStats } from '@/types';
import { STAR_SCALING } from '@/types';
import { calculateStats } from '@/lib/simulator/systems/stat';
import { resolveTraits } from '@/lib/simulator/systems/trait';

/** 공격형 조합 재료 */
const OFFENSIVE_COMPONENTS = new Set([
  'TFT_Item_BFSword',
  'TFT_Item_RecurveBow',
  'TFT_Item_NeedlesslyLargeRod',
  'TFT_Item_SparringGloves',
]);

/** 탱커/유틸 아이템 — 공격 재료가 포함되어도 딜 아이템이 아닌 것 */
const TANK_ITEMS = new Set([
  'TFT_Item_Crownguard',               // 크라운가드
  'TFT_Item_Radiant_Crownguard',       // 찬란한 크라운가드
  'TFT_Item_IonicSpark',               // 이온 충격기
  'TFT_Item_Radiant_IonicSpark',       // 찬란한 이온 충격기
  'TFT_Item_NightHarvester',           // 굳건한 심장
  'TFT_Item_Radiant_NightHarvester',   // 찬란한 굳건한 심장
  'TFT_Item_UnstableConcoction',       // 정의의 손길
  'TFT_Item_CorruptedHandOfJustice',   // 찬란한 정의의 손길
  'TFT_Item_Quicksilver',              // 수은
  'TFT_Item_Radiant_Quicksilver',      // 찬란한 수은
  'TFT_Item_SteraksGage',              // 스테락의 도전
  'TFT_Item_Radiant_SteraksGage',      // 찬란한 스테락의 도전
  'TFT_Item_GuardianAngel',            // 밤의 끝자락
  'TFT_Item_Radiant_GuardianAngel',    // 찬란한 밤의 끝자락
  'TFT_Item_Bloodthirster',            // 피바라기
  'TFT_Item_Radiant_Bloodthirster',    // 찬란한 피바라기
]);

/** 상징 아이템 판정 */
function isEmblemItem(item: RawItem): boolean {
  return item.apiName.includes('Emblem');
}

/** 상징 아이템이 부여하는 시너지 이름 추출 (예: "중재자 상징" → "중재자") */
function getEmblemTraitName(item: RawItem): string | null {
  if (!isEmblemItem(item)) return null;
  return item.name.replace(' 상징', '');
}

/** 챔피언이 해당 시너지를 이미 가지고 있는지 체크 */
function championHasTrait(champion: RawChampion, traitName: string): boolean {
  return champion.traits.includes(traitName);
}

/** 완성된 딜 아이템인지 판정 (composition에 공격형 재료가 1개 이상, 탱커 제외, 상징 포함) */
function isDamageItem(item: RawItem): boolean {
  if (item.composition.length < 2) return false;
  if (TANK_ITEMS.has(item.apiName)) return false;
  return item.composition.some(c => OFFENSIVE_COMPONENTS.has(c));
}

/** 해당 아이템을 이 챔피언에게 장착할 수 있는지 체크 */
function canEquipItem(item: RawItem, champion: RawChampion): boolean {
  const traitName = getEmblemTraitName(item);
  if (traitName && championHasTrait(champion, traitName)) return false;
  return true;
}

function isTankRole(champ: RawChampion): boolean {
  return champ.role?.includes('Tank') ?? false;
}

function isAPRole(champ: RawChampion): boolean {
  const role = champ.role;
  if (!role) return false;
  return role.startsWith('AP') && !role.includes('Tank');
}

/** 아이템에서 DPS에 영향 주는 특수 효과를 추출 */
export interface ItemDpsModifiers {
  // 피해 증폭 (곱연산)
  damageAmp: number;       // BonusDamage, DamageAmp, DamageIncrease, PercentDamage
  damageRepeat: number;    // DamageRepeat (드론 업링크)
  adDamageAmp: number;     // ADDamage (귀여운 발사기: AD 피해 40% 추가)
  apScalar: number;        // APScalar (타오르는 단궁: AP 75% 스케일링)
  splashDamage: number;    // SplashDamage + PercentAttackDamageSplash (스플래시)
  // 추가 고정 피해
  burnPercent: number;     // BurnPercent (화상 초당 %)
  flatDamage: number;      // BaseDamage (루덴 100), CleaveDamage (악성코드 75)
  maxHpDamage: number;     // MaxHealthDamage (최대체력% 피해)
  // 마나/시전
  manaRegen: number;       // ManaRegen, FlatManaRestore, ManaGain
  bonusAttacks: number;    // NumBonusAttacks (야스오 검술: 추가 공격)
  // 중첩 아이템
  asPerStack: number;      // AttackSpeedPerStack (구인수), ASPerStack (명멸검)
  adPerStack: number;      // StackingAD (거결), ADPerBonus (명멸검)
  apPerStack: number;      // StackingSP (거결), APPerBonus (명멸검)
  stackCap: number;        // StackCap
  procAS: number;          // ProcAttackSpeed (수은)
  // 처치 보너스
  adapPerKill: number;     // ADAPPerTakedown (카파 주스)
}

export function extractItemDpsModifiers(items: RawItem[]): ItemDpsModifiers {
  const mods: ItemDpsModifiers = {
    damageAmp: 0, damageRepeat: 0, adDamageAmp: 0, apScalar: 0, splashDamage: 0,
    burnPercent: 0, flatDamage: 0, maxHpDamage: 0,
    manaRegen: 0, bonusAttacks: 0,
    asPerStack: 0, adPerStack: 0, apPerStack: 0, stackCap: 25, procAS: 0,
    adapPerKill: 0,
  };
  for (const item of items) {
    const e = item.effects;
    // 피해 증폭
    if (typeof e['BonusDamage'] === 'number') mods.damageAmp += e['BonusDamage'];
    if (typeof e['DamageAmp'] === 'number') mods.damageAmp += e['DamageAmp'];
    if (typeof e['DamageIncrease'] === 'number') mods.damageAmp += e['DamageIncrease'];
    if (typeof e['DamageIncreasePercent'] === 'number') mods.damageAmp += e['DamageIncreasePercent'];
    if (typeof e['PercentDamage'] === 'number') mods.damageAmp += e['PercentDamage'] / 100;
    if (typeof e['DamageRepeat'] === 'number') mods.damageRepeat += e['DamageRepeat'] / 100;
    if (typeof e['ADDamage'] === 'number') mods.adDamageAmp += e['ADDamage'];
    if (typeof e['APScalar'] === 'number') mods.apScalar += e['APScalar'];
    if (typeof e['SplashDamage'] === 'number') mods.splashDamage += e['SplashDamage'];
    if (typeof e['PercentAttackDamageSplash'] === 'number') mods.splashDamage += e['PercentAttackDamageSplash'] / 100;
    if (typeof e['PercentMaxHealthSplash'] === 'number') mods.splashDamage += e['PercentMaxHealthSplash'] / 100;
    // 추가 고정 피해
    if (typeof e['BurnPercent'] === 'number') mods.burnPercent += e['BurnPercent'];
    if (typeof e['BaseDamage'] === 'number') mods.flatDamage += e['BaseDamage'];
    if (typeof e['CleaveDamage'] === 'number') mods.flatDamage += e['CleaveDamage'];
    if (typeof e['MaxHealthDamage'] === 'number') mods.maxHpDamage += e['MaxHealthDamage'];
    // 마나/시전
    if (typeof e['ManaRegen'] === 'number') mods.manaRegen += e['ManaRegen'];
    if (typeof e['FlatManaRestore'] === 'number') mods.manaRegen += e['FlatManaRestore'];
    if (typeof e['ManaGain'] === 'number') mods.manaRegen += e['ManaGain'];
    if (typeof e['NumBonusAttacks'] === 'number') mods.bonusAttacks += e['NumBonusAttacks'];
    // 중첩
    if (typeof e['AttackSpeedPerStack'] === 'number') mods.asPerStack += e['AttackSpeedPerStack'];
    if (typeof e['ASPerStack'] === 'number') mods.asPerStack += e['ASPerStack'] * 100;
    if (typeof e['StackingAD'] === 'number') mods.adPerStack += e['StackingAD'];
    if (typeof e['ADPerBonus'] === 'number') mods.adPerStack += e['ADPerBonus'];
    if (typeof e['StackingSP'] === 'number') mods.apPerStack += e['StackingSP'];
    if (typeof e['APPerBonus'] === 'number') mods.apPerStack += e['APPerBonus'];
    if (typeof e['StackCap'] === 'number') mods.stackCap = e['StackCap'];
    if (typeof e['ProcAttackSpeed'] === 'number') mods.procAS += e['ProcAttackSpeed'];
    if (typeof e['ASPerMissingHealthPercent'] === 'number') mods.procAS += e['ASPerMissingHealthPercent'] * DPS_CALIBRATION.AVG_MISSING_HP_PCT;
    // 처치 보너스 (평균 2킬 가정)
    if (typeof e['ADAPPerTakedown'] === 'number') mods.adapPerKill += e['ADAPPerTakedown'];
  }
  return mods;
}

/** 평균 전투 시간(초) 기준 중첩 아이템 평균 스택 수 추정 */
function estimateAvgStacks(attackSpeed: number, combatDuration: number, stackCap: number): number {
  const totalAttacks = attackSpeed * combatDuration;
  return Math.min(totalAttacks, stackCap);
}

const AVG_COMBAT_DURATION = 15; // 평균 전투 시간 15초

/**
 * estimateDps 내부 계수 — Phase 6-B Part 2 calibration 적용본.
 *
 * 측정 일자: 2026-04-21
 * 측정 스크립트: tests/calibration/calibrate-dps.test.ts
 * 측정 결과: docs/03-analysis/calibration-dps-results.json
 *
 * 시뮬 시나리오:
 *   - mid-4v4: Jhin/Karma/Rammus/Pantheon vs Maokai/Aurora/Akali/Caitlyn (모두 2성)
 *   - late-7v7: Jhin/Karma/Aurora/Kindred + Rammus/Pantheon/Maokai vs Akali/Caitlyn/Vex/Xayah + Galio/Illaoi/Maokai
 *   - 시드: [1, 7, 13, 42, 99, 137, 211] (결정론 7회 평균)
 *
 * 측정 가능 3개 (실측 적용):
 *   #2 AVG_ENEMY_HP_FOR_BURN — 챔피언 데이터 가중평균 (cost 1:10%, 2:25%, 3:30%, 4:25%, 5:10%)
 *   #4 AVG_MISSING_HP_PCT    — snapshot 기반 양팀 평균 missing hp%
 *   #6 AVG_KILLS_PER_COMBAT  — 캐리(비탱커) killCount 평균 (탱커 별도)
 *
 * 측정 곤란 3개 (baseline 유지 + 사유):
 *   #1 FLAT_DAMAGE_PROC_RATE — 엔진에 BaseDamage(루덴) 직접 처리 미구현, control(stat-equivalent) 깨짐
 *   #3 BONUS_ATTACK_DPS_MULT — 엔진에 NumBonusAttacks(야스오 검술) 미구현
 *   #5 MANA_REGEN_EFFICIENCY — 대천사 vs 라바돈 control 깨짐 (ap stat 차이로 적이 빨리 죽어 cast 적음)
 */
export const DPS_CALIBRATION = {
  /** 루덴/악성코드 등 고정 피해 아이템의 초당 발동 확률 추정치.
   *  baseline 0.3 유지. 엔진에 BaseDamage(루덴) 직접 처리 미구현 → 시뮬 역산 불가. */
  FLAT_DAMAGE_PROC_RATE: 0.3,

  /** 화상 DPS 계산용 "적 평균 체력" (BurnPercent × 이 값 / 100).
   *  measured: 1539 (mid-game 2성 가중평균), round to 1500 = 15 * 100. */
  AVG_ENEMY_HP_FOR_BURN: 15 * 100, // 1500

  /** 추가 공격 (야스오 검술) 의 DPS 기여율.
   *  baseline 0.3 유지. 엔진에 NumBonusAttacks 미구현 → 측정 불가. */
  BONUS_ATTACK_DPS_MULT: 0.3,

  /** "잃은 체력 %당 공격속도" 의 가중치 — 전투 중 평균 missing HP% 추정.
   *  measured: 38.0 (n=14, σ=2.4, mid-4v4 + late-7v7 통합). */
  AVG_MISSING_HP_PCT: 38,

  /** 마나 재생 효율 — mana regen × duration × 이 값 만큼 effectiveMana 감소.
   *  baseline 0.1 유지. 대천사 vs 라바돈 control 깨짐 (다른 stat 차이로 noise). */
  MANA_REGEN_EFFICIENCY: 0.1,

  /** 평균 처치 수 (ADAPPerTakedown 같은 on-kill 스케일링).
   *  measured: 0.99 (n=91, σ=1.34, 캐리 비탱커 평균. 탱커 평균 0.14).
   *  4v4/7v7 시뮬 기준이므로 8v8 실게임에서는 더 높을 가능성 있음. */
  AVG_KILLS_PER_COMBAT: 1,
} as const;

/**
 * 챔피언의 예상 DPS 계산.
 *
 * 반영 항목:
 * - 기본 스탯 (calculateStats: 성급 × 시너지 × 아이템 기본효과)
 * - 중첩 아이템 (구인수 AS, 거결 AD/AP, 수은 AS, 명멸검)
 * - 피해 증폭 (죽음의 검, 찬란한 라바돈, 끝없는 절망, 동물특공대 등)
 * - 피해 반복 (드론 업링크)
 * - AD 추가 피해 (귀여운 발사기), AP 스케일링 (타오르는 단궁)
 * - 스플래시 (포악한 절단검, 거대한 히드라)
 * - 화상/고정 피해 (루덴, 악성코드 매트릭스)
 * - 추가 공격 (야스오 검술)
 * - 마나 재생 → AP 시전 빈도 증가
 * - 처치 보너스 (카파 주스, 평균 2킬 가정)
 */
export function estimateDps(
  stats: ChampionStats,
  isAP: boolean,
  starLevel: number = 1,
  items: RawItem[] = [],
): number {
  const mods = extractItemDpsModifiers(items);
  const avgStacks = estimateAvgStacks(stats.attackSpeed, AVG_COMBAT_DURATION, mods.stackCap);
  const halfStacks = avgStacks / 2;

  // 중첩 보너스
  const stackAS = (mods.asPerStack / 100) * halfStacks + mods.procAS * halfStacks;
  const stackAD = mods.adPerStack * halfStacks;
  const stackAP = mods.apPerStack * halfStacks;

  // 처치 보너스 (역할별 평균 킬 수)
  const killBonusAD = mods.adapPerKill * DPS_CALIBRATION.AVG_KILLS_PER_COMBAT;
  const killBonusAP = mods.adapPerKill * DPS_CALIBRATION.AVG_KILLS_PER_COMBAT;

  const totalAS = stats.attackSpeed * (1 + stackAS);
  const ampMul = 1 + mods.damageAmp;
  const repeatMul = 1 + mods.damageRepeat;
  const splashMul = 1 + mods.splashDamage;

  // 추가 공격 보너스 (야스오 검술: 일정 주기마다 추가 공격)
  const bonusAttackMul = 1 + mods.bonusAttacks * DPS_CALIBRATION.BONUS_ATTACK_DPS_MULT;

  // 고정 추가 피해 (루덴, 악성코드 등) — 초당 환산
  const flatDpsBonus = mods.flatDamage * totalAS * DPS_CALIBRATION.FLAT_DAMAGE_PROC_RATE;
  // 화상 피해 (초당 최대체력 %)
  const burnDps = mods.burnPercent * (DPS_CALIBRATION.AVG_ENEMY_HP_FOR_BURN / 100);

  if (isAP) {
    const star = STAR_SCALING[starLevel] ?? 1;
    const effectiveMana = Math.max(
      stats.maxMana - mods.manaRegen * AVG_COMBAT_DURATION * DPS_CALIBRATION.MANA_REGEN_EFFICIENCY,
      20,
    );
    const castFreq = 100 / effectiveMana;
    const baseApDps = (100 + stats.ap + stackAP + killBonusAP) * star * totalAS * castFreq;
    const apScalarBonus = mods.apScalar > 0 ? (stats.ap + stackAP) * mods.apScalar * totalAS : 0;
    return (baseApDps + apScalarBonus + flatDpsBonus + burnDps) * ampMul * repeatMul * splashMul * bonusAttackMul;
  }

  const totalAD = stats.damage * (1 + stackAD) + stats.damage * killBonusAD;
  const critMul = 1 + stats.critChance * (stats.critMultiplier - 1);
  const baseAdDps = totalAD * totalAS * critMul;
  const adDamageBonus = mods.adDamageAmp > 0 ? totalAD * mods.adDamageAmp * totalAS : 0;
  return (baseAdDps + adDamageBonus + flatDpsBonus + burnDps) * ampMul * repeatMul * splashMul * bonusAttackMul;
}

/** C(n, k) 조합 생성 */
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const result: T[][] = [];
  for (let i = 0; i <= arr.length - k; i++) {
    for (const rest of combinations(arr.slice(i + 1), k - 1)) {
      result.push([arr[i], ...rest]);
    }
  }
  return result;
}

interface CarryCandidate {
  id: string;
  champion: RawChampion;
  starLevel: number;
  isAP: boolean;
  /** 시너지 전용 아이템 등 고정 아이템 (재분배 대상 아님, DPS 계산에는 포함) */
  fixedItems: RawItem[];
}

export interface ItemRecommendation {
  championId: string;
  championName: string;
  currentItems: string[];
  recommendedItems: string[];
  dpsChange: number;
}

export interface OptimizationResult {
  recommendations: ItemRecommendation[];
  totalDpsImprovement: number;
  mainCarryId: string;
  mainCarryName: string;
}

/**
 * 딜 아이템의 최적 분배를 찾는다.
 *
 * 알고리즘:
 * 1. 모든 챔피언에서 완성된 딜 아이템 수집
 * 2. 비탱커 유닛을 캐리 후보로 선정
 * 3. 각 후보를 메인 캐리로 가정하고, 최대 3개 아이템 조합 시도
 * 4. 남은 아이템은 다른 후보에게 greedy 배분
 * 5. 메인 캐리 DPS 우선, 팀 DPS 합산으로 최적 찾기
 * 6. 실제 분배와 비교
 */
export function optimizeItems(
  champions: Array<{ id: string; tier: number; items: string[] }>,
  championData: RawChampion[],
  itemData: RawItem[],
  traitData: RawTrait[],
): OptimizationResult | null {
  const champMap = new Map(championData.map(c => [c.apiName, c]));
  const itemMap = new Map(itemData.map(i => [i.apiName, i]));

  // 시너지 해석
  const resolvedChampions = champions
    .map(c => ({ champion: champMap.get(c.id)! }))
    .filter(c => c.champion);
  const activeTraits = resolveTraits(resolvedChampions, traitData);

  // 1. 딜 아이템 수집
  const damageItemPool: RawItem[] = [];
  for (const c of champions) {
    for (const itemId of c.items) {
      const item = itemMap.get(itemId);
      if (item && isDamageItem(item)) {
        damageItemPool.push(item);
      }
    }
  }

  if (damageItemPool.length === 0) return null;

  // 2. 캐리 후보 (비탱커) + 시너지 전용 아이템 분리
  const carryCandidates: CarryCandidate[] = [];
  for (const c of champions) {
    const champ = champMap.get(c.id);
    if (!champ) continue;
    if (isTankRole(champ)) continue;
    // 시너지 전용 아이템 = composition이 없는 아이템 (재분배 대상 아님)
    const fixedItems: RawItem[] = [];
    for (const itemId of c.items) {
      const item = itemMap.get(itemId);
      if (item && item.composition.length === 0) {
        fixedItems.push(item);
      }
    }
    carryCandidates.push({
      id: c.id,
      champion: champ,
      starLevel: c.tier,
      isAP: isAPRole(champ),
      fixedItems,
    });
  }

  if (carryCandidates.length === 0) return null;

  // 헬퍼: 고정 아이템 + 재분배 아이템을 합쳐서 DPS 계산
  //
  // 상징 아이템 감지 (Phase 6-A, emblem-synergy-dps Plan):
  // candidate 가 상징을 장착하면 해당 시너지를 candidate 의 traits 에 임시 추가해서
  // `resolveTraits` 를 재실행. 새 activeTraits 로 calculateStats → 시너지 tier 상승분이
  // DPS 에 반영됨. (상징 기본 스탯만 반영되던 문제 해결)
  function calcDps(candidate: CarryCandidate, redistributedItems: RawItem[]): number {
    const allItems = [...candidate.fixedItems, ...redistributedItems];

    // 상징 trait 추출
    const emblemTraits: string[] = [];
    for (const it of allItems) {
      const t = getEmblemTraitName(it);
      // 이미 같은 trait 가진 유닛에겐 등록 안 됨 (canEquipItem 에서 차단)
      // 따라서 emblem trait 은 항상 신규 trait
      if (t) emblemTraits.push(t);
    }

    let effectiveActiveTraits = activeTraits;
    if (emblemTraits.length > 0) {
      // 해당 candidate 의 champion 객체만 traits 확장한 복사본으로 교체
      const augmentedChamp: RawChampion = {
        ...candidate.champion,
        traits: [...candidate.champion.traits, ...emblemTraits],
      };
      const modifiedTeam = resolvedChampions.map(rc =>
        rc.champion.apiName === candidate.champion.apiName
          ? { champion: augmentedChamp }
          : rc,
      );
      effectiveActiveTraits = resolveTraits(modifiedTeam, traitData);
    }

    const { stats } = calculateStats(candidate.champion, candidate.starLevel, allItems, effectiveActiveTraits);
    return estimateDps(stats, candidate.isAP, candidate.starLevel, allItems);
  }

  // 고정 아이템을 뺀 남은 슬롯 수 계산
  function availableSlots(candidate: CarryCandidate): number {
    return Math.max(0, 3 - candidate.fixedItems.length);
  }

  // 3. 메인 캐리 결정: 딜 아이템 3개 장착 유닛은 전부 메인 캐리로 고정
  const playerMainCarries = new Set(
    carryCandidates
      .filter(c => {
        const champ = champions.find(ch => ch.id === c.id);
        if (!champ) return false;
        const dmgItemCount = champ.items.filter(id => {
          const item = itemMap.get(id);
          return item && isDamageItem(item);
        }).length;
        return dmgItemCount >= 3;
      })
      .map(c => c.id)
  );

  // 고정 캐리가 있으면: 고정 캐리들에게 각각 최적 3템 → 나머지만 재분배
  // 고정 캐리가 없으면: 모든 비탱커 후보 중 DPS 기반 결정
  const mainCarryCandidates = playerMainCarries.size > 0
    ? carryCandidates.filter(c => playerMainCarries.has(c.id))
    : carryCandidates;
  const subCarryCandidates = playerMainCarries.size > 0
    ? carryCandidates.filter(c => !playerMainCarries.has(c.id))
    : [];

  // 4. 최적 분배 탐색
  let bestScore = -1;
  let bestDistribution: Map<string, RawItem[]> = new Map();
  let bestMainCarryId = '';

  const poolSize = damageItemPool.length;

  // 고정 캐리가 여러 명이면: 각 고정 캐리에게 최적 아이템 배분 후 나머지 greedy
  if (playerMainCarries.size > 0) {
    // 고정 캐리별로 최적 아이템 조합 탐색 (순차)
    function allocateFixedCarries(
      carries: CarryCandidate[],
      pool: RawItem[],
      dist: Map<string, RawItem[]>,
    ): { pool: RawItem[]; dist: Map<string, RawItem[]>; topCarryId: string; topDps: number } {
      let topCarryId = '';
      let topDps = 0;

      for (const carry of carries) {
        const slots = availableSlots(carry);
        const count = Math.min(slots, pool.length);
        if (count === 0) { dist.set(carry.id, []); continue; }

        let bestItems: RawItem[] = [];
        let bestDps = -1;
        for (const combo of combinations(pool, count)) {
          // 상징 아이템 장착 제약: 이미 해당 시너지인 유닛에게 못 줌
          if (combo.some(item => !canEquipItem(item, carry.champion))) continue;
          const dps = calcDps(carry, combo);
          if (dps > bestDps) {
            bestDps = dps;
            bestItems = combo;
          }
        }
        dist.set(carry.id, bestItems);
        for (const used of bestItems) {
          const idx = pool.indexOf(used);
          if (idx >= 0) pool.splice(idx, 1);
        }
        if (bestDps > topDps) {
          topDps = bestDps;
          topCarryId = carry.id;
        }
      }
      return { pool, dist, topCarryId, topDps };
    }

    const dist = new Map<string, RawItem[]>();
    const remainingPool = [...damageItemPool];
    const { pool: leftover, topCarryId } = allocateFixedCarries(mainCarryCandidates, remainingPool, dist);

    // 남은 아이템은 서브 캐리에게 greedy 배분
    const subItems = new Map<string, RawItem[]>();
    for (const c of subCarryCandidates) subItems.set(c.id, []);

    const unassigned = [...leftover];
    while (unassigned.length > 0) {
      let bestGainVal = -1;
      let bestCandidateId = '';
      let bestItemIdx = -1;

      for (const candidate of subCarryCandidates) {
        const current = subItems.get(candidate.id)!;
        if (current.length >= availableSlots(candidate)) continue;
        for (let i = 0; i < unassigned.length; i++) {
          if (!canEquipItem(unassigned[i], candidate.champion)) continue;
          const withItem = [...current, unassigned[i]];
          const gain = calcDps(candidate, withItem) - calcDps(candidate, current);
          if (gain > bestGainVal) {
            bestGainVal = gain;
            bestCandidateId = candidate.id;
            bestItemIdx = i;
          }
        }
      }
      if (bestItemIdx === -1) break;
      const assignedItem = unassigned.splice(bestItemIdx, 1)[0];
      subItems.get(bestCandidateId)!.push(assignedItem);
    }

    for (const [id, items] of subItems) dist.set(id, items);

    // 점수 계산
    let totalDps = 0;
    let mainDps = 0;
    for (const candidate of carryCandidates) {
      const dps = calcDps(candidate, dist.get(candidate.id) ?? []);
      totalDps += dps;
      if (candidate.id === topCarryId) mainDps = dps;
    }

    bestScore = mainDps * 1.5 + totalDps;
    bestDistribution = dist;
    bestMainCarryId = topCarryId;
  }

  // 고정 캐리 없으면 기존 로직: 모든 후보를 메인 캐리로 시도
  for (const mainCarry of (playerMainCarries.size > 0 ? [] : carryCandidates)) {
    const mainSlots = availableSlots(mainCarry);
    if (mainSlots === 0) continue;

    // 메인 캐리에게 줄 아이템 조합 (남은 슬롯만큼)
    const mainItemCount = Math.min(mainSlots, poolSize);

    for (const mainItems of combinations(damageItemPool, mainItemCount)) {
      // 상징 아이템 장착 제약
      if (mainItems.some(item => !canEquipItem(item, mainCarry.champion))) continue;
      // 남은 아이템
      const remaining = [...damageItemPool];
      for (const used of mainItems) {
        const idx = remaining.indexOf(used);
        if (idx >= 0) remaining.splice(idx, 1);
      }

      // 남은 아이템을 다른 캐리에게 greedy 배분
      const distribution = new Map<string, RawItem[]>();
      distribution.set(mainCarry.id, mainItems);

      const otherCandidates = carryCandidates.filter(c => c.id !== mainCarry.id);
      const otherItems = new Map<string, RawItem[]>();
      for (const c of otherCandidates) otherItems.set(c.id, []);

      const unassigned = [...remaining];
      while (unassigned.length > 0) {
        let bestGain = -1;
        let bestCandidateId = '';
        let bestItemIdx = -1;

        for (const candidate of otherCandidates) {
          const current = otherItems.get(candidate.id)!;
          if (current.length >= availableSlots(candidate)) continue;

          for (let i = 0; i < unassigned.length; i++) {
            if (!canEquipItem(unassigned[i], candidate.champion)) continue;
            const withItem = [...current, unassigned[i]];
            const gain = calcDps(candidate, withItem) - calcDps(candidate, current);
            if (gain > bestGain) {
              bestGain = gain;
              bestCandidateId = candidate.id;
              bestItemIdx = i;
            }
          }
        }

        if (bestItemIdx === -1) break;
        const assignedItem = unassigned.splice(bestItemIdx, 1)[0];
        otherItems.get(bestCandidateId)!.push(assignedItem);
      }

      for (const [id, items] of otherItems) {
        distribution.set(id, items);
      }

      // 5. 점수 계산: 메인 캐리 DPS × 1.5 + 팀 DPS
      const mainDps = calcDps(mainCarry, mainItems);
      let teamDps = mainDps;
      for (const candidate of otherCandidates) {
        teamDps += calcDps(candidate, otherItems.get(candidate.id)!);
      }
      const score = mainDps * 1.5 + teamDps;

      if (score > bestScore) {
        bestScore = score;
        bestDistribution = distribution;
        bestMainCarryId = mainCarry.id;
      }
    }
  }

  if (!bestMainCarryId) return null;

  // 6. 실제 분배와 비교
  const actualDistribution = new Map<string, string[]>();
  for (const c of champions) {
    const damageItems = c.items.filter(id => {
      const item = itemMap.get(id);
      return item && isDamageItem(item);
    });
    if (damageItems.length > 0) {
      actualDistribution.set(c.id, damageItems);
    }
  }

  const recommendations: ItemRecommendation[] = [];
  let actualTotalDps = 0;
  let optimalTotalDps = 0;

  for (const candidate of carryCandidates) {
    const actualItems = (actualDistribution.get(candidate.id) ?? [])
      .map(id => itemMap.get(id))
      .filter((i): i is RawItem => i != null);
    const optimalItems = bestDistribution.get(candidate.id) ?? [];

    const actualDps = calcDps(candidate, actualItems);
    const optimalDps = calcDps(candidate, optimalItems);

    actualTotalDps += actualDps;
    optimalTotalDps += optimalDps;

    const actualIds = actualItems.map(i => i.apiName).sort();
    const optimalIds = optimalItems.map(i => i.apiName).sort();
    const isSame = actualIds.length === optimalIds.length && actualIds.every((id, i) => id === optimalIds[i]);

    if (!isSame) {
      recommendations.push({
        championId: candidate.id,
        championName: candidate.champion.name,
        currentItems: actualItems.map(i => i.name),
        recommendedItems: optimalItems.map(i => i.name),
        dpsChange: actualDps > 0 ? ((optimalDps - actualDps) / actualDps) * 100 : optimalDps > 0 ? 100 : 0,
      });
    }
  }

  if (recommendations.length === 0) return null; // 이미 최적

  const totalDpsImprovement = actualTotalDps > 0
    ? ((optimalTotalDps - actualTotalDps) / actualTotalDps) * 100
    : 0;

  const mainChamp = champMap.get(bestMainCarryId);

  return {
    recommendations,
    totalDpsImprovement,
    mainCarryId: bestMainCarryId,
    mainCarryName: mainChamp?.name ?? bestMainCarryId,
  };
}
