export type BottomSheetState = 'peek' | 'half' | 'full';

export const SHEET_PEEK_PX = 56;
export const SHEET_HALF_VH_RATIO = 0.42;
export const SHEET_FULL_VH_RATIO = 0.86;

/** 현재 state + 뷰포트 높이로 시트의 실제 픽셀 높이 계산 */
export function computeSheetHeightPx(state: BottomSheetState, vh: number): number {
  if (state === 'peek') return SHEET_PEEK_PX;
  if (state === 'half') return Math.round(vh * SHEET_HALF_VH_RATIO);
  return Math.round(vh * SHEET_FULL_VH_RATIO);
}

/** 드래그 중 시트 상단 Y 좌표를 가장 가까운 state 로 스냅 */
export function snapStateFromDragY(dragY: number, vh: number): BottomSheetState {
  const peekTop = vh - SHEET_PEEK_PX;
  const halfTop = vh - Math.round(vh * SHEET_HALF_VH_RATIO);
  const fullTop = vh - Math.round(vh * SHEET_FULL_VH_RATIO);

  const peekHalfMid = (peekTop + halfTop) / 2;
  const halfFullMid = (halfTop + fullTop) / 2;

  if (dragY > peekHalfMid) return 'peek';
  if (dragY > halfFullMid) return 'half';
  return 'full';
}
