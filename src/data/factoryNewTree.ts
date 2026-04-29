/**
 * 그레이브즈 최신상(GravesTrait) 무기고 트리 — 51 노드.
 *
 * 출처: lolchess.gg/rewards/set17/factory-new + 사용자 인게임 검수.
 * 구조 문서: docs/meta/set17-graves-factory-tree.md
 *
 * 알고리즘 (시뮬레이터 — 인게임과 다르게 모든 옵션 표시):
 *   Round 1: 3 root frames (고정)
 *   Round 2: 선택 root 의 직속 children 모두 (맹공 4 / 위력 5 / 사수 4)
 *   Round 3+: 마지막 pick 의 children + 이전 picks 의 children 중 아직 선택 안 된 것 모두
 *
 * Multi-parent 노드:
 *   - 초크 (Choke) — 3 parent: LeechingImplants2 / Buckshot / APRounds
 */

export type FactoryFrame = 'CloseQuarters' | 'SharpshooterModule' | 'DoubleTap';

export interface FactoryNode {
  /** apiName 접미사 (TFT17_GravesTrait_Offense_<suffix>) */
  suffix: string;
  /** 한글 이름 */
  name: string;
  /** raw effects 의 cost — 0/2/3/5/6 */
  cost: 0 | 2 | 3 | 5 | 6;
  /** 속한 frame path. multi-parent 노드 (초크) 는 첫 도달 path 기준 — 표시는 frames 배열로 */
  frame: FactoryFrame;
  /** 본 노드가 속할 수 있는 모든 frame (multi-parent 시 2 이상) */
  frames: FactoryFrame[];
  /** 직속 parent 노드 suffix 목록 (root 는 빈 배열). multi-parent 시 2 이상. */
  parents: string[];
  /** 직속 child 노드 suffix 목록 */
  children: string[];
}

export const FRAME_ROOTS: ReadonlyArray<FactoryFrame> = [
  'CloseQuarters',
  'SharpshooterModule',
  'DoubleTap',
];

/**
 * 51 노드 트리. parents/children 양쪽 정의 (편의를 위해 redundancy 허용).
 *
 * Frame 정의:
 *   맹공 (CloseQuarters): 19 노드
 *   위력 (SharpshooterModule): 19 노드
 *   사수 (DoubleTap): 13 노드
 */
export const FACTORY_NEW_TREE: Record<string, FactoryNode> = {
  // ============================================================
  // 🟦 맹공 프레임 (CloseQuarters) — 19 노드
  // ============================================================
  CloseQuarters: {
    suffix: 'CloseQuarters',
    name: '맹공 프레임',
    cost: 0,
    frame: 'CloseQuarters',
    frames: ['CloseQuarters'],
    parents: [],
    children: ['LeechingImplants', 'Buckshot', 'Meltthrough', 'EmergencyShielding'],
  },

  // 흡수 임플란트 line
  LeechingImplants: {
    suffix: 'LeechingImplants',
    name: '흡수 임플란트',
    cost: 0,
    frame: 'CloseQuarters',
    frames: ['CloseQuarters'],
    parents: ['CloseQuarters'],
    children: ['LeechingImplants2'],
  },
  LeechingImplants2: {
    suffix: 'LeechingImplants2',
    name: '흡수 임플란트+',
    cost: 2,
    frame: 'CloseQuarters',
    frames: ['CloseQuarters'],
    parents: ['LeechingImplants'],
    children: ['Choke'],
  },

  // 산탄 사격 line + Choke (multi-parent)
  Buckshot: {
    suffix: 'Buckshot',
    name: '산탄 사격',
    cost: 2,
    frame: 'CloseQuarters',
    frames: ['CloseQuarters'],
    parents: ['CloseQuarters'],
    children: ['Buckshot2', 'Choke'],
  },
  Buckshot2: {
    suffix: 'Buckshot2',
    name: '산탄 사격+',
    cost: 3,
    frame: 'CloseQuarters',
    frames: ['CloseQuarters'],
    parents: ['Buckshot'],
    children: ['Buckshot3'],
  },
  Buckshot3: {
    suffix: 'Buckshot3',
    name: '산탄 사격++',
    cost: 3,
    frame: 'CloseQuarters',
    frames: ['CloseQuarters'],
    parents: ['Buckshot2'],
    children: ['LaserBallistics'],
  },
  LaserBallistics: {
    suffix: 'LaserBallistics',
    name: '레이저 탄도학',
    cost: 6,
    frame: 'CloseQuarters',
    frames: ['CloseQuarters'],
    parents: ['Buckshot3'],
    children: [],
  },

  // 용융 관통 line
  Meltthrough: {
    suffix: 'Meltthrough',
    name: '용융 관통',
    cost: 2,
    frame: 'CloseQuarters',
    frames: ['CloseQuarters'],
    parents: ['CloseQuarters'],
    children: ['GravBooster'],
  },
  GravBooster: {
    suffix: 'GravBooster',
    name: '중력 증폭기',
    cost: 3,
    frame: 'CloseQuarters',
    frames: ['CloseQuarters'],
    parents: ['Meltthrough'],
    children: ['GravBooster2'],
  },
  GravBooster2: {
    suffix: 'GravBooster2',
    name: '중력 증폭기+',
    cost: 6,
    frame: 'CloseQuarters',
    frames: ['CloseQuarters'],
    parents: ['GravBooster'],
    children: [],
  },

  // 긴급 보호막 line + 두꺼운 장갑판 sub-tree
  EmergencyShielding: {
    suffix: 'EmergencyShielding',
    name: '긴급 보호막',
    cost: 0,
    frame: 'CloseQuarters',
    frames: ['CloseQuarters'],
    parents: ['CloseQuarters'],
    children: ['EmergencyShielding2', 'HeavyPlating'],
  },
  EmergencyShielding2: {
    suffix: 'EmergencyShielding2',
    name: '긴급 보호막+',
    cost: 2,
    frame: 'CloseQuarters',
    frames: ['CloseQuarters'],
    parents: ['EmergencyShielding'],
    children: [],
  },
  HeavyPlating: {
    suffix: 'HeavyPlating',
    name: '두꺼운 장갑판',
    cost: 3,
    frame: 'CloseQuarters',
    frames: ['CloseQuarters'],
    parents: ['EmergencyShielding'],
    children: ['Shockwave', 'SheerMass', 'ReactiveArmor'],
  },
  Shockwave: {
    suffix: 'Shockwave',
    name: '충격파',
    cost: 6,
    frame: 'CloseQuarters',
    frames: ['CloseQuarters'],
    parents: ['HeavyPlating'],
    children: [],
  },
  SheerMass: {
    suffix: 'SheerMass',
    name: '순수 질량',
    cost: 5,
    frame: 'CloseQuarters',
    frames: ['CloseQuarters'],
    parents: ['HeavyPlating'],
    children: ['Nanomachines'],
  },
  Nanomachines: {
    suffix: 'Nanomachines',
    name: '나노머신',
    cost: 6,
    frame: 'CloseQuarters',
    frames: ['CloseQuarters'],
    parents: ['SheerMass'],
    children: [],
  },
  ReactiveArmor: {
    suffix: 'ReactiveArmor',
    name: '반응형 방어구',
    cost: 6,
    frame: 'CloseQuarters',
    frames: ['CloseQuarters'],
    parents: ['HeavyPlating'],
    children: [],
  },

  // ============================================================
  // 🟥 위력 프레임 (SharpshooterModule) — 19 노드
  // 직속 children 5개 (인게임은 4 random, 시뮬은 5 다 표시)
  // ============================================================
  SharpshooterModule: {
    suffix: 'SharpshooterModule',
    name: '위력 프레임',
    cost: 0,
    frame: 'SharpshooterModule',
    frames: ['SharpshooterModule'],
    parents: [],
    children: ['BlastRadius', 'Heartseeker', 'Tankbuster', 'Coolant', 'Fission'],
  },

  // 폭발 반경 sub-tree
  BlastRadius: {
    suffix: 'BlastRadius',
    name: '폭발 반경',
    cost: 2,
    frame: 'SharpshooterModule',
    frames: ['SharpshooterModule'],
    parents: ['SharpshooterModule'],
    children: ['BlastRadius2', 'SympatheticDetonation'],
  },
  BlastRadius2: {
    suffix: 'BlastRadius2',
    name: '폭발 반경+',
    cost: 3,
    frame: 'SharpshooterModule',
    frames: ['SharpshooterModule'],
    parents: ['BlastRadius'],
    children: ['BlastRadius3'],
  },
  BlastRadius3: {
    suffix: 'BlastRadius3',
    name: '폭발 반경++',
    cost: 6,
    frame: 'SharpshooterModule',
    frames: ['SharpshooterModule'],
    parents: ['BlastRadius2'],
    children: [],
  },
  SympatheticDetonation: {
    suffix: 'SympatheticDetonation',
    name: '공감성 폭발',
    cost: 6,
    frame: 'SharpshooterModule',
    frames: ['SharpshooterModule'],
    parents: ['BlastRadius'],
    children: [],
  },

  // 심장추적자 line
  Heartseeker: {
    suffix: 'Heartseeker',
    name: '심장추적자',
    cost: 2,
    frame: 'SharpshooterModule',
    frames: ['SharpshooterModule'],
    parents: ['SharpshooterModule'],
    children: ['Heartseeker2'],
  },
  Heartseeker2: {
    suffix: 'Heartseeker2',
    name: '심장추적자+',
    cost: 3,
    frame: 'SharpshooterModule',
    frames: ['SharpshooterModule'],
    parents: ['Heartseeker'],
    children: ['Heartseeker3'],
  },
  Heartseeker3: {
    suffix: 'Heartseeker3',
    name: '심장추적자++',
    cost: 6,
    frame: 'SharpshooterModule',
    frames: ['SharpshooterModule'],
    parents: ['Heartseeker2'],
    children: [],
  },

  // 탱커 파괴자 sub-tree (Choke multi-parent)
  Tankbuster: {
    suffix: 'Tankbuster',
    name: '탱커 파괴자',
    cost: 0,
    frame: 'SharpshooterModule',
    frames: ['SharpshooterModule'],
    parents: ['SharpshooterModule'],
    children: ['LatentExplosion', 'APRounds'],
  },
  LatentExplosion: {
    suffix: 'LatentExplosion',
    name: '지연 폭발',
    cost: 3,
    frame: 'SharpshooterModule',
    frames: ['SharpshooterModule'],
    parents: ['Tankbuster'],
    children: [],
  },
  APRounds: {
    suffix: 'APRounds',
    name: '철갑탄',
    cost: 3,
    frame: 'SharpshooterModule',
    frames: ['SharpshooterModule'],
    parents: ['Tankbuster'],
    children: ['APRounds2', 'Choke'],
  },
  APRounds2: {
    suffix: 'APRounds2',
    name: '철갑탄+',
    cost: 6,
    frame: 'SharpshooterModule',
    frames: ['SharpshooterModule'],
    parents: ['APRounds'],
    children: [],
  },

  // 초크 — multi-parent (3 parents: LeechingImplants2 / Buckshot / APRounds)
  Choke: {
    suffix: 'Choke',
    name: '초크',
    cost: 5,
    frame: 'CloseQuarters', // 가장 먼저 도달 path 기준
    frames: ['CloseQuarters', 'SharpshooterModule'],
    parents: ['LeechingImplants2', 'Buckshot', 'APRounds'],
    children: [],
  },

  // 냉각수 line
  Coolant: {
    suffix: 'Coolant',
    name: '냉각수',
    cost: 2,
    frame: 'SharpshooterModule',
    frames: ['SharpshooterModule'],
    parents: ['SharpshooterModule'],
    children: ['Coolant2'],
  },
  Coolant2: {
    suffix: 'Coolant2',
    name: '냉각수+',
    cost: 3,
    frame: 'SharpshooterModule',
    frames: ['SharpshooterModule'],
    parents: ['Coolant'],
    children: ['VoidCoefficient'],
  },
  VoidCoefficient: {
    suffix: 'VoidCoefficient',
    name: '공허 계수',
    cost: 6,
    frame: 'SharpshooterModule',
    frames: ['SharpshooterModule'],
    parents: ['Coolant2'],
    children: [],
  },

  // 분열 line
  Fission: {
    suffix: 'Fission',
    name: '분열',
    cost: 0,
    frame: 'SharpshooterModule',
    frames: ['SharpshooterModule'],
    parents: ['SharpshooterModule'],
    children: ['Fission2'],
  },
  Fission2: {
    suffix: 'Fission2',
    name: '분열+',
    cost: 3,
    frame: 'SharpshooterModule',
    frames: ['SharpshooterModule'],
    parents: ['Fission'],
    children: ['Fission3'],
  },
  Fission3: {
    suffix: 'Fission3',
    name: '분열++',
    cost: 6,
    frame: 'SharpshooterModule',
    frames: ['SharpshooterModule'],
    parents: ['Fission2'],
    children: [],
  },

  // ============================================================
  // 🟨 사수 프레임 (DoubleTap) — 13 노드
  // 직속 children 4개
  // ============================================================
  DoubleTap: {
    suffix: 'DoubleTap',
    name: '사수 프레임',
    cost: 0,
    frame: 'DoubleTap',
    frames: ['DoubleTap'],
    parents: [],
    children: ['PrecisionScope', 'DoubleTap2', 'RipperBullets', 'FragmentationRounds'],
  },

  // 정밀 조준경 line + 조준 보정 sibling
  PrecisionScope: {
    suffix: 'PrecisionScope',
    name: '정밀 조준경',
    cost: 0,
    frame: 'DoubleTap',
    frames: ['DoubleTap'],
    parents: ['DoubleTap'],
    children: ['PrecisionScope2', 'AimAssistant'],
  },
  PrecisionScope2: {
    suffix: 'PrecisionScope2',
    name: '정밀 조준경+',
    cost: 2,
    frame: 'DoubleTap',
    frames: ['DoubleTap'],
    parents: ['PrecisionScope'],
    children: ['PrecisionScope3'],
  },
  PrecisionScope3: {
    suffix: 'PrecisionScope3',
    name: '정밀 조준경++',
    cost: 5,
    frame: 'DoubleTap',
    frames: ['DoubleTap'],
    parents: ['PrecisionScope2'],
    children: [],
  },
  AimAssistant: {
    suffix: 'AimAssistant',
    name: '조준 보정',
    cost: 6,
    frame: 'DoubleTap',
    frames: ['DoubleTap'],
    parents: ['PrecisionScope'],
    children: [],
  },

  // 한 발에 두 놈 sub-tree (엔진 가동 sibling 변경)
  DoubleTap2: {
    suffix: 'DoubleTap2',
    name: '한 발에 두 놈',
    cost: 2,
    frame: 'DoubleTap',
    frames: ['DoubleTap'],
    parents: ['DoubleTap'],
    children: ['TripleTap', 'RevUp'],
  },
  TripleTap: {
    suffix: 'TripleTap',
    name: '한 발에 세 놈',
    cost: 3,
    frame: 'DoubleTap',
    frames: ['DoubleTap'],
    parents: ['DoubleTap2'],
    children: [],
  },
  RevUp: {
    suffix: 'RevUp',
    name: '엔진 가동',
    cost: 3,
    frame: 'DoubleTap',
    frames: ['DoubleTap'],
    parents: ['DoubleTap2'],
    children: ['RevUp2'],
  },
  RevUp2: {
    suffix: 'RevUp2',
    name: '엔진 가동+',
    cost: 6,
    frame: 'DoubleTap',
    frames: ['DoubleTap'],
    parents: ['RevUp'],
    children: [],
  },

  // 파쇄 탄환 line
  RipperBullets: {
    suffix: 'RipperBullets',
    name: '파쇄 탄환',
    cost: 2,
    frame: 'DoubleTap',
    frames: ['DoubleTap'],
    parents: ['DoubleTap'],
    children: ['RipperBullets2'],
  },
  RipperBullets2: {
    suffix: 'RipperBullets2',
    name: '파쇄 탄환+',
    cost: 3,
    frame: 'DoubleTap',
    frames: ['DoubleTap'],
    parents: ['RipperBullets'],
    children: [],
  },

  // 파편탄 line
  FragmentationRounds: {
    suffix: 'FragmentationRounds',
    name: '파편탄',
    cost: 2,
    frame: 'DoubleTap',
    frames: ['DoubleTap'],
    parents: ['DoubleTap'],
    children: ['FragmentationRounds2'],
  },
  FragmentationRounds2: {
    suffix: 'FragmentationRounds2',
    name: '파편탄+',
    cost: 3,
    frame: 'DoubleTap',
    frames: ['DoubleTap'],
    parents: ['FragmentationRounds'],
    children: [],
  },
};

// ============================================================
// Helper functions
// ============================================================

/** 모든 노드의 suffix 목록. */
export function getAllSuffixes(): string[] {
  return Object.keys(FACTORY_NEW_TREE);
}

/** Root 인지 검사. */
export function isRoot(suffix: string): boolean {
  return (FRAME_ROOTS as readonly string[]).includes(suffix);
}

/** raw apiName ('TFT17_GravesTrait_Offense_<suffix>') 으로 변환. */
export function suffixToApiName(suffix: string): string {
  return `TFT17_GravesTrait_Offense_${suffix}`;
}

/** apiName 에서 suffix 추출 (TFT17_GravesTrait_Offense_<suffix> 가 아니면 null). */
export function apiNameToSuffix(apiName: string): string | null {
  const match = apiName.match(/^TFT17_GravesTrait_Offense_(.+)$/);
  return match ? match[1] : null;
}

/**
 * picks history 기반 다음 라운드 옵션 생성.
 *
 * 알고리즘 (시뮬레이터 — 인게임 4 카드 제한 없이 모든 옵션 표시):
 *   - Round 1 (picks=[]): 3 root frames
 *   - Round 2 (picks.length=1): 선택 root 의 children 모두 (맹공 4 / 위력 5 / 사수 4)
 *   - Round 3+ (picks.length>=2): 마지막 pick 의 children +
 *       이전 picks 의 children 중 아직 선택 안 된 것 모두
 *
 * 이미 선택한 노드 (picks 안에 있는) 는 옵션에서 제외.
 * Multi-parent 노드 (Choke) 는 어떤 parent 를 거쳐도 1번만 등장 (Set dedup).
 *
 * @returns suffix 배열 (정렬: tree 정의 순서 — deterministic)
 */
export function getNextOptions(picks: ReadonlyArray<string>): string[] {
  if (picks.length === 0) {
    return [...FRAME_ROOTS];
  }

  const pickSet = new Set(picks);
  const optionSet = new Set<string>();

  // 마지막 pick 의 children
  const lastPick = picks[picks.length - 1];
  const lastNode = FACTORY_NEW_TREE[lastPick];
  if (lastNode) {
    for (const child of lastNode.children) {
      if (!pickSet.has(child)) optionSet.add(child);
    }
  }

  // Round 3+: 이전 picks 의 children 중 아직 선택 안 된 것
  if (picks.length >= 2) {
    for (let i = picks.length - 2; i >= 0; i--) {
      const node = FACTORY_NEW_TREE[picks[i]];
      if (!node) continue;
      for (const child of node.children) {
        if (!pickSet.has(child)) optionSet.add(child);
      }
    }
  }

  // tree 정의 순서대로 정렬 (deterministic)
  const allSuffixes = getAllSuffixes();
  const orderIndex = new Map(allSuffixes.map((s, i) => [s, i]));
  return [...optionSet].sort(
    (a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0),
  );
}

/**
 * picks 가 valid 한 트리 path 인지 검사.
 *
 * 규칙:
 *   - 첫 pick 은 root
 *   - 이후 모든 pick 은 getNextOptions(picks[0..i-1]) 안에 있어야 함
 *   - 중복 pick 금지
 */
export function validatePicks(picks: ReadonlyArray<string>): { valid: boolean; reason?: string } {
  if (picks.length === 0) return { valid: true };
  const seen = new Set<string>();
  for (let i = 0; i < picks.length; i++) {
    const p = picks[i];
    if (!FACTORY_NEW_TREE[p]) return { valid: false, reason: `unknown suffix: ${p}` };
    if (seen.has(p)) return { valid: false, reason: `duplicate pick: ${p}` };
    seen.add(p);
    const allowed = getNextOptions(picks.slice(0, i));
    if (!allowed.includes(p)) return { valid: false, reason: `${p} not in options at round ${i + 1}` };
  }
  return { valid: true };
}
