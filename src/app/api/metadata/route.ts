import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { RawChampion, RawItemsData, RawTraitsData, RawAugmentsData } from '@/types';

export async function GET() {
  try {
    const dataDir = path.join(process.cwd(), 'public', 'data');

    const championsRaw = fs.readFileSync(path.join(dataDir, 'tft_set16_champions.json'), 'utf-8');
    const champions: RawChampion[] = JSON.parse(championsRaw);

    const itemsRaw = fs.readFileSync(path.join(dataDir, 'tft_set16_items.json'), 'utf-8');
    const items: RawItemsData = JSON.parse(itemsRaw);

    const traitsRaw = fs.readFileSync(path.join(dataDir, 'tft_set16_traits.json'), 'utf-8');
    const traits: RawTraitsData = JSON.parse(traitsRaw);

    const augmentsRaw = fs.readFileSync(path.join(dataDir, 'tft_set16_augments.json'), 'utf-8');
    const augments: RawAugmentsData = JSON.parse(augmentsRaw);

    return NextResponse.json({
      patchVersion: 'Set 16',
      champions: {
        total: champions.length,
        names: champions.map(c => c.name),
      },
      items: { total: items.items.length },
      traits: { total: traits.traits.length },
      augments: { total: augments.augments.length },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
