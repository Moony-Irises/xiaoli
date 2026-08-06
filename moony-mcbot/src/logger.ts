export function log(level: "debug" | "info" | "warn" | "error", message: string, data?: Record<string, unknown>): void {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(data ?? {})
  };
  process.stderr.write(`${JSON.stringify(payload)}\n`);
}
