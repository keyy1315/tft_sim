'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useActiveSet } from '@/hooks/useActiveSet';
import { SET_CONFIGS } from '@/data/setConfig';

export default function HomePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[70vh] text-gray-500">로딩 중...</div>}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const activeSet = useActiveSet();
  const cfg = SET_CONFIGS[activeSet];
  const isPbe = cfg.status === 'pbe';

  const features = isPbe
    ? [
        {
          title: '팀 빌더',
          desc: `${cfg.name} 챔피언 배치 및 시너지 확인 (스탯 데이터 대기 중)`,
          href: `/simulator?set=${activeSet}`,
          icon: '🛠️',
          color: 'from-purple-600/20 to-blue-600/20',
          borderColor: 'border-purple-500/30',
          disabled: false,
        },
        {
          title: '전투 시뮬레이션',
          desc: 'PBE 데이터 업데이트 후 사용 가능',
          href: '#',
          icon: '⚡',
          color: 'from-gray-700/20 to-gray-600/20',
          borderColor: 'border-gray-700/30',
          disabled: true,
        },
      ]
    : [
        {
          title: '전투 시뮬레이션',
          desc: '아군 vs 적군 자동 전투, 이동/사거리 시스템, 턴별 로그',
          href: '/simulator',
          icon: '⚡',
          color: 'from-yellow-600/20 to-amber-600/20',
          borderColor: 'border-yellow-500/30',
          disabled: false,
        },
        {
          title: '전적검색',
          desc: '소환사명으로 최근 TFT 매치 기록 조회',
          href: '/lookup',
          icon: '🔍',
          color: 'from-emerald-600/20 to-teal-600/20',
          borderColor: 'border-emerald-500/30',
          disabled: false,
        },
        {
          title: '실측 데이터',
          desc: 'PvP 라운드별 팀·아이템 기록 → 시뮬 정확도 비교 (별돌보미·중재자 등 게임 메타 편집)',
          href: '/actual-data',
          icon: '📊',
          color: 'from-rose-600/20 to-pink-600/20',
          borderColor: 'border-rose-500/30',
          disabled: false,
        },
      ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh]">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-black mb-3">
          <span className="text-yellow-400">TFT</span>{' '}
          <span className="text-gray-200">{cfg.label}</span>
        </h1>
        <p className="text-xl text-gray-400">
          {isPbe ? `${cfg.name} — PBE` : '전략적 팀 전투 시뮬레이터'}
        </p>
        {isPbe && (
          <p className="text-sm text-yellow-500/70 mt-2">
            챔피언 데이터만 제공됩니다. 스탯/아이템/시너지는 PBE 오픈 후 업데이트됩니다.
          </p>
        )}
      </div>

      <div className={`grid grid-cols-1 ${features.length <= 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-6 w-full max-w-4xl`}>
        {features.map((f) =>
          f.disabled ? (
            <div
              key={f.title}
              className={`block p-6 rounded-2xl bg-gradient-to-br ${f.color} border ${f.borderColor} opacity-50 cursor-not-allowed`}
            >
              <div className="text-4xl mb-4 grayscale">{f.icon}</div>
              <h2 className="text-xl font-bold text-gray-500 mb-2">{f.title}</h2>
              <p className="text-sm text-gray-600">{f.desc}</p>
            </div>
          ) : (
            <Link
              key={f.title}
              href={f.href}
              className={`block p-6 rounded-2xl bg-gradient-to-br ${f.color} border ${f.borderColor} hover:scale-[1.02] transition-all group`}
            >
              <div className="text-4xl mb-4">{f.icon}</div>
              <h2 className="text-xl font-bold text-gray-100 group-hover:text-white mb-2">{f.title}</h2>
              <p className="text-sm text-gray-400 group-hover:text-gray-300">{f.desc}</p>
            </Link>
          )
        )}
      </div>
    </div>
  );
}
