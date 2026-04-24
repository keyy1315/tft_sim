'use client';

import { useMemo, useRef, useState } from 'react';
import { useActualDataStore } from '@/store/actualDataSlice';
import { VideoPlayerContext, type VideoPlayerApi } from './videoPlayerContext';

type Props = {
  children?: React.ReactNode;
};

/**
 * 업로드된 영상을 재생하는 `<video>` 플레이어.
 * 자식 컴포넌트들은 VideoPlayerContext로 현재 시각/seek API에 접근할 수 있다.
 *
 * 주의: videoSource.kind === 'local' 일 때만 렌더하며, 상위 컴포넌트가 조건 분기한다.
 */
export default function VideoPlayerShell({ children }: Props) {
  const videoSource = useActualDataStore(s => s.currentGame?.videoSource ?? null);
  const deleteVideo = useActualDataStore(s => s.deleteVideo);
  const reportVideoDuration = useActualDataStore(s => s.reportVideoDuration);
  const gameId = useActualDataStore(s => s.currentGame?.gameId ?? null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  // readyState 변경은 DOM 이벤트로만 감지되므로 React 재렌더를 위해 state로 끌어올린다.
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const api = useMemo<VideoPlayerApi>(() => ({
    getCurrentTime: () => videoRef.current?.currentTime ?? null,
    seekTo: (seconds) => {
      const el = videoRef.current;
      if (!el) return;
      el.currentTime = Math.max(0, seconds);
      el.focus({ preventScroll: true });
    },
    isReady: () => metaLoaded && videoRef.current !== null,
  }), [metaLoaded]);

  if (!gameId || !videoSource || videoSource.kind !== 'local') {
    return (
      <VideoPlayerContext.Provider value={api}>
        <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
      </VideoPlayerContext.Provider>
    );
  }

  const videoUrl = `/api/actual-data/${gameId}/video`;

  async function handleDelete() {
    if (!window.confirm('업로드된 영상을 삭제하시겠어요? 다시 업로드하려면 파일을 다시 선택해야 합니다.')) return;
    try {
      await deleteVideo();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '삭제 실패');
    }
  }

  function handleLoadedMetadata() {
    const el = videoRef.current;
    if (!el) return;
    setMetaLoaded(true);
    const duration = Number.isFinite(el.duration) ? el.duration : null;
    if (duration !== null) {
      // server was unable to probe (ffprobe missing) → report from client
      void reportVideoDuration(duration);
    }
  }

  function handleEmptied() {
    setMetaLoaded(false);
  }

  const duration = videoSource.durationSeconds;

  return (
    <VideoPlayerContext.Provider value={api}>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0 border-b border-gray-700 bg-black">
          <video
            key={videoSource.filename}
            ref={videoRef}
            src={videoUrl}
            controls
            preload="metadata"
            className={`w-full max-h-[45vh] bg-black ${collapsed ? 'hidden' : ''}`}
            onLoadedMetadata={handleLoadedMetadata}
            onEmptied={handleEmptied}
          />
          <div className="flex items-center justify-between gap-2 px-2 py-1 text-xs text-gray-400 bg-gray-900/60">
            <span className="truncate">
              {videoSource.filename} · {formatSize(videoSource.sizeBytes)}
              {duration !== null ? ` · ${formatDuration(duration)}` : ''}
            </span>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setCollapsed(c => !c)}
                className="text-gray-300 hover:text-gray-100 hover:underline"
                title={collapsed ? '영상 영역 펼치기' : '영상 영역 접기'}
              >
                {collapsed ? '▼ 펼치기' : '▲ 접기'}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="text-red-400 hover:text-red-300 hover:underline"
              >
                영상 삭제
              </button>
            </div>
          </div>
        </div>
        {children}
      </div>
    </VideoPlayerContext.Provider>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}
