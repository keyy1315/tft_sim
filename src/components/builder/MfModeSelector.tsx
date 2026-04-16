'use client';

import Image from 'next/image';
import { MfMode, MF_MODE_CONFIG } from '@/types';
import Modal from '@/components/ui/Modal';

interface MfModeSelectorProps {
  isOpen: boolean;
  onSelect: (mode: MfMode) => void;
  onClose?: () => void;
}

const MODES: MfMode[] = ['replicator', 'channeler', 'challenger'];

export default function MfModeSelector({ isOpen, onSelect, onClose }: MfModeSelectorProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose ?? (() => {})} title="미스 포츈 — 모드 선택">
      <div className="text-center text-sm text-gray-400 mb-4">
        미스 포츈의 모드를 선택하세요. 모드에 따라 특성과 스킬이 변경됩니다.
      </div>
      <div className="grid grid-cols-3 gap-3">
        {MODES.map(mode => {
          const cfg = MF_MODE_CONFIG[mode];
          return (
            <button
              key={mode}
              onClick={() => onSelect(mode)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-700 bg-gray-800/50 hover:bg-gray-700/80 hover:border-yellow-500 transition-all"
            >
              <Image
                src={cfg.icon}
                alt={cfg.name}
                width={48}
                height={48}
                className="rounded-lg"
                unoptimized
              />
              <span className="text-sm font-bold text-gray-200">{cfg.name}</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
