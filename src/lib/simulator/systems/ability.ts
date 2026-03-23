import { RawChampion, CombatUnit, AbilityPattern, hexDistance } from '@/types';
import { getHexesInRadius, getHexesInLine, getHexesInCone } from '@/lib/simulator/models/hex';

export type DamageType = 'magic' | 'physical' | 'true';

export interface ParsedAbility {
  damageType: DamageType;
  scalingType: 'ap' | 'ad' | 'none';
  damageValues: number[]; // [base, 1star, 2star, 3star]
  damageVarName: string | null;
}

export interface AbilityConfig {
  pattern: AbilityPattern;
  radius?: number;
  maxTargets?: number;
  damageDecay?: number;
  /** 스킬 시전 시 이동 유형 */
  dash?: 'to_target' | 'to_farthest' | 'to_lowest_hp' | 'to_backline';
}

/** 챔피언별 스킬 타게팅 패턴 매핑 */
export const CHAMPION_ABILITY_PATTERNS: Record<string, AbilityConfig> = {
  // === Single ===
  TFT16_Poppy:       { pattern: 'single' },
  TFT16_Draven:      { pattern: 'single' },
  TFT16_Vayne:       { pattern: 'single' },
  TFT16_Yone:        { pattern: 'single' },
  TFT16_Volibear:    { pattern: 'single' },
  TFT16_Vi:          { pattern: 'single' },
  TFT16_Darius:      { pattern: 'single' },
  TFT16_BelVeth:     { pattern: 'single' },
  TFT16_Kalista:     { pattern: 'single' },
  TFT16_Zoe:         { pattern: 'single' },
  TFT16_Leblanc:     { pattern: 'single' },

  // === Line (직선 관통) ===
  TFT16_Lux:         { pattern: 'line' },
  TFT16_Yunara:      { pattern: 'line', damageDecay: 0.15 },
  TFT16_Illaoi:      { pattern: 'line' },
  TFT16_Skarner:     { pattern: 'line', maxTargets: 3 },
  TFT16_Ambessa:     { pattern: 'line', dash: 'to_target' },
  TFT16_XinZhao:     { pattern: 'line', maxTargets: 3 },
  TFT16_Renekton:    { pattern: 'line', maxTargets: 3, dash: 'to_lowest_hp' },
  TFT16_Qiyana:      { pattern: 'line', maxTargets: 3, dash: 'to_target' },

  // === AOE Circle (원형 범위) ===
  TFT16_ChoGath:     { pattern: 'aoe_circle', radius: 2 },
  TFT16_Neeko:       { pattern: 'aoe_circle', radius: 2, dash: 'to_target' },
  TFT16_Ekko:        { pattern: 'aoe_circle', radius: 2 },
  TFT16_Kennen:      { pattern: 'aoe_circle', radius: 2 },
  TFT16_Fiddlesticks:{ pattern: 'aoe_circle', radius: 2, dash: 'to_farthest' },
  TFT16_Kindred:     { pattern: 'aoe_circle', radius: 2, dash: 'to_target' },
  TFT16_Diana:       { pattern: 'aoe_circle', radius: 1 },
  TFT16_Lucian:      { pattern: 'aoe_circle', radius: 1 },
  TFT16_Orianna:     { pattern: 'aoe_circle', radius: 2 },
  TFT16_Ornn:        { pattern: 'aoe_circle', radius: 2 },
  TFT16_Ziggs:       { pattern: 'aoe_circle', radius: 1 },
  TFT16_Anivia:      { pattern: 'aoe_circle', radius: 2 },
  TFT16_Swain:       { pattern: 'aoe_circle', radius: 2 },
  TFT16_Gangplank:   { pattern: 'aoe_circle', radius: 2 },
  // === AOE Circle + Dash ===
  TFT16_Briar:       { pattern: 'aoe_circle', radius: 1, dash: 'to_farthest' },
  TFT16_Nidalee:     { pattern: 'aoe_circle', radius: 1, dash: 'to_lowest_hp' },
  TFT16_Fizz:        { pattern: 'aoe_circle', radius: 1, dash: 'to_backline' },
  TFT16_Yasuo:       { pattern: 'aoe_circle', radius: 1, dash: 'to_target' },
  TFT16_Zaahen:      { pattern: 'aoe_circle', radius: 1, dash: 'to_target' },
  TFT16_Sylas:       { pattern: 'aoe_circle', radius: 2, dash: 'to_target' },
  TFT16_Shyvana:     { pattern: 'aoe_circle', radius: 3, dash: 'to_farthest' },

  // === Cone (원뿔) ===
  TFT16_Rumble:      { pattern: 'cone', radius: 2 },
  TFT16_Graves:      { pattern: 'cone', radius: 2 },
  TFT16_Gwen:        { pattern: 'cone', radius: 2, dash: 'to_target' },
  TFT16_Sejuani:     { pattern: 'cone', radius: 2 },
  TFT16_RekSai:      { pattern: 'cone', radius: 1, dash: 'to_farthest' },

  // === Multi-target (다수 지정) ===
  TFT16_Aphelios:    { pattern: 'multi', maxTargets: 4 },
  TFT16_Jinx:        { pattern: 'multi', maxTargets: 3 },
  TFT16_Kaisa:       { pattern: 'multi', maxTargets: 4 },
  TFT16_Xerath:      { pattern: 'multi', maxTargets: 3 },
  TFT16_MissFortune: { pattern: 'multi', maxTargets: 4 },
  TFT16_Malzahar:    { pattern: 'multi', maxTargets: 3 },
  TFT16_Tristana:    { pattern: 'multi', maxTargets: 2 },
  TFT16_KogMaw:      { pattern: 'multi', maxTargets: 3 },
  TFT16_Ashe:        { pattern: 'multi', maxTargets: 4 },
  TFT16_Jhin:        { pattern: 'multi', maxTargets: 4 },
  TFT16_TwistedFate: { pattern: 'multi', maxTargets: 3 },
  TFT16_Teemo:       { pattern: 'multi', maxTargets: 3 },
  TFT16_Ahri:        { pattern: 'multi', maxTargets: 3 },

  // === Bounce (튕김) ===
  TFT16_Lulu:        { pattern: 'bounce', maxTargets: 2 },
  TFT16_Caitlyn:     { pattern: 'bounce', maxTargets: 2, damageDecay: 0.5 },
  TFT16_Ryze:        { pattern: 'bounce', maxTargets: 3, damageDecay: 0.2 },

  // === Global (전체) ===
  TFT16_Annie:       { pattern: 'aoe_circle', radius: 2 },
  TFT16_Veigar:      { pattern: 'global' },
  TFT16_Brock:       { pattern: 'global' },

  // === Self/Buff (자기 버프) ===
  TFT16_Shen:        { pattern: 'self_buff' },
  TFT16_Warwick:     { pattern: 'self_buff' },
  TFT16_Tryndamere:  { pattern: 'self_buff' },
  TFT16_Taric:       { pattern: 'self_buff' },
  TFT16_Braum:       { pattern: 'self_buff' },
  TFT16_Seraphine:   { pattern: 'self_buff' },
  TFT16_Milio:       { pattern: 'self_buff' },
  TFT16_Sona:        { pattern: 'self_buff' },
};

/** 스킬 패턴에 따라 피해 대상 유닛 리스트 반환 */
export function findAbilityTargets(
  caster: CombatUnit,
  primaryTarget: CombatUnit,
  allEnemies: CombatUnit[],
  config: AbilityConfig,
): CombatUnit[] {
  const alive = allEnemies.filter(u => u.state !== 'dead');

  switch (config.pattern) {
    case 'single':
      return [primaryTarget];

    case 'line': {
      const lineHexes = getHexesInLine(caster.position, primaryTarget.position, 8);
      const lineSet = new Set(lineHexes.map(h => `${h.q},${h.r}`));
      const targets = alive.filter(u => lineSet.has(`${u.position.q},${u.position.r}`));
      // 거리순 정렬
      targets.sort((a, b) => hexDistance(caster.position, a.position) - hexDistance(caster.position, b.position));
      if (config.maxTargets) return targets.slice(0, config.maxTargets);
      return targets;
    }

    case 'aoe_circle': {
      const radius = config.radius ?? 1;
      const aoeHexes = getHexesInRadius(primaryTarget.position, radius);
      const aoeSet = new Set(aoeHexes.map(h => `${h.q},${h.r}`));
      return alive.filter(u => aoeSet.has(`${u.position.q},${u.position.r}`));
    }

    case 'cone': {
      const radius = config.radius ?? 2;
      const coneHexes = getHexesInCone(caster.position, primaryTarget.position, radius);
      const coneSet = new Set(coneHexes.map(h => `${h.q},${h.r}`));
      return alive.filter(u => coneSet.has(`${u.position.q},${u.position.r}`));
    }

    case 'multi': {
      const max = config.maxTargets ?? 3;
      const sorted = [...alive].sort((a, b) =>
        hexDistance(caster.position, a.position) - hexDistance(caster.position, b.position)
      );
      return sorted.slice(0, max);
    }

    case 'bounce': {
      const max = config.maxTargets ?? 2;
      const targets: CombatUnit[] = [primaryTarget];
      const hit = new Set([primaryTarget.id]);
      let lastPos = primaryTarget.position;
      while (targets.length < max) {
        const candidates = alive.filter(u => !hit.has(u.id));
        if (candidates.length === 0) break;
        candidates.sort((a, b) =>
          hexDistance(lastPos, a.position) - hexDistance(lastPos, b.position)
        );
        const next = candidates[0];
        targets.push(next);
        hit.add(next.id);
        lastPos = next.position;
      }
      return targets;
    }

    case 'global':
      return alive;

    case 'self_buff':
      return [caster];

    default:
      return [primaryTarget];
  }
}

export function parseAbility(champion: RawChampion): ParsedAbility {
  const desc = champion.ability.desc;
  const variables = champion.ability.variables;

  let damageType: DamageType = 'magic';
  if (desc.includes('<physicalDamage>')) damageType = 'physical';
  else if (desc.includes('<trueDamage>')) damageType = 'true';

  let scalingType: 'ap' | 'ad' | 'none' = 'none';
  if (desc.includes('scaleAP')) scalingType = 'ap';
  else if (desc.includes('scaleAD')) scalingType = 'ad';

  const damageVarNames = ['Damage', 'MagicDamage', 'PhysicalDamage', 'TotalDamage', 'BonusDamage', 'DamagePerTick'];
  let damageVar = variables.find(v => damageVarNames.includes(v.name));
  if (!damageVar && variables.length > 0) {
    damageVar = variables[0];
  }

  return {
    damageType,
    scalingType,
    damageValues: damageVar?.value || [0, 0, 0, 0],
    damageVarName: damageVar?.name || null,
  };
}

export function getAbilityDamage(
  champion: RawChampion,
  starLevel: number,
  ap: number,
  bonusAdPercent: number = 0
): { damage: number; type: DamageType } {
  const parsed = parseAbility(champion);
  const baseValue = parsed.damageValues[starLevel] ?? parsed.damageValues[1] ?? 0;

  let damage = baseValue;
  if (parsed.scalingType === 'ap') {
    damage = baseValue * (1 + ap / 100);
  } else if (parsed.scalingType === 'ad') {
    damage = baseValue * (1 + bonusAdPercent);
  }

  return { damage, type: parsed.damageType };
}

/** 어빌리티에 보호막이 있으면 보호막 수치 반환 */
export function getAbilityShield(
  champion: RawChampion,
  starLevel: number,
  ap: number,
): number {
  const variables = champion.ability.variables;
  const desc = champion.ability.desc;

  if (!desc.includes('보호막') && !desc.includes('Shield')) return 0;

  const shieldVarNames = ['Shield', 'APShield', 'ShieldAmount', 'LuxShield'];
  let shieldVar = variables.find(v => shieldVarNames.some(n => v.name.includes(n)));
  if (!shieldVar) {
    shieldVar = variables.find(v => v.name.toLowerCase().includes('shield'));
  }
  if (!shieldVar || !shieldVar.value) return 0;

  const baseValue = shieldVar.value[starLevel] ?? shieldVar.value[1] ?? 0;
  if (baseValue <= 0) return 0;

  const scalesWithAp = desc.includes('scaleAP');
  return scalesWithAp ? baseValue * (1 + ap / 100) : baseValue;
}
