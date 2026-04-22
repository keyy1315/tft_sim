'use client';

import DraggableItemIcon from '@/components/builder/DraggableItemIcon';
import ItemIcon from '@/components/builder/ItemIcon';
import { isBilgewaterStatItem } from '@/data/traitModules';
import type { SimulatorLayoutProps } from '../types';

export default function BilgewaterPoolContent({ data, tm }: SimulatorLayoutProps) {
  const hasBWPlayer = tm.playerTraits.some(t => t.trait.apiName === 'TFT16_Bilgewater' && t.style > 0);
  const hasBWEnemy = tm.enemyTraits.some(t => t.trait.apiName === 'TFT16_Bilgewater' && t.style > 0);

  const statItems = data.items.filter(item => isBilgewaterStatItem(item.apiName));
  const equipItems = data.items.filter(item => {
    if (!item.apiName.includes('TFT16_Item_Bilgewater_')) return false;
    if (isBilgewaterStatItem(item.apiName)) return false;
    if (Object.keys(item.effects).length === 0) return false;
    return true;
  });

  return (
    <div className="flex flex-col min-h-0 flex-1 gap-2">
      <div className="text-[10px] font-bold text-teal-400 shrink-0">능력치 (클릭으로 구매 — 빌지워터 챔피언 전체 적용)</div>
      <div className="grid grid-cols-7 gap-1.5 overflow-y-auto min-h-0 p-1">
        {statItems.map(item => {
          const playerCount = tm.playerBilgewaterStats[item.apiName] ?? 0;
          const enemyCount = tm.enemyBilgewaterStats[item.apiName] ?? 0;
          const totalCount = playerCount + enemyCount;
          return (
            <div
              key={item.apiName}
              className="relative"
              onContextMenu={(e) => {
                e.preventDefault();
                if (hasBWPlayer && playerCount > 0) tm.handleRemoveBilgewaterStat('player', item.apiName);
                else if (hasBWEnemy && enemyCount > 0) tm.handleRemoveBilgewaterStat('enemy', item.apiName);
              }}
            >
              <ItemIcon
                item={item}
                size={32}
                onClick={() => {
                  if (hasBWPlayer) tm.handleBuyBilgewaterStat('player', item);
                  else if (hasBWEnemy) tm.handleBuyBilgewaterStat('enemy', item);
                }}
              />
              {totalCount > 0 && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-teal-600 rounded-full text-[8px] text-white flex items-center justify-center font-bold pointer-events-none">
                  {totalCount}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-[10px] font-bold text-teal-400 shrink-0 mt-2">장비 아이템 (드래그로 장착)</div>
      <div className="grid grid-cols-7 gap-1.5 overflow-y-auto min-h-0 p-1">
        {equipItems.map(item => <DraggableItemIcon key={item.apiName} item={item} size={32} />)}
      </div>
    </div>
  );
}
