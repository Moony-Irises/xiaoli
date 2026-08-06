import { BotCreateInput } from "../types.js";

export interface DefaultBotBootstrap {
  enabled: boolean;
  autoConnect: boolean;
  config: BotCreateInput;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null) {
    return defaultValue;
  }

  const v = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  return defaultValue;
}

function parseNumber(value: string | undefined): number | undefined {
  if (value == null || value.trim() === "") {
    return undefined;
  }

  const n = Number(value);
  if (!Number.isFinite(n)) {
    return undefined;
  }
  return n;
}

export function readDefaultBotBootstrapFromEnv(): DefaultBotBootstrap | null {
  const enabled = parseBoolean(process.env.MCBOT_DEFAULT_ENABLED, false);
  if (!enabled) {
    return null;
  }

  const botId = process.env.MCBOT_DEFAULT_BOT_ID?.trim();
  const authApiBaseUrl = process.env.MCBOT_DEFAULT_AUTH_API_BASE_URL?.trim();
  const username = process.env.MCBOT_DEFAULT_USERNAME?.trim();
  const password = process.env.MCBOT_DEFAULT_PASSWORD;
  const serverHost = process.env.MCBOT_DEFAULT_SERVER_HOST?.trim();

  if (!botId || !authApiBaseUrl || !username || !password || !serverHost) {
    throw new Error(
      "Default bot bootstrap is enabled but required env vars are missing. " +
      "Required: MCBOT_DEFAULT_BOT_ID, MCBOT_DEFAULT_AUTH_API_BASE_URL, " +
      "MCBOT_DEFAULT_USERNAME, MCBOT_DEFAULT_PASSWORD, MCBOT_DEFAULT_SERVER_HOST"
    );
  }

  const serverPort = parseNumber(process.env.MCBOT_DEFAULT_SERVER_PORT);
  const version = process.env.MCBOT_DEFAULT_VERSION?.trim();
  const maxAutoReconnectAttempts = parseNumber(process.env.MCBOT_DEFAULT_MAX_AUTO_RECONNECT_ATTEMPTS);
  const reconnectBaseDelayMs = parseNumber(process.env.MCBOT_DEFAULT_RECONNECT_BASE_DELAY_MS);
  const reconnectMaxDelayMs = parseNumber(process.env.MCBOT_DEFAULT_RECONNECT_MAX_DELAY_MS);
  const connectMaxRetries = parseNumber(process.env.MCBOT_DEFAULT_CONNECT_MAX_RETRIES);

  const config: BotCreateInput = {
    botId,
    authApiBaseUrl,
    username,
    password,
    serverHost,
    useSrv: parseBoolean(process.env.MCBOT_DEFAULT_USE_SRV, true),
    autoReconnect: parseBoolean(process.env.MCBOT_DEFAULT_AUTO_RECONNECT, true)
  };

  if (serverPort !== undefined) config.serverPort = Math.trunc(serverPort);
  if (version) config.version = version;
  if (maxAutoReconnectAttempts !== undefined) config.maxAutoReconnectAttempts = Math.trunc(maxAutoReconnectAttempts);
  if (reconnectBaseDelayMs !== undefined) config.reconnectBaseDelayMs = Math.trunc(reconnectBaseDelayMs);
  if (reconnectMaxDelayMs !== undefined) config.reconnectMaxDelayMs = Math.trunc(reconnectMaxDelayMs);
  if (connectMaxRetries !== undefined) config.connectMaxRetries = Math.trunc(connectMaxRetries);

  return {
    enabled,
    autoConnect: parseBoolean(process.env.MCBOT_DEFAULT_AUTO_CONNECT, false),
    config
  };
}
