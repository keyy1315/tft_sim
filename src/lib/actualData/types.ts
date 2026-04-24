import { z } from 'zod';
import * as S from './schema';

export type HexCoord = z.infer<typeof S.HexCoordSchema>;
export type ShrineName = z.infer<typeof S.ShrineNameSchema>;
export type YasuoTileId = z.infer<typeof S.YasuoTileIdSchema>;
export type StargazerConstellationId = z.infer<typeof S.StargazerConstellationIdSchema>;
export type YasuoTilePlacement = z.infer<typeof S.YasuoTilePlacementSchema>;
export type HexModifier = z.infer<typeof S.HexModifierSchema>;
export type UnitGrant = z.infer<typeof S.UnitGrantSchema>;
export type PlacedUnit = z.infer<typeof S.PlacedUnitSchema>;
export type ArbiterLaw = z.infer<typeof S.ArbiterLawSchema>;
export type TeamStargazerState = z.infer<typeof S.TeamStargazerStateSchema>;
export type TeamFactoryNewState = z.infer<typeof S.TeamFactoryNewStateSchema>;
export type TeamSnapshot = z.infer<typeof S.TeamSnapshotSchema>;
export type OpponentSnapshot = z.infer<typeof S.OpponentSnapshotSchema>;
export type UnitDamageEntry = z.infer<typeof S.UnitDamageEntrySchema>;
export type PvPRound = z.infer<typeof S.PvPRoundSchema>;
export type ShrineRound = z.infer<typeof S.ShrineRoundSchema>;
export type Round = PvPRound | ShrineRound;
export type TimelineMarker = z.infer<typeof S.TimelineMarkerSchema>;
export type VideoSource = z.infer<typeof S.VideoSourceSchema>;
export type ActualGameData = z.infer<typeof S.ActualGameDataSchema>;

export type AugmentId = string;
export type ItemId = string;
export type FactoryNewUpgradeId = string;

export type ActualGameSummary = Pick<
  ActualGameData,
  'gameId' | 'videoSource' | 'patchVersion' | 'finalPlacement' | 'updatedAt'
>;

export type NewGameMeta = {
  patchVersion: string;
  playerRiotId: string;
  shrinesInPlay: [ShrineName, ShrineName];
};

export type ActualGameMeta = Omit<
  ActualGameData,
  'gameId' | 'createdAt' | 'updatedAt' | 'rounds' | 'timeline'
>;
