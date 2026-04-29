'use client';

import { ReactNode, useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  BottomSheetState,
  computeSheetHeightPx,
  snapStateFromDragY,
  SHEET_PEEK_PX,
} from './bottomSheetLogic';

/**
 * visualViewport 우선 사용 — 가상 키보드가 뜨면 innerHeight 는 변하지 않지만
 * visualViewport.height 는 축소되므로 시트가 키보드 위에 올바르게 포지셔닝됨.
 */
function getViewportHeight(): number {
  if (typeof window === 'undefined') return 800;
  return window.visualViewport?.height ?? window.innerHeight;
}

function subscribeViewportHeight(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => onChange();
  window.visualViewport?.addEventListener('resize', handler);
  window.addEventListener('resize', handler);
  return () => {
    window.visualViewport?.removeEventListener('resize', handler);
    window.removeEventListener('resize', handler);
  };
}

interface BottomSheetTab {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

interface BottomSheetProps {
  state: BottomSheetState;
  onStateChange: (s: BottomSheetState) => void;
  tabs: BottomSheetTab[];
  activeTabId: string;
  onTabChange: (id: string) => void;
}

/**
 * 3-state bottom drawer (peek / half / full).
 * 상단 핸들에서만 드래그 제스처 활성 — dnd-kit 과 간섭 없음.
 * CSS translateY 애니메이션 (60fps).
 */
export default function BottomSheet({
  state,
  onStateChange,
  tabs,
  activeTabId,
  onTabChange,
}: BottomSheetProps) {
  const [dragY, setDragY] = useState<number | null>(null);
  const startRef = useRef<{ clientY: number; baseHeight: number } | null>(null);

  const vh = useSyncExternalStore(subscribeViewportHeight, getViewportHeight, () => 800);
  const baseHeight = computeSheetHeightPx(state, vh);
  const height = dragY !== null ? Math.max(SHEET_PEEK_PX, vh - dragY) : baseHeight;

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      startRef.current = { clientY: e.clientY, baseHeight };
      setDragY(vh - baseHeight);
    },
    [baseHeight, vh],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startRef.current) return;
      const delta = e.clientY - startRef.current.clientY;
      const newHeight = startRef.current.baseHeight - delta;
      setDragY(vh - newHeight);
    },
    [vh],
  );

  const onPointerUp = useCallback(() => {
    if (dragY === null) return;
    const snapped = snapStateFromDragY(dragY, vh);
    setDragY(null);
    startRef.current = null;
    if (snapped !== state) onStateChange(snapped);
  }, [dragY, vh, state, onStateChange]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Backdrop — half/full 상태에서 시트 외부 클릭 시 peek 로 복귀 */}
      {state !== 'peek' && (
        <div
          onClick={() => onStateChange('peek')}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            zIndex: 2147483645,
            transition: 'opacity 200ms ease-out',
          }}
        />
      )}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height,
          transition: dragY === null ? 'height 200ms ease-out' : 'none',
          zIndex: 2147483646,
        }}
        className="bg-[#0d1117] border-t border-gray-700 rounded-t-xl shadow-2xl flex flex-col"
      >
      {/* 드래그 핸들 */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="flex-shrink-0 py-2 cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
      >
        <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto" />
      </div>

      {/* 탭 바 */}
      <div className="flex-shrink-0 flex border-b border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && onTabChange(tab.id)}
            disabled={tab.disabled}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              activeTabId === tab.id
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-gray-200'
            } ${tab.disabled ? 'opacity-30' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-auto p-3">
        {tabs.find((t) => t.id === activeTabId)?.content ?? null}
      </div>
      </div>
    </>,
    document.body,
  );
}
