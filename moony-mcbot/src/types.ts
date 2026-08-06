export type RuntimeState =
  | "idle"
  | "authenticating"
  | "authenticated"
  | "connecting"
  | "spawned"
  | "disconnected"
  | "error";

export type RuntimeErrorCode =
  | "AUTH_INVALID_CREDENTIALS"
  | "AUTH_UNAVAILABLE"
  | "SRV_LOOKUP_FAILED"
  | "NETWORK_UNREACHABLE"
  | "CONNECT_TIMEOUT"
  | "HANDSHAKE_FAILED"
  | "SERVER_KICKED"
  | "UNKNOWN";

export interface BotCreateInput {
  botId: string;
  authApiBaseUrl: string;
  username: string;
  password: string;
  serverHost: string;
  serverPort?: number;
  useSrv?: boolean;
  version?: string;
  autoReconnect?: boolean;
  maxAutoReconnectAttempts?: number;
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
  connectMaxRetries?: number;
}

export interface BotConfig {
  authApiBaseUrl: string;
  username: string;
  password: string;
  serverHost: string;
  serverPort: number;
  useSrv: boolean;
  version: string;
}

export interface AuthSession {
  accessToken: string;
  clientToken: string;
  selectedProfile: {
    id: string;
    name: string;
  };
}

export interface RuntimeStatus {
  botId: string;
  state: RuntimeState;
  clientAdapterKind?: "mineflayer" | "modded-client";
  profileName?: string;
  profileId?: string;
  serverHost: string;
  serverPort: number;
  useSrv: boolean;
  version: string;
  connectedAt?: string;
  lastError?: string;
  lastErrorCode?: RuntimeErrorCode;
  lastKickReason?: string;
  autoReconnect: boolean;
  reconnectInProgress: boolean;
  reconnectAttempts: number;
}
