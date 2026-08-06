export function formatUuid(uuid: string): string {
  const clean = uuid.replace(/-/g, "");
  if (clean.length !== 32) {
    return uuid;
  }

  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20, 32)}`;
}

function trimSlashes(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function toServiceBase(url: string): string {
  const trimmed = trimSlashes(url);
  if (trimmed.endsWith("/authserver")) {
    return trimmed.slice(0, -"/authserver".length);
  }
  if (trimmed.endsWith("/sessionserver")) {
    return trimmed.slice(0, -"/sessionserver".length);
  }
  return trimmed;
}

export function normalizeAuthApiBase(url: string): string {
  return `${toServiceBase(url)}/authserver`;
}

export function normalizeSessionApiBase(url: string): string {
  return `${toServiceBase(url)}/sessionserver`;
}
