import type { PlayerSnapshot } from "./client-adapter.js";
import {
  evaluateTerritoryPresence,
  type TerritoryIntruderMatch,
  type TerritoryPresencePlace
} from "./territory-presence.js";
import { TerritoryPresenceStore } from "./territory-presence-store.js";
import {
  evaluateTerritoryWarning,
  type TerritoryWarningDecision
} from "./territory-warning-state.js";

export interface TerritoryRuntimeInput {
  botId: string;
  now: number;
  players: PlayerSnapshot[];
  places: TerritoryPresencePlace[];
  radius: number;
  ownerUsername: string;
  whitelist: ReadonlySet<string>;
  selfUsername?: string;
  ownerPresencePolicy: "always" | "owner_nearby_only";
  warningCooldownMs: number;
  escalationEnabled: boolean;
  escalationDelayMs: number;
}

export interface TerritoryRuntimeActionContext {
  botId: string;
  presenceKey: string;
  intruder: TerritoryIntruderMatch;
}

export interface TerritoryRuntimeHooks {
  onWarning: (context: TerritoryRuntimeActionContext) => void;
  onEscalationHeld: (context: TerritoryRuntimeActionContext) => void;
  onEscalation: (context: TerritoryRuntimeActionContext) => void;
}

export interface TerritoryRuntimeResult {
  action: TerritoryWarningDecision["action"];
  handled: boolean;
  intruder: TerritoryIntruderMatch | null;
}

export class TerritoryRuntime {
  constructor(
    private readonly presenceStore = new TerritoryPresenceStore()
  ) {}

  tick(input: TerritoryRuntimeInput, hooks: TerritoryRuntimeHooks): TerritoryRuntimeResult {
    const presence = evaluateTerritoryPresence({
      players: input.players,
      places: input.places,
      radius: input.radius,
      ownerUsername: input.ownerUsername,
      whitelist: input.whitelist,
      selfUsername: input.selfUsername,
      ownerPresencePolicy: input.ownerPresencePolicy
    });
    this.presenceStore.prune(input.botId, new Set(presence.activePresenceKeys));

    const intruder = presence.nearestIntruder;
    if (!intruder) {
      return { action: "none", handled: false, intruder: null };
    }

    const presenceKey = `${intruder.place.placeId}:${intruder.username}`;
    const decision = evaluateTerritoryWarning({
      now: input.now,
      warningCooldownMs: input.warningCooldownMs,
      escalationEnabled: input.escalationEnabled,
      escalationDelayMs: input.escalationDelayMs,
      ownerNearby: presence.ownerNearby,
      existing: this.presenceStore.get(input.botId, presenceKey)
    });
    const context: TerritoryRuntimeActionContext = {
      botId: input.botId,
      presenceKey,
      intruder
    };

    if (decision.action === "warn") {
      this.presenceStore.set(input.botId, presenceKey, decision.nextState);
      hooks.onWarning(context);
      return { action: decision.action, handled: true, intruder };
    }

    if (decision.action === "hold_escalation") {
      hooks.onEscalationHeld(context);
      return { action: decision.action, handled: false, intruder };
    }

    if (decision.action === "escalate") {
      this.presenceStore.set(input.botId, presenceKey, decision.nextState);
      hooks.onEscalation(context);
      return { action: decision.action, handled: true, intruder };
    }

    return { action: decision.action, handled: false, intruder };
  }

  clearBot(botId: string): boolean {
    return this.presenceStore.clearBot(botId);
  }
}
