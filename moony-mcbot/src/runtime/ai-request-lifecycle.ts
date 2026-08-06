import type { AiRequestStatus } from "./ai-request.js";

export interface AiRequestLifecycleOptions {
  writeStatus: (botId: string, status: AiRequestStatus) => boolean;
}

export interface AiRequestHandle {
  readonly signal: AbortSignal;
  update(status: AiRequestStatus): boolean;
  isCurrent(): boolean;
  close(): boolean;
}

interface ActiveAiRequest {
  requestId: number;
  controller: AbortController;
}

export class AiRequestLifecycle {
  private readonly activeRequests = new Map<string, ActiveAiRequest>();
  private nextRequestId = 1;

  constructor(private readonly options: AiRequestLifecycleOptions) {}

  begin(botId: string, status: AiRequestStatus): AiRequestHandle {
    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    const controller = new AbortController();
    this.activeRequests.set(botId, { requestId, controller });
    this.options.writeStatus(botId, status);

    return {
      signal: controller.signal,
      update: (nextStatus) => this.update(botId, requestId, nextStatus),
      isCurrent: () => this.isCurrent(botId, requestId),
      close: () => this.close(botId, requestId)
    };
  }

  hasActive(botId: string): boolean {
    return this.activeRequests.has(botId);
  }

  cancel(botId: string): boolean {
    const active = this.activeRequests.get(botId);
    if (!active) return false;
    active.controller.abort();
    return true;
  }

  invalidate(botId: string): boolean {
    const active = this.activeRequests.get(botId);
    if (!active) return false;
    active.controller.abort();
    this.activeRequests.delete(botId);
    return true;
  }

  invalidateAll(): number {
    const activeRequests = [...this.activeRequests.values()];
    this.activeRequests.clear();
    for (const active of activeRequests) active.controller.abort();
    return activeRequests.length;
  }

  private isCurrent(botId: string, requestId: number): boolean {
    return this.activeRequests.get(botId)?.requestId === requestId;
  }

  private update(botId: string, requestId: number, status: AiRequestStatus): boolean {
    if (!this.isCurrent(botId, requestId)) return false;
    return this.options.writeStatus(botId, status);
  }

  private close(botId: string, requestId: number): boolean {
    if (!this.isCurrent(botId, requestId)) return false;
    this.activeRequests.delete(botId);
    return true;
  }
}
