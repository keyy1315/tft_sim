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

function clampToViewport(tooltipEl: HTMLDivElement, anchorRect: DOMRect): React.CSSProperties {
  const tt = tooltipEl.getBoundingClientRect();
  const gap = 8;
  const margin = 8;

  // Vertical: prefer above, flip below if not enough space
  let top: number;
  if (anchorRect.top - tt.height - gap < 0) {
    top = anchorRect.bottom + window.scrollY + gap;
  } else {
    top = anchorRect.top + window.scrollY - tt.height - gap;
  }

  // Horizontal: center on anchor, clamp to viewport
  let left = anchorRect.left + anchorRect.width / 2 + window.scrollX - tt.width / 2;
  if (left < margin) left = margin;
  if (left + tt.width > window.innerWidth - margin) {
    left = window.innerWidth - margin - tt.width;
  }

  return { position: 'absolute', top, left, zIndex: 9999 };
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

  // Use ref callback to position tooltip after mount (no setState in effect)
  const positionRef = useCallback((el: HTMLDivElement | null) => {
    if (!el || !anchor) return;
    const style = clampToViewport(el, anchor);
    Object.assign(el.style, {
      position: style.position,
      top: `${style.top}px`,
      left: `${style.left}px`,
      zIndex: String(style.zIndex),
    });
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
