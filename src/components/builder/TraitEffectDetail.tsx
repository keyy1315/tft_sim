'use client';

import { ActiveTrait, RawItem } from '@/types';
import ItemIcon from './ItemIcon';

interface TraitEffectDetailProps {
  activeTrait: ActiveTrait;
  items: RawItem[];
}

const TRAIT_DISPLAY: Record<string, (vars: Record<string, number | null>, items: RawItem[]) => { label: string; specialItems?: RawItem[] }> = {
  TFT16_Freljord: (vars) => {
    const turrets = vars['{7dced3cd}'] ?? vars['NumTurrets'] ?? 1;
    const hp = vars['HealthPercent'] ?? 0;
    const dmg = vars['DA'] ?? 0;
    return { label: `포탑 ${turrets}개 / 체력 ${hp}% / 피해 ${dmg}%` };
  },
  TFT16_Piltover: (vars, items) => {
    const fireTime = vars['InventionFireTime'] ?? 0;
    const specialItems = items.filter(i => i.apiName.includes('TFT16_Item_Piltover_'));
    return { label: `발명품 ${fireTime}초 후 활성화`, specialItems };
  },
  TFT16_Bilgewater: (vars, items) => {
    const serpents = vars['SerpentsPerRound'] ?? 0;
    const specialItems = items.filter(i => i.apiName.includes('TFT16_Item_Bilgewater_'));
    return { label: `은화 ${serpents}/라운드`, specialItems };
  },
  TFT16_Juggernaut: (vars) => {
    const baseDR = vars['BaseDR'] ?? 0;
    const hpBreak = vars['HealthBreakpoint'] ?? 0;
    const incDR = vars['IncreasedDR'] ?? 0;
    return { label: `피해감소 ${(baseDR * 100).toFixed(0)}%, 체력 ${(hpBreak * 100).toFixed(0)}% 이하 ${(incDR * 100).toFixed(0)}%` };
  },
  TFT16_Rapidfire: (vars) => {
    const minAS = vars['MinBonusAS'] ?? 0;
    const maxAS = vars['MaxBonusAS'] ?? 0;
    const teamAS = vars['TeamwideAS'] ?? 0;
    return { label: `공속 ${(minAS * 100).toFixed(0)}~${(maxAS * 100).toFixed(0)}%, 팀 ${(teamAS * 100).toFixed(0)}%` };
  },
  TFT16_Sorcerer: (vars) => {
    const bonusAP = vars['BonusAP'] ?? 0;
    const allyAP = vars['AllyAP'] ?? 0;
    return { label: `주문력 +${bonusAP} (본인) / +${allyAP} (팀)` };
  },
  TFT16_Brawler: (vars) => {
    const teamHP = vars['TeamFlatHealth'] ?? 0;
    const bonusHP = vars['BonusPercentHealth'] ?? 0;
    return { label: `팀 체력 +${teamHP}, 자체 +${(bonusHP * 100).toFixed(0)}%` };
  },
  TFT16_Warden: (vars) => {
    const shield = vars['PercentHealthShield'] ?? 0;
    return { label: `보호막 ${(shield * 100).toFixed(0)}% 최대체력` };
  },
  TFT16_Defender: (vars) => {
    const bonus = vars['BonusArmorMR'] ?? 0;
    const teamwide = vars['TeamwideArmorMR'] ?? 0;
    return { label: `방어/마저 +${bonus} (자체) / +${teamwide} (팀)` };
  },
  TFT16_Slayer: (vars) => {
    const ad = vars['BonusAD'] ?? 0;
    const vamp = vars['BonusOmnivamp'] ?? 0;
    return { label: `공격력 +${(ad * 100).toFixed(0)}%, 흡혈 +${(vamp * 100).toFixed(0)}%` };
  },
  TFT16_Vanquisher: (vars) => {
    const crit = vars['BaseCritChance'] ?? 0;
    const critDmg = vars['CritDmg'] ?? 0;
    return { label: `치명타 +${(crit * 100).toFixed(0)}%, 치명타 피해 +${(critDmg * 100).toFixed(0)}%` };
  },
};

export default function TraitEffectDetail({ activeTrait, items }: TraitEffectDetailProps) {
  if (!activeTrait.activeEffect) return null;

  const vars = activeTrait.activeEffect.variables;
  const apiName = activeTrait.trait.apiName;
  const displayFn = TRAIT_DISPLAY[apiName];

  if (displayFn) {
    const { label, specialItems } = displayFn(vars, items);
    return (
      <div className="text-[10px] text-gray-400 pl-8 space-y-1">
        <div>{label}</div>
        {specialItems && specialItems.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {specialItems.map(item => (
              <ItemIcon key={item.apiName} item={item} size={20} showTooltip />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Fallback: display raw variables
  const entries = Object.entries(vars).filter(([, v]) => v != null);
  if (entries.length === 0) return null;

  return (
    <div className="text-[10px] text-gray-500 pl-8">
      {entries.map(([key, val]) => (
        <span key={key} className="mr-2">{key}: {typeof val === 'number' && val < 1 && val > 0 ? `${(val * 100).toFixed(0)}%` : val}</span>
      ))}
    </div>
  );
}
