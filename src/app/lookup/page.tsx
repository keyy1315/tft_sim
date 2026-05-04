'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getChampionImage } from '@/data/imageMap';
import Tooltip from '@/components/ui/Tooltip';
import { useMatchAnalysis } from '@/hooks/useMatchAnalysis';
import ItemDiagnosis from '@/components/analysis/ItemDiagnosis';
import { useLookupStore } from '@/store/lookupSlice';
import type { ItemAnalysisResult } from '@/types/analysis';
import type {
  LookupChampion as Champion,
  LookupTraitData as TraitData,
  TraitMetaEntry,
  ChampionMetaEntry,
  ItemMetaEntry,
  MatchData,
  LookupResult,
} from '@/types/lookup';

/* ─── Helpers ─── */

function formatGameLength(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}분 ${sec}초`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return '방금 전';
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return d.toLocaleDateString('ko-KR');
}

function placementColor(p: number): string {
  if (p === 1) return 'text-yellow-400 font-black';
  if (p <= 4) return 'text-blue-400 font-bold';
  return 'text-gray-400';
}

function placementBg(p: number): string {
  if (p === 1) return 'border-yellow-500/40 bg-yellow-500/5';
  if (p <= 4) return 'border-blue-500/30 bg-blue-500/5';
  return 'border-gray-700/50 bg-gray-800/30';
}

function cleanChampionName(id: string): string {
  return id.replace(/^TFT\d+_/i, '');
}

const QUEUE_LABELS: Record<number, { label: string; color: string }> = {
  1100: { label: '랭크', color: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10' },
  1090: { label: '일반', color: 'text-gray-400 border-gray-600/40 bg-gray-700/10' },
  1130: { label: '초고속', color: 'text-purple-400 border-purple-500/40 bg-purple-500/10' },
  1160: { label: '더블업', color: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10' },
  1220: { label: '톡톡이의 시험', color: 'text-pink-400 border-pink-500/40 bg-pink-500/10' },
};

function queueLabel(queueId: number | null): { label: string; color: string } {
  if (queueId == null) return { label: '일반', color: 'text-gray-400 border-gray-600/40 bg-gray-700/10' };
  return QUEUE_LABELS[queueId] ?? { label: `#${queueId}`, color: 'text-gray-400 border-gray-600/40 bg-gray-700/10' };
}

/* ─── Cost & Tier styles ─── */

const COST_COLORS: Record<number, string> = {
  1: '#9ca3af',
  2: '#22c55e',
  3: '#3b82f6',
  4: '#a855f7',
  5: '#f59e0b',
};

const TRAIT_STYLES: Record<number | string, { bg: string; text: string }> = {
  1: { bg: 'border-amber-700/60 bg-amber-900/30', text: 'text-amber-500' },
  2: { bg: 'border-gray-400/60 bg-gray-500/20', text: 'text-gray-300' },
  3: { bg: 'border-yellow-400/60 bg-yellow-500/20', text: 'text-yellow-400' },
  4: { bg: 'border-fuchsia-400/60 bg-fuchsia-500/20', text: 'text-white' },
  unique: { bg: 'border-orange-400/60 bg-orange-500/20', text: 'text-orange-400' },
};

/* ─── Tooltip content builders ─── */

function ChampionTooltip({ meta }: { meta: ChampionMetaEntry }) {
  const isSummon = meta.cost > 5;
  return (
    <div>
      <div className="font-bold">{meta.name} {!isSummon && <span className="text-gray-400 font-normal">{meta.cost}코스트</span>}{isSummon && <span className="text-cyan-400 font-normal text-xs">소환 유닛</span>}</div>
      {meta.traits.length > 0 && <div className="text-gray-400 text-xs mt-0.5">{meta.traits.join(', ')}</div>}
    </div>
  );
}

function ItemTooltip({ meta }: { meta: ItemMetaEntry }) {
  return (
    <div>
      <div className="font-bold">{meta.name}</div>
      {meta.desc && <div className="text-gray-400 text-xs mt-0.5">{meta.desc}</div>}
    </div>
  );
}

function UnknownItemTooltip({ apiName }: { apiName: string }) {
  return (
    <div>
      <div className="font-bold text-orange-300">미지원 아이템</div>
      <div className="text-gray-400 text-xs mt-0.5 font-mono">{apiName}</div>
      <div className="text-gray-500 text-[10px] mt-1">로컬 DB에 없는 아이템입니다 (Anomaly, Graves 특수 아이템 등). 가상 대전 시뮬에 반영되지 않습니다.</div>
    </div>
  );
}

function UnknownChampionTooltip({ apiName }: { apiName: string }) {
  return (
    <div>
      <div className="font-bold text-orange-300">미지원 챔피언</div>
      <div className="text-gray-400 text-xs mt-0.5 font-mono">{apiName}</div>
      <div className="text-gray-500 text-[10px] mt-1">로컬 DB에 없는 챔피언입니다. 가상 대전 분석이 불가능할 수 있습니다.</div>
    </div>
  );
}

function UnknownTraitTooltip({ apiName }: { apiName: string }) {
  return (
    <div>
      <div className="font-bold text-orange-300">미지원 시너지</div>
      <div className="text-gray-400 text-xs mt-0.5 font-mono">{apiName}</div>
    </div>
  );
}

function TraitTooltipContent({ meta, numUnits }: { meta: TraitMetaEntry; numUnits: number }) {
  return (
    <div>
      <div className="font-bold">{meta.name} <span className="text-gray-400 font-normal">{numUnits}</span></div>
      {meta.desc && <div className="text-gray-400 text-xs mt-0.5">{meta.desc}</div>}
    </div>
  );
}

/* ─── Sub-components ─── */

function ChampionUnit({
  champion,
  meta,
  itemMeta,
}: {
  champion: Champion;
  meta?: ChampionMetaEntry;
  itemMeta?: Record<string, ItemMetaEntry>;
}) {
  const { id, tier, items } = champion;
  const [imgError, setImgError] = useState(false);

  const cost = meta?.cost ?? 1;
  const isSummonUnit = cost > 5;
  const borderColor = isSummonUnit ? '#e5e7eb' : (COST_COLORS[cost] ?? COST_COLORS[1]);

  const champImg = imgError ? (
    <div
      className="w-8 h-8 md:w-10 md:h-10 rounded border-2 bg-gray-700 flex items-center justify-center"
      style={{ borderColor }}
    >
      <span className="text-[8px] text-gray-400">{cleanChampionName(id).slice(0, 3)}</span>
    </div>
  ) : (
    <img
      src={getChampionImage(id)}
      alt={cleanChampionName(id)}
      className={`w-8 h-8 md:w-10 md:h-10 rounded border-2 ${tier >= 3 ? 'shadow-[0_0_6px_#f59e0b]' : ''}`}
      style={{ borderColor }}
      onError={() => setImgError(true)}
    />
  );

  return (
    <div className="flex flex-col items-center w-[40px] md:w-[48px]">
      {cost <= 5 ? (
        <div className="text-[9px] md:text-[10px] leading-none mb-0.5" style={{ color: borderColor }}>
          {'★'.repeat(tier)}
        </div>
      ) : (
        <div className="text-[9px] md:text-[10px] leading-none mb-0.5 invisible">★</div>
      )}
      {meta ? (
        <Tooltip content={<ChampionTooltip meta={meta} />}>
          {champImg}
        </Tooltip>
      ) : (
        <Tooltip content={<UnknownChampionTooltip apiName={id} />}>
          <div className="relative">
            {champImg}
            <span className="absolute -top-1 -right-1 text-[8px] bg-orange-500/80 text-white rounded-full w-3 h-3 md:w-3.5 md:h-3.5 flex items-center justify-center leading-none">?</span>
          </div>
        </Tooltip>
      )}
      {items.length > 0 && (
        <div className="flex gap-0.5 mt-0.5">
          {items.slice(0, 3).map((item, i) => {
            const iMeta = itemMeta?.[item];
            if (!iMeta?.icon) {
              return (
                <Tooltip key={i} content={<UnknownItemTooltip apiName={item} />}>
                  <div className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-sm bg-gray-700/60 border border-gray-500/50 flex items-center justify-center">
                    <span className="text-[8px] md:text-[9px] text-gray-400 leading-none">?</span>
                  </div>
                </Tooltip>
              );
            }
            return (
              <Tooltip key={i} content={<ItemTooltip meta={iMeta} />}>
                <img
                  src={iMeta.icon}
                  alt=""
                  className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-sm"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </Tooltip>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TraitBadge({ trait, meta }: { trait: TraitData; meta?: TraitMetaEntry }) {
  const isUnique = meta?.isUnique && trait.style >= 1;
  const styleKey = isUnique ? 'unique' : trait.style;
  const style = TRAIT_STYLES[styleKey] ?? TRAIT_STYLES[1];
  const [imgError, setImgError] = useState(false);

  const badge = (
    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${style.bg}`}>
      {meta?.icon && !imgError ? (
        <img
          src={meta.icon}
          alt=""
          className="w-4 h-4 md:w-5 md:h-5"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className={`text-[10px] ${style.text}`}>
          {meta?.name ?? trait.name.replace(/^TFT\d+_/, '')}
        </span>
      )}
      <span className={`text-[10px] md:text-xs font-medium ${style.text}`}>{trait.numUnits}</span>
    </div>
  );

  return meta ? (
    <Tooltip content={<TraitTooltipContent meta={meta} numUnits={trait.numUnits} />}>
      {badge}
    </Tooltip>
  ) : (
    <Tooltip content={<UnknownTraitTooltip apiName={trait.name} />}>
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-orange-500/40 bg-orange-500/10">
        <span className="text-[10px] text-orange-300">?</span>
        <span className="text-[10px] text-orange-300">{trait.name.replace(/^TFT\d+_/, '')}</span>
        <span className="text-[10px] md:text-xs font-medium text-orange-300">{trait.numUnits}</span>
      </div>
    </Tooltip>
  );
}

/* ─── Season tabs ─── */

const SET_LABELS: Record<string, string> = {
  set17: 'Set 17',
  set16: 'Set 16',
};

/* ─── Participant row (expanded view) ─── */

interface ParticipantData {
  puuid: string;
  gameName?: string;
  tagLine?: string;
  placement: number;
  champions: Champion[];
  traits: TraitData[];
}

function ParticipantRow({
  p,
  isMe,
  championMeta,
  itemMeta,
  traitMeta,
  onSearchPlayer,
}: {
  p: ParticipantData;
  isMe: boolean;
  championMeta: Record<string, ChampionMetaEntry>;
  itemMeta: Record<string, ItemMetaEntry>;
  traitMeta: Record<string, TraitMetaEntry>;
  onSearchPlayer: (name: string) => void;
}) {
  const sortedTraits = [...p.traits].sort((a, b) => b.style - a.style);
  const displayName = p.gameName && p.tagLine ? `${p.gameName}#${p.tagLine}` : null;

  return (
    <div className={`flex items-start gap-3 p-2 rounded-lg ${isMe ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-gray-800/30'}`}>
      <span className={`text-lg font-bold w-8 shrink-0 ${placementColor(p.placement)}`}>
        #{p.placement}
      </span>
      <div className="flex-1 min-w-0">
        {displayName && (
          <div className="mb-1">
            {isMe ? (
              <span className="text-xs text-yellow-400 font-medium">{displayName}</span>
            ) : (
              <button
                onClick={() => onSearchPlayer(displayName)}
                className="text-xs text-gray-400 hover:text-yellow-400 hover:underline transition-colors"
              >
                {displayName}
              </button>
            )}
          </div>
        )}
        {sortedTraits.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {sortedTraits.map((t) => (
              <TraitBadge key={t.name} trait={t} meta={traitMeta[t.name]} />
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {p.champions.map((c, i) => (
            <ChampionUnit key={i} champion={c} meta={championMeta[c.id]} itemMeta={itemMeta} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Match card with expand ─── */

function MatchCard({
  match,
  result,
  searchedPuuid,
  onSearchPlayer,
  itemResult,
  isFirstPlace,
}: {
  match: MatchData;
  result: LookupResult;
  searchedPuuid: string;
  onSearchPlayer: (name: string) => void;
  itemResult?: ItemAnalysisResult | null;
  isFirstPlace?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [participants, setParticipants] = useState<ParticipantData[] | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const traits = match.traits ?? [];
  const sortedTraits = [...traits].sort((a, b) => b.style - a.style);

  const handleExpand = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (participants) return;

    setLoadingDetail(true);
    try {
      const res = await fetch('/api/lookup/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: match.match_id }),
      });
      const data = await res.json();
      if (res.ok) {
        setParticipants(data.participants as ParticipantData[]);
      }
    } catch { /* ignore */ }
    finally { setLoadingDetail(false); }
  };

  return (
    <div className={`rounded-xl border ${placementBg(match.placement)} transition-colors overflow-hidden`}>
      {/* Main content */}
      <div className="flex">
        <div className="flex-1 p-4">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <span className={`text-2xl ${placementColor(match.placement)}`}>
              #{match.placement}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs border ${queueLabel(match.queue_id).color}`}>
              {queueLabel(match.queue_id).label}
            </span>
            <div className="text-sm text-gray-500">
              {formatGameLength(match.game_length)} · {formatDate(match.game_datetime)}
            </div>
          </div>

          {/* Traits */}
          {sortedTraits.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {sortedTraits.map((t) => (
                <TraitBadge key={t.name} trait={t} meta={result.traitMeta?.[t.name]} />
              ))}
            </div>
          )}

          {/* Champions */}
          <div className="flex flex-wrap gap-2">
            {match.champions.map((c, i) => (
              <ChampionUnit
                key={i}
                champion={c}
                meta={result.championMeta?.[c.id]}
                itemMeta={result.itemMeta}
              />
            ))}
          </div>

          {/* Analysis (Phase 1) */}
          {isFirstPlace && (
            <div className="mt-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-300">
              1등 축하합니다! 완벽한 플레이였어요.
            </div>
          )}
          {!isFirstPlace && itemResult && <ItemDiagnosis result={itemResult} />}

          {/* 가상 대전 분석 버튼 (Set 17만) */}
          {(match.set_id ?? 'set17') === 'set17' && !isFirstPlace && (
            <Link
              href={`/lookup/${encodeURIComponent(match.match_id)}/analysis?puuid=${encodeURIComponent(searchedPuuid)}`}
              className="mt-2 inline-block px-3 py-1.5 rounded text-xs font-medium bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30 transition-colors"
            >
              가상 대전 분석
            </Link>
          )}
        </div>

        {/* Expand toggle (right edge) */}
        <button
          onClick={handleExpand}
          className="w-7 shrink-0 flex items-center justify-center bg-gray-700/20 hover:bg-gray-600/30 transition-colors border-l border-gray-700/30"
        >
          <span className={`text-gray-500 text-xs transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>
            ▶
          </span>
        </button>
      </div>

      {/* Expanded: all participants */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-700/30 space-y-1.5">
          {loadingDetail && (
            <div className="text-sm text-gray-500 py-2">로딩 중...</div>
          )}
          {participants && participants.map((p) => (
            <ParticipantRow
              key={`${p.puuid}-${p.placement}`}
              p={p}
              isMe={p.puuid === searchedPuuid}
              championMeta={result.championMeta ?? {}}
              itemMeta={result.itemMeta ?? {}}
              traitMeta={result.traitMeta ?? {}}
              onSearchPlayer={onSearchPlayer}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main ─── */

export default function LookupPage() {
  const { input, activeSet, result, setInput, setActiveSet, setResult } = useLookupStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { results: analysisResults, analyze, reset: resetAnalysis } = useMatchAnalysis();

  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);

  const handleSearch = async (searchInput?: string) => {
    const trimmed = (searchInput ?? input).trim();
    const separatorIdx = trimmed.lastIndexOf('#');
    if (separatorIdx === -1) {
      setError('형식: 소환사명#태그 (예: Hide on bush#KR1)');
      return;
    }

    const gameName = trimmed.slice(0, separatorIdx).trim();
    const tagLine = trimmed.slice(separatorIdx + 1).trim();
    if (!gameName || !tagLine) {
      setError('소환사명과 태그를 모두 입력해주세요.');
      return;
    }

    if (searchInput) setInput(searchInput);
    setLoading(true);
    setError('');
    setResult(null);
    setActiveSet('set17');
    // 유저가 바뀌면 이전 분석 캐시를 비운다 — 같은 match_id 라도 덱/플레이어가 달라 분석 결과가 다름.
    resetAnalysis();

    try {
      const res = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameName, tagLine }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? '검색 실패');
        return;
      }

      setResult(data as LookupResult);
      setPage(1);
    } catch {
      setError('서버 연결 실패');
    } finally {
      setLoading(false);
    }
  };

  const allMatches = result?.matches ?? [];
  const availableSets = [...new Set(allMatches.map((m) => m.set_id ?? 'set17'))].sort().reverse();
  const filteredMatches = allMatches.filter((m) => (m.set_id ?? 'set17') === activeSet);

  // 페이지네이션 파생 값: currentPage 는 데이터 감소 케이스 대비 clamp.
  const totalPages = Math.max(1, Math.ceil(filteredMatches.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visibleMatches = filteredMatches.slice(pageStart, pageStart + PAGE_SIZE);

  // Set 17 매치에 대해 자동 분석 실행 (현재 페이지 한정)
  useEffect(() => {
    for (const m of visibleMatches) {
      if ((m.set_id ?? 'set17') === 'set17' && !analysisResults.has(m.match_id)) {
        analyze(m.match_id, {
          setId: m.set_id,
          placement: m.placement,
          champions: m.champions,
          traits: m.traits,
        });
      }
    }
  }, [visibleMatches, analysisResults, analyze]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">
        <span className="text-yellow-400">TFT</span>{' '}
        <span className="text-gray-200">전적검색</span>
      </h1>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="소환사명#태그 (예: Hide on bush#KR1)"
          className="flex-1 px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-yellow-500/50"
        />
        <button
          onClick={() => handleSearch()}
          disabled={loading}
          className="px-6 py-3 rounded-xl bg-yellow-500 text-black font-bold hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '검색 중...' : '검색'}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 mb-6">
          {error}
        </div>
      )}

      {result && (
        <>
          {/* Season tabs */}
          {availableSets.length > 1 && (
            <div className="flex gap-2 mb-4">
              {availableSets.map((setId) => {
                const count = allMatches.filter((m) => (m.set_id ?? 'set17') === setId).length;
                return (
                  <button
                    key={setId}
                    onClick={() => { setActiveSet(setId); setPage(1); }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeSet === setId
                        ? 'bg-yellow-500 text-black'
                        : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                    }`}
                  >
                    {SET_LABELS[setId] ?? setId} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Match count + 새로고침 */}
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-500">
              {SET_LABELS[activeSet] ?? activeSet} — 전체 {filteredMatches.length}게임
              {totalPages > 1 && (
                <span className="ml-2 text-gray-600">· 페이지 {currentPage} / {totalPages}</span>
              )}
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={loading}
              className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs text-gray-300 transition-colors"
            >
              {loading ? '새로고침 중...' : '↻ 새로고침'}
            </button>
          </div>

          {/* Match list */}
          <div className="space-y-3">
            {visibleMatches.map((m) => (
              <MatchCard
                key={m.match_id}
                match={m}
                result={result}
                searchedPuuid={result.summoner.puuid}
                onSearchPlayer={(name) => handleSearch(name)}
                itemResult={analysisResults.get(m.match_id)?.items}
                isFirstPlace={analysisResults.get(m.match_id)?.isFirstPlace}
              />
            ))}

            {filteredMatches.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                {SET_LABELS[activeSet] ?? activeSet} 시즌 전적이 없습니다.
              </div>
            )}
          </div>

          <PaginationBar page={currentPage} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}

interface PaginationBarProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

function PaginationBar({ page, totalPages, onChange }: PaginationBarProps) {
  if (totalPages <= 1) return null;
  const go = (p: number) => {
    onChange(p);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  return (
    <div className="flex items-center justify-center gap-3 mt-6 text-sm">
      <button
        onClick={() => go(Math.max(1, page - 1))}
        disabled={page <= 1}
        aria-label="이전 페이지"
        className="px-3 py-1.5 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        ←
      </button>
      <span className="text-gray-400 tabular-nums">
        {page} <span className="text-gray-600">/</span> {totalPages}
      </span>
      <button
        onClick={() => go(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        aria-label="다음 페이지"
        className="px-3 py-1.5 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        →
      </button>
    </div>
  );
}
