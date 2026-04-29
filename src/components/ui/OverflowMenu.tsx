'use client';

import { ReactNode, useState, useRef, useEffect } from 'react';

interface OverflowMenuItem {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

interface OverflowMenuProps {
  items: OverflowMenuItem[];
  children?: ReactNode; // Stage select 등 커스텀 컨트롤 슬롯
  ariaLabel?: string;
}

/**
 * ⋯ 드롭다운. 외부 클릭 시 자동 닫힘.
 * useEffect + setState 패턴이지만 open 상태는 이벤트 driven 이라 React Compiler 규칙과 무관.
 */
export default function OverflowMenu({ items, children, ariaLabel = 'more options' }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className="px-2 py-1.5 bg-[#1f2937] text-gray-400 hover:text-gray-200 rounded-lg text-sm"
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 min-w-[180px] bg-[#1a1f2e] border border-gray-700 rounded-lg shadow-xl z-50">
          {children && <div className="p-2 border-b border-gray-800">{children}</div>}
          <div className="py-1">
            {items.map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (item.disabled) return;
                  item.onClick();
                  setOpen(false);
                }}
                disabled={item.disabled}
                className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                  item.active ? 'text-blue-400' : 'text-gray-300'
                } hover:bg-[#1f2937] ${item.disabled ? 'opacity-40' : ''}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
