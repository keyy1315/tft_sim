'use client';

import { useState, useCallback } from 'react';
import { PlacedChampion, RawChampion, TeamPlannerEntry } from '@/types';
import { decodeTeamCode, encodeTeamCode, autoPlaceChampions } from '@/lib/teamCode';

interface TeamCodePanelProps {
  playerTeam: PlacedChampion[];
  enemyTeam: PlacedChampion[];
  champions: RawChampion[];
  teamPlannerMapping: TeamPlannerEntry[];
  onImport: (team: 'player' | 'enemy', champions: PlacedChampion[]) => void;
}

export default function TeamCodePanel({
  playerTeam,
  enemyTeam,
  champions,
  teamPlannerMapping,
  onImport,
}: TeamCodePanelProps) {
  const [importTarget, setImportTarget] = useState<'player' | 'enemy'>('player');
  const [importCode, setImportCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [copied, setCopied] = useState<'player' | 'enemy' | null>(null);

  const handleImport = useCallback(() => {
    setError(null);
    setWarning(null);

    const code = importCode.trim();
    if (!code) {
      setError('팀 코드를 입력하세요');
      return;
    }

    try {
      const result = decodeTeamCode(code, teamPlannerMapping, champions);
      if (result.champions.length === 0) {
        setError('디코딩된 챔피언이 없습니다');
        return;
      }
      const placed = autoPlaceChampions(result.champions);
      onImport(importTarget, placed);
      if (result.warnings.length > 0) {
        setWarning(result.warnings.join(', '));
      }
      setImportCode('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    }
  }, [importCode, importTarget, teamPlannerMapping, champions, onImport]);

  const handleExport = useCallback((team: 'player' | 'enemy') => {
    const teamArr = team === 'player' ? playerTeam : enemyTeam;
    if (teamArr.length === 0) return;

    const code = encodeTeamCode(
      teamArr.map(p => ({ champion: p.champion, starLevel: p.starLevel })),
      teamPlannerMapping,
    );

    navigator.clipboard.writeText(code).then(() => {
      setCopied(team);
      setTimeout(() => setCopied(null), 2000);
    });
  }, [playerTeam, enemyTeam, teamPlannerMapping]);

  return (
    <div className="bg-[#1a1f2e] rounded-lg border border-gray-700 p-3 space-y-3">
      {/* Import */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">임포트</div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <button
              onClick={() => setImportTarget('player')}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                importTarget === 'player' ? 'bg-blue-600 text-white' : 'bg-[#0d1117] text-gray-500'
              }`}
            >
              TEAM A
            </button>
            <button
              onClick={() => setImportTarget('enemy')}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                importTarget === 'enemy' ? 'bg-red-600 text-white' : 'bg-[#0d1117] text-gray-500'
              }`}
            >
              TEAM B
            </button>
          </div>
          <input
            type="text"
            value={importCode}
            onChange={e => { setImportCode(e.target.value); setError(null); setWarning(null); }}
            onKeyDown={e => { if (e.key === 'Enter') handleImport(); }}
            placeholder="팀 코드 붙여넣기..."
            className="flex-1 bg-[#0d1117] border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={handleImport}
            disabled={!importCode.trim()}
            className="px-3 py-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 rounded text-xs font-medium text-white transition-colors"
          >
            로드
          </button>
        </div>
        {error && <div className="text-xs text-red-400">{error}</div>}
        {warning && <div className="text-xs text-yellow-400">{warning}</div>}
      </div>

      {/* Export */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">익스포트</div>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('player')}
            disabled={playerTeam.length === 0}
            className="flex-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 disabled:opacity-30 border border-blue-600/30 rounded text-xs font-medium text-blue-300 transition-colors"
          >
            {copied === 'player' ? 'TEAM A 복사됨!' : 'TEAM A 코드 복사'}
          </button>
          <button
            onClick={() => handleExport('enemy')}
            disabled={enemyTeam.length === 0}
            className="flex-1 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 disabled:opacity-30 border border-red-600/30 rounded text-xs font-medium text-red-300 transition-colors"
          >
            {copied === 'enemy' ? 'TEAM B 복사됨!' : 'TEAM B 코드 복사'}
          </button>
        </div>
      </div>
    </div>
  );
}
