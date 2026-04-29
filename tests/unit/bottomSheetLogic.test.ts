import { describe, it, expect } from 'vitest';
import {
  snapStateFromDragY,
  computeSheetHeightPx,
  SHEET_PEEK_PX,
  SHEET_HALF_VH_RATIO,
  SHEET_FULL_VH_RATIO,
} from '@/components/ui/bottomSheetLogic';

describe('computeSheetHeightPx', () => {
  it('peek 은 항상 56px', () => {
    expect(computeSheetHeightPx('peek', 800)).toBe(SHEET_PEEK_PX);
    expect(computeSheetHeightPx('peek', 400)).toBe(SHEET_PEEK_PX);
  });

  it('half 은 vh * SHEET_HALF_VH_RATIO', () => {
    expect(computeSheetHeightPx('half', 1000)).toBe(Math.round(1000 * SHEET_HALF_VH_RATIO));
    expect(computeSheetHeightPx('half', 800)).toBe(Math.round(800 * SHEET_HALF_VH_RATIO));
  });

  it('full 은 vh * SHEET_FULL_VH_RATIO', () => {
    expect(computeSheetHeightPx('full', 1000)).toBe(Math.round(1000 * SHEET_FULL_VH_RATIO));
  });

  it('vh 가 작아도 peek 최소 높이 보장', () => {
    expect(computeSheetHeightPx('peek', 50)).toBe(SHEET_PEEK_PX);
  });
});

describe('snapStateFromDragY', () => {
  const vh = 1000;

  it('아주 아래 (peek 영역): peek', () => {
    expect(snapStateFromDragY(vh - SHEET_PEEK_PX, vh)).toBe('peek');
    expect(snapStateFromDragY(vh - 100, vh)).toBe('peek');
  });

  it('중간 (half 영역): half', () => {
    const halfTop = vh - Math.round(vh * SHEET_HALF_VH_RATIO);
    expect(snapStateFromDragY(halfTop, vh)).toBe('half');
    expect(snapStateFromDragY(halfTop - 50, vh)).toBe('half');
  });

  it('위쪽 (full 영역): full', () => {
    const fullTop = vh - Math.round(vh * SHEET_FULL_VH_RATIO);
    expect(snapStateFromDragY(fullTop, vh)).toBe('full');
    expect(snapStateFromDragY(0, vh)).toBe('full');
  });

  it('경계 스냅은 중간 임계값 기준', () => {
    const halfTop = vh - Math.round(vh * SHEET_HALF_VH_RATIO);
    const peekTop = vh - SHEET_PEEK_PX;
    const mid = Math.round((halfTop + peekTop) / 2);
    expect(snapStateFromDragY(mid + 20, vh)).toBe('peek');
    expect(snapStateFromDragY(mid - 20, vh)).toBe('half');
  });
});
