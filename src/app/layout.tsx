import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'TFT Set 16 시뮬레이터',
  description: 'TFT Set 16 데미지 계산기, 팀 빌더, 전투 시뮬레이션',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <nav className="sticky top-0 z-40 bg-[#0a0e1a]/90 backdrop-blur border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 text-lg font-bold">
              <span className="text-yellow-400">TFT</span>
              <span className="text-gray-300">Set 16</span>
              <span className="text-xs text-gray-500 font-normal ml-1">시뮬레이터</span>
            </a>
            <div className="flex gap-1">
              <a href="/builder/calculator" className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-[#1f2937] transition-colors">
                데미지 계산기
              </a>
              <a href="/builder/team-builder" className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-[#1f2937] transition-colors">
                팀 빌더
              </a>
              <a href="/simulator" className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-[#1f2937] transition-colors">
                전투 시뮬
              </a>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
