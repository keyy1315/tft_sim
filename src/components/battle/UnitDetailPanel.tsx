'use client';

import { useMemo, useState } from 'react';
import { TickSnapshotUnit, COST_COLORS, RawItem, RawChampion } from '@/types';
import { getChampionImage } from '@/data/imageMap';
import { resolveDescription } from '@/lib/utils/text';
import { isAutoUnit } from '@/data/specialUnits';
import { getStaticRecommendations, verifyWithSimulation } from '@/lib/analysis/itemRecommender';
import ItemIcon from '@/components/builder/ItemIcon';
import type {
  Recommendation,
  VerifiedResult,
  VerifyContext,
  RoleCategory,
} from '@/types/analysis';

interface UnitMeta {
  championName: string;
  championApiName: string;
  cost: number;
  starLevel: number;
  maxHp: number;
  maxMana: number;
  traits: string[];
  ability: { name: string; desc: string; variables: { name: string; value: number[] }[] };
}

interface UnitDetailPanelProps {
  unitSnapshot: TickSnapshotUnit;
  meta: UnitMeta;
  onClose: () => void;
  /** 추천 엔진 검증용 컨텍스트. 없으면 엔진 검증 버튼 비활성. */
  verifyContext?: VerifyContext;
  /** 1차 추천 아이템 풀. 비어 있으면 추천 섹션 생략. */
  allItems?: RawItem[];
}

const STAR_LABELS: Record<number, string> = { 1: '★', 2: '★★', 3: '★★★' };

interface StatDef {
  label: string;
  value: number;
  format: 'int' | 'float' | 'percent';
}

function formatStat(value: number, format: 'int' | 'float' | 'percent'): string {
  if (format === 'percent') return `${Math.round(value * 100)}%`;
  if (format === 'float') return value.toFixed(2);
  return Math.round(value).toString();
}

export default function UnitDetailPanel({
  unitSnapshot,
  meta,
  onClose,
  verifyContext,
  allItems,
}: UnitDetailPanelProps) {
  const { stats, damageAmp } = unitSnapshot;
  const costColor = COST_COLORS[meta.cost as keyof typeof COST_COLORS] ?? '#9ca3af';

  const statDefs: StatDef[] = [
    { label: '공격력', value: stats.damage, format: 'int' },
    { label: '주문력', value: stats.ap, format: 'int' },
    { label: '피해증폭', value: damageAmp, format: 'percent' },
    { label: '방어력', value: stats.armor, format: 'int' },
    { label: '마법방어', value: stats.magicResist, format: 'int' },
    { label: '공격속도', value: stats.attackSpeed, format: 'float' },
    { label: '치명타', value: stats.critChance, format: 'percent' },
    { label: '사거리', value: stats.range, format: 'int' },
  ];

  const resolvedDesc = resolveDescription(
    meta.ability.desc ?? '',
    meta.ability.variables,
    meta.starLevel,
  );

  return (
    <div className="bg-[#111827] rounded-xl border border-gray-800 p-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-8 h-8 rounded border flex-shrink-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${getChampionImage(meta.championApiName)})`,
            borderColor: costColor,
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-gray-200">{meta.championName}</span>
            <span className="text-xs text-yellow-400">{STAR_LABELS[meta.starLevel]}</span>
          </div>
          <div className="flex gap-3 text-xs text-gray-500">
            <span>
              HP <span className="text-green-400">{Math.round(unitSnapshot.currentHp)}</span>
              <span className="text-gray-600">/{Math.round(meta.maxHp)}</span>
            </span>
            <span>
              Mana <span className="text-blue-400">{Math.round(unitSnapshot.currentMana)}</span>
              <span className="text-gray-600">/{meta.maxMana}</span>
            </span>
            {unitSnapshot.shield > 0 && (
              <span>
                보호막 <span className="text-gray-200">{Math.round(unitSnapshot.shield)}</span>
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-600 hover:text-gray-400 text-xs px-1"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>

      {/* Body: 3-column */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_260px_minmax(0,1fr)] gap-4">
        {/* 좌: 스탯 */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 content-start">
          {statDefs.map(s => (
            <div key={s.label} className="flex items-baseline justify-between gap-1">
              <span className="text-xs text-gray-500">{s.label}</span>
              <span className="text-sm font-mono text-gray-200 tabular-nums">
                {formatStat(s.value, s.format)}
              </span>
            </div>
          ))}
        </div>

        {/* 중: 추천 아이템 */}
        <div className="space-y-2 min-w-0">
          <RecommendationSection
            snapshot={unitSnapshot}
            meta={meta}
            verifyContext={verifyContext}
            allItems={allItems}
          />
        </div>

        {/* 우: 시너지 + 스킬 */}
        <div className="space-y-2 min-w-0">
          {meta.traits.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-1">시너지</div>
              <div className="flex flex-wrap gap-1">
                {meta.traits.map(t => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700/60 text-xs text-gray-300"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {meta.ability.name && (
            <div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-xs text-gray-500">스킬</span>
                <span className="text-sm font-bold text-cyan-300">{meta.ability.name}</span>
              </div>
              {resolvedDesc && (
                <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">
                  {resolvedDesc}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// RecommendationSection (서브)
// ============================================================

interface RecommendationSectionProps {
  snapshot: TickSnapshotUnit;
  meta: UnitMeta;
  verifyContext?: VerifyContext;
  allItems?: RawItem[];
}

function roleTagLabel(role: RoleCategory): string {
  if (role === 'TANK') return '탱커 기여 기준';
  if (role === 'SUPPORT') return '팀 승률 기준';
  return '딜 기여 기준';
}

function deriveRole(meta: UnitMeta, verifyContext?: VerifyContext): RoleCategory {
  // verifyContext 의 playerTeam 에서 원본 챔피언을 찾아 role 기반 분류
  const target = verifyContext?.playerTeam.find(p => p.champion.apiName === meta.championApiName);
  const r = (target?.champion.role ?? '') as string;
  if (r.includes('Tank')) return 'TANK';
  if (r.includes('Specialist')) return 'SUPPORT';
  return 'DAMAGE';
}

function RecommendationSection({
  snapshot, meta, verifyContext, allItems,
}: RecommendationSectionProps) {
  const [verified, setVerified] = useState<VerifiedResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const role = useMemo<RoleCategory>(
    () => deriveRole(meta, verifyContext),
    [meta, verifyContext],
  );

  // 1차 추천 (useMemo — meta/stats/items 변화 시에만 재계산)
  const recommendations = useMemo<Recommendation[]>(() => {
    if (!allItems || allItems.length === 0) return [];
    if (isAutoUnit(meta.championApiName)) return [];
    // verifyContext 에 원본 champion 있으면 그걸로, 없으면 meta 기반 mock
    const original = verifyContext?.playerTeam.find(
      p => p.champion.apiName === meta.championApiName,
    );
    const champ: RawChampion = original?.champion ?? ({
      name: meta.championName,
      apiName: meta.championApiName,
      cost: meta.cost,
      traits: meta.traits,
      role: null,
      stats: {
        hp: 0, armor: 0, magicResist: 0, damage: 0, attackSpeed: 0,
        range: snapshot.stats.range, critChance: 0, critMultiplier: 0,
        initialMana: 0, mana: meta.maxMana,
      },
      ability: {
        name: meta.ability.name,
        desc: meta.ability.desc,
        icon: '',
        variables: meta.ability.variables,
      },
    } as RawChampion);
    return getStaticRecommendations(champ, snapshot.stats, meta.starLevel, allItems);
  }, [meta, snapshot.stats, allItems, verifyContext]);

  const canVerify = !!verifyContext && recommendations.length > 0;

  const handleVerify = async () => {
    if (!canVerify || !verifyContext) return;
    setVerifying(true);
    setVerified(null);
    setProgress({ done: 0, total: 0 });
    try {
      // candidates: 추천 3개 조합을 하나의 엔진 시뮬 그룹으로 전달
      const candidates = [recommendations.map(r => r.item)];
      const result = await verifyWithSimulation(
        verifyContext,
        candidates,
        {
          n: 10,
          seedBase: 42,
          onProgress: (d, t) => setProgress({ done: d, total: t }),
        },
      );
      setVerified(result);
    } finally {
      setVerifying(false);
    }
  };

  if (isAutoUnit(meta.championApiName)) {
    return <div className="text-xs text-gray-500">이 유닛은 아이템 장착 불가</div>;
  }
  if (!allItems || allItems.length === 0) {
    return <div className="text-xs text-gray-600">아이템 풀 없음</div>;
  }
  if (recommendations.length === 0) {
    return <div className="text-xs text-gray-500">적합한 아이템 없음</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-gray-500 truncate">
          🎯 추천 아이템 · <span className="text-gray-400">{roleTagLabel(role)}</span>
        </div>
        <button
          onClick={handleVerify}
          disabled={!canVerify || verifying}
          className="px-2 py-0.5 rounded text-[11px] bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          title={canVerify ? '엔진으로 승률 검증' : '원본 팀 정보 없음'}
        >
          {verifying
            ? `시뮬 ${progress?.done ?? 0}/${progress?.total ?? 0}`
            : '⚡ 엔진 검증'}
        </button>
      </div>

      <ul className="space-y-2">
        {recommendations.map((r, i) => (
          <li key={i} className="flex items-center gap-2">
            <ItemIcon item={r.item} size={36} />
            <div className="min-w-0">
              <div className="text-xs font-medium text-gray-200 truncate">{r.item.name}</div>
              <div className="text-xs text-gray-500 truncate">{r.reason}</div>
            </div>
          </li>
        ))}
      </ul>

      {verified && (
        <div className="mt-3 pt-3 border-t border-gray-800 text-xs space-y-1">
          <div className="text-gray-500">
            Baseline: {Math.round(verified.baseline.winRate * 100)}%
          </div>
          {verified.perItem.map((v, i) => (
            <div
              key={i}
              className={i === verified.bestIndex ? 'text-yellow-300' : 'text-gray-300'}
            >
              <span className="inline-block w-3">{i === verified.bestIndex ? '★' : ' '}</span>
              <span className="truncate">{v.comboLabel}</span>
              <span className="ml-2 tabular-nums">{Math.round(v.winRate * 100)}%</span>
              <span className="ml-1 text-gray-500">
                ({v.deltaWinRate >= 0 ? '+' : ''}{Math.round(v.deltaWinRate * 100)}%p)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
