/**
 * Champion Ability Audit Script
 *
 * 챔피언 JSON description과 ability.ts CHAMPION_ABILITY_PATTERNS를 비교하여
 * 불일치를 검출하는 감사 스크립트.
 *
 * Usage: npx tsx scripts/audit-abilities.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// --- Types ---

type Severity = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFO';

interface AuditResult {
  champion: string;
  name: string;
  cost: number;
  severity: Severity;
  rule: string;
  message: string;
  descExcerpt: string;
  suggestedFix?: string;
}

interface RawChampion {
  name: string;
  apiName: string;
  cost: number;
  traits: string[];
  ability: {
    name: string;
    desc: string;
    variables: { name: string; value: number[] }[];
  };
}

interface AbilityConfig {
  pattern: string;
  radius?: number;
  maxTargets?: number;
  damageDecay?: number;
  dash?: string;
  stun?: number;
  stunTargets?: number;
  heal?: boolean;
  selfBuff?: Record<string, number>;
  allyBuff?: Record<string, number>;
  debuff?: Record<string, number>;
}

// --- Constants ---

const SPECIAL_UNITS = new Set([
  'TFT16_AnnieTibbers',
  'TFT16_AzirSoldier',
  'TFT16_MalzaharVoidling',
  'TFT16_FreljordProp',
  'TFT16_PiltoverInvention',
  'TFT16_RiftHerald',
  'TFT16_BaronNashor',
  'TFT16_THex',
]);

// --- Data Loading ---

function loadChampions(): RawChampion[] {
  const raw = readFileSync(join(process.cwd(), 'public/data/tft_set16_champions.json'), 'utf-8');
  const all: RawChampion[] = JSON.parse(raw);
  return all.filter(c => c.apiName.startsWith('TFT16_'));
}

function parseAbilityPatterns(): Record<string, AbilityConfig> {
  const src = readFileSync(join(process.cwd(), 'src/lib/simulator/systems/ability.ts'), 'utf-8');

  const patterns: Record<string, AbilityConfig> = {};

  // Match each entry: TFT16_Name: { ... } (handles nested braces)
  const entryRegex = /(TFT16_\w+)\s*:\s*\{/g;
  let match;
  while ((match = entryRegex.exec(src)) !== null) {
    const name = match[1];
    // Find matching closing brace (handle nested braces)
    let depth = 1;
    let i = match.index + match[0].length;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth++;
      if (src[i] === '}') depth--;
      i++;
    }
    const body = src.slice(match.index + match[0].length, i - 1);

    const config: AbilityConfig = { pattern: 'unknown' };

    // Extract pattern
    const patternMatch = body.match(/pattern:\s*'(\w+)'/);
    if (patternMatch) config.pattern = patternMatch[1];

    // Extract numeric fields
    const numFields = ['radius', 'maxTargets', 'damageDecay', 'stun', 'stunTargets'];
    for (const field of numFields) {
      const m = body.match(new RegExp(`${field}:\\s*([\\d.]+)`));
      if (m) (config as unknown as Record<string, unknown>)[field] = parseFloat(m[1]);
    }

    // Extract dash
    const dashMatch = body.match(/dash:\s*'(\w+)'/);
    if (dashMatch) config.dash = dashMatch[1];

    // Extract heal
    if (body.includes('heal: true') || body.includes('heal:true') || body.includes('heal:  true')) config.heal = true;

    // Extract selfBuff presence
    if (body.includes('selfBuff')) config.selfBuff = {};

    // Extract allyBuff presence
    if (body.includes('allyBuff')) config.allyBuff = {};

    // Extract debuff presence
    if (body.includes('debuff')) config.debuff = {};

    patterns[name] = config;
  }

  return patterns;
}

// --- Audit Rules ---

function extractExcerpt(desc: string, keyword: string, contextLen = 30): string {
  const idx = desc.indexOf(keyword);
  if (idx === -1) return '';
  const start = Math.max(0, idx - contextLen);
  const end = Math.min(desc.length, idx + keyword.length + contextLen);
  const excerpt = desc.slice(start, end).replace(/\n/g, ' ').replace(/<[^>]+>/g, '');
  return `...${excerpt}...`;
}

function auditChampion(
  champ: RawChampion,
  config: AbilityConfig | undefined,
): AuditResult[] {
  const results: AuditResult[] = [];
  const desc = champ.ability.desc;
  const base = { champion: champ.apiName, name: champ.name, cost: champ.cost };

  // Rule 1: NOT_REGISTERED
  if (!config) {
    results.push({
      ...base,
      severity: 'MAJOR',
      rule: 'NOT_REGISTERED',
      message: 'ability.ts에 미등록',
      descExcerpt: desc.slice(0, 80).replace(/<[^>]+>/g, '') + '...',
    });
    return results; // 미등록이면 다른 규칙 체크 불가
  }

  // Rule 2: STUN_MISSING
  if ((desc.includes('기절') || desc.includes('StunDuration')) && config.stun === undefined) {
    results.push({
      ...base,
      severity: 'MAJOR',
      rule: 'STUN_MISSING',
      message: 'desc에 기절 효과 있으나 stun 미설정',
      descExcerpt: extractExcerpt(desc, desc.includes('기절') ? '기절' : 'StunDuration'),
      suggestedFix: '{ stun: N }',
    });
  }

  // Rule 3: HEAL_MISSING
  const hasHealKeyword = desc.includes('회복') || desc.includes('치유');
  const hasOnlyLifesteal = desc.includes('흡혈') && !hasHealKeyword;
  if (hasHealKeyword && !hasOnlyLifesteal && !config.heal) {
    results.push({
      ...base,
      severity: 'MAJOR',
      rule: 'HEAL_MISSING',
      message: 'desc에 회복/치유 있으나 heal: true 없음',
      descExcerpt: extractExcerpt(desc, desc.includes('회복') ? '회복' : '치유'),
      suggestedFix: '{ heal: true }',
    });
  }

  // Rule 4: DASH_MISSING
  const dashKeywords = ['도약', '돌진', '날아'];
  const foundDash = dashKeywords.find(k => desc.includes(k));
  if (foundDash && !config.dash) {
    results.push({
      ...base,
      severity: 'MAJOR',
      rule: 'DASH_MISSING',
      message: `desc에 '${foundDash}' 있으나 dash 미설정`,
      descExcerpt: extractExcerpt(desc, foundDash),
      suggestedFix: "{ dash: 'to_target' }",
    });
  }

  // Rule 5: SHIELD_MISSING
  if ((desc.includes('보호막') || desc.includes('Shield')) && config.pattern !== 'self_buff') {
    const vars = champ.ability.variables;
    const hasShieldVar = vars.some(v => v.name.toLowerCase().includes('shield'));
    if (!hasShieldVar) {
      results.push({
        ...base,
        severity: 'MINOR',
        rule: 'SHIELD_MISSING',
        message: 'desc에 보호막 있으나 Shield 변수 없음',
        descExcerpt: extractExcerpt(desc, desc.includes('보호막') ? '보호막' : 'Shield'),
      });
    }
  }

  // Rule 6: PATTERN_MISMATCH hints
  const hasAoeHint = desc.includes('주변') && (desc.includes('적에게') || desc.includes('범위'));
  if (hasAoeHint && config.pattern === 'single') {
    results.push({
      ...base,
      severity: 'CRITICAL',
      rule: 'PATTERN_MISMATCH',
      message: `desc에 '주변 적' AOE 힌트 있으나 pattern=single`,
      descExcerpt: extractExcerpt(desc, '주변'),
      suggestedFix: "{ pattern: 'aoe_circle' }",
    });
  }

  // Check for multi-target hints
  const multiMatch = desc.match(/적\s*(\d+)\s*명/);
  if (multiMatch && config.pattern !== 'multi') {
    const expectedTargets = parseInt(multiMatch[1]);
    if (expectedTargets >= 2 && config.maxTargets !== expectedTargets) {
      results.push({
        ...base,
        severity: 'MAJOR',
        rule: 'TARGET_COUNT_MISMATCH',
        message: `desc에 '적 ${expectedTargets}명' 있으나 maxTargets=${config.maxTargets ?? 'N/A'} (pattern=${config.pattern})`,
        descExcerpt: extractExcerpt(desc, multiMatch[0]),
      });
    }
  }

  // Rule 7: BUFF_MISSING
  if (desc.includes('공격 속도') && (desc.includes('증가') || desc.includes('얻')) &&
      !config.selfBuff && !config.allyBuff && config.pattern !== 'self_buff') {
    results.push({
      ...base,
      severity: 'MINOR',
      rule: 'BUFF_MISSING',
      message: 'desc에 공격 속도 버프 있으나 selfBuff/allyBuff 없음',
      descExcerpt: extractExcerpt(desc, '공격 속도'),
    });
  }

  // Rule 8: PASSIVE_NOT_IMPL
  if (desc.includes('<spellPassive>')) {
    results.push({
      ...base,
      severity: 'INFO',
      rule: 'PASSIVE_NOT_IMPL',
      message: 'spellPassive 효과 존재 (별도 구현 필요)',
      descExcerpt: extractExcerpt(desc, 'spellPassive'),
    });
  }

  return results;
}

// --- Main ---

function main() {
  const champions = loadChampions();
  const patterns = parseAbilityPatterns();

  const allResults: AuditResult[] = [];

  for (const champ of champions) {
    if (SPECIAL_UNITS.has(champ.apiName)) continue;
    const config = patterns[champ.apiName];
    const issues = auditChampion(champ, config);
    allResults.push(...issues);
  }

  // Sort by severity
  const severityOrder: Record<Severity, number> = { CRITICAL: 0, MAJOR: 1, MINOR: 2, INFO: 3 };
  allResults.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.champion.localeCompare(b.champion));

  // Print report
  const checked = champions.filter(c => !SPECIAL_UNITS.has(c.apiName)).length;
  console.log('══════════════════════════════════════════════════');
  console.log('  Champion Ability Audit Report');
  console.log(`  Total: ${champions.length} | Checked: ${checked} | Special: ${SPECIAL_UNITS.size}`);
  console.log('══════════════════════════════════════════════════\n');

  const grouped: Record<Severity, AuditResult[]> = { CRITICAL: [], MAJOR: [], MINOR: [], INFO: [] };
  for (const r of allResults) {
    grouped[r.severity].push(r);
  }

  for (const sev of ['CRITICAL', 'MAJOR', 'MINOR', 'INFO'] as Severity[]) {
    const items = grouped[sev];
    console.log(`[${sev}] (${items.length} issues)`);
    for (const r of items) {
      console.log(`  ${r.champion} (${r.name}, ${r.cost}코): ${r.rule}`);
      console.log(`    ${r.message}`);
      if (r.descExcerpt) console.log(`    desc: ${r.descExcerpt}`);
      if (r.suggestedFix) console.log(`    fix: ${r.suggestedFix}`);
    }
    console.log('');
  }

  console.log('══════════════════════════════════════════════════');
  console.log(`  Summary: ${grouped.CRITICAL.length} CRITICAL / ${grouped.MAJOR.length} MAJOR / ${grouped.MINOR.length} MINOR / ${grouped.INFO.length} INFO`);
  console.log('══════════════════════════════════════════════════');
}

main();
