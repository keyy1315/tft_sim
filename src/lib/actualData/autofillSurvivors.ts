import type { PvPRound } from './types';

/**
 * Patch 의 winner 가 'player' / 'opponent' 로 명시 변경됐고 진 팀의 survivors
 * 가 비어있으면 자동으로 모든 진 팀 유닛을 사망 (alive=false, hpPercent=0) 으로
 * 채워넣는다. 이미 사용자가 일부라도 입력했으면 건드리지 않는다 (보호).
 *
 * 호출 패턴: `autofillLosingTeamSurvivors({ ...round, ...patch }, patch)` 처럼
 * merge 가 끝난 라운드와 원본 patch 를 함께 넘긴다 — patch 에서 winner 가
 * 명시됐는지 식별하기 위함.
 *
 * 'draw' 또는 winner 미변경 시 round 그대로 반환.
 */
export function autofillLosingTeamSurvivors(
  round: PvPRound,
  patch: Partial<Omit<PvPRound, 'type'>>,
): PvPRound {
  const w = patch.winner;
  if (w !== 'player' && w !== 'opponent') return round;

  const losingKey: 'playerTeam' | 'opponent' = w === 'player' ? 'opponent' : 'playerTeam';
  const losingTeam = round[losingKey];

  // 사용자 입력 보호: 한 명이라도 입력돼 있으면 자동 채움 skip
  if (losingTeam.survivors && losingTeam.survivors.length > 0) return round;
  if (losingTeam.units.length === 0) return round;

  const autoSurvivors = losingTeam.units.map((u) => ({
    hex: u.hex,
    championId: u.championId,
    alive: false as const,
    hpPercent: 0,
  }));

  return {
    ...round,
    [losingKey]: { ...losingTeam, survivors: autoSurvivors },
  };
}
