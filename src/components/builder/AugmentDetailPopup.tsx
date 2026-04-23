'use client';

import { RawAugment } from '@/types';
import { TIER_BORDER_COLORS } from '@/data/imageMap';
import { getAugmentTier, isStackable, getMaxStacks } from '@/lib/simulator/systems/augment';
import { CARRY_AUGMENTS } from '@/data/carryAugments';
import Modal from '@/components/ui/Modal';
import AugmentIcon from './AugmentIcon';

interface AugmentDetailPopupProps {
  augment: RawAugment | null;
  stacks: number;
  onStacksChange: (count: number) => void;
  onClose: () => void;
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function formatDesc(desc: string, effects: Record<string, number>): string {
  let result = stripHtmlTags(desc);
  for (const [key, val] of Object.entries(effects)) {
    if (val == null) continue;
    result = result.replace(new RegExp(`@${key}@`, 'g'), String(val));
  }
  return result;
}

export default function AugmentDetailPopup({ augment, stacks, onStacksChange, onClose }: AugmentDetailPopupProps) {
  if (!augment) return null;

  const tier = getAugmentTier(augment);
  const stackable = isStackable(augment);
  const maxStacks = stackable ? getMaxStacks(augment) : 1;
  const desc = formatDesc(augment.desc, augment.effects);

  const tierLabel = tier === 'silver' ? '실버' : tier === 'gold' ? '골드' : '프리즘';

  return (
    <Modal isOpen={!!augment} onClose={onClose} title="증강 상세">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-lg border-2 ${TIER_BORDER_COLORS[tier]} overflow-hidden shrink-0 flex items-center justify-center`}>
            <AugmentIcon
              key={augment.icon}
              icon={augment.icon}
              alt={augment.name}
              className="w-full h-full object-contain"
              width={64}
              height={64}
            />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-100">{augment.name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded ${
              tier === 'silver' ? 'bg-gray-600 text-gray-200' :
              tier === 'gold' ? 'bg-yellow-700 text-yellow-200' :
              'bg-fuchsia-700 text-fuchsia-200'
            }`}>
              {tierLabel}
            </span>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-300 leading-relaxed">{desc}</p>

        {/* Carry augment scaling input */}
        {(() => {
          const carry = CARRY_AUGMENTS.find(ca => ca.augmentApiName === augment.apiName);
          if (!carry?.scalingInput) return null;
          const si = carry.scalingInput;
          // Reuse stacks mechanism for carry scaling
          return (
            <div className="bg-[#1f2937] rounded-lg p-4 space-y-3">
              <div className="text-sm font-medium text-gray-200">{si.label}</div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onStacksChange(Math.max(0, stacks - 1))}
                  disabled={stacks <= 0}
                  className="w-8 h-8 rounded-lg bg-[#374151] text-gray-300 hover:bg-[#4b5563] disabled:opacity-30 font-bold"
                >-</button>
                <span className="text-xl font-bold text-yellow-400 w-12 text-center">{stacks}</span>
                <button
                  onClick={() => onStacksChange(Math.min(si.max, stacks + 1))}
                  disabled={stacks >= si.max}
                  className="w-8 h-8 rounded-lg bg-[#374151] text-gray-300 hover:bg-[#4b5563] disabled:opacity-30 font-bold"
                >+</button>
                <span className="text-xs text-gray-500">{si.unit} (최대 {si.max})</span>
              </div>
              <div className="text-xs text-cyan-400">
                {si.effectPerStack} x {stacks} = {si.effectPerStack.replace(/\d+/, String(parseInt(si.effectPerStack.match(/\d+/)?.[0] ?? '0') * stacks))}
              </div>
            </div>
          );
        })()}

        {/* Stack selector */}
        {stackable && (
          <div className="bg-[#1f2937] rounded-lg p-4 space-y-3">
            <div className="text-sm font-medium text-gray-200">중첩 스택 수</div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onStacksChange(Math.max(1, stacks - 1))}
                disabled={stacks <= 1}
                className="w-8 h-8 rounded-lg bg-[#374151] text-gray-300 hover:bg-[#4b5563] disabled:opacity-30 font-bold"
              >
                -
              </button>
              <span className="text-xl font-bold text-yellow-400 w-12 text-center">{stacks}</span>
              <button
                onClick={() => onStacksChange(Math.min(maxStacks, stacks + 1))}
                disabled={stacks >= maxStacks}
                className="w-8 h-8 rounded-lg bg-[#374151] text-gray-300 hover:bg-[#4b5563] disabled:opacity-30 font-bold"
              >
                +
              </button>
              <span className="text-xs text-gray-500">/ 최대 {maxStacks}</span>
            </div>

            {/* Stack effect preview */}
            <div className="space-y-1 text-xs text-gray-400">
              {augment.effects.Stats != null && (
                <div>
                  AD/AP: <span className="text-green-400">+{augment.effects.Stats}%</span>
                  {' x '}{stacks}{' = '}
                  <span className="text-green-300 font-bold">+{augment.effects.Stats * stacks}%</span>
                </div>
              )}
              {augment.effects.HPBonus != null && (
                <div>
                  HP: <span className="text-green-400">+{augment.effects.HPBonus}</span>
                  {' x '}{stacks}{' = '}
                  <span className="text-green-300 font-bold">+{augment.effects.HPBonus * stacks}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
