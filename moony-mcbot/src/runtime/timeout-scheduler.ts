export interface TimeoutScheduler<THandle> {
  setTimeout(callback: () => void, delayMs: number): THandle;
  clearTimeout(handle: THandle): void;
}

export const systemTimeoutScheduler: TimeoutScheduler<ReturnType<typeof setTimeout>> = {
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle)
};
