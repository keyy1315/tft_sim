import type { ActualGameData } from './types';

const PREFIX = 'actualData:draft:';

export function saveDraft(game: ActualGameData): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PREFIX + game.gameId, JSON.stringify(game));
  } catch {
    /* quota */
  }
}

export function loadDraft(gameId: string): ActualGameData | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(PREFIX + gameId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActualGameData;
  } catch {
    return null;
  }
}

export function clearDraft(gameId: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(PREFIX + gameId);
}
