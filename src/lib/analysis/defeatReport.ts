import type { CombatResult, CombatUnit } from '@/types';
import type { DefeatReportResult, VulnerabilityFactor } from '@/types/analysis';

const TICKS_PER_SECOND = 30;

function ticksToSeconds(ticks: number): number {
  return Math.round((ticks / TICKS_PER_SECOND) * 10) / 10;
}

/** 유닛의 생존 틱 추정 (사망 로그 기반) */
function getDeathTick(unitId: string, result: CombatResult): number | null {
  const deathLog = result.logs.find(l => l.type === 'death' && l.sourceId === unitId);
  return deathLog ? deathLog.tick : null;
}

/** carry 판정: cost × starLevel 높은 순 */
function findCarry(units: CombatUnit[]): CombatUnit | null {
  return units
    .filter(u => u.team === 'player')
    .sort((a, b) => {
      const scoreA = a.champion.cost * a.starLevel + a.items.length;
      const scoreB = b.champion.cost * b.starLevel + b.items.length;
      return scoreB - scoreA;
    })[0] ?? null;
}

/**
 * 시뮬레이션 결과에서 취약 요인을 추출한다.
 * "패배 원인"이 아닌 "엔진 기준 취약 요인"으로 표현.
 */
export function generateDefeatReport(result: CombatResult): DefeatReportResult {
  const factors: VulnerabilityFactor[] = [];
  const totalTicks = result.duration * TICKS_PER_SECOND;
  const playerUnits = result.playerUnits;
  const carry = findCarry(playerUnits);

  // 1. carry_died_early: 캐리가 전투 시간의 30% 이내에 사망
  if (carry) {
    const deathTick = getDeathTick(carry.id, result);
    if (deathTick !== null && deathTick < totalTicks * 0.3) {
      factors.push({
        type: 'carry_died_early',
        severity: 'critical',
        message: `캐리(${carry.champion.name})가 ${ticksToSeconds(deathTick)}초 만에 사망 (전투의 ${Math.round(deathTick / totalTicks * 100)}%)`,
        tickRange: [0, deathTick],
        unitIds: [carry.id],
      });
    }
  }

  // 2. damage_spread: 메인 딜러의 딜 비중이 40% 미만
  const totalPlayerDamage = playerUnits.reduce((sum, u) => sum + u.totalDamageDealt, 0);
  if (carry && totalPlayerDamage > 0) {
    const carryDamageShare = carry.totalDamageDealt / totalPlayerDamage;
    if (carryDamageShare < 0.4) {
      factors.push({
        type: 'damage_spread',
        severity: 'major',
        message: `딜 분산: ${carry.champion.name}의 딜 비중 ${Math.round(carryDamageShare * 100)}% (40% 미만)`,
        unitIds: [carry.id],
      });
    }
  }

  // 3. no_frontline: 전열 유닛(Tank role)이 1명 이하
  const tanks = playerUnits.filter(u => u.role === 'Tank');
  if (tanks.length <= 1) {
    factors.push({
      type: 'no_frontline',
      severity: 'major',
      message: `전열 부족: 탱커 ${tanks.length}명 — 캐리 보호 취약`,
      unitIds: tanks.map(t => t.id),
    });
  }

  // 4. cc_chain: 캐리에 스턴/둔화가 2초(60틱) 이상 연속
  if (carry) {
    const ccLogs = result.logs.filter(
      l => l.type === 'status_apply' && l.targetId === carry.id &&
           (l.statusType === 'stun' || l.statusType === 'slow')
    );
    if (ccLogs.length >= 2) {
      let maxChain = 0;
      for (let i = 1; i < ccLogs.length; i++) {
        const gap = ccLogs[i].tick - ccLogs[i - 1].tick;
        if (gap < 60) maxChain++;
      }
      if (maxChain >= 2) {
        factors.push({
          type: 'cc_chain',
          severity: 'major',
          message: `${carry.champion.name}에게 CC가 ${maxChain + 1}회 연속 적중`,
          unitIds: [carry.id],
        });
      }
    }
  }

  // 5. targeting_issue: 캐리가 탱커를 공격한 시간이 50% 초과
  if (carry) {
    const carryAttacks = result.logs.filter(
      l => l.type === 'attack' && l.sourceId === carry.id
    );
    const enemyUnits = result.enemyUnits;
    const tankIds = new Set(enemyUnits.filter(u => u.role === 'Tank').map(u => u.id));
    const tankAttacks = carryAttacks.filter(l => l.targetId && tankIds.has(l.targetId));
    if (carryAttacks.length > 0 && tankAttacks.length / carryAttacks.length > 0.5) {
      factors.push({
        type: 'targeting_issue',
        severity: 'minor',
        message: `${carry.champion.name}의 공격 중 ${Math.round(tankAttacks.length / carryAttacks.length * 100)}%가 탱커 대상`,
        unitIds: [carry.id],
      });
    }
  }

  // 요약 생성
  const criticals = factors.filter(f => f.severity === 'critical');
  const summary = criticals.length > 0
    ? criticals[0].message
    : factors.length > 0
      ? `${factors.length}개 취약 요인 발견`
      : '특이사항 없음';

  return {
    confidence: 'estimated',
    combatResult: result,
    factors,
    summary,
  };
}
