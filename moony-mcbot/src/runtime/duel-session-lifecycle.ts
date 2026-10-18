import type { IntervalScheduler } from "./interval-scheduler.js";

export interface DuelSessionSubscriptions {
  entityUnsubscribe: () => void;
  movementUnsubscribe: () => void;
}

export type DuelSessionSubscriptionKind = "entity" | "movement";

export type DuelSessionSubscriptionCleanup = (
  botId: string,
  kind: DuelSessionSubscriptionKind,
  unsubscribe: () => void
) => void;

export class DuelSessionLifecycle<THandle, TSession> {
  private readonly intervals = new Map<string, THandle>();
  private readonly sessions = new Map<string, TSession>();
  private readonly subscriptions = new Map<string, DuelSessionSubscriptions>();

  constructor(private readonly scheduler: Pick<IntervalScheduler<THandle>, "clearInterval">) {}

  setSession(botId: string, session: TSession): void {
    this.sessions.set(botId, session);
  }

  trackSubscriptions(botId: string, subscriptions: DuelSessionSubscriptions): void {
    this.subscriptions.set(botId, subscriptions);
  }

  trackInterval(botId: string, interval: THandle): void {
    this.intervals.set(botId, interval);
  }

  get(botId: string): TSession | undefined {
    return this.sessions.get(botId);
  }

  has(botId: string): boolean {
    return this.sessions.has(botId);
  }

  stop(botId: string): boolean {
    const active = this.intervals.has(botId) ||
      this.sessions.has(botId) ||
      this.subscriptions.has(botId);
    const interval = this.intervals.get(botId);
    if (interval !== undefined) {
      this.scheduler.clearInterval(interval);
      this.intervals.delete(botId);
    }

    this.sessions.delete(botId);
    const subscriptions = this.subscriptions.get(botId);
    subscriptions?.entityUnsubscribe();
    subscriptions?.movementUnsubscribe();
    this.subscriptions.delete(botId);
    return active;
  }

  stopIntervalsForShutdown(): void {
    for (const interval of this.intervals.values()) {
      this.scheduler.clearInterval(interval);
    }
    this.intervals.clear();
  }

  stopSubscriptionsForShutdown(cleanup: DuelSessionSubscriptionCleanup): void {
    for (const [botId, subscriptions] of this.subscriptions.entries()) {
      cleanup(botId, "entity", subscriptions.entityUnsubscribe);
      cleanup(botId, "movement", subscriptions.movementUnsubscribe);
    }
    this.subscriptions.clear();
  }
}
