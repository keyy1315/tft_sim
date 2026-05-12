import { RawChampion, CombatUnit, AbilityPattern, hexDistance } from '@/types';
import { getHexesInRadius, getHexesInLine, getHexesInCone } from '@/lib/simulator/models/hex';

export type DamageType = 'magic' | 'physical' | 'true';

export interface ParsedAbility {
  damageType: DamageType;
  scalingType: 'ap' | 'ad' | 'none';
  damageValues: number[]; // [base, 1star, 2star, 3star]
  damageVarName: string | null;
}

export interface AbilityConfig {
  pattern: AbilityPattern;
  radius?: number;
  maxTargets?: number;
  damageDecay?: number;
  /** 스킬 시전 시 이동 유형 */
  dash?: 'to_target' | 'to_farthest' | 'to_lowest_hp' | 'to_backline' | 'to_largest_cluster';
  /** CC 기절 지속시간 (초). 데미지 대상에 적용 */
  stun?: number;
  /** 기절 대상 수 제한 (기본: 데미지 대상 전원) */
  stunTargets?: number;
  /** 시전자 체력 회복 (true면 JSON Heal 변수에서 읽음) */
  heal?: boolean;
  /** 자기 버프 */
  selfBuff?: {
    attackSpeed?: number;
    ad?: number;
    ap?: number;
    durability?: number;
    duration?: number;
  };
  /** 아군 전체 버프 */
  allyBuff?: {
    attackSpeed?: number;
    duration?: number;
  };
  /** 적 디버프 (데미지 대상에 적용) */
  debuff?: {
    armorReduction?: number;
    mrReduction?: number;
    duration?: number;
  };
  /** 다회 타격 횟수 — 총 피해 = base × hitCount (벨베스 12, 아칼리 5 등) */
  hitCount?: number;
  /** DOT 지속 피해 — 스킬 피해를 duration초에 걸쳐 매초 적용 */
  dot?: { duration: number };
  /** parseAbility 대신 사용할 피해 변수명 오버라이드 */
  damageVar?: string;
  /** 2차 피해 변수명 (폭발, 추가 투사체 등) — 주 피해와 합산 */
  secondaryDamageVar?: string;
  /**
   * 자기 자신에게 데미지 적용 (적군 데미지 없음). 자폭(GragasCarry) 전용.
   * 데미지 값은 일반 ability "damage" 변수에서 그대로 가져옴.
   */
  selfDamage?: boolean;
  /**
   * selfDamage 적용 시 currentHp 최소값 (default 0). 그라가스 자폭의 경우 1 — 자기
   * 스킬로 죽지 않음.
   */
  selfDamageHpFloor?: number;
  /**
   * line / multi 패턴에서 첫 적중 대상에만 stun 적용 (방패 여전사 LeonaCarry 전용).
   * 미지정 / false 시 기존 동작 (stunTargets 만큼 stun).
   */
  firstHitOnlyStun?: boolean;
}

/** 챔피언별 스킬 타게팅 패턴 매핑 */
export const CHAMPION_ABILITY_PATTERNS: Record<string, AbilityConfig> = {
  // === Single ===
  TFT16_Poppy:       { pattern: 'single', stun: 1.0 },
  TFT16_Draven:      { pattern: 'single' },
  TFT16_Vayne:       { pattern: 'single' },
  TFT16_Vi:          { pattern: 'single', stun: 1.0, stunTargets: 1 },
  TFT16_Darius:      { pattern: 'single', heal: true },
  TFT16_BelVeth:     { pattern: 'single' },
  TFT16_Kalista:     { pattern: 'single', debuff: { armorReduction: 10, duration: 5 } },
  TFT16_Leblanc:     { pattern: 'multi', maxTargets: 3, stun: 1.5 },

  // === Line (직선 관통) ===
  TFT16_Lux:         { pattern: 'line', stun: 1.5, stunTargets: 2 },
  TFT16_Yunara:      { pattern: 'line', damageDecay: 0.15 },
  TFT16_Illaoi:      { pattern: 'line', heal: true },
  TFT16_Skarner:     { pattern: 'line', maxTargets: 3, stun: 1.5 },
  TFT16_Ambessa:     { pattern: 'line', dash: 'to_target' },
  TFT16_XinZhao:     { pattern: 'line', maxTargets: 3, stun: 1.0, stunTargets: 1, heal: true },
  TFT16_Renekton:    { pattern: 'line', maxTargets: 3, dash: 'to_lowest_hp' },
  TFT16_Qiyana:      { pattern: 'line', maxTargets: 3, dash: 'to_target' },
  TFT16_Yone:        { pattern: 'line', maxTargets: 3, stun: 1.0 },

  // === AOE Circle (원형 범위) ===
  TFT16_ChoGath:     { pattern: 'aoe_circle', radius: 2, stun: 1.5, heal: true },
  TFT16_Neeko:       { pattern: 'aoe_circle', radius: 2, dash: 'to_target', stun: 1.5 },
  TFT16_Ekko:        { pattern: 'aoe_circle', radius: 2 },
  TFT16_Kennen:      { pattern: 'aoe_circle', radius: 2, stun: 1.5, stunTargets: 3 },
  TFT16_Fiddlesticks:{ pattern: 'aoe_circle', radius: 2, dash: 'to_farthest', stun: 1.5 },
  TFT16_Kindred:     { pattern: 'aoe_circle', radius: 2, dash: 'to_target', selfBuff: { attackSpeed: 1.0, duration: 4 }, heal: true },
  TFT16_Diana:       { pattern: 'aoe_circle', radius: 1, dash: 'to_farthest' },
  TFT16_Lucian:      { pattern: 'aoe_circle', radius: 1 },
  TFT16_Orianna:     { pattern: 'aoe_circle', radius: 2 },
  TFT16_Ornn:        { pattern: 'aoe_circle', radius: 2 },
  TFT16_Ziggs:       { pattern: 'aoe_circle', radius: 1 },
  TFT16_Anivia:      { pattern: 'aoe_circle', radius: 2 },
  TFT16_Swain:       { pattern: 'aoe_circle', radius: 2, stun: 1.5, heal: true },
  TFT16_Gangplank:   { pattern: 'multi', maxTargets: 3, damageDecay: 0.15, debuff: { armorReduction: 15, duration: 5 } },
  TFT16_Leona:       { pattern: 'multi', maxTargets: 3, stun: 1.5 },
  TFT16_Lissandra:   { pattern: 'aoe_circle', radius: 2, stun: 2.0 },
  TFT16_Volibear:    { pattern: 'aoe_circle', radius: 2, dash: 'to_target', selfBuff: { attackSpeed: 0.5, duration: 999 } },
  TFT16_Zoe:         { pattern: 'multi', maxTargets: 3, debuff: { mrReduction: 30, duration: 4 } },
  // === AOE Circle + Dash ===
  TFT16_Briar:       { pattern: 'aoe_circle', radius: 1, dash: 'to_farthest', selfBuff: { attackSpeed: 0.5, ad: 30, duration: 4 } },
  TFT16_Nidalee:     { pattern: 'aoe_circle', radius: 1, dash: 'to_lowest_hp' },
  TFT16_Fizz:        { pattern: 'aoe_circle', radius: 1, dash: 'to_backline', selfBuff: { attackSpeed: 0.4, duration: 3 } },
  TFT16_Yasuo:       { pattern: 'aoe_circle', radius: 1, dash: 'to_target' },
  TFT16_Zaahen:      { pattern: 'aoe_circle', radius: 1, dash: 'to_target' },
  TFT16_Sylas:       { pattern: 'aoe_circle', radius: 2, dash: 'to_target', stun: 1.5 },
  TFT16_Shyvana:     { pattern: 'aoe_circle', radius: 3, dash: 'to_farthest' },

  // === Cone (원뿔) ===
  TFT16_Rumble:      { pattern: 'cone', radius: 2 },
  TFT16_Graves:      { pattern: 'cone', radius: 2 },
  TFT16_Gwen:        { pattern: 'cone', radius: 2, dash: 'to_target' },
  TFT16_Sejuani:     { pattern: 'cone', radius: 2, stun: 1.5 },
  TFT16_RekSai:      { pattern: 'cone', radius: 1, dash: 'to_farthest' },

  // === Multi-target (다수 지정) ===
  TFT16_Aphelios:    { pattern: 'multi', maxTargets: 4, debuff: { armorReduction: 15, duration: 4 } },
  TFT16_Jinx:        { pattern: 'multi', maxTargets: 3 },
  TFT16_Kaisa:       { pattern: 'multi', maxTargets: 4 },
  TFT16_Xerath:      { pattern: 'multi', maxTargets: 3 },
  TFT16_MissFortune: { pattern: 'multi', maxTargets: 4 },
  TFT16_Malzahar:    { pattern: 'multi', maxTargets: 3 },
  TFT16_Tristana:    { pattern: 'multi', maxTargets: 2, stun: 1.0, stunTargets: 1 },
  TFT16_KogMaw:      { pattern: 'multi', maxTargets: 3, debuff: { armorReduction: 10, mrReduction: 10, duration: 5 } },
  TFT16_Ashe:        { pattern: 'multi', maxTargets: 4 },
  TFT16_Jhin:        { pattern: 'multi', maxTargets: 4 },
  TFT16_TwistedFate: { pattern: 'multi', maxTargets: 3 },
  TFT16_Teemo:       { pattern: 'multi', maxTargets: 3 },
  TFT16_Ahri:        { pattern: 'multi', maxTargets: 3 },

  // === Bounce (튕김) ===
  TFT16_Lulu:        { pattern: 'bounce', maxTargets: 2, stun: 2.0, stunTargets: 1 },
  TFT16_Caitlyn:     { pattern: 'bounce', maxTargets: 2, damageDecay: 0.5 },
  TFT16_Ryze:        { pattern: 'bounce', maxTargets: 3, damageDecay: 0.2, heal: true },

  // === Global (전체) ===
  TFT16_Annie:       { pattern: 'aoe_circle', radius: 2 },
  TFT16_Veigar:      { pattern: 'global' },
  TFT16_Brock:       { pattern: 'global', stun: 1.5, stunTargets: 1 },

  // === Self/Buff (자기 버프) ===
  TFT16_Shen:        { pattern: 'self_buff' },
  TFT16_Warwick:     { pattern: 'self_buff', selfBuff: { attackSpeed: 0.5, duration: 999 } },
  TFT16_Tryndamere:  { pattern: 'self_buff', selfBuff: { durability: 0.25, duration: 5 } },
  TFT16_Taric:       { pattern: 'self_buff', heal: true },
  TFT16_Braum:       { pattern: 'self_buff', selfBuff: { durability: 0.3, duration: 4 } },
  TFT16_Seraphine:   { pattern: 'aoe_circle', radius: 2, heal: true },
  TFT16_Milio:       { pattern: 'self_buff' },
  TFT16_Sona:        { pattern: 'self_buff', heal: true },
  TFT16_JarvanIV:    { pattern: 'self_buff', allyBuff: { attackSpeed: 0.3, duration: 6 } },

  // === 미등록 챔피언 추가 (1차) ===
  TFT16_DrMundo:     { pattern: 'self_buff', heal: true },
  TFT16_Garen:       { pattern: 'aoe_circle', radius: 1, selfBuff: { durability: 0.2, duration: 4 }, heal: true },
  TFT16_Nasus:       { pattern: 'multi', maxTargets: 3, selfBuff: { ad: 30, duration: 6 } },
  TFT16_Wukong:      { pattern: 'aoe_circle', radius: 2 },
  TFT16_Sett:        { pattern: 'aoe_circle', radius: 2, stun: 1.5 },
  TFT16_Aatrox:      { pattern: 'aoe_circle', radius: 2, stun: 1.0 },
  TFT16_TahmKench:   { pattern: 'single', stun: 2.5 },
  TFT16_AurelionSol: { pattern: 'aoe_circle', radius: 3 },
  TFT16_Zilean:      { pattern: 'single' },
  TFT16_Loris:       { pattern: 'single', dash: 'to_target', stun: 1.0 },
  TFT16_Singed:      { pattern: 'self_buff', heal: true },
  TFT16_Galio:       { pattern: 'aoe_circle', radius: 2, dash: 'to_farthest', stun: 1.0 },

  // =====================================================
  // Set 17 Champions
  // =====================================================

  // === 1코스트 ===
  TFT17_Briar:       { pattern: 'single', selfBuff: { attackSpeed: 0.5, duration: 999 } },  // 잃은 체력당 AS + 단일 물리
  TFT17_Poppy:       { pattern: 'self_buff' },  // 보호막 + 2칸 내 아군 방어력+마법저항 — combatLoop applyPoppyShieldAndResists 헬퍼에서 처리 (Shield/ShieldDuration/Resists 변수 + AP scaling + 만료)
  TFT17_Veigar:      { pattern: 'aoe_circle', radius: 1, secondaryDamageVar: 'MiniDamage' },  // 정령유성 Damage + 미니유성 MiniDamage
  TFT17_Aatrox:      { pattern: 'single', heal: true },  // 회복 + 단일 물리
  TFT17_Caitlyn:     { pattern: 'single' },  // 패시브 헤드샷 (확률)
  TFT17_Teemo:       { pattern: 'self_buff', selfBuff: { attackSpeed: 0.5, duration: 3 } },  // 패시브 추가 마법 + AS 버프
  TFT17_Nasus:       { pattern: 'aoe_circle', radius: 1, selfBuff: { durability: 0.2, duration: 6 }, dot: { duration: 6 } },  // 변신 6초 + 주변 매초 DOT + 최대체력 +250
  TFT17_TwistedFate:  { pattern: 'single' },  // 카드 던지기 (단일 마법)
  TFT17_Talon:       { pattern: 'single', dash: 'to_target', dot: { duration: 18 } },  // 출혈 18초 DOT + 도약
  TFT17_Ezreal:      { pattern: 'single' },  // 파동 단일 물리
  TFT17_Leona:       { pattern: 'single', stun: 1.5, selfBuff: { durability: 0.3, duration: 4 } },  // 보호막 + 기절
  TFT17_Chogath:     { pattern: 'single', heal: true, damageVar: 'BonusDamage' },  // %최대체력 + 고정 추가 피해 (combatLoop 특수 처리)
  TFT17_Lissandra:   { pattern: 'aoe_circle', radius: 1, secondaryDamageVar: 'SecondaryDamage' },  // 단검 Damage + 폭발 SecondaryDamage
  TFT17_Reksai:      { pattern: 'aoe_circle', radius: 1, stun: 1.0, heal: true },  // 회복 + 인접 공중띄움 (17.2: RekSai → Reksai)

  // === 2코스트 ===
  TFT17_Belveth:     { pattern: 'single', hitCount: 12 },  // 연속 12회 베기
  TFT17_Akali:       { pattern: 'line', maxTargets: 3, dash: 'to_target', debuff: { armorReduction: 15, duration: 4 }, hitCount: 5 },  // 단검 5개 관통 + 방어력 감소
  TFT17_Jinx:        { pattern: 'cone', radius: 2 },  // 원뿔 로켓
  TFT17_Gnar:        { pattern: 'line', maxTargets: 3, damageDecay: 0.3 },  // 부메랑 관통 + 감소
  TFT17_Pyke:        { pattern: 'aoe_circle', radius: 1, dash: 'to_target', damageVar: 'TargetDamage', secondaryDamageVar: 'AoEDamage' },  // 작살+순간이동 TargetDamage + 주변 AoEDamage
  TFT17_Gragas:      { pattern: 'aoe_circle', radius: 1, heal: true, stun: 0.5 },  // 회복 + 인접 피해 + 냉각 2초 (stun 0.5초로 근사)
  TFT17_Gwen:        { pattern: 'cone', radius: 2, dash: 'to_lowest_hp', secondaryDamageVar: 'AreaDamage' },  // 대상 Damage + 원뿔 AreaDamage
  TFT17_Jax:         { pattern: 'aoe_circle', radius: 1, stun: 1.5, selfBuff: { durability: 0.3, duration: 3 } },  // 방어 태세 + 기절
  TFT17_Milio:       { pattern: 'bounce', maxTargets: 4 },  // 공 튕기기
  TFT17_Zoe:         { pattern: 'line', maxTargets: 4 },  // 통통별 관통 + 방향전환
  TFT17_IvernMinion: { pattern: 'aoe_circle', radius: 1, stun: 1.0, heal: true },  // 회복 + 강타 + 열 피해
  TFT17_Mordekaiser: { pattern: 'self_buff' },  // 4초간 매초 펄스 (ShieldPerProc + DamagePerProc) + HealRefund — combatLoop applyMordekaiserProcCast/tickMordekaiserProc 헬퍼
  TFT17_Pantheon:    { pattern: 'cone', radius: 2, selfBuff: { durability: 0.15, duration: 4 }, dot: { duration: 4 } },  // 보호막+내구력 + 원뿔 매초 고정 피해 4초

  // === 3코스트 ===
  TFT17_MissFortune: { pattern: 'multi', maxTargets: 3 },  // 모드에 따라 다름 (기본)
  TFT17_Illaoi:      { pattern: 'aoe_circle', radius: 2, heal: true, dot: { duration: 3 } },  // 보호막 + 3초 체력흡수 DOT + AOE
  TFT17_Aurora:      { pattern: 'aoe_circle', radius: 2 },  // 균열 해킹 + 저장 피해
  TFT17_Fizz:        { pattern: 'line', dash: 'to_target', secondaryDamageVar: 'BiteDamageAP' },  // 관통 돌진 DashDamage + 3회째 정령 BiteDamageAP
  TFT17_Maokai:      { pattern: 'aoe_circle', radius: 2, stun: 1.5 },  // X자 덩굴 + 기절
  TFT17_Kaisa:       { pattern: 'aoe_circle', radius: 2, hitCount: 16 },  // 미사일 16개 반경 2칸 나누어 발사
  TFT17_Urgot:       { pattern: 'cone', radius: 2, selfBuff: { durability: 0.2, duration: 3 }, damageVar: 'ShotgunDamage' },  // 보호막 + 원뿔 폭발 탄환
  TFT17_Viktor:      { pattern: 'aoe_circle', radius: 1, dot: { duration: 4 } },  // 초능력 폭풍 4초 DOT (커지는 AOE)
  TFT17_Samira:      { pattern: 'single', stun: 1.0 },  // 탄환 + 공중띄움
  TFT17_Ornn:        { pattern: 'cone', radius: 2 },  // 보호막 + 원뿔 화염
  TFT17_Lulu:        { pattern: 'multi', maxTargets: 4 },  // 하늘에서 떨어뜨려 주변 적 타격
  TFT17_Diana:       { pattern: 'aoe_circle', radius: 1, selfBuff: { attackSpeed: 0.5, duration: 4 }, damageVar: 'CleaveDamage', dot: { duration: 3 } },  // 보호막 + 3초 구체 회전 DOT
  TFT17_Rhaast:      { pattern: 'line', stun: 1.0, heal: true, selfBuff: { durability: 0.3, duration: 4 } },  // 내구력 + 회복 + 직선 베기

  // === 4코스트 ===
  TFT17_Rammus:      { pattern: 'line', maxTargets: 3, selfBuff: { durability: 0.3, duration: 4 } },  // 보호막 + 직선 3칸
  TFT17_Corki:       { pattern: 'aoe_circle', radius: 2, dash: 'to_target', hitCount: 21, damageVar: 'MissileAD' },  // 저공비행 + 미사일 21개 AOE
  TFT17_Kindred:     { pattern: 'multi', maxTargets: 3, damageVar: 'ADDamage' },  // 제자리에서 화살 3명 ADDamage. 이동은 기본 공격 AI 의 한 칸 이동에 맡긴다 (표식 패시브는 combatLoop)
  TFT17_Karma:       { pattern: 'multi', maxTargets: 3, secondaryDamageVar: 'SecondaryDamage' },  // 블랙홀 3명 분배 + 대상 추가 SecondaryDamage
  TFT17_AurelionSol: { pattern: 'line', damageDecay: 0.15, dot: { duration: 3 } },  // 직선 광선 3초 DOT + 관통 감소
  TFT17_Galio:       { pattern: 'aoe_circle', radius: 2, heal: true, selfBuff: { durability: 0.3, duration: 4 } },  // 방어 태세 + 충격파
  TFT17_MasterYi:    { pattern: 'self_buff', selfBuff: { attackSpeed: 0.8, duration: 5 } },  // 초필살 AS + 흡혈
  TFT17_Nami:        { pattern: 'aoe_circle', radius: 1, secondaryDamageVar: 'FirstBounceDamage' },  // 디스코 방울 분배 + 작은 방울 3개 추가
  TFT17_Nunu:        { pattern: 'aoe_circle', radius: 2, stun: 1.75, damageVar: 'InitialDamage' },  // 보호막 + 2칸 AOE + 띄움 1.75초
  TFT17_Riven:       { pattern: 'aoe_circle', radius: 1, dash: 'to_target', secondaryDamageVar: 'WaveDamage' },  // 돌진+베기 Damage + 3회째 파동 WaveDamage
  TFT17_Leblanc:     { pattern: 'multi', maxTargets: 3, damageVar: 'BoltDamage', hitCount: 5 },  // 분신 5명 투사체 (BoltDamage × 5)
  TFT17_Xayah:       { pattern: 'multi', maxTargets: 3, selfBuff: { attackSpeed: 0.75, duration: 4 }, damageVar: 'ADDamage' },  // AS +75% 4초 + 깃털 회수 3명 ADDamage
  TFT17_TahmKench:   { pattern: 'aoe_circle', radius: 2, heal: true },  // 회복 + 2칸 혀 채찍

  // === 5코스트 ===
  TFT17_Bard:        { pattern: 'aoe_circle', radius: 1, dot: { duration: 4 } },  // 비행접시 4초 DOT + 주변 분배
  TFT17_Fiora:       { pattern: 'single', dash: 'to_target', heal: true },  // 급소 돌진 + 회복
  TFT17_Jhin:        { pattern: 'multi', maxTargets: 3, debuff: { armorReduction: 15, duration: 4 }, hitCount: 4, damageVar: 'APDamage' },  // 잔상 손 4개 × 4회 사격 APDamage
  TFT17_Blitzcrank:  { pattern: 'aoe_circle', radius: 3, stun: 1.5, stunTargets: 1, damageVar: 'ExplosionDamage' },  // 띄움 1명 + 폭발 3칸
  TFT17_Sona:        { pattern: 'multi', maxTargets: 3, secondaryDamageVar: 'SlamDamage' },  // 파편 DebrisDamage + 5회째 SlamDamage 폭발 + 기절
  TFT17_Vex:         { pattern: 'aoe_circle', radius: 1, damageVar: 'ShadowHandMagicDamage', hitCount: 3 },  // 강화 타격 3회
  TFT17_Shen:        { pattern: 'aoe_circle', radius: 2, selfBuff: { attackSpeed: 0.3, duration: 999 } },  // 보호막 + 균열 AOE + AS둔화
  TFT17_Zed:         { pattern: 'self_buff' },  // 분신 소환 (복제)
  TFT17_Graves:      { pattern: 'cone', radius: 2, secondaryDamageVar: 'SecondaryDamageAD' },  // 원뿔 스킬 Damage + 인접 SecondaryDamageAD
  TFT17_Morgana:     { pattern: 'multi', maxTargets: 3, heal: true, dot: { duration: 5 } },  // 변신 + 사슬 3명 5초 DOT + 최종 폭발

  // === 미등록 챔피언 추가 (2차 — audit 검출분) ===
  TFT16_Blitzcrank:  { pattern: 'aoe_circle', radius: 2 },               // 보호막 + 주변 적 데미지
  TFT16_Viego:       { pattern: 'single', selfBuff: { attackSpeed: 0.3, duration: 999 } }, // 패시브 AS + 단일 대상 물리
  TFT16_Bard:        { pattern: 'multi', maxTargets: 4 },                 // 주변 적에게 정령 발사
  TFT16_Nautilus:    { pattern: 'self_buff' },                            // 보호막 + 패시브 AOE (보호막 중심)
  TFT16_Sion:        { pattern: 'self_buff' },                            // 보호막 + 파괴 시 AOE (보호막 중심)
  TFT16_Yorick:      { pattern: 'aoe_circle', radius: 1, heal: true },    // 힐 + 안개 구 + AOE
  TFT16_Thresh:      { pattern: 'aoe_circle', radius: 2, heal: true },    // 주변 DOT + 감옥 장벽
  TFT16_Mel:         { pattern: 'multi', maxTargets: 3 },                 // 찬란한 구체 → 적 주위 발사
  TFT16_Kobuko:      { pattern: 'self_buff', heal: true, allyBuff: { attackSpeed: 0.3, duration: 4 } }, // 유미 합체: 힐 + AS 버프
  TFT16_Azir:        { pattern: 'multi', maxTargets: 3 },                 // 모래 병사 소환 → 공격 명령
  TFT16_Atakhan:     { pattern: 'aoe_circle', radius: 2 },               // 패시브 N회 공격 후 AOE
};

/** 스킬 패턴에 따라 피해 대상 유닛 리스트 반환 */
export function findAbilityTargets(
  caster: CombatUnit,
  primaryTarget: CombatUnit,
  allEnemies: CombatUnit[],
  config: AbilityConfig,
): CombatUnit[] {
  const alive = allEnemies.filter(u => u.state !== 'dead');

  switch (config.pattern) {
    case 'single':
      return [primaryTarget];

    case 'line': {
      const lineHexes = getHexesInLine(caster.position, primaryTarget.position, 8);
      const lineSet = new Set(lineHexes.map(h => `${h.q},${h.r}`));
      const targets = alive.filter(u => lineSet.has(`${u.position.q},${u.position.r}`));
      // 거리순 정렬
      targets.sort((a, b) => hexDistance(caster.position, a.position) - hexDistance(caster.position, b.position));
      if (config.maxTargets) return targets.slice(0, config.maxTargets);
      return targets;
    }

    case 'aoe_circle': {
      const radius = config.radius ?? 1;
      const aoeHexes = getHexesInRadius(primaryTarget.position, radius);
      const aoeSet = new Set(aoeHexes.map(h => `${h.q},${h.r}`));
      return alive.filter(u => aoeSet.has(`${u.position.q},${u.position.r}`));
    }

    case 'cone': {
      const radius = config.radius ?? 2;
      const coneHexes = getHexesInCone(caster.position, primaryTarget.position, radius);
      const coneSet = new Set(coneHexes.map(h => `${h.q},${h.r}`));
      return alive.filter(u => coneSet.has(`${u.position.q},${u.position.r}`));
    }

    case 'multi': {
      const max = config.maxTargets ?? 3;
      const sorted = [...alive].sort((a, b) =>
        hexDistance(caster.position, a.position) - hexDistance(caster.position, b.position)
      );
      return sorted.slice(0, max);
    }

    case 'bounce': {
      const max = config.maxTargets ?? 2;
      const targets: CombatUnit[] = [primaryTarget];
      const hit = new Set([primaryTarget.id]);
      let lastPos = primaryTarget.position;
      while (targets.length < max) {
        const candidates = alive.filter(u => !hit.has(u.id));
        if (candidates.length === 0) break;
        candidates.sort((a, b) =>
          hexDistance(lastPos, a.position) - hexDistance(lastPos, b.position)
        );
        const next = candidates[0];
        targets.push(next);
        hit.add(next.id);
        lastPos = next.position;
      }
      return targets;
    }

    case 'global':
      return alive;

    case 'self_buff':
      return [caster];

    case 'x_shape': {
      // PR7-A (17.2b): 파이크 carry "X 모양으로 베기" — 대상 + 4 diagonal hex direction.
      // axial 6 directions 중 horizontal (E/W = [±1, 0]) 제외, 4 angled direction 선택:
      //   NE [+1,-1], NW [0,-1], SE [0,+1], SW [-1,+1]
      // 시각적으로 X 형태. 사용자 결정 (PR #?? 후속) — raw 데이터 비어있어 추정.
      const tp = primaryTarget.position;
      const xHexes: { q: number; r: number }[] = [
        tp, // 대상 본인
        { q: tp.q + 1, r: tp.r - 1 }, // NE
        { q: tp.q,     r: tp.r - 1 }, // NW
        { q: tp.q,     r: tp.r + 1 }, // SE
        { q: tp.q - 1, r: tp.r + 1 }, // SW
      ];
      const xSet = new Set(xHexes.map(h => `${h.q},${h.r}`));
      return alive.filter(u => xSet.has(`${u.position.q},${u.position.r}`));
    }

    default:
      return [primaryTarget];
  }
}

/** 피해 타입 판별 — 한글 desc 우선, HTML 태그 폴백 */
function detectDamageType(desc: string): DamageType {
  if (desc.includes('고정 피해')) return 'true';
  if (desc.includes('물리 피해')) return 'physical';
  if (desc.includes('마법 피해')) return 'magic';
  if (desc.includes('<trueDamage>')) return 'true';
  if (desc.includes('<physicalDamage>')) return 'physical';
  return 'magic';
}

/** 스케일링 판별 — 변수명 접미사 + desc 폴백 */
function detectScaling(varName: string | null, desc: string): 'ap' | 'ad' | 'none' {
  if (varName) {
    if (/AD/.test(varName) && !/DAm/.test(varName)) return 'ad';
    if (/AP/.test(varName)) return 'ap';
  }
  if (desc.includes('scaleAD')) return 'ad';
  if (desc.includes('scaleAP')) return 'ap';
  if (desc.includes('물리 피해')) return 'ad';
  if (desc.includes('마법 피해')) return 'ap';
  return 'ap';
}

/** 피해 변수 탐색 우선순위 목록 */
const DAMAGE_VAR_PRIORITY = [
  'Damage', 'MagicDamage', 'PhysicalDamage', 'TotalDamage',
  'ADDamage', 'APDamage', 'DamageAD', 'DamageAP',
  'BonusDamage', 'DamagePerTick', 'DamagePerSecond', 'DamagePerProc',
  'PassiveDamage', 'SpellDamage', 'InitialDamage',
];

/** 피해 변수 찾기 — 우선순위 매칭 → 이름에 'Damage'/'damage' 포함 → null */
function findDamageVariable(variables: RawChampion['ability']['variables']): RawChampion['ability']['variables'][0] | null {
  if (!variables || variables.length === 0) return null;

  // 1순위: 정확 매칭
  for (const name of DAMAGE_VAR_PRIORITY) {
    const v = variables.find(vr => vr.name === name);
    if (v) return v;
  }

  // 2순위: 이름에 'Damage' 포함 (대소문자 구분)
  const fuzzy = variables.find(v => v.name.includes('Damage') || v.name.includes('damage'));
  if (fuzzy) return fuzzy;

  // 3순위: variables[0] 폴백 (피해 텍스트가 있지만 변수명에 Damage가 없는 경우)
  return variables[0];
}

export function parseAbility(champion: RawChampion, damageVarOverride?: string): ParsedAbility {
  const desc = champion.ability.desc;
  const variables = champion.ability.variables;

  const damageType = detectDamageType(desc);

  // damageVar 오버라이드: AbilityConfig.damageVar로 직접 지정된 경우
  let damageVar: RawChampion['ability']['variables'][0] | null = null;
  if (damageVarOverride) {
    damageVar = variables.find(v => v.name === damageVarOverride) ?? null;
  }
  if (!damageVar) {
    damageVar = findDamageVariable(variables);
  }

  const scalingType = damageVar ? detectScaling(damageVar.name, desc) : 'none';

  return {
    damageType,
    scalingType,
    damageValues: damageVar?.value || [0, 0, 0, 0],
    damageVarName: damageVar?.name || null,
  };
}

export function getAbilityDamage(
  champion: RawChampion,
  starLevel: number,
  ap: number,
  bonusAdPercent: number = 0,
  damageVarOverride?: string,
): { damage: number; type: DamageType } {
  const parsed = parseAbility(champion, damageVarOverride);

  // codex P2 (audit 2026-05-07): shifted indexing fix — `readVarByStar`
  //   (combatLoop.ts:172) 동일 sentinel filler 판별 logic.
  //   non-filler raw [200, 250, 375] → ★1=raw[0]=200 (정확)
  //   filler raw [0, 300, 375] → ★1=raw[1]=300 (정확)
  //   이전 로직 `damageValues[starLevel]` 는 non-filler 에서 ★+1 over-scaled.
  const values = parsed.damageValues;
  let baseValue: number;
  if (!values || values.length === 0) {
    baseValue = 0;
  } else if (values.length === 1) {
    baseValue = values[0];
  } else {
    const v0 = values[0];
    const v1 = values[1];
    // codex P1 (PR #99): 작은 sentinel (2.5 등) 도 filler 로 분류.
    const sentinelRatio = v0 > 0 && v1 / v0 > 5;
    const isFiller = v0 === 0 || v0 > v1 || sentinelRatio;
    const idx = isFiller ? starLevel : starLevel - 1;
    baseValue = values[idx] ?? values[isFiller ? 1 : 0] ?? 0;
  }

  let damage = baseValue;
  if (parsed.scalingType === 'ap') {
    damage = baseValue * (1 + ap / 100);
  } else if (parsed.scalingType === 'ad') {
    damage = baseValue * (1 + bonusAdPercent);
  }

  return { damage, type: parsed.damageType };
}

/** 어빌리티에 보호막이 있으면 보호막 수치 반환 */
export function getAbilityShield(
  champion: RawChampion,
  starLevel: number,
  ap: number,
): number {
  const variables = champion.ability.variables;
  const desc = champion.ability.desc;

  if (!desc.includes('보호막') && !desc.includes('Shield')) return 0;

  const shieldVarNames = ['Shield', 'APShield', 'ShieldAmount', 'LuxShield'];
  let shieldVar = variables.find(v => shieldVarNames.some(n => v.name.includes(n)));
  if (!shieldVar) {
    shieldVar = variables.find(v => v.name.toLowerCase().includes('shield'));
  }
  if (!shieldVar || !shieldVar.value) return 0;

  const baseValue = shieldVar.value[starLevel] ?? shieldVar.value[1] ?? 0;
  if (baseValue <= 0) return 0;

  const scalesWithAp = desc.includes('scaleAP');
  return scalesWithAp ? baseValue * (1 + ap / 100) : baseValue;
}

// =====================================================
// 전투 내 챔피언 스케일링 시스템
// JSON 기반 — public/data/tft_set{N}_scaling.json에서 로드
// =====================================================

/** JSON에서 로드된 챔피언 스케일링 raw 데이터 */
export interface ScalingChampionData {
  trigger: string;
  every?: number;
  desc: string;
  effect: { type: string; damageType?: string; scaling?: string };
  [key: string]: unknown; // 챔피언별 수치 필드 (패치마다 변경)
}

export interface ScalingData {
  meta: { set: number; patch: string };
  champions: Record<string, ScalingChampionData>;
  synergies: Record<string, Record<string, unknown>>;
}

/** 스케일링 데이터 캐시 */
let scalingData: ScalingData | null = null;

export function setScalingData(data: ScalingData): void {
  scalingData = data;
}

export function getScalingData(): ScalingData | null {
  return scalingData;
}

export function getChampionScaling(apiName: string): ScalingChampionData | null {
  return scalingData?.champions[apiName] ?? null;
}

export function getSynergyScaling(apiName: string): Record<string, unknown> | null {
  return scalingData?.synergies[apiName] ?? null;
}

/** 성급별 수치 배열에서 값 추출 (index 0=base, 1=1성, 2=2성, 3=3성) */
export function starValue(arr: number[] | undefined, starLevel: number): number {
  if (!arr) return 0;
  return arr[starLevel] ?? arr[1] ?? 0;
}

