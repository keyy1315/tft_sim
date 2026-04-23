import { z } from 'zod';

export const HexCoordSchema = z.object({
  q: z.number().int(),
  r: z.number().int(),
});

export const ShrineNameSchema = z.enum([
  'ahri', 'aurelionSol', 'ekko', 'evelynn',
  'kayle', 'soraka', 'thresh', 'varus', 'yasuo',
]);

export const YasuoTileIdSchema = z.enum([
  'solar', 'cryo', 'starlight', 'accel', 'storm', 'cosmic',
]);

export const StargazerConstellationIdSchema = z.enum([
  'altar', 'boar', 'well', 'huntress', 'medal', 'mountain', 'snake',
]);

export const YasuoTilePlacementSchema = z.object({
  hex: HexCoordSchema,
  tileId: YasuoTileIdSchema,
});

export const HexModifierSchema = z.object({
  hex: HexCoordSchema,
  tileId: YasuoTileIdSchema,
  stageGranted: z.union([z.literal(2), z.literal(3), z.literal(4)]),
});

export const UnitGrantSchema = z.object({
  source: z.enum(['ekko_implant', 'ekko_grace']),
  effectId: z.string(),
});

// 빈 슬롯은 undefined 또는 null (JSON.stringify로 undefined → null 변환 대응)
const OptionalSlot = z.string().nullable().optional();

export const PlacedUnitSchema = z.object({
  championId: z.string(),
  hex: HexCoordSchema,
  starLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  items: z.tuple([OptionalSlot, OptionalSlot, OptionalSlot]),
  grants: z.array(UnitGrantSchema).optional(),
});

export const ArbiterLawSchema = z.object({
  triggerId: z.string(),
  effectId: z.string(),
});

export const TeamStargazerStateSchema = z.object({
  revealedTiles: z.array(HexCoordSchema),
});

export const TeamFactoryNewStateSchema = z.object({
  upgradePath: z.array(z.string()),
  nextUpgradeRoundsRemaining: z.number().int().min(0).optional(),
});

export const TeamSnapshotSchema = z.object({
  units: z.array(PlacedUnitSchema),
  augments: z.tuple([OptionalSlot, OptionalSlot, OptionalSlot, OptionalSlot]),
  level: z.number().int().min(1).max(10),
  hp: z.number().min(0),
  hexModifiers: z.array(HexModifierSchema),
  graceApplied: z.boolean().optional(),
  arbiterLaw: ArbiterLawSchema.optional(),
  stargazer: TeamStargazerStateSchema.optional(),
  factoryNew: TeamFactoryNewStateSchema.optional(),
});

export const OpponentSnapshotSchema = TeamSnapshotSchema.extend({
  riotId: z.string().optional(),
});

export const UnitDamageEntrySchema = z.object({
  unitHex: HexCoordSchema,
  championId: z.string(),
  damage: z.number().min(0),
});

const RoundBase = {
  roundName: z.string().regex(/^\d+-\d+$/),
  videoStartTime: z.number().min(0),
  videoEndTime: z.number().min(0).optional(),
  notes: z.string().optional(),
};

export const PvPRoundSchema = z.object({
  type: z.literal('pvp'),
  ...RoundBase,
  playerTeam: TeamSnapshotSchema,
  opponent: OpponentSnapshotSchema,
  winner: z.enum(['player', 'opponent', 'draw']),
  playerDamageChart: z.array(UnitDamageEntrySchema).optional(),
  opponentDamageChart: z.array(UnitDamageEntrySchema).optional(),
}).refine(
  (r) => r.videoEndTime === undefined || r.videoEndTime >= r.videoStartTime,
  { message: 'videoEndTime must be >= videoStartTime', path: ['videoEndTime'] },
);

export const ShrineRoundSchema = z.object({
  type: z.literal('shrine'),
  ...RoundBase,
  playerChosenShrine: ShrineNameSchema,
  playerYasuoTile: YasuoTilePlacementSchema.optional(),
}).refine(
  (r) => r.videoEndTime === undefined || r.videoEndTime >= r.videoStartTime,
  { message: 'videoEndTime must be >= videoStartTime', path: ['videoEndTime'] },
);

export const RoundSchema = z.union([PvPRoundSchema, ShrineRoundSchema]);

export const TimelineMarkerSchema = z.object({
  id: z.string(),
  timestamp: z.number().min(0),
  kind: z.enum(['event', 'note', 'issue']),
  label: z.string().min(1),
  roundIndex: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

export const VideoSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({
    kind: z.literal('local'),
    filename: z.string(),
    mimeType: z.enum(['video/mp4', 'video/webm']),
    sizeBytes: z.number().int().positive(),
    durationSeconds: z.number().min(0).nullable(),
    uploadedAt: z.string(),
  }),
]);

export const ActualGameDataSchema = z.object({
  gameId: z.string(),
  videoSource: VideoSourceSchema,
  patchVersion: z.string().min(1),
  playerRiotId: z.string().regex(/^.{2,16}#[A-Z0-9]{2,5}$/i),
  finalPlacement: z.union([
    z.literal(1), z.literal(2), z.literal(3), z.literal(4),
    z.literal(5), z.literal(6), z.literal(7), z.literal(8),
  ]),
  shrinesInPlay: z.tuple([ShrineNameSchema, ShrineNameSchema])
    .refine(([a, b]) => a !== b, { message: 'shrinesInPlay must be distinct' }),
  stargazerConstellation: StargazerConstellationIdSchema.optional(),
  timeline: z.array(TimelineMarkerSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  rounds: z.array(RoundSchema),
}).superRefine((data, ctx) => {
  // rounds roundName 오름차순 + 중복 금지
  const names = data.rounds.map(r => r.roundName);
  for (let i = 1; i < names.length; i++) {
    if (compareRoundName(names[i - 1], names[i]) >= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rounds', i, 'roundName'],
        message: 'rounds must be in ascending order, no duplicates',
      });
    }
  }
});

function compareRoundName(a: string, b: string): number {
  const [as, ar] = a.split('-').map(Number);
  const [bs, br] = b.split('-').map(Number);
  return as !== bs ? as - bs : ar - br;
}
