'use client';
import type { OpponentSnapshot } from '@/lib/actualData/types';
import TeamEditor from './TeamEditor';
import OpponentQuickFill from './OpponentQuickFill';

interface Props {
  index: number;
  opponent: OpponentSnapshot;
  onChange: (o: OpponentSnapshot) => void;
}

export default function OpponentPanel({ index, opponent, onChange }: Props) {
  return (
    <div className="space-y-2 text-gray-100">
      <label className="flex items-center gap-2 text-sm">
        <span className="text-gray-300">상대 Riot ID:</span>
        <input value={opponent.riotId ?? ''}
          onChange={e => onChange({ ...opponent, riotId: e.target.value || undefined })}
          className="border border-gray-700 bg-gray-900 text-gray-100 p-1 rounded" placeholder="name#TAG" />
      </label>
      <OpponentQuickFill roundIndex={index} />
      <TeamEditor label="상대 팀" team={opponent}
        onChange={t => onChange({ ...opponent, ...t })} />
    </div>
  );
}
