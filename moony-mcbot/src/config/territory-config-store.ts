export interface TerritoryConfig {
  enabled: boolean;
  placeIds: string[];
  requiredTags: string[];
  radius: number;
  warningCooldownMs: number;
  warningMessage: string;
  ownerPresencePolicy: "always" | "owner_nearby_only";
  escalationEnabled: boolean;
  escalationDelayMs: number;
}

function createDefaultConfig(): TerritoryConfig {
  return {
    enabled: false,
    placeIds: [],
    requiredTags: [],
    radius: 12,
    warningCooldownMs: 30_000,
    warningMessage: "走开。",
    ownerPresencePolicy: "owner_nearby_only",
    escalationEnabled: true,
    escalationDelayMs: 8_000
  };
}

function cloneConfig(config: TerritoryConfig): TerritoryConfig {
  return {
    ...config,
    placeIds: [...config.placeIds],
    requiredTags: [...config.requiredTags]
  };
}

export class TerritoryConfigStore {
  private readonly configs = new Map<string, TerritoryConfig>();

  get(botId: string): TerritoryConfig | undefined {
    const config = this.configs.get(botId);
    return config ? cloneConfig(config) : undefined;
  }

  getOrCreate(botId: string): TerritoryConfig {
    const existing = this.configs.get(botId);
    if (existing) return cloneConfig(existing);

    const created = createDefaultConfig();
    this.configs.set(botId, created);
    return cloneConfig(created);
  }

  replace(botId: string, config: TerritoryConfig): TerritoryConfig {
    const stored = cloneConfig(config);
    this.configs.set(botId, stored);
    return cloneConfig(stored);
  }

  delete(botId: string): boolean {
    return this.configs.delete(botId);
  }
}
