/**
 * Replay Engine — 틱별 스냅샷 기반 재생 시스템
 */

import { CombatUnit, CombatLog, TickSnapshot } from '@/types';

/**
 * 현재 전투 상태에서 틱 스냅샷 생성
 */
export function captureSnapshot(
  tick: number,
  units: CombatUnit[],
  tickEvents: CombatLog[]
): TickSnapshot {
  const unitMap: TickSnapshot['units'] = {};
  for (const u of units) {
    unitMap[u.id] = {
      id: u.id,
      currentHp: u.currentHp,
      currentMana: u.currentMana,
      position: { ...u.position },
      isAlive: u.state !== 'dead',
      statusEffects: u.statusEffects.map(e => ({
        type: e.type,
        remainingTicks: e.remainingTicks,
        value: e.value,
      })),
    };
  }
  return { tick, units: unitMap, events: tickEvents };
}

/**
 * Replay Controller — 스냅샷 배열을 탐색하며 재생 제어
 */
export class ReplayController {
  private snapshots: TickSnapshot[] = [];
  private currentIndex = 0;
  private _playbackSpeed: 1 | 2 | 4 = 1;
  private _isPlaying = false;

  load(snapshots: TickSnapshot[]): void {
    this.snapshots = snapshots;
    this.currentIndex = 0;
    this._isPlaying = false;
  }

  get totalTicks(): number {
    return this.snapshots.length;
  }

  get currentTick(): number {
    return this.currentIndex;
  }

  get playbackSpeed(): 1 | 2 | 4 {
    return this._playbackSpeed;
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  play(): void {
    this._isPlaying = true;
  }

  pause(): void {
    this._isPlaying = false;
  }

  setSpeed(speed: 1 | 2 | 4): void {
    this._playbackSpeed = speed;
  }

  /** 특정 틱으로 이동 */
  seek(tick: number): TickSnapshot | null {
    const idx = Math.max(0, Math.min(tick, this.snapshots.length - 1));
    this.currentIndex = idx;
    return this.snapshots[idx] ?? null;
  }

  /** 다음 틱 (speed만큼 건너뛰기) */
  step(): TickSnapshot | null {
    if (this.currentIndex >= this.snapshots.length - 1) {
      this._isPlaying = false;
      return this.snapshots[this.currentIndex] ?? null;
    }
    this.currentIndex = Math.min(
      this.currentIndex + this._playbackSpeed,
      this.snapshots.length - 1
    );
    return this.snapshots[this.currentIndex] ?? null;
  }

  /** 이전 틱 */
  stepBack(): TickSnapshot | null {
    this.currentIndex = Math.max(0, this.currentIndex - 1);
    return this.snapshots[this.currentIndex] ?? null;
  }

  /** 현재 스냅샷 */
  current(): TickSnapshot | null {
    return this.snapshots[this.currentIndex] ?? null;
  }
}
