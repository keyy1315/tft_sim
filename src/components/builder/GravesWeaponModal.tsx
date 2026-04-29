'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useItems } from '@/hooks/useGameData';
import { getItemImage } from '@/data/imageMap';
import {
  FACTORY_NEW_TREE,
  getNextOptions,
  suffixToApiName,
  apiNameToSuffix,
  type FactoryNode,
} from '@/data/factoryNewTree';
import type { RawItem } from '@/types';

interface GravesWeaponModalProps {
  isOpen: boolean;
  picks: string[];
  onPicksChange: (picks: string[]) => void;
  onClose: () => void;
  /** 모달 헤더 라벨 — 어느 그레이브즈 unit 인지 표시 (선택). 예: 'A 팀 ★3' */
  unitLabel?: string;
}

/**
 * 그레이브즈 최신상 무기고 선택 모달.
 *
 * 동작:
 *   - 라운드별 옵션 카드 표시 (Round 1: 3 root / Round 2+: 가변 N개)
 *   - 카드 클릭 → onPicksChange([...picks, suffix])
 *   - "이전" 버튼 → onPicksChange(picks.slice(0, -1)) — 한 단계만 되돌리기
 *   - "닫기" → onClose() (picks 그대로 유지, 호출자가 store 에 저장)
 *   - 카드 hover → desc tooltip
 *
 * 인게임과 다르게 모든 옵션 표시 (라운드 4 카드 제한 없음).
 */
export default function GravesWeaponModal({
  isOpen,
  picks,
  onPicksChange,
  onClose,
  unitLabel,
}: GravesWeaponModalProps) {
  const { items, loading } = useItems();
  const [hoveredSuffix, setHoveredSuffix] = useState<string | null>(null);

  // suffix → RawItem lookup (icon / desc / effects 표시용)
  const itemBySuffix = useMemo(() => {
    const map = new Map<string, RawItem>();
    for (const item of items) {
      const suffix = apiNameToSuffix(item.apiName);
      if (suffix) map.set(suffix, item);
    }
    return map;
  }, [items]);

  if (!isOpen) return null;

  const round = picks.length + 1;
  const options = getNextOptions(picks);
  const canGoBack = picks.length > 0;

  function handlePick(suffix: string) {
    onPicksChange([...picks, suffix]);
  }

  function handleBack() {
    if (canGoBack) onPicksChange(picks.slice(0, -1));
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="그레이브즈 무기고 선택"
      // 모바일 BottomSheet (z-index 2147483646) 위로 띄우기 위해 명시적으로 더 높게.
      style={{ zIndex: 2147483647 }}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-5 max-w-5xl w-[90vw] max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-100">
              그레이브즈 무기고 <span className="text-blue-400">— 라운드 {round}</span>
            </h2>
            {unitLabel && <div className="text-xs text-gray-400 mt-1">{unitLabel}</div>}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-2xl leading-none px-2"
            aria-label="모달 닫기"
          >
            ×
          </button>
        </div>

        {/* History strip */}
        {picks.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 px-3 py-2 bg-gray-800/50 rounded">
            <span className="text-xs text-gray-400">선택 history:</span>
            {picks.map((suffix, idx) => {
              const node = FACTORY_NEW_TREE[suffix];
              return (
                <span key={`${suffix}-${idx}`} className="flex items-center gap-1">
                  {idx > 0 && <span className="text-gray-600">→</span>}
                  <span className="px-2 py-1 text-xs bg-blue-900/40 border border-blue-700/40 text-blue-200 rounded">
                    {node?.name ?? suffix}
                  </span>
                </span>
              );
            })}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="text-gray-400 py-8 text-center">아이템 데이터 로드 중...</div>
        )}

        {/* Options grid */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-4">
            {options.map((suffix) => {
              const node = FACTORY_NEW_TREE[suffix];
              const item = itemBySuffix.get(suffix);
              const iconUrl = item ? getItemImage(item.apiName) : null;
              const desc = item?.desc ?? '';
              const isHovered = hoveredSuffix === suffix;
              return (
                <button
                  key={suffix}
                  type="button"
                  onClick={() => handlePick(suffix)}
                  onMouseEnter={() => setHoveredSuffix(suffix)}
                  onMouseLeave={() => setHoveredSuffix(null)}
                  className={`relative flex flex-col items-center gap-2 p-3 rounded-lg border transition-all
                    ${isHovered
                      ? 'bg-gray-700 border-blue-500 scale-[1.03] shadow-lg'
                      : 'bg-gray-800 border-gray-700 hover:bg-gray-750 hover:border-gray-600'}`}
                  aria-label={`${node?.name ?? suffix} 선택`}
                  data-suffix={suffix}
                >
                  {iconUrl ? (
                    <Image
                      src={iconUrl}
                      alt={node?.name ?? suffix}
                      width={56}
                      height={56}
                      className="rounded"
                      unoptimized
                    />
                  ) : (
                    <div className="w-14 h-14 bg-gray-700 rounded" aria-hidden="true" />
                  )}
                  <div className="text-sm font-medium text-gray-100 text-center min-h-[2.5em] leading-tight">
                    {node?.name ?? suffix}
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-yellow-400">●</span>
                    <span className="text-gray-300">{node?.cost ?? 0}</span>
                  </div>

                  {/* hover tooltip */}
                  {isHovered && desc && (
                    <div
                      className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-black/95 border border-gray-600 rounded text-xs text-gray-200 shadow-xl pointer-events-none"
                      role="tooltip"
                    >
                      {desc}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && options.length === 0 && (
          <div className="py-8 text-center text-gray-400">
            더 이상 선택 가능한 무기가 없습니다.
            <div className="mt-2 text-xs">현재 picks: {picks.length}개</div>
          </div>
        )}

        {/* Footer — 이전 / 도움말 */}
        <div className="flex justify-between items-center pt-3 border-t border-gray-700">
          <button
            type="button"
            onClick={handleBack}
            disabled={!canGoBack}
            className={`px-3 py-1.5 text-sm rounded border transition-colors
              ${canGoBack
                ? 'bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700 hover:border-gray-500'
                : 'bg-gray-800/50 border-gray-700 text-gray-500 cursor-not-allowed'}`}
            aria-label="이전 라운드로 돌아가기"
          >
            ← 이전
          </button>
          <div className="text-xs text-gray-500">
            라운드 {round} · {options.length}개 옵션 · 닫기 시 자동 저장
          </div>
        </div>
      </div>
    </div>
  );
}

/** Lookup helper — picks 가 변경됐을 때 시뮬에 전달할 raw upgrade ID 배열. */
export function picksToUpgradeIds(picks: string[]): string[] {
  // 현재 PR #46 의 simulateCombat 옵션 playerGravesUpgrades 와 동일 — suffix array.
  return picks.filter((p) => FACTORY_NEW_TREE[p] !== undefined);
}

/** picks 의 첫 번째 root 가 frame 으로 매핑 — playerGravesFrame 옵션용. */
export function picksToFrame(
  picks: string[],
): 'CloseQuarters' | 'SharpshooterModule' | 'DoubleTap' | undefined {
  const first = picks[0];
  if (first === 'CloseQuarters' || first === 'SharpshooterModule' || first === 'DoubleTap') {
    return first;
  }
  return undefined;
}

// Re-export for convenience
export { suffixToApiName };
export type { FactoryNode };
