'use client';

import { useState } from 'react';
import GravesWeaponModal from '@/components/builder/GravesWeaponModal';
import { FACTORY_NEW_TREE } from '@/data/factoryNewTree';

/**
 * 단독 데모 페이지 — GravesWeaponModal 검증용.
 * PR #C 통합 전 컴포넌트 동작 sanity check.
 *
 * 접근: /dev/graves-modal (production build 시 일반 페이지처럼 노출됨 — 후속 PR
 * 에서 dev-only 라우팅으로 제한할지 결정).
 */
export default function GravesModalDevPage() {
  const [picks, setPicks] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const pickNames = picks
    .map((suffix) => FACTORY_NEW_TREE[suffix]?.name ?? suffix)
    .join(' → ');

  return (
    <main className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-100">
        GravesWeaponModal 데모
      </h1>
      <p className="text-sm text-gray-400 mb-6">
        그레이브즈 최신상 무기고 모달 단독 검증. picks 가 props 로 전달되어 라운드별
        옵션이 변하는지, 이전/닫기 동작이 올바른지 테스트.
      </p>

      <div className="space-y-4">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium"
          >
            모달 열기
          </button>
          <button
            type="button"
            onClick={() => setPicks([])}
            disabled={picks.length === 0}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            picks 리셋
          </button>
        </div>

        <div className="p-4 bg-gray-800 border border-gray-700 rounded">
          <div className="text-sm text-gray-400 mb-1">현재 상태:</div>
          <div className="text-gray-100">
            <span className="text-blue-400">picks.length</span> = {picks.length}
            <span className="ml-3 text-blue-400">round</span> = {picks.length + 1}
          </div>
          {picks.length > 0 && (
            <div className="mt-2 text-sm text-gray-300">
              <span className="text-gray-400">trace: </span>
              {pickNames}
            </div>
          )}
          <details className="mt-3 text-xs text-gray-500">
            <summary className="cursor-pointer hover:text-gray-300">raw picks JSON</summary>
            <pre className="mt-2 p-2 bg-gray-900 rounded overflow-auto">
              {JSON.stringify(picks, null, 2)}
            </pre>
          </details>
        </div>

        <div className="p-4 bg-gray-800/50 border border-gray-700/50 rounded text-xs text-gray-400">
          <div className="font-semibold mb-1 text-gray-300">동작 검증 시나리오</div>
          <ul className="list-disc pl-5 space-y-1">
            <li>모달 열기 → 라운드 1 (3 root frame 표시)</li>
            <li>맹공 프레임 클릭 → 라운드 2 (4 children 표시)</li>
            <li>긴급 보호막 클릭 → 라운드 3 (5 옵션: 긴급 보호막+ / 두꺼운 장갑판 + 맹공 sibling 3)</li>
            <li>두꺼운 장갑판 클릭 → 라운드 4 (7 옵션 — 두꺼운 장갑판 children + sibling pool)</li>
            <li>이전 버튼 → 한 단계 되돌리기</li>
            <li>닫기 (× / 외부 클릭) → picks 그대로 유지</li>
          </ul>
        </div>
      </div>

      <GravesWeaponModal
        isOpen={isOpen}
        picks={picks}
        onPicksChange={setPicks}
        onClose={() => setIsOpen(false)}
        unitLabel="데모 — 가상 그레이브즈 ★3"
      />
    </main>
  );
}
