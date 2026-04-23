import { describe, it, expect } from 'vitest';
import { generateGameId } from '@/lib/actualData/roundFactory';

describe('generateGameId', () => {
  it('produces 001 when no prior ids for today', () => {
    const id = generateGameId([], new Date('2026-04-23T10:00:00Z'));
    expect(id).toBe('game-20260423-001');
  });

  it('increments when today ids exist', () => {
    const id = generateGameId(
      ['game-20260423-001', 'game-20260423-002'],
      new Date('2026-04-23T10:00:00Z'),
    );
    expect(id).toBe('game-20260423-003');
  });

  it('ignores ids from other dates', () => {
    const id = generateGameId(
      ['game-20260422-005', 'game-20260422-006'],
      new Date('2026-04-23T10:00:00Z'),
    );
    expect(id).toBe('game-20260423-001');
  });

  it('handles large NNN', () => {
    const id = generateGameId(
      ['game-20260423-099'],
      new Date('2026-04-23T10:00:00Z'),
    );
    expect(id).toBe('game-20260423-100');
  });
});
