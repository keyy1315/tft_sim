// 전투 중 소환되는 유닛의 apiName → 실제 이미지 apiName 매핑
const CHAMPION_IMAGE_ALIASES: Record<string, string> = {
  'TFT16_NoxusAtakhan': 'TFT16_Atakhan',
};

// Maps apiName to image path — auto-detects set from TFT{N}_ prefix
export function getChampionImage(apiName: string): string {
  const resolved = CHAMPION_IMAGE_ALIASES[apiName] ?? apiName;
  const setMatch = resolved.match(/^TFT(\d+)_/);
  const setNum = setMatch ? parseInt(setMatch[1]) : 17;
  if (setNum === 16) {
    // Set 16 images moved to /data/set16/images/
    const name = resolved.replace(`TFT${setNum}_`, `tft${setNum}_`).replace('TFT_', 'tft_').toLowerCase();
    return `/data/set16/images/tft_set16_champions/${name}_square.tft_set16.png`;
  }
  // Set 17+: TFT17_Aatrox → aatrox (strip prefix)
  const name = resolved.replace(`TFT${setNum}_`, '').replace('TFT_', '').toLowerCase();
  return `/data/images/tft_set${setNum}_champions/${name}_square.tft_set${setNum}.png`;
}

/**
 * Item image path resolution.
 * Uses a runtime cache populated from JSON icon fields via registerItemImages().
 * Falls back to deterministic path derivation from apiName.
 */
const itemImageCache = new Map<string, string>();

/** Register item images from loaded JSON data (call once after loading items) */
export function registerItemImages(items: { apiName: string; icon: string }[]): void {
  for (const item of items) {
    const parts = item.icon.split('/');
    const filename = parts[parts.length - 1].toLowerCase();
    const path = resolveItemPath(item.apiName, filename);
    itemImageCache.set(item.apiName, path);
  }
}

function resolveItemPath(apiName: string, iconFilename: string): string {
  // Emblem items
  if (apiName.includes('EmblemItem')) {
    return `/data/images/emblems/${iconFilename}`;
  }

  // Radiant (Corrupted + Radiant_) items → common/images/radiant/
  if (apiName.includes('Corrupted') || apiName.includes('Radiant_')) {
    return `/data/common/images/radiant/${iconFilename}`;
  }

  // Artifact / Ornn / Shimmerscale items → common/images/artifacts/
  if (apiName.includes('Artifact') || apiName.includes('Ornn') || apiName.includes('Shimmerscale')) {
    return `/data/common/images/artifacts/${iconFilename}`;
  }

  // Piltover items (Set 16 — moved to set16/)
  if (apiName.includes('TFT16_Item_Piltover_')) {
    return `/data/set16/images/tft_set16_piltover/${iconFilename}`;
  }

  // Bilgewater items (Set 16 — moved to set16/)
  if (apiName.includes('TFT16_Item_Bilgewater_')) {
    if (iconFilename.startsWith('tft16_') || iconFilename.startsWith('tt16_')) {
      return `/data/set16/images/tft_set16_bilgewater/${iconFilename}`;
    }
    return `/data/images/artifacts/${iconFilename}`;
  }

  // Consumables, armory keys, and other set-specific utility items → items/
  if (iconFilename.startsWith('tft_consumable_') ||
      iconFilename.startsWith('tft_armorykey') ||
      iconFilename.startsWith('tft5_') ||
      iconFilename.startsWith('tft14_') ||
      iconFilename.startsWith('tft6_') ||
      iconFilename.startsWith('profileicon')) {
    return `/data/images/items/${iconFilename}`;
  }

  // Set 17 specific items (PsyOps, AnimaSquad, carousel market, emblems) → artifacts/
  if (iconFilename.startsWith('tft17_')) {
    // Emblems have their own directory
    if (iconFilename.startsWith('tft17_emblem_')) {
      return `/data/images/emblems/${iconFilename}`;
    }
    return `/data/images/artifacts/${iconFilename}`;
  }

  // Items with non-tft prefix (doubleup_, assist*, s_*, missing-*) → items/
  if (!iconFilename.startsWith('tft') && !iconFilename.startsWith('ct_') && !iconFilename.startsWith('crest_') && !iconFilename.startsWith('realmwrap') && !iconFilename.startsWith('namir')) {
    return `/data/images/items/${iconFilename}`;
  }

  // Base components & combined items → common/images/
  if (iconFilename.startsWith('tft_item_')) {
    return `/data/common/images/combined/${iconFilename}`;
  }

  return `/data/images/artifacts/${iconFilename}`;
}

export function getItemImage(apiName: string): string {
  // Use cached path from JSON icon field
  const cached = itemImageCache.get(apiName);
  if (cached) return cached;

  // Fallback: derive path from apiName
  return deriveItemPath(apiName);
}

function deriveItemPath(apiName: string): string {
  // Set 16 specific items — moved to set16/
  if (apiName.includes('TFT16_Item_Piltover_')) {
    return `/data/set16/images/tft_set16_piltover/${apiName.toLowerCase()}.tft_set16.png`;
  }
  if (apiName.includes('TFT16_Item_Bilgewater_')) {
    const statTierMatch = apiName.match(/TFT16_Item_Bilgewater_(ArmorMR|AS|ADAP|AD|AP|Health)Tier(\d)/);
    if (statTierMatch) {
      const stat = statTierMatch[1].toLowerCase();
      const tier = statTierMatch[2];
      return `/data/set16/images/tft_set16_bilgewater/tft16_bilgewater_${stat}_tier${tier}.tft_set16.png`;
    }
    const name = apiName.replace('TFT16_Item_Bilgewater_', '').toLowerCase();
    return `/data/set16/images/tft_set16_bilgewater/tft16_item_bilgewater_${name}.tft_set16.png`;
  }
  if (apiName.includes('Artifact') || apiName.includes('Ornn') || apiName.includes('Shimmerscale')) {
    return `/data/common/images/artifacts/${apiName.toLowerCase()}.tft_set13.png`;
  }

  // Standard items & artifacts
  const normalized = apiName.toLowerCase();
  return `/data/images/artifacts/${normalized}.tft_set13.png`;
}

const traitImageCache = new Map<string, string>();

/** Register trait images from loaded JSON data (call once after loading traits) */
export function registerTraitImages(traits: { apiName: string; icon: string }[]): void {
  for (const t of traits) {
    const parts = t.icon.split('/');
    const filename = parts[parts.length - 1].toLowerCase().replace('.tex', '.png');
    // Set 16 전용 특성(TFT16_ apiName)만 set16/ 경로 사용
    // 다른 세트 아이콘을 재사용하는 Set 17 특성은 images/traits/에서 로드
    const isSet16Trait = t.apiName.startsWith('TFT16_');
    const base = isSet16Trait ? '/data/set16/images/traits' : '/data/images/traits';
    traitImageCache.set(t.apiName, `${base}/${filename}`);
  }
}

export function getTraitImage(apiName: string): string {
  return traitImageCache.get(apiName) ?? `/data/images/traits/${apiName}.png`;
}

// === Augment image helpers ===
import type { AugmentTier } from '@/types';

export function getAugmentImage(icon: string): string {
  // Convert ASSETS/Maps/TFT/Icons/Augments/Hexcore/Xxx.TFT_Set16.tex
  // → https://raw.communitydragon.org/latest/game/assets/maps/tft/icons/augments/hexcore/xxx.tft_set16.png
  const lower = icon.toLowerCase().replace('.tex', '.png');
  // 17.2 PostLaunchAugments (예: LeonaHero_I) 는 latest 브랜치에 아직 미반영.
  // PBE branch 에 있으므로 해당 패턴 한정으로 PBE URL 사용.
  if (lower.includes('postlaunchaugments')) {
    return `https://raw.communitydragon.org/pbe/game/${lower}`;
  }
  return `https://raw.communitydragon.org/latest/game/${lower}`;
}

export const TIER_BORDER_COLORS: Record<AugmentTier, string> = {
  silver: 'border-gray-400',
  gold: 'border-yellow-500',
  prismatic: 'border-fuchsia-400',
  boon: 'border-amber-400',
};

export const TIER_BG_COLORS: Record<AugmentTier, string> = {
  silver: 'from-gray-600 to-gray-500',
  gold: 'from-yellow-700 to-yellow-500',
  prismatic: 'from-fuchsia-700 to-fuchsia-400',
  boon: 'from-amber-700 to-amber-400',
};

export const COST_BORDER_COLORS: Record<number, string> = {
  1: 'border-gray-500',
  2: 'border-green-500',
  3: 'border-blue-500',
  4: 'border-purple-500',
  5: 'border-yellow-500',
};

export const COST_BG_COLORS: Record<number, string> = {
  1: 'from-gray-700 to-gray-600',
  2: 'from-green-800 to-green-600',
  3: 'from-blue-800 to-blue-600',
  4: 'from-purple-800 to-purple-600',
  5: 'from-yellow-700 to-yellow-500',
};
