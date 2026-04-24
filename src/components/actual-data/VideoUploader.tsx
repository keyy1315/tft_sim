'use client';

import { useRef, useState } from 'react';
import { useActualDataStore } from '@/store/actualDataSlice';

const ACCEPT = 'video/mp4,video/webm';
const MAX_BYTES = 4 * 1024 * 1024 * 1024;

export default function VideoUploader() {
  const uploadVideo = useActualDataStore(s => s.uploadVideo);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (file.type !== 'video/mp4' && file.type !== 'video/webm') {
      setError(`지원하지 않는 형식입니다: ${file.type || '(unknown)'} — mp4 또는 webm만 가능합니다`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`파일이 너무 큽니다 (${formatSize(file.size)}) — 최대 ${formatSize(MAX_BYTES)}`);
      return;
    }
    setProgress(0);
    try {
      await uploadVideo(file, ratio => setProgress(ratio));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'upload failed');
      setProgress(null);
      return;
    }
    setProgress(null);
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void handleFile(file);
      }}
      className={[
        'flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-8 transition-colors',
        dragOver ? 'border-blue-400 bg-blue-500/10' : 'border-gray-600 bg-gray-900/40',
      ].join(' ')}
    >
      <p className="text-sm text-gray-300">
        영상 파일을 드롭하거나{' '}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="underline text-blue-300 hover:text-blue-200"
          disabled={progress !== null}
        >
          파일 선택
        </button>
      </p>
      <p className="text-xs text-gray-500">mp4 또는 webm · 최대 4GB</p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          e.target.value = ''; // allow re-selecting same file
          if (file) void handleFile(file);
        }}
      />

      {progress !== null && (
        <div className="w-full max-w-md mt-2">
          <div className="h-2 rounded bg-gray-700 overflow-hidden">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="mt-1 text-xs text-gray-400 text-center">{Math.round(progress * 100)}% 업로드 중…</p>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-400 text-center whitespace-pre-wrap break-all max-w-md">{error}</p>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
