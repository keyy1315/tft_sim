/**
 * readVarByStar 헬퍼 회귀 가드 (PR99 + codex P1 후속).
 *
 * CommunityDragon TFT17 데이터의 컨벤션 자동 감지 검증:
 *   - filler 컨벤션 (zero, large-dummy, small-sentinel) → value[starLevel]
 *   - no-filler 컨벤션 (monotonic) → value[starLevel - 1]
 *
 * helper 는 simulateCombat 내부 함수이므로 직접 테스트 못 함 — 대신 실제 챔피언
 * cast 결과로 간접 검증. Sona / Talon / Vex 등 sentinel filler 컨벤션 챔피언이
 * ★1 unit 이 sentinel 값 (2.5) 으로 잘못 정정되지 않는지 검증.
 */
import { describe, it, expect } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import type { PlacedChampion, RawChampion } from '@/types';

const { champions, traits } = loadServerCatalogs();

function placed(c: RawChampion, q: number, r: number, starLevel = 1): PlacedChampion {
  return { champion: c, starLevel, position: { q, r }, items: [] };
}

describe('PR99 codex P1 — readVarByStar sentinel filler 처리', () => {
  it('Sona ★1 (SlamDamage [2.5, 680, 1050]) — sentinel 2.5 가 ★1 데미지로 잘못 사용되지 않음', () => {
    const sona = champions.find(c => c.apiName === 'TFT17_Sona');
    if (!sona) return; // 카탈로그 변동 시 skip
    const aatrox = champions.find(c => c.apiName === 'TFT17_Aatrox')!;
    const r = simulateCombat(
      [placed(sona, 0, 0, 1)],
      [placed(aatrox, 6, 3, 1)],
      { seed: 0, allTraits: traits, skipMirror: true },
    );
    // Sona ★1 totalDamageDealt — sentinel 2.5 가 적용되면 cast 데미지 무의미한 수준.
    // 정상 동작 (★1=680) 이면 cast 1회만으로도 100+ 데미지 누적.
    expect(r.playerUnits[0].totalDamageDealt).toBeGreaterThan(50);
  });

  it('Vex ★1 (ShadowHandDamage [2.5, 30, 45]) — sentinel 2.5 가 ★1 데미지로 잘못 사용되지 않음', () => {
    const vex = champions.find(c => c.apiName === 'TFT17_Vex');
    if (!vex) return;
    const aatrox = champions.find(c => c.apiName === 'TFT17_Aatrox')!;
    const r = simulateCombat(
      [placed(vex, 0, 0, 1)],
      [placed(aatrox, 6, 3, 1)],
      { seed: 0, allTraits: traits, skipMirror: true },
    );
    // Vex ★1 ShadowHand = 30 + 평타. sentinel 2.5 면 ability 데미지 무시할 수준.
    expect(r.playerUnits[0].totalDamageDealt).toBeGreaterThan(50);
  });

  it('Caitlyn ★1 (Damage [145, 170, 255]) — no-filler 보존, sentinel 검사로 오분류 안 됨', () => {
    // Caitlyn 데이터 [145, 170, 255]: ratio 170/145 = 1.17 < 5 → no-filler 정상 분류.
    // sentinel ratio 검사가 monotonic 패턴을 filler 로 오분류하지 않는지 회귀 가드.
    const cait = champions.find(c => c.apiName === 'TFT17_Caitlyn')!;
    const aatrox = champions.find(c => c.apiName === 'TFT17_Aatrox')!;
    const r = simulateCombat(
      [placed(cait, 0, 0, 1)],
      [placed(aatrox, 6, 3, 1)],
      { seed: 0, allTraits: traits, skipMirror: true },
    );
    // Caitlyn ★1 평타 + 헤드샷 proc → 데미지 정상 누적.
    expect(r.playerUnits[0].totalDamageDealt).toBeGreaterThan(50);
  });
});
