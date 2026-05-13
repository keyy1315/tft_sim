/**
 * 회귀 가드 — Set 17.3 LIVE (2026-05-13) 챔프 ability variable 변경.
 *
 * 출처: CommunityDragon PBE 5/12 미러 + 사용자 게임 검증 (5/13 KST 한국 서버 LIVE).
 *
 * 핵심 변경 항목 (★4 위주 너프 + 일부 ★1~3 조정):
 *   1코: Briar/Leona/TF/Teemo
 *   2코: Akali/Belveth/Jax/Jinx
 *   3코: Diana/Fizz/Kaisa/Ornn/Samira
 *   4코: AurelionSol/Karma/LeBlanc/MasterYi/Nami/Xayah(신규 메커니즘)/Morgana
 *   5코: Shen
 *
 * 데이터 부분 수정 원칙: raw value 배열의 변경 인덱스만 수정 — 사용자 수기 작성
 * 필드 / 다른 variable 의 보존이 핵심.
 */
import { describe, it, expect } from 'vitest';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';

const { champions } = loadServerCatalogs();

function findVar(apiName: string, varName: string) {
  const champ = champions.find(c => c.apiName === apiName);
  expect(champ, `${apiName} not found`).toBeDefined();
  const v = champ!.ability.variables?.find(vv => vv.name === varName);
  expect(v, `${apiName}.${varName} not found`).toBeDefined();
  return v!.value as number[];
}

describe('Set 17.3 — 1코스트 너프', () => {
  it('브라이어 ADDamage ★4: 550 → 485', () => {
    const v = findVar('TFT17_Briar', 'ADDamage');
    expect(v[4]).toBe(485);
  });

  it('레오나 ShieldAmount ★4: 870 → 760', () => {
    const v = findVar('TFT17_Leona', 'ShieldAmount');
    expect(v[4]).toBe(760);
  });

  it('레오나 DefenseToDamageRatio ★1~4 너프', () => {
    const v = findVar('TFT17_Leona', 'DefenseToDamageRatio');
    expect(v[1]).toBeCloseTo(1.2, 5);
    expect(v[2]).toBeCloseTo(1.8, 5);
    expect(v[3]).toBeCloseTo(2.7, 5);
    expect(v[4]).toBeCloseTo(4.6, 5);
  });

  it('트페 DamageMin ★1~4: 190/285/430/730 → 180/270/405/690', () => {
    const v = findVar('TFT17_TwistedFate', 'DamageMin');
    expect(v[1]).toBe(180);
    expect(v[2]).toBe(270);
    expect(v[3]).toBe(405);
    expect(v[4]).toBe(690);
  });

  it('트페 DamageMax ★1~4: 380/570/860/1460 → 360/540/810/1380', () => {
    const v = findVar('TFT17_TwistedFate', 'DamageMax');
    expect(v[1]).toBe(360);
    expect(v[2]).toBe(540);
    expect(v[3]).toBe(810);
    expect(v[4]).toBe(1380);
  });

  it('티모 MagicDamage ★1~4: 70/105/190/325 → 65/95/170/300', () => {
    const v = findVar('TFT17_Teemo', 'MagicDamage');
    expect(v[1]).toBe(65);
    expect(v[2]).toBe(95);
    expect(v[3]).toBe(170);
    expect(v[4]).toBe(300);
  });
});

describe('Set 17.3 — 2코스트', () => {
  it('아칼리 DamageAD ★1~4 (역방향 버프): 34/50/80/135 → 37/56/84/140', () => {
    const v = findVar('TFT17_Akali', 'DamageAD');
    expect(v[1]).toBe(37);
    expect(v[2]).toBe(56);
    expect(v[3]).toBe(84);
    expect(v[4]).toBe(140);
  });

  it('벨베스 ADDamage ★1~4 너프', () => {
    const v = findVar('TFT17_Belveth', 'ADDamage');
    expect(v[1]).toBe(18);
    expect(v[2]).toBe(27);
    expect(v[3]).toBe(41);
    expect(v[4]).toBe(69);
  });

  it('잭스 ShieldAP ★1=400 ★2=450 ★3=500 ★4=600 (★4 큰 너프 + ★2/3 추가 너프)', () => {
    const v = findVar('TFT17_Jax', 'ShieldAP');
    expect(v[1]).toBe(400);
    expect(v[2]).toBe(450);
    expect(v[3]).toBe(500);
    expect(v[4]).toBe(600);
  });

  it('잭스 FlatDR ★1~4 너프', () => {
    const v = findVar('TFT17_Jax', 'FlatDR');
    expect(v[1]).toBe(15);
    expect(v[2]).toBe(20);
    expect(v[3]).toBe(25);
    expect(v[4]).toBe(30);
  });

  it('징크스 ADDamage ★3 버프: 65 → 70', () => {
    const v = findVar('TFT17_Jinx', 'ADDamage');
    expect(v[3]).toBe(70);
  });
});

describe('Set 17.3 — 3코스트', () => {
  it('다이애나 BaseDamage 버프', () => {
    const v = findVar('TFT17_Diana', 'BaseDamage');
    expect(v[1]).toBe(60);
    expect(v[2]).toBe(90);
    expect(v[3]).toBe(145);
    expect(v[4]).toBe(250);
  });

  it('다이애나 Shield 버프', () => {
    const v = findVar('TFT17_Diana', 'Shield');
    expect(v[1]).toBe(275);
    expect(v[2]).toBe(325);
    expect(v[3]).toBe(475);
  });

  it('피즈 DashDamage ★1~3 버프 (★4 보존)', () => {
    const v = findVar('TFT17_Fizz', 'DashDamage');
    expect(v[1]).toBe(120);
    expect(v[2]).toBe(180);
    expect(v[3]).toBe(290);
    expect(v[4]).toBe(470);
  });

  it('카이사 ADDamage 너프', () => {
    const v = findVar('TFT17_Kaisa', 'ADDamage');
    expect(v[1]).toBe(30);
    expect(v[2]).toBe(45);
    expect(v[3]).toBe(72);
  });

  it('오른 Shield ★1~2 버프 (★3+ 보존)', () => {
    const v = findVar('TFT17_Ornn', 'Shield');
    expect(v[1]).toBe(125);
    expect(v[2]).toBe(200);
    expect(v[3]).toBe(500);
  });

  it('사미라 Damage ★1~3 버프', () => {
    const v = findVar('TFT17_Samira', 'Damage');
    expect(v[1]).toBe(375);
    expect(v[2]).toBe(560);
    expect(v[3]).toBe(900);
  });
});

describe('Set 17.3 — 4코스트', () => {
  it('아우솔 DamagePerSecond ★1~2 큰 폭 버프', () => {
    const v = findVar('TFT17_AurelionSol', 'DamagePerSecond');
    expect(v[1]).toBe(320);
    expect(v[2]).toBe(480);
  });

  it('아우솔 DamageReductionPerTarget 0.6 → 0.8 (감소 폭 ↑)', () => {
    const v = findVar('TFT17_AurelionSol', 'DamageReductionPerTarget');
    expect(v[1]).toBeCloseTo(0.8, 5);
  });

  it('카르마 SecondaryDamage 버프', () => {
    const v = findVar('TFT17_Karma', 'SecondaryDamage');
    expect(v[1]).toBe(180);
    expect(v[2]).toBe(270);
  });

  it('르블랑 BoltDamage 버프', () => {
    const v = findVar('TFT17_Leblanc', 'BoltDamage');
    expect(v[1]).toBe(80);
    expect(v[2]).toBe(120);
  });

  it('마이 Omnivamp 0.15 → 0.10 너프', () => {
    const v = findVar('TFT17_MasterYi', 'Omnivamp');
    expect(v[1]).toBeCloseTo(0.10, 5);
  });

  it('나미 Damage 버프', () => {
    const v = findVar('TFT17_Nami', 'Damage');
    expect(v[1]).toBe(440);
    expect(v[2]).toBe(660);
  });

  it('자야 NumAttacks 신규 변수 = 6 (메커니즘 변경)', () => {
    const v = findVar('TFT17_Xayah', 'NumAttacks');
    expect(v[1]).toBe(6);
  });

  it('자야 PrimaryTargetBonusDamage 신규 변수 (raw [10,10,15,200,10,10,10])', () => {
    const v = findVar('TFT17_Xayah', 'PrimaryTargetBonusDamage');
    expect(v[0]).toBe(10);
    expect(v[1]).toBe(10);
    expect(v[2]).toBe(15);
    expect(v[3]).toBe(200);
    expect(v[4]).toBe(10);
  });

  it('모르가나 4코 유지 + ability 재설계 (lolchess.gg 17.3 LIVE)', () => {
    const morgana = champions.find(c => c.apiName === 'TFT17_Morgana');
    expect(morgana?.cost).toBe(4); // 4코 승격 + 4코 유지
    expect(morgana?.stats.hp).toBe(1300);
    expect(morgana?.stats.armor).toBe(70);
    expect(morgana?.stats.magicResist).toBe(70);
    expect(morgana?.stats.damage).toBe(60);
    expect(morgana?.stats.initialMana).toBe(30);
    expect(morgana?.stats.mana).toBe(90);
  });

  it('모르가나 ability 재설계 — Damage tether mage 변수 (Latest 5/9 구조)', () => {
    const tether = findVar('TFT17_Morgana', 'TetherDamagePerSecond');
    expect(tether[1]).toBe(50);  // ★1 매초 피해
    expect(tether[2]).toBe(75);  // ★2 매초 피해
    const finalDmg = findVar('TFT17_Morgana', 'FinalDamage');
    expect(finalDmg[1]).toBe(240);
    expect(finalDmg[2]).toBe(360);
    const omnivamp = findVar('TFT17_Morgana', 'OmnivampPercent');
    expect(omnivamp[1]).toBeCloseTo(0.20, 5);
  });
});

describe('Set 17.3 — 5코스트', () => {
  it('쉔 ShieldHP 0.10 → 0.15 (보호막 50% 강화)', () => {
    const v = findVar('TFT17_Shen', 'ShieldHP');
    expect(v[1]).toBeCloseTo(0.15, 5);
  });

  it('쉔 BonusDamageOnAttack ★1=20 / ★2=30 (45/75 → 너프, PR 2 적용)', () => {
    const v = findVar('TFT17_Shen', 'BonusDamageOnAttack');
    expect(v[1]).toBe(20);
    expect(v[2]).toBe(30);
  });

  it('쉔 DamageHP=0.01 유지 (lolchess.gg "최대 체력 1%")', () => {
    const v = findVar('TFT17_Shen', 'DamageHP');
    expect(v[1]).toBeCloseTo(0.01, 5);
  });
});
