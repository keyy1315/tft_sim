import { useState, useMemo } from 'react';
import { PlacedChampion, HexCoord, RawChampion, RawItem, RawAugment, MfMode, PERMANENT_STACK_CONFIG, ArbiterLaw, offsetToAxial } from '@/types';
import { BOARD_COLS, DEFAULT_STAR_LEVEL } from '@/lib/simulator/models/constants';
import { resolveTraits } from '@/lib/simulator/systems/trait';
import { canEquipItem, canAddPiltoverModule, isVoidMutation } from '@/lib/simulator/systems/item';
import { getDefaultStacks } from '@/lib/simulator/systems/augment';
import { FRELJORD_TURRET, TIBBERS_CHAMPION, AZIR_SOLDIER_CHAMPION, AZIR_MAX_SOLDIERS, VOYAGER_SUMMON_CHAMPION, SHEN_ARTIFACT_CHAMPION, PRIMORDIAN_BOSS_CHAMPION, DARKSTAR_BLACKHOLE_CHAMPION, isAutoUnit } from '@/data/specialUnits';
import type { IoniaPathType } from '@/data/traitModules';
import type { StargazerConstellationId } from '@/lib/actualData/types';
import { RawTrait } from '@/types';

// === Helper functions ===

function getTeamFromRow(row: number): 'player' | 'enemy' {
  return row < 4 ? 'enemy' : 'player';
}

function parseCellId(id: string): { row: number; col: number } | null {
  const match = id.match(/^cell-(\d+)-(\d+)$/);
  if (!match) return null;
  return { row: parseInt(match[1]), col: parseInt(match[2]) };
}

function getFreljordTurretCount(team: PlacedChampion[]): number {
  const freljordCount = team.filter(p =>
    p.champion.traits.includes('프렐요드') && p.champion.apiName !== 'TFT16_FreljordTurret'
  ).length;
  if (freljordCount >= 7) return 2;
  if (freljordCount >= 5) return 2;
  if (freljordCount >= 3) return 1;
  return 0;
}

function findEmptyAdjacentHex(pos: HexCoord, occupied: Set<string>, maxRow: number = 3): HexCoord | null {
  const offsets: HexCoord[] = [
    { q: 0, r: -1 }, { q: 1, r: -1 },
    { q: 1, r: 0 }, { q: -1, r: 0 },
    { q: 0, r: 1 }, { q: -1, r: 1 },
  ];
  for (const off of offsets) {
    const c = { q: pos.q + off.q, r: pos.r + off.r };
    const col = c.q + Math.floor(c.r / 2);
    if (c.r >= 0 && c.r <= maxRow && col >= 0 && col < BOARD_COLS) {
      if (!occupied.has(`${c.q},${c.r}`)) return c;
    }
  }
  for (let r = 0; r <= maxRow; r++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const q = col - Math.floor(r / 2);
      if (!occupied.has(`${q},${r}`)) return { q, r };
    }
  }
  return null;
}

function syncFreljordTurretsInTeam(team: PlacedChampion[]): PlacedChampion[] {
  const turretCount = getFreljordTurretCount(team);
  const currentTurrets = team.filter(p => p.champion.apiName === 'TFT16_FreljordTurret');
  const nonTurrets = team.filter(p => p.champion.apiName !== 'TFT16_FreljordTurret');

  if (turretCount === 0) {
    return currentTurrets.length > 0 ? nonTurrets : team;
  }

  if (currentTurrets.length === turretCount) return team;

  if (currentTurrets.length > turretCount) {
    return [...nonTurrets, ...currentTurrets.slice(0, turretCount)];
  }

  const result = [...nonTurrets, ...currentTurrets];
  const occupied = new Set(result.map(p => `${p.position.q},${p.position.r}`));
  for (let i = currentTurrets.length; i < turretCount; i++) {
    const pos = findEmptyAdjacentHex({ q: 1, r: 1 }, occupied, 3);
    if (pos) {
      result.push({ champion: FRELJORD_TURRET, position: pos, starLevel: 1, items: [] });
      occupied.add(`${pos.q},${pos.r}`);
    }
  }
  return result;
}

function syncTibbersInTeam(team: PlacedChampion[]): PlacedChampion[] {
  const annie = team.find(p => p.champion.apiName === 'TFT16_Annie');
  const tibbersIdx = team.findIndex(p => p.champion.apiName === 'TFT16_AnnieTibbers');

  if (!annie) {
    return tibbersIdx >= 0 ? team.filter((_, i) => i !== tibbersIdx) : team;
  }

  if (tibbersIdx >= 0) {
    if (team[tibbersIdx].starLevel !== annie.starLevel) {
      return team.map((p, i) => i === tibbersIdx ? { ...p, starLevel: annie.starLevel } : p);
    }
    return team;
  }

  const occupied = new Set(team.map(p => `${p.position.q},${p.position.r}`));
  const pos = findEmptyAdjacentHex(annie.position, occupied);
  if (!pos) return team;

  return [...team, { champion: TIBBERS_CHAMPION, position: pos, starLevel: annie.starLevel, items: [] }];
}

function syncAzirSoldiersInTeam(team: PlacedChampion[]): PlacedChampion[] {
  const azir = team.find(p => p.champion.apiName === 'TFT16_Azir');
  const soldiers = team.filter(p => p.champion.apiName === 'TFT16_AzirSoldier');

  if (!azir) {
    return soldiers.length > 0 ? team.filter(p => p.champion.apiName !== 'TFT16_AzirSoldier') : team;
  }

  let result = team.map(p =>
    p.champion.apiName === 'TFT16_AzirSoldier' && p.starLevel !== azir.starLevel
      ? { ...p, starLevel: azir.starLevel } : p
  );

  const currentCount = soldiers.length;
  if (currentCount < AZIR_MAX_SOLDIERS) {
    const occupied = new Set(result.map(p => `${p.position.q},${p.position.r}`));
    for (let i = currentCount; i < AZIR_MAX_SOLDIERS; i++) {
      const pos = findEmptyAdjacentHex(azir.position, occupied);
      if (!pos) break;
      occupied.add(`${pos.q},${pos.r}`);
      result = [...result, {
        champion: AZIR_SOLDIER_CHAMPION,
        position: pos,
        starLevel: azir.starLevel,
        items: [],
      }];
    }
  }
  return result;
}

/**
 * 길잡이 활성 시너지 티어 → 비아와 바이엔 소환체 별 레벨 매핑.
 *   3 길잡이 → 1성
 *   5 길잡이 → 2성
 *   7 길잡이 (6명 + 상징) → 3성
 *   < 3 → 소환하지 않음
 *
 * 길잡이 수는 active trait count(상징 포함)를 사용한다.
 */
function getVoyagerSummonStarLevel(activeVoyagerCount: number): 1 | 2 | 3 | null {
  if (activeVoyagerCount >= 7) return 3;
  if (activeVoyagerCount >= 5) return 2;
  if (activeVoyagerCount >= 3) return 1;
  return null;
}

function syncVoyagerSummonInTeam(
  team: PlacedChampion[],
  activeVoyagerCount: number,
): PlacedChampion[] {
  const targetStar = getVoyagerSummonStarLevel(activeVoyagerCount);
  const existingIdx = team.findIndex(p => p.champion.apiName === 'TFT17_Summon');

  // 시너지 비활성 → 기존 소환체 제거
  if (targetStar === null) {
    return existingIdx >= 0 ? team.filter((_, i) => i !== existingIdx) : team;
  }

  // 이미 존재하면 별 레벨만 맞춤
  if (existingIdx >= 0) {
    if (team[existingIdx].starLevel === targetStar) return team;
    return team.map((p, i) =>
      i === existingIdx ? { ...p, starLevel: targetStar } : p,
    );
  }

  // 신규 소환
  const occupied = new Set(team.map(p => `${p.position.q},${p.position.r}`));
  const pos = findEmptyAdjacentHex({ q: 2, r: 2 }, occupied, 3);
  if (!pos) return team;
  return [...team, {
    champion: VOYAGER_SUMMON_CHAMPION,
    position: pos,
    starLevel: targetStar,
    items: [],
    isSummon: true,
  }];
}

/** 쉔이 있으면 옆칸에 "유물"(TFT17_ShenProp) 을 자동 소환, 쉔이 없으면 제거. 보루 시너지 unique trait. */
function syncShenArtifactInTeam(team: PlacedChampion[]): PlacedChampion[] {
  const shen = team.find(p => p.champion.apiName === 'TFT17_Shen');
  const hasArtifact = team.some(p => p.champion.apiName === 'TFT17_ShenProp');

  if (shen && !hasArtifact) {
    const occupied = new Set(team.map(p => `${p.position.q},${p.position.r}`));
    const pos = findEmptyAdjacentHex(shen.position, occupied, 2);
    if (!pos) return team;
    return [...team, {
      champion: SHEN_ARTIFACT_CHAMPION,
      position: pos,
      starLevel: 1,
      items: [],
    }];
  }

  if (!shen && hasArtifact) {
    return team.filter(p => p.champion.apiName !== 'TFT17_ShenProp');
  }

  return team;
}

/**
 * 군체의 심장 (TFT17_Augment_PrimordianPrismaticAugment) 발동 시
 * 태고족 우두머리 (TFT17_Enemy_Aatrox) 자동 소환.
 *
 * 발동 조건:
 *   - 팀에 군체의 심장 augment 선택 +
 *   - 서로 다른 (apiName 기준) 3성 유닛 6명 이상 배치
 * (LevelRequirement=10 은 별도 player level state 가 시뮬에 없으므로
 *  3성 6명 조건이 자연스럽게 레벨 10 시점을 시사 — 현실적 단순화)
 *
 * 우두머리는 3성 고정, items=[], 이미 존재하면 starLevel 만 보정.
 * augment 가 비활성/조건 미충족 시 보드에서 자동 제거.
 */
function syncPrimordianBossInTeam(
  team: PlacedChampion[],
  augments: RawAugment[],
): PlacedChampion[] {
  const hasAugment = augments.some(a => a.apiName === 'TFT17_Augment_PrimordianPrismaticAugment');
  const existingIdx = team.findIndex(p => p.champion.apiName === PRIMORDIAN_BOSS_CHAMPION.apiName);

  // 자기 자신 (보스) 제외 후 서로 다른 3성 unit 카운트
  const distinctThreeStars = new Set<string>();
  for (const p of team) {
    if (p.champion.apiName === PRIMORDIAN_BOSS_CHAMPION.apiName) continue;
    if (p.starLevel >= 3) distinctThreeStars.add(p.champion.apiName);
  }
  const conditionMet = hasAugment && distinctThreeStars.size >= 6;

  // 조건 미충족 → 기존 보스 제거
  if (!conditionMet) {
    return existingIdx >= 0 ? team.filter((_, i) => i !== existingIdx) : team;
  }

  // 조건 충족 + 이미 존재 → 별 레벨만 3 보장
  if (existingIdx >= 0) {
    if (team[existingIdx].starLevel === 3) return team;
    return team.map((p, i) =>
      i === existingIdx ? { ...p, starLevel: 3, items: [] } : p,
    );
  }

  // 신규 소환 — 빈 hex 찾기
  const occupied = new Set(team.map(p => `${p.position.q},${p.position.r}`));
  const pos = findEmptyAdjacentHex({ q: 3, r: 2 }, occupied, 3);
  if (!pos) return team;
  return [...team, {
    champion: PRIMORDIAN_BOSS_CHAMPION,
    position: pos,
    starLevel: 3,
    items: [],
    isSummon: true,
  }];
}

/**
 * 암흑의 별 (6) tier Supermassive 시너지 → 소형 블랙홀 2개 자동 보드 추가.
 *
 * 발동 조건:
 *   - playerActiveTraits 의 TFT17_DarkStar trait active style >= 5 (= (6) tier+)
 *
 * 사용자 위치 변경 가능, 아이템 장착 불가 (NO_ITEM_AUTO_UNIT_API_NAMES), 이동/공격 X.
 * 시너지 비활성 시 자동 제거. 이미 2개 존재하면 그대로 유지 (idempotent).
 */
export function syncDarkStarBlackholesInTeam(
  team: PlacedChampion[],
  darkStarStyle: number,
): PlacedChampion[] {
  const targetCount = darkStarStyle >= 5 ? 2 : 0;
  const existing = team.filter(p => p.champion.apiName === DARKSTAR_BLACKHOLE_CHAMPION.apiName);

  // 비활성 → 모두 제거
  if (targetCount === 0) {
    return existing.length > 0
      ? team.filter(p => p.champion.apiName !== DARKSTAR_BLACKHOLE_CHAMPION.apiName)
      : team;
  }

  // 이미 충족 → 그대로
  if (existing.length >= targetCount) return team;

  // 부족분 추가 — 빈 hex 찾아 spawn
  const occupied = new Set(team.map(p => `${p.position.q},${p.position.r}`));
  const result = [...team];
  const seedAxials: HexCoord[] = [
    { q: 0, r: 0 }, { q: 6, r: 0 }, { q: 0, r: 3 }, { q: 6, r: 3 },
    { q: 1, r: 1 }, { q: 5, r: 1 }, { q: 1, r: 2 }, { q: 5, r: 2 },
  ];
  for (let i = existing.length; i < targetCount; i++) {
    let pos: HexCoord | null = null;
    for (const seed of seedAxials) {
      pos = findEmptyAdjacentHex(seed, occupied, 3);
      if (pos) break;
    }
    if (!pos) break;
    occupied.add(`${pos.q},${pos.r}`);
    result.push({
      champion: DARKSTAR_BLACKHOLE_CHAMPION,
      position: pos,
      starLevel: 1,
      items: [],
      isSummon: true,
    });
  }
  return result;
}

function syncTeam(team: PlacedChampion[], traits: RawTrait[]): PlacedChampion[] {
  // 1단계: 일반 소환체 보정 (아지르/애니/프렐요드)
  const intermediate = syncFreljordTurretsInTeam(syncAzirSoldiersInTeam(syncTibbersInTeam(team)));

  // 2단계: 길잡이 active 카운트 계산 후 소환체 반영.
  // resolveTraits 결과의 count는 champion.traits + emblem을 모두 반영하므로
  // "6 길잡이 + 상징 = 7 길잡이" 시나리오에서도 3성 소환이 정확히 나옴.
  // 단, 기존 소환체(TFT17_Summon)는 길잡이 trait를 가지지 않으므로 count에서 자연 제외됨.
  //
  // ⚠️ traits 카탈로그가 아직 비어 있으면(비동기 로드 진행 중) voyagerCount 가 실제와
  // 무관하게 0 으로 계산되어 기존 TFT17_Summon 이 잘못 제거될 수 있다. 이 경우 길잡이
  // 동기화 단계를 건너뛰고 기존 상태를 보존 — traits 도착 후 useTeamManagement 훅의
  // 1회성 resync 및 다음 사용자 편집에서 자연 정합화된다.
  const resolvedTraits = traits.length === 0 ? null : resolveTraits(intermediate, traits);
  const withVoyager = resolvedTraits === null
    ? intermediate
    : syncVoyagerSummonInTeam(
        intermediate,
        resolvedTraits.find(t => t.trait.name === '길잡이')?.count ?? 0,
      );

  // 3단계: 쉔 아티팩트
  const withShen = syncShenArtifactInTeam(withVoyager);

  // 4단계: 암흑의 별 (6) tier 활성 시 소형 블랙홀 2개 자동 spawn.
  // ⚠️ traits 카탈로그 비어있는 동안 (비동기 로드 중) sync 호출 시 darkStarStyle=0
  // 으로 계산되어 기존 블랙홀이 일시 despawn → 재로드 시 respawn 시 위치 손실.
  // Voyager 와 동일 패턴 — traits 도착까지 sync skip, 다음 사용자 편집 또는
  // useMemo 재계산 시 자연 정합화 (codex P2 회귀 가드).
  if (resolvedTraits === null) return withShen;
  const darkStarStyle = resolvedTraits.find(t => t.trait.apiName === 'TFT17_DarkStar')?.style ?? 0;
  return syncDarkStarBlackholesInTeam(withShen, darkStarStyle);
}

// === Exported helpers used by DnD ===
export { getTeamFromRow, parseCellId };

// === Hook ===

export interface UseTeamManagementArgs {
  traits: RawTrait[];
}

export function useTeamManagement({ traits }: UseTeamManagementArgs) {
  // 원본 상태는 사용자 의도(배치/이동/아이템 등) 그대로 보관. 자동 소환체는 derived 에서 적용.
  // 이렇게 하면 traits 카탈로그가 비동기 로드된 뒤 자동으로 재계산되어 voyagerCount 기반
  // TFT17_Summon 이 복원/조정된다 (useEffect 로 setState 를 재호출하지 않아도 됨).
  const [rawPlayerTeam, setRawPlayerTeam] = useState<PlacedChampion[]>([]);
  const [rawEnemyTeam, setRawEnemyTeam] = useState<PlacedChampion[]>([]);

  // Augment state — playerTeam/enemyTeam derived value 가 augments 를 참조 (군체의 심장 자동 소환).
  // hook 순서상 useMemo 보다 먼저 선언되어야 함.
  const [playerAugments, setPlayerAugments] = useState<RawAugment[]>([]);
  const [playerAugmentStacks, setPlayerAugmentStacks] = useState<Record<string, number>>({});
  const [enemyAugments, setEnemyAugments] = useState<RawAugment[]>([]);
  const [enemyAugmentStacks, setEnemyAugmentStacks] = useState<Record<string, number>>({});

  const playerTeam = useMemo(
    () => syncPrimordianBossInTeam(syncTeam(rawPlayerTeam, traits), playerAugments),
    [rawPlayerTeam, traits, playerAugments],
  );
  const enemyTeam = useMemo(
    () => syncPrimordianBossInTeam(syncTeam(rawEnemyTeam, traits), enemyAugments),
    [rawEnemyTeam, traits, enemyAugments],
  );

  // updater 의 prev 는 callers 가 보는 synced 뷰와 동일해야 DnD srcIdx 등이 일치한다.
  // 저장은 raw 에 하지만 updater 에는 sync 결과 (군체의 심장 자동 소환 포함) 를 주입.
  // sync 함수들은 idempotent (existingIdx 로 감지) 라 raw 에 synced 가 다시 들어와도 중복 없음.
  const updatePlayerTeam = (action: PlacedChampion[] | ((prev: PlacedChampion[]) => PlacedChampion[])) => {
    setRawPlayerTeam(rawPrev => {
      const syncedPrev = syncPrimordianBossInTeam(syncTeam(rawPrev, traits), playerAugments);
      return typeof action === 'function' ? action(syncedPrev) : action;
    });
  };
  const updateEnemyTeam = (action: PlacedChampion[] | ((prev: PlacedChampion[]) => PlacedChampion[])) => {
    setRawEnemyTeam(rawPrev => {
      const syncedPrev = syncPrimordianBossInTeam(syncTeam(rawPrev, traits), enemyAugments);
      return typeof action === 'function' ? action(syncedPrev) : action;
    });
  };
  const [showAugmentPicker, setShowAugmentPicker] = useState<'player' | 'enemy' | null>(null);
  const [augmentDetailTarget, setAugmentDetailTarget] = useState<{ aug: RawAugment; team: 'player' | 'enemy' } | null>(null);

  // Piltover module state
  const [playerPiltoverModules, setPlayerPiltoverModules] = useState<RawItem[]>([]);
  const [enemyPiltoverModules, setEnemyPiltoverModules] = useState<RawItem[]>([]);

  // Bilgewater stat purchases (apiName → count)
  const [playerBilgewaterStats, setPlayerBilgewaterStats] = useState<Record<string, number>>({});
  const [enemyBilgewaterStats, setEnemyBilgewaterStats] = useState<Record<string, number>>({});

  // Ionia path selection
  const [playerIoniaPath, setPlayerIoniaPath] = useState<IoniaPathType | null>(null);
  const [enemyIoniaPath, setEnemyIoniaPath] = useState<IoniaPathType | null>(null);

  // Arbiter law selection
  const [playerArbiterLaw, setPlayerArbiterLaw] = useState<ArbiterLaw | null>(null);
  const [enemyArbiterLaw, setEnemyArbiterLaw] = useState<ArbiterLaw | null>(null);

  // 별돌보미 별자리 — 게임 룰은 단일이지만 시뮬은 분석 편의로 팀별 독립.
  const [playerStargazerConstellation, setPlayerStargazerConstellation] = useState<StargazerConstellationId | null>(null);
  const [enemyStargazerConstellation, setEnemyStargazerConstellation] = useState<StargazerConstellationId | null>(null);

  // Galio bench (Hero synergy)
  const [playerGalio, setPlayerGalio] = useState<{ champion: RawChampion; starLevel: number } | null>(null);
  const [enemyGalio, setEnemyGalio] = useState<{ champion: RawChampion; starLevel: number } | null>(null);

  // Selected unit state
  const [selectedCell, setSelectedCell] = useState<HexCoord | null>(null);
  const [selectedCellTeam, setSelectedCellTeam] = useState<'player' | 'enemy'>('player');
  const [showPicker, setShowPicker] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<{ team: 'player' | 'enemy'; index: number } | null>(null);

  // MF mode selection popup state
  const [pendingMfPlacement, setPendingMfPlacement] = useState<{ team: 'player' | 'enemy'; index: number } | null>(null);

  // Synergy calculation (pass mfMode for trait substitution + 별돌보미 별자리 전달).
  // 별자리 선택 시 base TFT17_Stargazer 대신 variant trait (TFT17_Stargazer_Mountain 등)
  // 활성 → SynergyPanel 의 trait tooltip 도 자동으로 variant desc / variables 표시.
  const playerTraits = useMemo(
    () => resolveTraits(playerTeam, traits, { stargazerConstellation: playerStargazerConstellation ?? undefined }),
    [playerTeam, traits, playerStargazerConstellation],
  );
  const enemyTraits = useMemo(
    () => resolveTraits(enemyTeam, traits, { stargazerConstellation: enemyStargazerConstellation ?? undefined }),
    [enemyTeam, traits, enemyStargazerConstellation],
  );

  // Selected placed unit
  const selectedPlaced = useMemo(() => {
    if (!selectedUnit) return null;
    const team = selectedUnit.team === 'player' ? playerTeam : enemyTeam;
    return team[selectedUnit.index] ?? null;
  }, [selectedUnit, playerTeam, enemyTeam]);

  // === Handlers ===

  const handleCellClick = (pos: HexCoord, team: 'player' | 'enemy') => {
    const teamArr = team === 'player' ? playerTeam : enemyTeam;
    const existing = teamArr.find(p => p.position.q === pos.q && p.position.r === pos.r);
    if (existing) {
      const idx = teamArr.indexOf(existing);
      setSelectedUnit({ team, index: idx });
    } else {
      setSelectedCell(pos);
      setSelectedCellTeam(team);
      setShowPicker(true);
    }
  };

  const handleUnitClick = (team: 'player' | 'enemy', index: number) => {
    setSelectedUnit(prev => {
      if (prev?.team === team && prev?.index === index) return null;
      return { team, index };
    });
  };

  const handleChampionSelect = (champion: RawChampion) => {
    if (!selectedCell) return;
    const team = selectedCellTeam;
    const setTeam = team === 'player' ? updatePlayerTeam : updateEnemyTeam;
    const isMf = champion.apiName === 'TFT17_MissFortune';
    const currentLen = (team === 'player' ? playerTeam : enemyTeam).length;
    setTeam(prev => [...prev, {
      champion,
      position: selectedCell,
      starLevel: DEFAULT_STAR_LEVEL,
      items: [],
      ...(isMf ? { mfMode: null } : {}),
    }]);
    setShowPicker(false);
    if (isMf) {
      // syncTeam may append auto-units, but MF index is always at currentLen
      setPendingMfPlacement({ team, index: currentLen });
    }
  };

  /** 풀에서 챔피언 클릭 시 Player 팀 뒷줄(row 3)부터 좌→우, 다음 row 2, 1, 0 순으로 빈 칸에 배치. */
  const handleQuickAddChampion = (champion: RawChampion) => {
    for (let row = 3; row >= 0; row--) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const pos = offsetToAxial({ row, col });
        const occupied = playerTeam.some(p => p.position.q === pos.q && p.position.r === pos.r);
        if (occupied) continue;
        const isMf = champion.apiName === 'TFT17_MissFortune';
        const currentLen = playerTeam.length;
        updatePlayerTeam(prev => [...prev, {
          champion,
          position: pos,
          starLevel: DEFAULT_STAR_LEVEL,
          items: [],
          ...(isMf ? { mfMode: null } : {}),
        }]);
        if (isMf) setPendingMfPlacement({ team: 'player', index: currentLen });
        return;
      }
    }
  };

  const handleMfModeChange = (team: 'player' | 'enemy', index: number, mode: MfMode) => {
    const setTeam = team === 'player' ? updatePlayerTeam : updateEnemyTeam;
    setTeam(prev => prev.map((p, i) => i === index ? { ...p, mfMode: mode } : p));
    setPendingMfPlacement(null);
  };

  const handlePermanentStackChange = (team: 'player' | 'enemy', index: number, value: number) => {
    const setTeam = team === 'player' ? updatePlayerTeam : updateEnemyTeam;
    setTeam(prev => prev.map((p, i) => {
      if (i !== index) return p;
      const config = PERMANENT_STACK_CONFIG[p.champion.apiName];
      if (!config) return p;
      return { ...p, permanentStacks: { type: config.type, value: Math.max(0, Math.min(value, config.max)) } };
    }));
  };

  const handleEquipItem = (team: 'player' | 'enemy', index: number, item: RawItem) => {
    const teamArr = team === 'player' ? playerTeam : enemyTeam;
    const placed = teamArr[index];
    if (!placed) return;
    if (isAutoUnit(placed.champion.apiName)) return;

    const activeTraits = team === 'player' ? playerTraits : enemyTraits;
    const validation = canEquipItem(item, placed, activeTraits);
    if (!validation.canEquip) return;

    const setTeam = team === 'player' ? updatePlayerTeam : updateEnemyTeam;
    setTeam(prev => prev.map((p, i) => {
      if (i !== index) return p;
      if (isVoidMutation(item)) {
        return { ...p, voidItem: item };
      }
      return { ...p, items: [...p.items, item] };
    }));
  };

  const handleRemoveItem = (team: 'player' | 'enemy', index: number, itemIdx: number) => {
    const setTeam = team === 'player' ? updatePlayerTeam : updateEnemyTeam;
    setTeam(prev => prev.map((p, i) => {
      if (i !== index) return p;
      return { ...p, items: p.items.filter((_item: RawItem, ii: number) => ii !== itemIdx) };
    }));
  };

  const handleRemoveVoidItem = (team: 'player' | 'enemy', index: number) => {
    const setTeam = team === 'player' ? updatePlayerTeam : updateEnemyTeam;
    setTeam(prev => prev.map((p, i) => {
      if (i !== index) return p;
      return { ...p, voidItem: null };
    }));
  };

  const handleAddPiltoverModule = (team: 'player' | 'enemy', item: RawItem) => {
    const modules = team === 'player' ? playerPiltoverModules : enemyPiltoverModules;
    const activeTraits = team === 'player' ? playerTraits : enemyTraits;
    const validation = canAddPiltoverModule(item, modules, activeTraits);
    if (!validation.canEquip) return;

    const setModules = team === 'player' ? setPlayerPiltoverModules : setEnemyPiltoverModules;
    setModules(prev => [...prev, item]);
  };

  const handleRemovePiltoverModule = (team: 'player' | 'enemy', index: number) => {
    const setModules = team === 'player' ? setPlayerPiltoverModules : setEnemyPiltoverModules;
    setModules(prev => prev.filter((_, i) => i !== index));
  };

  const handleStarChange = (team: 'player' | 'enemy', index: number, level: number) => {
    const teamArr = team === 'player' ? playerTeam : enemyTeam;
    if (teamArr[index] && isAutoUnit(teamArr[index].champion.apiName)) return;
    const setTeam = team === 'player' ? updatePlayerTeam : updateEnemyTeam;
    setTeam(prev => prev.map((p, i) => {
      if (i !== index) return p;
      return { ...p, starLevel: level };
    }));
  };

  const handleRemoveUnit = (team: 'player' | 'enemy', index: number) => {
    const teamArr = team === 'player' ? playerTeam : enemyTeam;
    if (teamArr[index] && isAutoUnit(teamArr[index].champion.apiName)) return;
    const setTeam = team === 'player' ? updatePlayerTeam : updateEnemyTeam;
    setTeam(prev => prev.filter((_, i) => i !== index));
    setSelectedUnit(null);
  };

  const handleAddAugment = (team: 'player' | 'enemy', aug: RawAugment) => {
    const setAugs = team === 'player' ? setPlayerAugments : setEnemyAugments;
    const setStacks = team === 'player' ? setPlayerAugmentStacks : setEnemyAugmentStacks;
    setAugs(prev => {
      if (prev.length >= 3) return prev;
      return [...prev, aug];
    });
    const startStacks = getDefaultStacks(aug);
    setStacks(prev => ({ ...prev, [aug.apiName]: startStacks }));
    setShowAugmentPicker(null);
  };

  const handleRemoveAugment = (team: 'player' | 'enemy', index: number) => {
    const augs = team === 'player' ? playerAugments : enemyAugments;
    const removed = augs[index];
    const setAugs = team === 'player' ? setPlayerAugments : setEnemyAugments;
    const setStacks = team === 'player' ? setPlayerAugmentStacks : setEnemyAugmentStacks;
    setAugs(prev => prev.filter((_, i) => i !== index));
    if (removed) {
      setStacks(prev => {
        const next = { ...prev };
        delete next[removed.apiName];
        return next;
      });
    }
  };

  const handleAugmentStacksChange = (team: 'player' | 'enemy', apiName: string, count: number) => {
    const setStacks = team === 'player' ? setPlayerAugmentStacks : setEnemyAugmentStacks;
    setStacks(prev => ({ ...prev, [apiName]: count }));
  };

  const handleCycleStars = (team: 'player' | 'enemy', index: number) => {
    const teamArr = team === 'player' ? playerTeam : enemyTeam;
    if (teamArr[index] && isAutoUnit(teamArr[index].champion.apiName)) return;
    const setTeam = team === 'player' ? updatePlayerTeam : updateEnemyTeam;
    setTeam(prev => prev.map((p, i) => {
      if (i !== index) return p;
      const next = p.starLevel >= 3 ? 1 : p.starLevel + 1;
      return { ...p, starLevel: next };
    }));
  };

  const handleBuyBilgewaterStat = (team: 'player' | 'enemy', item: RawItem) => {
    const setStat = team === 'player' ? setPlayerBilgewaterStats : setEnemyBilgewaterStats;
    setStat(prev => ({
      ...prev,
      [item.apiName]: (prev[item.apiName] ?? 0) + 1,
    }));
  };

  const handleRemoveBilgewaterStat = (team: 'player' | 'enemy', apiName: string) => {
    const setStat = team === 'player' ? setPlayerBilgewaterStats : setEnemyBilgewaterStats;
    setStat(prev => {
      const next = { ...prev };
      if (next[apiName] && next[apiName] > 1) {
        next[apiName]--;
      } else {
        delete next[apiName];
      }
      return next;
    });
  };

  const resetAll = () => {
    updatePlayerTeam([]);
    updateEnemyTeam([]);
    setSelectedUnit(null);
    setPlayerAugments([]);
    setPlayerAugmentStacks({});
    setEnemyAugments([]);
    setEnemyAugmentStacks({});
    setPlayerBilgewaterStats({});
    setEnemyBilgewaterStats({});
  };

  return {
    // Team state
    playerTeam,
    enemyTeam,
    updatePlayerTeam,
    updateEnemyTeam,

    // Augment state
    playerAugments,
    playerAugmentStacks,
    enemyAugments,
    enemyAugmentStacks,
    showAugmentPicker,
    setShowAugmentPicker,
    augmentDetailTarget,
    setAugmentDetailTarget,

    // Piltover modules
    playerPiltoverModules,
    enemyPiltoverModules,

    // Bilgewater stats
    playerBilgewaterStats,
    enemyBilgewaterStats,

    // Ionia path
    playerIoniaPath,
    setPlayerIoniaPath,
    enemyIoniaPath,
    setEnemyIoniaPath,

    // Arbiter law
    playerArbiterLaw,
    setPlayerArbiterLaw,
    enemyArbiterLaw,
    setEnemyArbiterLaw,

    // 별돌보미 별자리
    playerStargazerConstellation,
    setPlayerStargazerConstellation,
    enemyStargazerConstellation,
    setEnemyStargazerConstellation,

    // Galio bench
    playerGalio,
    setPlayerGalio,
    enemyGalio,
    setEnemyGalio,

    // Selection state
    selectedCell,
    selectedCellTeam,
    showPicker,
    setShowPicker,
    selectedUnit,
    setSelectedUnit,

    // Computed
    playerTraits,
    enemyTraits,
    selectedPlaced,

    // MF mode
    pendingMfPlacement,
    setPendingMfPlacement,
    handleMfModeChange,
    handlePermanentStackChange,

    // Handlers
    handleCellClick,
    handleUnitClick,
    handleChampionSelect,
    handleQuickAddChampion,
    handleEquipItem,
    handleRemoveItem,
    handleRemoveVoidItem,
    handleAddPiltoverModule,
    handleRemovePiltoverModule,
    handleStarChange,
    handleRemoveUnit,
    handleAddAugment,
    handleRemoveAugment,
    handleAugmentStacksChange,
    handleCycleStars,
    handleBuyBilgewaterStat,
    handleRemoveBilgewaterStat,
    resetAll,
  };
}
