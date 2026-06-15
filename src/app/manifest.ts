import type { MetadataRoute } from 'next';

/**
 * PWA 매니페스트 — Next.js 가 /manifest.webmanifest 로 생성하고 <link> 자동 삽입.
 * "홈 화면에 추가" 시 펭귄 왕관 아이콘 사용 (192/512).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TFT 시뮬레이터',
    short_name: 'TFT Sim',
    description: 'TFT 전투 시뮬레이션',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0e1a',
    theme_color: '#0a0e1a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
