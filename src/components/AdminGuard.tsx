'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useAdminGate } from '@/hooks/useIsAdmin';

/**
 * 관리자 전용 페이지 라우트 가드.
 * - 'pending' (로딩): 빈 영역 (SSR 후 짧은 hydration 지연 — flash 회피)
 * - 'allowed': children 렌더
 * - 'denied': 접근 거부 UI + 홈 복귀 링크
 *
 * 비-관리자 직접 URL 진입 (예: /actual-data) 차단.
 */
export default function AdminGuard({ children }: { children: ReactNode }) {
  const gate = useAdminGate();

  if (gate === 'denied') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-gray-300 gap-4">
        <div className="text-5xl">🔒</div>
        <h1 className="text-2xl font-bold">접근 권한 없음</h1>
        <p className="text-sm text-gray-400 text-center max-w-md">
          관리자 전용 페이지입니다. 활성화하려면 DevTools 콘솔에서<br />
          <code className="px-2 py-1 mt-2 inline-block bg-gray-800 border border-gray-700 rounded text-xs text-gray-200">
            localStorage.setItem(&apos;tft-admin&apos;, &apos;true&apos;)
          </code>
          <br />입력 후 새로고침.
        </p>
        <Link
          href="/"
          className="px-3 py-1.5 border border-gray-700 text-gray-200 hover:bg-gray-700 rounded text-sm"
        >
          ← 홈으로
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
