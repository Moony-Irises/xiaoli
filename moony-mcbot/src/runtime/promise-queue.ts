export async function drainPromiseQueue(getCurrentQueue: () => Promise<void>): Promise<void> {
  while (true) {
    const currentQueue = getCurrentQueue();
    await currentQueue;
    if (currentQueue === getCurrentQueue()) {
      return;
    }
  }
}
