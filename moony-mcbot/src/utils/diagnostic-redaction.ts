export interface DiagnosticProjectionOptions {
  redactSecrets?: boolean;
}

const EXACT_SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "credentials",
  "key",
  "pass",
  "password",
  "passwd",
  "pwd",
  "secret",
  "setcookie",
  "token"
]);
const SENSITIVE_KEY_SUFFIXES = [
  "apikey",
  "authkey",
  "clientkey",
  "credential",
  "credentials",
  "encryptionkey",
  "password",
  "passwd",
  "privatekey",
  "secret",
  "sessionid",
  "signingkey",
  "token"
];
const SENSITIVE_TEXT_KEY = [
  "authorization",
  "cookie",
  "credentials?",
  "key",
  "pass",
  "passwd",
  "password",
  "pwd",
  "secret",
  "set[-_]?cookie",
  "token",
  "[A-Za-z0-9_.-]*(?:api[-_]?key|auth[-_]?key|client[-_]?key|credential|credentials|encryption[-_]?key|password|passwd|private[-_]?key|secret|session[-_]?id|signing[-_]?key|token)"
].join("|");
const QUOTED_ASSIGNMENT = new RegExp(
  `(?<![A-Za-z0-9_.-])((?:"?)(${SENSITIVE_TEXT_KEY})(?:"?)\\s*[:=]\\s*)(["'])(.*?)\\3`,
  "gi"
);
const UNQUOTED_ASSIGNMENT = new RegExp(
  `(?<![A-Za-z0-9_.-])((?:"?)(${SENSITIVE_TEXT_KEY})(?:"?)\\s*[:=]\\s*)(?!["'])([^&,;}\\s]+)`,
  "gi"
);
const BEARER_TOKEN = /\b(Bearer\s+)([^\s,"';}]+)/gi;

function normalizeDiagnosticKey(key: string): string {
  return key.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
}

function isSensitiveDiagnosticKey(key: string): boolean {
  const normalized = normalizeDiagnosticKey(key);
  return EXACT_SENSITIVE_KEYS.has(normalized)
    || SENSITIVE_KEY_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

export function redactDiagnosticText(value: string): string {
  return value
    .replace(BEARER_TOKEN, "$1[redacted]")
    .replace(
      QUOTED_ASSIGNMENT,
      (_match, prefix: string, _key: string, quote: string) => {
        return `${prefix}${quote}[redacted]${quote}`;
      }
    )
    .replace(
      UNQUOTED_ASSIGNMENT,
      (_match, prefix: string) => {
        return `${prefix}[redacted]`;
      }
    );
}

function projectValue(
  value: unknown,
  redactSecrets: boolean,
  seen: WeakSet<object>
): unknown {
  if (typeof value === "string") {
    return redactSecrets ? redactDiagnosticText(value) : value;
  }
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (seen.has(value)) return "[circular]";

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((entry) => projectValue(entry, redactSecrets, seen));
    }

    const projected: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      const projectedEntry = redactSecrets && isSensitiveDiagnosticKey(key)
        ? "[redacted]"
        : projectValue(entry, redactSecrets, seen);
      Object.defineProperty(projected, key, {
        configurable: true,
        enumerable: true,
        value: projectedEntry,
        writable: true
      });
    }
    return projected;
  } finally {
    seen.delete(value);
  }
}

export function projectDiagnosticValue(
  value: unknown,
  options: Readonly<DiagnosticProjectionOptions> = {}
): unknown {
  return projectValue(value, options.redactSecrets ?? true, new WeakSet<object>());
}

export function projectDiagnosticRecord(
  value: Readonly<Record<string, unknown>>,
  options: Readonly<DiagnosticProjectionOptions> = {}
): Record<string, unknown> {
  return projectDiagnosticValue(value, options) as Record<string, unknown>;
}
