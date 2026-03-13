// Maps apiName to image path
export function getChampionImage(apiName: string): string {
  const name = apiName.replace('TFT16_', 'tft16_').replace('TFT_', 'tft_').toLowerCase();
  return `/data/images/tft_set16_champions/${name}_square.tft_set16.png`;
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
  // Piltover items
  if (apiName.includes('TFT16_Item_Piltover_')) {
    return `/data/images/tft_set16_piltover/${iconFilename}`;
  }

  // Bilgewater items — some use shared icons from artifacts/
  if (apiName.includes('TFT16_Item_Bilgewater_')) {
    if (iconFilename.startsWith('tft16_') || iconFilename.startsWith('tt16_')) {
      return `/data/images/tft_set16_bilgewater/${iconFilename}`;
    }
    return `/data/images/artifacts/${iconFilename}`;
  }

  // All other items → try artifacts/ first, items/ for legacy names
  // Items with short names (no tft_ prefix) likely live in items/
  if (!iconFilename.startsWith('tft') && !iconFilename.startsWith('ct_') && !iconFilename.startsWith('crest_') && !iconFilename.startsWith('realmwrap') && !iconFilename.startsWith('namir')) {
    return `/data/images/items/${iconFilename}`;
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
  // Piltover special items
  if (apiName.includes('TFT16_Item_Piltover_')) {
    return `/data/images/tft_set16_piltover/${apiName.toLowerCase()}.tft_set16.png`;
  }

  // Bilgewater special items
  if (apiName.includes('TFT16_Item_Bilgewater_')) {
    // Stat tier items: ArmorMRTier2 → tft16_bilgewater_armormr_tier2
    const statTierMatch = apiName.match(/TFT16_Item_Bilgewater_(ArmorMR|AS|ADAP|AD|AP|Health)Tier(\d)/);
    if (statTierMatch) {
      const stat = statTierMatch[1].toLowerCase();
      const tier = statTierMatch[2];
      return `/data/images/tft_set16_bilgewater/tft16_bilgewater_${stat}_tier${tier}.tft_set16.png`;
    }
    // Named bilgewater items
    const name = apiName.replace('TFT16_Item_Bilgewater_', '').toLowerCase();
    return `/data/images/tft_set16_bilgewater/tft16_item_bilgewater_${name}.tft_set16.png`;
  }

  // TFT16 artifacts
  if (apiName.includes('TFT16_Artifact_')) {
    return `/data/images/artifacts/${apiName.toLowerCase()}.tft_set16.png`;
  }

  // Standard items & artifacts: try artifacts/ with lowercased apiName
  const lower = apiName.toLowerCase().replace(/_/g, '');
  // TFT_Item_X → tft_item_x
  const normalized = apiName.toLowerCase();
  return `/data/images/artifacts/${normalized}.tft_set13.png`;
}

export function getTraitImage(apiName: string): string {
  // Traits use the icon path from JSON, but we can provide a fallback
  return `/data/images/traits/${apiName}.png`;
}

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
