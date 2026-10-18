import type {
  SharedMemoryPlaceRecord,
  SharedMemoryPlayerProfile
} from "./game-memory-store.js";
import { mergeNewerMemoryRecords } from "./merge-records.js";

export type AgentMemoryPlayerProfile = SharedMemoryPlayerProfile;
export type AgentMemoryPlaceRecord = SharedMemoryPlaceRecord;

export interface AgentGameMemoryReplacement {
  players: Iterable<AgentMemoryPlayerProfile>;
  places: Iterable<AgentMemoryPlaceRecord>;
}

export interface AgentGameMemorySnapshot {
  players: AgentMemoryPlayerProfile[];
  places: AgentMemoryPlaceRecord[];
}

export interface AgentGameMemoryImportResult {
  playerCount: number;
  placeCount: number;
  affectedBotCount: number;
}

function clonePlayer(profile: AgentMemoryPlayerProfile): AgentMemoryPlayerProfile {
  return {
    ...profile,
    tags: profile.tags ? [...profile.tags] : undefined
  };
}

function clonePlace(place: AgentMemoryPlaceRecord): AgentMemoryPlaceRecord {
  return {
    ...place,
    tags: place.tags ? [...place.tags] : undefined
  };
}

function createPlayerMap(players: Iterable<AgentMemoryPlayerProfile>): Map<string, AgentMemoryPlayerProfile> {
  return new Map(Array.from(players, (profile) => [profile.playerName, clonePlayer(profile)]));
}

function createPlaceMap(places: Iterable<AgentMemoryPlaceRecord>): Map<string, AgentMemoryPlaceRecord> {
  return new Map(Array.from(places, (place) => [place.placeId, clonePlace(place)]));
}

function collectLatestRecords<T extends { updatedAt: number }>(
  groups: Iterable<ReadonlyMap<string, T>>,
  clone: (record: T) => T
): T[] {
  const latest = new Map<string, T>();
  for (const group of groups) {
    for (const [key, record] of group) {
      const current = latest.get(key);
      if (!current || record.updatedAt >= current.updatedAt) {
        latest.set(key, clone(record));
      }
    }
  }
  return [...latest.values()];
}

export class AgentGameMemoryStateStore {
  private readonly playersByBot = new Map<string, Map<string, AgentMemoryPlayerProfile>>();
  private readonly placesByBot = new Map<string, Map<string, AgentMemoryPlaceRecord>>();
  private readonly sharedPlayers = new Map<string, AgentMemoryPlayerProfile>();
  private readonly sharedPlaces = new Map<string, AgentMemoryPlaceRecord>();

  getExistingPlayers(botId: string): AgentMemoryPlayerProfile[] | undefined {
    const players = this.playersByBot.get(botId);
    return players ? [...players.values()].map(clonePlayer) : undefined;
  }

  getExistingPlaces(botId: string): AgentMemoryPlaceRecord[] | undefined {
    const places = this.placesByBot.get(botId);
    return places ? [...places.values()].map(clonePlace) : undefined;
  }

  getPlayers(botId: string): AgentMemoryPlayerProfile[] {
    return [...this.ensurePlayers(botId).values()].map(clonePlayer);
  }

  getPlaces(botId: string): AgentMemoryPlaceRecord[] {
    return [...this.ensurePlaces(botId).values()].map(clonePlace);
  }

  getPlayerMapSnapshot(botId: string): Map<string, AgentMemoryPlayerProfile> {
    return createPlayerMap(this.ensurePlayers(botId).values());
  }

  getPlaceMapSnapshot(botId: string): Map<string, AgentMemoryPlaceRecord> {
    return createPlaceMap(this.ensurePlaces(botId).values());
  }

  getPlayer(botId: string, playerName: string): AgentMemoryPlayerProfile | undefined {
    const profile = this.ensurePlayers(botId).get(playerName);
    return profile ? clonePlayer(profile) : undefined;
  }

  getPlace(botId: string, placeId: string): AgentMemoryPlaceRecord | undefined {
    const place = this.ensurePlaces(botId).get(placeId);
    return place ? clonePlace(place) : undefined;
  }

  replaceBot(botId: string, replacement: AgentGameMemoryReplacement): void {
    this.playersByBot.set(botId, createPlayerMap(replacement.players));
    this.placesByBot.set(botId, createPlaceMap(replacement.places));
  }

  setPlayer(botId: string, profile: AgentMemoryPlayerProfile): void {
    this.ensurePlayers(botId).set(profile.playerName, clonePlayer(profile));
  }

  setPlace(botId: string, place: AgentMemoryPlaceRecord): void {
    this.ensurePlaces(botId).set(place.placeId, clonePlace(place));
  }

  deletePlayer(botId: string, playerName: string): boolean {
    return this.ensurePlayers(botId).delete(playerName);
  }

  deletePlace(botId: string, placeId: string): boolean {
    return this.ensurePlaces(botId).delete(placeId);
  }

  clearPlayers(botId: string): void {
    this.ensurePlayers(botId).clear();
  }

  clearPlaces(botId: string): void {
    this.ensurePlaces(botId).clear();
  }

  deleteBot(botId: string): boolean {
    const deletedPlayers = this.playersByBot.delete(botId);
    const deletedPlaces = this.placesByBot.delete(botId);
    return deletedPlayers || deletedPlaces;
  }

  getBotIds(): string[] {
    return [...new Set([...this.playersByBot.keys(), ...this.placesByBot.keys()])];
  }

  mergeSharedSnapshot(
    snapshot: AgentGameMemoryReplacement,
    additionalBotIds: Iterable<string> = []
  ): AgentGameMemoryImportResult {
    mergeNewerMemoryRecords(
      this.sharedPlayers,
      Array.from(snapshot.players, (profile) => [profile.playerName, profile] as const),
      clonePlayer
    );
    mergeNewerMemoryRecords(
      this.sharedPlaces,
      Array.from(snapshot.places, (place) => [place.placeId, place] as const),
      clonePlace
    );

    let playerCount = 0;
    let placeCount = 0;
    let affectedBotCount = 0;
    const botIds = new Set([...this.getBotIds(), ...additionalBotIds]);
    for (const botId of botIds) {
      const importedPlayers = mergeNewerMemoryRecords(
        this.ensurePlayers(botId),
        this.sharedPlayers.entries(),
        clonePlayer
      );
      const importedPlaces = mergeNewerMemoryRecords(
        this.ensurePlaces(botId),
        this.sharedPlaces.entries(),
        clonePlace
      );
      playerCount += importedPlayers;
      placeCount += importedPlaces;
      if (importedPlayers > 0 || importedPlaces > 0) {
        affectedBotCount += 1;
      }
    }

    return { playerCount, placeCount, affectedBotCount };
  }

  createSharedSnapshot(): AgentGameMemorySnapshot {
    const players = collectLatestRecords(this.playersByBot.values(), clonePlayer);
    const places = collectLatestRecords(this.placesByBot.values(), clonePlace);

    this.sharedPlayers.clear();
    this.sharedPlaces.clear();
    for (const profile of players) {
      this.sharedPlayers.set(profile.playerName, clonePlayer(profile));
    }
    for (const place of places) {
      this.sharedPlaces.set(place.placeId, clonePlace(place));
    }

    return {
      players: players.map(clonePlayer),
      places: places.map(clonePlace)
    };
  }

  private ensurePlayers(botId: string): Map<string, AgentMemoryPlayerProfile> {
    const existing = this.playersByBot.get(botId);
    if (existing) return existing;
    const created = createPlayerMap(this.sharedPlayers.values());
    this.playersByBot.set(botId, created);
    return created;
  }

  private ensurePlaces(botId: string): Map<string, AgentMemoryPlaceRecord> {
    const existing = this.placesByBot.get(botId);
    if (existing) return existing;
    const created = createPlaceMap(this.sharedPlaces.values());
    this.placesByBot.set(botId, created);
    return created;
  }
}
