import type { Metadata } from 'next';
import { Suspense } from 'react';
import NavHeader from '@/components/ui/NavHeader';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'TFT 시뮬레이터',
  description: 'TFT 데미지 계산기, 전투 시뮬레이션',
  applicationName: 'TFT Simulator',
  verification: {
    google: 'NPET5rApTEI6h8DEKsJSMMYm4CDmUMV-LrINNcEqmxs',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8386592405127971"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen">
        <nav className="sticky top-0 z-40 bg-[#0a0e1a]/90 backdrop-blur border-b border-gray-800">
          <Suspense fallback={<div className="h-12 lg:h-14" />}>
            <NavHeader />
          </Suspense>
        </nav>
        <main className="max-w-7xl mx-auto px-2 py-3 lg:px-4 lg:py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
