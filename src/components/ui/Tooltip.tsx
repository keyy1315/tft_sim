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
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const handleEnter = useCallback(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({
        top: rect.top + window.scrollY,
        left: rect.left + rect.width / 2 + window.scrollX,
      });
    }
    setShow(true);
  }, []);

  const handleLeave = useCallback(() => {
    setShow(false);
  }, []);

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
      {show && pos && createPortal(
        <div
          className="pointer-events-none"
          style={{
            position: 'absolute',
            top: pos.top,
            left: pos.left,
            transform: 'translate(-50%, -100%)',
            marginTop: -8,
            zIndex: 9999,
          }}
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
