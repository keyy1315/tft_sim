import { describe, it, expect } from 'vitest';
import { getRiotIdAliases } from '@/lib/analysis/itemIdAliases';

describe('getRiotIdAliases', () => {
  it('찬란 canonical (TFT_Item_Radiant_X) → Riot raw ID alias 2종 반환', () => {
    const aliases = getRiotIdAliases('TFT_Item_Radiant_BlueBuff');
    expect(aliases).toEqual([
      'TFT5_Item_BlueBuffRadiant',
      'TFT_Item_BlueBuffRadiant',
    ]);
  });

  it('타락 canonical (TFT_Item_CorruptedX) → Riot raw ID alias 2종 반환', () => {
    const aliases = getRiotIdAliases('TFT_Item_CorruptedJeweledGauntlet');
    expect(aliases).toEqual([
      'TFT5_Item_JeweledGauntletRadiant',
      'TFT_Item_JeweledGauntletRadiant',
    ]);
  });

  it('찬란/타락이 아닌 canonical → 빈 배열', () => {
    expect(getRiotIdAliases('TFT_Item_BFSword')).toEqual([]);
    expect(getRiotIdAliases('TFT7_Item_ShimmerscaleGamblersBlade')).toEqual([]);
    expect(getRiotIdAliases('TFT17_Item_PsyOps_DroneMod_Radiant')).toEqual([]);
  });

  it('잘못된 형식 입력 → 빈 배열', () => {
    expect(getRiotIdAliases('')).toEqual([]);
    expect(getRiotIdAliases('garbage')).toEqual([]);
  });
});
