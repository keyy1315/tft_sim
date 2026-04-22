'use client';

import { TickSnapshot, HexCoord, axialToOffset, COST_COLORS } from '@/types';
import type { StatusEffectType } from '@/types';
import { getChampionImage } from '@/data/imageMap';
import { BOARD_COLS } from '@/lib/simulator/models/constants';
import { STATUS_EFFECT_CONFIG, CATEGORY_BORDER } from '@/lib/statusEffectConfig';
import { createHexLayout } from './HexBoard';

interface ReplayBoardProps {
  snapshot: TickSnapshot | null;
  /** 전투 시작 시의 유닛 목록 — 챔피언 이름/아이콘/코스트 매핑용 */
  unitMeta: Record<string, {
    championName: string;
    championApiName: string;
    cost: number;
    team: 'player' | 'enemy';
    starLevel: number;
    items: { apiName: string }[];
    maxHp: number;
    maxMana: number;
  }>;
  selectedUnitId: string | null;
  onUnitClick?: (unitId: string) => void;
  cellSize?: number;
}

const REPLAY_DEFAULT_HEX_R = 40;
const ROWS = 8; // player 4 + enemy 4

export default function ReplayBoard({
  snapshot,
  unitMeta,
  selectedUnitId,
  onUnitClick,
  cellSize = REPLAY_DEFAULT_HEX_R,
}: ReplayBoardProps) {
  const { HEX_R, HEX_W, HEX_H, PAD, teamGap, hexCenter, hexPoints } = createHexLayout(cellSize);
  const cols = BOARD_COLS;
  const width = cols * (HEX_W + PAD) + HEX_W / 2 + 40;
  const height = ROWS * (HEX_H * 0.75 + PAD) + HEX_R + 40 + teamGap;
  const splitY = 4 * (HEX_H * 0.75 + PAD) + 10;
  const dividerY = splitY + teamGap / 2;

  // Build position → unitId map from snapshot (axial → offset for grid matching)
  const posMap = new Map<string, string>();
  if (snapshot) {
    for (const [unitId, unitSnap] of Object.entries(snapshot.units)) {
      if (unitSnap.isAlive) {
        const off = axialToOffset(unitSnap.position as HexCoord);
        posMap.set(`${off.row},${off.col}`, unitId);
      }
    }
  }

  // Extract attack/ability events for visual effects
  const combatEvents: { sourceId: string; targetId: string; value: number; type: 'attack' | 'ability' }[] = [];
  if (snapshot) {
    for (const evt of snapshot.events) {
      if ((evt.type === 'attack' || evt.type === 'ability') && evt.targetId && evt.value != null) {
        combatEvents.push({
          sourceId: evt.sourceId,
          targetId: evt.targetId,
          value: evt.value,
          type: evt.type,
        });
      }
    }
  }

  // Helper: get pixel center for a unit by id
  function getUnitCenter(unitId: string): { cx: number; cy: number } | null {
    if (!snapshot) return null;
    const unitSnap = snapshot.units[unitId];
    if (!unitSnap || !unitSnap.isAlive) return null;
    const off = axialToOffset(unitSnap.position as HexCoord);
    return hexCenter(off.row, off.col);
  }

  return (
    <svg width={width} height={height} className="select-none">
      <defs>
        {Object.entries(unitMeta).map(([unitId, meta]) => (
          <pattern key={unitId} id={`replay-${unitId}`} width="1" height="1" patternContentUnits="objectBoundingBox">
            <image
              href={getChampionImage(meta.championApiName)}
              width="1" height="1"
              preserveAspectRatio="xMidYMid slice"
            />
          </pattern>
        ))}
        {/* Arrow markers for attack lines */}
        <marker id="arrow-physical" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
          <path d="M0,0 L6,2 L0,4" fill="rgba(255,255,255,0.6)" />
        </marker>
        <marker id="arrow-magic" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
          <path d="M0,0 L6,2 L0,4" fill="rgba(168,85,247,0.7)" />
        </marker>
      </defs>

      {/* Dividing line between player/enemy */}
      <line
        x1={10}
        y1={dividerY}
        x2={width - 10}
        y2={dividerY}
        stroke="#374151"
        strokeWidth={1}
        strokeDasharray="4,4"
      />
      <text x={width - 16} y={dividerY - 4} textAnchor="end" fill="#4b5563" fontSize="8">
        TEAM B
      </text>
      <text x={width - 16} y={dividerY + teamGap + 6} textAnchor="end" fill="#4b5563" fontSize="8">
        TEAM A
      </text>

      {Array.from({ length: ROWS }, (_, row) =>
        Array.from({ length: cols }, (_, col) => {
          const { cx, cy } = hexCenter(row, col);
          const posKey = `${row},${col}`;
          const unitId = posMap.get(posKey);
          const meta = unitId ? unitMeta[unitId] : null;
          const unitSnap = unitId && snapshot ? snapshot.units[unitId] : null;
          const isSelected = unitId === selectedUnitId;

          if (!unitId || !meta || !unitSnap) {
            // Empty cell
            return (
              <polygon
                key={posKey}
                points={hexPoints(cx, cy, HEX_R)}
                fill="#0d1117"
                stroke="#1e2535"
                strokeWidth={0.5}
              />
            );
          }

          const hpRatio = meta.maxHp > 0 ? Math.max(0, unitSnap.currentHp) / meta.maxHp : 0;
          const manaRatio = meta.maxMana > 0 ? Math.min(1, unitSnap.currentMana / meta.maxMana) : 0;
          const hpColor = hpRatio > 0.6 ? '#22c55e' : hpRatio > 0.3 ? '#f59e0b' : '#ef4444';
          const teamColor = meta.team === 'player' ? '#3b82f6' : '#ef4444';
          const costColor = COST_COLORS[meta.cost] ?? '#6b7280';
          const barW = HEX_R * 1.2;
          const barX = cx - barW / 2;

          return (
            <g
              key={posKey}
              onClick={() => onUnitClick?.(unitId)}
              className="cursor-pointer"
            >
              {/* Team indicator ring */}
              <polygon
                points={hexPoints(cx, cy, HEX_R + 3)}
                fill="none"
                stroke={teamColor}
                strokeWidth={2.5}
                opacity={0.6}
              />

              {/* Hex background */}
              <polygon
                points={hexPoints(cx, cy, HEX_R)}
                fill={`url(#replay-${unitId})`}
                stroke={isSelected ? '#f59e0b' : costColor}
                strokeWidth={isSelected ? 3 : 2}
              />

              {/* Star level */}
              {meta.starLevel > 0 && (
                <text x={cx} y={cy - HEX_R + 12} textAnchor="middle" fill="#f59e0b" fontSize="13" fontWeight="bold"
                  stroke="#fff" strokeWidth={2} paintOrder="stroke">
                  {'★'.repeat(meta.starLevel)}
                </text>
              )}

              {/* HP Bar + Shield */}
              <rect x={barX} y={cy + HEX_R - 16} width={barW} height={6} rx={2} fill="#1f2937" />
              <rect x={barX} y={cy + HEX_R - 16} width={barW * hpRatio} height={6} rx={2} fill={hpColor} />
              {unitSnap.shield > 0 && meta.maxHp > 0 && (
                <rect
                  x={barX + barW * hpRatio}
                  y={cy + HEX_R - 16}
                  width={barW * Math.min(unitSnap.shield / meta.maxHp, 1 - hpRatio)}
                  height={6}
                  rx={2}
                  fill="#e5e7eb"
                  opacity={0.85}
                />
              )}

              {/* Mana Bar */}
              <rect x={barX} y={cy + HEX_R - 9} width={barW} height={4} rx={1.5} fill="#1f2937" />
              <rect x={barX} y={cy + HEX_R - 9} width={barW * manaRatio} height={4} rx={1.5} fill="#3b82f6" />

              {/* Status effect overlays (stun / invulnerable) */}
              {unitSnap.statusEffects.some(e => e.type === 'stun') && (
                <polygon
                  points={hexPoints(cx, cy, HEX_R - 1)}
                  fill="rgba(251,191,36,0.25)"
                  stroke="none"
                  style={{ pointerEvents: 'none' }}
                />
              )}
              {unitSnap.statusEffects.some(e => e.type === 'invulnerable') && (
                <polygon
                  points={hexPoints(cx, cy, HEX_R - 1)}
                  fill="rgba(192,132,252,0.25)"
                  stroke="none"
                  style={{ pointerEvents: 'none' }}
                />
              )}

              {/* Status effect icon group */}
              {unitSnap.statusEffects.length > 0 && (() => {
                const maxIcons = 3;
                const displayed = unitSnap.statusEffects.slice(0, maxIcons);
                const overflow = unitSnap.statusEffects.length - maxIcons;
                const iconX = cx + HEX_R - 2;
                const iconYStart = cy - HEX_R + 10;
                const iconGap = 14;

                return (
                  <g>
                    {displayed.map((effect, i) => {
                      const cfg = STATUS_EFFECT_CONFIG[effect.type as StatusEffectType];
                      if (!cfg) return null;
                      const borderColor = CATEGORY_BORDER[cfg.category];
                      const iy = iconYStart + i * iconGap;
                      return (
                        <g key={i}>
                          <circle cx={iconX} cy={iy} r={6} fill={cfg.bgColor} stroke={borderColor} strokeWidth={1} />
                          <text
                            x={iconX} y={iy + 1}
                            textAnchor="middle" dominantBaseline="central"
                            fontSize={8} fontWeight="bold" fill={cfg.color}
                          >
                            {cfg.icon}
                          </text>
                          <title>{`${cfg.label} (${effect.remainingTicks}틱)`}</title>
                        </g>
                      );
                    })}
                    {overflow > 0 && (
                      <g>
                        <circle cx={iconX} cy={iconYStart + maxIcons * iconGap} r={6} fill="#374151" stroke="#6b7280" strokeWidth={1} />
                        <text
                          x={iconX} y={iconYStart + maxIcons * iconGap + 1}
                          textAnchor="middle" dominantBaseline="central"
                          fontSize={7} fill="#9ca3af"
                        >
                          +{overflow}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })()}

              {/* Item dots */}
              {meta.items.length > 0 && (
                <g>
                  {meta.items.slice(0, 3).map((_, i) => (
                    <circle
                      key={i}
                      cx={cx - 6 + i * 6}
                      cy={cy + HEX_R - 4}
                      r={2}
                      fill="#f59e0b"
                      stroke="#111"
                      strokeWidth={0.5}
                    />
                  ))}
                </g>
              )}
            </g>
          );
        })
      )}
      {/* === Attack Lines === */}
      {combatEvents.map((evt, i) => {
        const src = getUnitCenter(evt.sourceId);
        const tgt = getUnitCenter(evt.targetId);
        if (!src || !tgt) return null;

        const isAbility = evt.type === 'ability';
        const lineColor = isAbility ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.35)';
        const markerId = isAbility ? 'arrow-magic' : 'arrow-physical';

        // Shorten line so it doesn't overlap the target hex
        const dx = tgt.cx - src.cx;
        const dy = tgt.cy - src.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const shortenPx = HEX_R * 0.6;
        const ratio = dist > 0 ? (dist - shortenPx) / dist : 0;
        const endX = src.cx + dx * ratio;
        const endY = src.cy + dy * ratio;

        return (
          <line
            key={`line-${i}`}
            x1={src.cx}
            y1={src.cy}
            x2={endX}
            y2={endY}
            stroke={lineColor}
            strokeWidth={isAbility ? 2 : 1.5}
            strokeDasharray={isAbility ? '4,2' : 'none'}
            markerEnd={`url(#${markerId})`}
          />
        );
      })}

      {/* === Damage Numbers === */}
      {combatEvents.map((evt, i) => {
        const tgt = getUnitCenter(evt.targetId);
        if (!tgt || evt.value <= 0) return null;

        const isAbility = evt.type === 'ability';
        const isCrit = evt.value > 200;
        const offsetX = (i % 3 - 1) * 12;

        return (
          <text
            key={`dmg-${i}`}
            x={tgt.cx + offsetX}
            y={tgt.cy - HEX_R - 2}
            textAnchor="middle"
            fontSize={isCrit ? 12 : 10}
            fontWeight="bold"
            fill={isAbility ? '#c084fc' : isCrit ? '#fbbf24' : '#ffffff'}
            stroke="#000"
            strokeWidth={0.5}
            paintOrder="stroke"
            opacity={0.9}
          >
            {Math.round(evt.value)}
          </text>
        );
      })}
    </svg>
  );
}
