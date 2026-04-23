'use client';
import { useAugments } from '@/hooks/useGameData';
import AugmentSelector from '@/components/builder/AugmentSelector';
import type { RawAugment, AugmentTier } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (aug: RawAugment) => void;
  selectedApiNames: string[];
  title?: string;
  /** 모달 open 시 기본 필터 티어 (예: 은총 슬롯 → 'boon'). */
  initialTierFilter?: AugmentTier | null;
}

export default function AugmentPickerModal({ isOpen, onClose, onSelect, selectedApiNames, title, initialTierFilter }: Props) {
  const { augments, loading } = useAugments();
  if (!isOpen) return null;

  function handleSelect(aug: RawAugment) {
    onSelect(aug);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4 max-w-4xl w-full max-h-[85vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold text-gray-100">{title ?? '증강 선택'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-xl leading-none">×</button>
        </div>
        {loading ? (
          <div className="text-gray-400 py-8 text-center">증강 데이터 로드 중...</div>
        ) : (
          <AugmentSelector
            augments={augments}
            onSelect={handleSelect}
            selectedApiNames={selectedApiNames}
            initialTierFilter={initialTierFilter}
          />
        )}
      </div>
    </div>
  );
}
