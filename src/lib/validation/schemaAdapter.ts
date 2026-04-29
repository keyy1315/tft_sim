import type { NRunInput } from '@/types/validation';
import type {
  RawChampion,
  RawTrait,
  RawAugment,
  RawItem,
  PlacedChampion,
  ArbiterLaw,
} from '@/types';
import type {
  PvPRound,
  PlacedUnit,
  StargazerConstellationId,
} from '@/lib/actualData/types';
import { isStackable } from '@/lib/simulator/systems/augment';
import { loadServerCatalogs } from '@/lib/validation/serverCatalogs';

export interface AdapterCatalogs {
  champions: RawChampion[];
  traits: RawTrait[];
  augments: RawAugment[];
  items: RawItem[];
}

export interface AdapterResult {
  input: NRunInput;
  warnings: string[];
}

/** 중재자 trait 활성 시 법률 미지정이면 경고. */
const ARBITER_TRAIT_KR = '중재자';

/**
 * 라운드 인덱스를 stack 으로 자동 추론할 augment 들.
 * - NoScoutNoPivot: PvP 라운드 후 누적 (HPScale/ADScale/APScale 가 stacks 에 곱해짐).
 *   stack = 시뮬 시점에 거친 PvP 라운드 수 (0-based: 첫 PvP 시점=0).
 */
const ROUND_INDEX_STACK_AUGMENTS = new Set<string>([
  'TFT_Augment_NoScoutNoPivot',
]);

/**
 * TeamSnapshot 의 확장 필드 (schema 에는 없지만 adapter 가 관대하게 읽어들임).
 * - augmentStacks: 증강 apiName → stack 개수
 * schema 에 추가되기 전까지 optional 로 읽는다.
 */
interface TeamSnapshotExt {
  augmentStacks?: Record<string, number>;
}

export interface ToNRunInputOptions {
  /** 0-based 인덱스. 자동 stack 추론에 사용. 미지정 시 자동 추론 안 함. */
  pvpRoundIndex?: number;
  /** game-level 별돌보미 별자리. resolveTraits 가 변종 trait 활성에 사용. */
  stargazerConstellation?: StargazerConstellationId;
}

/**
 * augment 가 ROUND_INDEX_STACK_AUGMENTS 에 속하고 사용자가 stack 을
 * 명시 입력하지 않았으면 pvpRoundIndex 를 자동 stack 으로 채워 새 record 반환.
 * 사용자 명시 입력은 항상 우선.
 */
function resolveAutoStacks(
  augs: RawAugment[],
  userStacks: Record<string, number> | undefined,
  pvpRoundIndex: number | undefined,
): Record<string, number> | undefined {
  if (pvpRoundIndex == null) return userStacks;
  let merged: Record<string, number> | undefined;
  for (const a of augs) {
    if (!ROUND_INDEX_STACK_AUGMENTS.has(a.apiName)) continue;
    if (userStacks && typeof userStacks[a.apiName] === 'number') continue;
    if (!merged) merged = { ...(userStacks ?? {}) };
    merged[a.apiName] = pvpRoundIndex;
  }
  return merged ?? userStacks;
}

function toPlacedChampion(
  unit: PlacedUnit,
  catalogs: AdapterCatalogs,
): PlacedChampion | null {
  const champion = catalogs.champions.find((c) => c.apiName === unit.championId);
  if (!champion) return null;
  const items = unit.items
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .map((id) => catalogs.items.find((i) => i.apiName === id))
    .filter((i): i is RawItem => !!i);
  return {
    champion,
    starLevel: unit.starLevel,
    position: unit.hex,
    items,
  };
}

function countTraitUnits(units: PlacedChampion[], traitName: string): number {
  const seenChampIds = new Set<string>();
  let count = 0;
  for (const u of units) {
    if (seenChampIds.has(u.champion.apiName)) continue;
    seenChampIds.add(u.champion.apiName);
    if (u.champion.traits.includes(traitName)) count++;
  }
  return count;
}

function toTeamAugments(
  apiNames: ReadonlyArray<string | null | undefined>,
  allAugments: RawAugment[],
): RawAugment[] {
  return apiNames
    .filter((n): n is string => typeof n === 'string' && n.length > 0)
    .map((n) => allAugments.find((a) => a.apiName === n))
    .filter((a): a is RawAugment => !!a);
}

export function toNRunInput(
  round: PvPRound,
  catalogs: AdapterCatalogs = loadServerCatalogs(),
  options: ToNRunInputOptions = {},
): AdapterResult {
  const warnings: string[] = [];

  const playerPlaced = round.playerTeam.units
    .map((u) => toPlacedChampion(u, catalogs))
    .filter((p): p is PlacedChampion => !!p);
  const opponentPlaced = round.opponent.units
    .map((u) => toPlacedChampion(u, catalogs))
    .filter((p): p is PlacedChampion => !!p);

  const stageStr = round.roundName.split('-')[0];
  const parsedStage = Number.parseInt(stageStr, 10);
  const stageNumber = Number.isFinite(parsedStage) ? parsedStage : 4;

  const playerAugments = toTeamAugments(round.playerTeam.augments, catalogs.augments);
  const enemyAugments = toTeamAugments(round.opponent.augments, catalogs.augments);

  // TeamSnapshot 스키마 확장 필드 (optional).
  const playerExt = round.playerTeam as unknown as TeamSnapshotExt;
  const opponentExt = round.opponent as unknown as TeamSnapshotExt;

  // 라운드 인덱스 기반 stack 자동 추론 (NoScoutNoPivot 등). 사용자 입력 우선.
  const playerStacks = resolveAutoStacks(playerAugments, playerExt.augmentStacks, options.pvpRoundIndex);
  const opponentStacks = resolveAutoStacks(enemyAugments, opponentExt.augmentStacks, options.pvpRoundIndex);

  // Stackable augment warnings — 데이터 기반 isStackable() 사용. 자동 추론된 항목은 경고 X.
  const pushStackWarnings = (
    teamLabel: string,
    augs: RawAugment[],
    stacks: Record<string, number> | undefined,
  ) => {
    for (const a of augs) {
      if (!isStackable(a)) continue;
      if (stacks && typeof stacks[a.apiName] === 'number') continue;
      warnings.push(`${teamLabel}: '${a.name ?? a.apiName}' 스택 미입력 → 기본값 사용`);
    }
  };
  pushStackWarnings('내 팀', playerAugments, playerStacks);
  pushStackWarnings('상대', enemyAugments, opponentStacks);

  // Arbiter law warnings
  if (
    countTraitUnits(playerPlaced, ARBITER_TRAIT_KR) >= 1 &&
    !round.playerTeam.arbiterLaw
  ) {
    warnings.push('내 팀: 중재자 법률 미선택 → 기본값 사용');
  }
  if (
    countTraitUnits(opponentPlaced, ARBITER_TRAIT_KR) >= 1 &&
    !round.opponent.arbiterLaw
  ) {
    warnings.push('상대: 중재자 법률 미선택 → 기본값 사용');
  }

  const playerArbiterLaw: ArbiterLaw | undefined = round.playerTeam.arbiterLaw
    ? { triggerId: round.playerTeam.arbiterLaw.triggerId, effectId: round.playerTeam.arbiterLaw.effectId }
    : undefined;
  const enemyArbiterLaw: ArbiterLaw | undefined = round.opponent.arbiterLaw
    ? { triggerId: round.opponent.arbiterLaw.triggerId, effectId: round.opponent.arbiterLaw.effectId }
    : undefined;

  return {
    input: {
      playerTeam: playerPlaced,
      opponentTeam: opponentPlaced,
      simulateOptions: {
        allTraits: catalogs.traits,
        playerAugments,
        enemyAugments,
        playerAugmentStacks: playerStacks,
        enemyAugmentStacks: opponentStacks,
        playerArbiterLaw,
        enemyArbiterLaw,
        // game-level 단일 별자리 → 양 팀에 동일 전달 (실제 게임은 양 팀 동일 별자리).
        playerStargazerConstellation: options.stargazerConstellation,
        enemyStargazerConstellation: options.stargazerConstellation,
        skipMirror: true,
        stageNumber,
      },
    },
    warnings,
  };
}
