'use client';
import { useActualDataStore } from '@/store/actualDataSlice';
import PvPRoundEditor from './PvPRoundEditor';
import ShrineRoundEditor from './ShrineRoundEditor';

export default function RoundEditor() {
  const game = useActualDataStore(s => s.currentGame);
  const idx = useActualDataStore(s => s.currentRoundIndex);

  if (!game || idx === null) return null;
  const r = game.rounds[idx];
  if (!r) return null;

  if (r.type === 'pvp') return <PvPRoundEditor index={idx} round={r} />;
  return <ShrineRoundEditor index={idx} round={r} />;
}
