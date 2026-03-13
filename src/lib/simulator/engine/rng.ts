/**
 * Seed 기반 결정론적 난수 생성기 (Mulberry32)
 * Math.random() 직접 사용 금지 (CLAUDE.md 규칙)
 * 동일 seed → 동일 결과 보장 (Replay 결정론)
 */

export interface SeededRNG {
  seed: number;
  next(): number; // 0~1 범위
}

export function createRNG(seed: number): SeededRNG {
  let s = seed | 0;
  return {
    seed,
    next() {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}
