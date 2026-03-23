'use client';

import { useState, useRef, useCallback, useSyncExternalStore, ReactNode } from 'react';
import { createPortal } from 'react-dom';

function getHasHover() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(hover: hover)').matches;
}

function subscribeHover(cb: () => void) {
  const mql = window.matchMedia('(hover: hover)');
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
}

const LONG_PRESS_MS = 500;

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  disabled?: boolean;
}

export default function Tooltip({ content, children, disabled }: TooltipProps) {
  const hasHover = useSyncExternalStore(subscribeHover, getHasHover, () => true);
  const [show, setShow] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateAnchor = useCallback(() => {
    if (ref.current) {
      setAnchor(ref.current.getBoundingClientRect());
    }
  }, []);

  // === PC: hover handlers ===
  const handleEnter = useCallback(() => {
    updateAnchor();
    setShow(true);
  }, [updateAnchor]);

  const handleLeave = useCallback(() => {
    setShow(false);
  }, []);

  // === Mobile: long-press handlers ===
  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchStart = useCallback(() => {
    cancelLongPress();
    longPressTimer.current = setTimeout(() => {
      updateAnchor();
      setShow(true);
      longPressTimer.current = null;
    }, LONG_PRESS_MS);
  }, [cancelLongPress, updateAnchor]);

  const handleTouchEnd = useCallback(() => {
    cancelLongPress();
    setShow(false);
  }, [cancelLongPress]);

  const handleTouchMove = useCallback(() => {
    cancelLongPress();
    setShow(false);
  }, [cancelLongPress]);

  // position: fixed 기반 — 먼저 visibility:hidden으로 마운트하여 크기 측정 후 위치 보정
  const positionRef = useCallback((el: HTMLDivElement | null) => {
    if (!el || !anchor) return;

    // 1단계: hidden 상태에서 크기 측정
    el.style.position = 'fixed';
    el.style.visibility = 'hidden';
    el.style.top = '0';
    el.style.left = '0';
    el.style.zIndex = '9999';

    const tt = el.getBoundingClientRect();
    const gap = 8;
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Vertical: prefer above, flip below if not enough space
    let top: number;
    if (anchor.top - tt.height - gap < 0) {
      top = anchor.bottom + gap;
    } else {
      top = anchor.top - tt.height - gap;
    }
    // Clamp vertical
    if (top + tt.height > vh - margin) top = vh - margin - tt.height;
    if (top < margin) top = margin;

    // Horizontal: center on anchor, clamp to viewport
    let left = anchor.left + anchor.width / 2 - tt.width / 2;
    if (left < margin) left = margin;
    if (left + tt.width > vw - margin) left = vw - margin - tt.width;

    // 2단계: 실제 위치 적용 + 보이기
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
    el.style.visibility = 'visible';
  }, [anchor]);

  const visible = show && !disabled && anchor;

  const tooltip = visible ? createPortal(
    <div
      ref={positionRef}
      className="pointer-events-none"
    >
      <div className="tooltip-content text-sm" style={{ maxWidth: 320, whiteSpace: 'normal', wordBreak: 'keep-all' }}>
        {content}
      </div>
    </div>,
    document.body,
  ) : null;

  // pointerDown 시 툴팁 숨김 — 드래그 시작 시 즉시 사라지게 함
  const handlePointerDown = useCallback(() => {
    setShow(false);
  }, []);

  // Mobile: long-press 지원 (hover 불가 기기)
  if (!hasHover) {
    return (
      <div
        className="relative inline-block"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        ref={ref}
      >
        {children}
        {tooltip}
      </div>
    );
  }

  // PC: hover 지원
  return (
    <div
      className="relative inline-block"
      onMouseEnter={disabled ? undefined : handleEnter}
      onMouseLeave={handleLeave}
      onPointerDown={handlePointerDown}
      ref={ref}
    >
      {children}
      {tooltip}
    </div>
  );
}
