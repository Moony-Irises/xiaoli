export class MiningTaskQueue {
  private readonly tails = new Map<string, Promise<void>>();

  enqueue<T>(botId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(botId) ?? Promise.resolve();
    let resolveOutput: (value: T) => void = () => {};
    let rejectOutput: (reason?: unknown) => void = () => {};
    const output = new Promise<T>((resolve, reject) => {
      resolveOutput = resolve;
      rejectOutput = reject;
    });

    const next = previous
      .catch(() => {})
      .then(task)
      .then(resolveOutput)
      .catch(rejectOutput);

    this.tails.set(botId, next.then(() => {}).catch(() => {}));
    return output;
  }

  getTrackedTasks(): Promise<void>[] {
    return [...this.tails.values()];
  }
}
