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
  ADAP: '공격력/주문력',
  AttackSpeed: '공격 속도', AttackSpeedPercent: '공격 속도',
  AttackSpeedDuration: '공속 지속시간',
  BonusAD: '추가 공격력', BonusArmor: '추가 방어력', BonusMR: '추가 마법저항력',
  BonusDA: '추가 피해증폭', BonusHealth: '추가 체력',
  BonusTrueDamage: '추가 고정 피해',
  BurstDuration: '버스트 지속시간',
  CritChance: '치명타 확률', CritDamage: '치명타 피해량',
  DamageAmp: '피해 증폭', DamageInstances: '피해 횟수',
  DamageMultiplier: '피해 배율', DamageReduction: '피해 감소',
  DamageReductionPct: '피해 감소',
  Duration: '지속시간',
  EnhancedDurability: '강화 내구력',
  EnhancedTeamwideArmor: '강화 전체 방어력',
  FlatDamage: '고정 피해',
  Heal: '회복', HealthBonus: '추가 체력', HealthRatio: '체력 비율',
  HealthThreshold: '체력 임계치',
  Mana: '마나', ManaToSpend: '마나 사용량',
  MaxPercentHealthShield: '최대 체력 보호막',
  NumAttacks: '공격 횟수', NumSeconds: '초',
  Omnivamp: '모든 피해 흡혈',
  PerHexIncrease: '칸당 증가', PercentDamageIncrease: '피해 증가',
  PercentHealth: '체력 비율', PercentHealthHeal: '체력 비율 회복',
  PercentHealthShield: '체력 비율 보호막',
  ShieldDuration: '보호막 지속시간', ShieldHP: '보호막',
  ShieldPercentAmount: '보호막 비율', ShieldValue: '보호막',
  StatMultiplier: '능력치 배율',
  TeamSize: '팀 인원', TeamwideAS: '전체 공격 속도', TeamwideResists: '전체 저항력',
  rounds: '라운드',
};

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

  return (
    <div className="max-w-[280px]">
      <div className="font-bold text-yellow-400 mb-1">{at.trait.name}</div>
      {at.trait.desc && (
        <div className="text-xs text-gray-300 mb-2 leading-relaxed whitespace-pre-line">
          {resolveDescription(at.trait.desc, at.activeEffect?.variables ?? {})}
        </div>
      )}
      <div className="space-y-0.5">
        {at.trait.effects.map((eff) => {
          const isActive = at.activeEffect === eff;
          const vars = Object.entries(eff.variables)
            .filter(([, v]) => v != null)
            .filter(([key]) => !key.startsWith('{'));
          const fmtVal = (val: number | null) => {
            if (val == null) return '';
            return val > 0 && val < 1 ? `${(val * 100).toFixed(0)}%` : String(Math.round(val * 100) / 100);
          };
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
                      <span key={key} className="mr-2">{VARIABLE_KR[key] ?? key}: {fmtVal(val as number)}</span>
                    ))
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
