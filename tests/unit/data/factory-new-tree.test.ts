/**
 * 회귀 가드 — 그레이브즈 최신상 무기고 트리 (51 노드).
 *
 * 검증 항목:
 *   1. 51 노드 정의 + 카운트
 *   2. 3 roots + 직속 children 수 (맹공 4 / 위력 5 / 사수 4)
 *   3. multi-parent (초크 3 parent)
 *   4. parents/children 양방향 정합성 (모든 child 의 parents 가 정의 일치)
 *   5. getNextOptions 시나리오 (Round 1/2/3+, 사용자 예시 트레이스)
 *   6. validatePicks 검증
 */
import { describe, it, expect } from 'vitest';
import {
  FACTORY_NEW_TREE,
  FRAME_ROOTS,
  getAllSuffixes,
  isRoot,
  suffixToApiName,
  apiNameToSuffix,
  getNextOptions,
  validatePicks,
  type FactoryNode,
} from '@/data/factoryNewTree';

describe('FactoryNewTree — 51 노드 정의 + 정합성', () => {
  it('총 49 unique 노드 (lolchess 51 visible 은 Choke 중복 표시)', () => {
    // Choke 가 multi-parent (3) 라 visual 상 3번 등장 → unique 49.
    // FrameDefense / FrameSupport / Backup 은 미구현으로 제외.
    expect(getAllSuffixes()).toHaveLength(49);
  });

  it('3 root: CloseQuarters / SharpshooterModule / DoubleTap', () => {
    expect(FRAME_ROOTS).toEqual(['CloseQuarters', 'SharpshooterModule', 'DoubleTap']);
    for (const root of FRAME_ROOTS) {
      const node = FACTORY_NEW_TREE[root];
      expect(node).toBeDefined();
      expect(node.parents).toEqual([]);
      expect(isRoot(root)).toBe(true);
    }
  });

  it('비-root 모든 노드 → parents 길이 >= 1', () => {
    for (const [suffix, node] of Object.entries(FACTORY_NEW_TREE)) {
      if (isRoot(suffix)) continue;
      expect(node.parents.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('parents/children 양방향 정합성 — 모든 child 의 parents 에 본인 포함', () => {
    for (const [suffix, node] of Object.entries(FACTORY_NEW_TREE)) {
      for (const child of node.children) {
        const childNode = FACTORY_NEW_TREE[child];
        expect(childNode, `child ${child} of ${suffix} not defined`).toBeDefined();
        expect(childNode.parents, `${child}.parents missing ${suffix}`).toContain(suffix);
      }
      for (const parent of node.parents) {
        const parentNode = FACTORY_NEW_TREE[parent];
        expect(parentNode, `parent ${parent} of ${suffix} not defined`).toBeDefined();
        expect(parentNode.children, `${parent}.children missing ${suffix}`).toContain(suffix);
      }
    }
  });

  it('맹공 프레임 children 4개', () => {
    expect(FACTORY_NEW_TREE.CloseQuarters.children).toEqual([
      'LeechingImplants', 'Buckshot', 'Meltthrough', 'EmergencyShielding',
    ]);
  });

  it('위력 프레임 children 5개 (인게임 4 random, 시뮬은 5 다)', () => {
    expect(FACTORY_NEW_TREE.SharpshooterModule.children).toEqual([
      'BlastRadius', 'Heartseeker', 'Tankbuster', 'Coolant', 'Fission',
    ]);
  });

  it('사수 프레임 children 4개', () => {
    expect(FACTORY_NEW_TREE.DoubleTap.children).toEqual([
      'PrecisionScope', 'DoubleTap2', 'RipperBullets', 'FragmentationRounds',
    ]);
  });
});

describe('FactoryNewTree — multi-parent (Choke)', () => {
  it('Choke 가 3 parent (LeechingImplants2 / Buckshot / APRounds)', () => {
    const choke = FACTORY_NEW_TREE.Choke;
    expect(choke.parents.sort()).toEqual(['APRounds', 'Buckshot', 'LeechingImplants2'].sort());
    // 양방향: 3 parent 의 children 에 Choke 포함
    expect(FACTORY_NEW_TREE.LeechingImplants2.children).toContain('Choke');
    expect(FACTORY_NEW_TREE.Buckshot.children).toContain('Choke');
    expect(FACTORY_NEW_TREE.APRounds.children).toContain('Choke');
  });

  it('Choke frames = [CloseQuarters, SharpshooterModule]', () => {
    expect(FACTORY_NEW_TREE.Choke.frames.sort()).toEqual(['CloseQuarters', 'SharpshooterModule'].sort());
  });
});

describe('FactoryNewTree — 트리 분기 사용자 검수 반영', () => {
  it('맹공 → 흡수 임플란트+ → 초크', () => {
    expect(FACTORY_NEW_TREE.LeechingImplants2.children).toEqual(['Choke']);
  });

  it('맹공 → 산탄 사격 children = [산탄 사격+, 초크]', () => {
    expect(FACTORY_NEW_TREE.Buckshot.children).toEqual(['Buckshot2', 'Choke']);
  });

  it('맹공 → 긴급 보호막 children = [긴급 보호막+, 두꺼운 장갑판]', () => {
    expect(FACTORY_NEW_TREE.EmergencyShielding.children).toEqual([
      'EmergencyShielding2', 'HeavyPlating',
    ]);
  });

  it('맹공 → 두꺼운 장갑판 children = [충격파, 순수 질량, 반응형 방어구]', () => {
    expect(FACTORY_NEW_TREE.HeavyPlating.children).toEqual([
      'Shockwave', 'SheerMass', 'ReactiveArmor',
    ]);
  });

  it('맹공 → 순수 질량 → 나노머신', () => {
    expect(FACTORY_NEW_TREE.SheerMass.children).toEqual(['Nanomachines']);
  });

  it('위력 → 폭발 반경 children = [폭발 반경+, 공감성 폭발]', () => {
    expect(FACTORY_NEW_TREE.BlastRadius.children).toEqual(['BlastRadius2', 'SympatheticDetonation']);
  });

  it('위력 → 철갑탄 children = [철갑탄+, 초크]', () => {
    expect(FACTORY_NEW_TREE.APRounds.children).toEqual(['APRounds2', 'Choke']);
  });

  it('사수 → 정밀 조준경 children = [정밀 조준경+, 조준 보정]', () => {
    expect(FACTORY_NEW_TREE.PrecisionScope.children).toEqual(['PrecisionScope2', 'AimAssistant']);
  });

  it('사수 → 한 발에 두 놈 children = [한 발에 세 놈, 엔진 가동]', () => {
    expect(FACTORY_NEW_TREE.DoubleTap2.children).toEqual(['TripleTap', 'RevUp']);
  });

  it('사수 → 엔진 가동 → 엔진 가동+', () => {
    expect(FACTORY_NEW_TREE.RevUp.children).toEqual(['RevUp2']);
  });
});

describe('FactoryNewTree — apiName 변환', () => {
  it('suffixToApiName / apiNameToSuffix round-trip', () => {
    for (const suffix of getAllSuffixes()) {
      const api = suffixToApiName(suffix);
      expect(api).toBe(`TFT17_GravesTrait_Offense_${suffix}`);
      expect(apiNameToSuffix(api)).toBe(suffix);
    }
  });

  it('apiNameToSuffix — 비-Graves apiName 은 null', () => {
    expect(apiNameToSuffix('TFT17_Augment_GragasCarry')).toBe(null);
    expect(apiNameToSuffix('garbage')).toBe(null);
  });
});

describe('getNextOptions — Round 1 (picks=[])', () => {
  it('빈 picks → 3 roots', () => {
    expect(getNextOptions([])).toEqual(['CloseQuarters', 'SharpshooterModule', 'DoubleTap']);
  });
});

describe('getNextOptions — Round 2 (선택 root 의 children)', () => {
  it('맹공 선택 → 4 children', () => {
    expect(getNextOptions(['CloseQuarters'])).toEqual([
      'LeechingImplants', 'Buckshot', 'Meltthrough', 'EmergencyShielding',
    ]);
  });

  it('위력 선택 → 5 children (시뮬 5 다 표시)', () => {
    expect(getNextOptions(['SharpshooterModule'])).toEqual([
      'BlastRadius', 'Heartseeker', 'Tankbuster', 'Coolant', 'Fission',
    ]);
  });

  it('사수 선택 → 4 children', () => {
    expect(getNextOptions(['DoubleTap'])).toEqual([
      'PrecisionScope', 'DoubleTap2', 'RipperBullets', 'FragmentationRounds',
    ]);
  });
});

describe('getNextOptions — Round 3+ (마지막 pick children + 이전 sibling pool)', () => {
  it('맹공 → 긴급 보호막 → options = 긴급보호막.children + (맹공.children − 긴급보호막)', () => {
    const opts = getNextOptions(['CloseQuarters', 'EmergencyShielding']);
    // 긴급보호막.children: EmergencyShielding2, HeavyPlating
    // 맹공.children − 긴급보호막: LeechingImplants, Buckshot, Meltthrough
    // 합친 5개 (tree 정의 순서대로 정렬)
    expect(opts.sort()).toEqual([
      'Buckshot', 'EmergencyShielding2', 'HeavyPlating', 'LeechingImplants', 'Meltthrough',
    ].sort());
  });

  it('맹공 → 긴급 보호막 → 두꺼운 장갑판 → 7개 옵션 (사용자 예시)', () => {
    const opts = getNextOptions(['CloseQuarters', 'EmergencyShielding', 'HeavyPlating']);
    // 두꺼운장갑판.children: Shockwave, SheerMass, ReactiveArmor
    // 긴급.children − 두꺼운장갑판: EmergencyShielding2
    // 맹공.children − 긴급: LeechingImplants, Buckshot, Meltthrough
    // 합친 7개
    expect(opts.sort()).toEqual([
      'Buckshot', 'EmergencyShielding2', 'LeechingImplants', 'Meltthrough',
      'ReactiveArmor', 'SheerMass', 'Shockwave',
    ].sort());
  });

  it('위력 → 탱커 파괴자 → 철갑탄 → 옵션에 multi-parent Choke 포함', () => {
    const opts = getNextOptions(['SharpshooterModule', 'Tankbuster', 'APRounds']);
    expect(opts).toContain('Choke');
    expect(opts).toContain('APRounds2');
    // 탱커파괴자 sibling: LatentExplosion (지연 폭발)
    expect(opts).toContain('LatentExplosion');
  });

  it('multi-parent Choke — 다른 path 로 도달 시도 시 1번만 등장', () => {
    // 맹공 → 산탄 사격 (Choke 옵션 1) → 산탄 사격+ (Choke sibling 으로 다시 추가 시도)
    const opts = getNextOptions(['CloseQuarters', 'Buckshot', 'Buckshot2']);
    const chokeCount = opts.filter(o => o === 'Choke').length;
    expect(chokeCount).toBe(1);
  });

  it('이미 선택한 노드는 옵션에서 제외', () => {
    const opts = getNextOptions(['CloseQuarters', 'EmergencyShielding']);
    expect(opts).not.toContain('CloseQuarters');
    expect(opts).not.toContain('EmergencyShielding');
  });

  it('deterministic — 동일 picks 는 동일 옵션 순서', () => {
    const a = getNextOptions(['CloseQuarters', 'EmergencyShielding', 'HeavyPlating']);
    const b = getNextOptions(['CloseQuarters', 'EmergencyShielding', 'HeavyPlating']);
    expect(a).toEqual(b);
  });
});

describe('validatePicks', () => {
  it('빈 picks → valid', () => {
    expect(validatePicks([])).toEqual({ valid: true });
  });

  it('정상 path → valid', () => {
    expect(validatePicks(['CloseQuarters', 'EmergencyShielding', 'HeavyPlating'])).toEqual({ valid: true });
  });

  it('첫 pick 이 root 가 아니면 invalid', () => {
    const r = validatePicks(['LeechingImplants']);
    expect(r.valid).toBe(false);
  });

  it('children 이 아닌 노드 선택 시 invalid', () => {
    // 맹공 → 직접 두꺼운 장갑판 (긴급 보호막 거치지 않음)
    const r = validatePicks(['CloseQuarters', 'HeavyPlating']);
    expect(r.valid).toBe(false);
  });

  it('중복 pick → invalid', () => {
    const r = validatePicks(['CloseQuarters', 'EmergencyShielding', 'EmergencyShielding']);
    expect(r.valid).toBe(false);
  });

  it('정의되지 않은 suffix → invalid', () => {
    const r = validatePicks(['CloseQuarters', 'NonExistent' as string]);
    expect(r.valid).toBe(false);
  });

  it('multi-parent 노드 — 어느 parent 거쳐도 valid', () => {
    expect(validatePicks(['CloseQuarters', 'LeechingImplants', 'LeechingImplants2', 'Choke']).valid).toBe(true);
    expect(validatePicks(['CloseQuarters', 'Buckshot', 'Choke']).valid).toBe(true);
    expect(validatePicks(['SharpshooterModule', 'Tankbuster', 'APRounds', 'Choke']).valid).toBe(true);
  });
});

describe('FactoryNewTree — frame 분포 (Choke 가 맹공+위력 양쪽 포함)', () => {
  it('맹공 frame 18 노드 (17 own + Choke)', () => {
    const closeQ: FactoryNode[] = Object.values(FACTORY_NEW_TREE).filter(
      n => n.frames.includes('CloseQuarters'),
    );
    expect(closeQ.length).toBe(18);
  });

  it('위력 frame 19 노드 (18 own + Choke)', () => {
    const sharp: FactoryNode[] = Object.values(FACTORY_NEW_TREE).filter(
      n => n.frames.includes('SharpshooterModule'),
    );
    expect(sharp.length).toBe(19);
  });

  it('사수 frame 13 노드', () => {
    const dt: FactoryNode[] = Object.values(FACTORY_NEW_TREE).filter(
      n => n.frames.includes('DoubleTap'),
    );
    expect(dt.length).toBe(13);
  });

  it('총합: 18 + 19 + 13 = 50 (Choke 가 2 frame 에 카운트되므로 unique 49 + 1)', () => {
    const closeQ = Object.values(FACTORY_NEW_TREE).filter(n => n.frames.includes('CloseQuarters')).length;
    const sharp = Object.values(FACTORY_NEW_TREE).filter(n => n.frames.includes('SharpshooterModule')).length;
    const dt = Object.values(FACTORY_NEW_TREE).filter(n => n.frames.includes('DoubleTap')).length;
    expect(closeQ + sharp + dt).toBe(50);
    expect(getAllSuffixes()).toHaveLength(49);
  });
});
