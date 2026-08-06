import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "../logger.js";

let loaded = false;

function parseEnvLine(line: string): { name: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const separator = trimmed.indexOf("=");
  if (separator <= 0) return null;

  const name = trimmed.slice(0, separator).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return null;

  let value = trimmed.slice(separator + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { name, value };
}

function defaultEnvPath(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), "..", "..", ".env.local");
}

export function loadLocalEnvOnce(envPath = process.env.MCBOT_ENV_FILE?.trim() || defaultEnvPath()): void {
  if (loaded) return;
  loaded = true;

  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");
  let applied = 0;
  let skippedExisting = 0;

  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    if (process.env[parsed.name] !== undefined) {
      skippedExisting += 1;
      continue;
    }
    process.env[parsed.name] = parsed.value;
    applied += 1;
  }

  log("info", "Loaded local env file", {
    envPath,
    applied,
    skippedExisting
  });
}
