import type { ShrineRound, ShrineName } from './types';

export type GraceInference =
  | { kind: 'yasuo_grace'; appliesHexMultiplier: 1.5 }
  | { kind: 'other_grace'; shrine: ShrineName };

export function inferGraceFromShrines(shrines: ShrineRound[]): GraceInference | null {
  if (shrines.length === 0) return null;

  const counts = new Map<ShrineName, number>();
  for (const r of shrines) {
    counts.set(r.playerChosenShrine, (counts.get(r.playerChosenShrine) ?? 0) + 1);
  }

  // Yasuo special: 3회 선택 시에만 칸 위력 ×1.5
  if ((counts.get('yasuo') ?? 0) >= 3) {
    return { kind: 'yasuo_grace', appliesHexMultiplier: 1.5 };
  }

  // 그 외: 2회 이상 선택한 신이 있으면 그 신의 은총 증강
  let best: { shrine: ShrineName; count: number } | null = null;
  for (const [shrine, count] of counts) {
    if (count < 2) continue;
    if (!best || count > best.count) best = { shrine, count };
  }
  if (best) return { kind: 'other_grace', shrine: best.shrine };

  return null;
}
