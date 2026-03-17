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

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

export default function Tooltip({ content, children }: TooltipProps) {
  const hasHover = useSyncExternalStore(subscribeHover, getHasHover, () => true);
  const [show, setShow] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const handleEnter = useCallback(() => {
    if (ref.current) {
      setAnchor(ref.current.getBoundingClientRect());
    }
    setShow(true);
  }, []);

  const handleLeave = useCallback(() => {
    setShow(false);
  }, []);

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

  if (!hasHover) {
    return <>{children}</>;
  }

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      ref={ref}
    >
      {children}
      {show && anchor && createPortal(
        <div
          ref={positionRef}
          className="pointer-events-none"
        >
          <div className="tooltip-content text-sm" style={{ maxWidth: 320, whiteSpace: 'normal', wordBreak: 'keep-all' }}>
            {content}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
