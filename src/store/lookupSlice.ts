import { create } from 'zustand';
import type { LookupResult } from '@/types/lookup';

/**
 * 전적검색 페이지의 검색어 / 시즌 탭 / 응답 결과를 in-memory 로 관리.
 * persist 미사용 — 페이지 이동/복귀 시 유지하되 브라우저 F5 시 초기화.
 * 거대한 `result`(메타데이터 포함)를 직렬화하지 않아 렌더 성능상 유리.
 */
interface LookupState {
  input: string;
  activeSet: string;
  result: LookupResult | null;
  setInput: (value: string) => void;
  setActiveSet: (setId: string) => void;
  setResult: (result: LookupResult | null) => void;
  reset: () => void;
}

export const useLookupStore = create<LookupState>((set) => ({
  input: '',
  activeSet: 'set17',
  result: null,
  setInput: (input) => set({ input }),
  setActiveSet: (activeSet) => set({ activeSet }),
  setResult: (result) => set({ result }),
  reset: () => set({ input: '', activeSet: 'set17', result: null }),
}));
