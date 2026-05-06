'use client';

import { useSyncExternalStore } from 'react';

/**
 * 관리자 전용 진입점 게이팅 hook (React Compiler 친화 — useSyncExternalStore).
 *
 * 활성화: 브라우저 DevTools 콘솔에서
 *   localStorage.setItem('tft-admin', 'true')
 * 후 새로고침. 비활성화는 동일 키 'false' 또는 removeItem.
 *
 * SSR: getServerSnapshot 가 항상 false 반환 → 서버는 admin=false 로 HTML 생성.
 * 클라이언트 hydration 직후 localStorage 값 사용. React 가 mismatch 가
 * 아닌 정상 흐름으로 처리.
 *
 * 보안 한계: localStorage 는 client-side flag — 서버 API 가 별도 인증을
 * 요구하지 않으므로 직접 fetch 로는 데이터 접근 가능. 1인 분석 도구의
 * UI 게이팅 용도. 진짜 보안이 필요하면 서버 측 auth 도입 필요.
 */
const ADMIN_KEY = 'tft-admin';

function getClientSnapshot(): boolean {
  try {
    return typeof window !== 'undefined'
      && window.localStorage.getItem(ADMIN_KEY) === 'true';
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  // 같은 탭 내 다른 코드의 변경은 잡지 않지만 (storage 이벤트는 cross-tab 만 동작),
  // 콘솔에서 setItem 후 새로고침 시 page mount 에서 읽으면 됨. 충분.
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

export function useIsAdmin(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}

/**
 * 페이지 라우트 가드용 wrapper. SSR 시점 'denied' (admin=false 로 시작),
 * 클라이언트 hydration 후 localStorage 결과로 'allowed'/'denied' 확정.
 * pending 상태가 별도로 필요 없도록 단순화 — admin 의 짧은 flash 는 허용.
 */
export function useAdminGate(): 'allowed' | 'denied' {
  const isAdmin = useIsAdmin();
  return isAdmin ? 'allowed' : 'denied';
}
