import type { RawChampion, RawItem, RawTrait } from '@/types';
import type { ItemAnalysisResult, ItemIssue } from '@/types/analysis';
import { calculateStats } from '@/lib/simulator/systems/stat';
import { resolveTraits } from '@/lib/simulator/systems/trait';
import { optimizeItems, estimateDps } from '@/lib/analysis/itemOptimizer';

/** AP 스탯 키워드가 포함된 아이템 effects */
const AP_ITEM_KEYS = ['AP', 'SpellDamageAmp', 'ManaGain'];
/** AD 스탯 키워드가 포함된 아이템 effects */
const AD_ITEM_KEYS = ['AD', 'AttackSpeed', 'CritChance', 'CritDamage'];

/** AD/AP 상관없이 사용 가능한 범용 아이템 — stat_mismatch 체크 제외 */
const UNIVERSAL_ITEMS = new Set([
  'TFT_Item_ThiefsGloves',          // 도적의 장갑
  'TFT_Item_Radiant_ThiefsGloves',  // 찬란한 도적의 장갑
  'TFT_Item_RedBuff',               // 태양불꽃 망토
  'TFT_Item_Radiant_SunfireCape',   // 찬란한 태양불꽃 망토
  'TFT_Item_PowerGauntlet',         // 타격대의 철퇴
  'TFT_Item_Radiant_TrapClaw',      // 찬란한 타격대의 철퇴
]);

/** 도적의 장갑 계열 — 장착 시 나머지 아이템 슬롯이 랜덤이라 분석 무의미 */
const THIEFS_GLOVES = new Set([
  'TFT_Item_ThiefsGloves',
  'TFT_Item_Radiant_ThiefsGloves',
]);

function isAPItem(item: RawItem): boolean {
  return AP_ITEM_KEYS.some(k =>
    Object.keys(item.effects).some(ek => ek.toUpperCase().includes(k.toUpperCase()))
  );
}

function isADItem(item: RawItem): boolean {
  return AD_ITEM_KEYS.some(k =>
    Object.keys(item.effects).some(ek => ek.toUpperCase().includes(k.toUpperCase()))
  );
}

function isAPChampion(champ: RawChampion): boolean {
  const role = champ.role;
  if (!role) return false;
  return role.startsWith('AP') && !role.includes('Tank');
}

function isADChampion(champ: RawChampion): boolean {
  const role = champ.role;
  if (!role) return false;
  return role.startsWith('AD') && !role.includes('Tank');
}

interface RoleAnalysis {
  adCarryId: string | null;
  apCarryId: string | null;
  mainTankId: string | null;
}

/**
 * AD 캐리 / AP 캐리 / 메인 탱 판정.
 *
 * - AD 캐리: AD 비탱커 유닛 중 estimateDps 1위
 * - AP 캐리: AP 비탱커 유닛 중 estimateDps 1위
 * - 메인 탱: 유효 체력(HP × (1 + armor/100)) 1위
 *
 * calculateStats로 성급 × 시너지 × 아이템 전부 반영.
 */
function identifyRoles(
  champions: Array<{ id: string; tier: number; items: string[] }>,
  championData: RawChampion[],
  itemData: RawItem[],
  traitData: RawTrait[],
): RoleAnalysis {
  const champMap = new Map(championData.map(c => [c.apiName, c]));
  const itemMap = new Map(itemData.map(i => [i.apiName, i]));

  const resolvedChampions = champions
    .map(c => ({ champion: champMap.get(c.id)! }))
    .filter(c => c.champion);
  const resolved = resolveTraits(resolvedChampions, traitData);

  let adCarryId: string | null = null;
  let adCarryDps = 0;
  let apCarryId: string | null = null;
  let apCarryDps = 0;
  let mainTankId: string | null = null;
  let mainTankEhp = 0;

  for (const c of champions) {
    const champ = champMap.get(c.id);
    if (!champ) continue;

    const items = c.items
      .map(id => itemMap.get(id))
      .filter((i): i is RawItem => i != null);

    const { stats } = calculateStats(champ, c.tier, items, resolved);

    const isAP = isAPChampion(champ);
    const isAD = isADChampion(champ);

    if (isAD) {
      const dps = estimateDps(stats, false, c.tier, items);
      if (dps > adCarryDps) {
        adCarryDps = dps;
        adCarryId = c.id;
      }
    }

    if (isAP) {
      const dps = estimateDps(stats, true, c.tier, items);
      if (dps > apCarryDps) {
        apCarryDps = dps;
        apCarryId = c.id;
      }
    }

    // 메인 탱: 유효 체력
    const ehp = stats.hp * (1 + stats.armor / 100);
    if (ehp > mainTankEhp) {
      mainTankEhp = ehp;
      mainTankId = c.id;
    }
  }

  return { adCarryId, apCarryId, mainTankId };
}

/**
 * 챔피언-아이템 궁합을 정적 분석한다.
 * AD 캐리 / AP 캐리 / 메인 탱 각각에 대해 아이템 적합성 검사.
 */
export function analyzeItems(
  champions: Array<{ id: string; tier: number; items: string[] }>,
  championData: RawChampion[],
  itemData: RawItem[],
  traitData: RawTrait[],
): ItemAnalysisResult {
  const issues: ItemIssue[] = [];
  const champMap = new Map(championData.map(c => [c.apiName, c]));
  const itemMap = new Map(itemData.map(i => [i.apiName, i]));

  const { adCarryId, apCarryId, mainTankId } = identifyRoles(champions, championData, itemData, traitData);

  for (const champ of champions) {
    const champData = champMap.get(champ.id);
    if (!champData) continue;

    // 도적의 장갑 착용 시 아이템이 랜덤이라 검사 스킵
    if (champ.items.some(id => THIEFS_GLOVES.has(id))) continue;

    const isAP = isAPChampion(champData);
    const isAD = isADChampion(champData);

    for (const itemId of champ.items) {
      const item = itemMap.get(itemId);
      if (!item) continue;
      if (UNIVERSAL_ITEMS.has(itemId)) continue;

      // AP 캐리에 AD 아이템 / AD 캐리에 AP 아이템
      if (isAP && isADItem(item) && !isAPItem(item)) {
        issues.push({
          championId: champ.id,
          itemId,
          type: 'stat_mismatch',
          severity: 'critical',
          message: `${champData.name}(AP)에 AD 아이템(${item.name}) 장착`,
        });
      }
      if (isAD && isAPItem(item) && !isADItem(item)) {
        issues.push({
          championId: champ.id,
          itemId,
          type: 'stat_mismatch',
          severity: 'critical',
          message: `${champData.name}(AD)에 AP 아이템(${item.name}) 장착`,
        });
      }
    }
  }

  // 캐리 아이템 집중도 — 메인 캐리 중 1명이라도 3아이템이면 정상
  const hasFullCarry = [adCarryId, apCarryId].some(id => {
    if (!id) return false;
    const carry = champions.find(c => c.id === id);
    return carry && carry.items.length >= 3;
  });

  if (!hasFullCarry) {
    // AD 캐리 아이템 부족
    if (adCarryId) {
      const carry = champions.find(c => c.id === adCarryId);
      if (carry && carry.items.length < 3) {
        const data = champMap.get(adCarryId);
        issues.push({
          championId: adCarryId,
          itemId: '',
          type: 'better_alternative',
          severity: 'warning',
          message: `AD 캐리(${data?.name ?? adCarryId})에 아이템이 ${carry.items.length}개 — 3개 집중 권장`,
          suggestion: 'AD 아이템을 캐리에 집중하세요',
        });
      }
    }

    // AP 캐리 아이템 부족
    if (apCarryId) {
      const carry = champions.find(c => c.id === apCarryId);
      if (carry && carry.items.length < 3) {
        const data = champMap.get(apCarryId);
        issues.push({
          championId: apCarryId,
          itemId: '',
          type: 'better_alternative',
          severity: 'warning',
          message: `AP 캐리(${data?.name ?? apCarryId})에 아이템이 ${carry.items.length}개 — 3개 집중 권장`,
          suggestion: 'AP 아이템을 캐리에 집중하세요',
        });
      }
    }
  }

  // 메인 탱 아이템 존재 여부
  if (mainTankId) {
    const tank = champions.find(c => c.id === mainTankId);
    if (tank && tank.items.length === 0) {
      const data = champMap.get(mainTankId);
      issues.push({
        championId: mainTankId,
        itemId: '',
        type: 'better_alternative',
        severity: 'warning',
        message: `메인 탱(${data?.name ?? mainTankId})에 아이템이 없습니다`,
        suggestion: '방어 아이템으로 전열 생존력을 높이세요',
      });
    }
  }

  // 아이템 최적 분배 추천
  const optimization = optimizeItems(champions, championData, itemData, traitData);
  if (optimization && optimization.totalDpsImprovement > 5) {
    for (const rec of optimization.recommendations) {
      if (rec.recommendedItems.length === 0 && rec.currentItems.length === 0) continue;
      const currentStr = rec.currentItems.length > 0 ? rec.currentItems.join(', ') : '없음';
      const recStr = rec.recommendedItems.length > 0 ? rec.recommendedItems.join(', ') : '없음';
      issues.push({
        championId: rec.championId,
        itemId: '',
        type: 'better_alternative',
        severity: 'warning',
        message: `${rec.championName}: 현재(${currentStr}) → 추천(${recStr})`,
        suggestion: `팀 DPS ${Math.round(optimization.totalDpsImprovement)}% 증가 가능 (메인 캐리: ${optimization.mainCarryName})`,
      });
    }
  }

  return { confidence: 'static', issues };
}
