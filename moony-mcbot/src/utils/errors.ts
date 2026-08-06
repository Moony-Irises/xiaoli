import { RuntimeErrorCode } from "../types.js";

export interface ClassifiedError {
  code: RuntimeErrorCode;
  message: string;
  retryable: boolean;
}

export function classifyRuntimeError(error: unknown): ClassifiedError {
  const message = toMessage(error);
  const lower = message.toLowerCase();

  if (containsAny(lower, ["invalid credentials", "forbidden", "unauthorized", "403", "invalid token"])) {
    return { code: "AUTH_INVALID_CREDENTIALS", message, retryable: false };
  }

  if (containsAny(lower, ["auth", "authentication"]) && containsAny(lower, ["timeout", "unavailable", "503", "502", "500"])) {
    return { code: "AUTH_UNAVAILABLE", message, retryable: true };
  }

  if (containsAny(lower, ["srv", "eai_again", "enotfound", "querysrv"])) {
    return { code: "SRV_LOOKUP_FAILED", message, retryable: true };
  }

  if (containsAny(lower, ["econnrefused", "etimedout", "ehostunreach", "enetunreach", "connection refused", "timed out"])) {
    return { code: "NETWORK_UNREACHABLE", message, retryable: true };
  }

  if (containsAny(lower, ["spawn timeout", "timeout after"])) {
    return { code: "CONNECT_TIMEOUT", message, retryable: true };
  }

  if (containsAny(lower, ["disconnected before spawn", "handshake", "encryption", "login"])) {
    return { code: "HANDSHAKE_FAILED", message, retryable: true };
  }

  if (containsAny(lower, ["kicked"])) {
    return { code: "SERVER_KICKED", message, retryable: false };
  }

  return { code: "UNKNOWN", message, retryable: false };
}

function toMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function containsAny(text: string, patterns: string[]): boolean {
  return patterns.some((p) => text.includes(p));
}
