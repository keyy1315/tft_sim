import { RawAugment, RawChampion, ItemEffect, AugmentTier, AUGMENT_TIER_TAGS, CombatUnit } from '@/types';

export interface AugmentWithStacks {
  augment: RawAugment;
  stackCount: number;
}

export interface InCombatAugmentEffect {
  statsPerSecond: number;
  maxDuration: number;
  bonusTrueDamage: number;
}

/** Per-unit augment modifiers applied after CombatUnit creation */
export interface PerUnitAugmentMod {
  rangeBonus: number;
  damageAmp: number;
  omnivamp: number;
  damageReduction: number;
  burnPercent: number;
  resists: number;
  manaRegen: number;          // mana per second
  shieldFlat: number;         // flat combat-start shield
  shieldMaxHpPercent: number; // % max HP shield
  armorPenBonus: number;      // armor shred
  magicPenBonus: number;      // MR shred
  grievousWounds: number;     // healing reduction applied to targets
  executeThreshold: number;   // execute below this HP %
  hpMultiplier: number;       // HP multiplier (e.g., 0.8 = -20% HP)
}

const EMPTY_MOD: PerUnitAugmentMod = {
  rangeBonus: 0, damageAmp: 0, omnivamp: 0, damageReduction: 0,
  burnPercent: 0, resists: 0, manaRegen: 0, shieldFlat: 0,
  shieldMaxHpPercent: 0, armorPenBonus: 0, magicPenBonus: 0,
  grievousWounds: 0, executeThreshold: 0, hpMultiplier: 1,
};

// === Tier helpers ===

/**
 * GodAugment 라인 중 태그로 자동 분류가 안 되는 특수 케이스들을 명시적으로 지정.
 * 주로 "신 은총" 테마이지만 태그가 비어있거나, 반대로 신 이름을 쓰지만 실제로는 일반 티어인 경우.
 */
const APINAME_TIER_OVERRIDES: Readonly<Record<string, AugmentTier>> = {
  // 은총 (태그 빠진 변형들 + 아우솔 은총 본체에서 파생되는 퀘스트 선택지)
  'TFT17_Augment_AurelionSolGodAugment_BoonOfResurrection': 'boon',
  'TFT17_Augment_KayleGodAugment_Scrapper': 'boon',
  'TFT17_Augment_AurelionSolGodAugment_SmallQuest': 'boon',
  'TFT17_Augment_AurelionSolGodAugment_MediumQuest': 'boon',
  'TFT17_Augment_AurelionSolGodAugment_LargeQuest': 'boon',

  // 챔피언 Carry 증강 중 실제는 실버/골드인 것들 (기본 Carry 휴리스틱 보정)
  'TFT17_Augment_NasusCarry': 'silver',   // 꽁!
  'TFT17_Augment_AatroxCarry': 'silver',  // 별빛 연계
  'TFT17_Augment_PoppyCarry': 'silver',   // 정령단 속도
  'TFT17_Augment_IvernMinionCarry': 'gold', // 빅뱅
  'TFT17_Augment_JaxCarry': 'gold',       // 저 별을 향해

  // GodAugment suffix지만 실제는 일반 티어 (신 변형 중 일반 증강)
  'TFT17_Augment_EvelynnGodAugment_BloodPrice': 'gold',   // 피의 대가
  'TFT17_Augment_YasuoGodAugment_MoreHexes': 'gold',       // 야스오 스포트라이트 공유
  'TFT17_Augment_YasuoGodAugment_GoldenHex': 'silver',     // 야스오 황금 칸

  // 실버 태그 → 실제는 골드 (CDragon 태그 부정확, 사용자 검수 반영)
  'TFT11_Augment_Reinfourcement': 'gold',       // 4후지원
  'TFT6_Augment_CalculatedLoss': 'gold',        // 계산된 패배
  'TFT6_Augment_Electrocharge2': 'gold',        // 고전압 II
  'TFT6_Augment_TradeSector': 'gold',           // 교환의 장
  'TFT9_Augment_LearningFromExperience2': 'gold', // 끈질긴 연구
  'TFT7_Augment_BestFriends2': 'gold',          // 단짝 II
  'TFT6_Augment_ClearMind': 'gold',             // 맑은 정신
  'TFT9_Augment_JeweledLotus': 'gold',          // 보석 연꽃 I
  'TFT6_Augment_CyberneticImplants2': 'gold',   // 사이버네틱 이식술
  'TFT6_Augment_CyberneticUplink2': 'gold',     // 사이버네틱 통신
  'TFT11_Augment_Epoch': 'gold',                // 새로운 시대
  'TFT11_Augment_EpochPlus': 'gold',            // 새로운 시대+
  'TFT6_Augment_HyperRoll': 'gold',             // 수완가
  'TFT7_Augment_ClutteredMind': 'gold',         // 어수선한 마음
  'TFT9_Augment_TonsOfStats': 'gold',           // 엄청나게 이로운 효과!
  'TFT10_Augment_HeroicGrabBag': 'gold',        // 영웅 꾸러미
  'TFT6_Augment_MakeshiftArmor2': 'gold',       // 임시변통 방어구 II
  'TFT10_Augment_LittleBuddies': 'gold',        // 작은 친구들
  'TFT11_Augment_Slammin': 'gold',              // 재빠른 무장
  'TFT11_Augment_Slammin_Plus': 'gold',         // 재빠른 무장+
  'TFT6_Augment_SecondWind2': 'gold',           // 재생의 바람 II
  'TFT6_Augment_SalvageBin': 'gold',            // 재활용 쓰레기통
  'TFT8_Augment_SalvageBinPlus': 'gold',        // 재활용 쓰레기통+
  'TFT9_Augment_Commander_Ascension': 'gold',   // 초월
  'TFT6_Augment_Distancing2': 'gold',           // 추방자 II
  'TFT10_Augment_CrashTestDummies': 'gold',     // 충돌 시험용 봇
  'TFT9_Augment_BigGrabBag': 'gold',            // 큰 꾸러미
  'TFT6_Augment_SunfireBoard': 'gold',          // 태양불꽃판
  'TFT11_Augment_Prizefighter': 'gold',         // 파이트 머니
  'TFT7_Augment_PandorasBench': 'gold',         // 판도라의 대기석
  'TFT9_Augment_PandorasItems2': 'gold',        // 판도라의 아이템 II
  'TFT9_Augment_YouHaveMyBow': 'gold',          // 활의 수호자
  'TFT9_Augment_HealingOrbsII': 'gold',         // 회복의 구 II
  'TFT6_Augment_PortableForge': 'gold',         // 휴대용 대장간
  'TFT_Augment_Dhampyr1': 'gold',               // 흡혈의 활력 I
  'TFT16_Augment_UltraRapidFire': 'gold',       // U.R.F

  // 실버 태그 → 실제는 프리즘 (주로 고가 경제/특수 증강)
  'TFT9_Augment_Legend_HighEndSector': 'prismatic',          // 흥청망청
  'TFT6_Augment_TheGoldenEgg': 'prismatic',                  // 황금 알
  'TFT11_Augment_Calltochaos': 'prismatic',                  // 혼돈의 부름
  'TFT6_Augment_ThriftShop': 'prismatic',                    // 현명한 소비
  'TFT9_Augment_HedgeFundPlus': 'prismatic',                 // 헤지 펀드+
  'TFT9_Augment_HedgeFund': 'prismatic',                     // 헤지 펀드
  'TFT7_Augment_LuckyGlovesPlus': 'prismatic',               // 행운의 장갑+
  'TFT7_Augment_LuckyGloves': 'prismatic',                   // 행운의 장갑
  'TFT6_Augment_GachaAddict': 'prismatic',                   // 프리즘 티켓
  'TFT9_Augment_PandorasRadiantBox': 'prismatic',            // 판도라의 아이템 III
  'TFT9_Augment_BuildingACollectionPlusPlus': 'prismatic',   // 파묻힌 보물
  'TFT11_Augment_Buildabud': 'prismatic',                    // 친구 만들기
  'TFT9_Augment_RollTheDice': 'prismatic',                   // 찬란한 장난꾸러기
  'TFT7_Augment_CursedCrown': 'prismatic',                   // 저주받은 왕관
  'TFT10_Augment_GoingLong': 'prismatic',                    // 장기 투자
  'TFT11_Augment_TinyButDeadly': 'prismatic',                // 작지만 치명적인
  'TFT11_Augment_AtWhatCost': 'prismatic',                   // 응당한 대가
  'TFT7_Augment_UrfsGrabBag2': 'prismatic',                  // 우르프의 꾸러미
  'TFT6_Augment_ForceOfNature': 'prismatic',                 // 신병
  'TFT7_Augment_BirthdayPresents': 'prismatic',              // 생일 선물
  'TFT9_Augment_GreaterJeweledLotus': 'prismatic',           // 보석 연꽃 II
  'TFT6_Augment_MaxLevel10': 'prismatic',                    // 레벨 업!
  'TFT6_Augment_BandOfThieves2Plus': 'prismatic',            // 도둑 무리 II+
  'TFT6_Augment_BandOfThieves2PlusPlus': 'prismatic',        // 도둑 무리 II++
  'TFT9_Augment_TiniestTitanPlus': 'prismatic',              // 꼬꼬마 거인
  'TFT6_Augment_TradeSector2': 'prismatic',                  // 거래 중심지
  'TFT7_Augment_LivingForge': 'prismatic',                   // 간이 대장간
};

export function getAugmentTier(aug: RawAugment): AugmentTier {
  const api = aug.apiName;
  // 1. 명시적 override
  if (APINAME_TIER_OVERRIDES[api]) return APINAME_TIER_OVERRIDES[api];
  // 2. 챔피언 Carry 증강은 태그에 silver가 붙어있어도 실제는 프리즘
  if (api.endsWith('Carry') || api.includes('_Carry')) return 'prismatic';
  // 3. 명시적 tier 태그 ({719abef1} → 'boon', 기타 실버/골드/프리즘)
  for (const tag of aug.tags) {
    if (tag in AUGMENT_TIER_TAGS) return AUGMENT_TIER_TAGS[tag];
  }
  return 'silver';
}

export function isStackable(aug: RawAugment): boolean {
  return 'MaxStacks' in aug.effects;
}

export function getMaxStacks(aug: RawAugment): number {
  return (aug.effects.MaxStacks as number) ?? 1;
}

export function getDefaultStacks(aug: RawAugment): number {
  return (aug.effects.StartingStacks as number) ?? 1;
}

// === Matching helpers ===

function isChampionSpecific(aug: RawAugment): boolean {
  return /Augment_\w+Carry/.test(aug.apiName);
}

/** Safely read a numeric effect value */
function ef(effects: Record<string, number>, key: string): number | null {
  const v = effects[key];
  return (v != null && typeof v === 'number') ? v : null;
}

// === Global stat resolution (applied to all units via ItemEffect) ===

export function resolveAugmentEffects(augments: AugmentWithStacks[]): ItemEffect {
  const result: ItemEffect = {};

  for (const { augment, stackCount } of augments) {
    if (isChampionSpecific(augment)) continue;
    const e = augment.effects;
    const stacks = stackCount;

    // Stats (%) → AD + AP percentage (stackable)
    const stats = ef(e, 'Stats');
    if (stats != null) {
      const pct = (stats / 100) * stacks;
      result.ad = (result.ad ?? 0) + pct;
      result.ap = (result.ap ?? 0) + pct;
    }

    // ADAP → both AD% and AP% (e.g., 5 = +5% each)
    const adap = ef(e, 'ADAP');
    if (adap != null) {
      const pct = adap > 1 ? adap / 100 : adap;
      result.ad = (result.ad ?? 0) + pct;
      result.ap = (result.ap ?? 0) + pct;
    }

    // HPBonus → flat HP × stacks
    const hpBonus = ef(e, 'HPBonus');
    if (hpBonus != null) result.hp = (result.hp ?? 0) + hpBonus * stacks;

    // === Direct flat/percentage AD ===
    const ad = ef(e, 'AD');
    if (ad != null) result.ad = (result.ad ?? 0) + ad;
    const bonusAD = ef(e, 'BonusAD');
    if (bonusAD != null) result.ad = (result.ad ?? 0) + bonusAD;
    const adBonus = ef(e, 'ADBonus');
    if (adBonus != null) result.ad = (result.ad ?? 0) + adBonus;
    const adPercent = ef(e, 'ADPercent');
    if (adPercent != null) result.ad = (result.ad ?? 0) + adPercent;
    const percentAD = ef(e, 'PercentAD');
    if (percentAD != null) result.ad = (result.ad ?? 0) + (percentAD > 1 ? percentAD / 100 : percentAD);
    const attackDamage = ef(e, 'AttackDamage');
    if (attackDamage != null) result.ad = (result.ad ?? 0) + (attackDamage > 1 ? attackDamage / 100 : attackDamage);

    // === AP ===
    const ap = ef(e, 'AP');
    if (ap != null) result.ap = (result.ap ?? 0) + ap;
    const bonusAP = ef(e, 'BonusAP');
    if (bonusAP != null) result.ap = (result.ap ?? 0) + bonusAP;
    const apBonus = ef(e, 'APBonus');
    if (apBonus != null) result.ap = (result.ap ?? 0) + apBonus;
    const abilityPower = ef(e, 'AbilityPower');
    if (abilityPower != null) result.ap = (result.ap ?? 0) + abilityPower;

    // === Attack Speed ===
    const as_ = ef(e, 'AS');
    if (as_ != null) result.as = (result.as ?? 0) + as_;
    const attackSpeed = ef(e, 'AttackSpeed');
    if (attackSpeed != null) result.as = (result.as ?? 0) + attackSpeed;
    const bonusAS = ef(e, 'BonusAS');
    if (bonusAS != null) result.as = (result.as ?? 0) + bonusAS;
    const asBonus = ef(e, 'ASBonus');
    if (asBonus != null) result.as = (result.as ?? 0) + asBonus;
    const asPercent = ef(e, 'ASPercent');
    if (asPercent != null) result.as = (result.as ?? 0) + asPercent;
    const teamAS = ef(e, 'TeamAttackSpeed');
    if (teamAS != null) result.as = (result.as ?? 0) + teamAS;

    // === HP ===
    const health = ef(e, 'Health');
    if (health != null) {
      // Glass Cannon: Health < 1 is a multiplier (0.8 = -20%), handled in per-unit
      if (health >= 1) result.hp = (result.hp ?? 0) + health;
    }
    const bonusHealth = ef(e, 'BonusHealth');
    if (bonusHealth != null) result.hp = (result.hp ?? 0) + bonusHealth;
    const maxHealth = ef(e, 'MaxHealth');
    if (maxHealth != null) result.hp = (result.hp ?? 0) + maxHealth;
    const flatHealth = ef(e, 'FlatHealth');
    if (flatHealth != null) result.hp = (result.hp ?? 0) + flatHealth;
    const flatHealthBonus = ef(e, 'FlatHealthBonus');
    if (flatHealthBonus != null) result.hp = (result.hp ?? 0) + flatHealthBonus;
    const healthAmount = ef(e, 'HealthAmount');
    if (healthAmount != null) result.hp = (result.hp ?? 0) + healthAmount;
    const bonusStats = ef(e, 'BonusStats');
    if (bonusStats != null) result.hp = (result.hp ?? 0) + bonusStats;

    // === Armor / MR ===
    const armor = ef(e, 'Armor');
    if (armor != null) result.armor = (result.armor ?? 0) + armor;
    const bonusAR = ef(e, 'BonusAR');
    if (bonusAR != null) result.armor = (result.armor ?? 0) + bonusAR;
    const mr = ef(e, 'MR');
    if (mr != null) result.magicResist = (result.magicResist ?? 0) + mr;
    const magicResist = ef(e, 'MagicResist');
    if (magicResist != null) result.magicResist = (result.magicResist ?? 0) + magicResist;
    const bonusMR = ef(e, 'BonusMR');
    if (bonusMR != null) result.magicResist = (result.magicResist ?? 0) + bonusMR;
    const baseResists = ef(e, 'BaseResists');
    if (baseResists != null) {
      result.armor = (result.armor ?? 0) + baseResists;
      result.magicResist = (result.magicResist ?? 0) + baseResists;
    }

    // === Crit ===
    const critChance = ef(e, 'CritChance');
    if (critChance != null) result.critChance = (result.critChance ?? 0) + critChance;
    const critDamage = ef(e, 'CritDamage');
    if (critDamage != null) result.critDamage = (result.critDamage ?? 0) + critDamage;
    const critDamageToGive = ef(e, 'CritDamageToGive');
    if (critDamageToGive != null) result.critDamage = (result.critDamage ?? 0) + critDamageToGive;

    // === Mana ===
    const mana = ef(e, 'Mana');
    if (mana != null) result.mana = (result.mana ?? 0) + mana;
    // ManaPercent: % mana cost reduction → reduces maxMana
    const manaPercent = ef(e, 'ManaPercent');
    if (manaPercent != null) result.mana = (result.mana ?? 0) - manaPercent;

    // === BonusStat: generic per-item stat ===
    const bonusStat = ef(e, 'BonusStat');
    if (bonusStat != null) {
      result.ad = (result.ad ?? 0) + bonusStat;
      result.ap = (result.ap ?? 0) + bonusStat;
    }

    // === Set 17 specific buff augments ===

    // 소라카의 은총: 잃은 체력당 아군 HP (stacks = 잃은 전략가 체력)
    if (augment.apiName === 'TFT17_Augment_SorakaGodAugment') {
      const heal = ef(e, 'Heal');
      if (heal != null) result.hp = (result.hp ?? 0) + heal * stacks;
    }

    // 아리의 은총: 레벨당 AD/AP +2% (stacks = 레벨)
    if (augment.apiName === 'TFT17_Augment_AhriGodAugment') {
      const xpPct = ef(e, '{048fe876}');
      if (xpPct != null) {
        const pct = (xpPct / 100) * stacks;
        result.ad = (result.ad ?? 0) + pct;
        result.ap = (result.ap ?? 0) + pct;
      }
    }

    // 은하계 여행: 여행자 HP/AD/AP + 새 상대마다 +10% (stacks = 새 상대 수)
    if (augment.apiName === 'TFT17_Augment_TourOfTheGalaxy') {
      const baseAD = ef(e, 'AD');
      const baseAP = ef(e, 'AP');
      const baseHP = ef(e, 'HP');
      const incPct = ef(e, '{aa49f69c}') ?? 0.1;
      const mult = 1 + incPct * stacks;
      if (baseAD != null) result.ad = (result.ad ?? 0) + baseAD * mult;
      if (baseAP != null) result.ap = (result.ap ?? 0) + baseAP * mult;
      if (baseHP != null) result.hp = (result.hp ?? 0) + baseHP * mult;
    }
  }

  return result;
}

// === Per-unit augment modifiers ===

export function resolvePerUnitMods(
  augments: AugmentWithStacks[],
  champion: RawChampion,
): PerUnitAugmentMod {
  const mod = { ...EMPTY_MOD };

  for (const { augment, stackCount } of augments) {
    const e = augment.effects;

    // Champion-specific: only apply if champion matches
    if (isChampionSpecific(augment)) {
      const carryMatch = augment.apiName.match(/Augment_(\w+)Carry/);
      if (carryMatch && !champion.apiName.includes(carryMatch[1])) continue;
    }

    // Range
    const maxRange = ef(e, 'MaxRange');
    if (maxRange != null) mod.rangeBonus += maxRange;
    const rangeIncrease = ef(e, 'RangeIncrease');
    if (rangeIncrease != null) mod.rangeBonus += rangeIncrease;

    // Damage amplification
    const damageAmp = ef(e, 'DamageAmp');
    if (damageAmp != null) mod.damageAmp += damageAmp > 1 ? damageAmp / 100 : damageAmp;
    const bonusDamage = ef(e, 'BonusDamage');
    if (bonusDamage != null) mod.damageAmp += bonusDamage > 1 ? bonusDamage / 100 : bonusDamage;
    const damageAmpBonus = ef(e, 'DamageAmpBonus');
    if (damageAmpBonus != null) mod.damageAmp += damageAmpBonus > 1 ? damageAmpBonus / 100 : damageAmpBonus;
    const baseDamageAmp = ef(e, 'BaseDamageAmp');
    if (baseDamageAmp != null) mod.damageAmp += baseDamageAmp > 1 ? baseDamageAmp / 100 : baseDamageAmp;
    const fullDamageAmp = ef(e, 'FullDamageAmp');
    if (fullDamageAmp != null) mod.damageAmp += fullDamageAmp > 1 ? fullDamageAmp / 100 : fullDamageAmp;

    // Omnivamp
    const omnivamp = ef(e, 'Omnivamp');
    if (omnivamp != null) mod.omnivamp += omnivamp > 1 ? omnivamp / 100 : omnivamp;
    const omnivampBonus = ef(e, 'OmnivampBonus');
    if (omnivampBonus != null) mod.omnivamp += omnivampBonus > 1 ? omnivampBonus / 100 : omnivampBonus;

    // Damage reduction
    const dmgReduction = ef(e, 'DamageReductionPercent');
    if (dmgReduction != null) mod.damageReduction += dmgReduction > 1 ? dmgReduction / 100 : dmgReduction;
    const reducedDamage = ef(e, 'ReducedDamage');
    if (reducedDamage != null) mod.damageReduction += reducedDamage > 1 ? reducedDamage / 100 : reducedDamage;

    // Burn
    const burnPercent = ef(e, 'BurnPercent');
    if (burnPercent != null) mod.burnPercent += burnPercent;

    // Resistances
    const resists = ef(e, 'Resists');
    if (resists != null) mod.resists += resists;
    const resistances = ef(e, 'Resistances');
    if (resistances != null) mod.resists += resistances;

    // Mana regen (per second)
    const manaRegen = ef(e, 'ManaRegen');
    if (manaRegen != null) mod.manaRegen += manaRegen;

    // Shields (combat start)
    const maxShield = ef(e, 'MaxShield');
    if (maxShield != null) mod.shieldFlat += maxShield;
    const maxHealthShield = ef(e, 'MaxHealthShield');
    if (maxHealthShield != null) mod.shieldMaxHpPercent += maxHealthShield > 1 ? maxHealthShield / 100 : maxHealthShield;
    const hpShieldPercent = ef(e, 'HPShieldPercent');
    if (hpShieldPercent != null) mod.shieldMaxHpPercent += hpShieldPercent > 1 ? hpShieldPercent / 100 : hpShieldPercent;

    // Armor/MR penetration
    const shredPercent = ef(e, 'ShredPercent');
    if (shredPercent != null) mod.magicPenBonus += shredPercent > 1 ? shredPercent / 100 : shredPercent;
    const sunderPercent = ef(e, 'SunderPercent');
    if (sunderPercent != null) mod.armorPenBonus += sunderPercent > 1 ? sunderPercent / 100 : sunderPercent;

    // Grievous wounds (applied to targets on hit)
    const grievous = ef(e, 'GrievousWoundsPercent');
    if (grievous != null) mod.grievousWounds += grievous > 1 ? grievous / 100 : grievous;

    // Execute threshold
    const execThreshold = ef(e, 'ExecuteThreshold');
    if (execThreshold != null) mod.executeThreshold = Math.max(mod.executeThreshold, execThreshold > 1 ? execThreshold / 100 : execThreshold);

    // HP multiplier (Glass Cannon: Health < 1)
    const health = ef(e, 'Health');
    if (health != null && health < 1 && health > 0) mod.hpMultiplier *= health;
    const reducedHealth = ef(e, 'ReducedHealth');
    if (reducedHealth != null && reducedHealth < 1 && reducedHealth > 0) mod.hpMultiplier *= reducedHealth;

    // HealthPercent → % max HP bonus (e.g., 60 = +60%)
    const healthPercent = ef(e, 'HealthPercent');
    if (healthPercent != null && healthPercent > 1) mod.hpMultiplier *= (1 + healthPercent / 100);

    // PercentHealth → fractional HP bonus
    const percentHealth = ef(e, 'PercentHealth');
    if (percentHealth != null && percentHealth < 1) mod.hpMultiplier *= (1 + percentHealth);

    // HealthIncrease → % HP bonus
    const healthIncrease = ef(e, 'HealthIncrease');
    if (healthIncrease != null) mod.hpMultiplier *= (1 + (healthIncrease > 1 ? healthIncrease / 100 : healthIncrease));

    // === Set 17 specific buff augments ===

    // 이블린의 은총: 내구력 (Durability → damageReduction)
    const durability = ef(e, 'Durability');
    if (durability != null && augment.apiName.includes('EvelynnGodAugment')) {
      mod.damageReduction += durability;
    }

    // 저격수의 은신처: 같은 칸 유지 라운드 수 × DamageAmp (stacks로 입력)
    if (augment.apiName === 'TFT17_Augment_SnipersNest') {
      const amp = ef(e, 'DamageAmp');
      const maxAmp = ef(e, 'MaxAmp');
      if (amp != null) {
        const totalAmp = amp * stackCount;
        const capped = maxAmp != null ? Math.min(totalAmp, maxAmp) : totalAmp;
        mod.damageAmp += capped / 100;
      }
    }
  }

  return mod;
}

/** Apply per-unit augment modifiers to an already-created CombatUnit */
export function applyPerUnitMods(unit: CombatUnit, mod: PerUnitAugmentMod): void {
  // Range
  if (mod.rangeBonus !== 0) {
    unit.stats.range = Math.max(1, unit.stats.range + mod.rangeBonus);
  }

  // HP multiplier (glass cannon, health percent, etc.)
  if (mod.hpMultiplier !== 1) {
    const newHp = Math.round(unit.maxHp * mod.hpMultiplier);
    unit.maxHp = newHp;
    unit.currentHp = newHp;
    unit.stats.hp = newHp;
  }

  // Damage amp
  unit.damageAmp += mod.damageAmp;

  // Omnivamp
  unit.omnivamp += mod.omnivamp;

  // Damage reduction
  unit.damageReduction += mod.damageReduction;

  // Resistances (flat bonus to both armor and MR)
  if (mod.resists !== 0) {
    unit.stats.armor += mod.resists;
    unit.stats.magicResist += mod.resists;
  }

  // Armor/MR pen
  if (mod.armorPenBonus !== 0) {
    unit.stats.armorPen = Math.min(1, unit.stats.armorPen + mod.armorPenBonus);
  }
  if (mod.magicPenBonus !== 0) {
    unit.stats.magicPen = Math.min(1, unit.stats.magicPen + mod.magicPenBonus);
  }

  // Combat-start shield
  const shieldAmount = mod.shieldFlat + Math.round(unit.maxHp * mod.shieldMaxHpPercent);
  if (shieldAmount > 0) {
    unit.shield += shieldAmount;
    unit.statusEffects.push({
      type: 'shield', sourceId: 'augment', remainingTicks: 9999, value: shieldAmount,
    });
  }

  // Per-tick combat fields
  unit.augmentManaRegen = mod.manaRegen;
  unit.augmentGrievousWounds = mod.grievousWounds;
  unit.augmentExecuteThreshold = mod.executeThreshold;
  unit.augmentBurnPercent = mod.burnPercent;
}

/** Get mana regen rate from augments for a unit */
export function getAugmentManaRegen(
  augments: AugmentWithStacks[],
  champion: RawChampion,
): number {
  let total = 0;
  for (const { augment } of augments) {
    if (isChampionSpecific(augment)) {
      const m = augment.apiName.match(/Augment_(\w+)Carry/);
      if (m && !champion.apiName.includes(m[1])) continue;
    }
    const v = ef(augment.effects, 'ManaRegen');
    if (v != null) total += v;
  }
  return total;
}

/** Get grievous wounds value from augments for a unit */
export function getAugmentGrievousWounds(
  augments: AugmentWithStacks[],
  champion: RawChampion,
): number {
  let total = 0;
  for (const { augment } of augments) {
    if (isChampionSpecific(augment)) {
      const m = augment.apiName.match(/Augment_(\w+)Carry/);
      if (m && !champion.apiName.includes(m[1])) continue;
    }
    const v = ef(augment.effects, 'GrievousWoundsPercent');
    if (v != null) total += v > 1 ? v / 100 : v;
  }
  return total;
}

/** Get execute threshold from augments for a unit */
export function getAugmentExecuteThreshold(
  augments: AugmentWithStacks[],
  champion: RawChampion,
): number {
  let max = 0;
  for (const { augment } of augments) {
    if (isChampionSpecific(augment)) {
      const m = augment.apiName.match(/Augment_(\w+)Carry/);
      if (m && !champion.apiName.includes(m[1])) continue;
    }
    const v = ef(augment.effects, 'ExecuteThreshold');
    if (v != null) {
      const pct = v > 1 ? v / 100 : v;
      if (pct > max) max = pct;
    }
  }
  return max;
}

// === In-combat augment effects (per-second scaling) ===

export function resolveInCombatAugmentEffects(augments: AugmentWithStacks[]): InCombatAugmentEffect[] {
  const effects: InCombatAugmentEffect[] = [];
  for (const { augment } of augments) {
    const e = augment.effects;
    const sps = ef(e, 'StatsPerSecond');
    const ms = ef(e, 'MaxStacks');
    if (sps != null && ms != null) {
      effects.push({
        statsPerSecond: sps,
        maxDuration: ms,
        bonusTrueDamage: ef(e, 'BonusTrueDamage') ?? 0,
      });
    }
  }
  return effects;
}
