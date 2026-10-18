import type { IntervalScheduler } from "./interval-scheduler.js";

interface ChatListenerBinding<TBotRef> {
  botRef: TBotRef;
  unsubscribe: () => void;
}

export type ChatListenerShutdownCleanup = (
  botId: string,
  stop: () => void
) => void;

function validateIntervalMs(intervalMs: number): void {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new RangeError("Interval duration must be a positive finite number");
  }
}

export class ChatListenerLifecycle<THandle, TBotRef> {
  private readonly bindings = new Map<string, ChatListenerBinding<TBotRef>>();
  private watchdog: THandle | null = null;

  constructor(private readonly scheduler: IntervalScheduler<THandle>) {}

  activate(botId: string, botRef: TBotRef, unsubscribe: () => void): void {
    this.bindings.set(botId, { botRef, unsubscribe });
  }

  has(botId: string): boolean {
    return this.bindings.has(botId);
  }

  isCurrent(botId: string, botRef: TBotRef): boolean {
    return this.bindings.get(botId)?.botRef === botRef;
  }

  stop(botId: string): boolean {
    const binding = this.bindings.get(botId);
    if (!binding) return false;

    binding.unsubscribe();
    this.bindings.delete(botId);
    return true;
  }

  stopSubscriptionsForShutdown(cleanup: ChatListenerShutdownCleanup): void {
    for (const botId of [...this.bindings.keys()]) {
      cleanup(botId, () => {
        this.stop(botId);
      });
    }
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
}
