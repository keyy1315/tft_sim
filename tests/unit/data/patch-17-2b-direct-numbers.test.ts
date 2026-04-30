/**
 * 회귀 가드 — Set 17.2b 마이크로 패치 (2026-04-29 라이브) 직접 수치 변경.
 *
 * 출처: 공식 patch notes "17.2 April 29th Mid-Patch Update"
 *   https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-17-2/
 *
 * 변경 항목:
 *   - 브라이어 ADDamage [1성/2성/3성]: 130/195/320 → 120/180/285 (4성 550 보존)
 *   - 레오나 ShieldAmount [2성/3성]: 500/685 → 480/620 (1성 420, 4성 870 보존)
 *   - 잭스 ShieldAP [2성/3성]: 500/625 → 470/550 (1성 400, 4성 850 보존)
 *   - 군체의 심장 (TFT17_Augment_PrimordianPrismaticAugment) 버그로 비활성화
 *
 * 데이터 부분 수정 원칙: raw value 배열의 변경 인덱스만 수정 — 사용자 수기 작성
 * 필드 / 다른 variable 의 보존이 핵심 (17.2 작업 시 전체 덮어쓰기로 한글 desc 손실 사고).
 */
import { describe, it, expect } from 'vitest';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';
import { DISABLED_AUGMENT_API_NAMES, isDisabledAugment } from '@/data/disabledContent';

const { champions } = loadServerCatalogs();

describe('Set 17.2b — 챔프 ability variable 수정', () => {
  it('브라이어 ADDamage = [3.3..., 120, 180, 285, 550, 3.3..., 3.3...]', () => {
    const briar = champions.find(c => c.apiName === 'TFT17_Briar');
    expect(briar).toBeDefined();
    const adDamage = briar!.ability.variables?.find(v => v.name === 'ADDamage');
    expect(adDamage).toBeDefined();
    expect(adDamage!.value[1]).toBe(120);   // 1성
    expect(adDamage!.value[2]).toBe(180);   // 2성
    expect(adDamage!.value[3]).toBe(285);   // 3성
    expect(adDamage!.value[4]).toBe(550);   // 4성 보존
  });

  it('레오나 ShieldAmount = [0, 420, 480, 620, 870, 0, 0]', () => {
    const leona = champions.find(c => c.apiName === 'TFT17_Leona');
    expect(leona).toBeDefined();
    const shield = leona!.ability.variables?.find(v => v.name === 'ShieldAmount');
    expect(shield).toBeDefined();
    expect(shield!.value[1]).toBe(420);   // 1성 보존
    expect(shield!.value[2]).toBe(480);   // 2성 변경
    expect(shield!.value[3]).toBe(620);   // 3성 변경
    expect(shield!.value[4]).toBe(870);   // 4성 보존
  });

  it('잭스 ShieldAP = [0, 400, 470, 550, 850, 0, 0]', () => {
    const jax = champions.find(c => c.apiName === 'TFT17_Jax');
    expect(jax).toBeDefined();
    const shield = jax!.ability.variables?.find(v => v.name === 'ShieldAP');
    expect(shield).toBeDefined();
    expect(shield!.value[1]).toBe(400);   // 1성 보존
    expect(shield!.value[2]).toBe(470);   // 2성 변경
    expect(shield!.value[3]).toBe(550);   // 3성 변경
    expect(shield!.value[4]).toBe(850);   // 4성 보존
  });
});

describe('Set 17.2b — 군체의 심장 비활성화', () => {
  it('DISABLED_AUGMENT_API_NAMES 에 군체의 심장 포함', () => {
    expect(DISABLED_AUGMENT_API_NAMES.has('TFT17_Augment_PrimordianPrismaticAugment')).toBe(true);
  });

  it('isDisabledAugment 헬퍼가 true 반환', () => {
    expect(isDisabledAugment('TFT17_Augment_PrimordianPrismaticAugment')).toBe(true);
  });

  it('기존 disabled augment 은 그대로 유지 (회귀 가드)', () => {
    expect(isDisabledAugment('TFT17_Augment_Concentration')).toBe(true);
    expect(isDisabledAugment('TFT17_Augment_Timebreaker_Timestream')).toBe(true);
    expect(isDisabledAugment('TFT17_Augment_EmergencySupplies')).toBe(true);
    expect(isDisabledAugment('TFT17_Augment_DarkStar_NeutronStar')).toBe(true);
    expect(isDisabledAugment('TFT17_Augment_ShieldTank_DivinePaladins')).toBe(true);
  });
});
