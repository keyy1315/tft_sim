'use client';

import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useCombatAnalysis } from '@/hooks/useCombatAnalysis';
import { useTeamPlannerMapping } from '@/hooks/useGameData';
import OpponentSelector from '@/components/analysis/OpponentSelector';
import DefeatReport from '@/components/analysis/DefeatReport';
import MatchResultSummary from '@/components/analysis/MatchResultSummary';
import UnsupportedNotice from '@/components/analysis/UnsupportedNotice';
import ConfidenceBadge from '@/components/analysis/ConfidenceBadge';
import { encodeTeamCode } from '@/lib/teamCode';
import type { PlacedChampion } from '@/types';
import type { ParsedParticipant } from '@/lib/riot';

interface ParticipantResponse {
  puuid: string;
  gameName?: string;
  tagLine?: string;
  placement: number;
  champions: Array<{ id: string; tier: number; items: string[] }>;
  traits: Array<{ name: string; numUnits: number; style: number; tierCurrent: number }>;
}

/** 챔피언별 장착 아이템 apiName 맵 수집 (extras.items 용) */
function collectItems(team: PlacedChampion[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const p of team) {
    map[p.champion.apiName] = p.items.map(i => i.apiName);
  }
  return map;
}

/** 챔피언별 원본 성급 맵 수집. 팀코드는 star=0 을 기본 2성으로 해석하므로
 * 원본 1성 정보를 보존하려면 별도 전달이 필요. */
function collectStarLevels(team: PlacedChampion[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const p of team) {
    map[p.champion.apiName] = p.starLevel;
  }
  return map;
}

export default function MatchAnalysisPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const matchId = params.matchId as string;
  const puuid = searchParams.get('puuid') ?? '';

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const analysis = useCombatAnalysis();
  const { teamPlannerMapping } = useTeamPlannerMapping('set17');
  const autoRunTriggered = useRef(false);

  useEffect(() => {
    async function loadMatch() {
      try {
        const res = await fetch('/api/lookup/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId }),
        });
        if (!res.ok) { setFetchError('매치 데이터 로드 실패'); return; }
        const data = await res.json();
        const participants: ParsedParticipant[] = (data.participants as ParticipantResponse[]).map(p => ({
          puuid: p.puuid,
          gameName: p.gameName,
          tagLine: p.tagLine,
          placement: p.placement,
          champions: p.champions,
          traits: p.traits,
        }));

        const player = participants.find(p => p.puuid === puuid) ?? participants[0];
        analysis.setParticipants(participants);
        await analysis.checkMatch('set17', player, participants);
      } catch {
        setFetchError('서버 연결 실패');
      } finally {
        setLoading(false);
      }
    }
    loadMatch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, puuid]);

  const player = analysis.participants.find(p => p.puuid === puuid) ?? analysis.participants[0];

  /** 진입 시 1회 — 기본 상대(한 등수 위) 와 자동 가상 대전 실행. */
  useEffect(() => {
    if (autoRunTriggered.current) return;
    if (analysis.status !== 'ready') return;
    if (analysis.reconstruction !== null) return;
    if (!player || !analysis.selectedOpponent) return;
    autoRunTriggered.current = true;
    analysis.runSimulation(player);
  }, [analysis.status, analysis.reconstruction, analysis.selectedOpponent, player, analysis]);

  /** 시뮬레이터 페이지로 팀 데이터를 팀코드 + extras 로 전달하고 이동.
   *  - playerCode/enemyCode: encodeTeamCode (챔피언 apiName + 별)
   *  - extras.items: 챔피언별 아이템 apiName (팀코드 포맷에 없는 정보 보완)
   *  - returnTo: 복귀 버튼용 {matchId, puuid}
   */
  const openInSimulator = () => {
    if (!analysis.reconstruction || teamPlannerMapping.length === 0) return;

    const { playerTeam, enemyTeam } = analysis.reconstruction;
    const handoff = {
      playerCode: encodeTeamCode(
        playerTeam.map(p => ({ champion: p.champion, starLevel: p.starLevel })),
        teamPlannerMapping,
      ),
      enemyCode: encodeTeamCode(
        enemyTeam.map(p => ({ champion: p.champion, starLevel: p.starLevel })),
        teamPlannerMapping,
      ),
      extras: {
        player: { items: collectItems(playerTeam), starLevels: collectStarLevels(playerTeam) },
        enemy: { items: collectItems(enemyTeam), starLevels: collectStarLevels(enemyTeam) },
      },
      teamNames: {
        player: player?.gameName ?? null,
        enemy: analysis.selectedOpponent?.gameName ?? null,
      },
      returnTo: { matchId, puuid },
    };
    sessionStorage.setItem('analysis_handoff', JSON.stringify(handoff));
    router.push('/simulator');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/lookup" className="text-gray-500 hover:text-gray-300 text-sm mb-4 inline-block">
        ← 전적 목록
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-200">매치 분석</h1>
        {analysis.coverage && <ConfidenceBadge confidence={analysis.coverage.confidence} />}
      </div>

      {loading && <div className="text-gray-500">로딩 중...</div>}
      {fetchError && <div className="text-red-400">{fetchError}</div>}

      {analysis.status === 'unsupported' && analysis.coverage && (
        <UnsupportedNotice coverage={analysis.coverage} />
      )}

      {analysis.status === 'error' && (
        <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-400">
          {analysis.error}
        </div>
      )}

      {(analysis.status === 'ready' || analysis.status === 'simulating' || analysis.status === 'done') && (
        <div className="space-y-4">
          <OpponentSelector
            participants={analysis.participants}
            selected={analysis.selectedOpponent}
            playerPuuid={puuid}
            onSelect={analysis.selectOpponent}
          />

          <div className="flex gap-2">
            <button
              onClick={() => player && analysis.runSimulation(player)}
              disabled={analysis.status === 'simulating' || !analysis.selectedOpponent}
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium transition-colors"
            >
              {analysis.status === 'simulating' ? '시뮬레이션 실행 중...' : '▶ 가상 대전 실행'}
            </button>

            {analysis.status === 'done' && analysis.reconstruction && (
              <button
                onClick={openInSimulator}
                disabled={teamPlannerMapping.length === 0}
                className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium transition-colors"
              >
                시뮬레이터에서 열기
              </button>
            )}
          </div>

          {/* 결과 요약: 승자 · 양팀 딜량 · 생존 유닛 */}
          {analysis.status === 'done' && analysis.reconstruction && analysis.originalResult && (
            <MatchResultSummary
              result={analysis.originalResult}
              reconstruction={analysis.reconstruction}
              playerName={player?.gameName}
              opponentName={analysis.selectedOpponent?.gameName}
            />
          )}

          {/* 패배 시 취약 요인 리포트 병기 */}
          {analysis.status === 'done' && analysis.defeatReport && (
            <DefeatReport result={analysis.defeatReport} />
          )}

          {/* 시뮬레이터 안내 */}
          {analysis.status === 'done' && analysis.reconstruction && (
            <div className="p-2 rounded bg-gray-800/50 border border-gray-700/30 text-xs text-gray-400">
              &quot;시뮬레이터에서 열기&quot;로 배치/아이템을 수정하고 재시뮬레이션할 수 있습니다.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
