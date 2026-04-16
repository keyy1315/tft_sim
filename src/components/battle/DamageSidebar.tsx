'use client';

import { CombatResult, TickSnapshot, COST_COLORS } from '@/types';
import { getChampionImage } from '@/data/imageMap';

interface DamageSidebarProps {
  combatResult: CombatResult;
  currentSnapshot: TickSnapshot | null;
  selectedUnitId: string | null;
  onUnitClick: (unitId: string) => void;
}

interface DamageEntry {
  unitId: string;
  championName: string;
  championApiName: string;
  cost: number;
  starLevel: number;
  totalDamage: number;
  isAlive: boolean;
}

function buildEntries(
  combatResult: CombatResult,
  currentSnapshot: TickSnapshot | null,
  team: 'player' | 'enemy',
): DamageEntry[] {
  const units = team === 'player' ? combatResult.playerUnits : combatResult.enemyUnits;
  return units
    .map(u => {
      const snap = currentSnapshot?.units[u.id];
      return {
        unitId: u.id,
        championName: u.champion.name,
        championApiName: u.champion.apiName,
        cost: u.champion.cost,
        starLevel: u.starLevel,
        totalDamage: snap ? snap.totalDamageDealt : u.totalDamageDealt,
        isAlive: snap ? snap.isAlive : u.state !== 'dead',
      };
    })
    .sort((a, b) => b.totalDamage - a.totalDamage);
}

const STAR_LABELS: Record<number, string> = { 1: '', 2: '★★', 3: '★★★' };

export default function DamageSidebar({
  combatResult,
  currentSnapshot,
  selectedUnitId,
  onUnitClick,
}: DamageSidebarProps) {
  const playerEntries = buildEntries(combatResult, currentSnapshot, 'player');
  const enemyEntries = buildEntries(combatResult, currentSnapshot, 'enemy');

  const playerMax = playerEntries[0]?.totalDamage || 1;
  const enemyMax = enemyEntries[0]?.totalDamage || 1;

  return (
    <div className="w-full lg:w-60 lg:shrink-0 space-y-2">
      <TeamDamageList
        label="TEAM A"
        labelColor="text-blue-400"
        entries={playerEntries}
        maxDamage={playerMax}
        barColor="bg-blue-500"
        selectedUnitId={selectedUnitId}
        onUnitClick={onUnitClick}
      />
      <TeamDamageList
        label="TEAM B"
        labelColor="text-red-400"
        entries={enemyEntries}
        maxDamage={enemyMax}
        barColor="bg-red-500"
        selectedUnitId={selectedUnitId}
        onUnitClick={onUnitClick}
      />
    </div>
  );
}

function TeamDamageList({
  label,
  labelColor,
  entries,
  maxDamage,
  barColor,
  selectedUnitId,
  onUnitClick,
}: {
  label: string;
  labelColor: string;
  entries: DamageEntry[];
  maxDamage: number;
  barColor: string;
  selectedUnitId: string | null;
  onUnitClick: (unitId: string) => void;
}) {
  return (
    <div className="bg-[#111827] rounded-xl border border-gray-800 p-2 space-y-0.5">
      <div className={`text-[9px] font-bold ${labelColor} px-1`}>{label} — 데미지</div>
      {entries.map(entry => {
        const isSelected = selectedUnitId === entry.unitId;
        const ratio = maxDamage > 0 ? (entry.totalDamage / maxDamage) * 100 : 0;
        const costColor = COST_COLORS[entry.cost as keyof typeof COST_COLORS] ?? '#9ca3af';

        return (
          <div
            key={entry.unitId}
            onClick={() => onUnitClick(entry.unitId)}
            className={`px-1.5 py-1 rounded cursor-pointer transition-colors ${
              isSelected ? 'bg-gray-700/50' : 'hover:bg-[#1f2937]'
            } ${!entry.isAlive ? 'opacity-40' : ''}`}
          >
            <div className="flex items-center gap-1.5">
              {/* Champion portrait */}
              <div
                className="w-7 h-7 rounded border flex-shrink-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url(${getChampionImage(entry.championApiName)})`,
                  borderColor: costColor,
                }}
              />
              {/* Name + stars */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-300 truncate">{entry.championName}</span>
                  {entry.starLevel > 1 && (
                    <span className="text-[8px] text-yellow-400">{STAR_LABELS[entry.starLevel]}</span>
                  )}
                </div>
              </div>
              {/* Damage number */}
              <span className="text-[11px] font-mono text-gray-200 tabular-nums flex-shrink-0">
                {Math.round(entry.totalDamage).toLocaleString()}
              </span>
            </div>
            {/* Damage bar */}
            <div className="mt-0.5 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${barColor} rounded-full transition-all duration-200`}
                style={{ width: `${ratio}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
