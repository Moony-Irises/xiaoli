import type { IntervalScheduler } from "./interval-scheduler.js";

export class AgentExecutorLifecycle<THandle> {
  private readonly loops = new Map<string, THandle>();
  private readonly runs = new Map<string, Promise<void>>();

  constructor(private readonly scheduler: IntervalScheduler<THandle>) {}

  start(botId: string, delayMs: number, task: () => Promise<void>): void {
    this.stop(botId);
    const loop = this.scheduler.setInterval(() => {
      this.enqueue(botId, task);
    }, delayMs);
    this.loops.set(botId, loop);
  }

  stop(botId: string): boolean {
    const loop = this.loops.get(botId);
    if (loop === undefined) return false;
    this.scheduler.clearInterval(loop);
    this.loops.delete(botId);
    return true;
  }

  isAttached(botId: string): boolean {
    return this.loops.has(botId);
  }

  enqueue(botId: string, task: () => Promise<void>): void {
    const previous = this.runs.get(botId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(task).catch(() => undefined);
    this.runs.set(botId, next);
  }

  forgetRun(botId: string): boolean {
    return this.runs.delete(botId);
  }

  getTrackedRuns(): Promise<void>[] {
    return [...this.runs.values()];
  }

  stopLoopsForShutdown(): void {
    for (const loop of this.loops.values()) {
      this.scheduler.clearInterval(loop);
    }
    this.loops.clear();
  }
}
