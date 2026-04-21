'use client';

import { useState } from 'react';
import { ActiveTrait, TRAIT_STYLE_COLORS, RawItem, RawChampion, COST_COLORS, ArbiterLaw } from '@/types';
import ArbiterLawPanel from './ArbiterLawPanel';
import { getTraitImage, getChampionImage } from '@/data/imageMap';
import { resolveDescription } from '@/lib/utils/text';
import Tooltip from '@/components/ui/Tooltip';
import Image from 'next/image';
import { IONIA_PATH_NAMES, IONIA_PATH_DESCRIPTIONS, getIoniaPathEffectText } from '@/data/traitModules';
import type { IoniaPathType } from '@/data/traitModules';

/** 시너지 variables 영어 키 → 한국어 매핑 */
const VARIABLE_KR: Record<string, string> = {
  AD: '공격력', AP: '주문력', AS: '공격 속도', HP: '체력',
  ADAP: '공격력/주문력', ADAP1: '공격력/주문력',
  AttackSpeed: '공격 속도', AttackSpeedPercent: '공격 속도',
  AttackSpeedDuration: '공속 지속시간',
  BonusAD: '추가 공격력', BonusArmor: '추가 방어력', BonusMR: '추가 마법저항력',
  BonusDA: '추가 피해증폭', BonusHealth: '추가 체력',
  BonusTrueDamage: '추가 고정 피해',
  BurstDuration: '버스트 지속시간', BurstPercent: '폭발 피해%',
  ChannelerManaRegen: '집중자 마나 재생',
  CritChance: '치명타 확률', CritDamage: '치명타 피해량',
  DamageAmp: '피해 증폭', DamageInstances: '피해 횟수',
  DamageMultiplier: '피해 배율', DamageReduction: '피해 감소',
  DamageReductionPct: '피해 감소', DamageTakenPercentModifier: '받는 피해%',
  Duration: '지속시간',
  Effectiveness: '효과 강도', EffectBonus: '효과 보너스',
  EnhancedDurability: '강화 내구력',
  EnhancedTeamwideArmor: '강화 전체 방어력',
  ExecuteHPPercent: '처형 체력%',
  FlatDamage: '고정 피해',
  Heal: '회복', HealthBonus: '추가 체력', HealthRatio: '체력 비율',
  HealthThreshold: '체력 임계치',
  InnateManaGain: '내재 마나 획득',
  Mana: '마나', ManaToSpend: '마나 사용량',
  MaxPercentHealthShield: '최대 체력 보호막',
  Meeps: '미프 수',
  NumAttacks: '공격 횟수', NumMarks: '표식 수', NumSeconds: '초',
  Omnivamp: '모든 피해 흡혈',
  PctResists: '저항%',
  PerHexIncrease: '칸당 증가', PercentDamageIncrease: '피해 증가',
  PercentHealth: '체력 비율', PercentHealthHeal: '체력 비율 회복',
  PercentHealthShield: '체력 비율 보호막',
  PercentMoreSwarmlings: '추가 군충%',
  PlayerOmnivamp: '플레이어 흡혈',
  RoundsPerMod: '모듈당 라운드',
  ShieldAD: '보호막 공격력',
  ShieldDuration: '보호막 지속시간', ShieldHP: '보호막',
  ShieldPercentAmount: '보호막 비율', ShieldValue: '보호막',
  ShredAndSunder: '저항 감소',
  StatMultiplier: '능력치 배율',
  StartOfCombatDuration: '전투 시작 지속시간',
  SupermassivePercentBonus: '거대화 보너스',
  TeamAttackDelay: '팀 공격 지연',
  TeamManaRegen: '팀 마나 재생',
  TeamSize: '팀 인원', TeamwideAS: '전체 공격 속도', TeamwideResists: '전체 저항력',
  TeamwideBonus: '전체 보너스',
  TechBreakpoint: '기술 임계점',
  TechPerCombat: '전투당 기술', TechPerCombat_DU: '전투당 기술 (보스전)',
  TechPerDeath_PVE: 'PvE 사망당 기술',
  TechPerKill: '처치당 기술',
  TechPerLoss: '패배당 기술', TechPerLoss_DU: '패배당 기술 (보스전)',
  TechPerRound_PVE: 'PvE 라운드당 기술',
  TimebreakerAdditionalAS: '추가 공격 속도',
  TransformedAbilityDA: '변신 스킬 피해 증폭',
  TransformedPercentHealth: '변신 체력%',
  UntransformedAbilityDA: '미변신 스킬 피해 증폭',
  Allies: '아군 수',
  ADAPPerSecond: '초당 공격력/주문력',
  BonusDefensiveStat1: '추가 방어 능력치 1',
  BonusDefensiveStat2: '추가 방어 능력치 2',
  BonusDefensiveStat3: '추가 방어 능력치 3',
  BonusOffensiveStat1: '추가 공격 능력치 1',
  BonusOffensiveStat2: '추가 공격 능력치 2',
  BonusOffensiveStat3: '추가 공격 능력치 3',
  NumberOfUpgradesBeforeRoundCostIncrease: '비용 증가 전 강화 수',
  DUHeal: '보스전 회복',
  PVEHP: 'PvE 체력',
  PVENumWins: 'PvE 승리 수',
  rounds: '라운드',
};

/**
 * trait 변수 키 → 한글 라벨 변환.
 *
 * 1) 정확 매칭 (VARIABLE_KR)
 * 2) prefix_접미 패턴 (예: 'Wolf_Health', 'Mountain_AS_Teamwide') → 접미 부분만 매핑
 *    trait 이름은 이미 툴팁 헤더에 표시되므로 prefix 는 생략해서 짧게.
 * 3) 매칭 실패 시 원본 key 반환
 */
const SUFFIX_KR: Array<[string, string]> = [
  ['_Health_Teamwide', '전체 체력'],
  ['_ManaRegen_Teamwide', '전체 마나 재생'],
  ['_AS_Teamwide', '전체 공격 속도'],
  ['_DR_Teamwide', '전체 피해 감소'],
  ['_NumDeaths', '사망 수'],
  ['_CashoutAS', '캐시아웃 공격속도'],
  ['_CashoutHP', '캐시아웃 체력'],
  ['_BaseSharePercent', '기본 공유%'],
  ['_EmpoweredSharePercent', '강화 공유%'],
  ['_StatIncrease', '능력치 증가'],
  ['_RoundsPerEmblem', '상징당 라운드'],
  ['_IncreasePer3Star', '3성당 증가'],
  ['_HealPercent', '회복%'],
  ['_ManaRegen', '마나 재생'],
  ['_Duration', '지속시간'],
  ['_Health', '체력'],
  ['_Resists', '저항력'],
  ['_ADAP', '공격력/주문력'],
  ['_AS', '공격 속도'],
  ['_DR', '피해 감소'],
  ['_DA', '피해 증폭'],
  ['_Gold', '골드'],
  ['_Poison', '독'],
  ['_Heal', '회복'],
  ['_Stats', '능력치'],
  ['_HexesToReveal_TOOLTIPONLY', '공개 칸 수'],
  ['_TOOLTIPONLY', ''],
];

function variableLabel(key: string): string {
  if (VARIABLE_KR[key]) return VARIABLE_KR[key];
  for (const [suf, kr] of SUFFIX_KR) {
    if (key.endsWith(suf)) return kr || key;
  }
  return key;
}

interface SynergyPanelProps {
  activeTraits: ActiveTrait[];
  team: 'player' | 'enemy';
  items: RawItem[];
  champions?: RawChampion[];
  piltoverModules?: RawItem[];
  bilgewaterStats?: Record<string, number>;
  ioniaPath?: IoniaPathType | null;
  onIoniaPathChange?: (path: IoniaPathType) => void;
  arbiterLaw?: ArbiterLaw | null;
  onArbiterLawChange?: (law: ArbiterLaw) => void;
}

function TraitTooltipContent({ at, champions = [] }: { at: ActiveTrait; champions?: RawChampion[] }) {
  const traitChampions = champions
    .filter(c => c.traits.includes(at.trait.name))
    .sort((a, b) => a.cost - b.cost);

  // trait.desc 안의 <row>...</row> 추출 — 길잡이처럼 vars/tierDesc 가 비어있어도
  // desc 의 row 별 설명을 tier 매핑 fallback 으로 사용.
  // resolveDescription 은 row 를 통째 제거하므로 별도 추출 필요.
  const rowFallbacks: string[] = (() => {
    const desc = at.trait.desc ?? '';
    const matches = desc.match(/<row>[\s\S]*?<\/row>/g) ?? [];
    return matches.map(m => m.replace(/<\/?row>/g, ''));
  })();

  return (
    <div className="max-w-[280px]">
      <div className="font-bold text-yellow-400 mb-1">{at.trait.name}</div>
      {at.trait.desc && (
        <div className="text-xs text-gray-300 mb-2 leading-relaxed whitespace-pre-line">
          {resolveDescription(at.trait.desc, at.activeEffect?.variables ?? {})}
        </div>
      )}
      <div className="space-y-0.5">
        {at.trait.effects.map((eff, idx) => {
          const isActive = at.activeEffect === eff;
          const vars = Object.entries(eff.variables)
            .filter(([, v]) => v != null)
            .filter(([key]) => !key.startsWith('{'));
          const fmtVal = (val: number | null) => {
            if (val == null) return '';
            return val > 0 && val < 1 ? `${(val * 100).toFixed(0)}%` : String(Math.round(val * 100) / 100);
          };
          // tier 별 row fallback — UI 좌측에 이미 (minUnits) 표시되므로
          // row 의 `(@MinUnits@)` prefix 는 중복 방지 위해 제거.
          const rowFallback = rowFallbacks[idx]
            ? resolveDescription(
                rowFallbacks[idx].replace(/\(@MinUnits@\)\s*/g, ''),
                eff.variables,
              ).trim()
            : '';
          return (
            <div
              key={eff.minUnits}
              className={`text-xs px-1.5 py-0.5 rounded ${isActive ? 'bg-yellow-900/40 text-yellow-300 font-bold' : 'text-gray-400'}`}
            >
              <span className="mr-1.5">({eff.minUnits})</span>
              {eff.tierDesc
                ? <span>{eff.tierDesc}</span>
                : vars.length > 0
                  ? vars.map(([key, val]) => (
                      <span key={key} className="mr-2">{variableLabel(key)}: {fmtVal(val as number)}</span>
                    ))
                  : rowFallback
                    ? <span>{rowFallback}</span>
                    : <span className="text-gray-500">{isActive ? '활성' : ''}</span>
              }
            </div>
          );
        })}
      </div>
      {traitChampions.length > 0 && (
        <>
          <div className="border-t border-gray-600 mt-2 pt-2">
            <div className="flex flex-wrap gap-1.5">
              {traitChampions.map(c => (
                <div key={c.apiName} className="flex items-center gap-1">
                  <Image
                    src={getChampionImage(c.apiName)}
                    alt={c.name}
                    width={20}
                    height={20}
                    className="rounded-full shrink-0"
                    style={{ border: `1.5px solid ${COST_COLORS[c.cost] ?? '#6b7280'}` }}
                    unoptimized
                  />
                  <span className="text-[10px] text-gray-300">{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BilgewaterStatsSummary({ stats, allItems }: { stats: Record<string, number>; allItems: RawItem[] }) {
  if (Object.keys(stats).length === 0) return null;

  const totals: Record<string, number> = {};
  for (const [apiName, count] of Object.entries(stats)) {
    const item = allItems.find(i => i.apiName === apiName);
    if (!item) continue;
    for (const [key, value] of Object.entries(item.effects)) {
      if (typeof value === 'number') {
        totals[key] = (totals[key] ?? 0) + value * count;
      }
    }
  }

  const parts: string[] = [];
  if (totals['BonusAD']) parts.push(`공격력 +${(totals['BonusAD'] * 100).toFixed(0)}%`);
  if (totals['BonusAP']) parts.push(`주문력 +${Math.round(totals['BonusAP'])}`);
  if (totals['BonusAS']) parts.push(`공속 +${(totals['BonusAS'] * 100).toFixed(0)}%`);
  if (totals['BonusHealthPercent']) parts.push(`체력 +${(totals['BonusHealthPercent'] * 100).toFixed(0)}%`);
  if (totals['BonusArmorMR']) parts.push(`방마저 +${Math.round(totals['BonusArmorMR'])}`);

  if (parts.length === 0) return null;

  return (
    <div className="text-[9px] text-teal-400 pl-7 mt-0.5">
      {parts.join(' | ')}
    </div>
  );
}

function PiltoverModulesSummary({ modules }: { modules: RawItem[] }) {
  if (modules.length === 0) return null;
  return (
    <div className="flex gap-1 pl-7 mt-0.5">
      {modules.map((m, i) => (
        <Image
          key={`${m.apiName}-${i}`}
          src={`/data/images/tft_set16_piltover/${m.icon?.split('/').pop()?.toLowerCase() ?? `${m.apiName.toLowerCase()}.tft_set16.png`}`}
          alt={m.name}
          width={16}
          height={16}
          className="rounded border border-gray-600"
          unoptimized
        />
      ))}
    </div>
  );
}

export default function SynergyPanel({ activeTraits, team, items, champions = [], piltoverModules = [], bilgewaterStats = {}, ioniaPath, onIoniaPathChange, arbiterLaw, onArbiterLawChange }: SynergyPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const teamLabel = team === 'player' ? 'TEAM A' : 'TEAM B';
  const teamColor = team === 'player' ? 'text-blue-400' : 'text-red-400';
  const demaciaActive = activeTraits.some(t => t.trait.apiName === 'TFT16_Demacia' && t.activeEffect);
  const ioniaActive = activeTraits.some(t => t.trait.apiName === 'TFT16_Ionia' && t.activeEffect);

  if (activeTraits.length === 0) {
    return (
      <div className="bg-[#111827] rounded-xl border border-gray-800 p-3">
        <div className="flex items-center justify-between">
          <div className={`text-xs font-bold ${teamColor}`}>{teamLabel} 시너지</div>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="lg:hidden text-gray-500 text-xs p-1"
          >
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
        <div className={`text-xs text-gray-500 mt-2 ${collapsed ? 'hidden lg:block' : 'block'}`}>
          챔피언을 배치하면 시너지가 표시됩니다.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#111827] rounded-xl border border-gray-800 p-3">
      <div className="flex items-center justify-between">
        <div className={`text-xs font-bold ${teamColor}`}>{teamLabel} 시너지</div>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="lg:hidden text-gray-500 text-xs p-1"
        >
          {collapsed ? '▼' : '▲'}
        </button>
      </div>
      <div className={`space-y-1 mt-2 ${collapsed ? 'hidden lg:block' : 'block'}`}>
        {activeTraits.map((at) => {
          const color = TRAIT_STYLE_COLORS[at.style] || TRAIT_STYLE_COLORS[0];
          const isActive = at.style > 0;
          const nextTier = at.trait.effects.find(e => e.minUnits > at.count);
          const label = nextTier ? `${at.count}/${nextTier.minUnits}` : `${at.count}`;
          const isPiltover = at.trait.apiName === 'TFT16_Piltover';
          const isBilgewater = at.trait.apiName === 'TFT16_Bilgewater';

          return (
            <div key={at.trait.apiName}>
              <Tooltip content={<TraitTooltipContent at={at} champions={champions} />}>
                <div
                  className={`flex items-center gap-2 px-2 py-1 rounded ${isActive ? '' : 'opacity-60'}`}
                  style={isActive ? { backgroundColor: `${color}20` } : { backgroundColor: '#111827' }}
                >
                  <Image
                    src={getTraitImage(at.trait.apiName)}
                    alt={at.trait.name}
                    width={16}
                    height={16}
                    className="shrink-0"
                    unoptimized
                  />
                  <span className={`text-xs flex-1 truncate ${isActive ? 'text-gray-200' : 'text-gray-500'}`}>
                    {at.trait.name}
                  </span>
                  <span className="text-[10px] shrink-0" style={{ color }}>
                    {label}
                  </span>
                </div>
              </Tooltip>
              {isActive && isPiltover && <PiltoverModulesSummary modules={piltoverModules} />}
              {isActive && isBilgewater && <BilgewaterStatsSummary stats={bilgewaterStats} allItems={items} />}
              {isActive && at.trait.apiName === 'TFT16_Demacia' && demaciaActive && (
                <div className="text-[9px] text-yellow-400 mt-0.5">
                  갈리오 배치 시 전투 중 데마시아 결집으로 소환
                </div>
              )}
              {isActive && at.trait.apiName === 'TFT16_Ionia' && ioniaActive && onIoniaPathChange && (
                <div className="mt-1 space-y-0.5">
                  <select
                    value={ioniaPath ?? ''}
                    onChange={e => onIoniaPathChange(e.target.value as IoniaPathType)}
                    className="w-full bg-gray-800 text-white text-[10px] rounded px-1 py-0.5 border border-gray-600"
                  >
                    <option value="">길 선택...</option>
                    {Object.entries(IONIA_PATH_NAMES).map(([key, name]) => (
                      <option key={key} value={key}>{name} — {IONIA_PATH_DESCRIPTIONS[key as IoniaPathType]}</option>
                    ))}
                  </select>
                  {ioniaPath && at.activeEffect && (
                    <div className="text-[9px] text-yellow-400 bg-gray-900 rounded px-1.5 py-0.5 border border-gray-700">
                      ⚔ {IONIA_PATH_NAMES[ioniaPath]}: {getIoniaPathEffectText(ioniaPath, at.activeEffect.variables)}
                    </div>
                  )}
                </div>
              )}
              {isActive && at.trait.apiName === 'TFT17_ADMIN' && onArbiterLawChange && (
                <ArbiterLawPanel
                  law={arbiterLaw ?? null}
                  onChange={onArbiterLawChange}
                  tier={at.style >= 3 ? 'gold' : 'silver'}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
