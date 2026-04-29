'use client';

import { createContext, useContext } from 'react';

export type VideoPlayerApi = {
  /** 현재 영상 시각(초). 영상이 없으면 null. */
  getCurrentTime: () => number | null;
  /** 영상 시각을 지정된 초로 이동하고 포커스 (영상 없으면 no-op). */
  seekTo: (seconds: number) => void;
  /** 영상 재생 준비 여부 (metadata loaded). */
  isReady: () => boolean;
};

const noopApi: VideoPlayerApi = {
  getCurrentTime: () => null,
  seekTo: () => {},
  isReady: () => false,
};

export const VideoPlayerContext = createContext<VideoPlayerApi>(noopApi);

export function useVideoPlayer(): VideoPlayerApi {
  return useContext(VideoPlayerContext);
}
