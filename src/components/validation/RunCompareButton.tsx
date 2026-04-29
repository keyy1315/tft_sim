'use client';
import type { ReactNode } from 'react';

interface Props {
  onClick: () => void;
  loading: boolean;
  children: ReactNode;
}

export default function RunCompareButton({ onClick, loading, children }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="px-3 py-1 rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm text-white"
    >
      {loading ? '실행 중... (약 30초)' : children}
    </button>
  );
}
