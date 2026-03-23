import Link from 'next/link';

const features = [
  {
    title: '데미지 계산기',
    desc: '챔피언의 DPS, 스킬 데미지를 아이템/시너지/증강 포함하여 실시간 계산',
    href: '/builder/calculator',
    icon: '⚔️',
    color: 'from-red-600/20 to-orange-600/20',
    borderColor: 'border-red-500/30',
  },
  {
    title: '전투 시뮬레이션',
    desc: '아군 vs 적군 자동 전투, 이동/사거리 시스템, 턴별 로그',
    href: '/simulator',
    icon: '⚡',
    color: 'from-yellow-600/20 to-amber-600/20',
    borderColor: 'border-yellow-500/30',
  },
];

export default function HomePage() {
  const mdGridColsClass = features.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3';

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh]">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-black mb-3">
          <span className="text-yellow-400">TFT</span>{' '}
          <span className="text-gray-200">Set 16</span>
        </h1>
        <p className="text-xl text-gray-400">전략적 팀 전투 시뮬레이터</p>
        <p className="text-sm text-gray-600 mt-2">116 챔피언 · 168 아이템 · 53 시너지 · 389 증강</p>
      </div>

      <div className={`grid grid-cols-1 ${mdGridColsClass} gap-6 w-full max-w-4xl`}>
        {features.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className={`block p-6 rounded-2xl bg-gradient-to-br ${f.color} border ${f.borderColor} hover:scale-[1.02] transition-all group`}
          >
            <div className="text-4xl mb-4">{f.icon}</div>
            <h2 className="text-xl font-bold text-gray-100 group-hover:text-white mb-2">{f.title}</h2>
            <p className="text-sm text-gray-400 group-hover:text-gray-300">{f.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
