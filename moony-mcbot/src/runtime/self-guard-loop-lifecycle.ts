export interface IntervalScheduler<THandle> {
  setInterval(callback: () => void, delayMs: number): THandle;
  clearInterval(handle: THandle): void;
}

export const systemIntervalScheduler: IntervalScheduler<ReturnType<typeof setInterval>> = {
  setInterval: (callback, delayMs) => setInterval(callback, delayMs),
  clearInterval: (handle) => clearInterval(handle)
};

function validateIntervalMs(intervalMs: number): void {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new RangeError("Interval duration must be a positive finite number");
  }
}

export class SelfGuardLoopLifecycle<THandle> {
  private readonly loops = new Map<string, THandle>();
  private readonly retaliationLoops = new Map<string, THandle>();
  private watchdog: THandle | null = null;

  constructor(private readonly scheduler: IntervalScheduler<THandle>) {}

  start(botId: string, intervalMs: number, tick: () => void): void {
    validateIntervalMs(intervalMs);
    this.stop(botId);
    this.loops.set(botId, this.scheduler.setInterval(tick, intervalMs));
  }

  stop(botId: string): boolean {
    const handle = this.loops.get(botId);
    if (handle === undefined) return false;

    this.scheduler.clearInterval(handle);
    this.loops.delete(botId);
    return true;
  }

  has(botId: string): boolean {
    return this.loops.has(botId);
  }

  ensureRetaliation(botId: string, intervalMs: number, tick: () => void): boolean {
    validateIntervalMs(intervalMs);
    if (this.retaliationLoops.has(botId)) return false;

    this.retaliationLoops.set(botId, this.scheduler.setInterval(tick, intervalMs));
    return true;
  }

  stopRetaliation(botId: string): boolean {
    const handle = this.retaliationLoops.get(botId);
    if (handle === undefined) return false;

    this.scheduler.clearInterval(handle);
    this.retaliationLoops.delete(botId);
    return true;
  }

  hasRetaliation(botId: string): boolean {
    return this.retaliationLoops.has(botId);
  }

  ensureWatchdog(intervalMs: number, tick: () => void): boolean {
    validateIntervalMs(intervalMs);
    if (this.watchdog !== null) return false;

    this.watchdog = this.scheduler.setInterval(tick, intervalMs);
    return true;
  }

  isWatchdogRunning(): boolean {
    return this.watchdog !== null;
  }

  stopWatchdog(): boolean {
    if (this.watchdog === null) return false;

    this.scheduler.clearInterval(this.watchdog);
    this.watchdog = null;
    return true;
  }

  stopAll(): void {
    this.stopWatchdog();
    for (const botId of [...this.loops.keys()]) this.stop(botId);
    for (const botId of [...this.retaliationLoops.keys()]) this.stopRetaliation(botId);
  }
}
