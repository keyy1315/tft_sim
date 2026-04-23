'use client';
import { useState } from 'react';
import Image from 'next/image';
import type { AugmentId } from '@/lib/actualData/types';
import { useAugments } from '@/hooks/useGameData';
import { getAugmentImage } from '@/data/imageMap';
import AugmentPickerModal from './AugmentPickerModal';

type AugmentSlot = AugmentId | null | undefined;
type AugmentQuad = [AugmentSlot, AugmentSlot, AugmentSlot, AugmentSlot];

interface Props {
  augments: AugmentQuad;
  onChange: (augments: AugmentQuad) => void;
}

export default function AugmentSlotsQuad({ augments, onChange }: Props) {
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const { augments: catalog } = useAugments();

  const selectedApiNames = augments.filter((a): a is string => !!a);

  function handleSelect(slotIdx: number, apiName: string) {
    const next = [...augments] as AugmentQuad;
    next[slotIdx] = apiName;
    onChange(next);
  }

  function handleClear(slotIdx: number) {
    const next = [...augments] as AugmentQuad;
    next[slotIdx] = undefined;
    onChange(next);
  }

  return (
    <>
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => {
          const apiName = augments[i];
          const aug = apiName ? catalog.find(a => a.apiName === apiName) : undefined;
          const isGrace = i === 3;
          const borderClass = isGrace ? 'border-amber-500' : 'border-gray-700';
          const bgClass = isGrace ? 'bg-amber-900/20 hover:bg-amber-800/40' : 'bg-gray-900 hover:bg-gray-700';

          return (
            <div key={i} className="relative">
              <button
                type="button"
                onClick={() => setOpenSlot(i)}
                className={`flex items-center justify-center border ${borderClass} ${bgClass} rounded w-20 h-14 text-xs text-gray-100 overflow-hidden transition-colors`}
                title={aug?.name ?? (isGrace ? '은총 선택' : `증강 ${i + 1} 선택`)}
              >
                {aug ? (
                  <div className="flex flex-col items-center gap-0.5 w-full">
                    <Image
                      src={getAugmentImage(aug.icon)}
                      alt={aug.name}
                      width={28}
                      height={28}
                      className="object-contain rounded"
                      unoptimized
                    />
                    <span className="text-[9px] leading-tight line-clamp-1 w-full text-center px-0.5">
                      {aug.name}
                    </span>
                  </div>
                ) : (
                  <span className={`${isGrace ? 'text-amber-300' : 'text-gray-400'}`}>
                    {isGrace ? '+ 은총' : `+ 증강 ${i + 1}`}
                  </span>
                )}
              </button>
              {aug && (
                <button
                  type="button"
                  onClick={() => handleClear(i)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white rounded-full text-[10px] leading-none hover:bg-red-500"
                  title="제거"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {openSlot !== null && (
        <AugmentPickerModal
          isOpen
          onClose={() => setOpenSlot(null)}
          onSelect={aug => handleSelect(openSlot, aug.apiName)}
          selectedApiNames={selectedApiNames}
          title={openSlot === 3 ? '은총 선택' : `증강 ${openSlot + 1} 선택`}
        />
      )}
    </>
  );
}
