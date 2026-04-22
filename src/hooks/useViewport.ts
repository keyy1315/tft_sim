import { useSyncExternalStore } from 'react';

export type Viewport = 'mobile' | 'tablet' | 'desktop';

export const VIEWPORT_MOBILE_MAX = 767;   // < 768
export const VIEWPORT_TABLET_MAX = 1023;  // < 1024

export function widthToViewport(width: number): Viewport {
  if (width <= VIEWPORT_MOBILE_MAX) return 'mobile';
  if (width <= VIEWPORT_TABLET_MAX) return 'tablet';
  return 'desktop';
}

/**
 * 현재 뷰포트 breakpoint 를 반환. SSR 에서는 'desktop' 기본.
 *
 * useSyncExternalStore 로 matchMedia 를 구독 — React Compiler 안전
 * (useEffect + setState 패턴 회피).
 */
export function useViewport(): Viewport {
  const subscribe = (onChange: () => void): (() => void) => {
    if (typeof window === 'undefined') return () => {};
    const handler = () => onChange();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  };

  const getSnapshot = (): Viewport => {
    if (typeof window === 'undefined') return 'desktop';
    return widthToViewport(window.innerWidth);
  };

  const getServerSnapshot = (): Viewport => 'desktop';

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
