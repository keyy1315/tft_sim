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

    const options: SimulateOptions = {
      seed: body.seed ?? 42,
      allTraits: body.allTraits,
      playerAugments: body.playerAugments,
      enemyAugments: body.enemyAugments,
    };

    const result = simulateCombat(body.playerTeam, body.enemyTeam, options);

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
