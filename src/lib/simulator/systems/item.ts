import { RawItem, ItemEffect } from '@/types';
import { ITEM_EFFECT_KEYS } from '@/lib/simulator/models/constants';

export function resolveItemEffect(item: RawItem): ItemEffect {
  const result: ItemEffect = {};
  for (const [key, value] of Object.entries(item.effects)) {
    const mapped = ITEM_EFFECT_KEYS[key];
    if (mapped && typeof value === 'number') {
      (result as Record<string, number>)[mapped] = value;
    }
  }
  return result;
}

export function isBaseComponent(item: RawItem): boolean {
  return item.composition.length === 0 && !item.apiName.includes('TFT16_');
}

export function isCombinedItem(item: RawItem): boolean {
  return item.composition.length === 2;
}

export function isArtifact(item: RawItem): boolean {
  return item.apiName.includes('_Artifact_') || item.icon.includes('Artifact');
}

export function getItemCategory(item: RawItem): string {
  if (isBaseComponent(item)) return 'component';
  if (isCombinedItem(item)) return 'combined';
  if (isArtifact(item)) return 'artifact';
  if (item.apiName.includes('Piltover')) return 'piltover';
  if (item.apiName.includes('Bilgewater')) return 'bilgewater';
  return 'special';
}
