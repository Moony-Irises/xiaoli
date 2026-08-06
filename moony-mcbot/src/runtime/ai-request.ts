export type AiRequestState = "idle" | "running" | "success" | "fallback" | "failed" | "timeout" | "cancelled";

export interface AiRequestStatus {
  state: AiRequestState;
  startedAt: string | null;
  finishedAt: string | null;
  timeoutMs: number;
  model?: string;
  fallbackModel?: string;
  failureKind?: Extract<AiRequestState, "timeout" | "cancelled" | "failed">;
  error?: string;
}

export type AiRequestErrorKind = "timeout" | "cancelled";

export class AiRequestError extends Error {
  constructor(
    readonly kind: AiRequestErrorKind,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "AiRequestError";
  }
}

export interface FetchTextWithTimeoutOptions {
  timeoutMs: number;
  signal?: AbortSignal;
}

export function createIdleAiRequestStatus(timeoutMs: number): AiRequestStatus {
  return {
    state: "idle",
    startedAt: null,
    finishedAt: null,
    timeoutMs
  };
}

export function createRunningAiRequestStatus(timeoutMs: number, model?: string): AiRequestStatus {
  return {
    state: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    timeoutMs,
    model
  };
}

export function finishAiRequestStatus(
  started: AiRequestStatus,
  state: Exclude<AiRequestState, "idle" | "running">,
  details?: Pick<AiRequestStatus, "model" | "fallbackModel" | "failureKind" | "error">
): AiRequestStatus {
  return {
    ...started,
    state,
    finishedAt: new Date().toISOString(),
    ...details
  };
}

export function classifyAiRequestState(error: unknown): Extract<AiRequestState, "timeout" | "cancelled" | "failed"> {
  if (error instanceof AiRequestError) return error.kind;
  return "failed";
}

export function resolveAiRequestTimeout(raw: string | undefined, fallbackMs: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 300) return fallbackMs;
  return Math.min(Math.trunc(parsed), 120_000);
}

export async function fetchTextWithTimeout(
  input: string | URL,
  init: RequestInit,
  options: FetchTextWithTimeoutOptions
): Promise<{ response: Response; text: string }> {
  const controller = new AbortController();
  let timedOut = false;
  let externallyCancelled = false;
  const onAbort = (): void => {
    externallyCancelled = true;
    controller.abort(options.signal?.reason);
  };

  if (options.signal?.aborted) {
    onAbort();
  } else {
    options.signal?.addEventListener("abort", onAbort, { once: true });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const text = await response.text();
    return { response, text };
  } catch (error) {
    if (timedOut) {
      throw new AiRequestError("timeout", `AI request timed out after ${options.timeoutMs}ms`, { cause: error });
    }
    if (externallyCancelled) {
      throw new AiRequestError("cancelled", "AI request cancelled", { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
