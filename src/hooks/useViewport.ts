export type Viewport = 'mobile' | 'tablet' | 'desktop';

export const VIEWPORT_MOBILE_MAX = 767;   // < 768
export const VIEWPORT_TABLET_MAX = 1023;  // < 1024

export function widthToViewport(width: number): Viewport {
  if (width <= VIEWPORT_MOBILE_MAX) return 'mobile';
  if (width <= VIEWPORT_TABLET_MAX) return 'tablet';
  return 'desktop';
}
