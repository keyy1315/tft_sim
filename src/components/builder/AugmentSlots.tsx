'use client';

import Image from 'next/image';
import { RawAugment } from '@/types';
import { getAugmentImage, TIER_BORDER_COLORS } from '@/data/imageMap';
import { getAugmentTier, isStackable } from '@/lib/simulator/systems/augment';

interface AugmentSlotsProps {
  augments: RawAugment[];
  augmentStacks: Record<string, number>;
  onOpenSelector: () => void;
  onOpenDetail: (aug: RawAugment) => void;
  onRemove: (index: number) => void;
}

export default function AugmentSlots({ augments, augmentStacks, onOpenSelector, onOpenDetail, onRemove }: AugmentSlotsProps) {
  const slots = [0, 1, 2];

  return (
    <div className="flex gap-2">
      {slots.map((i) => {
        const aug = augments[i];
        if (!aug) {
          return (
            <button
              key={i}
              onClick={onOpenSelector}
              className="w-10 h-10 lg:w-14 lg:h-14 rounded-lg border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-500 hover:border-gray-400 hover:text-gray-300 transition-colors"
              title="증강 추가"
            >
              <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          );
        }

        const tier = getAugmentTier(aug);
        const stackableAug = isStackable(aug);
        const stacks = augmentStacks[aug.apiName] ?? 1;

        return (
          <div key={i} className="relative group">
            <button
              onClick={() => onOpenDetail(aug)}
              className={`w-10 h-10 lg:w-14 lg:h-14 rounded-lg border-2 ${TIER_BORDER_COLORS[tier]} overflow-hidden relative flex items-center justify-center`}
              title={aug.name}
            >
              <Image
                src={getAugmentImage(aug.icon)}
                alt={aug.name}
                className="w-full h-full object-contain"
                loading="lazy"
                width={56}
                height={56}
                unoptimized
              />
              {stackableAug && (
                <div className="absolute bottom-0 right-0 bg-black/80 text-[9px] text-yellow-400 px-1 rounded-tl">
                  x{stacks}
                </div>
              )}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(i); }}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity"
            >
              X
            </button>
          </div>
        );
      })}
    </div>
  );
}
