/**
 * 회귀 가드 — 공격 속도 하드 캡 5.0 (under-damage systemic fix, 2026-06-15).
 *
 * 버그: getEffectiveAttackSpeed 에 AS 캡 부재 → Guinsoo 등 무한 스택으로 raw AS 폭주
 * (calibration 실측 Xayah AS 325~1746). attackInterval=round(1/(AS×TICK_DURATION))=0 →
 * 캐리가 매 틱 공격(틱당 1회=30/s) → 적을 비현실적으로 빨리 처치 → 전투가 2~6s 로 단축
 * → 누적 데미지가 실전(20~30s) 대비 과소집계되던 under-damage systemic 주원인.
 * fix: getEffectiveAttackSpeed return Math.min(as, 5.0) — TFT 전 세트 공통 AS 하드 캡.
 *
 * 검증: calibration game-424 avgDmgErr -30.3%→-23.3% / winnerMatch 71.4%→76.2%,
 * game-423 -39.5%→-29.7% (최대 단일 개선).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { simulateCombat } from '@/lib/simulator/engine/combatLoop';
import { setScalingData, type ScalingData } from '@/lib/simulator/systems/ability';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import scalingJson from '../../../public/data/tft_set17_scaling.json';
import type { PlacedChampion, RawChampion, RawItem } from '@/types';

const catalogs = loadServerCatalogs();
const { champions, traits, items } = catalogs;
const xayah = champions.find(c => c.apiName === 'TFT17_Xayah')!;
const cho = champions.find(c => c.apiName === 'TFT17_Chogath')!;
const guinsoo = items.find(i => i.apiName === 'TFT_Item_GuinsoosRageblade')!;

beforeAll(() => {
  setScalingData(scalingJson as unknown as ScalingData);
});

function placed(c: RawChampion, q: number, r: number, star: 1 | 2 | 3 = 2, it: RawItem[] = []): PlacedChampion {
  return { champion: c, starLevel: star, position: { q, r }, items: it };
}

describe('공격 속도 하드 캡 5.0 (Guinsoo 폭주 방지 회귀 가드)', () => {
  it('Guinsoo 3개로 raw AS 가 5.0 을 크게 초과해도 실효 공격 속도는 5/s 로 캡', () => {
    // Guinsoo 3개 = 평타당 AS 무한 스택 → raw AS 수백. 탱키 적 다수로 장기전.
    const r = simulateCombat(
      [placed(xayah, 5, 3, 3, [guinsoo, guinsoo, guinsoo])],
      [placed(cho, 6, 3, 3), placed(cho, 6, 2, 3), placed(cho, 6, 4, 3)],
      { seed: 0, allTraits: traits, skipMirror: true, stageNumber: 6 },
    );
    const x = r.playerUnits[0];
    // raw stats.attackSpeed 는 스택으로 5.0 을 크게 초과 (캡은 실효 rate 에만 적용).
    expect(x.stats.attackSpeed).toBeGreaterThan(5.0);
    // 실효 공격 횟수/초 ≤ 5.0 캡 (+ cast/타게팅 오버헤드 margin). 캡 없으면 7~30/s 가능.
    const ratePerSec = x.attackCount / (r.duration || 1);
    expect(ratePerSec).toBeLessThanOrEqual(5.5);
  });
});
