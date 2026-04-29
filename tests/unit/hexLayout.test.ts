import { describe, it, expect } from 'vitest';
import { createHexLayout } from '@/components/battle/HexBoard';

describe('createHexLayout', () => {
  it('hexR=44 (default): 기존 상수와 동일', () => {
    const layout = createHexLayout(44);
    expect(layout.HEX_R).toBe(44);
    expect(layout.HEX_W).toBeCloseTo(44 * Math.sqrt(3));
    expect(layout.HEX_H).toBe(88);
    expect(layout.PAD).toBe(5);
  });

  it('hexR=36 (mobile): 모든 치수가 비례', () => {
    const layout = createHexLayout(36);
    expect(layout.HEX_R).toBe(36);
    expect(layout.HEX_W).toBeCloseTo(36 * Math.sqrt(3));
    expect(layout.HEX_H).toBe(72);
  });

  it('hexCenter: row/col 에 따라 일관된 좌표', () => {
    const layout = createHexLayout(44);
    const c0 = layout.hexCenter(0, 0);
    const c1 = layout.hexCenter(0, 1);
    expect(c1.cx - c0.cx).toBeCloseTo(layout.HEX_W + layout.PAD);
    expect(c0.cy).toBeCloseTo(c1.cy);
  });

  it('hexCenter: 홀수 행은 가로 오프셋 적용', () => {
    const layout = createHexLayout(44);
    const even = layout.hexCenter(0, 0);
    const odd = layout.hexCenter(1, 0);
    expect(odd.cx - even.cx).toBeCloseTo(layout.HEX_W / 2);
  });

  it('hexPoints: 정확히 6개 좌표 쌍 반환', () => {
    const layout = createHexLayout(44);
    const pts = layout.hexPoints(100, 100, 44);
    expect(pts.split(' ').length).toBe(6);
  });
});
