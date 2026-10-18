export interface IntervalScheduler<THandle> {
  setInterval(callback: () => void, delayMs: number): THandle;
  clearInterval(handle: THandle): void;
}

export const systemIntervalScheduler: IntervalScheduler<ReturnType<typeof setInterval>> = {
  setInterval: (callback, delayMs) => setInterval(callback, delayMs),
  clearInterval: (handle) => clearInterval(handle)
};
