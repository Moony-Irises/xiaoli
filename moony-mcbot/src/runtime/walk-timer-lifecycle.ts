import type { TimeoutScheduler } from "./timeout-scheduler.js";

export class WalkTimerLifecycle<THandle> {
  private readonly timers = new Map<string, THandle>();

  constructor(private readonly scheduler: TimeoutScheduler<THandle>) {}

  schedule(botId: string, durationMs: number, onElapsed: () => void): void {
    const timer = this.scheduler.setTimeout(() => {
      onElapsed();
      this.timers.delete(botId);
    }, durationMs);
    this.timers.set(botId, timer);
  }

  has(botId: string): boolean {
    return this.timers.has(botId);
  }

  stop(botId: string): boolean {
    const timer = this.timers.get(botId);
    if (timer === undefined) return false;

    this.scheduler.clearTimeout(timer);
    this.timers.delete(botId);
    return true;
  }

  stopAll(): void {
    for (const timer of this.timers.values()) {
      this.scheduler.clearTimeout(timer);
    }
    this.timers.clear();
  }
}
