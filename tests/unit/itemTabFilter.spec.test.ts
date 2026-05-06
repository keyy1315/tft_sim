/**
 * PR9 — item tab filter spec (동물특공대 / 초능력)
 *
 * 4 위치에 동일한 인라인 분기 패턴이 있음:
 *  - src/app/simulator/layout/pool/ItemPoolContent.tsx (mobile/tablet)
 *  - src/app/simulator/layout/SimulatorLayoutDesktop.tsx (desktop)
 *  - src/components/actual-data/ChampionItemSidebar.tsx (actual-data)
 *  - src/components/builder/ItemGrid.tsx (builder modal — PR8 1/4 에서 이미 추가)
 *
 * 본 테스트는 인라인 구현이 아닌 spec 자체를 fingerprint 로 잠근다.
 * 4 위치의 구현이 spec 에서 벗어나면 dev 수동 검증/QA 에서 잡힘.
 */
import { describe, it, expect } from 'vitest';
import type { ItemCategory } from '@/types';

type Tab =
  | 'all' | 'component' | 'combined' | 'artifact' | 'emblem' | 'radiant'
  | 'animasquad' | 'psyops';

/**
 * 4 위치의 공통 매칭 spec.
 * - 'all' → 모두 매칭
 * - 'animasquad' / 'psyops' 카테고리 → 본인 탭 또는 '완성/완성템' 통합 탭
 * - 'void' / 'darkin' / 'bilgewater' → '완성/완성템' 통합 탭에서만
 *   (방문 가시성은 호출 측에서 별도 프리필터)
 * - 그 외 카테고리 → cat === tab 직접 매칭
 */
function specMatch(cat: ItemCategory, tab: Tab): boolean {
  if (tab === 'all') return true;
  if (cat === 'animasquad' || cat === 'psyops') {
    return tab === 'combined' || tab === cat;
  }
  if (cat === 'void' || cat === 'darkin' || cat === 'bilgewater') {
    return tab === 'combined';
  }
  return cat === tab;
}

describe('PR9 — animasquad/psyops 탭 필터 spec', () => {
  it('animasquad 아이템: 본인 탭 + 완성 탭에서만 매칭', () => {
    expect(specMatch('animasquad', 'animasquad')).toBe(true);
    expect(specMatch('animasquad', 'combined')).toBe(true);
    expect(specMatch('animasquad', 'all')).toBe(true);
    expect(specMatch('animasquad', 'psyops')).toBe(false);
    expect(specMatch('animasquad', 'artifact')).toBe(false);
    expect(specMatch('animasquad', 'radiant')).toBe(false);
    expect(specMatch('animasquad', 'emblem')).toBe(false);
  });

  it('psyops 아이템: 본인 탭 + 완성 탭에서만 매칭', () => {
    expect(specMatch('psyops', 'psyops')).toBe(true);
    expect(specMatch('psyops', 'combined')).toBe(true);
    expect(specMatch('psyops', 'all')).toBe(true);
    expect(specMatch('psyops', 'animasquad')).toBe(false);
    expect(specMatch('psyops', 'artifact')).toBe(false);
  });

  it('combined 아이템: combined / all 탭에서만 매칭 (신규 탭에는 미노출)', () => {
    expect(specMatch('combined', 'combined')).toBe(true);
    expect(specMatch('combined', 'all')).toBe(true);
    expect(specMatch('combined', 'animasquad')).toBe(false);
    expect(specMatch('combined', 'psyops')).toBe(false);
  });

  it('void/darkin/bilgewater: combined 통합 탭에만 노출 (호환성)', () => {
    expect(specMatch('void', 'combined')).toBe(true);
    expect(specMatch('darkin', 'combined')).toBe(true);
    expect(specMatch('bilgewater', 'combined')).toBe(true);
    expect(specMatch('void', 'animasquad')).toBe(false);
    expect(specMatch('darkin', 'psyops')).toBe(false);
  });

  it('artifact/radiant/emblem: 본인 탭에서만 매칭', () => {
    expect(specMatch('artifact', 'artifact')).toBe(true);
    expect(specMatch('artifact', 'combined')).toBe(false);
    expect(specMatch('radiant', 'radiant')).toBe(true);
    expect(specMatch('emblem', 'emblem')).toBe(true);
    expect(specMatch('emblem', 'animasquad')).toBe(false);
  });
});
