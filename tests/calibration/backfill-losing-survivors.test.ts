/**
 * 일회성/재실행 가능 backfill 하네스. autofillLosingTeamSurvivors 룰을
 * 게임 파일의 모든 PvP 라운드에 적용해 진 팀의 survivors 가 비어있으면
 * 자동으로 사망 entry 채워넣고 디스크에 저장.
 *
 * 실행:
 *   pnpm test tests/calibration/backfill-losing-survivors.test.ts --run
 *   BACKFILL_GAME_ID=game-20260424-001 pnpm test ... --run
 *
 * 사용자가 명시 입력한 entry 가 있으면 보호 (helper 의 기본 정책).
 * draw 라운드는 자동 처리 안 함.
 */
import { describe, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { autofillLosingTeamSurvivors } from '@/lib/actualData/autofillSurvivors';
import type { ActualGameData, PvPRound } from '@/lib/actualData/types';

const GAME_ID = process.env.BACKFILL_GAME_ID ?? 'game-20260424-001';

describe('backfill losing-team survivors harness', () => {
  it(`applies autofill to all PvP rounds in ${GAME_ID}`, () => {
    const fp = path.join(process.cwd(), 'actual-data', `${GAME_ID}.json`);
    const data = JSON.parse(fs.readFileSync(fp, 'utf-8')) as ActualGameData;

    let modified = 0;
    data.rounds = data.rounds.map((r) => {
      if (r.type !== 'pvp') return r;
      const next = autofillLosingTeamSurvivors(r as PvPRound, { winner: r.winner });
      if (next !== r) modified++;
      return next;
    });

    if (modified > 0) {
      data.updatedAt = new Date().toISOString();
      fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    }
    // eslint-disable-next-line no-console -- harness measurement output
    console.log(`[backfill] ${GAME_ID}: ${modified} rounds modified`);
  });
});
