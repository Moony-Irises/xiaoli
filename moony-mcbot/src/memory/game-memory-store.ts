import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeJsonAtomic } from "../runtime/atomic-json-file.js";

export type SharedMemoryPlayerRelation = "owner" | "whitelist" | "neutral";

export interface SharedMemoryPlayerProfile {
  playerName: string;
  alias?: string;
  relation?: SharedMemoryPlayerRelation;
  notes?: string;
  tags?: string[];
  lastSeenAt?: number;
  updatedAt: number;
}

export interface SharedMemoryPlaceRecord {
  placeId: string;
  label: string;
  x: number;
  y: number;
  z: number;
  dimension?: string;
  notes?: string;
  tags?: string[];
  updatedAt: number;
}

export interface SharedGameMemoryStatus {
  memoryDir: string;
  playersPath: string;
  placesPath: string;
  playerCount: number;
  placeCount: number;
}

interface SharedPlayersDocument {
  version: 1;
  players: Record<string, SharedMemoryPlayerProfile>;
}

interface SharedPlacesDocument {
  version: 1;
  places: Record<string, SharedMemoryPlaceRecord>;
}

const MEMORY_VERSION = 1 as const;
const RELATIONS = new Set<SharedMemoryPlayerRelation>(["owner", "whitelist", "neutral"]);

export function defaultSharedMemoryDir(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), "..", "..", "..", "memory");
}

export function resolveSharedMemoryDir(): string {
  return process.env.XIAOLI_MEMORY_DIR?.trim() || process.env.MCBOT_MEMORY_DIR?.trim() || defaultSharedMemoryDir();
}

function cleanOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function cleanTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const tags = [...new Set(value.map(cleanOptionalString).filter((tag): tag is string => !!tag))];
  return tags.length > 0 ? tags : undefined;
}

function cleanTimestamp(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  return Math.floor(value);
}

function cleanPlayerProfile(value: unknown): SharedMemoryPlayerProfile | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const playerName = cleanOptionalString(raw.playerName);
  const updatedAt = cleanTimestamp(raw.updatedAt);
  if (!playerName || updatedAt === undefined) return null;
  const relation = cleanOptionalString(raw.relation);
  const profile: SharedMemoryPlayerProfile = {
    playerName,
    updatedAt
  };
  const alias = cleanOptionalString(raw.alias);
  const notes = cleanOptionalString(raw.notes);
  const tags = cleanTags(raw.tags);
  const lastSeenAt = cleanTimestamp(raw.lastSeenAt);
  if (alias) profile.alias = alias;
  if (relation && RELATIONS.has(relation as SharedMemoryPlayerRelation)) profile.relation = relation as SharedMemoryPlayerRelation;
  if (notes) profile.notes = notes;
  if (tags) profile.tags = tags;
  if (lastSeenAt !== undefined) profile.lastSeenAt = lastSeenAt;
  return profile;
}

function cleanPlaceRecord(value: unknown): SharedMemoryPlaceRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const placeId = cleanOptionalString(raw.placeId);
  const label = cleanOptionalString(raw.label);
  const x = typeof raw.x === "number" && Number.isFinite(raw.x) ? raw.x : null;
  const y = typeof raw.y === "number" && Number.isFinite(raw.y) ? raw.y : null;
  const z = typeof raw.z === "number" && Number.isFinite(raw.z) ? raw.z : null;
  const updatedAt = cleanTimestamp(raw.updatedAt);
  if (!placeId || !label || x === null || y === null || z === null || updatedAt === undefined) return null;
  const place: SharedMemoryPlaceRecord = {
    placeId,
    label,
    x,
    y,
    z,
    updatedAt
  };
  const dimension = cleanOptionalString(raw.dimension);
  const notes = cleanOptionalString(raw.notes);
  const tags = cleanTags(raw.tags);
  if (dimension) place.dimension = dimension;
  if (notes) place.notes = notes;
  if (tags) place.tags = tags;
  return place;
}

function normalizePlayers(players: Iterable<SharedMemoryPlayerProfile>): Record<string, SharedMemoryPlayerProfile> {
  const normalized: Record<string, SharedMemoryPlayerProfile> = {};
  for (const player of players) {
    const clean = cleanPlayerProfile(player);
    if (clean) normalized[clean.playerName] = clean;
  }
  return normalized;
}

function normalizePlaces(places: Iterable<SharedMemoryPlaceRecord>): Record<string, SharedMemoryPlaceRecord> {
  const normalized: Record<string, SharedMemoryPlaceRecord> = {};
  for (const place of places) {
    const clean = cleanPlaceRecord(place);
    if (clean) normalized[clean.placeId] = clean;
  }
  return normalized;
}

async function readJson(pathname: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(pathname, "utf8")) as unknown;
  } catch {
    return null;
  }
}

export class SharedGameMemoryStore {
  readonly memoryDir: string;
  readonly playersPath: string;
  readonly placesPath: string;

  constructor(memoryDir = resolveSharedMemoryDir()) {
    this.memoryDir = memoryDir;
    this.playersPath = path.join(memoryDir, "players.json");
    this.placesPath = path.join(memoryDir, "places.json");
  }

  async loadPlayers(): Promise<Map<string, SharedMemoryPlayerProfile>> {
    const raw = await readJson(this.playersPath);
    const rawPlayers = raw && typeof raw === "object" ? (raw as Partial<SharedPlayersDocument>).players : undefined;
    if (!rawPlayers || typeof rawPlayers !== "object") return new Map();
    return new Map(Object.values(rawPlayers).map(cleanPlayerProfile).filter((player): player is SharedMemoryPlayerProfile => !!player).map((player) => [player.playerName, player]));
  }

  async savePlayers(players: Iterable<SharedMemoryPlayerProfile>): Promise<void> {
    await writeJsonAtomic(this.playersPath, {
      version: MEMORY_VERSION,
      players: normalizePlayers(players)
    } satisfies SharedPlayersDocument);
  }

  async loadPlaces(): Promise<Map<string, SharedMemoryPlaceRecord>> {
    const raw = await readJson(this.placesPath);
    const rawPlaces = raw && typeof raw === "object" ? (raw as Partial<SharedPlacesDocument>).places : undefined;
    if (!rawPlaces || typeof rawPlaces !== "object") return new Map();
    return new Map(Object.values(rawPlaces).map(cleanPlaceRecord).filter((place): place is SharedMemoryPlaceRecord => !!place).map((place) => [place.placeId, place]));
  }

  async savePlaces(places: Iterable<SharedMemoryPlaceRecord>): Promise<void> {
    await writeJsonAtomic(this.placesPath, {
      version: MEMORY_VERSION,
      places: normalizePlaces(places)
    } satisfies SharedPlacesDocument);
  }

  async getStatus(): Promise<SharedGameMemoryStatus> {
    const [players, places] = await Promise.all([this.loadPlayers(), this.loadPlaces()]);
    return {
      memoryDir: this.memoryDir,
      playersPath: this.playersPath,
      placesPath: this.placesPath,
      playerCount: players.size,
      placeCount: places.size
    };
  }
}
