'use client';
import { useActualDataStore } from '@/store/actualDataSlice';
import { inferGraceFromShrines } from '@/lib/actualData/graceInference';
import type { ShrineRound } from '@/lib/actualData/types';

export default function GraceStatus({ currentRoundIndex }: { currentRoundIndex: number }) {
  const game = useActualDataStore(s => s.currentGame);
  if (!game) return null;

  const shrinesUpToNow = game.rounds
    .slice(0, currentRoundIndex + 1)
    .filter((r): r is ShrineRound => r.type === 'shrine');

  const inference = inferGraceFromShrines(shrinesUpToNow);
  const currentRound = game.rounds[currentRoundIndex];
  const isAfter47 = currentRound ? isRoundAfter(currentRound.roundName, '4-7') : false;

  if (!inference) {
    return <p className="text-xs text-gray-500">은총 없음 (야스오 3회 또는 다른 신 2회 이상 필요)</p>;
  }

  if (!isAfter47) {
    return <p className="text-xs text-gray-500">
      은총 예고: {inference.kind === 'yasuo_grace' ? '야스오 (칸 위력 ×1.5)' : `${inference.shrine}의 은총 증강`}
      (4-7 이후 적용)
    </p>;
  }

  if (inference.kind === 'yasuo_grace') {
    return <p className="text-xs text-amber-700 font-semibold">
      🌀 야스오의 은총 발동: 설치된 모든 칸 위력 +50% (graceApplied=true)
    </p>;
  }

  return <p className="text-xs text-amber-700">
    🌀 {inference.shrine}의 은총 증강 → 4번째 증강 슬롯 후보
  </p>;
}

function isRoundAfter(current: string, target: string): boolean {
  const [cs, cr] = current.split('-').map(Number);
  const [ts, tr] = target.split('-').map(Number);
  return cs !== ts ? cs > ts : cr > tr;
}
