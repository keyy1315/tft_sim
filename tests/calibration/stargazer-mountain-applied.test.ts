/**
 * Mountain 변종 effect 가 sim 에서 unit stats 에 적용되는지 회귀 가드.
 * 별돌보미 trait 보유 (champion trait 또는 Stargazer Emblem) unit 에만 +12% HP/AS,
 * 비-별돌보미 unit 은 변화 없음.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import { toNRunInput } from '@/lib/validation/schemaAdapter';
import type { PvPRound } from '@/lib/actualData/types';

describe('stargazer mountain applied — 23일 game round 6-2', () => {
  it('별돌보미 unit (champion trait + emblem 모두) maxHp 가 +12% 증가, AS 도 +12%', () => {
    const raw = fs.readFileSync(
      path.join(process.cwd(), 'actual-data', 'game-20260423-001.json'),
      'utf-8',
    );
    const data = JSON.parse(raw) as { rounds: PvPRound[] };
    const round = data.rounds.find((r) => r.roundName === '6-2');
    if (!round) throw new Error('round 6-2 missing');

    const catalogs = loadServerCatalogs();

    const withMountain = toNRunInput(round, catalogs, {
      pvpRoundIndex: 17,
      stargazerConstellation: 'mountain',
    });
    const resultM = simulateCombat(
      withMountain.input.playerTeam,
      withMountain.input.opponentTeam,
      { ...withMountain.input.simulateOptions, seed: 0 },
    );

    const withoutConst = toNRunInput(round, catalogs, { pvpRoundIndex: 17 });
    const resultB = simulateCombat(
      withoutConst.input.playerTeam,
      withoutConst.input.opponentTeam,
      { ...withoutConst.input.simulateOptions, seed: 0 },
    );

    for (const u of resultM.playerUnits) {
      const ub = resultB.playerUnits.find((x) => x.id === u.id);
      if (!ub) continue;
      const isStargazer =
        u.champion.traits.includes('별돌보미') ||
        u.items.some((it) => it.apiName === 'TFT17_Item_StargazerEmblemItem');

      const hpRatio = u.maxHp / ub.maxHp;
      const asRatio = u.stats.attackSpeed / ub.stats.attackSpeed;
      const apDelta = u.stats.ap - ub.stats.ap;
      if (isStargazer) {
        // 17.2: Mountain_Health 0.12 → 0.15. HP 는 정수 maxHp 라 정확히 1.15.
        // AS 는 다른 trait 효과의 부동소수 multiply chain 으로 ±0.5% 변동 가능 — looser bound.
        // 23일 6-2 round 는 N.O.V.A. (DRX) Caitlyn 도 활성 → 6초 후 +20% AS 추가 적용
        // → mountain 1.15 × DRX 1.20 = ~1.38 도 허용. 17.2: Mountain_AS 0.12 → 0.10.
        expect(hpRatio).toBeCloseTo(1.15, 2);
        expect(asRatio).toBeGreaterThanOrEqual(1.08);
        expect(asRatio).toBeLessThanOrEqual(1.40);
        // AP 는 percentage points 단위 — Mountain_ADAP 0.15 × 100 = +15 AP (17.2: 0.12 → 0.15).
        // 다른 trait 효과 미존재 시 정확히 +15.
        expect(apDelta).toBeGreaterThan(14);
        expect(apDelta).toBeLessThan(16);
      } else {
        expect(hpRatio).toBeCloseTo(1.0, 3);
        expect(asRatio).toBeCloseTo(1.0, 3);
        expect(apDelta).toBe(0);
      }
    }
  }, 30_000);
});
