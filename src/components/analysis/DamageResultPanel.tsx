'use client';

import { DamageResult } from '@/types';

interface DamageResultPanelProps {
  result: DamageResult;
  championName: string;
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm font-mono font-bold" style={{ color: color || '#f3f4f6' }}>{value}</span>
    </div>
  );
}

function BarChart({ label, value, maxValue, color }: { label: string; value: number; maxValue: number; color: string }) {
  const pct = maxValue > 0 ? Math.min(100, (value / maxValue) * 100) : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-300">{Math.round(value)}</span>
      </div>
      <div className="h-2 bg-[#1a1f2e] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function DamageResultPanel({ result, championName }: DamageResultPanelProps) {
  const maxDps = Math.max(result.autoAttackDps, result.totalDps10s, result.effectiveTotalDps10s);
  const dmgTypeColor = result.abilityDamageType === 'magic' ? '#3b82f6' : result.abilityDamageType === 'physical' ? '#ef4444' : '#f3f4f6';

  return (
    <div className="space-y-4">
      {/* Main DPS number */}
      <div className="text-center p-4 bg-[#1a1f2e] rounded-xl">
        <div className="text-xs text-gray-500 uppercase tracking-wide">10초 예측 DPS</div>
        <div className="text-4xl font-black text-yellow-400 mt-1">
          {Math.round(result.effectiveTotalDps10s)}
        </div>
        <div className="text-xs text-gray-500 mt-1">{championName} (방어력 적용 후)</div>
      </div>

      {/* Damage breakdown bars */}
      <div className="space-y-2 p-3 bg-[#111827] rounded-lg">
        <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">데미지 분석</h3>
        <BarChart label="기본공격 DPS (원본)" value={result.autoAttackDps} maxValue={maxDps} color="#ef4444" />
        <BarChart label="기본공격 DPS (방어 후)" value={result.effectiveAutoAttackDps} maxValue={maxDps} color="#dc2626" />
        <BarChart label="스킬 1회 피해" value={result.abilityDamage} maxValue={result.abilityDamage} color={dmgTypeColor} />
        <BarChart label="스킬 1회 (방어 후)" value={result.effectiveAbilityDamage} maxValue={result.abilityDamage} color={dmgTypeColor} />
        <BarChart label="10초 종합 DPS" value={result.totalDps10s} maxValue={maxDps} color="#f59e0b" />
        <BarChart label="10초 종합 (방어 후)" value={result.effectiveTotalDps10s} maxValue={maxDps} color="#d97706" />
      </div>

      {/* Stats breakdown table */}
      <div className="p-3 bg-[#111827] rounded-lg">
        <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">스탯 분해</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <StatRow label="공격력" value={result.statBreakdown.ad.total.toFixed(1)} color="#ef4444" />
          <StatRow label="주문력" value={result.statBreakdown.ap.total.toFixed(1)} color="#3b82f6" />
          <StatRow label="공격속도" value={result.statBreakdown.as.total.toFixed(2)} color="#22c55e" />
          <StatRow label="체력" value={result.statBreakdown.hp.total.toFixed(0)} color="#10b981" />
          <StatRow label="크리확률" value={`${(result.statBreakdown.critChance.total * 100).toFixed(0)}%`} color="#f97316" />
          <StatRow label="크리배율" value={`${(result.statBreakdown.critMultiplier.total * 100).toFixed(0)}%`} color="#f97316" />
          <StatRow label="방어력" value={result.statBreakdown.armor.total.toFixed(0)} color="#fbbf24" />
          <StatRow label="마법저항력" value={result.statBreakdown.mr.total.toFixed(0)} color="#a78bfa" />
        </div>
      </div>

      {/* Detailed breakdown */}
      <div className="p-3 bg-[#111827] rounded-lg">
        <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">공격력 상세</h3>
        <StatRow label="기본" value={result.statBreakdown.ad.base.toFixed(1)} />
        <StatRow label="성급 스케일링" value={`+${result.statBreakdown.ad.starScaling.toFixed(1)}`} color="#f59e0b" />
        <StatRow label="아이템" value={`+${result.statBreakdown.ad.items.toFixed(1)}`} color="#3b82f6" />
        <StatRow label="시너지" value={`+${result.statBreakdown.ad.traits.toFixed(1)}`} color="#22c55e" />
      </div>
    </div>
  );
}
