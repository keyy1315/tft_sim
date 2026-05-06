import { NextRequest, NextResponse } from 'next/server';
import { simulateCombat, SimulateOptions } from '@/lib/simulator/engine/combatLoop';
import { PlacedChampion, RawTrait, RawAugment } from '@/types';

interface SimulateRequestBody {
  playerTeam: PlacedChampion[];
  enemyTeam: PlacedChampion[];
  seed?: number;
  allTraits?: RawTrait[];
  playerAugments?: RawAugment[];
  enemyAugments?: RawAugment[];
  /**
   * N.O.V.A. (DRX) "타격 선택기" 적용할 NOVA 유닛 apiName. 미지정 시:
   * 1) playerTeam/enemyTeam 의 unit.novaStrikeSelector === true 인 unit 으로 fallback,
   * 2) 그것도 없으면 combatLoop 내부 autoAssignNovaSelector 가 활성 NOVA trait 기준 첫 unit 자동 지정.
   */
  playerNovaStrikeSelectorUnit?: string;
  enemyNovaStrikeSelectorUnit?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SimulateRequestBody = await request.json();

    if (!Array.isArray(body.playerTeam) || !Array.isArray(body.enemyTeam)) {
      return NextResponse.json(
        { error: 'playerTeam and enemyTeam must be arrays' },
        { status: 400 }
      );
    }

    if (body.playerTeam.length === 0 || body.enemyTeam.length === 0) {
      return NextResponse.json(
        { error: 'Both teams must have at least one champion' },
        { status: 400 }
      );
    }

    if (body.playerTeam.length > 10 || body.enemyTeam.length > 10) {
      return NextResponse.json(
        { error: 'Each team can have at most 10 champions' },
        { status: 400 }
      );
    }

    // NOVA 타격 선택기: 명시 지정 > playerTeam.novaStrikeSelector === true 인 unit fallback.
    const playerNovaUnit = body.playerNovaStrikeSelectorUnit
      ?? body.playerTeam.find((u) => u.novaStrikeSelector === true)?.champion.apiName;
    const enemyNovaUnit = body.enemyNovaStrikeSelectorUnit
      ?? body.enemyTeam.find((u) => u.novaStrikeSelector === true)?.champion.apiName;

    const options: SimulateOptions = {
      seed: body.seed ?? 42,
      allTraits: body.allTraits,
      playerAugments: body.playerAugments,
      enemyAugments: body.enemyAugments,
      playerNovaStrikeSelectorUnit: playerNovaUnit,
      enemyNovaStrikeSelectorUnit: enemyNovaUnit,
    };

    const result = simulateCombat(body.playerTeam, body.enemyTeam, options);

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
