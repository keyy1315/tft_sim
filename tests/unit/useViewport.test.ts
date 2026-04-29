import { describe, it, expect } from 'vitest';
import { widthToViewport, VIEWPORT_MOBILE_MAX, VIEWPORT_TABLET_MAX } from '@/hooks/useViewport';

describe('widthToViewport', () => {
  it('<768: mobile', () => {
    expect(widthToViewport(0)).toBe('mobile');
    expect(widthToViewport(320)).toBe('mobile');
    expect(widthToViewport(767)).toBe('mobile');
  });

  it('768~1023: tablet', () => {
    expect(widthToViewport(768)).toBe('tablet');
    expect(widthToViewport(900)).toBe('tablet');
    expect(widthToViewport(1023)).toBe('tablet');
  });

  it('≥1024: desktop', () => {
    expect(widthToViewport(1024)).toBe('desktop');
    expect(widthToViewport(1920)).toBe('desktop');
  });

  it('breakpoint 상수 값 확인', () => {
    expect(VIEWPORT_MOBILE_MAX).toBe(767);
    expect(VIEWPORT_TABLET_MAX).toBe(1023);
  });
});
