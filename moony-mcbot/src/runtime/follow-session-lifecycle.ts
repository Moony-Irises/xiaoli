import type { IntervalScheduler } from "./interval-scheduler.js";

export type FollowSessionSubscriptionCleanup = (
  botId: string,
  unsubscribe: () => void
) => void;

export class FollowSessionLifecycle<THandle, TSession> {
  private readonly intervals = new Map<string, THandle>();
  private readonly sessions = new Map<string, TSession>();
  private readonly movementSubscriptions = new Map<string, () => void>();

  constructor(private readonly scheduler: Pick<IntervalScheduler<THandle>, "clearInterval">) {}

  trackMovement(botId: string, unsubscribe: () => void): void {
    this.movementSubscriptions.set(botId, unsubscribe);
  }

  activate(botId: string, interval: THandle, session: TSession): void {
    this.intervals.set(botId, interval);
    this.sessions.set(botId, session);
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
      this.movementSubscriptions.has(botId);
    const interval = this.intervals.get(botId);
    if (interval !== undefined) {
      this.scheduler.clearInterval(interval);
      this.intervals.delete(botId);
    }

    this.movementSubscriptions.get(botId)?.();
    this.movementSubscriptions.delete(botId);
    this.sessions.delete(botId);
    return active;
  }

  stopIntervalsForShutdown(): void {
    for (const interval of this.intervals.values()) {
      this.scheduler.clearInterval(interval);
    }
    this.intervals.clear();
  }

  stopMovementSubscriptionsForShutdown(cleanup: FollowSessionSubscriptionCleanup): void {
    for (const [botId, unsubscribe] of this.movementSubscriptions.entries()) {
      cleanup(botId, unsubscribe);
    }
    this.movementSubscriptions.clear();
  }
}
