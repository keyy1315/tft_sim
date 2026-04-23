'use client';
import { useEffect } from 'react';
import { useActualDataStore } from '@/store/actualDataSlice';

const AUTO_SAVE_MS = 30_000;

export default function SaveStatusBar() {
  const status = useActualDataStore(s => s.saveStatus);
  const lastSavedAt = useActualDataStore(s => s.lastSavedAt);
  const isDirty = useActualDataStore(s => s.isDirty);
  const saveError = useActualDataStore(s => s.saveError);
  const save = useActualDataStore(s => s.saveCurrentGame);

  // 30s autosave when dirty
  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => {
      save();
    }, AUTO_SAVE_MS);
    return () => clearTimeout(timer);
  }, [isDirty, save]);

  // beforeunload warning
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  let label: string;
  let color = 'text-gray-400';
  if (status === 'saving') {
    label = '저장 중...';
  } else if (status === 'saved') {
    label = '✓ 저장됨';
    color = 'text-green-400';
  } else if (status === 'error') {
    label = `⚠ ${saveError ?? '저장 실패'}`;
    color = 'text-red-400';
  } else if (isDirty) {
    label = '● 변경됨 (30초 후 자동 저장)';
    color = 'text-amber-300';
  } else {
    label = lastSavedAt ? `저장됨 ${new Date(lastSavedAt).toLocaleTimeString()}` : '';
  }

  return (
    <div className={`flex items-center gap-2 text-sm ${color}`}>
      <span>{label}</span>
      {(isDirty || status === 'error') && (
        <button
          onClick={() => save()}
          className="px-2 py-0.5 border border-gray-700 text-gray-200 hover:bg-gray-700 rounded text-xs"
        >
          {status === 'error' ? '재시도' : '지금 저장'}
        </button>
      )}
    </div>
  );
}
