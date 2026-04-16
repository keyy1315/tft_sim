# Design: 아이오니아 시너지 — 길 선택 + 전투 능력치 적용

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 아이오니아 시너지 길 선택 |
| Plan 참조 | `docs/01-plan/features/ionia-path.plan.md` |
| 작성일 | 2026-03-23 |
| 상태 | Design |

---

## 1. 타입 정의

### 1.1 아이오니아 길 타입

`src/data/traitModules.ts`에 추가:

```typescript
export type IoniaPathType = 'blades' | 'enlightenment' | 'transcendence' | 'generosity' | 'spirit';

export const IONIA_PATH_NAMES: Record<IoniaPathType, string> = {
  blades: '검의 길',
  enlightenment: '깨달음의 길',
  transcendence: '초월의 길',
  generosity: '번영의 길',
  spirit: '영혼의 길',
};
```

---

## 2. SimulateOptions 확장

```typescript
// combatLoop.ts
export interface SimulateOptions {
  // ... 기존 필드 ...
  playerIoniaPath?: IoniaPathType;
  enemyIoniaPath?: IoniaPathType;
}
```

---

## 3. 전투 엔진 — 아이오니아 능력치 적용

### 3.1 적용 함수

`combatLoop.ts`에 추가:

```typescript
function applyIoniaPath(
  activeTraits: ActiveTrait[],
  teamUnits: CombatUnit[],
  pathType: IoniaPathType,
  logs: CombatLog[],
  rng: SeededRNG,
): void
```

### 3.2 호출 위치

`simulateCombat()` 내 전투 시작 전, Warden 보호막 적용 후:

```typescript
applyWardenShields(playerActiveTraits, playerUnits);
applyWardenShields(enemyActiveTraits, enemies);

// 아이오니아 길 적용
if (options.playerIoniaPath) {
  applyIoniaPath(playerActiveTraits, playerUnits, options.playerIoniaPath, logs, rng);
}
if (options.enemyIoniaPath) {
  applyIoniaPath(enemyActiveTraits, enemies, options.enemyIoniaPath, logs, rng);
}
```

### 3.3 길별 적용 로직

아이오니아 trait의 `activeEffect.variables`에서 수치를 읽어 적용.
**대상**: 아이오니아 trait을 가진 유닛 (`champion.traits.includes('아이오니아')`)

```typescript
function applyIoniaPath(
  activeTraits: ActiveTrait[],
  teamUnits: CombatUnit[],
  pathType: IoniaPathType,
  logs: CombatLog[],
  rng: SeededRNG,
): void {
  const ionia = activeTraits.find(t => t.trait.apiName === 'TFT16_Ionia' && t.activeEffect);
  if (!ionia || !ionia.activeEffect) return;
  const vars = ionia.activeEffect.variables;

  // 아이오니아 유닛만 대상
  const ioniaUnits = teamUnits.filter(u =>
    u.state !== 'dead' && u.champion.traits.includes('아이오니아')
  );
  if (ioniaUnits.length === 0) return;

  switch (pathType) {
    case 'blades': {
      // 검의 길: 확률 기반 추가 피해는 전투 루프에서 처리 (별도 필드)
      // 여기서는 로그만
      const chance = (vars['BladesPercentChance'] ?? 30) as number;
      // CombatUnit에 ioniaBladeChance 저장 필요
      for (const u of ioniaUnits) {
        (u as CombatUnit & { ioniaBladeChance?: number }).ioniaBladeChance = chance / 100;
      }
      pushLog(`[아이오니아] 검의 길 적용! 기본 공격 시 ${chance}% 확률 추가 피해`);
      break;
    }
    case 'enlightenment': {
      const adap = (vars['EnlightenmentADAP'] ?? 10) as number;
      for (const u of ioniaUnits) {
        u.stats.damage += adap;
        u.stats.ap += adap;
      }
      pushLog(`[아이오니아] 깨달음의 길 적용! AD+AP +${adap}`);
      break;
    }
    case 'transcendence': {
      const hpPct = (vars['TranscendenceHealth'] ?? 0.10) as number;
      const magicAmp = (vars['TranscendenceMagicDamage'] ?? 0.20) as number;
      for (const u of ioniaUnits) {
        const hpGain = Math.round(u.maxHp * hpPct);
        u.maxHp += hpGain;
        u.currentHp += hpGain;
        u.damageAmp += magicAmp; // 마법 피해 증폭
      }
      pushLog(`[아이오니아] 초월의 길 적용! 체력 +${Math.round(hpPct*100)}%, 마법 피해 +${Math.round(magicAmp*100)}%`);
      break;
    }
    case 'generosity': {
      const adap = (vars['GenerosityADAP'] ?? 10) as number;
      for (const u of ioniaUnits) {
        u.stats.damage += adap;
        u.stats.ap += adap;
      }
      pushLog(`[아이오니아] 번영의 길 적용! AD+AP +${adap}`);
      break;
    }
    case 'spirit': {
      const adap = (vars['SpiritADAP'] ?? 3) as number;
      const hpPct = (vars['SpiritHealth'] ?? 0.25) as number;
      for (const u of ioniaUnits) {
        u.stats.damage += adap;
        u.stats.ap += adap;
        const hpGain = Math.round(u.maxHp * hpPct);
        u.maxHp += hpGain;
        u.currentHp += hpGain;
      }
      pushLog(`[아이오니아] 영혼의 길 적용! AD+AP +${adap}, 체력 +${Math.round(hpPct*100)}%`);
      break;
    }
  }
}
```

### 3.4 검의 길 — 공격 데미지 계산부

검의 길은 전투 중 확률적으로 추가 피해가 발생하므로, 공격 데미지 계산부에 로직 추가:

```typescript
// combatLoop.ts — 일반 공격 데미지 계산 후
// ioniaBladeChance 체크
const bladeChance = (unit as CombatUnit & { ioniaBladeChance?: number }).ioniaBladeChance ?? 0;
if (bladeChance > 0 && rng.next() < bladeChance) {
  const bladeDmg = (unit as CombatUnit & { ioniaBladeFlat?: number }).ioniaBladeFlat ?? 0;
  const bonusDmg = bladeDmg > 0 ? bladeDmg : Math.round(unit.stats.damage * 0.5);
  finalDamage += bonusDmg;
}
```

**MVP 단순화**: 10단계의 `BladesFlatDamage`(25)가 아닌 이상, 추가 피해는 AD의 50%로 고정. 10단계만 flat 25 적용.

---

## 4. UI — 길 선택 패널

### 4.1 useTeamManagement 확장

```typescript
const [playerIoniaPath, setPlayerIoniaPath] = useState<IoniaPathType | null>(null);
const [enemyIoniaPath, setEnemyIoniaPath] = useState<IoniaPathType | null>(null);
```

return에 추가:
```typescript
playerIoniaPath, setPlayerIoniaPath,
enemyIoniaPath, setEnemyIoniaPath,
```

### 4.2 SynergyPanel에 길 선택 드롭다운

아이오니아 시너지가 활성화된 경우 SynergyPanel 하단에 드롭다운 표시.

```tsx
// SynergyPanel.tsx props 확장
interface SynergyPanelProps {
  // ... 기존 ...
  ioniaPath?: IoniaPathType | null;
  onIoniaPathChange?: (path: IoniaPathType) => void;
}
```

아이오니아 trait이 활성(`activeEffect !== null`)일 때만 표시:

```tsx
{ioniaActive && onIoniaPathChange && (
  <select
    value={ioniaPath ?? ''}
    onChange={e => onIoniaPathChange(e.target.value as IoniaPathType)}
    className="w-full bg-gray-800 text-white text-xs rounded px-2 py-1 mt-1"
  >
    <option value="">길 선택...</option>
    {Object.entries(IONIA_PATH_NAMES).map(([key, name]) => (
      <option key={key} value={key}>{name}</option>
    ))}
  </select>
)}
```

### 4.3 page.tsx — simulateCombat 옵션 전달

```typescript
const result = simulateCombat(mappedPlayer, tm.enemyTeam, {
  // ... 기존 옵션 ...
  playerIoniaPath: tm.playerIoniaPath ?? undefined,
  enemyIoniaPath: tm.enemyIoniaPath ?? undefined,
});
```

`useCallback` deps에 `tm.playerIoniaPath`, `tm.enemyIoniaPath` 추가.

---

## 5. 구현 순서

| Step | 내용 | 파일 |
|------|------|------|
| 1 | `IoniaPathType`, `IONIA_PATH_NAMES` 상수 추가 | `traitModules.ts` |
| 2 | `SimulateOptions`에 `playerIoniaPath`/`enemyIoniaPath` 추가 | `combatLoop.ts` |
| 3 | `applyIoniaPath()` 함수 구현 | `combatLoop.ts` |
| 4 | `simulateCombat()` 내 호출 추가 | `combatLoop.ts` |
| 5 | 검의 길 — 공격 데미지 계산부에 확률 추가 피해 로직 | `combatLoop.ts` |
| 6 | `useTeamManagement`에 ioniaPath 상태 추가 | `useTeamManagement.ts` |
| 7 | `SynergyPanel`에 드롭다운 UI 추가 | `SynergyPanel.tsx` |
| 8 | `page.tsx`에 ioniaPath 전달 + deps 추가 | `page.tsx` |
| 9 | 빌드 검증 | — |

---

## 6. 수용 기준

1. 아이오니아 시너지 활성 시 SynergyPanel에 길 선택 드롭다운 표시
2. 깨달음/번영: 아이오니아 유닛 AD+AP 증가
3. 초월: 아이오니아 유닛 체력 % 증가 + 마법 피해 증폭
4. 영혼: AD+AP + 체력 % 증가
5. 검: 기본 공격 시 확률적 추가 피해 발동
6. 전투 로그에 `[아이오니아]` 길 적용 로그
7. 빌드 통과
