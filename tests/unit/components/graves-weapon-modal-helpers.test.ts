/**
 * GravesWeaponModal export helpers 단위 테스트.
 *
 * 컴포넌트 자체 (UI / interaction) 는 vitest 가 node 환경 + RTL 미설치 라
 * 본 테스트에서 검증하지 않음 — `/dev/graves-modal` 데모 페이지에서 시각 검증.
 *
 * 본 테스트가 검증하는 것:
 *   - picksToUpgradeIds — picks → 시뮬 옵션 ID 배열 변환
 *   - picksToFrame — picks 첫 번째가 frame root 인지 매핑
 *   - 잘못된 suffix 거부
 */
import { describe, it, expect } from 'vitest';
import { picksToUpgradeIds, picksToFrame } from '@/components/builder/GravesWeaponModal';

describe('picksToUpgradeIds — picks → 시뮬 upgrade ID', () => {
  it('빈 picks → 빈 배열', () => {
    expect(picksToUpgradeIds([])).toEqual([]);
  });

  it('정상 picks → 그대로 반환 (FACTORY_NEW_TREE 정의된 suffix 만)', () => {
    expect(picksToUpgradeIds(['CloseQuarters', 'EmergencyShielding', 'HeavyPlating']))
      .toEqual(['CloseQuarters', 'EmergencyShielding', 'HeavyPlating']);
  });

  it('정의되지 않은 suffix 는 필터링', () => {
    expect(picksToUpgradeIds(['CloseQuarters', 'NonExistent', 'HeavyPlating']))
      .toEqual(['CloseQuarters', 'HeavyPlating']);
  });

  it('multi-parent Choke 도 단일 entry', () => {
    expect(picksToUpgradeIds(['CloseQuarters', 'Buckshot', 'Choke']))
      .toEqual(['CloseQuarters', 'Buckshot', 'Choke']);
  });
});

describe('picksToFrame — 첫 pick → frame', () => {
  it('빈 picks → undefined', () => {
    expect(picksToFrame([])).toBeUndefined();
  });

  it('CloseQuarters → CloseQuarters', () => {
    expect(picksToFrame(['CloseQuarters', 'EmergencyShielding'])).toBe('CloseQuarters');
  });

  it('SharpshooterModule → SharpshooterModule', () => {
    expect(picksToFrame(['SharpshooterModule', 'BlastRadius'])).toBe('SharpshooterModule');
  });

  it('DoubleTap → DoubleTap', () => {
    expect(picksToFrame(['DoubleTap'])).toBe('DoubleTap');
  });

  it('첫 pick 이 root 가 아니면 undefined (방어 코드)', () => {
    expect(picksToFrame(['HeavyPlating'])).toBeUndefined();
  });
});
