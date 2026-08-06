import type { PlayerSnapshot } from "./client-adapter.js";

const RECENT_PLAYER_WINDOW_MS = 10 * 60_000;
const PRIORITY_TAG_PATTERN = /owner|trusted|friend|important|常用|熟悉/;

export interface IdleSocialPlayerProfile {
  playerName: string;
  alias?: string;
  relation?: "owner" | "whitelist" | "neutral";
  tags?: string[];
  lastSeenAt?: number;
}

export interface IdleSocialTarget extends PlayerSnapshot {
  distance: number;
  position: { x: number; y: number; z: number };
  profile?: IdleSocialPlayerProfile;
  socialScore: number;
}

export interface IdleSocialSelectionInput {
  players: PlayerSnapshot[];
  whitelist: ReadonlySet<string>;
  profiles: ReadonlyMap<string, IdleSocialPlayerProfile>;
  selfUsername?: string;
  maxDistance: number;
  now: number;
}

interface IdleSocialCandidateSnapshot extends PlayerSnapshot {
  distance: number;
  position: { x: number; y: number; z: number };
}

function isIdleSocialCandidateSnapshot(
  player: PlayerSnapshot
): player is IdleSocialCandidateSnapshot {
  return Boolean(
    player.position &&
    Number.isFinite(player.position.x) &&
    Number.isFinite(player.position.y) &&
    Number.isFinite(player.position.z) &&
    typeof player.distance === "number" &&
    Number.isFinite(player.distance) &&
    player.distance >= 0
  );
}

function getRelationBonus(profile: IdleSocialPlayerProfile | undefined): number {
  if (profile?.relation === "owner") return 6;
  if (profile?.relation === "whitelist") return 2;
  return 0;
}

function getTagBonus(profile: IdleSocialPlayerProfile | undefined): number {
  const tagsText = (profile?.tags ?? []).join(" ").toLowerCase();
  return PRIORITY_TAG_PATTERN.test(tagsText) ? 2 : 0;
}

function getRecencyBonus(profile: IdleSocialPlayerProfile | undefined, now: number): number {
  const lastSeenAt = profile?.lastSeenAt;
  return typeof lastSeenAt === "number" &&
    Number.isFinite(lastSeenAt) &&
    lastSeenAt !== 0 &&
    now - lastSeenAt < RECENT_PLAYER_WINDOW_MS
    ? 1
    : 0;
}

export function selectIdleSocialTarget(input: IdleSocialSelectionInput): IdleSocialTarget | null {
  if (!Number.isFinite(input.maxDistance) || input.maxDistance < 0) {
    throw new Error("Idle social max distance must be a finite non-negative number");
  }
  if (!Number.isFinite(input.now)) {
    throw new Error("Idle social current time must be finite");
  }

  const candidates: IdleSocialTarget[] = input.players
    .filter((player): player is IdleSocialCandidateSnapshot =>
      Boolean(player.username) &&
      player.username !== input.selfUsername &&
      input.whitelist.has(player.username) &&
      isIdleSocialCandidateSnapshot(player) &&
      player.distance <= input.maxDistance
    )
    .map((player) => {
      const profile = input.profiles.get(player.username);
      const distance = player.distance;
      return {
        ...player,
        distance,
        position: player.position,
        profile,
        socialScore:
          getRelationBonus(profile) +
          getTagBonus(profile) +
          getRecencyBonus(profile, input.now) -
          distance / 6
      };
    });

  candidates.sort((a, b) => b.socialScore - a.socialScore || a.distance - b.distance);
  return candidates[0] ?? null;
}
