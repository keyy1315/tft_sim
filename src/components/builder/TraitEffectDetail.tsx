'use client';

import { ActiveTrait } from '@/types';

interface TraitEffectDetailProps {
  activeTrait: ActiveTrait;
}

const TRAIT_DISPLAY: Record<string, (vars: Record<string, number | null>) => string> = {
  TFT16_Freljord: (vars) => {
    const turrets = vars['{7dced3cd}'] ?? vars['NumTurrets'] ?? 1;
    const hp = vars['HealthPercent'] ?? 0;
    const dmg = vars['DA'] ?? 0;
    return `포탑 ${turrets}개 / 체력 ${hp}% / 피해 ${dmg}%`;
  },
  TFT16_Piltover: (vars) => {
    const fireTime = vars['InventionFireTime'] ?? 0;
    return `발명품 ${fireTime}초 후 활성화`;
  },
  TFT16_Bilgewater: (vars) => {
    const serpents = vars['SerpentsPerRound'] ?? 0;
    return `은화 ${serpents}/라운드`;
  },
  TFT16_Juggernaut: (vars) => {
    const baseDR = vars['BaseDR'] ?? 0;
    const hpBreak = vars['HealthBreakpoint'] ?? 0;
    const incDR = vars['IncreasedDR'] ?? 0;
    return `피해감소 ${(baseDR * 100).toFixed(0)}%, 체력 ${(hpBreak * 100).toFixed(0)}% 이하 ${(incDR * 100).toFixed(0)}%`;
  },
  TFT16_Rapidfire: (vars) => {
    const minAS = vars['MinBonusAS'] ?? 0;
    const maxAS = vars['MaxBonusAS'] ?? 0;
    const teamAS = vars['TeamwideAS'] ?? 0;
    return `공속 ${(minAS * 100).toFixed(0)}~${(maxAS * 100).toFixed(0)}%, 팀 ${(teamAS * 100).toFixed(0)}%`;
  },
  TFT16_Sorcerer: (vars) => {
    const bonusAP = vars['BonusAP'] ?? 0;
    const allyAP = vars['AllyAP'] ?? 0;
    return `주문력 +${bonusAP} (본인) / +${allyAP} (팀)`;
  },
  TFT16_Brawler: (vars) => {
    const teamHP = vars['TeamFlatHealth'] ?? 0;
    const bonusHP = vars['BonusPercentHealth'] ?? 0;
    return `팀 체력 +${teamHP}, 자체 +${(bonusHP * 100).toFixed(0)}%`;
  },
  TFT16_Warden: (vars) => {
    const shield = vars['PercentHealthShield'] ?? 0;
    return `보호막 ${(shield * 100).toFixed(0)}% 최대체력`;
  },
  TFT16_Defender: (vars) => {
    const bonus = vars['BonusArmorMR'] ?? 0;
    const teamwide = vars['TeamwideArmorMR'] ?? 0;
    return `방어/마저 +${bonus} (자체) / +${teamwide} (팀)`;
  },
  TFT16_Slayer: (vars) => {
    const ad = vars['BonusAD'] ?? 0;
    const vamp = vars['BonusOmnivamp'] ?? 0;
    return `공격력 +${(ad * 100).toFixed(0)}%, 흡혈 +${(vamp * 100).toFixed(0)}%`;
  },
  TFT16_Vanquisher: (vars) => {
    const crit = vars['BaseCritChance'] ?? 0;
    const critDmg = vars['CritDmg'] ?? 0;
    return `치명타 +${(crit * 100).toFixed(0)}%, 치명타 피해 +${(critDmg * 100).toFixed(0)}%`;
  },
};

export default function TraitEffectDetail({ activeTrait }: TraitEffectDetailProps) {
  if (!activeTrait.activeEffect) return null;

  const vars = activeTrait.activeEffect.variables;
  const apiName = activeTrait.trait.apiName;
  const displayFn = TRAIT_DISPLAY[apiName];

  if (displayFn) {
    const label = displayFn(vars);
    return (
      <div className="text-[10px] text-gray-400 pl-8">
        <div>{label}</div>
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
