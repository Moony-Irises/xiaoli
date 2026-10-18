import type { IntervalScheduler } from "./interval-scheduler.js";

export type PositionMovementSubscriptionCleanup = (
  botId: string,
  unsubscribe: () => void
) => void;

export class PositionMovementLifecycle<THandle> {
  private readonly intervals = new Map<string, THandle>();
  private readonly movementSubscriptions = new Map<string, () => void>();

  constructor(private readonly scheduler: Pick<IntervalScheduler<THandle>, "clearInterval">) {}

  activate(botId: string, interval: THandle, unsubscribe: () => void): void {
    this.intervals.set(botId, interval);
    this.movementSubscriptions.set(botId, unsubscribe);
  }

  has(botId: string): boolean {
    return this.intervals.has(botId);
  }

  isCurrent(botId: string, interval: THandle): boolean {
    return this.intervals.get(botId) === interval;
  }

  stop(botId: string): boolean {
    const active = this.intervals.has(botId) || this.movementSubscriptions.has(botId);
    const interval = this.intervals.get(botId);
    if (interval !== undefined) {
      this.scheduler.clearInterval(interval);
      this.intervals.delete(botId);
    }

    this.movementSubscriptions.get(botId)?.();
    this.movementSubscriptions.delete(botId);
    return active;
  }

  stopIntervalsForShutdown(): void {
    for (const interval of this.intervals.values()) {
      this.scheduler.clearInterval(interval);
    }
    this.intervals.clear();
  }

  stopMovementSubscriptionsForShutdown(cleanup: PositionMovementSubscriptionCleanup): void {
    for (const [botId, unsubscribe] of this.movementSubscriptions.entries()) {
      cleanup(botId, unsubscribe);
    }
    this.movementSubscriptions.clear();
  }
}
