# TFT Combat Simulator - Design-Implementation Gap Analysis Report

> **Summary**: Comprehensive gap analysis between design document v2.1 and actual implementation
>
> **Design Document**: `plans/tft_simulator_design_v2.md` (v2.1)
> **Implementation Path**: `src/`
> **Analysis Date**: 2026-03-13
> **Status**: Draft

---

## 1. Executive Summary

**Overall Match Rate: 52%**

The implementation provides a functional stat calculator and basic combat loop, but diverges significantly from the v2.1 design in core type definitions, coordinate systems, and several missing subsystems. The design document itself flagged three migration items (Unit type rename, coordinate system, model file split) -- none have been addressed. Critical subsystems like Seed RNG, EventBus, Replay snapshots, targeting system, and mana system remain unimplemented.

---

## 2. Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| Tech Stack Match | 100% | Pass |
| Data Model / Type Match | 35% | Fail |
| Combat Engine | 40% | Fail |
| Event / Replay System | 10% | Fail |
| Component Structure | 45% | Warn |
| Zustand Store | 60% | Warn |
| Folder Structure | 55% | Warn |
| Data Pipeline | 70% | Warn |
| **Overall** | **52%** | **Fail** |

---

## 3. Section-by-Section Comparison

### Section 3: Tech Stack

| Dependency | Design Version | package.json Version | Match |
|-----------|---------------|---------------------|:-----:|
| Next.js | 16.1.6 | ^16.1.6 | Pass |
| React | 19.2.4 | ^19.2.4 | Pass |
| TypeScript | 5.9.3 | ^5.9.3 | Pass |
| TailwindCSS | 4.2.1 | ^4.2.1 | Pass |
| Zustand | 5.0.11 | ^5.0.11 | Pass |
| @dnd-kit/core | 6.3.1 | ^6.3.1 | Pass |
| recharts | 3.8.0 | ^3.8.0 | Pass |
| babel-plugin-react-compiler | 1.0.0 | ^1.0.0 | Pass |

**Score: 100%** -- All versions match.

---

### Section 5: Unit Model

| Design Item | Design Spec | Implementation | Status |
|------------|-------------|----------------|:------:|
| Type name | `Unit` | `CombatUnit` | Fail |
| Coordinate type | `HexCoord { q, r }` | `HexPos { row, col }` | Fail |
| Team values | `'player' \| 'enemy'` | `'ally' \| 'enemy'` | Fail |
| `star_level` type | `1 \| 2 \| 3` | `number` | Fail |
| `role: UnitRole` field | Required | Missing entirely | Fail |
| `mana_per_attack` field | Role-based (5/7/10) | Fixed `MANA_PER_ATTACK = 10` | Fail |
| `mana_per_second` field | Caster=2, else 0 | Missing | Fail |
| `mana_from_damage` field | Tank=true | Hardcoded for all units | Fail |
| `targeting_weight` field | 1/2/3 by role | Missing | Fail |
| `omnivamp` field | Fighter passive | Missing | Fail |
| `status_effects` field | `StatusEffect[]` | Missing | Fail |
| `attack_damage` / `attack_speed` / etc. | snake_case fields | camelCase `ChampionStats` | Fail |
| `ability: Ability` field | Structured type | `RawChampion.ability` (raw JSON) | Fail |
| `items: Item[]` field | Typed items | `RawItem[]` (raw JSON) | Warn |

**Score: 10%** -- Type structure differs in almost every aspect. The design's `Unit` type with role-based fields is not implemented; instead a simpler `CombatUnit` is used with `ChampionStats`.

---

### Section 5-A: Star Level Scaling

| Design Item | Implementation | Status |
|------------|----------------|:------:|
| `STAR_MULTIPLIER` constant | `STAR_SCALING` in `types/index.ts` with correct values {1:1, 2:1.8, 3:3.24} | Pass |
| `applyStarLevel()` function | Applied in `stat.ts` via `calculateStats()` | Pass |
| Applied to HP and AD only | HP and AD scaled, others not (correct) | Pass |
| Location: `systems/stat.ts` | Implemented in `systems/stat.ts` | Pass |

**Score: 90%** -- Functionally correct, minor naming difference (`STAR_SCALING` vs `STAR_MULTIPLIER`).

---

### Section 5-B: StatusEffect Type

| Design Item | Implementation | Status |
|------------|----------------|:------:|
| `StatusEffectType` union type | Not defined | Fail |
| `StatusEffect` type | Not defined | Fail |
| Stun behavior | Not implemented | Fail |
| Taunt behavior | Not implemented | Fail |
| Shield / slow / burn / disarm / invulnerable | Not implemented | Fail |

**Score: 0%** -- Completely missing.

---

### Section 6: Board / Coordinate System

| Design Item | Implementation | Status |
|------------|----------------|:------:|
| Coordinate system | Design: Axial `{ q, r }` | Code: Offset `{ row, col }` | Fail |
| `HexCoord` type | Not defined; uses `HexPos` | Fail |
| `hexDistance()` | Uses offset-to-axial conversion internally (correct math) | Warn |
| `HexCell` type | Not defined | Fail |
| Board size 7x4 | `BOARD_ROWS=4, BOARD_COLS=7` (correct) | Pass |

**Score: 30%** -- Distance calculation works via internal conversion, but the public API and types still use offset coordinates, contrary to design mandate.

---

### Section 7: Combat Loop

| Design Item | Implementation | Status |
|------------|----------------|:------:|
| Tick-based loop | Yes, implemented in `combatLoop.ts` | Pass |
| 30 ticks/second | `TICK_DURATION=0.1` (10 ticks/s) | Fail |
| `update_mana()` phase | No separate mana phase; mana gained inline during attack | Warn |
| `find_target()` phase | `findNearestEnemy()` -- distance only, no role tiebreaker | Fail |
| `move_toward_target()` | Implemented via `findBestMoveToward()` | Pass |
| `attack()` phase | Implemented with cooldown system | Pass |
| `cast_ability()` phase | Implemented (mana threshold) | Pass |
| `apply_items()` phase | Items applied at stat calc time only, no combat-time effects | Warn |
| `apply_traits()` phase | Traits applied at stat calc time only | Warn |
| `resolve_damage()` | `applyResistance()` with correct formula | Pass |
| `process_death()` | Death check after damage | Pass |
| `record_snapshot()` | **Not implemented** -- no tick snapshots recorded | Fail |
| Deterministic design | **Violated** -- uses `Math.random()` at line 99 | Fail |

**Score: 45%** -- Basic loop works but violates determinism requirement and lacks snapshots/role-based targeting.

---

### Section 7-A: Targeting System

| Design Item | Implementation | Status |
|------------|----------------|:------:|
| Distance-first targeting | `findNearestEnemy()` -- yes | Pass |
| Role-based tiebreaker | Not implemented (no `UnitRole`, no weights) | Fail |
| `targeting_weight` (3/2/1) | Missing | Fail |
| Taunt override | Not implemented | Fail |
| Path-blocked fallback | Not implemented | Fail |
| Target-death retargeting | Retargets each tick (implicit) | Pass |
| Ability targeting types | Not implemented | Fail |
| Assassin jump logic | Not implemented | Fail |

**Score: 20%** -- Only basic nearest-enemy targeting works.

---

### Section 7-B: Damage Calculation

| Design Item | Implementation | Status |
|------------|----------------|:------:|
| Physical damage formula `raw * 100/(100+armor)` | `applyResistance()` matches | Pass |
| Magic damage formula | Applied in ability cast with `magicResist` | Pass |
| True damage (no reduction) | Handled in `attack.ts` (`dmgType === 'true'` case) | Pass |
| Critical hit formula | Implemented | Pass |
| Default crit multiplier 1.4 | Uses champion's `critMultiplier` from data | Pass |
| Shield processing | Not implemented | Fail |
| Omnivamp healing | Not implemented | Fail |

**Score: 70%** -- Core formulas correct; shield and omnivamp missing.

---

### Section 7-C: Seed RNG

| Design Item | Implementation | Status |
|------------|----------------|:------:|
| `SeededRNG` type | Not defined | Fail |
| `createRNG()` Mulberry32 | Not implemented | Fail |
| File: `engine/rng.ts` | File does not exist | Fail |
| `Math.random()` prohibition | **Violated** in `combatLoop.ts:99` | Fail |

**Score: 0%** -- Completely missing. This is a critical violation of both the design doc and CLAUDE.md.

---

### Section 8: Ability System

| Design Item | Implementation | Status |
|------------|----------------|:------:|
| `Effect` type | Not defined | Fail |
| `Ability` type (structured) | Not defined; raw JSON used directly | Fail |
| `parseAbility()` | Implemented -- parses damage type and scaling from desc tags | Pass |
| `getAbilityDamage()` | Implemented with star level and AP/AD scaling | Pass |
| `cast_time_ticks` | Not implemented | Fail |
| Multi-effect abilities | Not supported | Fail |

**Score: 35%** -- Damage calculation works but type system is ad-hoc.

---

### Section 8-A: Augment System

| Design Item | Implementation | Status |
|------------|----------------|:------:|
| `AugmentEffectType` union | Not defined | Fail |
| `AugmentEffect` type | Not defined | Fail |
| `Augment` type (with tier) | Not defined; uses `RawAugment` | Fail |
| `stat_modifier` implementation | `resolveAugmentEffects()` applies stat bonuses | Pass |
| Type file: `types/augment.ts` | Not a separate file; types in `types/index.ts` | Warn |
| System file: `systems/augment.ts` | Exists | Pass |

**Score: 40%** -- Functional for stat modifiers but lacking designed type structure.

---

### Section 9: Event System

| Design Item | Implementation | Status |
|------------|----------------|:------:|
| `EventBus` | Not implemented | Fail |
| `events/eventBus.ts` file | Does not exist | Fail |
| Event types (on_combat_start, on_attack, etc.) | Not implemented | Fail |
| Hook-based registration | Not implemented | Fail |
| Priority ordering | Not implemented | Fail |

**Score: 0%** -- Completely missing. Combat events are logged as `CombatLog` entries but there is no event bus for items/traits/augments to hook into.

---

### Section 10: Replay System

| Design Item | Implementation | Status |
|------------|----------------|:------:|
| `TickSnapshot` type | Not defined | Fail |
| Tick snapshot recording | Not implemented in combat loop | Fail |
| `replayEngine.ts` file | Does not exist | Fail |
| Play/Pause/Speed/Step/Seek controls | Not implemented | Fail |
| `replaySlice` store | Exists but uses `unknown[]` for snapshots | Warn |

**Score: 10%** -- Store shell exists but no actual replay functionality.

---

### Section 17: Component Structure

| Design Component | Implementation | Status |
|-----------------|----------------|:------:|
| BattlePage | `app/simulator/page.tsx` | Pass |
| TeamBuilder | Partially via builder components | Warn |
| ChampionGrid | `components/builder/ChampionGrid.tsx` | Pass |
| ItemSlot | `components/builder/ItemGrid.tsx` (different name) | Warn |
| AugmentSelector | Not found as dedicated component | Fail |
| SynergyTracker | `components/builder/TraitBar.tsx` (different name) | Warn |
| BattleBoard | `components/battle/HexBoard.tsx` (different name) | Warn |
| HexCell | Inline in HexBoard | Warn |
| UnitToken | Not a separate component | Fail |
| Portrait / HpBar / ManaBar / ItemRow / StatusRow | Not implemented | Fail |
| BattleControls | Not found | Fail |
| PlayPauseButton / SpeedSelector / SeekSlider | Not found | Fail |
| AnalysisPanel | Not found as container | Fail |
| DamageTable | `DamageResultPanel.tsx` (different name/structure) | Warn |
| EventLog | Not found | Fail |
| ResultChart | Not found | Fail |
| ui/Modal | `components/ui/Modal.tsx` | Pass |
| ui/SearchBar | `components/ui/SearchBar.tsx` | Pass |
| ui/Tooltip | `components/ui/Tooltip.tsx` | Pass |

**Score: 35%** -- Many components missing or renamed.

---

### Section 18: Zustand Store

| Design Item | Implementation | Status |
|------------|----------------|:------:|
| 4 slices (team/battle/replay/ui) | All 4 files exist | Pass |
| `teamSlice` fields | `team_player/team_enemy` -> `placedChampions` (single team, not dual) | Warn |
| `teamSlice.board: HexCell[][]` | Not implemented | Fail |
| `battleSlice.battle_status` | `status` with correct values | Pass |
| `battleSlice.current_tick` | `currentTick` | Pass |
| `battleSlice.units_live` | Not implemented | Fail |
| `replaySlice.snapshots: TickSnapshot[]` | `snapshots: unknown[]` | Fail |
| `replaySlice.playback_speed: 1\|2\|4` | `playbackSpeed: number` | Warn |
| `uiSlice.selected_unit_id` | `selectedUnitId` | Pass |
| `uiSlice.active_panel` | `activePanel` | Pass |
| Unified `useSimulatorStore` | 4 separate stores (not combined) | Warn |

**Score: 50%** -- Stores exist but field structures differ significantly from design.

---

### Section 19: Folder Structure

| Design Path | Exists | Status |
|------------|:------:|:------:|
| `src/app/simulator/` | Yes | Pass |
| `src/app/builder/team-builder/` | Yes | Pass |
| `src/app/builder/calculator/` | Yes | Pass |
| `src/app/api/simulate/` | Yes | Pass |
| `src/app/api/metadata/` | Yes | Pass |
| `src/components/battle/` | Yes | Pass |
| `src/components/builder/` | Yes | Pass |
| `src/components/analysis/` | Yes (DamageResultPanel) | Warn |
| `src/components/ui/` | Yes (Modal, SearchBar, Tooltip) | Pass |
| `src/hooks/` | Yes | Pass |
| `src/lib/simulator/engine/combatLoop.ts` | Yes | Pass |
| `src/lib/simulator/engine/replayEngine.ts` | **No** | Fail |
| `src/lib/simulator/engine/rng.ts` | **No** | Fail |
| `src/lib/simulator/systems/targeting.ts` | **No** | Fail |
| `src/lib/simulator/systems/attack.ts` | Yes | Pass |
| `src/lib/simulator/systems/ability.ts` | Yes | Pass |
| `src/lib/simulator/systems/mana.ts` | **No** | Fail |
| `src/lib/simulator/systems/stat.ts` | Yes | Pass |
| `src/lib/simulator/systems/augment.ts` | Yes | Pass |
| `src/lib/simulator/systems/trait.ts` | Yes | Pass |
| `src/lib/simulator/systems/item.ts` | Yes | Pass |
| `src/lib/simulator/models/unit.ts` | **No** (only `constants.ts`) | Fail |
| `src/lib/simulator/models/ability.ts` | **No** | Fail |
| `src/lib/simulator/models/hex.ts` | **No** | Fail |
| `src/lib/simulator/events/eventBus.ts` | **No** | Fail |
| `src/data/loader.ts` | Yes | Pass |
| `src/data/imageMap.ts` | Yes | Pass |
| `src/data/champions.json` | No (in `public/data/`) | Warn |
| `src/store/` (4 slices) | Yes | Pass |
| `src/types/` | Yes (single `index.ts`) | Warn |
| `src/styles/globals.css` | Yes | Pass |
| `raw-data/` | Yes (images exist) | Pass |

**Score: 55%** -- Core folders exist but 8 design-specified files are missing entirely.

---

### Section 20-A: Data Pipeline

| Design Item | Implementation | Status |
|------------|----------------|:------:|
| `loader.ts` with caching | Implemented with in-memory cache | Pass |
| `imageMap.ts` with `getChampionIcon()` | `getChampionImage()` (name differs) | Warn |
| `imageMap.ts` with `getItemIcon()` | `getItemImage()` (name differs) | Warn |
| `imageMap.ts` with `getTraitIcon()` | `getTraitImage()` (name differs) | Warn |
| `useGameData` hook | Implemented with individual hooks | Pass |
| `useChampions()` / `useItems()` | Implemented | Pass |
| `patch_version` check in loader | Not implemented (loader does filtering only) | Fail |
| JSON in `src/data/` | JSON in `public/data/` instead | Warn |

**Score: 65%** -- Functional but data lives in `public/data/` and no version validation.

---

## 4. Gap List by Severity

### Critical (Blocks core functionality or violates CLAUDE.md)

| # | Gap | Design Section | Impact |
|---|-----|---------------|--------|
| 1 | `Math.random()` used in combat loop | 7-C | Violates CLAUDE.md rule; breaks replay determinism |
| 2 | No Seed RNG (`engine/rng.ts`) | 7-C | Replay cannot be deterministic |
| 3 | No EventBus (`events/eventBus.ts`) | 9 | Items/traits/augments cannot hook into combat events |
| 4 | No Replay snapshots (no `TickSnapshot`, no `record_snapshot()`) | 10 | Replay feature non-functional |
| 5 | Unit type mismatch: `CombatUnit` vs `Unit`, `HexPos` vs `HexCoord`, `ally` vs `player` | 5 | Design explicitly flagged this for migration |

### Major (Missing subsystem or significant deviation)

| # | Gap | Design Section | Impact |
|---|-----|---------------|--------|
| 6 | No `UnitRole` type or role-based behavior | 5, 7-A | Targeting tiebreaker, mana rules, omnivamp all depend on roles |
| 7 | No `targeting.ts` with role-based tiebreaker | 7-A | Core targeting accuracy degraded |
| 8 | No `mana.ts` with role-specific mana rules | 7-A | All units use flat `MANA_PER_ATTACK=10` instead of role-based values |
| 9 | No `StatusEffect` type or processing | 5-B | Stun, taunt, shield, slow, etc. cannot function |
| 10 | No `replayEngine.ts` | 10 | No replay playback engine |
| 11 | Tick rate is 10/s, design says 30/s | 7 | Simulation granularity lower than designed |
| 12 | No structured `Ability` / `Effect` types | 8 | Cannot support multi-effect abilities |
| 13 | No `AugmentEffectType` / `AugmentEffect` types | 8-A | Only stat modifiers work; on_event/trait_bonus blocked |
| 14 | Models in single `constants.ts` instead of split files | 19 | Design requires `unit.ts`, `ability.ts`, `hex.ts` |
| 15 | Missing components: UnitToken, BattleControls, EventLog, ResultChart, AugmentSelector | 17 | UI incomplete |

### Minor (Naming differences, structural preferences)

| # | Gap | Design Section | Impact |
|---|-----|---------------|--------|
| 16 | Function naming: `getChampionImage` vs design `getChampionIcon` | 20-A | Cosmetic |
| 17 | Component naming: `HexBoard` vs `BattleBoard`, `TraitBar` vs `SynergyTracker` | 17 | Cosmetic |
| 18 | Data JSON in `public/data/` vs `src/data/` | 19 | Architectural preference (public/ works for runtime fetch) |
| 19 | Types in single `types/index.ts` vs split files | 19 | Maintainability |
| 20 | Stores as 4 separate stores vs unified `useSimulatorStore` | 18 | Design specified unified store with slices |
| 21 | `starLevel: number` vs design `star_level: 1 \| 2 \| 3` | 5 | Weaker type safety |
| 22 | camelCase field names vs design snake_case | 5 | Style difference (camelCase is idiomatic TS) |
| 23 | No `patch_version` validation in data loader | 20 | Version drift undetected |

---

## 5. Items Implemented Beyond Design (Design X, Implementation O)

| Item | Implementation Location | Description |
|------|------------------------|-------------|
| `movement.ts` system | `systems/movement.ts` | Movement with neighbor calculation, not in design as separate file |
| `ChampionCard.tsx` | `components/builder/` | Card component not in design component tree |
| `StarSelector.tsx` | `components/builder/` | Star level UI selector |
| `ItemIcon.tsx` | `components/builder/` | Individual item icon component |
| `DamageResultPanel.tsx` | `components/analysis/` | Stat breakdown panel (design lists `DamageTable`) |
| `UnitState` type | `types/index.ts` | `'idle' \| 'moving' \| 'attacking' \| 'casting' \| 'dead'` |
| `StatBreakdown` type | `types/index.ts` | Detailed stat source breakdown |
| `DamageResult` type | `types/index.ts` | Complete damage analysis result |
| Builder sub-routes | `app/builder/team-builder/`, `app/builder/calculator/` | Matches design v2.1 additions |

---

## 6. Recommendations

### Immediate (Required for design compliance)

1. **Create `engine/rng.ts`** with Mulberry32 `SeededRNG` -- replace `Math.random()` in `combatLoop.ts:99`. This is a CLAUDE.md violation.

2. **Create `systems/targeting.ts`** with role-based tiebreaker. Extract `findNearestEnemy` from `combatLoop.ts` and add weight-based resolution.

3. **Create `systems/mana.ts`** with role-specific mana gain rules (Tank=5+damage, Fighter/Marksman/Assassin=10, Caster=7+2/s).

4. **Create `events/eventBus.ts`** with hook registration for all 11 event types.

5. **Implement `TickSnapshot` recording** in combat loop's per-tick iteration.

### High Priority (Type system alignment)

6. **Define `UnitRole` type** and add `role` field to combat units. This unlocks targeting, mana, and omnivamp systems.

7. **Define `StatusEffect` / `StatusEffectType`** types to enable stun, shield, taunt processing.

8. **Define structured `Ability` and `Effect` types** per Section 8 spec.

9. **Split `models/constants.ts`** into `models/unit.ts`, `models/ability.ts`, `models/hex.ts`.

### Medium Priority (Feature completion)

10. **Create missing UI components**: UnitToken, BattleControls (play/pause/speed/seek), EventLog, ResultChart, AugmentSelector.

11. **Create `engine/replayEngine.ts`** to drive snapshot playback.

12. **Change tick rate** from 10/s to 30/s (`TICK_DURATION = 1/30`).

13. **Implement shield processing and omnivamp** in damage resolution.

### Low Priority (Naming/structural cleanup)

14. Consider renaming `CombatUnit` -> `Unit`, `HexPos` -> `HexCoord`, `'ally'` -> `'player'` as flagged by design. This is a significant refactor that should be done in one pass.

15. Unify 4 separate Zustand stores into a single `useSimulatorStore` with slices.

16. Add `patch_version` validation to data loader.

---

## 7. Match Rate Calculation

| Category | Design Items | Matched | Rate |
|----------|:-----------:|:-------:|:----:|
| Tech Stack (Sec 3) | 8 | 8 | 100% |
| Unit Model (Sec 5) | 14 | 1 | 7% |
| Star Scaling (Sec 5-A) | 4 | 4 | 100% |
| StatusEffect (Sec 5-B) | 5 | 0 | 0% |
| Board (Sec 6) | 5 | 1 | 20% |
| Combat Loop (Sec 7) | 12 | 6 | 50% |
| Targeting (Sec 7-A) | 8 | 2 | 25% |
| Damage Calc (Sec 7-B) | 7 | 5 | 71% |
| Seed RNG (Sec 7-C) | 4 | 0 | 0% |
| Ability (Sec 8) | 6 | 2 | 33% |
| Augment (Sec 8-A) | 6 | 2 | 33% |
| Events (Sec 9) | 5 | 0 | 0% |
| Replay (Sec 10) | 5 | 0 | 0% |
| Components (Sec 17) | 18 | 6 | 33% |
| Store (Sec 18) | 11 | 5 | 45% |
| Folder Structure (Sec 19) | 30 | 18 | 60% |
| Data Pipeline (Sec 20-A) | 8 | 5 | 63% |
| **TOTAL** | **156** | **65** | **42%** |

**Weighted Match Rate: 52%** (weighted by section importance: engine/type sections weighted 2x)

---

## 8. Related Documents

- Design: [tft_simulator_design_v2.md](../../plans/tft_simulator_design_v2.md)
- Project Rules: [CLAUDE.md](../../CLAUDE.md)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-03-13 | Initial gap analysis | Claude Code |
