import type { AiRequestStatus } from "../runtime/ai-request.js";
import { createIdleAiRequestStatus } from "../runtime/ai-request.js";
import type { PersistedChatAiConfig } from "./persisted-chat-config.js";

export interface ChatAiTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatAiConfig {
  enabled: boolean;
  whitelist: Set<string>;
  wakeWord: string;
  cooldownMs: number;
  maxSentences: number;
  sentenceDelayMs: number;
  maxHistory: number;
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  modelFallbacks: string[];
  systemPrompt: string;
  history: ChatAiTurn[];
  lastTriggeredAtByUser: Map<string, number>;
  lastRequest: AiRequestStatus;
}

export interface ChatAiConfigDefaults {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  requestTimeoutMs: number;
}

export interface ChatAiConfigStoreOptions {
  createDefaults: () => ChatAiConfigDefaults;
}

export interface ChatAiConfigReplaceResult {
  config: ChatAiConfig;
  ignoredPersistedApiKey: boolean;
}

function createDefaultConfig(defaults: ChatAiConfigDefaults): ChatAiConfig {
  return {
    enabled: false,
    whitelist: new Set<string>(),
    wakeWord: "小狸",
    cooldownMs: 3000,
    maxSentences: 3,
    sentenceDelayMs: 3000,
    maxHistory: 8,
    apiBaseUrl: defaults.apiBaseUrl,
    apiKey: defaults.apiKey,
    model: defaults.model,
    modelFallbacks: [],
    systemPrompt: defaults.systemPrompt,
    history: [],
    lastTriggeredAtByUser: new Map<string, number>(),
    lastRequest: createIdleAiRequestStatus(defaults.requestTimeoutMs)
  };
}

function applyPersistedConfig(
  config: ChatAiConfig,
  persisted: PersistedChatAiConfig
): boolean {
  config.enabled = !!persisted.enabled;
  config.whitelist = new Set((persisted.whitelist || []).filter(Boolean));
  config.wakeWord = persisted.wakeWord || "小狸";
  config.cooldownMs = Math.max(0, Math.min(60_000, persisted.cooldownMs ?? 3000));
  config.maxSentences = Math.max(1, Math.min(3, persisted.maxSentences ?? 3));
  config.sentenceDelayMs = Math.max(0, Math.min(20_000, persisted.sentenceDelayMs ?? 3000));
  config.maxHistory = Math.max(0, Math.min(30, persisted.maxHistory ?? 8));
  config.apiBaseUrl = persisted.apiBaseUrl || config.apiBaseUrl;
  config.model = persisted.model || config.model;
  config.modelFallbacks = [
    ...new Set((persisted.modelFallbacks || []).map((value) => value.trim()).filter(Boolean))
  ];
  return !!persisted.apiKey && !config.apiKey;
}

function toPersistedConfig(config: ChatAiConfig): PersistedChatAiConfig {
  return {
    enabled: config.enabled,
    whitelist: [...config.whitelist],
    wakeWord: config.wakeWord,
    cooldownMs: config.cooldownMs,
    maxSentences: config.maxSentences,
    sentenceDelayMs: config.sentenceDelayMs,
    maxHistory: config.maxHistory,
    apiBaseUrl: config.apiBaseUrl,
    model: config.model,
    modelFallbacks: [...config.modelFallbacks],
    systemPrompt: config.systemPrompt
  };
}

export class ChatAiConfigStore {
  private readonly configs = new Map<string, ChatAiConfig>();

  constructor(private readonly options: ChatAiConfigStoreOptions) {}

  get(botId: string): ChatAiConfig | undefined {
    return this.configs.get(botId);
  }

  getOrCreate(botId: string): ChatAiConfig {
    const existing = this.configs.get(botId);
    if (existing) return existing;

    const created = createDefaultConfig(this.options.createDefaults());
    this.configs.set(botId, created);
    return created;
  }

  replace(botId: string, persisted: PersistedChatAiConfig): ChatAiConfigReplaceResult {
    const previous = this.configs.get(botId);
    const config = createDefaultConfig(this.options.createDefaults());
    if (previous) {
      config.apiKey = previous.apiKey;
      config.history = previous.history;
      config.lastTriggeredAtByUser = previous.lastTriggeredAtByUser;
      config.lastRequest = previous.lastRequest;
    }

    const ignoredPersistedApiKey = applyPersistedConfig(config, persisted);
    this.configs.set(botId, config);
    return { config, ignoredPersistedApiKey };
  }

  delete(botId: string): boolean {
    return this.configs.delete(botId);
  }

  setLastRequest(botId: string, status: AiRequestStatus): boolean {
    const config = this.configs.get(botId);
    if (!config) return false;
    config.lastRequest = status;
    return true;
  }

  clearTriggerIfCurrent(botId: string, username: string, triggeredAt: number): boolean {
    const config = this.configs.get(botId);
    if (config?.lastTriggeredAtByUser.get(username) !== triggeredAt) return false;
    return config.lastTriggeredAtByUser.delete(username);
  }

  getRemovedBotIds(next: Readonly<Record<string, unknown>>): string[] {
    const nextBotIds = new Set(Object.keys(next));
    return [...this.configs.keys()].filter((botId) => !nextBotIds.has(botId));
  }

  toPersistedRecord(): Record<string, PersistedChatAiConfig> {
    const record: Record<string, PersistedChatAiConfig> = {};
    for (const [botId, config] of this.configs.entries()) {
      record[botId] = toPersistedConfig(config);
    }
    return record;
  }

  applySystemPrompt(systemPrompt: string): number {
    let updated = 0;
    for (const config of this.configs.values()) {
      config.systemPrompt = systemPrompt;
      updated += 1;
    }
    return updated;
  }
}
