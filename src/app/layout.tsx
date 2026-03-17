import type { Metadata } from 'next';
import Link from 'next/link';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'TFT Set 16 시뮬레이터',
  description: 'TFT Set 16 데미지 계산기, 전투 시뮬레이션',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <nav className="sticky top-0 z-40 bg-[#0a0e1a]/90 backdrop-blur border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-2 lg:px-4 h-12 lg:h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-1.5 lg:gap-2 text-base lg:text-lg font-bold">
              <span className="text-yellow-400">TFT</span>
              <span className="text-gray-300">Set 16</span>
              <span className="text-xs text-gray-500 font-normal ml-1 hidden sm:inline">시뮬레이터</span>
            </Link>
            <div className="flex gap-1">
              <Link href="/builder/calculator" className="px-2 py-1.5 lg:px-4 lg:py-2 rounded-lg text-xs lg:text-sm text-gray-300 hover:text-white hover:bg-[#1f2937] transition-colors">
                계산기
              </Link>
              <Link href="/simulator" className="px-2 py-1.5 lg:px-4 lg:py-2 rounded-lg text-xs lg:text-sm text-gray-300 hover:text-white hover:bg-[#1f2937] transition-colors">
                전투 시뮬
              </Link>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-2 py-3 lg:px-4 lg:py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
