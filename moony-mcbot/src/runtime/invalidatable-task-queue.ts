export interface InvalidatableTaskQueueOptions {
  onTaskError?: (key: string, error: unknown) => void;
}

export interface InvalidatableTaskEnqueueOptions {
  onSkipped?: () => void;
}

interface KeyedTaskQueueState {
  generation: number;
  tail: Promise<void>;
}

export class InvalidatableTaskQueue {
  private readonly states = new Map<string, KeyedTaskQueueState>();
  private closed = false;

  constructor(private readonly options: InvalidatableTaskQueueOptions = {}) {}

  enqueue(
    key: string,
    task: () => Promise<void>,
    options: InvalidatableTaskEnqueueOptions = {}
  ): boolean {
    if (this.closed) {
      this.notifySkipped(key, options);
      return false;
    }

    let state = this.states.get(key);
    if (!state) {
      state = { generation: 0, tail: Promise.resolve() };
      this.states.set(key, state);
    }

    const generation = state.generation;
    const execution = state.tail.then(async () => {
      if (this.closed || state.generation !== generation) {
        options.onSkipped?.();
        return;
      }
      await task();
    });
    const tracked = execution.catch((error: unknown) => {
      this.reportTaskError(key, error);
    });

    state.tail = tracked;
    void tracked.then(() => {
      if (this.states.get(key) === state && state.tail === tracked) {
        this.states.delete(key);
      }
    });
    return true;
  }

  invalidate(key: string): boolean {
    const state = this.states.get(key);
    if (!state) return false;
    state.generation += 1;
    return true;
  }

  close(): boolean {
    if (this.closed) return false;
    this.closed = true;
    for (const state of this.states.values()) state.generation += 1;
    return true;
  }

  async drain(): Promise<void> {
    while (true) {
      const tails = new Set([...this.states.values()].map((state) => state.tail));
      if (tails.size === 0) return;

      await Promise.all(tails);
      const currentTails = [...this.states.values()].map((state) => state.tail);
      if (currentTails.every((tail) => tails.has(tail))) return;
    }
  }

  private notifySkipped(key: string, options: InvalidatableTaskEnqueueOptions): void {
    try {
      options.onSkipped?.();
    } catch (error) {
      this.reportTaskError(key, error);
    }
  }

  private reportTaskError(key: string, error: unknown): void {
    const reporter = this.options.onTaskError;
    if (!reporter) return;
    try {
      reporter(key, error);
    } catch (reportingError) {
      void reportingError;
    }
  }
}
