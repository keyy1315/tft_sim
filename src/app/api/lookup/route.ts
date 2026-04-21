import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSupabase } from '@/lib/supabase';
import {
  getAccountByRiotId,
  getMatchIds,
  getMatchDetail,
  parseMatchForPlayer,
} from '@/lib/riot';
import type { ParsedMatch } from '@/lib/riot';
import { resolveDescription } from '@/lib/utils/text';

/**
 * 아이템/특성 desc 를 사용자에게 보여주기 전 정리.
 *
 * 이전 구현 `s.replace(/@\w+@/g, '?')` 는 `@DamageAmp*100@` 같이 곱셈/특수문자가
 * 들어간 placeholder 를 매칭하지 못해 raw 코드 (`@DamageAmp*100@%`) 그대로 노출됐음.
 *
 * resolveDescription 을 사용해 effects 로 placeholder 를 치환한다. effects 누락
 * 등으로 잔여 placeholder 가 남으면 "?" 로 sanitize.
 */
function formatDesc(desc: string, effects: Record<string, number | null> = {}): string {
  if (!desc) return '';
  const resolved = resolveDescription(desc, effects);
  // 잔여 placeholder (effects 에 없는 변수) 정리
  return resolved.replace(/@[^@]+@/g, '?').replace(/\{\{[^}]*\}\}/g, '').trim();
}

/* ─── TraitMeta ─── */

interface TraitMeta {
  name: string;
  icon: string;
  isUnique: boolean;
  desc: string;
}

let cachedTraitMeta: Record<string, TraitMeta> | null = null;

function loadTraitsFromFile(filePath: string, result: Record<string, TraitMeta>) {
  if (!fs.existsSync(filePath)) return;
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
    traits: Array<{ apiName: string; name: string; icon: string; desc: string; effects: unknown[] }>;
  };
  for (const t of raw.traits) {
    if (result[t.apiName]) continue;
    const parts = t.icon.split('/');
    const filename = (parts[parts.length - 1] ?? '').toLowerCase().replace('.tex', '.png');
    const isSet16 = t.apiName.startsWith('TFT16_');
    const base = isSet16 ? '/data/set16/images/traits' : '/data/images/traits';
    result[t.apiName] = {
      name: t.name,
      icon: `${base}/${filename}`,
      isUnique: Array.isArray(t.effects) ? t.effects.length === 1 : false,
      desc: formatDesc(t.desc ?? '', {}),
    };
  }
}

function getTraitMeta(): Record<string, TraitMeta> {
  if (cachedTraitMeta) return cachedTraitMeta;
  cachedTraitMeta = {};
  const dataDir = path.join(process.cwd(), 'public/data');
  loadTraitsFromFile(path.join(dataDir, 'tft_set17_traits.json'), cachedTraitMeta);
  loadTraitsFromFile(path.join(dataDir, 'set16/tft_set16_traits.json'), cachedTraitMeta);
  return cachedTraitMeta;
}

/* ─── ChampionMeta ─── */

interface ChampionMeta {
  name: string;
  cost: number;
  traits: string[];
}

let cachedChampionMeta: Record<string, ChampionMeta> | null = null;

function loadChampsFromFile(filePath: string, result: Record<string, ChampionMeta>) {
  if (!fs.existsSync(filePath)) return;
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const champs: Array<{ apiName: string; name: string; cost: number; traits: string[] }> =
    Array.isArray(raw) ? raw : raw.champions ?? [];
  for (const c of champs) {
    if (result[c.apiName]) continue;
    result[c.apiName] = { name: c.name, cost: c.cost, traits: c.traits ?? [] };
  }
}

function getChampionMeta(): Record<string, ChampionMeta> {
  if (cachedChampionMeta) return cachedChampionMeta;
  cachedChampionMeta = {};
  const dataDir = path.join(process.cwd(), 'public/data');
  loadChampsFromFile(path.join(dataDir, 'tft_set17_champions.json'), cachedChampionMeta);
  loadChampsFromFile(path.join(dataDir, 'set16/tft_set16_champions.json'), cachedChampionMeta);
  return cachedChampionMeta;
}

/* ─── ItemMeta ─── */

interface ItemMeta {
  name: string;
  desc: string;
  icon: string;
}

function resolveItemIcon(apiName: string, iconField: string): string {
  const parts = iconField.split('/');
  const f = (parts[parts.length - 1] ?? '').toLowerCase();
  if (apiName.includes('EmblemItem')) return `/data/images/emblems/${f}`;
  if (apiName.includes('Corrupted') || apiName.includes('Radiant_')) return `/data/common/images/radiant/${f}`;
  if (apiName.includes('Artifact') || apiName.includes('Ornn') || apiName.includes('Shimmerscale')) return `/data/common/images/artifacts/${f}`;
  if (apiName.includes('TFT16_Item_Piltover_')) return `/data/set16/images/tft_set16_piltover/${f}`;
  if (apiName.includes('TFT16_Item_Bilgewater_')) {
    return (f.startsWith('tft16_') || f.startsWith('tt16_')) ? `/data/set16/images/tft_set16_bilgewater/${f}` : `/data/images/artifacts/${f}`;
  }
  if (f.startsWith('tft_consumable_') || f.startsWith('tft_armorykey') || f.startsWith('tft5_') || f.startsWith('tft14_') || f.startsWith('tft6_') || f.startsWith('profileicon')) return `/data/images/items/${f}`;
  if (f.startsWith('tft17_')) return f.startsWith('tft17_emblem_') ? `/data/images/emblems/${f}` : `/data/images/artifacts/${f}`;
  if (!f.startsWith('tft') && !f.startsWith('ct_') && !f.startsWith('crest_') && !f.startsWith('realmwrap') && !f.startsWith('namir')) return `/data/images/items/${f}`;
  if (f.startsWith('tft_item_')) return `/data/common/images/combined/${f}`;
  return `/data/images/artifacts/${f}`;
}

let cachedItemMeta: Record<string, ItemMeta> | null = null;

function getItemMeta(): Record<string, ItemMeta> {
  if (cachedItemMeta) return cachedItemMeta;
  cachedItemMeta = {};
  const dataDir = path.join(process.cwd(), 'public/data');

  const commonPath = path.join(dataDir, 'common/tft_common_items.json');
  if (fs.existsSync(commonPath)) {
    const common = JSON.parse(fs.readFileSync(commonPath, 'utf-8'));
    for (const item of common.items ?? common) {
      cachedItemMeta[item.apiName] = {
        name: item.name,
        desc: formatDesc(item.desc ?? '', item.effects ?? {}),
        icon: resolveItemIcon(item.apiName, item.icon ?? ''),
      };
    }
  }

  for (const p of ['tft_set17_items.json', 'set16/tft_set16_items.json']) {
    const fp = path.join(dataDir, p);
    if (!fs.existsSync(fp)) continue;
    const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    for (const item of data.items ?? data) {
      if (cachedItemMeta[item.apiName]) continue;
      cachedItemMeta[item.apiName] = {
        name: item.name,
        desc: formatDesc(item.desc ?? '', item.effects ?? {}),
        icon: resolveItemIcon(item.apiName, item.icon ?? ''),
      };
    }
  }

  return cachedItemMeta;
}

/** Riot + Supabase 매치 조회 최대 개수. 클라이언트 페이지네이션 (페이지당 20) 과 맞물림. */
const MATCH_FETCH_LIMIT = 60;

export async function POST(req: NextRequest) {
  const { gameName, tagLine } = (await req.json()) as {
    gameName: string;
    tagLine: string;
  };

  if (!gameName || !tagLine) {
    return NextResponse.json({ error: '소환사명과 태그를 입력해주세요.' }, { status: 400 });
  }

  try {
    const supabase = getSupabase();

    // 1. Riot Account API → puuid
    const account = await getAccountByRiotId(gameName, tagLine);
    const { puuid } = account;

    // 2. DB에 소환사 upsert
    await supabase
      .from('summoners')
      .upsert(
        {
          puuid,
          game_name: account.gameName,
          tag_line: account.tagLine,
          last_fetched_at: new Date().toISOString(),
        },
        { onConflict: 'puuid' }
      );

    // 3. DB에 저장된 매치 ID + set_id 조회 (이미 저장된 매치는 detail 재호출 불필요)
    const { data: existingRows } = await supabase
      .from('matches')
      .select('match_id, set_id')
      .eq('puuid', puuid);

    const existingSetMap = new Map<string, string>(
      (existingRows ?? []).map((r) => [r.match_id, r.set_id ?? 'set17']),
    );

    // 4. Riot에서 최근 매치 ID 가져오기 (최신순)
    const matchIds = await getMatchIds(puuid, MATCH_FETCH_LIMIT);

    // 5. 최신순 스캔 — set17 이 아닌 매치를 만나면 그 이전 (더 오래된) 매치는 페치/응답 모두 차단.
    //    DB 기존 매치는 setId 를 DB에서 읽고, 신규 매치만 getMatchDetail 호출.
    const allowedMatchIds: string[] = [];
    for (const matchId of matchIds) {
      let setId: string;
      if (existingSetMap.has(matchId)) {
        setId = existingSetMap.get(matchId)!;
      } else {
        const detail = await getMatchDetail(matchId);
        const parsed = parseMatchForPlayer(detail, puuid);
        if (!parsed) continue;
        setId = parsed.setId;
        if (setId === 'set17') {
          await supabase.from('matches').insert({
            match_id: parsed.matchId,
            puuid,
            placement: parsed.placement,
            champions: parsed.champions,
            game_datetime: parsed.gameDatetime,
            game_length: parsed.gameLength,
            queue_id: parsed.queueId,
            set_id: parsed.setId,
            traits: parsed.traits,
          });
        }
      }
      if (setId !== 'set17') break;
      allowedMatchIds.push(matchId);
    }

    // 6. 응답에 포함할 매치만 조회 (컷오프 이후 매치는 DB에 있어도 제외).
    //    puuid 필터 필수 — matches 테이블은 (match_id, puuid) unique 이므로
    //    puuid 를 빼면 다른 유저가 저장한 동일 match_id row 까지 딸려와 React key 중복 발생.
    const { data: allMatches } = allowedMatchIds.length === 0
      ? { data: [] as ParsedMatch[] }
      : await supabase
          .from('matches')
          .select('*')
          .eq('puuid', puuid)
          .in('match_id', allowedMatchIds)
          .order('game_datetime', { ascending: false });

    return NextResponse.json({
      summoner: {
        gameName: account.gameName,
        tagLine: account.tagLine,
        puuid,
      },
      matches: allMatches ?? [],
      traitMeta: getTraitMeta(),
      championMeta: getChampionMeta(),
      itemMeta: getItemMeta(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'SUMMONER_NOT_FOUND') {
      return NextResponse.json({ error: '소환사를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (message === 'RATE_LIMITED') {
      return NextResponse.json({ error: 'API 요청 한도 초과. 잠시 후 다시 시도해주세요.' }, { status: 429 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
