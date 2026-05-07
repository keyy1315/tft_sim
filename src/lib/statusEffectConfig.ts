import type { StatusEffectType } from '@/types';

export type StatusCategory = 'debuff-cc' | 'debuff-dot' | 'buff';

export interface StatusEffectStyle {
  icon: string;
  color: string;
  bgColor: string;
  category: StatusCategory;
  label: string;
}

export const STATUS_EFFECT_CONFIG: Record<StatusEffectType, StatusEffectStyle> = {
  stun:         { icon: '⚡', color: '#fbbf24', bgColor: 'rgba(251,191,36,0.2)',  category: 'debuff-cc',  label: '기절' },
  slow:         { icon: '▼', color: '#60a5fa', bgColor: 'rgba(96,165,250,0.2)',  category: 'debuff-cc',  label: '둔화' },
  burn:         { icon: '●', color: '#f97316', bgColor: 'rgba(249,115,22,0.2)',  category: 'debuff-dot', label: '화상' },
  disarm:       { icon: '✕', color: '#f87171', bgColor: 'rgba(248,113,113,0.2)', category: 'debuff-cc',  label: '무장해제' },
  taunt:        { icon: '◎', color: '#fb923c', bgColor: 'rgba(251,146,60,0.2)',  category: 'debuff-cc',  label: '도발' },
  shield:       { icon: '◆', color: '#a3e635', bgColor: 'rgba(163,230,53,0.2)',  category: 'buff',       label: '보호막' },
  invulnerable: { icon: '☆', color: '#c084fc', bgColor: 'rgba(192,132,252,0.2)', category: 'buff',       label: '무적' },
  // Stargazer 별자리 변종 status effects (PR-5 옵션 B)
  mark:         { icon: '⌖', color: '#a855f7', bgColor: 'rgba(168,85,247,0.2)',  category: 'debuff-cc',  label: '표식' },
  poison:       { icon: '☠', color: '#10b981', bgColor: 'rgba(16,185,129,0.2)',  category: 'debuff-dot', label: '중독' },
  'resists-buff': { icon: '◈', color: '#14b8a6', bgColor: 'rgba(20,184,166,0.2)', category: 'buff',       label: '방어력+마법저항 버프' },
};

export const CATEGORY_BORDER: Record<StatusCategory, string> = {
  'debuff-cc':  '#ef4444',
  'debuff-dot': '#f97316',
  'buff':       '#22c55e',
};
