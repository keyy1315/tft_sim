import fs from 'node:fs';
import path from 'node:path';
import type {
  RawChampion,
  RawItem,
  RawItemsData,
  RawTrait,
  RawTraitsData,
  RawAugment,
  RawAugmentsData,
} from '@/types';
import { isDisabledAugment, isDisabledItem } from '@/data/disabledContent';

const PUBLIC_DATA = path.join(process.cwd(), 'public', 'data');

function readJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(PUBLIC_DATA, rel), 'utf-8')) as T;
}

export interface ServerCatalogs {
  champions: RawChampion[];
  traits: RawTrait[];
  items: RawItem[];
  augments: RawAugment[];
}

let cached: ServerCatalogs | null = null;

/**
 * Set 17 카탈로그를 동기 fs.readFileSync 로 로드한다.
 * - 브라우저 전용 `@/data/loader` (fetch 기반) 대안
 * - 서버/테스트 런타임 전용
 * - 모듈 스코프에 캐시 (프로세스당 1회)
 */
export function loadServerCatalogs(): ServerCatalogs {
  if (cached) return cached;
  const champRaw = readJson<RawChampion[] | { champions?: RawChampion[] }>(
    'tft_set17_champions.json',
  );
  const champions = Array.isArray(champRaw) ? champRaw : champRaw.champions ?? [];
  const traits = readJson<RawTraitsData>('tft_set17_traits.json').traits;
  const itemsRaw = readJson<RawItemsData>('tft_set17_items.json').items;
  const augmentsRaw = readJson<RawAugmentsData>('tft_set17_augments.json').augments;
  // disabledContent.ts 등록 항목 제외 (loader.ts 와 동일 동작 보장).
  const items = itemsRaw.filter(it => !isDisabledItem(it.apiName));
  const augments = augmentsRaw.filter(a => !isDisabledAugment(a.apiName));
  cached = { champions, traits, items, augments };
  return cached;
}
