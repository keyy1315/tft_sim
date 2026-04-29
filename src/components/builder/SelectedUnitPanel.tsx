'use client';

import { PlacedChampion, RawItem, ActiveTrait, MfMode, MF_MODE_CONFIG, PERMANENT_STACK_CONFIG } from '@/types';
import Image from 'next/image';
import ChampionCard from './ChampionCard';
import StarSelector from './StarSelector';
import ItemIcon from './ItemIcon';
import ItemGrid from './ItemGrid';
import Modal from '@/components/ui/Modal';
import { useState, useMemo } from 'react';
import { getItemCategory } from '@/lib/simulator/systems/item';
import { resolveDescription } from '@/lib/utils/text';
import { FACTORY_NEW_TREE, suffixToApiName } from '@/data/factoryNewTree';

interface SelectedUnitPanelProps {
  placed: PlacedChampion;
  team: 'player' | 'enemy';
  allItems: RawItem[];
  activeTraits: ActiveTrait[];
  onStarChange: (level: number) => void;
  onEquipItem: (item: RawItem) => void;
  onRemoveItem: (itemIdx: number) => void;
  onRemoveVoidItem?: () => void;
  onRemoveUnit: () => void;
  onMfModeChange?: (mode: MfMode) => void;
  onPermanentStackChange?: (value: number) => void;
  /** 그레이브즈일 때만 활성화 — 무기고 편집 모달 open 콜백. */
  onEditGravesWeapons?: () => void;
  /**
   * 팀 단위로 보유한 무기고 picks (codex PR #50 P1 fix).
   * 같은 팀의 모든 그레이브즈 unit 선택 시 동일 picks 표시 — 시뮬은 가장 강한 1명에게만 적용하지만,
   * 사용자 mental model 은 "팀의 무기고". 그레이브즈가 아니면 무시.
   */
  teamGravesPicks?: string[];
}

export default function SelectedUnitPanel({
  placed,
  team,
  allItems,
  activeTraits,
  onStarChange,
  onEquipItem,
  onRemoveItem,
  onRemoveVoidItem,
  onRemoveUnit,
  onMfModeChange,
  onPermanentStackChange,
  onEditGravesWeapons,
  teamGravesPicks,
}: SelectedUnitPanelProps) {
  const [showItemPicker, setShowItemPicker] = useState(false);
  const teamColor = team === 'player' ? 'border-blue-600/30' : 'border-red-600/30';
  const teamLabel = team === 'player' ? 'A' : 'B';

  const artifactCount = placed.items.filter(i => getItemCategory(i) === 'artifact').length;

  // 그레이브즈 무기고 — team scope picks (P1 fix). suffix → RawItem lookup.
  const isGraves = placed.champion.apiName === 'TFT17_Graves';
  const gravesPicks = teamGravesPicks ?? [];
  const gravesPickItems = useMemo(() => {
    if (!isGraves || gravesPicks.length === 0) return [];
    const itemMap = new Map(allItems.map(i => [i.apiName, i]));
    return gravesPicks
      .map(suffix => ({
        suffix,
        item: itemMap.get(suffixToApiName(suffix)) ?? null,
        node: FACTORY_NEW_TREE[suffix] ?? null,
      }))
      .filter((entry): entry is { suffix: string; item: RawItem; node: typeof FACTORY_NEW_TREE[string] } =>
        entry.item !== null && entry.node !== null,
      );
  }, [isGraves, gravesPicks, allItems]);

  return (
    <div className={`bg-[#111827] rounded-xl border ${teamColor} p-3 space-y-3`}>
      <div className="flex items-center gap-3">
        <ChampionCard
          champion={placed.champion}
          size={48}
          starLevel={placed.starLevel}
          showName={false}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-gray-200 truncate">{placed.champion.name}</div>
          <div className="text-[10px] text-gray-500">{teamLabel} / {placed.champion.cost}코스트</div>
        </div>
        <button
          onClick={onRemoveUnit}
          className="px-2 py-1 bg-red-900/30 text-red-400 rounded text-xs hover:bg-red-900/50"
        >
          제거
        </button>
      </div>

      <StarSelector starLevel={placed.starLevel} onChange={onStarChange} />

      {placed.champion.apiName === 'TFT17_MissFortune' && onMfModeChange && (
        <div>
          <div className="text-xs text-gray-400 mb-1.5">모드 선택</div>
          <div className="flex gap-1.5">
            {(['replicator', 'channeler', 'challenger'] as MfMode[]).map(mode => {
              const cfg = MF_MODE_CONFIG[mode];
              const isActive = placed.mfMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => onMfModeChange(mode)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] transition-colors ${
                    isActive
                      ? 'border-yellow-500 bg-yellow-500/20 text-yellow-300'
                      : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <Image src={cfg.icon} alt={cfg.name} width={16} height={16} unoptimized />
                  {cfg.name.replace(' 모드', '')}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(() => {
        const stackConfig = PERMANENT_STACK_CONFIG[placed.champion.apiName];
        if (!stackConfig || !onPermanentStackChange) return null;
        const currentValue = placed.permanentStacks?.value ?? 0;
        const previewText = stackConfig.preview(currentValue, placed.starLevel);
        return (
          <div>
            <div className="text-xs text-gray-400 mb-1.5">{stackConfig.label}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPermanentStackChange(Math.max(0, currentValue - 1))}
                disabled={currentValue <= 0}
                className="w-7 h-7 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-30 font-bold text-sm"
              >-</button>
              <input
                type="number"
                value={currentValue}
                onChange={e => onPermanentStackChange(Math.max(0, Math.min(stackConfig.max, parseInt(e.target.value) || 0)))}
                className="w-16 h-7 bg-gray-800 border border-gray-600 rounded text-center text-sm text-yellow-400 font-bold"
                min={0}
                max={stackConfig.max}
              />
              <button
                onClick={() => onPermanentStackChange(Math.min(stackConfig.max, currentValue + 1))}
                disabled={currentValue >= stackConfig.max}
                className="w-7 h-7 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-30 font-bold text-sm"
              >+</button>
              {stackConfig.unit && <span className="text-[10px] text-gray-500">{stackConfig.unit}</span>}
            </div>
            {previewText && (
              <div className="text-[10px] text-cyan-400 mt-1">{previewText}</div>
            )}
          </div>
        );
      })()}

      <div>
        <div className="text-xs text-gray-400 mb-1.5">
          아이템 ({placed.items.length}/3)
          {artifactCount > 0 && <span className="ml-1 text-purple-400">유물 {artifactCount}/1</span>}
        </div>
        <div className="flex gap-1.5 items-center">
          {placed.items.map((item, idx) => (
            <ItemIcon
              key={`${item.apiName}-${idx}`}
              item={item}
              size={32}
              onRemove={() => onRemoveItem(idx)}
            />
          ))}
          {placed.items.length < 3 && (
            <button
              onClick={() => setShowItemPicker(true)}
              className="w-8 h-8 rounded border border-dashed border-gray-600 text-gray-500 hover:border-gray-400 hover:text-gray-300 flex items-center justify-center text-sm"
            >
              +
            </button>
          )}
        </div>
      </div>

      {/* 그레이브즈 최신상 무기고 — placed 가 그레이브즈일 때만 표시. ItemIcon 자동 hover tooltip. */}
      {isGraves && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-xs text-gray-400">
              최신상 무기고 ({gravesPicks.length}개)
            </div>
            {onEditGravesWeapons && (
              <button
                onClick={onEditGravesWeapons}
                className="px-2 py-0.5 text-[10px] bg-blue-900/40 hover:bg-blue-900/60 text-blue-200 border border-blue-700/40 rounded"
              >
                {gravesPicks.length === 0 ? '+ 무기 선택' : '편집'}
              </button>
            )}
          </div>
          {gravesPickItems.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {gravesPickItems.map(({ suffix, item }, idx) => (
                <ItemIcon key={`graves-${suffix}-${idx}`} item={item} size={32} />
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-gray-500 italic">선택된 무기 없음</div>
          )}
        </div>
      )}

      {placed.champion.traits.includes('공허') && (
        <div>
          <div className="text-xs text-gray-400 mb-1.5">
            돌연변이 ({placed.voidItem ? 1 : 0}/1)
          </div>
          <div className="flex gap-1.5 items-center">
            {placed.voidItem ? (
              <ItemIcon
                item={placed.voidItem}
                size={32}
                onRemove={onRemoveVoidItem}
              />
            ) : (
              <button
                onClick={() => setShowItemPicker(true)}
                className="w-8 h-8 rounded border border-dashed border-purple-600/50 text-purple-400 hover:border-purple-400 hover:text-purple-300 flex items-center justify-center text-sm"
              >
                +
              </button>
            )}
          </div>
        </div>
      )}

      <div className="text-[10px] text-gray-500 space-y-0.5">
        <div>특성: {
          placed.champion.apiName === 'TFT17_MissFortune' && placed.mfMode
            ? placed.champion.traits.map(t => t === '특성 선택' ? MF_MODE_CONFIG[placed.mfMode!].name.replace(' 모드', '') : t).join(', ')
            : placed.champion.traits.join(', ')
        }</div>
      </div>

      {(() => {
        const isMf = placed.champion.apiName === 'TFT17_MissFortune';
        const modeAbility = isMf && placed.mfMode ? MF_MODE_CONFIG[placed.mfMode].ability : null;
        const abilityName = modeAbility?.name ?? placed.champion.ability.name;
        const abilityDesc = modeAbility
          ? `${modeAbility.desc}\n\n피해량: ${modeAbility.damage[placed.starLevel - 1] ?? modeAbility.damage[0]}`
          : placed.champion.ability.desc;
        if (!abilityName) return null;
        return (
          <div className="border-t border-gray-700 pt-2">
            <div className="text-xs text-cyan-400 font-bold">{abilityName}</div>
            {abilityDesc && (
              <div className="text-[10px] text-gray-400 mt-0.5 leading-relaxed whitespace-pre-line">
                {modeAbility
                  ? abilityDesc
                  : resolveDescription(placed.champion.ability.desc, placed.champion.ability.variables, placed.starLevel)}
              </div>
            )}
            {isMf && !placed.mfMode && (
              <div className="text-[10px] text-yellow-400 mt-1">모드를 선택하세요</div>
            )}
          </div>
        );
      })()}

      <Modal isOpen={showItemPicker} onClose={() => setShowItemPicker(false)} title="아이템 선택">
        <ItemGrid
          items={allItems}
          activeTraits={activeTraits}
          champion={placed}
          onSelect={(item) => {
            onEquipItem(item);
            setShowItemPicker(false);
          }}
        />
      </Modal>
    </div>
  );
}
