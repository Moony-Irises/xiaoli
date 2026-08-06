import type { AiRequestStatus } from "../runtime/ai-request.js";
import { createIdleAiRequestStatus } from "../runtime/ai-request.js";
import type { PersistedAgentConfig } from "./persisted-chat-config.js";

export type AgentMode = "manual" | "assist" | "auto";
export type AgentIdlePolicy = "none" | "follow_owner" | "wander" | "socialize_whitelist";

export interface AgentConfig {
  enabled: boolean;
  mode: AgentMode;
  whitelist: Set<string>;
  owner: string;
  commandWakeWord: string;
  autoIdlePolicy: AgentIdlePolicy;
  plannerApiBaseUrl: string;
  plannerApiKey: string;
  plannerModel: string;
  plannerSystemPrompt: string;
  planCooldownMs: number;
  maxPlanSteps: number;
  maxToolCallsPerTurn: number;
  allowProactiveAction: boolean;
  allowedTools: string[];
  lastPlanAt: number;
  lastPlanSummary: string;
  lastPlanResult: string;
  lastPlannerRequest: AiRequestStatus;
}

export interface AgentConfigDefaults {
  plannerApiBaseUrl: string;
  plannerApiKey: string;
  plannerModel: string;
  plannerSystemPrompt: string;
  requestTimeoutMs: number;
  allowedTools: readonly string[];
}

export interface AgentConfigStoreOptions {
  createDefaults: () => AgentConfigDefaults;
  resolveAllowedTools: (
    persisted: readonly string[] | undefined,
    fallback: readonly string[]
  ) => string[];
}

export interface AgentConfigReplaceResult {
  config: AgentConfig;
  ignoredPersistedPlannerApiKey: boolean;
}

export interface AgentRuntimeDiagnosticsUpdate {
  lastPlanAt?: number;
  lastPlanSummary?: string;
  lastPlanResult?: string;
}

function createDefaultConfig(defaults: AgentConfigDefaults): AgentConfig {
  return {
    enabled: false,
    mode: "manual",
    whitelist: new Set<string>(),
    owner: "",
    commandWakeWord: "小狸",
    autoIdlePolicy: "none",
    plannerApiBaseUrl: defaults.plannerApiBaseUrl,
    plannerApiKey: defaults.plannerApiKey,
    plannerModel: defaults.plannerModel,
    plannerSystemPrompt: defaults.plannerSystemPrompt,
    planCooldownMs: 4000,
    maxPlanSteps: 1,
    maxToolCallsPerTurn: 1,
    allowProactiveAction: false,
    allowedTools: [...defaults.allowedTools],
    lastPlanAt: 0,
    lastPlanSummary: "",
    lastPlanResult: "",
    lastPlannerRequest: createIdleAiRequestStatus(defaults.requestTimeoutMs)
  };
}

function applyPersistedConfig(
  config: AgentConfig,
  persisted: PersistedAgentConfig,
  resolveAllowedTools: AgentConfigStoreOptions["resolveAllowedTools"]
): boolean {
  config.enabled = !!persisted.enabled;
  config.mode = persisted.mode ?? "manual";
  config.whitelist = new Set((persisted.whitelist || []).filter(Boolean));
  config.owner = persisted.owner || "";
  config.commandWakeWord = persisted.commandWakeWord || "小狸";
  config.autoIdlePolicy = persisted.autoIdlePolicy ?? "none";
  config.plannerApiBaseUrl = persisted.plannerApiBaseUrl || config.plannerApiBaseUrl;
  config.plannerModel = persisted.plannerModel || config.plannerModel;
  config.plannerSystemPrompt = persisted.plannerSystemPrompt || config.plannerSystemPrompt;
  config.planCooldownMs = Math.max(1000, Math.min(60_000, persisted.planCooldownMs ?? 4000));
  config.maxPlanSteps = Math.max(1, Math.min(5, persisted.maxPlanSteps ?? 1));
  config.maxToolCallsPerTurn = Math.max(1, Math.min(5, persisted.maxToolCallsPerTurn ?? 1));
  config.allowProactiveAction = persisted.allowProactiveAction ?? false;
  config.allowedTools = [...resolveAllowedTools(persisted.allowedTools, config.allowedTools)];
  return !!persisted.plannerApiKey && !config.plannerApiKey;
}

function toPersistedConfig(config: AgentConfig): PersistedAgentConfig {
  return {
    enabled: config.enabled,
    mode: config.mode,
    whitelist: [...config.whitelist],
    owner: config.owner,
    commandWakeWord: config.commandWakeWord,
    autoIdlePolicy: config.autoIdlePolicy,
    plannerApiBaseUrl: config.plannerApiBaseUrl,
    plannerModel: config.plannerModel,
    plannerSystemPrompt: config.plannerSystemPrompt,
    planCooldownMs: config.planCooldownMs,
    maxPlanSteps: config.maxPlanSteps,
    maxToolCallsPerTurn: config.maxToolCallsPerTurn,
    allowProactiveAction: config.allowProactiveAction,
    allowedTools: [...config.allowedTools]
  };
}

export class AgentConfigStore {
  private readonly configs = new Map<string, AgentConfig>();

  constructor(private readonly options: AgentConfigStoreOptions) {}

  get(botId: string): AgentConfig | undefined {
    return this.configs.get(botId);
  }

  getOrCreate(botId: string): AgentConfig {
    const existing = this.configs.get(botId);
    if (existing) return existing;

    const created = createDefaultConfig(this.options.createDefaults());
    this.configs.set(botId, created);
    return created;
  }

  replace(botId: string, persisted: PersistedAgentConfig): AgentConfigReplaceResult {
    const previous = this.configs.get(botId);
    const config = createDefaultConfig(this.options.createDefaults());
    if (previous) {
      config.plannerApiKey = previous.plannerApiKey;
      config.lastPlanAt = previous.lastPlanAt;
      config.lastPlanSummary = previous.lastPlanSummary;
      config.lastPlanResult = previous.lastPlanResult;
      config.lastPlannerRequest = previous.lastPlannerRequest;
    }

    const ignoredPersistedPlannerApiKey = applyPersistedConfig(
      config,
      persisted,
      this.options.resolveAllowedTools
    );
    this.configs.set(botId, config);
    return { config, ignoredPersistedPlannerApiKey };
  }

  delete(botId: string): boolean {
    return this.configs.delete(botId);
  }

  setLastPlannerRequest(botId: string, status: AiRequestStatus): boolean {
    const config = this.configs.get(botId);
    if (!config) return false;
    config.lastPlannerRequest = status;
    return true;
  }

  updateRuntimeDiagnostics(botId: string, update: AgentRuntimeDiagnosticsUpdate): boolean {
    const config = this.configs.get(botId);
    if (!config) return false;
    if (update.lastPlanAt !== undefined) config.lastPlanAt = update.lastPlanAt;
    if (update.lastPlanSummary !== undefined) config.lastPlanSummary = update.lastPlanSummary;
    if (update.lastPlanResult !== undefined) config.lastPlanResult = update.lastPlanResult;
    return true;
  }

  getBotIds(): string[] {
    return [...this.configs.keys()];
  }

  getRemovedBotIds(next: Readonly<Record<string, unknown>>): string[] {
    const nextBotIds = new Set(Object.keys(next));
    return [...this.configs.keys()].filter((botId) => !nextBotIds.has(botId));
  }

  toPersistedRecord(): Record<string, PersistedAgentConfig> {
    const record: Record<string, PersistedAgentConfig> = {};
    for (const [botId, config] of this.configs.entries()) {
      record[botId] = toPersistedConfig(config);
    }
    return record;
  }
}
