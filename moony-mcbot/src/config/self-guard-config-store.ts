import type { PersistedSelfGuardConfig } from "./persisted-chat-config.js";

export interface SelfGuardConfig {
  enabled: boolean;
  tickMs: number;
  lowFood: number;
  lowHealth: number;
  criticalHealth: number;
  autoEat: boolean;
  autoStopFollowOnLowHealth: boolean;
  retaliateOnNonWhitelistHit: boolean;
  retaliationMaxDistance: number;
  retaliationDecayMs: number;
  chatAlerts: boolean;
  alertCooldownMs: number;
}

function createDefaultConfig(): SelfGuardConfig {
  return {
    enabled: false,
    tickMs: 2000,
    lowFood: 10,
    lowHealth: 10,
    criticalHealth: 6,
    autoEat: true,
    autoStopFollowOnLowHealth: true,
    retaliateOnNonWhitelistHit: true,
    retaliationMaxDistance: 4.5,
    retaliationDecayMs: 60_000,
    chatAlerts: true,
    alertCooldownMs: 15_000
  };
}

function applyPersistedConfig(
  config: SelfGuardConfig,
  persisted: PersistedSelfGuardConfig
): void {
  config.enabled = !!persisted.enabled;
  config.tickMs = Math.max(500, Math.min(30_000, persisted.tickMs ?? 2000));
  config.lowFood = Math.max(1, Math.min(19, persisted.lowFood ?? 10));
  config.lowHealth = Math.max(1, Math.min(20, persisted.lowHealth ?? 10));
  config.criticalHealth = Math.max(
    1,
    Math.min(config.lowHealth, persisted.criticalHealth ?? 6)
  );
  config.autoEat = persisted.autoEat ?? true;
  config.autoStopFollowOnLowHealth = persisted.autoStopFollowOnLowHealth ?? true;
  config.retaliateOnNonWhitelistHit = persisted.retaliateOnNonWhitelistHit ?? true;
  config.retaliationMaxDistance = Math.max(
    1,
    Math.min(10, persisted.retaliationMaxDistance ?? 4.5)
  );
  config.retaliationDecayMs = Math.max(
    10_000,
    Math.min(30 * 60 * 1000, persisted.retaliationDecayMs ?? 60_000)
  );
  config.chatAlerts = persisted.chatAlerts ?? true;
  config.alertCooldownMs = Math.max(
    1000,
    Math.min(300_000, persisted.alertCooldownMs ?? 15_000)
  );
}

export class SelfGuardConfigStore {
  private readonly configs = new Map<string, SelfGuardConfig>();

  get(botId: string): SelfGuardConfig | undefined {
    return this.configs.get(botId);
  }

  getOrCreate(botId: string): SelfGuardConfig {
    const existing = this.configs.get(botId);
    if (existing) return existing;

    const created = createDefaultConfig();
    this.configs.set(botId, created);
    return created;
  }

  replace(botId: string, persisted: PersistedSelfGuardConfig): SelfGuardConfig {
    const config = createDefaultConfig();
    applyPersistedConfig(config, persisted);
    this.configs.set(botId, config);
    return config;
  }

  delete(botId: string): boolean {
    return this.configs.delete(botId);
  }

  getRemovedBotIds(next: Readonly<Record<string, unknown>>): string[] {
    const nextBotIds = new Set(Object.keys(next));
    return [...this.configs.keys()].filter((botId) => !nextBotIds.has(botId));
  }

  toPersistedRecord(): Record<string, PersistedSelfGuardConfig> {
    const record: Record<string, PersistedSelfGuardConfig> = {};
    for (const [botId, config] of this.configs.entries()) {
      record[botId] = { ...config };
    }
    return record;
  }
}
