'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import SetSelector from './SetSelector';
import { DEFAULT_SET, SET_CONFIGS } from '@/data/setConfig';
import type { SetId } from '@/data/setConfig';

export default function NavHeader() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawSet = searchParams.get('set') as SetId | null;
  const activeSet: SetId = rawSet && rawSet in SET_CONFIGS ? rawSet : DEFAULT_SET;
  const cfg = SET_CONFIGS[activeSet];

  const handleSetChange = (setId: SetId) => {
    const params = new URLSearchParams(searchParams.toString());
    if (setId === DEFAULT_SET) params.delete('set');
    else params.set('set', setId);
    const qs = params.toString();
    router.push(`${pathname}${qs ? '?' + qs : ''}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-2 lg:px-4 h-12 lg:h-14 flex items-center justify-between">
      <div className="flex items-center gap-2 lg:gap-3">
        <Link href="/" className="flex items-center gap-1.5 lg:gap-2 text-base lg:text-lg font-bold">
          <span className="text-yellow-400">TFT</span>
          <span className="text-gray-300">{cfg.label}</span>
          <span className="text-xs text-gray-500 font-normal ml-1 hidden sm:inline">시뮬레이터</span>
        </Link>
        <SetSelector activeSet={activeSet} onSetChange={handleSetChange} />
      </div>
      <div className="flex gap-1">
        {cfg.status !== 'pbe' && (
          <Link href="/builder/calculator" className="px-2 py-1.5 lg:px-4 lg:py-2 rounded-lg text-xs lg:text-sm text-gray-300 hover:text-white hover:bg-[#1f2937] transition-colors">
            계산기
          </Link>
        )}
        <Link
          href={cfg.status === 'pbe' ? `/simulator?set=${activeSet}` : '/simulator'}
          className="px-2 py-1.5 lg:px-4 lg:py-2 rounded-lg text-xs lg:text-sm text-gray-300 hover:text-white hover:bg-[#1f2937] transition-colors"
        >
          {cfg.status === 'pbe' ? '팀 빌더' : '전투 시뮬'}
        </Link>
        <Link
          href="/lookup"
          className="px-2 py-1.5 lg:px-4 lg:py-2 rounded-lg text-xs lg:text-sm text-gray-300 hover:text-white hover:bg-[#1f2937] transition-colors"
        >
          전적검색
        </Link>
      </div>
    </div>
  );
}
