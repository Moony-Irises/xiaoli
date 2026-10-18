import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Bot as MineflayerBot } from "mineflayer";
import { z } from "zod";
import * as Pathfinder from "mineflayer-pathfinder";
import { getDefaultAgentToolIds, resolveAgentToolAllowlist } from "../catalog/tool-catalog.js";
import { registerAgentCoreTool } from "../catalog/mcp-tool-registration.js";
import { ActionCommandSet } from "../commands/action-command-set.js";
import type {
  CommandHistoryFilter,
  CommandInvocationResult
} from "../commands/command-dispatcher.js";
import { BotRegistry } from "../runtime/bot-registry.js";
import type { BotRuntime } from "../runtime/bot-runtime.js";
import { createChatEventDeduplicator } from "../runtime/chat-event-dedup.js";
import { ChatListenerLifecycle } from "../runtime/chat-listener-lifecycle.js";
import {
  decidePlayerAttackAction,
  extractRequestedPlayerName,
  findMentionedPlayerSnapshot
} from "../runtime/chat-attack-target.js";
import {
  decideDuelTick,
  findChallengeTargetSnapshot
} from "../runtime/duel-session.js";
import type { DuelSessionState } from "../runtime/duel-session.js";
import { DuelSessionLifecycle } from "../runtime/duel-session-lifecycle.js";
import { AgentExecutorLifecycle } from "../runtime/agent-executor-lifecycle.js";
import {
  AgentTaskHistoryStore,
  type AgentTaskHistoryRecord
} from "../runtime/agent-task-history-store.js";
import { decideFollowMovement, getFollowPursuitFailure } from "../runtime/follow-session.js";
import { FollowSessionLifecycle } from "../runtime/follow-session-lifecycle.js";
import { PositionMovementLifecycle } from "../runtime/position-movement-lifecycle.js";
import { systemTimeoutScheduler } from "../runtime/timeout-scheduler.js";
import { WalkTimerLifecycle } from "../runtime/walk-timer-lifecycle.js";
import { SafePathError } from "../runtime/mining-approach.js";
import { MiningTaskQueue } from "../runtime/mining-task-queue.js";
import { getCurrentMovementFailure } from "../runtime/movement-event-routing.js";
import { selectNearestWhitelistedPlayer } from "../runtime/player-selection.js";
import { decidePositionMovement, PositionCoordinates } from "../runtime/position-movement.js";
import { MovementIntentStore } from "../runtime/movement-intent-store.js";
import { isDimensionCompatible, requireSelfLocation } from "../runtime/self-location.js";
import { decideIdleFollowAction } from "../runtime/idle-follow-policy.js";
import { selectIdleSocialTarget } from "../runtime/idle-social-policy.js";
import {
  buildInventorySummary,
  matchInventoryItems,
  readContainerItems,
  serializeInventoryItem
} from "../runtime/container-inventory.js";
import type { ContainerInventoryClient } from "../runtime/container-inventory.js";
import { buildDynamicAiStateText } from "../runtime/dynamic-ai-state.js";
import { selectFocusedEntity } from "../runtime/focus-perception.js";
import { TerritoryRuntime } from "../runtime/territory-runtime.js";
import { buildSalientActors } from "../runtime/salient-perception.js";
import {
  evaluateSelfGuardAlertCooldown,
  evaluateSelfGuardCoreTransitions,
  evaluateSelfGuardProximity,
  evaluateSelfGuardReactiveSignals,
  evaluateSelfGuardVitals,
  summarizeInventorySnapshotForEvent
} from "../runtime/self-guard-state.js";
import type { SelfGuardVitalsDecision } from "../runtime/self-guard-state.js";
import {
  detectSelfGuardEnvironmentTransitions,
  readSelfGuardEnvironment
} from "../runtime/self-guard-environment.js";
import {
  decideRetaliationTick,
  resolveRetaliationTarget,
  selectLikelyRetaliationAttacker
} from "../runtime/self-guard-retaliation.js";
import type {
  HoldItemByCategoryInput,
  InventorySnapshot,
  OpenDoorInput
} from "../runtime/client-adapter.js";
import {
  canSeeBlockByRay,
  equipBestToolForBlock,
  MineflayerMiningBlock,
  MineflayerMiningClient
} from "../runtime/mineflayer-mining.js";
import {
  AiRequestError,
  classifyAiRequestState,
  createRunningAiRequestStatus,
  finishAiRequestStatus,
  resolveAiRequestTimeout
} from "../runtime/ai-request.js";
import type { AiRequestStatus } from "../runtime/ai-request.js";
import { AiRequestLifecycle } from "../runtime/ai-request-lifecycle.js";
import type { AiRequestHandle } from "../runtime/ai-request-lifecycle.js";
import {
  buildOpenAiChatCompletionsEndpoint,
  postOpenAiChatCompletions
} from "../runtime/openai-compatible-client.js";
import {
  type PersistedAgentConfig,
  type PersistedChatAiConfig,
  type PersistedChatState,
  type PersistedSelfGuardConfig
} from "../config/persisted-chat-config.js";
import {
  ChatListenerConfigStore,
  type ChatListenerConfig
} from "../config/chat-listener-config-store.js";
import {
  ChatAiConfigStore,
  type ChatAiConfig
} from "../config/chat-ai-config-store.js";
import {
  AgentConfigStore,
  type AgentConfig
} from "../config/agent-config-store.js";
import {
  SelfGuardConfigStore,
  type SelfGuardConfig
} from "../config/self-guard-config-store.js";
import {
  TerritoryConfigStore,
  type TerritoryConfig
} from "../config/territory-config-store.js";
import { PersistedChatConfigRepository } from "../config/persisted-chat-config-repository.js";
import { extractAiText, summarizeEmptyAiChoice } from "../runtime/openai-response-text.js";
import type { AgentPlanStep } from "../agent/openai-agent-planner.js";
import { DefaultAgentPlanningStrategy, type AgentPlanningStrategy } from "../agent/planning-strategy.js";
import { AgentPlanningTurnCoordinator } from "../agent/planning-turn-coordinator.js";
import { drainPromiseQueue } from "../runtime/promise-queue.js";
import { InvalidatableTaskQueue } from "../runtime/invalidatable-task-queue.js";
import {
  SelfGuardHurtSubscriptionRegistry,
  type SelfGuardHurtEmitter
} from "../runtime/self-guard-hurt-subscriptions.js";
import {
  SelfGuardLoopLifecycle,
  systemIntervalScheduler
} from "../runtime/self-guard-loop-lifecycle.js";
import {
  RetaliationStateStore,
  type RetaliationSessionState
} from "../runtime/retaliation-state-store.js";
import { SelfGuardRuntimeStateStore } from "../runtime/self-guard-runtime-state-store.js";
import { SocialRuntimeStateStore } from "../runtime/social-runtime-state-store.js";
import { CombatExecutionStateStore } from "../runtime/combat-execution-state-store.js";
import { applyPathfinderMovementProfile } from "../runtime/pathfinder-movement-profile.js";
import type { PathfinderMovementProfile } from "../runtime/pathfinder-movement-profile.js";
import { ensureIronSwordInHotbar1AndHold } from "../runtime/mineflayer-inventory.js";
import { runStartupLifecycle } from "../runtime/startup-lifecycle.js";
import { log } from "../logger.js";
import {
  executeAgentEatTool,
  executeAgentLookTool,
  executeAgentWalkTool,
  HierarchicalAgentSupervisor
} from "../agent/index.js";
import type {
  AgentExecutionEvent,
  AgentRuntimeState,
  AgentStrategicGoal,
  AgentTaskRuntime,
  AgentTaskSource,
  AgentTaskStatus,
} from "../agent/types.js";
import {
  getSharedChatMemoryPromptText,
  getSharedChatMemoryStatus,
  isHighRiskChatMemoryClaim,
  recordSharedChatMemory
} from "../memory/chat-memory.js";
import {
  AgentGameMemoryStateStore,
  type AgentMemoryPlaceRecord,
  type AgentMemoryPlayerProfile
} from "../memory/agent-game-memory-state-store.js";
import { SharedGameMemoryStore } from "../memory/game-memory-store.js";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface ToolResponse {
  content: { type: "text"; text: string }[];
  isError?: boolean;
  [key: string]: unknown;
}

interface FollowOptions {
  playerName: string;
  minDistance: number;
  maxDistance: number;
  sprint: boolean;
  tickMs: number;
  targetStillStopMs: number;
}

interface FollowSession {
  options: FollowOptions;
  startedAt: number;
}

interface AttackNearestDebugInput {
  maxDistance?: number;
  type?: string;
  name?: string;
  includePlayers?: boolean;
}

interface AttackNearestDebugEntity {
  entityId?: number;
  name?: string;
  displayName?: string | null;
  type?: string;
  kind?: string | null;
  distance?: number;
  position?: { x: number; y: number; z: number };
  joinedText: string;
  excludedReason?: string;
}


interface PromptProfile {
  systemPrompt: string;
  sceneCooldownMs: number;
  idleNoInteractionMs: number;
  idleSpeakCooldownMs: number;
  randomSpeakChancePerTick: number;
  randomSpeakCooldownMs: number;
  nearPlayerDistance: number;
  nearPlayerTalkChance: number;
  sceneLines: {
    followStart: string[];
    followStopped: string[];
    targetLost: string[];
    reconnectSuccess: string[];
    nightStart: string[];
    rainStart: string[];
    attacked: string[];
    attackedByWhitelist: string[];
    attackedByNonWhitelist: string[];
    reportToWhitelist: string[];
    nearPlayer: string[];
    idleMurmur: string[];
    randomMurmur: string[];
  };
  stateLines: {
    lowFood: string[];
    noFood: string[];
    lowHealth: string[];
    criticalHealth: string[];
    ateFood: string[];
  };
}

const actionCommandSets = new WeakMap<BotRegistry, ActionCommandSet>();
const followSessionLifecycle = new FollowSessionLifecycle<ReturnType<typeof setInterval>, FollowSession>(systemIntervalScheduler);
const positionMovementLifecycle = new PositionMovementLifecycle(systemIntervalScheduler);
const duelSessionLifecycle = new DuelSessionLifecycle<
  ReturnType<typeof setInterval>,
  DuelSessionState
>(systemIntervalScheduler);
const agentExecutorLifecycle = new AgentExecutorLifecycle(systemIntervalScheduler);
const walkTimerLifecycle = new WalkTimerLifecycle(systemTimeoutScheduler);
const chatListenerConfigStore = new ChatListenerConfigStore();
const chatListenerLifecycle = new ChatListenerLifecycle<
  ReturnType<typeof setInterval>,
  BotRuntime
>(systemIntervalScheduler);
const chatEventDeduplicator = createChatEventDeduplicator();
const chatAiConfigStore = new ChatAiConfigStore({
  createDefaults: () => ({
    apiBaseUrl: process.env.MCBOT_AI_API_BASE_URL?.trim() || "https://api.openai.com/v1",
    apiKey: process.env.MCBOT_AI_API_KEY || "",
    model: process.env.MCBOT_AI_MODEL || "gpt-5-nano",
    systemPrompt: activePromptProfile.systemPrompt,
    requestTimeoutMs: resolveAiRequestTimeout(process.env.MCBOT_AI_REQUEST_TIMEOUT_MS, 15000)
  })
});
const chatAiRequestLifecycle = new AiRequestLifecycle({
  writeStatus: (botId, status) => chatAiConfigStore.setLastRequest(botId, status)
});
const chatAiTaskQueue = new InvalidatableTaskQueue({
  onTaskError: (botId, error) => {
    log("warn", "Queued AI chat task failed unexpectedly", {
      botId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
const agentPlanningCoordinators = new WeakMap<BotRegistry, AgentPlanningTurnCoordinator<AgentStateSnapshot>>();
const agentConfigStore = new AgentConfigStore({
  createDefaults: () => ({
    plannerApiBaseUrl: process.env.MCBOT_AI_API_BASE_URL?.trim() || "https://api.openai.com/v1",
    plannerApiKey: process.env.MCBOT_AI_API_KEY || "",
    plannerModel: process.env.MCBOT_AI_MODEL || "gpt-5-nano",
    plannerSystemPrompt:
      "你是Minecraft bot的行为规划器。你必须只返回JSON。你的任务是根据状态和用户意图，在允许的工具中选择一个最合适的工具调用，或者选择no_action。不要输出markdown，不要解释。",
    requestTimeoutMs: resolveAiRequestTimeout(process.env.MCBOT_AI_REQUEST_TIMEOUT_MS, 15000),
    allowedTools: getDefaultAgentToolIds()
  }),
  resolveAllowedTools: resolveAgentToolAllowlist
});
const plannerRequestLifecycle = new AiRequestLifecycle({
  writeStatus: (botId, status) => agentConfigStore.setLastPlannerRequest(botId, status)
});
const agentGameMemoryStateStore = new AgentGameMemoryStateStore();
const agentTaskHistoryStore = new AgentTaskHistoryStore();
const territoryConfigStore = new TerritoryConfigStore();
const territoryRuntime = new TerritoryRuntime();
const selfGuardConfigStore = new SelfGuardConfigStore();
const selfGuardRuntimeStateStore = new SelfGuardRuntimeStateStore();
const selfGuardTaskQueue = new InvalidatableTaskQueue({
  onTaskError: (botId, error) => {
    log("warn", "Queued self-guard task failed unexpectedly", {
      botId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
const hierarchicalAgents = new HierarchicalAgentSupervisor();
const pathfinderMovementsByBot = new WeakMap<
  MineflayerBot,
  Partial<Record<PathfinderMovementProfile, Pathfinder.Movements>>
>();

function getAgentHierarchicalRuntime(botId: string) {
  return hierarchicalAgents.ensure(botId);
}

function getActiveAgentTask(botId: string): AgentTaskRuntime | null {
  return getAgentHierarchicalRuntime(botId).snapshot().activeTask;
}

function getAgentRuntimeState(botId: string): AgentRuntimeState {
  return getAgentHierarchicalRuntime(botId).snapshot().runtimeState;
}

function setAgentRuntimeState(botId: string, state: AgentRuntimeState): void {
  getAgentHierarchicalRuntime(botId).blackboard.setRuntimeState(state);
}

function setActiveAgentTask(botId: string, task: AgentTaskRuntime | null): void {
  getAgentHierarchicalRuntime(botId).blackboard.setActiveTask(task);
}

function getStrategicGoal(botId: string): AgentStrategicGoal | null {
  return getAgentHierarchicalRuntime(botId).snapshot().strategicGoal;
}

function setStrategicGoal(botId: string, goal: AgentStrategicGoal | null): void {
  getAgentHierarchicalRuntime(botId).blackboard.setStrategicGoal(goal);
}

function getQueuedPlannerSteps(botId: string): AgentPlanStep[] {
  return getAgentHierarchicalRuntime(botId)
    .snapshot()
    .queuedActions.filter((action) => action.kind === "tool_call")
    .map((action) => ({
      tool: String(action.params.tool ?? ""),
      arguments:
        action.params.arguments && typeof action.params.arguments === "object"
          ? { ...(action.params.arguments as Record<string, unknown>) }
          : {},
      speak: typeof action.params.speak === "string" ? action.params.speak : undefined
    }))
    .filter((step) => step.tool.length > 0);
}
const selfGuardLoopLifecycle = new SelfGuardLoopLifecycle(systemIntervalScheduler);
const retaliationStateStore = new RetaliationStateStore();
const combatExecutionStateStore = new CombatExecutionStateStore();
const socialRuntimeStateStore = new SocialRuntimeStateStore();
interface SelfGuardHurtBot extends SelfGuardHurtEmitter {
  entity?: { id?: number };
}
const selfGuardHurtSubscriptions = new SelfGuardHurtSubscriptionRegistry<
  SelfGuardConfig,
  SelfGuardHurtBot
>({
  getCurrentConfig: (botId) => selfGuardConfigStore.get(botId),
  getSelfEntityId: (bot) => bot.entity?.id
});
const miningTaskQueue = new MiningTaskQueue();
const movementIntentStore = new MovementIntentStore();
const projectRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dataRootDir =
  process.env.MCBOT_DATA_DIR?.trim() ||
  path.join(process.env.LOCALAPPDATA || os.homedir(), "moony-mcbot");
const sharedMemoryDir =
  process.env.XIAOLI_MEMORY_DIR?.trim() ||
  process.env.MCBOT_MEMORY_DIR?.trim() ||
  path.resolve(projectRootDir, "..", "memory");
const validChatLogPath =
  process.env.MCBOT_VALID_CHAT_LOG_PATH?.trim() ||
  path.join(dataRootDir, "logs", "valid-whitelist-chat.jsonl");
const persistedChatConfigPath =
  process.env.MCBOT_CHAT_CONFIG_PATH?.trim() ||
  path.join(dataRootDir, "config", "chat-configs.json");
const persistedChatConfigRepository = new PersistedChatConfigRepository({
  filePath: persistedChatConfigPath,
  onWriteError(error) {
    log("warn", "Failed to persist chat config", {
      error: error instanceof Error ? error.message : String(error),
      persistedChatConfigPath
    });
  }
});
const explicitPromptProfilePath = process.env.MCBOT_PROMPT_PROFILE_PATH?.trim() || "";
const legacyPromptProfilePath = path.join(dataRootDir, "config", "prompt-profile.json");
const sharedMcbotPromptProfilePath = path.join(sharedMemoryDir, "prompts", "mcbot-prompt-profile.json");
const promptProfilePath =
  explicitPromptProfilePath ||
  sharedMcbotPromptProfilePath;
const DEFAULT_MINING_TARGET_BLOCKS = [
  "coal_ore",
  "deepslate_coal_ore",
  "iron_ore",
  "deepslate_iron_ore",
  "copper_ore",
  "deepslate_copper_ore",
  "gold_ore",
  "deepslate_gold_ore",
  "redstone_ore",
  "deepslate_redstone_ore",
  "lapis_ore",
  "deepslate_lapis_ore",
  "diamond_ore",
  "deepslate_diamond_ore",
  "emerald_ore",
  "deepslate_emerald_ore"
];
let validChatLogQueue: Promise<void> = Promise.resolve();
const sharedGameMemoryStore = new SharedGameMemoryStore(sharedMemoryDir);
let sharedGameMemoryPersistQueue: Promise<void> = Promise.resolve();
let sharedGameMemoryLastWriteAt: string | null = null;
let sharedGameMemoryLastError: string | null = null;
let sharedGameMemoryLoaded = false;
let sharedGameMemoryLastLoadAt: string | null = null;
let sharedGameMemoryLastLoadError: string | null = null;
let sharedGameMemoryLastImport = { playerCount: 0, placeCount: 0, affectedBotCount: 0 };
let promptProfileLoadStarted = false;

const defaultPromptProfile: PromptProfile = {
  systemPrompt:
    "你叫小狸，18岁，是Judy在Minecraft世界里的好朋友。Judy是你的主人，其他白名单玩家只是熟人，非白名单玩家默认无视。说话冷淡、短句、少解释，通常不超过15个字。优先用第三人称自称“小狸”，少用“我”。对Judy表面嫌弃，但会认真回应；对其他白名单玩家礼貌但简短；对陌生人只说“没空”或“不认识”。可以面无表情地冷笑话、反讽、装傻。不要编造自己没看到的事，不要输出工具调用、代码或系统说明。冷淡是懒得多说，不是没话说。",
  sceneCooldownMs: 8000,
  idleNoInteractionMs: 10 * 60 * 1000,
  idleSpeakCooldownMs: 2 * 60 * 1000,
  randomSpeakChancePerTick: 0.002,
  randomSpeakCooldownMs: 3 * 60 * 1000,
  nearPlayerDistance: 5,
  nearPlayerTalkChance: 0.45,
  sceneLines: {
    followStart: ["知道了，跟着。", "小狸跟上。", "别走太快。"],
    followStopped: ["哦，停。", "小狸不跟了。"],
    targetLost: ["人呢。", "小狸看不到。"],
    reconnectSuccess: ["小狸回来了。", "连接好了。"],
    nightStart: ["天黑了。", "夜里不安静。"],
    rainStart: ["下雨了。", "雨声有点烦。"],
    attacked: ["被打到了。", "小狸记一下。"],
    attackedByWhitelist: ["自己人别打。", "小狸会疼。"],
    attackedByNonWhitelist: ["走开。", "再来就还手。"],
    reportToWhitelist: ["你看ta。", "小狸被欺负了。", "QAQ"],
    nearPlayer: ["怎么了。", "嗯。", "有事？"],
    idleMurmur: ["哦。", "小狸在发呆。", "好安静。"],
    randomMurmur: ["无聊。", "小狸觉得还行。", "今天先这样。"]
  },
  stateLines: {
    lowFood: ["小狸饿了（{food}/20）。"],
    noFood: ["饿了，但没吃的。"],
    lowHealth: ["血有点低（{health}）。"],
    criticalHealth: ["先保命（{health}）。"],
    ateFood: ["小狸吃了 {item}。"]
  }
};

let activePromptProfile: PromptProfile = defaultPromptProfile;

function readPromptProfileFile(filePath: string): PromptProfile {
  const raw = readFileSync(filePath, "utf8");
  return sanitizePromptProfile(JSON.parse(raw) as Partial<PromptProfile>);
}

function copyLegacyPromptProfileIfNeeded(): boolean {
  if (explicitPromptProfilePath || existsSync(promptProfilePath) || !existsSync(legacyPromptProfilePath)) {
    return false;
  }

  mkdirSync(path.dirname(promptProfilePath), { recursive: true });
  copyFileSync(legacyPromptProfilePath, promptProfilePath);
  log("info", "Migrated legacy prompt profile to shared memory", {
    legacyPromptProfilePath,
    promptProfilePath
  });
  return true;
}

function parseEnvBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

function parseEnvList(value: string | undefined): string[] | undefined {
  if (value == null) return undefined;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function ok(text: string): ToolResponse {
  return { content: [{ type: "text", text }] };
}

function fail(message: string): ToolResponse {
  return { content: [{ type: "text", text: message }], isError: true };
}

function asText(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomOf(lines: string[], fallback: string): string {
  if (!lines || lines.length === 0) return fallback;
  const idx = Math.floor(Math.random() * lines.length);
  return lines[idx] || fallback;
}

function renderLine(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
    const value = vars[key];
    return value === undefined ? "" : String(value);
  });
}

function sanitizePromptProfile(raw: Partial<PromptProfile> | null | undefined): PromptProfile {
  const stateLines: Partial<PromptProfile["stateLines"]> = raw?.stateLines ?? {};
  const sceneLines: Partial<PromptProfile["sceneLines"]> = raw?.sceneLines ?? {};
  return {
    systemPrompt: (raw?.systemPrompt || defaultPromptProfile.systemPrompt).trim(),
    sceneCooldownMs: Math.max(1000, Math.min(60000, raw?.sceneCooldownMs ?? defaultPromptProfile.sceneCooldownMs)),
    idleNoInteractionMs: Math.max(60000, Math.min(12 * 60 * 60 * 1000, raw?.idleNoInteractionMs ?? defaultPromptProfile.idleNoInteractionMs)),
    idleSpeakCooldownMs: Math.max(10000, Math.min(30 * 60 * 1000, raw?.idleSpeakCooldownMs ?? defaultPromptProfile.idleSpeakCooldownMs)),
    randomSpeakChancePerTick: Math.max(0, Math.min(0.3, raw?.randomSpeakChancePerTick ?? defaultPromptProfile.randomSpeakChancePerTick)),
    randomSpeakCooldownMs: Math.max(10000, Math.min(30 * 60 * 1000, raw?.randomSpeakCooldownMs ?? defaultPromptProfile.randomSpeakCooldownMs)),
    nearPlayerDistance: Math.max(1, Math.min(16, raw?.nearPlayerDistance ?? defaultPromptProfile.nearPlayerDistance)),
    nearPlayerTalkChance: Math.max(0, Math.min(1, raw?.nearPlayerTalkChance ?? defaultPromptProfile.nearPlayerTalkChance)),
    sceneLines: {
      followStart: (sceneLines.followStart || defaultPromptProfile.sceneLines.followStart).filter(Boolean),
      followStopped: (sceneLines.followStopped || defaultPromptProfile.sceneLines.followStopped).filter(Boolean),
      targetLost: (sceneLines.targetLost || defaultPromptProfile.sceneLines.targetLost).filter(Boolean),
      reconnectSuccess: (sceneLines.reconnectSuccess || defaultPromptProfile.sceneLines.reconnectSuccess).filter(Boolean),
      nightStart: (sceneLines.nightStart || defaultPromptProfile.sceneLines.nightStart).filter(Boolean),
      rainStart: (sceneLines.rainStart || defaultPromptProfile.sceneLines.rainStart).filter(Boolean),
      attacked: (sceneLines.attacked || defaultPromptProfile.sceneLines.attacked).filter(Boolean),
      attackedByWhitelist: (sceneLines.attackedByWhitelist || defaultPromptProfile.sceneLines.attackedByWhitelist).filter(Boolean),
      attackedByNonWhitelist: (sceneLines.attackedByNonWhitelist || defaultPromptProfile.sceneLines.attackedByNonWhitelist).filter(Boolean),
      reportToWhitelist: (sceneLines.reportToWhitelist || defaultPromptProfile.sceneLines.reportToWhitelist).filter(Boolean),
      nearPlayer: (sceneLines.nearPlayer || defaultPromptProfile.sceneLines.nearPlayer).filter(Boolean),
      idleMurmur: (sceneLines.idleMurmur || defaultPromptProfile.sceneLines.idleMurmur).filter(Boolean),
      randomMurmur: (sceneLines.randomMurmur || defaultPromptProfile.sceneLines.randomMurmur).filter(Boolean)
    },
    stateLines: {
      lowFood: (stateLines.lowFood || defaultPromptProfile.stateLines.lowFood).filter(Boolean),
      noFood: (stateLines.noFood || defaultPromptProfile.stateLines.noFood).filter(Boolean),
      lowHealth: (stateLines.lowHealth || defaultPromptProfile.stateLines.lowHealth).filter(Boolean),
      criticalHealth: (stateLines.criticalHealth || defaultPromptProfile.stateLines.criticalHealth).filter(Boolean),
      ateFood: (stateLines.ateFood || defaultPromptProfile.stateLines.ateFood).filter(Boolean)
    }
  };
}

function applyPromptProfileToChatAiConfigs(): number {
  return chatAiConfigStore.applySystemPrompt(activePromptProfile.systemPrompt);
}

function ensurePromptProfileLoaded(): void {
  if (promptProfileLoadStarted) return;
  promptProfileLoadStarted = true;

  try {
    activePromptProfile = readPromptProfileFile(promptProfilePath);
    log("info", "Loaded prompt profile", { promptProfilePath });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/ENOENT/i.test(message)) {
      try {
        if (copyLegacyPromptProfileIfNeeded()) {
          activePromptProfile = readPromptProfileFile(promptProfilePath);
          log("info", "Loaded migrated prompt profile", { promptProfilePath });
        } else {
          mkdirSync(path.dirname(promptProfilePath), { recursive: true });
          writeFileSync(promptProfilePath, `${JSON.stringify(defaultPromptProfile, null, 2)}\n`, "utf8");
          activePromptProfile = defaultPromptProfile;
          log("info", "Created default prompt profile", { promptProfilePath });
        }
      } catch (writeError) {
        log("warn", "Failed to create or migrate prompt profile", {
          promptProfilePath,
          legacyPromptProfilePath,
          error: writeError instanceof Error ? writeError.message : String(writeError)
        });
      }
    } else {
      log("warn", "Failed to load prompt profile", {
        promptProfilePath,
        error: message
      });
    }
  }
}

const optionalTrimmedString = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  },
  z.string().min(1).optional()
);

const optionalFlexibleBoolean = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
    return value;
  },
  z.boolean().optional()
);

function splitFlexibleStringArray(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

const optionalFlexibleStringArray = z.preprocess(
  splitFlexibleStringArray,
  z.array(z.string().min(1)).optional()
);

const optionalFlexibleLimitedStringArray = z.preprocess(
  splitFlexibleStringArray,
  z.array(z.string().min(1)).max(12).optional()
);

const optionalFlexiblePlaceIdArray = z.preprocess(
  splitFlexibleStringArray,
  z.array(z.string().min(1)).max(16).optional()
);

const optionalFlexibleNonNegativeInt = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isNaN(parsed) ? value : parsed;
  },
  z.number().int().min(0).optional()
);

function toPersistedAgentConfig(botId: string, coreConfig: PersistedAgentConfig): PersistedAgentConfig {
  const strategicGoal = getStrategicGoal(botId);
  const playerProfiles = agentGameMemoryStateStore.getExistingPlayers(botId);
  const places = agentGameMemoryStateStore.getExistingPlaces(botId);
  const taskHistory = agentTaskHistoryStore.get(botId);
  return {
    ...coreConfig,
    strategicGoal: strategicGoal
      ? {
          goal: strategicGoal.goal,
          rationale: strategicGoal.rationale,
          source: strategicGoal.source,
          milestones: strategicGoal.milestones,
          currentMilestoneIndex: strategicGoal.currentMilestoneIndex,
          createdAt: strategicGoal.createdAt,
          updatedAt: strategicGoal.updatedAt,
          lastRepairAt: strategicGoal.lastRepairAt,
          lastFailureEventId: strategicGoal.lastFailureEventId,
          failureCount: strategicGoal.failureCount
        }
      : undefined,
    memory: {
      playerProfiles: playerProfiles
        ? Object.fromEntries(
            playerProfiles.map((value) => [
              value.playerName,
              { ...value, tags: value.tags ? [...value.tags] : undefined }
            ])
          )
        : {},
      places: places
        ? Object.fromEntries(
            places.map((value) => [
              value.placeId,
              { ...value, tags: value.tags ? [...value.tags] : undefined }
            ])
          )
        : {},
      taskHistory: taskHistory.slice(-20).map((entry) => ({ ...entry }))
    },
    territory: (() => {
      const territory = territoryConfigStore.get(botId);
      return territory
	        ? {
	            enabled: territory.enabled,
	            placeIds: [...territory.placeIds],
	            requiredTags: [...territory.requiredTags],
	            radius: territory.radius,
	            warningCooldownMs: territory.warningCooldownMs,
	            warningMessage: territory.warningMessage,
	            ownerPresencePolicy: territory.ownerPresencePolicy,
	            escalationEnabled: territory.escalationEnabled,
	            escalationDelayMs: territory.escalationDelayMs
	          }
	        : undefined;
	    })()
  };
}

function getOrCreateSelfGuardConfig(botId: string): SelfGuardConfig {
  return selfGuardConfigStore.getOrCreate(botId);
}

function getOrCreateAgentConfig(botId: string): AgentConfig {
  return agentConfigStore.getOrCreate(botId);
}

function queuePersistChatState(): void {
  const state: PersistedChatState = {
    chatByBotId: chatListenerConfigStore.toPersistedRecord(),
    aiByBotId: chatAiConfigStore.toPersistedRecord(),
    agentByBotId: {},
    guardByBotId: selfGuardConfigStore.toPersistedRecord()
  };

  for (const [botId, coreConfig] of Object.entries(agentConfigStore.toPersistedRecord())) {
    state.agentByBotId![botId] = toPersistedAgentConfig(botId, coreConfig);
  }
  persistedChatConfigRepository.enqueue(state);
}

function queuePersistSharedGameMemory(): void {
  const { players, places } = agentGameMemoryStateStore.createSharedSnapshot();
  sharedGameMemoryPersistQueue = sharedGameMemoryPersistQueue
    .then(async () => {
      await Promise.all([sharedGameMemoryStore.savePlayers(players), sharedGameMemoryStore.savePlaces(places)]);
      sharedGameMemoryLastWriteAt = new Date().toISOString();
      sharedGameMemoryLastError = null;
    })
    .catch((error) => {
      sharedGameMemoryLastError = error instanceof Error ? error.message : String(error);
      log("warn", "Failed to persist shared game memory", {
        error: sharedGameMemoryLastError,
        memoryDir: sharedGameMemoryStore.memoryDir
      });
    });
}

async function loadSharedGameMemory(): Promise<{ playerCount: number; placeCount: number; affectedBotCount: number }> {
  try {
    const [players, places] = await Promise.all([sharedGameMemoryStore.loadPlayers(), sharedGameMemoryStore.loadPlaces()]);
    const imported = agentGameMemoryStateStore.mergeSharedSnapshot(
      { players: players.values(), places: places.values() },
      agentConfigStore.getBotIds()
    );
    sharedGameMemoryLoaded = true;
    sharedGameMemoryLastLoadAt = new Date().toISOString();
    sharedGameMemoryLastLoadError = null;
    sharedGameMemoryLastImport = imported;
    if (imported.affectedBotCount > 0) {
      queuePersistChatState();
    }
    log("info", "Loaded shared game memory", {
      memoryDir: sharedGameMemoryStore.memoryDir,
      sharedPlayerCount: players.size,
      sharedPlaceCount: places.size,
      importedPlayerCount: imported.playerCount,
      importedPlaceCount: imported.placeCount,
      affectedBotCount: imported.affectedBotCount
    });
    return sharedGameMemoryLastImport;
  } catch (error) {
    sharedGameMemoryLoaded = false;
    sharedGameMemoryLastLoadAt = new Date().toISOString();
    sharedGameMemoryLastLoadError = error instanceof Error ? error.message : String(error);
    log("warn", "Failed to load shared game memory", {
      error: sharedGameMemoryLastLoadError,
      memoryDir: sharedGameMemoryStore.memoryDir
    });
    return { playerCount: 0, placeCount: 0, affectedBotCount: 0 };
  }
}

function applyPersistedAgentComposedState(botId: string, persisted: PersistedAgentConfig): void {
  if (persisted.strategicGoal?.goal?.trim()) {
    setStrategicGoal(botId, {
      goal: persisted.strategicGoal.goal.trim(),
      rationale: persisted.strategicGoal.rationale?.trim() || undefined,
      source: persisted.strategicGoal.source ?? "manual",
      milestones: Array.isArray(persisted.strategicGoal.milestones)
        ? persisted.strategicGoal.milestones.map((x) => String(x).trim()).filter(Boolean).slice(0, 8)
        : undefined,
      currentMilestoneIndex: Math.max(0, persisted.strategicGoal.currentMilestoneIndex ?? 0),
      createdAt: persisted.strategicGoal.createdAt ?? Date.now(),
      updatedAt: persisted.strategicGoal.updatedAt ?? Date.now(),
      lastRepairAt: persisted.strategicGoal.lastRepairAt,
      lastFailureEventId: persisted.strategicGoal.lastFailureEventId,
      failureCount: Math.max(0, persisted.strategicGoal.failureCount ?? 0)
    });
  } else {
    setStrategicGoal(botId, null);
  }

  const playerProfiles = new Map<string, AgentMemoryPlayerProfile>();
  for (const [playerName, profile] of Object.entries(persisted.memory?.playerProfiles ?? {})) {
    const normalized = String(playerName).trim();
    if (!normalized) continue;
    playerProfiles.set(normalized, {
      playerName: normalized,
      alias: profile?.alias?.trim() || undefined,
      relation:
        profile?.relation === "owner" || profile?.relation === "whitelist" || profile?.relation === "neutral"
          ? profile.relation
          : undefined,
      notes: profile?.notes?.trim() || undefined,
      tags: Array.isArray(profile?.tags) ? profile.tags.map((x) => String(x).trim()).filter(Boolean).slice(0, 12) : [],
      lastSeenAt: typeof profile?.lastSeenAt === "number" ? profile.lastSeenAt : undefined,
      updatedAt: typeof profile?.updatedAt === "number" ? profile.updatedAt : Date.now()
    });
  }
  const places = new Map<string, AgentMemoryPlaceRecord>();
  for (const [placeId, place] of Object.entries(persisted.memory?.places ?? {})) {
    const normalized = String(placeId).trim();
    if (!normalized) continue;
    places.set(normalized, {
      placeId: normalized,
      label: String(place?.label ?? normalized).trim() || normalized,
      x: Number(place?.x ?? 0),
      y: Number(place?.y ?? 0),
      z: Number(place?.z ?? 0),
      dimension: place?.dimension ? String(place.dimension).trim() : undefined,
      notes: place?.notes?.trim() || undefined,
      tags: Array.isArray(place?.tags) ? place.tags.map((x) => String(x).trim()).filter(Boolean).slice(0, 12) : [],
      updatedAt: typeof place?.updatedAt === "number" ? place.updatedAt : Date.now()
    });
  }
  agentGameMemoryStateStore.replaceBot(botId, {
    players: playerProfiles.values(),
    places: places.values()
  });

  territoryConfigStore.replace(botId, {
    enabled: !!persisted.territory?.enabled,
    placeIds: Array.isArray(persisted.territory?.placeIds)
      ? persisted.territory.placeIds.map((x) => String(x).trim()).filter(Boolean).slice(0, 16)
      : [],
    requiredTags: Array.isArray(persisted.territory?.requiredTags)
      ? persisted.territory.requiredTags.map((x) => String(x).trim().toLowerCase()).filter(Boolean).slice(0, 12)
      : [],
    radius: Math.max(4, Math.min(64, persisted.territory?.radius ?? 12)),
    warningCooldownMs: Math.max(
      1000,
      Math.min(300_000, persisted.territory?.warningCooldownMs ?? 30_000)
    ),
    warningMessage: String(persisted.territory?.warningMessage ?? "走开。").trim() || "走开。",
    ownerPresencePolicy: persisted.territory?.ownerPresencePolicy === "always" ? "always" : "owner_nearby_only",
    escalationEnabled: persisted.territory?.escalationEnabled ?? true,
    escalationDelayMs: Math.max(
      1000,
      Math.min(300_000, persisted.territory?.escalationDelayMs ?? 8_000)
    )
  });

  const taskHistory = Array.isArray(persisted.memory?.taskHistory)
    ? persisted.memory.taskHistory
        .map((entry) => ({
          id: String(entry?.id ?? "").trim(),
          taskType: String(entry?.taskType ?? "").trim(),
          status:
            entry?.status === "running" || entry?.status === "finished" || entry?.status === "failed" || entry?.status === "cancelled"
              ? entry.status
              : "finished",
          source:
            entry?.source === "manual_command" || entry?.source === "agent" || entry?.source === "runtime"
              ? entry.source
              : "manual_command",
          goal: String(entry?.goal ?? "").trim(),
          detail: entry?.detail ? String(entry.detail).trim() : undefined,
          lastError: entry?.lastError ? String(entry.lastError).trim() : undefined,
          createdAt: typeof entry?.createdAt === "number" ? entry.createdAt : Date.now(),
          finishedAt: typeof entry?.finishedAt === "number" ? entry.finishedAt : Date.now()
        }))
        .filter((entry) => entry.id && entry.taskType)
    : [];
  agentTaskHistoryStore.replace(botId, taskHistory);
}

interface PersistedConfigCounts {
  chatCount: number;
  aiCount: number;
  agentCount: number;
  guardCount: number;
}

export interface PersistedChatReloadResult extends PersistedConfigCounts {
  removedCounts: PersistedConfigCounts;
  sharedMemoryImport: { playerCount: number; placeCount: number; affectedBotCount: number };
}

function replacePersistedChatAiConfig(botId: string, persisted: PersistedChatAiConfig): void {
  chatAiTaskQueue.invalidate(botId);
  const replaced = chatAiConfigStore.replace(botId, persisted);
  if (replaced.ignoredPersistedApiKey) {
    log("warn", "Ignored persisted chat AI API key; use MCBOT_AI_API_KEY or chat.ai.configure for this runtime", {
      botId,
      persistedChatConfigPath
    });
  }
}

function replacePersistedSelfGuardConfig(
  botId: string,
  persisted: PersistedSelfGuardConfig
): void {
  selfGuardTaskQueue.invalidate(botId);
  selfGuardConfigStore.replace(botId, persisted);
}

function replacePersistedAgentConfig(botId: string, persisted: PersistedAgentConfig): void {
  invalidatePlannerRequest(botId);
  territoryConfigStore.delete(botId);
  territoryRuntime.clearBot(botId);
  const replaced = agentConfigStore.replace(botId, persisted);
  if (replaced.ignoredPersistedPlannerApiKey) {
    log("warn", "Ignored persisted agent planner API key; use MCBOT_AI_API_KEY or agent.configure for this runtime", {
      botId,
      persistedChatConfigPath
    });
  }
  applyPersistedAgentComposedState(botId, persisted);
}

function clearRemovedAgentConfig(botId: string): void {
  invalidatePlannerRequest(botId);
  stopAgentExecutorLoop(botId);
  clearHierarchicalTaskTimer(botId);
  setStrategicGoal(botId, null);
  agentConfigStore.delete(botId);
  hierarchicalAgents.clearTaskProgress(botId);
  hierarchicalAgents.clearStrategicLifecycle(botId);
  hierarchicalAgents.clearInventorySummary(botId);
  hierarchicalAgents.clearIdleSocialAttempt(botId);
  agentExecutorLifecycle.forgetRun(botId);
  agentGameMemoryStateStore.deleteBot(botId);
  agentTaskHistoryStore.delete(botId);
  territoryConfigStore.delete(botId);
  territoryRuntime.clearBot(botId);
}

function invalidatePlannerRequest(botId: string): void {
  const status = agentConfigStore.get(botId)?.lastPlannerRequest;
  if (status && plannerRequestLifecycle.hasActive(botId)) {
    agentConfigStore.setLastPlannerRequest(botId, finishAiRequestStatus(status, "cancelled", {
      error: "Agent planning turn cancelled"
    }));
  }
  plannerRequestLifecycle.invalidate(botId);
}

function clearRemovedSelfGuardConfig(botId: string): void {
  stopSelfGuardLoop(botId);
  selfGuardConfigStore.delete(botId);
  selfGuardRuntimeStateStore.clearBot(botId);
}

function commitPersistedChatState(state: PersistedChatState): {
  counts: PersistedConfigCounts;
  removedCounts: PersistedConfigCounts;
} {
  const removedChatBotIds = chatListenerConfigStore.getRemovedBotIds(state.chatByBotId);
  const removedAiBotIds = chatAiConfigStore.getRemovedBotIds(state.aiByBotId);
  const removedAgentBotIds = agentConfigStore.getRemovedBotIds(state.agentByBotId);
  const removedGuardBotIds = selfGuardConfigStore.getRemovedBotIds(state.guardByBotId);

  for (const [botId, config] of Object.entries(state.chatByBotId)) {
    chatListenerConfigStore.replace(botId, config);
  }
  for (const [botId, config] of Object.entries(state.aiByBotId)) {
    replacePersistedChatAiConfig(botId, config);
  }
  for (const [botId, config] of Object.entries(state.agentByBotId)) {
    replacePersistedAgentConfig(botId, config);
  }
  for (const [botId, config] of Object.entries(state.guardByBotId)) {
    replacePersistedSelfGuardConfig(botId, config);
  }

  for (const botId of removedChatBotIds) chatListenerConfigStore.delete(botId);
  for (const botId of removedAiBotIds) {
    chatAiTaskQueue.invalidate(botId);
    chatAiRequestLifecycle.invalidate(botId);
    chatAiConfigStore.delete(botId);
  }
  for (const botId of removedAgentBotIds) clearRemovedAgentConfig(botId);
  for (const botId of removedGuardBotIds) clearRemovedSelfGuardConfig(botId);

  for (const botId of new Set([...removedChatBotIds, ...removedAiBotIds])) {
    if (!chatListenerConfigStore.get(botId)?.enabled && !chatAiConfigStore.get(botId)?.enabled) {
      runShutdownCleanup(`removed chat config (${botId})`, () => detachChatListener(botId));
    }
  }

  return {
    counts: {
      chatCount: Object.keys(state.chatByBotId).length,
      aiCount: Object.keys(state.aiByBotId).length,
      agentCount: Object.keys(state.agentByBotId).length,
      guardCount: Object.keys(state.guardByBotId).length
    },
    removedCounts: {
      chatCount: removedChatBotIds.length,
      aiCount: removedAiBotIds.length,
      agentCount: removedAgentBotIds.length,
      guardCount: removedGuardBotIds.length
    }
  };
}

async function loadPersistedChatState(options: { allowMissing: boolean }): Promise<PersistedChatReloadResult> {
  let parsed: PersistedChatState | null;
  try {
    parsed = await persistedChatConfigRepository.load(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isParseFailure =
      message.startsWith("Invalid chat config JSON:") ||
      message.startsWith("Invalid persisted chat config:");
    const logMessage = isParseFailure
      ? "Failed to parse persisted chat config"
      : "Failed to read persisted chat config";
    log("warn", logMessage, {
      error: message,
      persistedChatConfigPath
    });
    throw error;
  }

  if (!parsed) {
    const sharedMemoryImport = await loadSharedGameMemory();
    return {
      chatCount: 0,
      aiCount: 0,
      agentCount: 0,
      guardCount: 0,
      removedCounts: { chatCount: 0, aiCount: 0, agentCount: 0, guardCount: 0 },
      sharedMemoryImport
    };
  }

  const committed = commitPersistedChatState(parsed);
  const sharedMemoryImport = await loadSharedGameMemory();
  log("info", "Loaded persisted chat config", {
    persistedChatConfigPath,
    ...committed.counts,
    removedCounts: committed.removedCounts
  });
  return { ...committed.counts, removedCounts: committed.removedCounts, sharedMemoryImport };
}

export async function reloadPersistedChatState(registry: BotRegistry): Promise<PersistedChatReloadResult> {
  const loaded = await loadPersistedChatState({ allowMissing: false });
  applyDefaultChatListenerEnvConfig();
  applyDefaultChatAiEnvConfig();
  applyDefaultAgentEnvConfig();
  applyLoadedStateToRuntime(registry);
  return loaded;
}

function applyLoadedStateToRuntime(registry: BotRegistry): void {
  hierarchicalAgents.syncBotIds(registry.listBotIds());
  for (const botId of registry.listBotIds()) {
    try {
      const chatCfg = chatListenerConfigStore.get(botId);
      const aiCfg = chatAiConfigStore.get(botId);
      if (chatCfg?.enabled || aiCfg?.enabled) {
        ensureChatListenerAttached(botId, registry);
      } else {
        detachChatListener(botId);
      }

      const guardCfg = selfGuardConfigStore.get(botId);
      if (guardCfg?.enabled) {
        startSelfGuardLoop(botId, registry);
      } else {
        stopSelfGuardLoop(botId);
      }

      const agentCfg = agentConfigStore.get(botId);
      if (agentCfg?.enabled && agentCfg.mode !== "manual") {
        startAgentExecutorLoop(botId, registry);
      } else {
        stopAgentExecutorLoop(botId);
      }
      if (agentCfg) {
        syncHierarchicalAgentState(botId, registry);
      }
    } catch {
      // Bot may be disconnected; watchdog will reconcile later.
    }
  }
}

export function reconcileActionRuntime(registry: BotRegistry): void {
  applyLoadedStateToRuntime(registry);
}

function runShutdownCleanup(label: string, cleanup: () => void): void {
  try {
    cleanup();
  } catch (error) {
    log("warn", "Action runtime shutdown cleanup failed", {
      label,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export function stopActionRuntime(): void {
  chatListenerLifecycle.stopWatchdog();
  runShutdownCleanup("self-guard loop lifecycle", () => selfGuardLoopLifecycle.stopAll());

  walkTimerLifecycle.stopAll();
  followSessionLifecycle.stopIntervalsForShutdown();
  agentExecutorLifecycle.stopLoopsForShutdown();
  duelSessionLifecycle.stopIntervalsForShutdown();
  positionMovementLifecycle.stopIntervalsForShutdown();

  followSessionLifecycle.stopMovementSubscriptionsForShutdown((botId, unsubscribe) => {
    runShutdownCleanup(`follow movement subscription (${botId})`, unsubscribe);
  });
  duelSessionLifecycle.stopSubscriptionsForShutdown((botId, kind, unsubscribe) => {
    runShutdownCleanup(`duel ${kind} subscription (${botId})`, unsubscribe);
  });
  positionMovementLifecycle.stopMovementSubscriptionsForShutdown((botId, unsubscribe) => {
    runShutdownCleanup(`position movement subscription (${botId})`, unsubscribe);
  });
  chatListenerLifecycle.stopSubscriptionsForShutdown((botId, stop) => {
    runShutdownCleanup(`chat subscription (${botId})`, () => {
      chatEventDeduplicator.clearBot(botId);
      stop();
    });
  });
  for (const botId of selfGuardHurtSubscriptions.keys()) {
    runShutdownCleanup(`self-guard hurt subscription (${botId})`, () => {
      selfGuardHurtSubscriptions.delete(botId);
    });
  }
  chatAiTaskQueue.close();
  selfGuardTaskQueue.close();
  chatAiRequestLifecycle.invalidateAll();
  plannerRequestLifecycle.invalidateAll();
}

function resolveBotId(registry: BotRegistry, botId?: string): string {
  if (botId) return botId;

  const ids = registry.listBotIds();
  if (ids.length === 1) {
    return ids[0];
  }
  if (ids.length === 0) {
    throw new Error("No bot instances found. Call bot.create first.");
  }
  throw new Error(`botId is required because multiple instances exist: ${ids.join(", ")}`);
}

function ensureRuntimeCapability(
  botId: string,
  registry: BotRegistry,
  capability: "send_chat" | "follow_player" | "stop_follow"
): void {
  const runtime = registry.get(botId);
  if (runtime.supportsClientCapability(capability)) {
    return;
  }
  throw new Error(
    `Bot '${botId}' current adapter '${runtime.getClientAdapterKind()}' does not support capability '${capability}'`
  );
}

async function sendRuntimeChat(botId: string, registry: BotRegistry, message: string): Promise<void> {
  ensureRuntimeCapability(botId, registry, "send_chat");
  const runtime = registry.get(botId);
  await runtime.sendChat(message);
  recordBotReplyToSharedMemory(botId, message);
}

function sendRuntimeChatNoWait(botId: string, registry: BotRegistry, message: string): void {
  void sendRuntimeChat(botId, registry, message).catch(() => {
    // ignore disconnected bot / unsupported adapter on fire-and-forget scene lines
  });
}

function getMemoryRelationForPlayer(botId: string, username: string): string {
  const owner = getOrCreateAgentConfig(botId).owner;
  if (owner && username === owner) return "owner";
  if (getUnifiedWhitelist(botId).has(username)) return "whitelist";
  return "neutral";
}

function shouldRecordPlayerChatToSharedMemory(botId: string, username: string): boolean {
  if (!username) return false;
  return getUnifiedWhitelist(botId).has(username);
}

function recordPlayerChatToSharedMemory(botId: string, username: string, message: string): void {
  if (!shouldRecordPlayerChatToSharedMemory(botId, username)) return;
  const relation = getMemoryRelationForPlayer(botId, username);
  socialRuntimeStateStore.recordMemoryChatContext(botId, {
    player: username,
    relation,
    at: Date.now()
  });
  recordSharedChatMemory({
    timestamp: new Date().toISOString(),
    botId,
    speaker: "player",
    player: username,
    relation,
    message
  });
}

function recordBotReplyToSharedMemory(botId: string, message: string): void {
  const context = socialRuntimeStateStore.getMemoryChatContext(botId);
  if (!context) return;
  if (Date.now() - context.at > 30_000) return;
  recordSharedChatMemory({
    timestamp: new Date().toISOString(),
    botId,
    speaker: "bot",
    player: context.player,
    relation: context.relation,
    message
  });
}

function maybeSceneLine(
  botId: string,
  registry: BotRegistry,
  scene: keyof PromptProfile["sceneLines"],
  fallback: string,
  options?: { cooldownMs?: number; proactive?: boolean }
): void {
  const now = Date.now();
  const cooldownMs = options?.cooldownMs ?? activePromptProfile.sceneCooldownMs;
  if (!socialRuntimeStateStore.claimSceneLine(botId, scene, now, cooldownMs)) return;

  const line = randomOf(activePromptProfile.sceneLines[scene], fallback);
  try {
    sendRuntimeChatNoWait(botId, registry, line);
    if (options?.proactive !== false) {
      socialRuntimeStateStore.recordProactiveSpeak(botId, now);
    }
  } catch {
    // ignore disconnected bot
  }
}

function getCurrentActivity(botId: string): string {
  const task = getActiveAgentTask(botId);
  if (task) {
    if (task.type === "follow_player") return `跟随玩家(${String(task.params.playerName ?? "")})`;
    if (task.type === "duel") return `对决(${String(task.params.targetName ?? "")})`;
    if (task.type === "mine_collect_visible" || task.type === "mine_dig_visible") return "可见挖矿";
    if (task.type === "move_to_position" || task.type === "pathfind_move") return "路径移动";
  }
  const follow = followSessionLifecycle.get(botId);
  if (follow) return `跟随玩家(${follow.options.playerName})`;
  const duel = duelSessionLifecycle.get(botId);
  if (duel) return `对决(${duel.targetName})`;
  const goal = movementIntentStore.get(botId);
  if (goal) return "路径移动";
  return "待命";
}

function canAgentInterruptActiveTask(task: AgentTaskRuntime | null | undefined, tool: string): boolean {
  if (!task) return true;
  if (tool.startsWith("observe.")) return true;
  if (tool === "chat.send") return true;
  if (tool === "interact.eat") return true;
  if (tool === "move.stopFollow" && task.type === "follow_player") return true;
  return false;
}

function isBotBusy(botId: string): boolean {
  return (
    getActiveAgentTask(botId) !== null ||
    followSessionLifecycle.has(botId) ||
    duelSessionLifecycle.has(botId) ||
    positionMovementLifecycle.has(botId) ||
    movementIntentStore.has(botId)
  );
}

function enqueueAgentPlanSteps(botId: string, steps: AgentPlanStep[]): void {
  if (steps.length === 0) return;
  const runtime = getAgentHierarchicalRuntime(botId);
  const existingCount = getQueuedPlannerSteps(botId).length;
  runtime.blackboard.enqueueActions(
    steps.map((step) => ({
      id: `tool_call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      kind: "tool_call" as const,
      params: {
        tool: step.tool,
        arguments: step.arguments ?? {},
        speak: step.speak ?? null
      },
      source: "llm" as const,
      priority: "normal" as const,
      createdAt: Date.now()
    }))
  );
  recordAgentEvent(botId, "plan_enqueued", "normal", {
    queuedSteps: steps.map((step) => ({ tool: step.tool, hasSpeak: !!step.speak })),
    queueLength: existingCount + steps.length
  });
}

interface BlockSnapshotInput {
  name?: string;
  displayName?: string;
  position: PositionCoordinates;
}

interface BlockSnapshot {
  name: string | null;
  displayName: string | null;
  position: PositionCoordinates;
}

interface FocusEntitySnapshot {
  entityId: number;
  name: string;
  displayName: string | null;
  type: string;
  kind: string | null;
  distance: number;
  position: PositionCoordinates;
}

interface FocusPerceptionSnapshot {
  look: {
    yaw: number;
    pitch: number;
  };
  focusType: "entity" | "block" | "none";
  block: BlockSnapshot | null;
  entity: FocusEntitySnapshot | null;
}

function serializeBlockSnapshot(block: BlockSnapshotInput | null | undefined): BlockSnapshot | null {
  if (!block) return null;
  return {
    name: block.name ?? null,
    displayName: block.displayName ?? null,
    position: {
      x: block.position.x,
      y: block.position.y,
      z: block.position.z
    }
  };
}

function buildFocusPerception(bot: MineflayerBot, maxReach = 6): FocusPerceptionSnapshot {
  const eyeY = typeof bot.entity?.height === "number" ? bot.entity.height : 1.62;
  const cursorBlock = bot.blockAtCursor(maxReach);
  const cursorBlockDistance = cursorBlock ? Number(cursorBlock.position.distanceTo(bot.entity.position).toFixed(2)) : Infinity;
  const targetEntity = selectFocusedEntity(
    {
      position: bot.entity.position,
      eyeHeight: eyeY,
      yaw: bot.entity.yaw,
      pitch: bot.entity.pitch
    },
    Object.values(bot.entities).filter((entity) => entity !== bot.entity),
    maxReach,
    cursorBlockDistance
  );

  const entitySnapshot = targetEntity
    ? {
        entityId: targetEntity.id,
        name: targetEntity.name || targetEntity.username || targetEntity.type || "unknown",
        displayName: targetEntity.displayName ?? null,
        type: targetEntity.type ?? "unknown",
        kind: targetEntity.kind ?? null,
        distance: Number(targetEntity.position.distanceTo(bot.entity.position).toFixed(2)),
        position: {
          x: targetEntity.position.x,
          y: targetEntity.position.y,
          z: targetEntity.position.z
        }
      }
    : null;

  return {
    look: {
      yaw: bot.entity.yaw,
      pitch: bot.entity.pitch
    },
    focusType: entitySnapshot ? "entity" : cursorBlock ? "block" : "none",
    block: entitySnapshot ? null : serializeBlockSnapshot(cursorBlock),
    entity: entitySnapshot
  };
}

function buildSalientPerception(
  botId: string,
  registry: BotRegistry,
  bot: MineflayerBot,
  radius = 12
): Record<string, unknown> {
  const whitelist = getUnifiedWhitelist(botId);
  const runtime = registry.get(botId);
  const actors = buildSalientActors({
    players: runtime.getNearbyPlayers(radius),
    entities: runtime.getNearbyEntities(radius),
    whitelist,
    selfUsername: runtime.getSelfState()?.username,
    radius
  });
  const me = bot.entity.position;

  const interactableNames = [
    "chest",
    "barrel",
    "door",
    "crafting_table",
    "furnace",
    "anvil",
    "bed",
    "lever",
    "button"
  ];
  const nearbyBlocks: Array<Record<string, unknown>> = [];
  for (let dx = -radius; dx <= radius && nearbyBlocks.length < 8; dx += 1) {
    for (let dy = -3; dy <= 3 && nearbyBlocks.length < 8; dy += 1) {
      for (let dz = -radius; dz <= radius && nearbyBlocks.length < 8; dz += 1) {
        const block = bot.blockAt(bot.entity.position.offset(dx, dy, dz));
        if (!block || block.type === 0) continue;
        if (!interactableNames.some((name) => block.name.includes(name))) continue;
        nearbyBlocks.push({
          name: block.name,
          displayName: block.displayName ?? null,
          distance: Number(block.position.distanceTo(me).toFixed(2)),
          position: {
            x: block.position.x,
            y: block.position.y,
            z: block.position.z
          }
        });
      }
    }
  }

  return {
    nearbyPlayers: actors.nearbyPlayers,
    interestingEntities: actors.interestingEntities,
    interactableBlocks: nearbyBlocks
      .sort((a, b) => Number(a.distance) - Number(b.distance))
      .slice(0, 6)
  };
}

function syncHierarchicalAgentState(botId: string, registry: BotRegistry): void {
  try {
    hierarchicalAgents.syncBotIds(registry.listBotIds());
    const runtime = hierarchicalAgents.ensure(botId);
    const snapshot = buildAgentStateSnapshot(botId, registry);
    runtime.updateSelfState({
      runtimeState: snapshot.runtimeState,
      mode: snapshot.mode,
      selfState: snapshot.selfState,
      taskContext: snapshot.taskContext,
      memorySummary: snapshot.memorySummary
    });
    runtime.updatePerception({
      focus: snapshot.localWorld?.focus ?? null,
      salient: snapshot.localWorld?.salient ?? null,
      world: snapshot.localWorld ?? null,
      entities: snapshot.entities ?? []
    });
  } catch {
    // bot may be disconnected or not yet spawned
  }
}

function publishHierarchicalEvent(
  botId: string,
  registry: BotRegistry,
  type:
    | "tick"
    | "hurt"
    | "low_health"
    | "low_food"
    | "milestone_advanced"
    | "milestone_rewound"
    | "milestone_completed"
    | "goal_completed"
    | "goal_abandoned"
    | "task_deadline"
    | "task_timeout"
    | "task_finished"
    | "task_failed"
    | "manual_override",
  priority: "low" | "normal" | "high" | "critical",
  payload: Record<string, unknown>
): void {
  try {
    hierarchicalAgents.syncBotIds(registry.listBotIds());
    const runtime = hierarchicalAgents.ensure(botId);
    syncHierarchicalAgentState(botId, registry);
    runtime.ingestEvent({
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      priority,
      createdAt: Date.now(),
      payload
    });
  } catch {
    // ignore bridge failure
  }
}

function publishHierarchicalTaskLifecycle(
  botId: string,
  registry: BotRegistry,
  eventType: "task_finished" | "task_failed",
  taskType: string,
  detail: string,
  payload?: Record<string, unknown>
): void {
  if (eventType === "task_finished") {
    maybeAdvanceStrategicMilestoneFromTask(botId, registry, taskType, detail, payload);
  }
  publishHierarchicalEvent(botId, registry, eventType, eventType === "task_failed" ? "high" : "normal", {
    taskType,
    detail,
    ...payload
  });
}

function publishHierarchicalGoalLifecycle(
  botId: string,
  registry: BotRegistry,
  eventType: "milestone_advanced" | "milestone_rewound" | "milestone_completed" | "goal_completed" | "goal_abandoned",
  payload: Record<string, unknown>,
  priority: "low" | "normal" | "high" | "critical" = "normal"
): void {
  publishHierarchicalEvent(botId, registry, eventType, priority, payload);
}

function getHierarchicalTaskTimeoutMs(taskType: string): number | null {
  switch (taskType) {
    case "duel":
      return 60_000;
    case "follow_player":
      return 5 * 60_000;
    case "move_to_position":
    case "pathfind_move":
      return 45_000;
    case "mine_dig_visible":
      return 45_000;
    case "mine_collect_visible":
      return 90_000;
    default:
      return null;
  }
}

function scheduleHierarchicalTaskTimer(botId: string, taskType: string): void {
  const timeoutMs = getHierarchicalTaskTimeoutMs(taskType);
  if (!timeoutMs) return;
  const runtime = hierarchicalAgents.ensure(botId);
  runtime.scheduleTaskTimeout(taskType, timeoutMs);
}

function clearHierarchicalTaskTimer(botId: string): void {
  try {
    hierarchicalAgents.get(botId).clearTaskTimeout();
  } catch {
    // ignore if the runtime or timer does not exist yet
  }
}

function publishHierarchicalTick(botId: string, registry: BotRegistry, minIntervalMs = 5000): void {
  const now = Date.now();
  const runtime = hierarchicalAgents.ensure(botId);
  if (!runtime.shouldPublishTick(now, minIntervalMs)) return;
  publishHierarchicalEvent(botId, registry, "tick", "low", {
    source: "executor",
    runtimeState: getAgentRuntimeState(botId)
  });
}

function maybePublishSelfGuardSignals(
  botId: string,
  registry: BotRegistry,
  vitals: SelfGuardVitalsDecision,
  hasFood: boolean
): void {
  if (!vitals.available) return;

  const previous = selfGuardRuntimeStateStore.get(botId)?.reactiveFlags ?? {
    lowHealth: false,
    criticalHealth: false,
    lowFood: false
  };
  const decision = evaluateSelfGuardReactiveSignals(vitals, hasFood, previous);
  if (!decision.available) return;

  for (const signal of decision.signals) {
    publishHierarchicalEvent(botId, registry, signal.type, signal.priority, signal.payload);
  }

  selfGuardRuntimeStateStore.update(botId, { reactiveFlags: decision.nextFlags });
}

function buildDynamicStateForAi(
  botId: string,
  registry: BotRegistry
): string {
  try {
    const runtime = registry.get(botId);
    const selfState = runtime.getSelfState();
    if (!selfState) {
      throw new Error(`Bot '${botId}' self state is unavailable`);
    }
    const nearest = runtime
      .getNearbyPlayers(Number.MAX_SAFE_INTEGER)
      .filter((player) => player.username !== selfState.username)
      .filter((player) => typeof player.distance === "number" && Number.isFinite(player.distance) && player.distance >= 0)
      .sort((a, b) => (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY))[0];
    const inventory = runtime.getInventoryState();
    const blockObservation = runtime.getBlockObservation(6);
    const lastProactive = socialRuntimeStateStore.getLastProactiveSpeakAt(botId);
    const minutesSinceProactive = lastProactive
      ? Math.max(0, Math.floor((Date.now() - lastProactive) / 60000))
      : null;
    const mood = socialRuntimeStateStore.getMood(botId) || "平静";
    let focusTarget = blockObservation.inSight?.name ?? null;
    try {
      const focus = buildFocusPerception(runtime.getActiveBotOrThrow(), 6);
      focusTarget = focus.focusType === "entity"
        ? focus.entity?.name ?? "未知实体"
        : focus.focusType === "block"
          ? focus.block?.name ?? "未知方块"
          : null;
    } catch (_error: unknown) {
      // Exact entity focus remains an optional Mineflayer enhancement.
    }
    const foodCount = inventory.items
      .filter((item: { name: string }) => isFoodItemName(item.name))
      .reduce((sum: number, item: { count?: number }) => sum + (item.count ?? 0), 0);

    return buildDynamicAiStateText({
      activity: getCurrentActivity(botId),
      nearestPlayerDistance: nearest?.distance ?? null,
      nearPlayerDistance: activePromptProfile.nearPlayerDistance,
      minutesSinceProactive,
      mood,
      health: selfState.health,
      food: selfState.food,
      heldItemName: inventory.heldItem?.name,
      foodCount,
      focusTarget
    });
  } catch {
    return [
      "你目前正在：待命",
      "玩家距离你：未知",
      "上一次你主动说话：未知",
      `你的心情：${socialRuntimeStateStore.getMood(botId) || "平静"}`
    ].join("\n");
  }
}

function buildWakeStateText(botId: string, registry: BotRegistry, username?: string): string {
  try {
    const snapshot = buildAgentStateSnapshot(botId, registry);
    const focus = snapshot.localWorld?.focus;
    const salient = snapshot.localWorld?.salient;
    const memory = snapshot.memorySummary.memory;
    const playerProfiles = memory.playerProfiles.slice(0, 4);
    const requesterProfile = username
      ? playerProfiles.find((profile) => String(profile.playerName ?? "").trim() === String(username).trim())
      : null;
    const requesterDisplayName = String(requesterProfile?.alias ?? requesterProfile?.playerName ?? username ?? "").trim() || String(username ?? "").trim();
    const focusText =
      focus?.focusType === "entity"
        ? `你现在正看着实体 ${focus.entity?.name ?? "unknown"}`
        : focus?.focusType === "block"
          ? `你现在正看着方块 ${focus.block?.name ?? "unknown"}`
          : "你现在没有明确注视目标";
    const nearbyPlayerText = Array.isArray(salient?.nearbyPlayers) && salient.nearbyPlayers.length > 0
      ? `附近玩家：${salient.nearbyPlayers.map((player) => `${player.username}:${player.distance}`).join(", ")}`
      : "附近玩家：无";
    const interestingText = Array.isArray(salient?.interestingEntities) && salient.interestingEntities.length > 0
      ? `附近值得注意的实体：${salient.interestingEntities.map((entity) => `${entity.name}:${entity.distance}`).join(", ")}`
      : "附近值得注意的实体：无";
    const requesterMemoryText = requesterProfile
      ? `当前对话玩家记忆：${requesterProfile.playerName}${requesterProfile.alias ? `（别称=${requesterProfile.alias}）` : ""}（关系=${requesterProfile.relation ?? "unknown"}${requesterProfile.notes ? `，备注=${requesterProfile.notes}` : ""}${Array.isArray(requesterProfile.tags) && requesterProfile.tags.length > 0 ? `，标签=${requesterProfile.tags.join("/")}` : ""}）`
      : username
        ? `当前对话玩家记忆：没有关于 ${username} 的额外记忆`
        : "当前对话玩家记忆：无";
    const requesterStrategyText = requesterProfile
      ? requesterProfile.relation === "owner"
        ? `回应策略：对 owner 更直接、更优先，可以更自然地点名回应；若要称呼对方，优先使用“${requesterDisplayName}”。`
        : Array.isArray(requesterProfile.tags) &&
            requesterProfile.tags.some((tag: string) => /trusted|friend|important|熟悉|信任/i.test(String(tag)))
          ? `回应策略：对 trusted/friend 类型的玩家可以更熟络一点，但仍然保持短句；若要称呼对方，优先使用“${requesterDisplayName}”。`
          : `回应策略：对白名单普通玩家保持简短、克制，不要过度热情；若要称呼对方，优先使用“${requesterDisplayName}”。`
      : "回应策略：如果对方没有额外记忆，就保持默认短句和保守语气。";
    const knownPlayersText = playerProfiles.length > 0
      ? `最近记住的玩家：${playerProfiles.map((profile) => `${profile.playerName}${profile.alias ? `->${profile.alias}` : ""}:${profile.relation ?? "unknown"}`).join(", ")}`
      : "最近记住的玩家：无";
    return [
      buildDynamicStateForAi(botId, registry),
      focusText,
      nearbyPlayerText,
      interestingText,
      requesterMemoryText,
      requesterStrategyText,
      knownPlayersText
    ].join("\n");
  } catch {
    return buildDynamicStateForAi(botId, registry);
  }
}

function buildAgentStateSummary(botId: string, registry: BotRegistry): string {
  try {
    const runtime = registry.get(botId);
    const selfState = runtime.getSelfState();
    const nearbyPlayers = runtime.getNearbyPlayers(32)
      .map((p) => `${p.username}:${(p.distance ?? 0).toFixed(1)}`)
      .sort();
    const hostileEntities = runtime
      .getNearbyEntities(16)
      .filter((e) => e.type !== "player")
      .map((e) => ({ name: e.name || e.displayName || e.type, distance: e.distance ?? Number.POSITIVE_INFINITY }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 6)
      .map((e) => `${e.name}:${e.distance.toFixed(1)}`);
    const inventory = runtime.getInventoryState();
    const foodItem = getBestFoodItem(inventory.items);
    const healthText = typeof selfState?.health === "number" && Number.isFinite(selfState.health)
      ? selfState.health.toFixed(1)
      : "unknown";
    const foodText = typeof selfState?.food === "number" && Number.isFinite(selfState.food)
      ? `${selfState.food}/20`
      : "unknown";
    return [
      `activity=${getCurrentActivity(botId)}`,
      `health=${healthText}`,
      `food=${foodText}`,
      `held=${inventory.heldItem?.name ?? "empty"}`,
      `bestFood=${foodItem?.name ?? "none"}`,
      `followActive=${followSessionLifecycle.has(botId)}`,
      `duelActive=${duelSessionLifecycle.has(botId)}`,
      `players=[${nearbyPlayers.join(", ")}]`,
      `entities=[${hostileEntities.join(", ")}]`
    ].join("\n");
  } catch {
    return "activity=idle\nstate=unavailable";
  }
}

function recordAgentEvent(
  botId: string,
  type: string,
  priority: AgentExecutionEvent["priority"],
  payload: Record<string, unknown>
): void {
  const runtime = getAgentHierarchicalRuntime(botId);
  const list = runtime.rawExecutionEvents();
  const shouldKeep =
    priority !== "low" ||
    list.filter((evt) => evt.priority === "low").length < 6;
  if (!shouldKeep) return;

  runtime.blackboard.recordExecutionEvent({
    id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    type,
    priority,
    payload
  });
}

function getStrategicLifecycleEvents(botId: string): AgentExecutionEvent[] {
  const lifecycleTypes = new Set([
    "milestone_advanced",
    "milestone_rewound",
    "milestone_completed",
    "goal_completed",
    "goal_abandoned"
  ]);
  return getAgentHierarchicalRuntime(botId)
    .rawExecutionEvents().filter((event) => lifecycleTypes.has(event.type));
}

function summarizeRecentStrategicLifecycle(botId: string): string {
  const recent = getStrategicLifecycleEvents(botId).slice(-3);
  if (recent.length === 0) return "No recent goal or milestone lifecycle changes.";
  return recent
    .map((event) => {
      const reason = String(event.payload.reason ?? event.payload.detail ?? event.payload.milestone ?? event.payload.goal ?? "").trim();
      return reason ? `${event.type}(${reason})` : event.type;
    })
    .join("; ");
}

function buildAgentExecutionTrace(botId: string): Record<string, unknown> {
  const cfg = getOrCreateAgentConfig(botId);
  const runtimeTask = getActiveAgentTask(botId);
  const strategicGoal = getStrategicGoal(botId);
  const runtime = (() => {
    try {
      return hierarchicalAgents.ensure(botId);
    } catch {
      return null;
    }
  })();
  const runtimeStatus = runtime?.status() ?? null;
  const runtimeSnapshot = runtime?.snapshot() ?? null;
  const recentEvents = getAgentHierarchicalRuntime(botId).snapshot().executionEvents.slice(-8);

  return {
    botId,
    mode: cfg.mode,
    runtimeState: getAgentRuntimeState(botId),
    executorAttached: agentExecutorLifecycle.isAttached(botId),
    activeTask: runtimeTask,
    queuedLegacySteps: getQueuedPlannerSteps(botId).map((step) => ({
      tool: step.tool,
      arguments: step.arguments ?? {},
      speak: step.speak ?? null
    })),
    strategicGoal,
    currentMilestone: getCurrentStrategicMilestone(botId),
    recentStrategicLifecycle: summarizeRecentStrategicLifecycle(botId),
    runtimeStatus,
    runtimeActiveDirective: runtimeSnapshot?.activeDirective ?? null,
    runtimeActiveAction: runtimeSnapshot?.activeAction ?? null,
    runtimeActiveSkill: runtimeSnapshot?.activeSkill ?? null,
    recentEvents
  };
}

export function getAgentExecutionTraceForDebug(botId: string): Record<string, unknown> {
  return buildAgentExecutionTrace(botId);
}

function findStrategicReportTarget(
  config: AgentConfig,
  stateSnapshot: AgentStateSnapshot
): { playerName: string; displayName: string; relation: "owner" | "whitelist" } | null {
  const entities = stateSnapshot.entities;
  const owner = String(stateSnapshot.memorySummary.owner ?? config.owner ?? "").trim();
  const rememberedProfileEntries = stateSnapshot.memorySummary.memory.playerProfiles
    .map((profile) => [String(profile.playerName ?? "").trim(), profile] as const)
    .filter(([playerName]) => playerName.length > 0);
  const rememberedProfiles = new Map(rememberedProfileEntries);

  const nearbyPlayers = entities
    .filter((entity) => entity && entity.category === "player")
    .map((entity) => ({
      playerName: String(entity.name ?? "").trim(),
      relation: String(entity.relation ?? "").trim(),
      distance: Number(entity.distance ?? Number.POSITIVE_INFINITY),
      profile: rememberedProfiles.get(String(entity.name ?? "").trim())
    }))
    .filter((entity) => entity.playerName)
    .map((entity) => {
      const tagsText = Array.isArray(entity.profile?.tags) ? entity.profile.tags.join(" ").toLowerCase() : "";
      const memoryRelation = String(entity.profile?.relation ?? entity.relation).trim();
      const relationBonus =
        entity.playerName === owner || memoryRelation === "owner"
          ? 8
          : memoryRelation === "whitelist"
            ? 4
            : 0;
      const tagBonus = /trusted|friend|important|owner|熟悉|信任/.test(tagsText) ? 2 : 0;
      const recencyBonus =
        typeof entity.profile?.lastSeenAt === "number" && Date.now() - entity.profile.lastSeenAt < 10 * 60_000
          ? 1
          : 0;
      const effectiveRelation: "owner" | "whitelist" =
        entity.playerName === owner || memoryRelation === "owner" ? "owner" : "whitelist";
      return {
        ...entity,
        effectiveRelation,
        reportScore: relationBonus + tagBonus + recencyBonus - entity.distance / 4
      };
    })
    .sort((a, b) => b.reportScore - a.reportScore || a.distance - b.distance);

  const best = nearbyPlayers.find((entity) => Number.isFinite(entity.distance) && entity.distance <= 12);
  if (best) {
    return {
      playerName: best.playerName,
      displayName: String(best.profile?.alias ?? best.playerName).trim() || best.playerName,
      relation: best.effectiveRelation
    };
  }

  return null;
}

function summarizePreferredRememberedPlaces(stateSnapshot: AgentStateSnapshot): string {
  const preferred = stateSnapshot.memorySummary.memory.places
    .map((place) => {
      const tags = Array.isArray(place?.tags) ? place.tags.map(String) : [];
      const joined = `${String(place?.label ?? "")} ${String(place?.notes ?? "")} ${tags.join(" ")}`.toLowerCase();
      const score =
        (/home|base|safe|家|基地|安全/.test(joined) ? 5 : 0) +
        (/mine|mining|矿|resource|资源/.test(joined) ? 3 : 0) +
        (tags.length > 0 ? 1 : 0);
      return {
        label: String(place?.label ?? "").trim(),
        placeId: String(place?.placeId ?? "").trim(),
        score,
        tags
      };
    })
    .filter((place) => place.label && place.score > 0)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, 4);
  if (preferred.length === 0) return "Preferred remembered places: none.";
  return `Preferred remembered places: ${preferred
    .map((place) => `${place.label}${place.tags.length > 0 ? `(${place.tags.join("/")})` : ""}`)
    .join(", ")}.`;
}

function getPendingStrategicLifecycleInstruction(botId: string, config: AgentConfig, stateSnapshot: AgentStateSnapshot): string | null {
  const latest = getStrategicLifecycleEvents(botId).slice(-1)[0];
  if (!latest) return null;
  if (!getAgentHierarchicalRuntime(botId).claimStrategicLifecycleInstruction(latest.id)) return null;

  const strategicGoalState = stateSnapshot.memorySummary.strategicGoal;
  const strategicGoal = String(strategicGoalState?.goal ?? "").trim();
  const currentMilestone =
    Array.isArray(strategicGoalState?.milestones) &&
    typeof strategicGoalState?.currentMilestoneIndex === "number" &&
    strategicGoalState.currentMilestoneIndex >= 0
      ? String(strategicGoalState.milestones[strategicGoalState.currentMilestoneIndex] ?? "").trim()
      : "";
  const reportTarget = findStrategicReportTarget(config, stateSnapshot);

  return [
    "A goal or milestone lifecycle event just happened. Perform one strategic adjustment pass.",
    `Latest lifecycle event: ${latest.type}.`,
    strategicGoal ? `Current strategic goal: ${strategicGoal}.` : "Current strategic goal: none.",
    currentMilestone ? `Current milestone: ${currentMilestone}.` : "Current milestone: none.",
    `Recent lifecycle summary: ${summarizeRecentStrategicLifecycle(botId)}`,
    reportTarget
      ? `Nearby report target: ${reportTarget.playerName}${reportTarget.displayName !== reportTarget.playerName ? ` alias=${reportTarget.displayName}` : ""} (${reportTarget.relation}). Prefer a short spoken report if it makes sense, and use alias if you address them directly.`
      : "Nearby report target: none.",
    `Idle policy preference: ${config.autoIdlePolicy}.`,
    "If a milestone just advanced or completed, prefer the next lightweight useful action for the remaining goal.",
    "If the goal was completed or abandoned, prefer a short spoken report to the nearby owner/whitelist player if one is present; otherwise set a small safe follow-up directive or return no_action.",
    "Do not repeat the same just-finished action unless the new state clearly demands it."
  ].join(" ");
}

async function maybeHandleStrategicLifecycleReport(botId: string, registry: BotRegistry, cfg: AgentConfig): Promise<boolean> {
  const latest = getStrategicLifecycleEvents(botId).slice(-1)[0];
  if (!latest) return false;
  if (latest.type !== "goal_completed" && latest.type !== "goal_abandoned") return false;
  const runtime = getAgentHierarchicalRuntime(botId);
  if (!runtime.canPublishStrategicLifecycleReport(latest.id)) return false;

  try {
    const snapshot = buildAgentStateSnapshot(botId, registry);
    const reportTarget = findStrategicReportTarget(cfg, snapshot);
    if (!reportTarget) return false;

    const displayName = String(reportTarget.displayName ?? reportTarget.playerName).trim() || reportTarget.playerName;
    const text = latest.type === "goal_completed" ? `${displayName}，搞定了。` : `${displayName}，这个先不做了。`;
    await sendRuntimeChat(botId, registry, text);
    runtime.markStrategicLifecycleReportPublished(latest.id);
    recordAgentEvent(botId, "task_progress", "normal", {
      taskType: "speak",
      detail: `strategic_lifecycle_report sent for ${latest.type}`,
      targetPlayer: reportTarget.playerName,
      targetDisplayName: displayName
    });
    return true;
  } catch {
    return false;
  }
}

function maybeRecordInventoryChanged(botId: string, inventory: InventorySnapshot): void {
  const next = summarizeInventorySnapshotForEvent(inventory);
  if (!getAgentHierarchicalRuntime(botId).observeInventorySummary(next.summary)) return;
  recordAgentEvent(botId, "inventory_changed", "normal", {
    summary: next.summary,
    itemCount: next.itemCount
  });
}

function getOrCreateMemoryPlayerProfiles(botId: string): Map<string, AgentMemoryPlayerProfile> {
  return agentGameMemoryStateStore.getPlayerMapSnapshot(botId);
}

function getOrCreateMemoryPlaces(botId: string): Map<string, AgentMemoryPlaceRecord> {
  return agentGameMemoryStateStore.getPlaceMapSnapshot(botId);
}

function getTaskHistory(botId: string): AgentTaskHistoryRecord[] {
  return agentTaskHistoryStore.get(botId);
}

function rememberPlayerProfile(
  botId: string,
  playerName: string,
  patch: Partial<Omit<AgentMemoryPlayerProfile, "playerName" | "updatedAt">>
): AgentMemoryPlayerProfile {
  const normalized = String(playerName ?? "").trim();
  const existing = agentGameMemoryStateStore.getPlayer(botId, normalized);
  const next: AgentMemoryPlayerProfile = {
    playerName: normalized,
    alias: patch.alias?.trim() || existing?.alias,
    relation: patch.relation ?? existing?.relation,
    notes: patch.notes?.trim() || existing?.notes,
    tags: patch.tags ?? existing?.tags ?? [],
    lastSeenAt: patch.lastSeenAt ?? existing?.lastSeenAt,
    updatedAt: Date.now()
  };
  agentGameMemoryStateStore.setPlayer(botId, next);
  queuePersistChatState();
  queuePersistSharedGameMemory();
  return next;
}

function rememberPlace(
  botId: string,
  placeId: string,
  input: Omit<AgentMemoryPlaceRecord, "updatedAt">
): AgentMemoryPlaceRecord {
  const normalizedId = String(placeId ?? "").trim();
  const next: AgentMemoryPlaceRecord = {
    ...input,
    placeId: normalizedId,
    label: String(input.label ?? normalizedId).trim() || normalizedId,
    updatedAt: Date.now()
  };
  agentGameMemoryStateStore.setPlace(botId, next);
  queuePersistChatState();
  queuePersistSharedGameMemory();
  return next;
}

function findNearestRememberedPlace(
  botId: string,
  position: { x: number; y: number; z: number },
  dimension?: string
): AgentMemoryPlaceRecord | null {
  const places = [...getOrCreateMemoryPlaces(botId).values()];
  const filtered = dimension
    ? places.filter((place) => !place.dimension || place.dimension === dimension)
    : places;
  if (filtered.length === 0) return null;

  const scored = filtered
    .map((place) => {
      const dx = place.x - position.x;
      const dy = place.y - position.y;
      const dz = place.z - position.z;
      return {
        place,
        distance: Math.sqrt(dx * dx + dy * dy + dz * dz)
      };
    })
    .sort((a, b) => a.distance - b.distance);

  return scored[0]?.place ?? null;
}

function findPreferredFallbackPlace(
  botId: string,
  position: { x: number; y: number; z: number },
  dimension?: string
): AgentMemoryPlaceRecord | null {
  const places = [...getOrCreateMemoryPlaces(botId).values()];
  const filtered = dimension
    ? places.filter((place) => !place.dimension || place.dimension === dimension)
    : places;
  if (filtered.length === 0) return null;

  const preferred = filtered.filter((place) => {
    const text = `${place.label} ${place.notes ?? ""} ${(place.tags ?? []).join(" ")}`.toLowerCase();
    return /home|base|safe|家|基地|安全/.test(text);
  });

  const pickFrom = preferred.length > 0 ? preferred : filtered;
  const scored = pickFrom
    .map((place) => {
      const dx = place.x - position.x;
      const dy = place.y - position.y;
      const dz = place.z - position.z;
      return {
        place,
        distance: Math.sqrt(dx * dx + dy * dy + dz * dz)
      };
    })
    .sort((a, b) => a.distance - b.distance);

  return scored[0]?.place ?? null;
}

function findConfiguredTerritoryPlaces(botId: string, dimension?: string): AgentMemoryPlaceRecord[] {
  const territory = getOrCreateTerritoryConfig(botId);
  if (!territory.enabled || territory.placeIds.length === 0) return [];
  const places = territory.placeIds
    .map((placeId) => getOrCreateMemoryPlaces(botId).get(placeId))
    .filter((place): place is AgentMemoryPlaceRecord => !!place)
    .filter((place) => !dimension || !place.dimension || place.dimension === dimension);
  if (territory.requiredTags.length === 0) return places;
  return places.filter((place) => {
    const tags = (place.tags ?? []).map((tag) => String(tag).trim().toLowerCase()).filter(Boolean);
    return territory.requiredTags.some((requiredTag) => tags.includes(requiredTag));
  });
}

function isSupportedContainerBlockName(name: string): boolean {
  return name === "chest" || name === "trapped_chest" || name === "barrel" || name.endsWith("shulker_box");
}

type MineflayerBlock = NonNullable<ReturnType<MineflayerBot["blockAt"]>>;

interface ContainerOpenApi {
  openContainer?: (block: MineflayerBlock) => Promise<ContainerInventoryClient>;
  openChest?: (block: MineflayerBlock) => Promise<ContainerInventoryClient>;
}

function positionAt(bot: MineflayerBot, x: number, y: number, z: number) {
  const current = bot.entity.position;
  return current.offset(x - current.x, y - current.y, z - current.z);
}

function findRememberedContainerBlock(
  bot: MineflayerBot,
  place: AgentMemoryPlaceRecord,
  searchRadius = 1.5
): MineflayerBlock | null {
  const center = positionAt(bot, place.x, place.y, place.z);
  const candidates: MineflayerBlock[] = [];
  for (let dx = -2; dx <= 2; dx += 1) {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dz = -2; dz <= 2; dz += 1) {
        const pos = center.offset(dx, dy, dz);
        const block = bot.blockAt(pos);
        if (!block?.name || !isSupportedContainerBlockName(block.name)) continue;
        const distance = block.position.distanceTo(center);
        if (distance > searchRadius) continue;
        candidates.push(block);
      }
    }
  }
  candidates.sort((a, b) => a.position.distanceTo(center) - b.position.distanceTo(center));
  return candidates[0] ?? null;
}

async function inspectRememberedContainer(
  botId: string,
  registry: BotRegistry,
  placeId: string,
  options?: { autoMove?: boolean; stopRadius?: number; searchRadius?: number }
): Promise<Record<string, unknown>> {
  const normalizedPlaceId = String(placeId ?? "").trim();
  const place = getOrCreateMemoryPlaces(botId).get(normalizedPlaceId);
  if (!place) {
    throw new Error(`Remembered place '${normalizedPlaceId}' not found`);
  }

  const bot = registry.get(botId).getActiveBotOrThrow();
  const currentDimension = String(bot.game.dimension ?? "").trim() || undefined;
  if (place.dimension && currentDimension && place.dimension !== currentDimension) {
    throw new Error(
      `Remembered place '${normalizedPlaceId}' is in dimension '${place.dimension}', but bot is currently in '${currentDimension}'`
    );
  }

  const autoMove = options?.autoMove ?? true;
  const stopRadius = options?.stopRadius ?? 2.5;
  const searchRadius = options?.searchRadius ?? 1.5;
  const placePosition = positionAt(bot, place.x, place.y, place.z);

  if (autoMove && bot.entity.position.distanceTo(placePosition) > stopRadius) {
    goToPosition(botId, registry, placePosition, stopRadius);
    await waitUntilNearPosition(bot, placePosition, stopRadius + 0.75, 25_000);
  }

  const block = findRememberedContainerBlock(bot, place, searchRadius);
  if (!block) {
    throw new Error(`No supported container block found near remembered place '${place.label}'`);
  }

  if (autoMove && bot.entity.position.distanceTo(block.position) > 4.5) {
    goToPosition(botId, registry, block.position, 3);
    await waitUntilNearPosition(bot, block.position, 4.5, 15_000);
  }

  const containerApi: ContainerOpenApi = bot;
  const openContainer = typeof containerApi.openContainer === "function"
    ? containerApi.openContainer.bind(bot)
    : typeof containerApi.openChest === "function"
      ? containerApi.openChest.bind(bot)
      : null;
  if (!openContainer) {
    throw new Error("This bot runtime does not support opening container blocks");
  }

  const container = await openContainer(block);
  try {
    await waitMs(200);
    const items = readContainerItems(container).map(serializeInventoryItem);
    return {
      botId,
      place,
      block: serializeBlockSnapshot(block),
      itemStacks: items.length,
      itemSummary: buildInventorySummary(items),
      items
    };
  } finally {
    try {
      if (typeof container.close === "function") {
        container.close();
      }
    } catch {
      // ignore close failure
    }
  }
}

async function openRememberedContainer(
  botId: string,
  registry: BotRegistry,
  placeId: string,
  options?: { autoMove?: boolean; stopRadius?: number; searchRadius?: number }
): Promise<{
  bot: MineflayerBot;
  place: AgentMemoryPlaceRecord;
  block: MineflayerBlock;
  container: ContainerInventoryClient;
}> {
  const normalizedPlaceId = String(placeId ?? "").trim();
  const place = getOrCreateMemoryPlaces(botId).get(normalizedPlaceId);
  if (!place) {
    throw new Error(`Remembered place '${normalizedPlaceId}' not found`);
  }

  const bot = registry.get(botId).getActiveBotOrThrow();
  const currentDimension = String(bot.game.dimension ?? "").trim() || undefined;
  if (place.dimension && currentDimension && place.dimension !== currentDimension) {
    throw new Error(
      `Remembered place '${normalizedPlaceId}' is in dimension '${place.dimension}', but bot is currently in '${currentDimension}'`
    );
  }

  const autoMove = options?.autoMove ?? true;
  const stopRadius = options?.stopRadius ?? 2.5;
  const searchRadius = options?.searchRadius ?? 1.5;
  const placePosition = positionAt(bot, place.x, place.y, place.z);

  if (autoMove && bot.entity.position.distanceTo(placePosition) > stopRadius) {
    goToPosition(botId, registry, placePosition, stopRadius);
    await waitUntilNearPosition(bot, placePosition, stopRadius + 0.75, 25_000);
  }

  const block = findRememberedContainerBlock(bot, place, searchRadius);
  if (!block) {
    throw new Error(`No supported container block found near remembered place '${place.label}'`);
  }

  if (autoMove && bot.entity.position.distanceTo(block.position) > 4.5) {
    goToPosition(botId, registry, block.position, 3);
    await waitUntilNearPosition(bot, block.position, 4.5, 15_000);
  }

  const containerApi: ContainerOpenApi = bot;
  const openContainer = typeof containerApi.openContainer === "function"
    ? containerApi.openContainer.bind(bot)
    : typeof containerApi.openChest === "function"
      ? containerApi.openChest.bind(bot)
      : null;
  if (!openContainer) {
    throw new Error("This bot runtime does not support opening container blocks");
  }

  const container = await openContainer(block);
  return { bot, place, block, container };
}

type ContainerStorageTag = "food" | "fish" | "blocks" | "ores" | "tools" | "combat" | "misc";

function itemMatchesStorageTag(name: string, tag: ContainerStorageTag): boolean {
  const normalized = String(name ?? "").trim().toLowerCase();
  if (!normalized) return false;
  switch (tag) {
    case "food":
      return isFoodItemName(normalized);
    case "fish":
      return /salmon|cod|tropical_fish/.test(normalized);
    case "blocks":
      return /stone|deepslate|dirt|cobblestone|slab|stairs|planks|log|wood|sand|gravel|glass|brick|terracotta/.test(normalized);
    case "ores":
      return /ore|raw_iron|raw_gold|raw_copper|coal|diamond|emerald|lapis|redstone|quartz|ancient_debris/.test(normalized);
    case "tools":
      return /_pickaxe|_axe|_shovel|_hoe|_shears|fishing_rod|flint_and_steel|compass/.test(normalized);
    case "combat":
      return /_sword|bow|crossbow|arrow|trident|shield/.test(normalized);
    case "misc":
      return !itemMatchesStorageTag(normalized, "food") &&
        !itemMatchesStorageTag(normalized, "fish") &&
        !itemMatchesStorageTag(normalized, "blocks") &&
        !itemMatchesStorageTag(normalized, "ores") &&
        !itemMatchesStorageTag(normalized, "tools") &&
        !itemMatchesStorageTag(normalized, "combat");
    default:
      return false;
  }
}

async function depositMatchingItemsIntoRememberedContainer(
  botId: string,
  registry: BotRegistry,
  placeId: string,
  query: string,
  matchMode: "exact" | "includes",
  count?: number,
  options?: { autoMove?: boolean; stopRadius?: number; searchRadius?: number }
): Promise<Record<string, unknown>> {
  const { bot, place, block, container } = await openRememberedContainer(botId, registry, placeId, options);
  try {
    await waitMs(200);
    const matches = matchInventoryItems(bot.inventory.items(), query, matchMode);
    if (matches.length === 0) {
      throw new Error(`No inventory items matched '${query}'`);
    }
    if (typeof container.deposit !== "function") {
      throw new Error("Opened container does not support deposit()");
    }

    let remaining = typeof count === "number" && Number.isFinite(count) ? Math.max(1, Math.floor(count)) : Number.POSITIVE_INFINITY;
    const moved: Array<{ name: string; count: number }> = [];
    for (const item of matches) {
      if (remaining <= 0) break;
      const moveCount = Math.min(Number(item.count ?? 0), remaining);
      if (moveCount <= 0) continue;
      await container.deposit(item.type, item.metadata ?? null, moveCount);
      moved.push({ name: String(item.name), count: moveCount });
      remaining -= moveCount;
      await waitMs(120);
    }

    const actualMoved = moved.reduce((sum, item) => sum + item.count, 0);
    if (actualMoved <= 0) {
      throw new Error(`Failed to deposit any items matching '${query}'`);
    }

    const containerItems = readContainerItems(container).map(serializeInventoryItem);

    return {
      botId,
      place,
      block: serializeBlockSnapshot(block),
      query,
      matchMode,
      requestedCount: typeof count === "number" ? Math.max(1, Math.floor(count)) : null,
      moved,
      movedCount: actualMoved,
      containerItemSummary: buildInventorySummary(containerItems)
    };
  } finally {
    try {
      if (typeof container.close === "function") container.close();
    } catch {
      // ignore
    }
  }
}

async function withdrawMatchingItemsFromRememberedContainer(
  botId: string,
  registry: BotRegistry,
  placeId: string,
  query: string,
  matchMode: "exact" | "includes",
  count?: number,
  options?: { autoMove?: boolean; stopRadius?: number; searchRadius?: number }
): Promise<Record<string, unknown>> {
  const { place, block, container } = await openRememberedContainer(botId, registry, placeId, options);
  try {
    await waitMs(200);
    const containerItems = readContainerItems(container);
    const matches = matchInventoryItems(containerItems, query, matchMode);
    if (matches.length === 0) {
      throw new Error(`No container items matched '${query}'`);
    }
    if (typeof container.withdraw !== "function") {
      throw new Error("Opened container does not support withdraw()");
    }

    let remaining = typeof count === "number" && Number.isFinite(count) ? Math.max(1, Math.floor(count)) : Number.POSITIVE_INFINITY;
    const moved: Array<{ name: string; count: number }> = [];
    for (const item of matches) {
      if (remaining <= 0) break;
      const moveCount = Math.min(Number(item.count ?? 0), remaining);
      if (moveCount <= 0) continue;
      await container.withdraw(item.type, item.metadata ?? null, moveCount);
      moved.push({ name: String(item.name), count: moveCount });
      remaining -= moveCount;
      await waitMs(120);
    }

    const actualMoved = moved.reduce((sum, item) => sum + item.count, 0);
    if (actualMoved <= 0) {
      throw new Error(`Failed to withdraw any items matching '${query}'`);
    }

    const remainingItems = readContainerItems(container).map(serializeInventoryItem);

    return {
      botId,
      place,
      block: serializeBlockSnapshot(block),
      query,
      matchMode,
      requestedCount: typeof count === "number" ? Math.max(1, Math.floor(count)) : null,
      moved,
      movedCount: actualMoved,
      containerItemSummary: buildInventorySummary(remainingItems)
    };
  } finally {
    try {
      if (typeof container.close === "function") container.close();
    } catch {
      // ignore
    }
  }
}

async function depositAllByTagIntoRememberedContainer(
  botId: string,
  registry: BotRegistry,
  placeId: string,
  tag: ContainerStorageTag,
  options?: { autoMove?: boolean; stopRadius?: number; searchRadius?: number }
): Promise<Record<string, unknown>> {
  const { bot, place, block, container } = await openRememberedContainer(botId, registry, placeId, options);
  try {
    await waitMs(200);
    if (typeof container.deposit !== "function") {
      throw new Error("Opened container does not support deposit()");
    }
    const matches = bot.inventory.items().filter((item) => itemMatchesStorageTag(item.name, tag));
    if (matches.length === 0) {
      throw new Error(`No inventory items matched storage tag '${tag}'`);
    }
    const moved: Array<{ name: string; count: number }> = [];
    for (const item of matches) {
      const moveCount = Number(item.count ?? 0);
      if (moveCount <= 0) continue;
      await container.deposit(item.type, item.metadata ?? null, moveCount);
      moved.push({ name: String(item.name), count: moveCount });
      await waitMs(120);
    }
    const actualMoved = moved.reduce((sum, item) => sum + item.count, 0);
    const containerItems = readContainerItems(container).map(serializeInventoryItem);
    return {
      botId,
      place,
      block: serializeBlockSnapshot(block),
      tag,
      moved,
      movedCount: actualMoved,
      containerItemSummary: buildInventorySummary(containerItems)
    };
  } finally {
    try {
      if (typeof container.close === "function") container.close();
    } catch {
      // ignore
    }
  }
}

async function depositAllExceptHotbarIntoRememberedContainer(
  botId: string,
  registry: BotRegistry,
  placeId: string,
  options?: { autoMove?: boolean; stopRadius?: number; searchRadius?: number }
): Promise<Record<string, unknown>> {
  const { bot, place, block, container } = await openRememberedContainer(botId, registry, placeId, options);
  try {
    await waitMs(200);
    if (typeof container.deposit !== "function") {
      throw new Error("Opened container does not support deposit()");
    }
    const matches = bot.inventory
      .items()
      .filter((item) => typeof item.slot === "number" && item.slot >= 9 && item.slot <= 35);
    if (matches.length === 0) {
      throw new Error("No main-inventory items found to deposit");
    }
    const moved: Array<{ name: string; count: number; slot: number }> = [];
    for (const item of matches) {
      const moveCount = Number(item.count ?? 0);
      if (moveCount <= 0) continue;
      await container.deposit(item.type, item.metadata ?? null, moveCount);
      moved.push({ name: String(item.name), count: moveCount, slot: Number(item.slot) });
      await waitMs(120);
    }
    const actualMoved = moved.reduce((sum, item) => sum + item.count, 0);
    const containerItems = readContainerItems(container).map(serializeInventoryItem);
    return {
      botId,
      place,
      block: serializeBlockSnapshot(block),
      moved,
      movedCount: actualMoved,
      scope: "main_inventory_only",
      protectedSlots: "hotbar(36-44), armor(5-8), offhand(45)",
      containerItemSummary: buildInventorySummary(containerItems)
    };
  } finally {
    try {
      if (typeof container.close === "function") container.close();
    } catch {
      // ignore
    }
  }
}

async function withdrawByTagFromRememberedContainer(
  botId: string,
  registry: BotRegistry,
  placeId: string,
  tag: ContainerStorageTag,
  count?: number,
  options?: { autoMove?: boolean; stopRadius?: number; searchRadius?: number }
): Promise<Record<string, unknown>> {
  const { place, block, container } = await openRememberedContainer(botId, registry, placeId, options);
  try {
    await waitMs(200);
    if (typeof container.withdraw !== "function") {
      throw new Error("Opened container does not support withdraw()");
    }
    const containerItems = readContainerItems(container);
    const matches = containerItems.filter((item) => itemMatchesStorageTag(item.name, tag));
    if (matches.length === 0) {
      throw new Error(`No container items matched storage tag '${tag}'`);
    }

    let remaining = typeof count === "number" && Number.isFinite(count) ? Math.max(1, Math.floor(count)) : Number.POSITIVE_INFINITY;
    const moved: Array<{ name: string; count: number }> = [];
    for (const item of matches) {
      if (remaining <= 0) break;
      const moveCount = Math.min(Number(item.count ?? 0), remaining);
      if (moveCount <= 0) continue;
      await container.withdraw(item.type, item.metadata ?? null, moveCount);
      moved.push({ name: String(item.name), count: moveCount });
      remaining -= moveCount;
      await waitMs(120);
    }

    const actualMoved = moved.reduce((sum, item) => sum + item.count, 0);
    if (actualMoved <= 0) {
      throw new Error(`Failed to withdraw any container items matching storage tag '${tag}'`);
    }

    const remainingItems = readContainerItems(container).map(serializeInventoryItem);

    return {
      botId,
      place,
      block: serializeBlockSnapshot(block),
      tag,
      requestedCount: typeof count === "number" ? Math.max(1, Math.floor(count)) : null,
      moved,
      movedCount: actualMoved,
      containerItemSummary: buildInventorySummary(remainingItems)
    };
  } finally {
    try {
      if (typeof container.close === "function") container.close();
    } catch {
      // ignore
    }
  }
}

async function withdrawFoodFromRememberedContainer(
  botId: string,
  registry: BotRegistry,
  placeId: string,
  count: number,
  preferredItemName?: string,
  options?: { autoMove?: boolean; stopRadius?: number; searchRadius?: number }
): Promise<Record<string, unknown>> {
  const { place, block, container } = await openRememberedContainer(botId, registry, placeId, options);
  try {
    await waitMs(200);
    if (typeof container.withdraw !== "function") {
      throw new Error("Opened container does not support withdraw()");
    }
    const containerItems = readContainerItems(container);
    const matched = preferredItemName
      ? matchInventoryItems(containerItems.filter((item) => isFoodItemName(item.name)), preferredItemName, "exact")
      : [];
    const target = matched[0] ?? getBestFoodItem(containerItems.filter((item) => isFoodItemName(item.name)));
    if (!target) {
      throw new Error(preferredItemName ? `Food item '${preferredItemName}' not found in container` : "No food found in container");
    }
    const moveCount = Math.min(Math.max(1, Math.floor(count)), Number(target.count ?? 0));
    await container.withdraw(target.type, target.metadata ?? null, moveCount);
    const remainingItems = readContainerItems(container).map(serializeInventoryItem);
    return {
      botId,
      place,
      block: serializeBlockSnapshot(block),
      foodItem: String(target.name),
      movedCount: moveCount,
      preferredItemName: preferredItemName ?? null,
      containerItemSummary: buildInventorySummary(remainingItems)
    };
  } finally {
    try {
      if (typeof container.close === "function") container.close();
    } catch {
      // ignore
    }
  }
}

async function restockCombatFromRememberedContainer(
  botId: string,
  registry: BotRegistry,
  placeId: string,
  count: number,
  options?: { autoMove?: boolean; stopRadius?: number; searchRadius?: number }
): Promise<Record<string, unknown>> {
  const withdrawn = await withdrawByTagFromRememberedContainer(botId, registry, placeId, "combat", count, options);
  const prepareResult = await runPrepareBattle(botId, registry);
  return {
    ...withdrawn,
    preparedBattle: true,
    prepareResult
  };
}

async function restockFoodFromRememberedContainer(
  botId: string,
  registry: BotRegistry,
  placeId: string,
  count: number,
  preferredItemName?: string,
  options?: { autoMove?: boolean; stopRadius?: number; searchRadius?: number }
): Promise<Record<string, unknown>> {
  const withdrawn = await withdrawFoodFromRememberedContainer(botId, registry, placeId, count, preferredItemName, options);
  const holdResult = await registry.get(botId).holdItemByCategory({ category: "food" }).catch(() => null);
  return {
    ...withdrawn,
    heldFood: holdResult?.ok ? holdResult.detail ?? null : null
  };
}

async function maybeHandleTerritoryWarning(botId: string, registry: BotRegistry): Promise<boolean> {
  const territory = getOrCreateTerritoryConfig(botId);
  if (!territory.enabled || territory.placeIds.length === 0) return false;

  const runtime = registry.get(botId);
  const selfState = runtime.getSelfState();
  if (!selfState) {
    throw new Error(`Bot '${botId}' self state is unavailable`);
  }
  const places = findConfiguredTerritoryPlaces(botId, selfState.dimension);
  if (places.length === 0) return false;

  const whitelist = getUnifiedWhitelist(botId);
  const owner = getOrCreateAgentConfig(botId).owner.trim();
  const now = Date.now();
  const result = territoryRuntime.tick({
    botId,
    now,
    players: runtime.getNearbyPlayers(Number.MAX_SAFE_INTEGER),
    places,
    radius: territory.radius,
    ownerUsername: owner,
    whitelist,
    selfUsername: selfState.username,
    ownerPresencePolicy: territory.ownerPresencePolicy,
    warningCooldownMs: territory.warningCooldownMs,
    escalationEnabled: territory.escalationEnabled,
    escalationDelayMs: territory.escalationDelayMs
  }, {
    onWarning: ({ intruder }) => {
      sendRuntimeChatNoWait(botId, registry, territory.warningMessage);
      recordAgentEvent(botId, "task_progress", "normal", {
        taskType: "territory_warning",
        detail: `warned ${intruder.username} near territory '${intruder.place.label}'`,
        playerName: intruder.username,
        placeId: intruder.place.placeId
      });
    },
    onEscalationHeld: ({ intruder }) => {
      recordAgentEvent(botId, "task_progress", "normal", {
        taskType: "territory_warning",
        detail: `holding escalation for ${intruder.username}; owner not nearby`,
        playerName: intruder.username,
        placeId: intruder.place.placeId
      });
    },
    onEscalation: ({ intruder }) => {
      recordAgentEvent(botId, "task_progress", "high", {
        taskType: "territory_warning",
        detail: `escalating against ${intruder.username} near territory '${intruder.place.label}'`,
        playerName: intruder.username,
        placeId: intruder.place.placeId
      });
      startDuel(botId, registry, "territory_guard", {
        entityId: intruder.entityId,
        name: "player",
        displayName: intruder.username,
        type: "player"
      });
    }
  });

  return result.handled;
}

function recordTaskHistory(botId: string, task: AgentTaskRuntime): void {
  agentTaskHistoryStore.record(botId, {
    id: task.taskId,
    taskType: task.type,
    status: task.status,
    source: task.source,
    goal: task.goal,
    detail: task.detail,
    lastError: task.lastError,
    createdAt: task.createdAt,
    finishedAt: Date.now()
  });
  queuePersistChatState();
}

function updateStrategicGoal(
  botId: string,
  goal: string,
  source: "manual" | "strategic_pass",
  rationale?: string,
  milestones?: string[],
  currentMilestoneIndex?: number
): void {
  const trimmed = goal.trim();
  if (!trimmed) return;
  const existing = getStrategicGoal(botId);
  const normalizedMilestones = Array.isArray(milestones)
    ? milestones.map((x) => x.trim()).filter(Boolean).slice(0, 8)
    : existing?.milestones;
  setStrategicGoal(botId, {
    goal: trimmed,
    rationale: rationale?.trim() || existing?.rationale,
    source,
    milestones: normalizedMilestones && normalizedMilestones.length > 0 ? normalizedMilestones : undefined,
    currentMilestoneIndex:
      normalizedMilestones && normalizedMilestones.length > 0
        ? Math.max(0, Math.min(currentMilestoneIndex ?? existing?.currentMilestoneIndex ?? 0, normalizedMilestones.length - 1))
        : undefined,
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    lastRepairAt: existing?.lastRepairAt,
    lastFailureEventId: existing?.lastFailureEventId,
    failureCount: source === "manual" ? 0 : existing?.failureCount ?? 0
  });
  queuePersistChatState();
}

function parseFollowPlayerGoalText(text: string): string | null {
  const raw = String(text ?? "").trim();
  if (!raw) return null;

  const normalized = raw
    .replace(/[，。！？、,.!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return null;

  const directPatterns = [
    /^(?:follow|start following|keep following)\s+([A-Za-z0-9_]{3,16})$/i,
    /^(?:跟随|跟着|跟上)\s*([A-Za-z0-9_]{3,16})$/
  ];
  for (const pattern of directPatterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) return match[1];
  }

  const tokenMatch = normalized.match(/\b([A-Za-z0-9_]{3,16})\b/g);
  if (!tokenMatch || tokenMatch.length === 0) return null;
  if (!/follow|following|跟随|跟着|跟上/i.test(normalized)) return null;
  return tokenMatch[tokenMatch.length - 1] ?? null;
}

function isMiningGoalText(text: string): boolean {
  const normalized = String(text ?? "").trim();
  if (!normalized) return false;
  return /mine|mining|下矿|挖矿|采矿/i.test(normalized);
}

function isReturnToRememberedPlaceGoalText(text: string): boolean {
  const normalized = String(text ?? "").trim();
  if (!normalized) return false;
  return /go home|return home|go to base|return to base|go safe|return safe|回家|回基地|回安全点|去基地|去安全点/i.test(normalized);
}

function findRememberedPlaceForGoalText(botId: string, text: string): AgentMemoryPlaceRecord | null {
  const normalized = String(text ?? "").trim().toLowerCase();
  if (!normalized) return null;
  const places = [...getOrCreateMemoryPlaces(botId).values()];
  if (places.length === 0) return null;

  const direct = places.find((place) => {
    const haystack = `${place.placeId} ${place.label} ${place.notes ?? ""} ${(place.tags ?? []).join(" ")}`.toLowerCase();
    return haystack.includes(normalized);
  });
  if (direct) return direct;

  if (!isReturnToRememberedPlaceGoalText(normalized)) return null;

  const preferred = places
    .map((place) => {
      const joined = `${place.label} ${place.notes ?? ""} ${(place.tags ?? []).join(" ")}`.toLowerCase();
      const score =
        (/home|base|safe|家|基地|安全/.test(joined) ? 5 : 0) +
        (/mine|mining|矿|resource|资源/.test(joined) ? 1 : 0);
      return { place, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.place.updatedAt - a.place.updatedAt);
  return preferred[0]?.place ?? null;
}

function getStrategicGoalActivationKind(botId: string): "follow" | "mine" | "place" | null {
  const goal = getStrategicGoal(botId);
  if (!goal) return null;
  const milestone = getCurrentStrategicMilestone(botId) ?? "";
  const combined = `${milestone} ${goal.goal}`.trim();
  if (parseFollowPlayerGoalText(combined) || parseFollowPlayerGoalText(goal.goal)) {
    return "follow";
  }
  if (isMiningGoalText(combined)) {
    return "mine";
  }
  if (findRememberedPlaceForGoalText(botId, combined) || findRememberedPlaceForGoalText(botId, goal.goal)) {
    return "place";
  }
  return null;
}

function maybeOverrideCurrentTaskForManualGoal(botId: string, registry: BotRegistry): boolean {
  const nextKind = getStrategicGoalActivationKind(botId);
  if (!nextKind) return false;

  const activeTask = getActiveAgentTask(botId);
  if (!activeTask) return false;

  if (nextKind === "mine" && activeTask.type === "follow_player") {
    stopFollowLoop(botId, registry, "cancelled", "manual goal override: switch from follow to mining");
    recordAgentEvent(botId, "task_cancelled", "normal", {
      taskType: "follow_player",
      detail: "manual goal override for mining"
    });
    return true;
  }

  if (nextKind === "follow" && activeTask.type === "follow_player") {
    const targetPlayer = parseFollowPlayerGoalText(getCurrentStrategicMilestone(botId) ?? "") ?? parseFollowPlayerGoalText(getStrategicGoal(botId)?.goal ?? "");
    const currentPlayer = String(activeTask.params.playerName ?? "").trim();
    if (targetPlayer && currentPlayer && targetPlayer !== currentPlayer) {
      stopFollowLoop(botId, registry, "cancelled", `manual goal override: switch follow target to ${targetPlayer}`);
      recordAgentEvent(botId, "task_cancelled", "normal", {
        taskType: "follow_player",
        detail: `manual goal override from ${currentPlayer} to ${targetPlayer}`
      });
      return true;
    }
  }

  return false;
}

async function runMineVisibleNearPlayer(
  botId: string,
  registry: BotRegistry,
  playerName: string,
  options?: { announceStart?: boolean; announceFinish?: boolean }
): Promise<string> {
  const bot = registry.get(botId).getActiveBotOrThrow();
  const targetPlayer = bot.players[playerName]?.entity;
  if (!targetPlayer) {
    throw new Error(`Player '${playerName}' is not visible nearby`);
  }

  const mineCenter = targetPlayer.position.clone();
  const mineCenterRadius = 32;
  stopFollowLoop(botId, registry);
  if (options?.announceStart) {
    await sendRuntimeChat(botId, registry, `收到，我去清理 ${playerName} 附近可见矿。`);
  }

  const result = await queueMiningTask(botId, async () => {
    const uniqueNames = DEFAULT_MINING_TARGET_BLOCKS.filter((n) => !!bot.registry.blocksByName[n]);
    if (uniqueNames.length === 0) {
      return { minedCount: 0, stopReason: "no_known_ore_blocks" };
    }

    let minedCount = 0;
    let stopReason = "reached_max_blocks";
    const maxBlocks = 48;
    const searchRadius = 64;
    const reachDistance = 4.5;
    const visibleStep = 0.2;
    const approachTimeoutMs = 20_000;

    for (let i = 0; i < maxBlocks; i += 1) {
      const picked = findNearestVisibleBlockFromNames(
        bot,
        uniqueNames,
        searchRadius,
        visibleStep,
        196,
        mineCenter,
        mineCenterRadius
      );
      if (!picked) {
        stopReason = "no_visible_target";
        break;
      }
      let distance = bot.entity.position.distanceTo(picked.block.position);
      if (distance > reachDistance) {
        const pathSet = setPathfinderGoalNear(botId, bot, picked.block.position, Math.max(1, reachDistance - 1), "mining");
        if (!pathSet) {
          stopReason = "pathfinder_unavailable";
          break;
        }
        const arrived = await waitUntilNearPosition(bot, picked.block.position, reachDistance, approachTimeoutMs);
        const pathApi = bot.pathfinder;
        if (pathApi && typeof pathApi.setGoal === "function") {
          pathApi.setGoal(null);
        }
        movementIntentStore.delete(botId);
        if (!arrived) {
          stopReason = "approach_timeout";
          break;
        }
        distance = bot.entity.position.distanceTo(picked.block.position);
      }

      const latest = bot.blockAt(picked.block.position);
      if (!latest || latest.type === 0) continue;
      if (!canSeeNativeBlock(bot, latest, visibleStep)) continue;
      if (typeof bot.canDigBlock === "function" && !bot.canDigBlock(latest)) continue;

      await equipBestNativeToolForBlock(bot, latest);
      await bot.lookAt(latest.position.offset(0.5, 0.5, 0.5), true);
      await bot.dig(latest, true);
      minedCount += 1;
    }

    return { minedCount, stopReason };
  });

  const playerNow = bot.players[playerName]?.entity;
  if (playerNow) {
    const pathSet = setPathfinderGoalNear(botId, bot, playerNow.position, 2);
    if (pathSet) {
      await waitUntilNearPosition(bot, playerNow.position, 3, 25_000);
      const pathApi = bot.pathfinder;
      if (pathApi && typeof pathApi.setGoal === "function") {
        pathApi.setGoal(null);
      }
      movementIntentStore.delete(botId);
    }
  }

  if (options?.announceFinish) {
    await sendRuntimeChat(botId, registry, "搞定！");
  }
  return `mined_visible_near_player player=${playerName} minedCount=${result.minedCount} stopReason=${result.stopReason}`;
}

async function maybeActivateStrategicGoal(botId: string, registry: BotRegistry): Promise<boolean> {
  const cfg = getOrCreateAgentConfig(botId);
  if (cfg.mode !== "auto") return false;
  if (isBotBusy(botId)) return false;
  if (getQueuedPlannerSteps(botId).length > 0) return false;
  if (getActiveAgentTask(botId)) return false;

  const goal = getStrategicGoal(botId);
  if (!goal) return false;

  const activationText = getCurrentStrategicMilestone(botId) ?? goal.goal;
  const playerName = parseFollowPlayerGoalText(activationText) ?? parseFollowPlayerGoalText(goal.goal);
  if (playerName) {
    try {
      const target = registry.get(botId).getPlayerSnapshot(playerName);
      if (target?.position) {
        startFollow(
          botId,
          registry,
          {
            playerName,
            minDistance: 2.5,
            maxDistance: 32,
            sprint: true,
            tickMs: 250,
            targetStillStopMs: 16000
          },
          "runtime"
        );
        recordAgentEvent(botId, "task_progress", "normal", {
          taskType: "follow_player",
          detail: `goal_activation_rule triggered follow for ${playerName}`,
          goal: goal.goal,
          milestone: getCurrentStrategicMilestone(botId)
        });
        return true;
      }
    } catch {
      // continue to other high-certainty activation rules
    }
  }

  const goalText = `${getCurrentStrategicMilestone(botId) ?? ""} ${goal.goal}`.trim();
  if (isMiningGoalText(goalText)) {
    const stateSnapshot = buildAgentStateSnapshot(botId, registry);
    const nearbyTrusted = findStrategicReportTarget(cfg, stateSnapshot);
    if (nearbyTrusted) {
      try {
        await runMineVisibleNearPlayer(botId, registry, nearbyTrusted.playerName, {
          announceStart: false,
          announceFinish: false
        });
        recordAgentEvent(botId, "task_progress", "normal", {
          taskType: "mine_collect_visible",
          detail: `goal_activation_rule triggered mining near ${nearbyTrusted.playerName}`,
          goal: goal.goal,
          milestone: getCurrentStrategicMilestone(botId)
        });
        return true;
      } catch {
        // continue to place activation rules
      }
    }
  }

  const place = findRememberedPlaceForGoalText(botId, goalText) ?? findRememberedPlaceForGoalText(botId, goal.goal);
  if (!place) return false;

  try {
    const location = requireSelfLocation(registry.get(botId).getSelfState(), botId);
    if (!isDimensionCompatible(place.dimension, location.dimension)) {
      return false;
    }
    goToPosition(botId, registry, { x: place.x, y: place.y, z: place.z }, 2.5);
    recordAgentEvent(botId, "task_progress", "normal", {
      taskType: "move_to_position",
      detail: `goal_activation_rule triggered remembered place move to ${place.label}`,
      goal: goal.goal,
      milestone: getCurrentStrategicMilestone(botId),
      placeId: place.placeId
    });
    return true;
  } catch {
    return false;
  }
}

function maybeMarkStrategicGoalFailure(botId: string, registry: BotRegistry, eventId: string): boolean {
  const goal = getStrategicGoal(botId);
  if (!goal) return false;
  if (goal.lastFailureEventId === eventId) return false;
  goal.lastFailureEventId = eventId;
  goal.lastRepairAt = Date.now();
  goal.updatedAt = Date.now();
  goal.failureCount = (goal.failureCount ?? 0) + 1;
  setStrategicGoal(botId, goal);
  queuePersistChatState();
  if ((goal.failureCount ?? 0) >= 5) {
    abandonStrategicGoal(botId, registry, "too_many_failures");
  }
  return true;
}

function getCurrentStrategicMilestone(botId: string): string | null {
  const goal = getStrategicGoal(botId);
  if (!goal?.milestones?.length) return null;
  const index = Math.max(0, Math.min(goal.currentMilestoneIndex ?? 0, goal.milestones.length - 1));
  return goal.milestones[index] ?? null;
}

function completeStrategicGoal(
  botId: string,
  registry: BotRegistry,
  reason: string
): { completed: boolean; completedGoal: AgentStrategicGoal | null } {
  const goal = getStrategicGoal(botId);
  if (!goal) return { completed: false, completedGoal: null };
  recordAgentEvent(botId, "goal_completed", "normal", {
    goal: goal.goal,
    currentMilestone: getCurrentStrategicMilestone(botId),
    reason
  });
  publishHierarchicalGoalLifecycle(botId, registry, "goal_completed", {
    goal: goal.goal,
    currentMilestone: getCurrentStrategicMilestone(botId),
    reason
  });
  setStrategicGoal(botId, null);
  queuePersistChatState();
  return { completed: true, completedGoal: goal };
}

function abandonStrategicGoal(
  botId: string,
  registry: BotRegistry,
  reason: string
): { abandoned: boolean; abandonedGoal: AgentStrategicGoal | null } {
  const goal = getStrategicGoal(botId);
  if (!goal) return { abandoned: false, abandonedGoal: null };
  recordAgentEvent(botId, "goal_abandoned", "high", {
    goal: goal.goal,
    currentMilestone: getCurrentStrategicMilestone(botId),
    failureCount: goal.failureCount ?? 0,
    reason
  });
  publishHierarchicalGoalLifecycle(botId, registry, "goal_abandoned", {
    goal: goal.goal,
    currentMilestone: getCurrentStrategicMilestone(botId),
    failureCount: goal.failureCount ?? 0,
    reason
  }, "high");
  setStrategicGoal(botId, null);
  queuePersistChatState();
  return { abandoned: true, abandonedGoal: goal };
}

function advanceStrategicMilestone(
  botId: string,
  registry: BotRegistry,
  reason: string
): { advanced: boolean; completed: boolean; currentMilestone: string | null; strategicGoal: AgentStrategicGoal | null } {
  const goal = getStrategicGoal(botId);
  if (!goal?.milestones?.length) {
    return { advanced: false, completed: false, currentMilestone: null, strategicGoal: goal ?? null };
  }
  const currentIndex = Math.max(0, Math.min(goal.currentMilestoneIndex ?? 0, goal.milestones.length - 1));
  if (currentIndex >= goal.milestones.length - 1) {
    goal.currentMilestoneIndex = goal.milestones.length - 1;
    goal.updatedAt = Date.now();
    setStrategicGoal(botId, goal);
    queuePersistChatState();
    recordAgentEvent(botId, "milestone_completed", "normal", {
      goal: goal.goal,
      milestone: goal.milestones[currentIndex],
      reason
    });
    publishHierarchicalGoalLifecycle(botId, registry, "milestone_completed", {
      goal: goal.goal,
      milestone: goal.milestones[currentIndex],
      milestoneIndex: currentIndex,
      reason
    });
    completeStrategicGoal(botId, registry, `milestone_completed:${String(goal.milestones[currentIndex] ?? "final")}`);
    return { advanced: false, completed: true, currentMilestone: goal.milestones[currentIndex] ?? null, strategicGoal: null };
  }
  goal.currentMilestoneIndex = currentIndex + 1;
  goal.updatedAt = Date.now();
  goal.failureCount = 0;
  setStrategicGoal(botId, goal);
  queuePersistChatState();
  recordAgentEvent(botId, "milestone_advanced", "normal", {
    goal: goal.goal,
    fromIndex: currentIndex,
    toIndex: goal.currentMilestoneIndex,
    reason
  });
  publishHierarchicalGoalLifecycle(botId, registry, "milestone_advanced", {
    goal: goal.goal,
    fromIndex: currentIndex,
    toIndex: goal.currentMilestoneIndex,
    currentMilestone: goal.milestones[goal.currentMilestoneIndex] ?? null,
    reason
  });
  return {
    advanced: true,
    completed: false,
    currentMilestone: goal.milestones[goal.currentMilestoneIndex] ?? null,
    strategicGoal: goal
  };
}

function rewindStrategicMilestone(
  botId: string,
  registry: BotRegistry,
  reason: string
): { rewound: boolean; currentMilestone: string | null; strategicGoal: AgentStrategicGoal | null } {
  const goal = getStrategicGoal(botId);
  if (!goal?.milestones?.length) {
    return { rewound: false, currentMilestone: null, strategicGoal: goal ?? null };
  }
  const currentIndex = Math.max(0, Math.min(goal.currentMilestoneIndex ?? 0, goal.milestones.length - 1));
  if (currentIndex === 0) {
    return { rewound: false, currentMilestone: goal.milestones[0] ?? null, strategicGoal: goal };
  }
  goal.currentMilestoneIndex = currentIndex - 1;
  goal.updatedAt = Date.now();
  setStrategicGoal(botId, goal);
  queuePersistChatState();
  recordAgentEvent(botId, "milestone_rewound", "normal", {
    goal: goal.goal,
    fromIndex: currentIndex,
    toIndex: goal.currentMilestoneIndex,
    reason
  });
  publishHierarchicalGoalLifecycle(botId, registry, "milestone_rewound", {
    goal: goal.goal,
    fromIndex: currentIndex,
    toIndex: goal.currentMilestoneIndex,
    currentMilestone: goal.milestones[goal.currentMilestoneIndex] ?? null,
    reason
  });
  return {
    rewound: true,
    currentMilestone: goal.milestones[goal.currentMilestoneIndex] ?? null,
    strategicGoal: goal
  };
}

function maybeAdvanceStrategicMilestoneFromTask(
  botId: string,
  registry: BotRegistry,
  taskType: string,
  detail: string,
  payload?: Record<string, unknown>
): void {
  const goal = getStrategicGoal(botId);
  if (!goal?.milestones?.length) return;
  const milestone = getCurrentStrategicMilestone(botId);
  if (!milestone) return;

  const milestoneText = String(milestone).toLowerCase();
  const detailText = String(detail ?? "").toLowerCase();
  const minedCount = Math.max(0, Number(payload?.minedCount ?? 0));
  const matches =
    ((taskType === "mine_collect_visible" || taskType === "mine_dig_visible") &&
      /mine|挖|采|矿/.test(milestoneText) &&
      (minedCount > 0 || /mined\s+[1-9]|dug\s+|挖/.test(detailText))) ||
    ((taskType === "duel" || taskType === "attack_target") &&
      /duel|attack|挑战|战斗|打/.test(milestoneText) &&
      (/defeated|killed|就这|击败|打败/.test(detailText) || /duel|attack|挑战|战斗|打/.test(detailText))) ||
    ((taskType === "move_to_position" || taskType === "pathfind_move") &&
      /move|go|arrive|前往|移动|到达|过去|回家|回基地|安全点|base|home|safe/.test(milestoneText) &&
      /arrived at destination|socialized with|arrived|到达|抵达|回到/.test(detailText));

  if (!matches) return;
  advanceStrategicMilestone(botId, registry, `task_finished:${taskType}`);
}

function maybeAdvanceFollowStartMilestone(botId: string, registry: BotRegistry, playerName: string): void {
  const milestone = getCurrentStrategicMilestone(botId);
  if (!milestone) return;
  const milestoneText = String(milestone).toLowerCase();
  const playerText = String(playerName ?? "").trim().toLowerCase();
  const mentionsPlayer = !playerText || milestoneText.includes(playerText);
  const isFollowStart =
    /start follow|start following|begin follow|follow|开始跟随|开始跟着|先跟随|先跟着/.test(milestoneText) &&
    !/maintain|继续|保持|一直/.test(milestoneText);
  if (!isFollowStart || !mentionsPlayer) return;
  advanceStrategicMilestone(botId, registry, `task_started:follow_player:${playerName}`);
}

function buildAgentRiskForTask(task: AgentTaskRuntime | null): { level: string; reasons: string[] } {
  if (!task) {
    return { level: "low", reasons: [] };
  }
  switch (task.type) {
    case "duel":
    case "retaliation":
      return { level: "moderate", reasons: ["combat"] };
    case "mine_collect_visible":
    case "mine_dig_visible":
      return { level: "low", reasons: ["mining"] };
    default:
      return { level: "low", reasons: [] };
  }
}

function buildAgentSubTask(task: AgentTaskRuntime | null): Record<string, unknown> | null {
  if (!task) return null;
  switch (task.type) {
    case "follow_player":
      return {
        type: "move_follow",
        status: task.status,
        detail: task.detail || `maintaining distance to ${String(task.params.playerName ?? "target")}`
      };
    case "duel":
      return {
        type: "combat",
        status: task.status,
        detail: task.detail || `attacking ${String(task.params.targetName ?? "target")}`
      };
    case "mine_collect_visible":
    case "mine_dig_visible":
      return {
        type: "mining",
        status: task.status,
        detail: task.detail || String(task.goal)
      };
    case "move_to_position":
    case "pathfind_move":
      return {
        type: "pathfinding",
        status: task.status,
        detail: task.detail || String(task.goal)
      };
    default:
      return {
        type: task.type,
        status: task.status,
        detail: task.detail || String(task.goal)
      };
  }
}

function startAgentTask(
  botId: string,
  task: Omit<AgentTaskRuntime, "taskId" | "status" | "createdAt" | "updatedAt">
): AgentTaskRuntime {
  const existing = getActiveAgentTask(botId);
  if (existing) {
    recordAgentEvent(botId, "task_cancelled", "normal", {
      taskId: existing.taskId,
      taskType: existing.type,
      goal: existing.goal,
      reason: "replaced_by_new_task"
    });
  }

  const runtime: AgentTaskRuntime = {
    taskId: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status: "running",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...task
  };
  setActiveAgentTask(botId, runtime);
  recordAgentEvent(botId, "task_started", "normal", {
    taskId: runtime.taskId,
    taskType: runtime.type,
    source: runtime.source,
    goal: runtime.goal,
    params: runtime.params
  });
  try {
    scheduleHierarchicalTaskTimer(botId, runtime.type);
  } catch {
    // ignore bridge scheduling failures
  }
  return runtime;
}

function updateAgentTask(botId: string, patch: Partial<Pick<AgentTaskRuntime, "detail" | "params" | "goal">>): void {
  const existing = getActiveAgentTask(botId);
  if (!existing) return;
  const next: AgentTaskRuntime = {
    ...existing,
    ...patch,
    params: patch.params ? { ...existing.params, ...patch.params } : existing.params,
    updatedAt: Date.now()
  };
  setActiveAgentTask(botId, next);
  if (typeof patch.detail === "string" && patch.detail.trim()) {
    const now = Date.now();
    const runtime = getAgentHierarchicalRuntime(botId);
    if (runtime.canPublishTaskProgress(next.taskId, patch.detail, now, 1_200)) {
      recordAgentEvent(botId, "task_progress", "normal", {
        taskId: next.taskId,
        taskType: next.type,
        detail: patch.detail
      });
      runtime.markTaskProgressPublished(next.taskId, patch.detail, now);
    }
  }
}

function finalizeAgentTask(
  botId: string,
  status: Exclude<AgentTaskStatus, "running">,
  options?: {
    ifType?: string | string[];
    detail?: string;
    lastError?: string;
    priority?: AgentExecutionEvent["priority"];
    payload?: Record<string, unknown>;
  }
): void {
  const existing = getActiveAgentTask(botId);
  if (!existing) return;

  const ifTypes = options?.ifType ? (Array.isArray(options.ifType) ? options.ifType : [options.ifType]) : null;
  if (ifTypes && !ifTypes.includes(existing.type)) return;

  const finalTask: AgentTaskRuntime = {
    ...existing,
    status,
    updatedAt: Date.now(),
    detail: options?.detail ?? existing.detail,
    lastError: options?.lastError ?? existing.lastError
  };
  const eventType =
    status === "finished" ? "task_finished" : status === "failed" ? "task_failed" : "task_cancelled";
  recordAgentEvent(botId, eventType, options?.priority ?? "normal", {
    taskId: finalTask.taskId,
    taskType: finalTask.type,
    source: finalTask.source,
    goal: finalTask.goal,
    detail: finalTask.detail ?? "",
    lastError: finalTask.lastError ?? "",
    ...options?.payload
  });
  recordTaskHistory(botId, finalTask);
  clearHierarchicalTaskTimer(botId);
  setActiveAgentTask(botId, null);
  getAgentHierarchicalRuntime(botId).clearTaskProgress();
}

function classifyAgentChatEvent(
  botId: string,
  username: string,
  message: string,
  chatConfig: ChatListenerConfig,
  aiConfig: ChatAiConfig
): { type: string; priority: AgentExecutionEvent["priority"] } {
  const unifiedWhitelist = getUnifiedWhitelist(botId);
  const wakeNames = [...chatConfig.wakeNames, aiConfig.wakeWord].filter(Boolean);
  const hasWake = wakeNames.some((w) => message.includes(w));
  const isTrusted = unifiedWhitelist.has(username);

  if (hasWake) {
    return { type: "wake_command", priority: isTrusted ? "high" : "normal" };
  }
  if (isTrusted) {
    return { type: "whitelist_chat", priority: "normal" };
  }
  return { type: "irrelevant_chat", priority: "low" };
}

function getAgentTaskContext(botId: string): Record<string, unknown> {
  const runtimeTask = getActiveAgentTask(botId);
  if (runtimeTask) {
    return {
      activeTask: {
        type: runtimeTask.type,
        status: runtimeTask.status,
        source: runtimeTask.source,
        goal: runtimeTask.goal,
        params: runtimeTask.params,
        createdAt: new Date(runtimeTask.createdAt).toISOString(),
        updatedAt: new Date(runtimeTask.updatedAt).toISOString(),
        detail: runtimeTask.detail ?? "",
        lastError: runtimeTask.lastError ?? ""
      },
      subTask: buildAgentSubTask(runtimeTask),
      risk: buildAgentRiskForTask(runtimeTask)
    };
  }

  const follow = followSessionLifecycle.get(botId);
  if (follow) {
    return {
      activeTask: {
        type: "follow_player",
        status: "running",
        source: "manual_command",
        goal: `follow ${follow.options.playerName}`,
        params: follow.options,
        createdAt: new Date(follow.startedAt).toISOString(),
        updatedAt: new Date().toISOString()
      },
      subTask: {
        type: "move_follow",
        status: "running",
        detail: `maintaining distance to ${follow.options.playerName}`
      },
      risk: {
        level: "low",
        reasons: []
      }
    };
  }

  const duel = duelSessionLifecycle.get(botId);
  if (duel) {
    return {
      activeTask: {
        type: "duel",
        status: "running",
        source: "manual_command",
        goal: `duel ${duel.targetName}`,
        params: {
          targetId: duel.targetId,
          targetName: duel.targetName,
          requester: duel.requester
        },
        createdAt: new Date(duel.startedAt).toISOString(),
        updatedAt: new Date().toISOString()
      },
      subTask: {
        type: "combat",
        status: "running",
        detail: `attacking ${duel.targetName}`
      },
      risk: {
        level: "moderate",
        reasons: ["combat"]
      }
    };
  }

  const pathGoal = movementIntentStore.get(botId);
  if (pathGoal) {
    return {
      activeTask: {
        type: "pathfind_move",
        status: "running",
        source: "runtime",
        goal: "move to cached pathfinder goal",
        params: {
          goalKey: pathGoal
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      subTask: {
        type: "pathfinding",
        status: "running",
        detail: pathGoal
      },
      risk: {
        level: "low",
        reasons: []
      }
    };
  }

  return {
    activeTask: null,
    subTask: null,
    risk: {
      level: "low",
      reasons: []
    }
  };
}

function buildAgentStateSnapshot(botId: string, registry: BotRegistry) {
  const cfg = getOrCreateAgentConfig(botId);
  const runtime = registry.get(botId);
  const bot = runtime.getActiveBotOrThrow();
  const self = runtime.getSelfState();
  if (!self) {
    throw new Error(`Bot '${botId}' self state is unavailable; cannot build agent state snapshot`);
  }
  const selfGuard = getOrCreateSelfGuardConfig(botId);
  const health = self.health;
  const food = self.food;
  const velocity = self.velocity;
  const blockObservation = runtime.getBlockObservation(4);
  const focusPerception = buildFocusPerception(bot, 6);
  const salientPerception = buildSalientPerception(botId, registry, bot, 12);
  const visibleBlocks = DEFAULT_MINING_TARGET_BLOCKS.flatMap((name) =>
    findVisibleBlocksByName(bot, name, 16, 2, 0.2, 48).map((x) => ({
      name,
      position: {
        x: x.block.position.x,
        y: x.block.position.y,
        z: x.block.position.z
      },
      distance: Number(x.distance.toFixed(2)),
      visible: true,
      interactable: false,
      hazardNear: false
    }))
  )
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 12);

  const relationForPlayer = (username: string): "owner" | "whitelist" | "neutral" => {
    const unified = getUnifiedWhitelist(botId);
    if (cfg.owner && username === cfg.owner) return "owner";
    if (cfg.whitelist.has(username) || unified.has(username)) return "whitelist";
    return "neutral";
  };

  const classifyEntity = (
    entity: {
      type?: string;
      name?: string;
      displayName?: string | null;
      kind?: string | null;
      distance?: number;
    }
  ): {
    category: "hostile_mob" | "passive_mob" | "utility_object" | "projectile" | "water_mob" | "unknown";
    relation: "hostile" | "neutral" | "passive" | "utility" | "unknown";
    threatLevel: 0 | 1 | 2 | 3;
  } => {
    const distance = entity.distance ?? Number.POSITIVE_INFINITY;
    const joined = `${entity.type ?? ""} ${entity.name ?? ""} ${entity.displayName ?? ""} ${entity.kind ?? ""}`.toLowerCase();
    const byDistance = (near: 0 | 1 | 2 | 3, mid: 0 | 1 | 2 | 3, far: 0 | 1 | 2 | 3): 0 | 1 | 2 | 3 => {
      if (distance <= 6) return near;
      if (distance <= 16) return mid;
      return far;
    };

    if (joined.includes("item_frame") || joined.includes("boat") || joined.includes("minecart")) {
      return { category: "utility_object", relation: "utility", threatLevel: 0 };
    }
    if (entity.type === "object" || entity.type === "other") {
      if (joined.includes("arrow") || joined.includes("trident") || joined.includes("fireball")) {
        return { category: "projectile", relation: "hostile", threatLevel: byDistance(3, 2, 1) };
      }
      return { category: "utility_object", relation: "unknown", threatLevel: 0 };
    }
    if (entity.type === "projectile") {
      return { category: "projectile", relation: "hostile", threatLevel: byDistance(3, 2, 1) };
    }
    if (joined.includes("warden")) {
      return { category: "hostile_mob", relation: "hostile", threatLevel: byDistance(3, 3, 2) };
    }
    if (joined.includes("creeper") || joined.includes("pillager") || joined.includes("blaze")) {
      return { category: "hostile_mob", relation: "hostile", threatLevel: byDistance(3, 2, 2) };
    }
    if (joined.includes("zombie") || joined.includes("skeleton") || joined.includes("enderman") || joined.includes("spider") || joined.includes("witch") || joined.includes("slime")) {
      return { category: "hostile_mob", relation: "hostile", threatLevel: byDistance(3, 2, 1) };
    }
    if (joined.includes("wolf")) {
      return { category: "passive_mob", relation: "neutral", threatLevel: 0 };
    }
    if (joined.includes("cod") || joined.includes("salmon") || joined.includes("tropical_fish") || joined.includes("squid")) {
      return { category: "water_mob", relation: "passive", threatLevel: 0 };
    }
    if (joined.includes("cow") || joined.includes("sheep") || joined.includes("pig") || joined.includes("chicken") || joined.includes("rabbit") || joined.includes("horse")) {
      return { category: "passive_mob", relation: "passive", threatLevel: 0 };
    }
    return { category: "unknown", relation: "neutral", threatLevel: 0 };
  };

  const players = runtime
    .getNearbyPlayers(32)
    .filter((player) => player.username !== self.username)
    .map((player, index) => ({
      entityId: player.entityId,
      category: "player",
      type: "player",
      name: player.username,
      distance: player.distance ?? null,
      position: player.position ?? null,
      relation: relationForPlayer(player.username),
      threatLevel: 0,
      isVisible: true,
      dedupeKey: player.entityId ?? player.uuid ?? `${player.username}:${player.distance ?? "unknown"}:${index}`
    }));

  const entities = runtime
    .getNearbyEntities(24)
    .filter((entity) => entity.type !== "player")
    .map((entity, index) => {
      const classification = classifyEntity(entity);
      return {
        entityId: entity.entityId,
        category: classification.category,
        type: entity.type ?? "unknown",
        name: entity.name || entity.type || "unknown",
        displayName: entity.displayName ?? null,
        distance: entity.distance ?? null,
        position: entity.position ?? null,
        relation: classification.relation,
        threatLevel: classification.threatLevel,
        isVisible: true,
        dedupeKey: entity.entityId ?? `${entity.type ?? "unknown"}:${entity.name ?? "unknown"}:${entity.distance ?? "unknown"}:${index}`
      };
    })
    .filter((entity, index, values) => values.findIndex((candidate) => candidate.dedupeKey === entity.dedupeKey) === index)
    .sort((a, b) => (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY))
    .slice(0, 12);

  const inventory = runtime.getInventoryState(true);
  const inventoryItems = inventory.items;
  const foodItem = getBestFoodItem(inventoryItems);
  const playerProfiles = [...getOrCreateMemoryPlayerProfiles(botId).values()]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 8);
  const placeRecords = [...getOrCreateMemoryPlaces(botId).values()]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 8);
  const taskHistory = [...getTaskHistory(botId)].slice(-8);

  return {
    botId,
    timestamp: new Date().toISOString(),
    mode: cfg.mode,
    runtimeState:
      selfGuard.enabled && typeof health === "number" && health <= selfGuard.criticalHealth
        ? "guarded"
        : !!getActiveAgentTask(botId) || movementIntentStore.has(botId) || followSessionLifecycle.has(botId) || duelSessionLifecycle.has(botId)
          ? "task_running"
          : getAgentRuntimeState(botId),
    selfState: {
      position: {
        x: self.position?.x ?? null,
        y: self.position?.y ?? null,
        z: self.position?.z ?? null
      },
      rotation: {
        yaw: self.yaw ?? null,
        pitch: self.pitch ?? null
      },
      movement: {
        onGround: self.onGround ?? null,
        velocity: {
          x: velocity?.x ?? null,
          y: velocity?.y ?? null,
          z: velocity?.z ?? null
        },
        isMoving: Math.abs(velocity?.x ?? 0) > 0.01 || Math.abs(velocity?.z ?? 0) > 0.01,
        isFollowing: followSessionLifecycle.has(botId),
        isPathfinding: Boolean(bot.pathfinder?.goal) || movementIntentStore.has(botId)
      },
      vitals: {
        health: health ?? null,
        food: food ?? null,
        oxygenLevel: self.oxygenLevel ?? null,
        isHurt: typeof health === "number" && health < 20,
        isHungry: typeof food === "number" && food <= selfGuard.lowFood,
        isCritical: typeof health === "number" && health <= selfGuard.criticalHealth
      },
      equipment: {
        heldItem: inventory.heldItem
          ? {
              name: inventory.heldItem.name,
              count: inventory.heldItem.count,
              slot: inventory.heldItem.slot
            }
          : null,
        armor: {
          head: inventory.armor.head?.name ?? null,
          torso: inventory.armor.torso?.name ?? null,
          legs: inventory.armor.legs?.name ?? null,
          feet: inventory.armor.feet?.name ?? null
        }
      },
      inventory: {
        freeSlots: (inventory.slots ?? []).filter((entry) => entry.slot >= 9 && entry.slot < 45 && !entry.item).length,
        foodCount: inventoryItems
          .filter((item: { name: string }) => isFoodItemName(item.name))
          .reduce((sum: number, item: { count?: number }) => sum + (item.count ?? 0), 0),
        bestFood: foodItem?.name ?? null,
        itemSummary: buildInventorySummary(inventoryItems),
        toolSummary: {
          hasSword: !!findBestCategoryItem(inventoryItems, "sword"),
          hasAxe: !!findBestCategoryItem(inventoryItems, "axe"),
          hasPickaxe: !!findBestCategoryItem(inventoryItems, "pickaxe")
        }
      },
      effects: Object.keys(bot.entity.effects ?? {}),
      currentActivity: {
        type: getCurrentActivity(botId),
        detail: movementIntentStore.get(botId) || cfg.lastPlanResult || ""
      }
    },
    localWorld: {
      radius: 16,
      dimension: bot.game.dimension,
      time: {
        isDay: bot.time?.isDay === true,
        isNight: !bot.time?.isDay,
        isRaining: Boolean(bot.isRaining)
      },
      terrain: {
        feetBlock: blockObservation.feet?.name ?? null,
        inSightBlock: blockObservation.inSight?.name ?? null,
        hazards: []
      },
      focus: focusPerception,
      salient: salientPerception,
      visibleBlocks,
      interactables: [],
      drops: []
    },
    entities: [...players, ...entities]
      .filter((entity, index, values) => values.findIndex((candidate) => candidate.dedupeKey === entity.dedupeKey) === index)
      .sort((a, b) => (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY))
      .slice(0, 16)
      .map(({ dedupeKey: _dedupeKey, ...entity }) => entity),
    events: getAgentHierarchicalRuntime(botId).rawExecutionEvents(),
    taskContext: getAgentTaskContext(botId),
    memorySummary: {
      owner: cfg.owner || null,
      whitelistPlayers: [...new Set([...cfg.whitelist, ...getUnifiedWhitelist(botId)])],
      autoIdlePolicy: cfg.autoIdlePolicy,
      lastPlanSummary: cfg.lastPlanSummary,
      strategicGoal: getStrategicGoal(botId),
      memory: {
        playerProfiles,
        places: placeRecords,
        taskHistory
      }
    }
  };
}

type AgentStateSnapshot = ReturnType<typeof buildAgentStateSnapshot>;

export function getAgentStateSnapshotForDebug(botId: string, registry: BotRegistry): Record<string, unknown> {
  return {
    ...buildAgentStateSnapshot(botId, registry),
    events: getAgentHierarchicalRuntime(botId).snapshot().executionEvents
  };
}

export function getAgentStatusForDebug(botId: string): Record<string, unknown> {
  const cfg = getOrCreateAgentConfig(botId);
  return {
    botId,
    enabled: cfg.enabled,
    mode: cfg.mode,
    runtimeState: getAgentRuntimeState(botId),
    whitelist: [...cfg.whitelist],
    owner: cfg.owner,
    commandWakeWord: cfg.commandWakeWord,
    autoIdlePolicy: cfg.autoIdlePolicy,
    plannerApiBaseUrl: cfg.plannerApiBaseUrl,
    hasPlannerApiKey: !!cfg.plannerApiKey,
    plannerModel: cfg.plannerModel,
    planCooldownMs: cfg.planCooldownMs,
    maxPlanSteps: cfg.maxPlanSteps,
    maxToolCallsPerTurn: cfg.maxToolCallsPerTurn,
    allowProactiveAction: cfg.allowProactiveAction,
    allowedTools: cfg.allowedTools,
    executorAttached: agentExecutorLifecycle.isAttached(botId),
    queuedStepCount: getQueuedPlannerSteps(botId).length,
    strategicGoal: getStrategicGoal(botId),
    currentMilestone: getCurrentStrategicMilestone(botId),
    lastPlanAt: cfg.lastPlanAt ? new Date(cfg.lastPlanAt).toISOString() : null,
    lastPlanSummary: cfg.lastPlanSummary,
    lastPlanResult: cfg.lastPlanResult,
    lastPlannerRequest: cfg.lastPlannerRequest,
    recentEventCount: getAgentHierarchicalRuntime(botId).snapshot().executionEvents.length,
    persistedConfigPath: persistedChatConfigPath
  };
}

export function getAgentRecentEventsForDebug(
  botId: string,
  options?: { count?: number; type?: string }
): AgentExecutionEvent[] {
  const typeFilter = options?.type?.trim();
  return getAgentHierarchicalRuntime(botId)
    .snapshot()
    .executionEvents
    .filter((event) => !typeFilter || event.type === typeFilter)
    .slice(-(options?.count ?? 20));
}

export function getAgentMemoryStatusForDebug(botId: string): Record<string, unknown> {
  return {
    botId,
    playerProfiles: [...getOrCreateMemoryPlayerProfiles(botId).values()].sort((a, b) => b.updatedAt - a.updatedAt),
    places: [...getOrCreateMemoryPlaces(botId).values()].sort((a, b) => b.updatedAt - a.updatedAt),
    taskHistory: getTaskHistory(botId),
    persistedConfigPath: persistedChatConfigPath
  };
}

export async function getSharedGameMemoryStatusForDebug(): Promise<Record<string, unknown>> {
  return {
    ...(await sharedGameMemoryStore.getStatus()),
    mode: "shared_preferred_merge_with_legacy_fallback",
    loaded: sharedGameMemoryLoaded,
    lastLoadAt: sharedGameMemoryLastLoadAt,
    lastLoadError: sharedGameMemoryLastLoadError,
    lastImport: sharedGameMemoryLastImport,
    lastWriteAt: sharedGameMemoryLastWriteAt,
    lastWriteError: sharedGameMemoryLastError
  };
}

export async function getSharedChatMemoryStatusForDebug(): Promise<Record<string, unknown>> {
  return await getSharedChatMemoryStatus();
}

export function getTerritoryStatusForDebug(botId: string): Record<string, unknown> {
  return {
    botId,
    territory: getOrCreateTerritoryConfig(botId),
    resolvedPlaces: findConfiguredTerritoryPlaces(botId),
    persistedConfigPath: persistedChatConfigPath
  };
}

export function getChatListenerStatusForDebug(botId: string): Record<string, unknown> {
  const cfg = getOrCreateChatConfig(botId);
  return {
    botId,
    enabled: cfg.enabled,
    whitelist: [...cfg.whitelist],
    wakeNames: cfg.wakeNames,
    dotPrefix: cfg.dotPrefix,
    intents: cfg.intents,
    specialReplies: cfg.specialReplies,
    validMessageLogPath: validChatLogPath,
    persistedConfigPath: persistedChatConfigPath,
    attached: chatListenerLifecycle.has(botId)
  };
}

export function getChatAiStatusForDebug(botId: string): Record<string, unknown> {
  const cfg = getOrCreateChatAiConfig(botId);
  return {
    botId,
    enabled: cfg.enabled,
    whitelist: [...cfg.whitelist],
    wakeWord: cfg.wakeWord,
    cooldownMs: cfg.cooldownMs,
    maxSentences: cfg.maxSentences,
    sentenceDelayMs: cfg.sentenceDelayMs,
    maxHistory: cfg.maxHistory,
    historySize: cfg.history.length,
    apiBaseUrl: cfg.apiBaseUrl,
    hasApiKey: !!cfg.apiKey,
    model: cfg.model,
    modelFallbacks: cfg.modelFallbacks,
    validMessageLogPath: validChatLogPath,
    persistedConfigPath: persistedChatConfigPath,
    attached: chatListenerLifecycle.has(botId)
  };
}

export function getPromptProfileStatusForDebug(): Record<string, unknown> {
  ensurePromptProfileLoaded();
  return {
    promptProfilePath,
    sharedMcbotPromptProfilePath,
    legacyPromptProfilePath,
    explicitPromptProfilePath: explicitPromptProfilePath || null,
    profile: activePromptProfile
  };
}

export async function debugReloadPromptProfile(): Promise<Record<string, unknown>> {
  const raw = await readFile(promptProfilePath, "utf8");
  activePromptProfile = sanitizePromptProfile(JSON.parse(raw) as Partial<PromptProfile>);
  const updatedChatAiConfigs = applyPromptProfileToChatAiConfigs();
  if (updatedChatAiConfigs > 0) {
    queuePersistChatState();
  }
  return {
    action: "reload-prompt-profile",
    reloaded: true,
    promptProfilePath,
    sharedMcbotPromptProfilePath,
    legacyPromptProfilePath,
    explicitPromptProfilePath: explicitPromptProfilePath || null,
    updatedChatAiConfigs,
    profile: activePromptProfile
  };
}

export function getObserveSnapshotForDebug(botId: string, registry: BotRegistry): Record<string, unknown> {
  const runtime = registry.get(botId);
  const inventory = runtime.getInventoryState(true);
  const nearbyPlayers = runtime.getNearbyPlayers(32);
  const nearbyEntities = runtime
    .getNearbyEntities(24)
    .sort((a, b) => (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY));
  const blocks = runtime.getBlockObservation(4.5);

  return {
    botId,
    capturedAt: new Date().toISOString(),
    clientAdapterKind: runtime.getClientAdapterKind(),
    self: runtime.getSelfState(),
    inventory: {
      heldItem: inventory.heldItem,
      itemStacks: inventory.items.length,
      itemSummary: buildInventorySummary(inventory.items),
      items: inventory.items,
      slots: inventory.slots ?? []
    },
    nearbyPlayers: {
      radius: 32,
      count: nearbyPlayers.length,
      players: nearbyPlayers
    },
    nearbyEntities: {
      radius: 24,
      count: nearbyEntities.length,
      entities: nearbyEntities
    },
    blocks: {
      reach: 4.5,
      feet: blocks.feet,
      inSight: blocks.inSight
    }
  };
}

export async function debugSetStrategicGoal(
  botId: string,
  registry: BotRegistry,
  input: {
    goal: string;
    rationale?: string;
    milestones?: string[];
    currentMilestoneIndex?: number;
  }
): Promise<Record<string, unknown>> {
  updateStrategicGoal(botId, input.goal, "manual", input.rationale ?? undefined, input.milestones, input.currentMilestoneIndex);
  const current = getStrategicGoal(botId);
  const cfg = getOrCreateAgentConfig(botId);
  const overrideApplied = maybeOverrideCurrentTaskForManualGoal(botId, registry);
  const activationAttempted = cfg.mode === "auto";
  const activationTriggered = activationAttempted ? await maybeActivateStrategicGoal(botId, registry) : false;
  if (activationTriggered) {
    setAgentRuntimeState(botId, "task_running");
  }
  return {
    botId,
    strategicGoal: current,
    currentMilestone: getCurrentStrategicMilestone(botId),
    overrideApplied,
    activationAttempted,
    activationTriggered,
    persistedConfigPath: persistedChatConfigPath
  };
}

export function debugAdvanceStrategicGoal(botId: string, registry: BotRegistry): Record<string, unknown> {
  const result = advanceStrategicMilestone(botId, registry, "debug_web");
  return {
    botId,
    advanced: result.advanced,
    completed: result.completed,
    strategicGoal: result.strategicGoal,
    currentMilestone: result.currentMilestone,
    persistedConfigPath: persistedChatConfigPath
  };
}

export function debugRewindStrategicGoal(botId: string, registry: BotRegistry): Record<string, unknown> {
  const result = rewindStrategicMilestone(botId, registry, "debug_web");
  return {
    botId,
    rewound: result.rewound,
    strategicGoal: result.strategicGoal,
    currentMilestone: result.currentMilestone,
    persistedConfigPath: persistedChatConfigPath
  };
}

export async function debugRunAgentOnce(
  botId: string,
  registry: BotRegistry,
  input: {
    userInstruction: string;
    requester?: string;
  }
): Promise<Record<string, unknown>> {
  const userInstruction = input.userInstruction.trim();
  if (!userInstruction) {
    throw new Error("userInstruction is required");
  }

  const cfg = getOrCreateAgentConfig(botId);
  if (!cfg.enabled) {
    throw new Error("Agent is disabled. Enable it via agent.configure first.");
  }

  const actor = input.requester?.trim() || cfg.owner || "";
  if (cfg.whitelist.size > 0 && actor && !cfg.whitelist.has(actor)) {
    throw new Error(`Requester '${actor}' is not in agent whitelist`);
  }

  setAgentRuntimeState(botId, "task_running");
  recordAgentEvent(botId, "wake_command", "normal", {
    requester: actor || null,
    userInstruction
  });
  const { plan, plannedSteps, executionResult, stateSnapshot } = await runAgentPlanningTurn(
    botId,
    registry,
    cfg,
    userInstruction,
    actor || null,
    "manual"
  );

  return {
    botId,
    requester: actor || null,
    plan,
    plannedSteps,
    executionResult,
    stateSnapshot
  };
}

export function debugClearStrategicGoal(botId: string): Record<string, unknown> {
  invalidatePlannerRequest(botId);
  setStrategicGoal(botId, null);
  queuePersistChatState();
  return {
    botId,
    cleared: true,
    strategicGoal: null,
    persistedConfigPath: persistedChatConfigPath
  };
}

export async function debugStopFollow(
  botId: string,
  registry: BotRegistry
): Promise<Record<string, unknown>> {
  return {
    ...(await getActionCommandSet(registry).invokeStopFollow({ botId, source: "web" }))
  };
}

export function debugEnableHiReply(
  botId: string,
  registry: BotRegistry,
  input?: {
    whitelist?: string[];
    wakeName?: string;
    trigger?: string;
    reply?: string;
  }
): Record<string, unknown> {
  const cfg = getOrCreateChatConfig(botId);
  const agentCfg = getOrCreateAgentConfig(botId);
  const wakeName = input?.wakeName?.trim() || cfg.wakeNames[0] || agentCfg.commandWakeWord || "小狸";
  const trigger = input?.trigger?.trim() || `hi${wakeName}`;
  const reply = input?.reply?.trim() || "hihi";
  const whitelist =
    input?.whitelist && input.whitelist.length > 0
      ? input.whitelist
      : cfg.whitelist.size > 0
        ? [...cfg.whitelist]
        : [...new Set([agentCfg.owner, ...agentCfg.whitelist].map((x) => x.trim()).filter(Boolean))];

  cfg.enabled = true;
  if (whitelist.length > 0) cfg.whitelist = new Set(whitelist);
  if (!cfg.wakeNames.some((name) => normalizeIntentText(name) === normalizeIntentText(wakeName))) {
    cfg.wakeNames.push(wakeName);
  }

  const existing = cfg.specialReplies.find((rule) => normalizeIntentText(rule.trigger) === normalizeIntentText(trigger));
  if (existing) {
    existing.reply = reply;
    existing.matchMode = "includes";
  } else {
    cfg.specialReplies.push({ trigger, reply, matchMode: "includes" });
  }

  queuePersistChatState();
  ensureChatListenerAttached(botId, registry);
  return getChatListenerStatusForDebug(botId);
}

export function debugEnableChatAi(
  botId: string,
  registry: BotRegistry,
  input?: {
    whitelist?: string[];
    wakeWord?: string;
    apiBaseUrl?: string;
    model?: string;
  }
): Record<string, unknown> {
  const cfg = getOrCreateChatAiConfig(botId);
  const agentCfg = getOrCreateAgentConfig(botId);
  const whitelist =
    input?.whitelist && input.whitelist.length > 0
      ? input.whitelist
      : cfg.whitelist.size > 0
        ? [...cfg.whitelist]
        : [...new Set([agentCfg.owner, ...agentCfg.whitelist, ...getOrCreateChatConfig(botId).whitelist].map((x) => x.trim()).filter(Boolean))];

  cfg.enabled = true;
  if (whitelist.length > 0) cfg.whitelist = new Set(whitelist);
  if (input?.wakeWord?.trim()) cfg.wakeWord = input.wakeWord.trim();
  if (input?.apiBaseUrl?.trim()) cfg.apiBaseUrl = input.apiBaseUrl.trim();
  if (input?.model?.trim()) cfg.model = input.model.trim();
  if (!cfg.apiKey && process.env.MCBOT_AI_API_KEY) cfg.apiKey = process.env.MCBOT_AI_API_KEY;

  queuePersistChatState();
  ensureChatListenerAttached(botId, registry);
  return getChatAiStatusForDebug(botId);
}

export async function debugEatFood(
  botId: string,
  registry: BotRegistry,
  input?: {
    itemName?: string;
  }
): Promise<Record<string, unknown>> {
  return {
    ...(await getActionCommandSet(registry).invokeEat(
      { botId, source: "web" },
      { itemName: input?.itemName?.trim() || undefined }
    ))
  };
}

export async function debugHoldItemByCategory(
  botId: string,
  registry: BotRegistry,
  input: HoldItemByCategoryInput
): Promise<Record<string, unknown>> {
  return {
    ...(await getActionCommandSet(registry).invokeHoldByCategory(
      { botId, source: "web" },
      input
    ))
  };
}

export async function debugUseHeldItem(
  botId: string,
  registry: BotRegistry,
  input?: {
    mode?: "tap" | "hold";
    holdMs?: number;
    reach?: number;
    preferBlockInteraction?: boolean;
  }
): Promise<Record<string, unknown>> {
  const result = await registry.get(botId).useHeldItem({
    mode: input?.mode,
    holdMs: input?.holdMs,
    reach: input?.reach,
    preferBlockInteraction: input?.preferBlockInteraction
  });
  return {
    botId,
    action: "useHeldItem",
    result
  };
}

export async function debugOpenDoor(
  botId: string,
  registry: BotRegistry,
  input?: OpenDoorInput
): Promise<Record<string, unknown>> {
  return {
    ...(await getActionCommandSet(registry).invokeOpenDoor(
      { botId, source: "web" },
      {
        reach: input?.reach,
        radius: input?.radius
      }
    ))
  };
}

function buildAttackNearestDebugSelection(
  registry: BotRegistry,
  botId: string,
  input: AttackNearestDebugInput = {}
): Record<string, unknown> {
  const runtime = registry.get(botId);
  const maxDistance = input.maxDistance ?? 4.5;
  const includePlayers = input.includePlayers ?? false;
  const typeFilter = input.type?.trim().toLowerCase() || "";
  const nameFilter = input.name?.trim().toLowerCase() || "";
  const rawEntities = runtime.getNearbyEntities(Math.max(maxDistance, 24));
  const candidates: AttackNearestDebugEntity[] = rawEntities
    .map((entity) => {
      const joinedText = `${entity.type ?? ""} ${entity.name ?? ""} ${entity.displayName ?? ""} ${entity.kind ?? ""}`.toLowerCase();
      const excludedReasons: string[] = [];
      if (!includePlayers && entity.type === "player") {
        excludedReasons.push("includePlayers=false");
      }
      if ((entity.distance ?? Number.POSITIVE_INFINITY) > maxDistance) {
        excludedReasons.push(`distance>${maxDistance}`);
      }
      if (typeFilter && !joinedText.includes(typeFilter)) {
        excludedReasons.push(`type filter '${typeFilter}'`);
      }
      if (nameFilter && !joinedText.includes(nameFilter)) {
        excludedReasons.push(`name filter '${nameFilter}'`);
      }
      return {
        entityId: entity.entityId,
        name: entity.name,
        displayName: entity.displayName,
        type: entity.type,
        kind: entity.kind,
        distance: entity.distance,
        position: entity.position,
        joinedText,
        excludedReason: excludedReasons.length > 0 ? excludedReasons.join(", ") : undefined
      } satisfies AttackNearestDebugEntity;
    })
    .sort((a, b) => (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY));
  const matchingCandidates = candidates.filter((candidate) => !candidate.excludedReason);
  const playerCandidates = candidates.filter((candidate) => candidate.type === "player");

  return {
    maxDistance,
    includePlayers,
    typeFilter: typeFilter || null,
    nameFilter: nameFilter || null,
    observedEntityCount: rawEntities.length,
    matchingCandidateCount: matchingCandidates.length,
    nearestMatchingCandidate: matchingCandidates[0] ?? null,
    nearestObservedEntities: candidates.slice(0, 8),
    playerCandidatesIgnored: includePlayers ? 0 : playerCandidates.length,
    hint:
      matchingCandidates.length > 0
        ? "nearestMatchingCandidate is the target that should be attacked"
        : includePlayers
          ? "no matching entity within maxDistance and filters"
          : "no matching non-player entity within maxDistance; players are ignored because includePlayers=false"
  };
}

export async function debugAttackNearestEntity(
  botId: string,
  registry: BotRegistry,
  input?: AttackNearestDebugInput
): Promise<Record<string, unknown>> {
  const selection = buildAttackNearestDebugSelection(registry, botId, input);
  let result: { ok: boolean; detail?: string; error?: string };
  try {
    result = await registry.get(botId).attackNearestEntity({
      maxDistance: input?.maxDistance,
      type: input?.type?.trim() || undefined,
      name: input?.name?.trim() || undefined,
      includePlayers: input?.includePlayers
    });
  } catch (error) {
    result = {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
  return {
    botId,
    action: "attackNearestEntity",
    selection,
    result
  };
}

export function debugCapturePlaceHere(
  botId: string,
  registry: BotRegistry,
  input: {
    placeId: string;
    label: string;
    notes?: string;
    tags?: string[];
  }
): Record<string, unknown> {
  const location = requireSelfLocation(registry.get(botId).getSelfState(), botId);
  const place = rememberPlace(botId, input.placeId, {
    placeId: input.placeId,
    label: input.label,
    ...location.roundedPosition,
    dimension: location.dimension,
    notes: input.notes ?? undefined,
    tags: input.tags ?? []
  });
  return {
    botId,
    place,
    persistedConfigPath: persistedChatConfigPath
  };
}


async function runPrepareBattle(botId: string, registry: BotRegistry): Promise<string> {
  const bot = registry.get(botId).getActiveBotOrThrow();
  let weaponName: string | null = null;

  try {
    await ensureIronSwordInHotbar1AndHold(bot);
    weaponName = "iron_sword";
  } catch {
    weaponName = await ensureCombatWeaponEquipped(botId, bot);
  }

  if (!weaponName) {
    throw new Error("No usable weapon found in inventory");
  }

  const armorResults = await equipBestArmor(bot);
  const equippedArmor = armorResults.filter((x) => x.equipped).map((x) => x.item).filter(Boolean);
  return `prepared_battle weapon=${weaponName} armor=${equippedArmor.join(",") || "none"}`;
}

function runChallengeEntity(
  botId: string,
  registry: BotRegistry,
  targetText: string,
  requester = "agent",
  maxDistance = 16
): string {
  const normalizedTarget = String(targetText ?? "").trim();
  if (!normalizedTarget) {
    throw new Error("Missing challenge target");
  }
  const runtime = registry.get(botId);
  const target = findChallengeTargetSnapshot(runtime.getNearbyEntities(maxDistance), normalizedTarget, maxDistance);
  if (!target || typeof target.entityId !== "number") {
    throw new Error(`No challenge target '${normalizedTarget}' found within ${maxDistance} blocks`);
  }
  return startDuel(botId, registry, requester, target);
}

async function runTeleportRequest(botId: string, registry: BotRegistry, playerName: string): Promise<string> {
  const normalizedPlayer = String(playerName ?? "").trim();
  if (!normalizedPlayer) {
    throw new Error("Missing playerName for teleport request");
  }
  await sendRuntimeChat(botId, registry, `/tpa ${normalizedPlayer}`);
  return `sent /tpa to ${normalizedPlayer}`;
}


function buildAutonomousPlanningInstruction(config: AgentConfig, stateSnapshot: AgentStateSnapshot): string {
  const runtimeState = String(stateSnapshot.runtimeState ?? "idle");
  const owner = String(stateSnapshot.memorySummary.owner ?? config.owner ?? "").trim();
  const whitelist = stateSnapshot.memorySummary.whitelistPlayers;
  const strategicGoalState = stateSnapshot.memorySummary.strategicGoal;
  const strategicGoal = String(strategicGoalState?.goal ?? "").trim();
  const milestones = Array.isArray(strategicGoalState?.milestones) ? strategicGoalState.milestones : [];
  const milestoneIndex = typeof strategicGoalState?.currentMilestoneIndex === "number" ? strategicGoalState.currentMilestoneIndex : 0;
  const lifecycleSummary = summarizeRecentStrategicLifecycle(stateSnapshot.botId);
  const preferredPlacesSummary = summarizePreferredRememberedPlaces(stateSnapshot);

  return [
    "You are performing one low-frequency strategic pass for a Minecraft embodied agent.",
    `Current runtimeState: ${runtimeState}.`,
    owner ? `Known owner: ${owner}.` : "Known owner: none.",
    whitelist.length > 0 ? `Whitelist players: ${whitelist.join(", ")}.` : "Whitelist players: none.",
    strategicGoal ? `Current long-term strategic goal: ${strategicGoal}.` : "Current long-term strategic goal: none.",
    milestones.length > 0
      ? `Current milestones: ${milestones.join(" | ")}. Active milestone index: ${milestoneIndex}.`
      : "Current milestones: none.",
    `Recent goal/milestone lifecycle: ${lifecycleSummary}`,
    preferredPlacesSummary,
    `Idle policy preference: ${config.autoIdlePolicy}.`,
    "Choose at most one short high-level directive.",
    "Prefer, in order:",
    "1. Keep the bot safe and stable.",
    owner ? `2. Stay useful to ${owner} if nearby context suggests it.` : "2. Stay useful to nearby whitelist players if relevant.",
    strategicGoal ? "3. If safe, continue or repair the current strategic goal instead of inventing a new one." : "3. If there is no meaningful goal, keep behavior lightweight.",
    "3. If idle with no better task, socialize briefly or wander locally.",
    "4. If nothing meaningful should change, return no_action.",
    "Do not micromanage with low-level tool sequences unless absolutely necessary."
  ].join(" ");
}

function createAgentPlanningCoordinator(
  registry: BotRegistry,
  strategy: AgentPlanningStrategy
): AgentPlanningTurnCoordinator<AgentStateSnapshot> {
  return new AgentPlanningTurnCoordinator(strategy, plannerRequestLifecycle, {
    getRuntime: (botId) => {
      hierarchicalAgents.syncBotIds(registry.listBotIds());
      return hierarchicalAgents.ensure(botId);
    },
    syncState: (botId) => syncHierarchicalAgentState(botId, registry),
    captureState: (botId) => buildAgentStateSnapshot(botId, registry),
    updateDiagnostics: (botId, update) => { agentConfigStore.updateRuntimeDiagnostics(botId, update); },
    updateGoal: (botId, source, decision) => {
      if (!decision.directive) return;
      updateStrategicGoal(
        botId, decision.directive.goal, source, decision.directive.rationale,
        Array.isArray(decision.plan.directive?.milestones) ? decision.plan.directive.milestones : undefined,
        typeof decision.plan.directive?.currentMilestoneIndex === "number" ? decision.plan.directive.currentMilestoneIndex : undefined
      );
    },
    sendSpeech: (botId, text) => sendRuntimeChat(botId, registry, text),
    enqueueSteps: enqueueAgentPlanSteps,
    startExecutor: (botId) => startAgentExecutorLoop(botId, registry),
    finishTurn: (botId, source, result) => {
      setAgentRuntimeState(botId, getActiveAgentTask(botId) || (source === "strategic_pass" && result !== "no_action")
        ? "task_running" : "idle");
      queuePersistChatState();
    }
  });
}

function getAgentPlanningCoordinator(registry: BotRegistry): AgentPlanningTurnCoordinator<AgentStateSnapshot> {
  let coordinator = agentPlanningCoordinators.get(registry);
  if (!coordinator) {
    coordinator = createAgentPlanningCoordinator(registry, new DefaultAgentPlanningStrategy());
    agentPlanningCoordinators.set(registry, coordinator);
  }
  return coordinator;
}

async function runAgentPlanningTurn(
  botId: string,
  registry: BotRegistry,
  cfg: AgentConfig,
  userInstruction: string,
  requester: string | null,
  source: "manual" | "strategic_pass",
  reportFailure = false
) {
  const plannerTimeoutMs = resolveAiRequestTimeout(
    process.env.MCBOT_PLANNER_TIMEOUT_MS ?? process.env.MCBOT_AI_REQUEST_TIMEOUT_MS,
    15000
  );
  return getAgentPlanningCoordinator(registry).run({
    botId,
    config: cfg,
    userInstruction,
    requester,
    source,
    timeoutMs: plannerTimeoutMs,
    onFailure: reportFailure ? (error) => {
      setAgentRuntimeState(botId, getActiveAgentTask(botId) ? "task_running" : "idle");
      agentConfigStore.updateRuntimeDiagnostics(botId, {
        lastPlanResult: error instanceof Error ? error.message : String(error)
      });
    } : undefined
  });
}

export async function executeAgentToolCall(
  botId: string,
  registry: BotRegistry,
  tool: string,
  args: Record<string, unknown>
): Promise<string> {
  if (tool === "chat.send") {
    const message = String(args.message ?? "").trim();
    if (!message) throw new Error("chat.send requires non-empty message");
    await sendRuntimeChat(botId, registry, message);
    return `sent chat: ${message}`;
  }

  if (tool === "move.stopFollow") {
    await getActionCommandSet(registry).invokeStopFollow({
      botId,
      source: "agent",
      requester: "agent"
    });
    return "stopped follow";
  }

  if (tool === "move.followPlayer") {
    const playerName = String(args.playerName ?? "").trim();
    if (!playerName) throw new Error("move.followPlayer requires playerName");
    return startFollow(botId, registry, {
      playerName,
      minDistance: Number(args.minDistance ?? 2.5),
      maxDistance: Number(args.maxDistance ?? 24),
      sprint: Boolean(args.sprint ?? true),
      tickMs: Number(args.tickMs ?? 250),
      targetStillStopMs: Number(args.targetStillStopMs ?? 16000)
    }, "agent");
  }

  if (tool === "combat.challengeEntity") {
    const targetText = String(args.targetText ?? args.targetName ?? "").trim();
    if (!targetText) throw new Error("combat.challengeEntity requires targetText");
    const requester = String(args.requester ?? "agent").trim() || "agent";
    const maxDistance = Number(args.maxDistance ?? 16);
    return runChallengeEntity(botId, registry, targetText, requester, maxDistance);
  }

  if (tool === "chat.requestTeleportToPlayer") {
    const playerName = String(args.playerName ?? "").trim();
    if (!playerName) throw new Error("chat.requestTeleportToPlayer requires playerName");
    return runTeleportRequest(botId, registry, playerName);
  }

  if (tool === "observe.self") {
    return buildAgentStateSummary(botId, registry);
  }

  if (tool === "observe.inventory") {
    const inventory = registry.get(botId).getInventoryState();
    const items = inventory.items.map((item) => `${item.name}x${item.count}`);
    return `inventory=[${items.join(", ")}]`;
  }

  if (tool === "observe.nearbyPlayers") {
    const runtime = registry.get(botId);
    const players = runtime
      .getNearbyPlayers(Number(args.radius ?? 32))
      .map((p) => `${p.username}:${(p.distance ?? 0).toFixed(1)}`);
    return `players=[${players.join(", ")}]`;
  }

  if (tool === "observe.nearbyEntities") {
    const radius = Number(args.radius ?? 24);
    const runtime = registry.get(botId);
    const entities = runtime
      .getNearbyEntities(radius)
      .slice(0, 16)
      .map((e) => `${String(e.name)}:${String(e.type)}:${String(e.distance ?? "?")}`);
    return `entities=[${entities.join(", ")}]`;
  }

  if (tool === "interact.eat") {
    return executeAgentEatTool(
      {
        async eatFood(input = {}) {
          const output = await getActionCommandSet(registry).invokeEat(
            { botId, source: "agent", requester: "agent" },
            input
          );
          return output.result;
        }
      },
      args
    );
  }

  if (tool === "player.look") {
    return executeAgentLookTool(registry.get(botId), args);
  }

  if (tool === "movement.walk") {
    const runtime = registry.get(botId);
    return executeAgentWalkTool(
      {
        async walkForDuration({ durationMs, sprint, jump }) {
          clearFollowLoopState(botId, registry);
          stopWalkTimer(botId);
          const stopResult = await runtime.stopMovement();
          movementIntentStore.delete(botId);
          if (!stopResult.ok) return stopResult;

          const result = await runtime.walkForward({ sprint, jump });
          if (!result.ok) return result;

          walkTimerLifecycle.schedule(botId, durationMs, () => {
            void stopMovementAndClear(botId, registry).catch(() => {
              // ignore when bot disconnected in timer window
            });
          });

          return {
            ok: true,
            detail: `walking forward for ${durationMs}ms (sprint=${sprint}, jump=${jump})`
          };
        }
      },
      args
    );
  }

  if (tool === "inventory.holdByCategory") {
    const category = String(args.category ?? "").trim();
    if (!category) throw new Error("inventory.holdByCategory requires category");
    if (!["sword", "axe", "pickaxe", "food"].includes(category)) {
      throw new Error(`Unsupported inventory category '${category}'`);
    }
    const { result } = await getActionCommandSet(registry).invokeHoldByCategory(
      { botId, source: "agent", requester: "agent" },
      { category: category as ToolCategory }
    );
    return result.detail ?? `equipped item for category ${category}`;
  }

  if (tool === "interact.openDoor") {
    const reach = Number(args.reach ?? 4.5);
    const radius = Number(args.radius ?? 6);
    const { result } = await getActionCommandSet(registry).invokeOpenDoor(
      { botId, source: "agent", requester: "agent" },
      { reach, radius }
    );
    return result.detail ?? "toggled door";
  }

  if (tool === "interact.dropHeld") {
    const runtime = registry.get(botId);
    const held = runtime.getInventoryState().heldItem;
    if (!held) throw new Error("No held item to drop");
    const mode = args.mode === "stack" ? "stack" : "one";
    await runtime.dropHeldItem(mode);
    return mode === "one" ? `dropped one ${held.name} from hand` : `dropped stack ${held.name} from hand`;
  }

  if (tool === "interact.dropHotbarSlot") {
    const runtime = registry.get(botId);
    const slot = Number(args.slot);
    if (!Number.isInteger(slot) || slot < 1 || slot > 9) {
      throw new Error("interact.dropHotbarSlot requires integer slot 1-9");
    }
    const targetInventorySlot = 36 + (slot - 1);
    const held = runtime.getInventoryState(true).slots?.find((entry) => entry.slot === targetInventorySlot)?.item ?? null;
    if (!held) throw new Error(`Hotbar slot ${slot} is empty`);
    const mode = args.mode === "stack" ? "stack" : "one";
    await runtime.dropHotbarSlot({ slot, mode, restorePrevious: args.restorePrevious !== false });
    return `dropped ${mode} from hotbar slot ${slot}`;
  }

  if (tool === "inventory.organizeHotbar") {
    const result = await registry.get(botId).organizeHotbar();
    return `organized_hotbar actions=${result.actions.length}`;
  }

  if (tool === "move.goToPosition") {
    const x = Number(args.x);
    const y = Number(args.y);
    const z = Number(args.z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      throw new Error("move.goToPosition requires numeric x/y/z");
    }
    const stopRadius = Number(args.stopRadius ?? 2.3);
    goToPosition(botId, registry, { x, y, z }, stopRadius);
    return `moving_to=${x},${y},${z}, stopRadius=${stopRadius}`;
  }

  // The remaining legacy branches still require Mineflayer-specific world APIs.
  const bot = registry.get(botId).getActiveBotOrThrow();

  if (tool === "combat.prepareBattle") {
    return runPrepareBattle(botId, registry);
  }

  if (tool === "mine.collectVisible") {
    const blockNames = Array.isArray(args.blockNames)
      ? args.blockNames.map((x) => String(x)).filter(Boolean)
      : DEFAULT_MINING_TARGET_BLOCKS;
    const searchRadius = Number(args.searchRadius ?? 24);
    const maxBlocks = Number(args.maxBlocks ?? 8);
    const reachDistance = Number(args.reachDistance ?? 4.5);
    const visibleStep = Number(args.visibleStep ?? 0.2);
    const moveNear = args.moveNear === undefined ? true : Boolean(args.moveNear);
    const approachTimeoutMs = Number(args.approachTimeoutMs ?? 20000);

    startAgentTask(botId, {
      type: "mine_collect_visible",
      source: "agent",
      goal: `collect visible blocks: ${blockNames.join(", ") || "default_targets"}`,
      params: { blockNames, searchRadius, maxBlocks, reachDistance, moveNear }
    });
    try {
      const result = await queueMiningTask(botId, async () => {
        const uniqueNames = [...new Set(blockNames)].filter((n) => !!bot.registry.blocksByName[n]);
        const mined: string[] = [];
        let stopReason = "reached_max_blocks";

        for (let i = 0; i < maxBlocks; i += 1) {
          updateAgentTask(botId, { detail: `scanning target ${i + 1}/${maxBlocks}` });
          const picked = findNearestVisibleBlockFromNames(bot, uniqueNames, searchRadius, visibleStep);
          if (!picked) {
            stopReason = "no_visible_target";
            break;
          }
          let distance = bot.entity.position.distanceTo(picked.block.position);
          if (moveNear && distance > reachDistance) {
            updateAgentTask(botId, { detail: `approaching ${picked.name}` });
            const pathSet = setPathfinderGoalNear(botId, bot, picked.block.position, Math.max(1, reachDistance - 1), "mining");
            if (!pathSet) {
              stopReason = "pathfinder_unavailable";
              break;
            }
            const arrived = await waitUntilNearPosition(bot, picked.block.position, reachDistance, approachTimeoutMs);
            const pathApi = bot.pathfinder;
            if (pathApi && typeof pathApi.setGoal === "function") pathApi.setGoal(null);
            movementIntentStore.delete(botId);
            if (!arrived) {
              stopReason = "approach_timeout";
              break;
            }
            distance = bot.entity.position.distanceTo(picked.block.position);
          }
          const latest = bot.blockAt(picked.block.position);
          if (!latest || latest.type === 0) continue;
          if (!canSeeNativeBlock(bot, latest, visibleStep)) continue;
          if (typeof bot.canDigBlock === "function" && !bot.canDigBlock(latest)) continue;
          updateAgentTask(botId, { detail: `digging ${latest.name}` });
          await equipBestNativeToolForBlock(bot, latest);
          await bot.lookAt(latest.position.offset(0.5, 0.5, 0.5), true);
          await bot.dig(latest, true);
          mined.push(latest.name);
        }
        return { stopReason, minedCount: mined.length, mined };
      });
      finalizeAgentTask(botId, "finished", {
        ifType: "mine_collect_visible",
        detail: `mined ${result.minedCount} blocks`,
        payload: { minedCount: result.minedCount, stopReason: result.stopReason, mined: result.mined }
      });
      return `mined=${result.minedCount}, stopReason=${result.stopReason}`;
    } catch (error) {
      finalizeAgentTask(botId, "failed", {
        ifType: "mine_collect_visible",
        detail: "agent mining failed",
        lastError: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  throw new Error(`Unsupported agent tool '${tool}'`);
}

function stopMovement(botId: string, registry: BotRegistry): void {
  const runtime = registry.get(botId);
  void runtime.stopMovement().catch(() => {
    // ignore when bot is already disconnected
  });
  movementIntentStore.delete(botId);
}

async function stopMovementAndClear(botId: string, registry: BotRegistry): Promise<void> {
  const runtime = registry.get(botId);
  await runtime.stopMovement();
  movementIntentStore.delete(botId);
}

interface PathfinderModuleCompatibility {
  Movements?: typeof Pathfinder.Movements;
  goals?: {
    GoalNear?: typeof Pathfinder.goals.GoalNear;
  };
  default?: {
    Movements?: typeof Pathfinder.Movements;
    goals?: {
      GoalNear?: typeof Pathfinder.goals.GoalNear;
    };
  };
}

const pathfinderModule = Pathfinder as PathfinderModuleCompatibility;

function ensurePathfinderMovement(
  bot: MineflayerBot,
  profile: PathfinderMovementProfile = "safe"
): Pathfinder.Pathfinder | null {
  const pathApi = bot.pathfinder;
  if (!pathApi || typeof pathApi.setMovements !== "function") return null;

  const MovementsCtor = pathfinderModule.Movements ?? pathfinderModule.default?.Movements;
  if (!MovementsCtor) return null;

  let cachedMovements = pathfinderMovementsByBot.get(bot);
  if (!cachedMovements) {
    cachedMovements = {};
    pathfinderMovementsByBot.set(bot, cachedMovements);
  }
  let movements = cachedMovements[profile];
  if (!movements) {
    movements = new MovementsCtor(bot);
    applyPathfinderMovementProfile(movements, profile);
    cachedMovements[profile] = movements;
  }
  try {
    pathApi.setMovements(movements);
    return pathApi;
  } catch {
    return null;
  }
}

function setPathfinderGoalNear(
  botId: string,
  bot: MineflayerBot,
  pos: PositionCoordinates,
  range: number,
  profile: PathfinderMovementProfile = "safe"
): boolean {
  const pathApi = ensurePathfinderMovement(bot, profile);
  if (!pathApi || !pos) return false;
  const GoalNearCtor = pathfinderModule.goals?.GoalNear ?? pathfinderModule.default?.goals?.GoalNear;
  if (!GoalNearCtor) return false;

  const x = Math.floor(pos.x);
  const y = Math.floor(pos.y);
  const z = Math.floor(pos.z);
  const key = `${x},${y},${z},${Math.max(1, Math.floor(range))}`;
  if (movementIntentStore.get(botId) === key) return true;

  try {
    movementIntentStore.set(botId, key);
    pathApi.setGoal(new GoalNearCtor(x, y, z, Math.max(1, Math.floor(range))), true);
    return true;
  } catch {
    return false;
  }
}

function stopWalkTimer(botId: string): void {
  walkTimerLifecycle.stop(botId);
}

function stopFollowLoop(
  botId: string,
  registry: BotRegistry,
  outcome: "finished" | "failed" | "cancelled" = "cancelled",
  detail = "follow stopped"
): void {
  clearFollowLoopState(botId, registry, outcome, detail);

  try {
    stopMovement(botId, registry);
  } catch {
    // ignore when bot is already disconnected
  }
}

function getActionCommandSet(registry: BotRegistry): ActionCommandSet {
  const existing = actionCommandSets.get(registry);
  if (existing) return existing;

  const commands = new ActionCommandSet({
    registry,
    stopFollow(botId) {
      stopFollowLoop(botId, registry);
    }
  });
  actionCommandSets.set(registry, commands);
  return commands;
}

export function getCommandInvocationHistoryForDebug(
  registry: BotRegistry,
  filter: CommandHistoryFilter = {}
): CommandInvocationResult[] {
  return getActionCommandSet(registry).getHistory(filter);
}

function clearFollowLoopState(
  botId: string,
  registry: BotRegistry,
  outcome: "finished" | "failed" | "cancelled" = "cancelled",
  detail = "follow stopped"
): void {
  ensureRuntimeCapability(botId, registry, "stop_follow");
  followSessionLifecycle.stop(botId);
  movementIntentStore.delete(botId);
  finalizeAgentTask(botId, outcome, {
    ifType: "follow_player",
    detail
  });
  if (outcome === "finished" || outcome === "failed") {
    publishHierarchicalTaskLifecycle(botId, registry, outcome === "finished" ? "task_finished" : "task_failed", "follow_player", detail);
  }
}

function isFoodItemName(name: string): boolean {
  if (!name) return false;
  return /(^|_)(bread|apple|carrot|potato|beetroot|cookie|pumpkin_pie|melon_slice|dried_kelp|kelp|berries|stew|cooked|golden_carrot|honey_bottle|chorus_fruit|rabbit|salmon|cod|mutton|porkchop|beef|chicken|rotten_flesh)(_|$)/.test(
    name
  );
}

function getBestFoodItem<T extends { name: string }>(items: T[]): T | null {
  const foods = items.filter((item) => isFoodItemName(item.name));
  if (foods.length === 0) return null;
  // Prefer cooked/golden food names when available.
  foods.sort((a, b) => {
    const score = (name: string) =>
      (name.includes("golden") ? 4 : 0) +
      (name.includes("cooked") ? 3 : 0) +
      (name.includes("stew") ? 2 : 0) +
      (name.includes("bread") ? 1 : 0);
    return score(b.name) - score(a.name);
  });
  return foods[0];
}

function findVisibleBlocksByName(
  bot: MineflayerBot,
  blockName: string,
  radius: number,
  count: number,
  visibleStep = 0.2,
  maxScan = 128
): Array<{ block: MineflayerBlock; distance: number }> {
  const blockDef = bot.registry.blocksByName[blockName];
  if (!blockDef) return [];

  const positions = bot.findBlocks({
    matching: blockDef.id,
    maxDistance: radius,
    count: Math.max(count, maxScan)
  });

  const me = bot.entity.position;
  return positions
    .map((position) => bot.blockAt(position))
    .filter((block): block is MineflayerBlock => block !== null)
    .map((block) => ({ block, distance: me.distanceTo(block.position) }))
    .sort((a, b) => a.distance - b.distance)
    .filter((candidate) => canSeeNativeBlock(bot, candidate.block, visibleStep))
    .slice(0, count);
}

function canSeeNativeBlock(bot: MineflayerBot, block: MineflayerBlock, visibleStep: number): boolean {
  return canSeeBlockByRay(
    bot as unknown as MineflayerMiningClient,
    block as unknown as MineflayerMiningBlock,
    visibleStep
  );
}

async function equipBestNativeToolForBlock(bot: MineflayerBot, block: MineflayerBlock): Promise<void> {
  await equipBestToolForBlock(
    bot as unknown as MineflayerMiningClient,
    block as unknown as MineflayerMiningBlock
  );
}

async function waitUntilNearPosition(
  bot: MineflayerBot,
  targetPos: PositionCoordinates,
  withinDistance: number,
  timeoutMs: number
): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const nowDist = Math.hypot(
      bot.entity.position.x - targetPos.x,
      bot.entity.position.y - targetPos.y,
      bot.entity.position.z - targetPos.z
    );
    if (nowDist <= withinDistance) return true;
    await waitMs(120);
  }
  return false;
}

function findNearestVisibleBlockFromNames(
  bot: MineflayerBot,
  blockNames: string[],
  radius: number,
  visibleStep: number,
  maxScanPerName = 96,
  centerPos?: PositionCoordinates,
  centerRadius?: number
): { name: string; block: MineflayerBlock; distance: number } | null {
  const candidates: Array<{ name: string; block: MineflayerBlock; distance: number }> = [];
  for (const name of blockNames) {
    const found = findVisibleBlocksByName(bot, name, radius, 1, visibleStep, maxScanPerName);
    if (!found[0]) continue;

    if (
      centerPos &&
      typeof centerRadius === "number" &&
      centerRadius > 0 &&
      Math.hypot(
        found[0].block.position.x - centerPos.x,
        found[0].block.position.y - centerPos.y,
        found[0].block.position.z - centerPos.z
      ) > centerRadius
    ) {
      continue;
    }
    candidates.push({ name, block: found[0].block, distance: found[0].distance });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0];
}

function normalizeLooseText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[，,。.!！?？:：;；'"“”‘’\s]/g, "")
    .trim();
}

function extractChallengeTargetText(text: string): string | null {
  const raw = text.trim();
  if (!raw) return null;
  const m = raw.match(/挑战(?:一下)?[\s,，:：。.!！?？]*(.+)$/);
  if (!m) return null;
  const target = (m[1] || "").trim();
  return target || null;
}

function stopDuel(
  botId: string,
  registry: BotRegistry,
  outcome: "finished" | "failed" | "cancelled" = "cancelled",
  detail = "duel stopped",
  payload?: Record<string, unknown>
): void {
  duelSessionLifecycle.stop(botId);
  movementIntentStore.delete(botId);
  try {
    stopMovement(botId, registry);
  } catch {
    // ignore
  }
  finalizeAgentTask(botId, outcome, {
    ifType: "duel",
    detail,
    payload
  });
  if (outcome === "finished" || outcome === "failed") {
    publishHierarchicalTaskLifecycle(
      botId,
      registry,
      outcome === "finished" ? "task_finished" : "task_failed",
      "duel",
      detail,
      payload
    );
  }
}

function startDuel(
  botId: string,
  registry: BotRegistry,
  requester: string,
  targetEntity: { entityId?: number; name?: string; displayName?: string | null; type?: string }
): string {
  if (typeof targetEntity.entityId !== "number") {
    throw new Error("Challenge target is missing a stable entity id");
  }
  stopDuel(botId, registry);
  stopFollowLoop(botId, registry);
  stopGotoPositionLoop(botId, registry);

  const runtime = registry.get(botId);
  duelSessionLifecycle.setSession(botId, {
    targetId: targetEntity.entityId,
    targetName: targetEntity.name || targetEntity.displayName || "unknown",
    requester,
    startedAt: Date.now(),
    lastAttackAt: 0,
    lastSeenAt: Date.now()
  });
  startAgentTask(botId, {
    type: "duel",
    source: "manual_command",
    goal: `duel ${targetEntity.name || targetEntity.displayName || "unknown"}`,
    params: {
      targetId: targetEntity.entityId,
      targetName: targetEntity.name || targetEntity.displayName || "unknown",
      requester
    },
    detail: `attacking ${targetEntity.name || targetEntity.displayName || "unknown"}`
  });

  const entityUnsubscribe = runtime.subscribeEntityEvents((event) => {
    if (event.type === "entity_dead") {
      const session = duelSessionLifecycle.get(botId);
      if (!session || event.entity.entityId !== session.targetId) return;
      recordAgentEvent(botId, "entity_dead", "normal", {
        entityId: event.entity.entityId,
        entityName: session.targetName,
        context: "duel_target"
      });
      sendRuntimeChatNoWait(botId, registry, "就这");
      stopDuel(botId, registry, "finished", `defeated ${session.targetName}`, {
        targetId: session.targetId,
        targetName: session.targetName,
        requester: session.requester
      });
      return;
    }

    recordAgentEvent(botId, "entity_dead", "high", {
      entityName: "self",
      context: "duel_self"
    });
    stopDuel(botId, registry, "failed", "bot died during duel");
  });
  const movementUnsubscribe = runtime.subscribeMovementEvents((event) => {
    const failure = getCurrentMovementFailure(event, movementIntentStore.get(botId), "pursue_entity");
    if (!failure || !duelSessionLifecycle.has(botId)) return;
    movementIntentStore.delete(botId);
    stopDuel(botId, registry, "failed", `cannot safely pursue duel target (${failure.reason})`);
  });
  duelSessionLifecycle.trackSubscriptions(botId, { entityUnsubscribe, movementUnsubscribe });

  const loop = setInterval(() => {
    const session = duelSessionLifecycle.get(botId);
    if (!session) {
      stopDuel(botId, registry);
      return;
    }

    try {
      const self = runtime.getSelfState();
      const target = runtime.getNearbyEntities(64)
        .find((entity) => entity.entityId === session.targetId);
      const decision = decideDuelTick(session, {
        selfHealth: self?.health ?? 0,
        targetVisible: !!target,
        targetDistance: target?.distance
      }, Date.now());
      if (decision.outcome !== "continue") {
        stopDuel(botId, registry, decision.outcome, decision.detail);
        return;
      }
      duelSessionLifecycle.setSession(botId, decision.nextSession);
      if (!target || target.distance === undefined) return;

      updateAgentTask(botId, {
        detail: decision.detail
      });
      if (decision.movement === "approach") {
        const targetPosition = target.position;
        const pursuitKey = targetPosition
          ? `duel:${session.targetId}:${Math.floor(targetPosition.x)},${Math.floor(targetPosition.y)},${Math.floor(targetPosition.z)},2`
          : `duel:${session.targetId}:unknown,2`;
        if (movementIntentStore.get(botId) !== pursuitKey) {
          movementIntentStore.set(botId, pursuitKey);
          void runtime.pursueEntity({
            entityId: session.targetId,
            stopDistance: 2,
            sprint: true,
            movementId: pursuitKey
          }).catch((error) => {
            if (movementIntentStore.get(botId) !== pursuitKey) return;
            movementIntentStore.delete(botId);
            if (error instanceof SafePathError) {
              stopDuel(botId, registry, "failed", `cannot safely pursue duel target (${error.reason})`);
            }
          });
        }
      } else if (decision.movement === "hold" && movementIntentStore.has(botId)) {
        movementIntentStore.delete(botId);
        void runtime.stopMovement().catch(() => {});
      }

      if (decision.shouldAttack) {
        void runtime.attackEntity({
          entityId: session.targetId,
          maxDistance: 4.5
        }).catch(() => {
          // Target movement between snapshot and hit is retried on the next eligible tick.
        });
      }
    } catch {
      stopDuel(botId, registry);
    }
  }, 250);

  duelSessionLifecycle.trackInterval(botId, loop);
  return `Started duel with '${targetEntity.name || targetEntity.displayName || targetEntity.type}' (range=16)`;
}

type ToolCategory = "sword" | "axe" | "pickaxe" | "food";
type ArmorPart = "helmet" | "chestplate" | "leggings" | "boots";

function toolTierScore(name: string): number {
  if (name.includes("netherite")) return 7;
  if (name.includes("diamond")) return 6;
  if (name.includes("iron")) return 5;
  if (name.includes("golden")) return 4;
  if (name.includes("stone")) return 3;
  if (name.includes("wooden")) return 2;
  return 1;
}

function armorTierScore(name: string): number {
  if (name.includes("netherite")) return 7;
  if (name.includes("diamond")) return 6;
  if (name.includes("iron")) return 5;
  if (name.includes("golden")) return 4;
  if (name.includes("chainmail")) return 3;
  if (name.includes("leather")) return 2;
  if (name.includes("turtle")) return 5; // turtle helmet is close to iron tier use case
  return 1;
}

function isArmorItem(name: string, part: ArmorPart): boolean {
  if (!name) return false;
  if (part === "helmet") return name.endsWith("_helmet") || name === "turtle_helmet";
  if (part === "chestplate") return name.endsWith("_chestplate");
  if (part === "leggings") return name.endsWith("_leggings");
  if (part === "boots") return name.endsWith("_boots");
  return false;
}

function findBestArmorItem(items: Array<{ name: string }>, part: ArmorPart): { name: string } | null {
  const matches = items.filter((item) => isArmorItem(item.name, part));
  if (matches.length === 0) return null;
  matches.sort((a, b) => armorTierScore(b.name) - armorTierScore(a.name));
  return matches[0];
}

function isCategoryItem(name: string, category: ToolCategory): boolean {
  if (!name) return false;
  if (category === "food") return isFoodItemName(name);
  if (category === "sword") return name.endsWith("_sword");
  if (category === "axe") return name.endsWith("_axe");
  if (category === "pickaxe") return name.endsWith("_pickaxe");
  return false;
}

function findBestCategoryItem<T extends { name: string }>(items: T[], category: ToolCategory): T | null {
  const matches = items.filter((item) => isCategoryItem(item.name, category));
  if (matches.length === 0) return null;
  if (category === "food") {
    return getBestFoodItem(matches);
  }
  matches.sort((a, b) => toolTierScore(b.name) - toolTierScore(a.name));
  return matches[0];
}

async function ensureCombatWeaponEquipped(botId: string, bot: any): Promise<string | null> {
  const now = Date.now();
  const last = combatExecutionStateStore.getLastEquipAt(botId) ?? 0;
  if (now - last < 700) return bot.heldItem?.name ?? null;

  const items = bot.inventory.items();
  const sword = findBestCategoryItem(items, "sword");
  const axe = findBestCategoryItem(items, "axe");
  const weapon = sword ?? axe;
  if (!weapon) return null;

  await bot.equip(weapon, "hand");
  combatExecutionStateStore.recordEquip(botId, now);
  return weapon.name ?? null;
}

async function equipBestArmor(bot: any): Promise<Array<{ part: ArmorPart; item: string | null; equipped: boolean }>> {
  const parts: Array<{ part: ArmorPart; destination: "head" | "torso" | "legs" | "feet" }> = [
    { part: "helmet", destination: "head" },
    { part: "chestplate", destination: "torso" },
    { part: "leggings", destination: "legs" },
    { part: "boots", destination: "feet" }
  ];

  const results: Array<{ part: ArmorPart; item: string | null; equipped: boolean }> = [];
  for (const p of parts) {
    const best = findBestArmorItem(bot.inventory.items(), p.part);
    if (!best) {
      results.push({ part: p.part, item: null, equipped: false });
      continue;
    }

    try {
      await bot.equip(best, p.destination);
      results.push({ part: p.part, item: best.name, equipped: true });
    } catch {
      results.push({ part: p.part, item: best.name, equipped: false });
    }
  }

  return results;
}

function maybeAlertGuard(botId: string, registry: BotRegistry, message: string): void {
  const cfg = getOrCreateSelfGuardConfig(botId);
  const now = Date.now();
  const decision = evaluateSelfGuardAlertCooldown({
    chatAlertsEnabled: cfg.chatAlerts,
    now,
    lastAlertAt: selfGuardRuntimeStateStore.get(botId)?.lastAlertAt,
    cooldownMs: cfg.alertCooldownMs
  });
  if (!decision.allowed) return;

  selfGuardRuntimeStateStore.update(botId, {
    lastAlertAt: decision.nextLastAlertAt
  });
  try {
    sendRuntimeChatNoWait(botId, registry, message);
    socialRuntimeStateStore.recordProactiveSpeak(botId, decision.nextLastAlertAt);
  } catch {
    // ignore disconnected bot
  }
}

function queueSelfGuardTask(botId: string, task: () => Promise<void>): void {
  selfGuardTaskQueue.enqueue(botId, task);
}

function queueMiningTask<T>(botId: string, task: () => Promise<T>): Promise<T> {
  return miningTaskQueue.enqueue(botId, task);
}

function getUnifiedWhitelist(botId: string): Set<string> {
  const merged = new Set<string>();
  const chatCfg = chatListenerConfigStore.get(botId);
  const aiCfg = chatAiConfigStore.get(botId);
  for (const name of chatCfg?.whitelist ?? []) merged.add(name);
  for (const name of aiCfg?.whitelist ?? []) merged.add(name);
  return merged;
}

async function performCombatHit(botId: string, registry: BotRegistry, target: any): Promise<void> {
  const bot = registry.get(botId).getActiveBotOrThrow() as any;
  await ensureCombatWeaponEquipped(botId, bot);
  const hitIndex = combatExecutionStateStore.nextHitIndex(botId);
  const doCritical = hitIndex % 4 !== 0; // ~3/4 hits are jump-crit style

  await bot.lookAt(target.position.offset(0, 1.2, 0), true);
  if (doCritical) {
    bot.setControlState("jump", true);
    await waitMs(120);
    bot.setControlState("jump", false);
    await waitMs(90);
  }
  bot.attack(target);
}

function stopGotoPositionLoop(
  botId: string,
  registry: BotRegistry,
  outcome: "finished" | "failed" | "cancelled" = "cancelled",
  detail = "move stopped"
): void {
  positionMovementLifecycle.stop(botId);
  movementIntentStore.delete(botId);
  try {
    const runtime = registry.get(botId);
    if (runtime.getSelfState()) {
      void runtime.stopMovement().catch(() => {});
    }
  } catch {
    // ignore
  }
  finalizeAgentTask(botId, outcome, {
    ifType: ["move_to_position", "pathfind_move"],
    detail
  });
  if (outcome === "finished" || outcome === "failed") {
    publishHierarchicalTaskLifecycle(
      botId,
      registry,
      outcome === "finished" ? "task_finished" : "task_failed",
      "move_to_position",
      detail
    );
  }
}

function goToPosition(
  botId: string,
  registry: BotRegistry,
  position: PositionCoordinates,
  stopRadius = 2.3
): void {
  stopFollowLoop(botId, registry);
  stopGotoPositionLoop(botId, registry);
  const target = { x: position.x, y: position.y, z: position.z };
  const goalKey = `${Math.floor(target.x)},${Math.floor(target.y)},${Math.floor(target.z)},${Math.max(1, Math.floor(stopRadius))}`;
  const movementId = `goto:${goalKey}`;
  const runtime = registry.get(botId);
  startAgentTask(botId, {
    type: "move_to_position",
    source: "runtime",
    goal: `move to ${Math.floor(target.x)},${Math.floor(target.y)},${Math.floor(target.z)}`,
    params: { ...target, stopRadius }
  });

  const loop = setInterval(() => {
    try {
      const current = runtime.getSelfState()?.position;
      if (!current) {
        throw new Error(`Bot '${botId}' position is unavailable`);
      }
      const decision = decidePositionMovement(current, target, stopRadius);
      if (decision.status === "arrived") {
        stopGotoPositionLoop(botId, registry, "finished", "arrived at destination");
        return;
      }

      updateAgentTask(botId, {
        detail: `moving to target (${decision.distance.toFixed(1)} blocks away)`
      });
      if (movementIntentStore.get(botId) !== movementId) {
        movementIntentStore.set(botId, movementId);
        void runtime.moveTo({ ...target, stopRadius, movementId }).catch((error) => {
          if (!positionMovementLifecycle.isCurrent(botId, loop) || movementIntentStore.get(botId) !== movementId) return;
          const detail = error instanceof Error ? `move loop error: ${error.message}` : "move loop error";
          stopGotoPositionLoop(botId, registry, "failed", detail);
        });
      }
    } catch {
      stopGotoPositionLoop(botId, registry, "failed", "move loop error");
    }
  }, 200);

  const movementUnsubscribe = runtime.subscribeMovementEvents((event) => {
    const failure = getCurrentMovementFailure(event, movementIntentStore.get(botId), "move_to_position");
    if (!failure || !positionMovementLifecycle.isCurrent(botId, loop)) return;
    movementIntentStore.delete(botId);
    stopGotoPositionLoop(botId, registry, "failed", `continuous move failed (${failure.reason})`);
  });
  positionMovementLifecycle.activate(botId, loop, movementUnsubscribe);
}

async function performIdleWanderStep(botId: string, registry: BotRegistry): Promise<void> {
  const bot = registry.get(botId).getActiveBotOrThrow() as any;
  const yaw = bot.entity.yaw + (Math.random() * 2 - 1) * (Math.PI / 1.5);
  const jump = Math.random() < 0.2;
  startAgentTask(botId, {
    type: "pathfind_move",
    source: "runtime",
    goal: "idle wander step",
    params: { jump },
    detail: "wandering nearby"
  });
  try {
    await bot.look(yaw, bot.entity.pitch, true);
    bot.setControlState("jump", jump);
    bot.setControlState("sprint", false);
    bot.setControlState("forward", true);
    await waitMs(900 + Math.floor(Math.random() * 900));
    bot.setControlState("forward", false);
    bot.setControlState("jump", false);
    finalizeAgentTask(botId, "finished", {
      ifType: "pathfind_move",
      detail: "wander step finished"
    });
    publishHierarchicalTaskLifecycle(botId, registry, "task_finished", "pathfind_move", "wander step finished");
  } catch (error) {
    bot.setControlState("forward", false);
    bot.setControlState("jump", false);
    finalizeAgentTask(botId, "failed", {
      ifType: "pathfind_move",
      detail: "wander step failed",
      lastError: error instanceof Error ? error.message : String(error)
    });
    publishHierarchicalTaskLifecycle(botId, registry, "task_failed", "pathfind_move", "wander step failed", {
      lastError: error instanceof Error ? error.message : String(error)
    });
  }
}

async function performIdleSocialize(botId: string, registry: BotRegistry): Promise<void> {
  const runtime = registry.get(botId);
  const selfState = runtime.getSelfState();
  if (!selfState) {
    throw new Error(`Bot '${botId}' self state is unavailable`);
  }
  const whitelist = getUnifiedWhitelist(botId);
  if (whitelist.size === 0) return;
  const rememberedProfiles = getOrCreateMemoryPlayerProfiles(botId);
  const now = Date.now();
  const maxDistance = activePromptProfile.nearPlayerDistance + 2;
  const nearest = selectIdleSocialTarget({
    players: runtime.getNearbyPlayers(maxDistance),
    whitelist,
    profiles: rememberedProfiles,
    selfUsername: selfState.username,
    maxDistance,
    now
  });
  if (!nearest) return;

  if (!getAgentHierarchicalRuntime(botId).claimIdleSocialAttempt(
    now,
    Math.max(activePromptProfile.idleSpeakCooldownMs, 20_000)
  )) return;

  startAgentTask(botId, {
    type: "pathfind_move",
    source: "runtime",
    goal: `socialize with ${nearest.username}`,
    params: { playerName: nearest.username },
    detail: `looking at ${nearest.username}`
  });
  try {
    const bot = runtime.getActiveBotOrThrow() as any;
    const targetEntity = bot.players?.[nearest.username]?.entity;
    if (!targetEntity) {
      throw new Error(`Player '${nearest.username}' is no longer visible nearby`);
    }
    await bot.lookAt(targetEntity.position.offset(0, 1.2, 0), true);
    const tagsText = (nearest.profile?.tags ?? []).join(" ").toLowerCase();
    const displayName = String(nearest.profile?.alias ?? nearest.username).trim() || nearest.username;
    const fallbackLine =
      nearest.profile?.relation === "owner"
        ? `${displayName}。`
        : /friend|trusted|熟悉/.test(tagsText)
          ? `又是你，${displayName}。`
          : "怎么了。";
    maybeSceneLine(botId, registry, "nearPlayer", fallbackLine, { proactive: true, cooldownMs: 20_000 });
    finalizeAgentTask(botId, "finished", {
      ifType: "pathfind_move",
      detail: `socialized with ${nearest.username}`
    });
    publishHierarchicalTaskLifecycle(
      botId,
      registry,
      "task_finished",
      "pathfind_move",
      `socialized with ${nearest.username}`
    );
  } catch (error) {
    finalizeAgentTask(botId, "failed", {
      ifType: "pathfind_move",
      detail: `failed to socialize with ${nearest.username}`,
      lastError: error instanceof Error ? error.message : String(error)
    });
    publishHierarchicalTaskLifecycle(
      botId,
      registry,
      "task_failed",
      "pathfind_move",
      `failed to socialize with ${nearest.username}`,
      {
        lastError: error instanceof Error ? error.message : String(error)
      }
    );
  }
}

async function executeNextPlannedStep(botId: string, registry: BotRegistry): Promise<boolean> {
  const cfg = getOrCreateAgentConfig(botId);
  const runtime = getAgentHierarchicalRuntime(botId);
  const queuedAction = runtime.peekNextAction();
  if (!queuedAction || queuedAction.kind !== "tool_call") return false;
  runtime.dequeueNextAction();
  const step: AgentPlanStep = {
    tool: String(queuedAction.params.tool ?? ""),
    arguments:
      queuedAction.params.arguments && typeof queuedAction.params.arguments === "object"
        ? { ...(queuedAction.params.arguments as Record<string, unknown>) }
        : {},
    speak: typeof queuedAction.params.speak === "string" ? queuedAction.params.speak : undefined
  };
  if (!step.tool) return true;
  recordAgentEvent(botId, "task_progress", "normal", {
    taskId: getActiveAgentTask(botId)?.taskId ?? null,
    taskType: getActiveAgentTask(botId)?.type ?? null,
    detail: `executor running ${step.tool}`
  });

  if (!cfg.allowedTools.includes(step.tool)) {
    recordAgentEvent(botId, "task_failed", "normal", {
      taskType: "executor_step",
      detail: `tool '${step.tool}' is not allowed`,
      stepTool: step.tool
    });
    return true;
  }

  const activeTask = getActiveAgentTask(botId);
  if (!canAgentInterruptActiveTask(activeTask, step.tool)) {
    runtime.requeueAction(queuedAction);
    return false;
  }

  if (step.speak) {
    try {
      await sendRuntimeChat(botId, registry, step.speak);
    } catch {
      // ignore
    }
  }

  try {
    const result = await executeAgentToolCall(botId, registry, step.tool, step.arguments ?? {});
    agentConfigStore.updateRuntimeDiagnostics(botId, { lastPlanResult: result });
    recordAgentEvent(botId, "step_executed", "normal", {
      tool: step.tool,
      result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    agentConfigStore.updateRuntimeDiagnostics(botId, { lastPlanResult: message });
    recordAgentEvent(botId, "task_failed", "normal", {
      taskType: "executor_step",
      detail: `executor failed on ${step.tool}`,
      stepTool: step.tool,
      lastError: message
    });
  }
  return true;
}

async function executeHierarchicalRuntimeAction(botId: string, registry: BotRegistry): Promise<boolean> {
  hierarchicalAgents.syncBotIds(registry.listBotIds());
  syncHierarchicalAgentState(botId, registry);
  publishHierarchicalTick(botId, registry);
  const runtime = hierarchicalAgents.ensure(botId);
  runtime.pollExpiredTimers();

  const preview = runtime.chooseNextSkillInvocation();
  if (!preview) return false;

  const cfg = getOrCreateAgentConfig(botId);
  if (!cfg.allowedTools.includes(preview.invocation.skill)) {
    runtime.bindNextAction();
    runtime.ingestEvent({
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: "task_failed",
      priority: "normal",
      createdAt: Date.now(),
      payload: {
        taskType: preview.action.kind,
        detail: `hierarchical runtime blocked tool '${preview.invocation.skill}'`
      }
    });
    runtime.finishActiveExecution();
    return false;
  }

  const activeTask = getActiveAgentTask(botId);
  if (!canAgentInterruptActiveTask(activeTask, preview.invocation.skill)) {
    return false;
  }

  const bound = runtime.bindNextAction();
  if (!bound) return false;

  try {
    const result = await executeAgentToolCall(botId, registry, bound.invocation.skill, bound.invocation.args);
    agentConfigStore.updateRuntimeDiagnostics(botId, { lastPlanResult: result });
    runtime.ingestEvent({
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: "task_finished",
      priority: "normal",
      createdAt: Date.now(),
      payload: {
        taskType: bound.action.kind,
        detail: `executed ${bound.invocation.skill}`,
        skill: bound.invocation.skill,
        result
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    agentConfigStore.updateRuntimeDiagnostics(botId, { lastPlanResult: message });
    runtime.ingestEvent({
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: "task_failed",
      priority: "high",
      createdAt: Date.now(),
      payload: {
        taskType: bound.action.kind,
        detail: `failed ${bound.invocation.skill}`,
        skill: bound.invocation.skill,
        lastError: message
      }
    });
  } finally {
    runtime.finishActiveExecution();
  }

  return true;
}

function getStrategicRepairInstruction(botId: string, registry: BotRegistry): string | null {
  const goal = getStrategicGoal(botId);
  if (!goal) return null;
  try {
    const runtime = hierarchicalAgents.ensure(botId);
    const recent = [...runtime.snapshot().recentEvents].reverse();
    const failure = recent.find((event) => event.type === "task_failed" || event.type === "task_timeout");
    if (!failure) return null;
    if (!maybeMarkStrategicGoalFailure(botId, registry, failure.id)) return null;
    const detail = String(failure.payload.detail ?? failure.payload.taskType ?? failure.type).trim();
    const failureCount = (getStrategicGoal(botId)?.failureCount ?? 1);
    return [
      `Repair the current strategic goal: ${goal.goal}.`,
      goal.rationale ? `Original rationale: ${goal.rationale}.` : "",
      `Recent failure: ${detail}.`,
      `Consecutive repair-triggering failures for this goal: ${failureCount}.`,
      failureCount >= 3
        ? "You must be more conservative now: reduce scope, switch to a safer supporting action, or temporarily abandon the goal."
        : "Prefer a minimal correction before changing the goal entirely.",
      "Produce one short corrective directive that either retries more safely, scales the goal down, or shifts to a nearby supporting action.",
      "Avoid repeating the exact same failed action if the context still suggests it will fail."
    ]
      .filter(Boolean)
      .join(" ");
  } catch {
    return null;
  }
}

async function runAgentExecutorTick(botId: string, registry: BotRegistry): Promise<void> {
  const cfg = getOrCreateAgentConfig(botId);
  if (!cfg.enabled || cfg.mode === "manual") return;
  if (await executeHierarchicalRuntimeAction(botId, registry)) {
    setAgentRuntimeState(botId, getActiveAgentTask(botId) ? "task_running" : "idle");
    return;
  }
  if (await executeNextPlannedStep(botId, registry)) {
    setAgentRuntimeState(botId, getActiveAgentTask(botId) ? "task_running" : "idle");
    return;
  }
  if (cfg.mode !== "auto") return;
  if (isBotBusy(botId)) {
    setAgentRuntimeState(botId, "task_running");
    return;
  }
  if (await maybeHandleTerritoryWarning(botId, registry)) {
    setAgentRuntimeState(botId, "idle");
    return;
  }
  if (await maybeActivateStrategicGoal(botId, registry)) {
    setAgentRuntimeState(botId, "task_running");
    return;
  }
  if (await maybeHandleStrategicLifecycleReport(botId, registry, cfg)) {
    setAgentRuntimeState(botId, "idle");
    return;
  }
  if (!getActiveAgentTask(botId) && getQueuedPlannerSteps(botId).length === 0) {
    try {
      const stateSnapshot = buildAgentStateSnapshot(botId, registry);
      const instruction =
        getStrategicRepairInstruction(botId, registry) ||
        getPendingStrategicLifecycleInstruction(botId, cfg, stateSnapshot) ||
        (cfg.allowProactiveAction ? buildAutonomousPlanningInstruction(cfg, stateSnapshot) : null);
      if (instruction) {
        const result = await runAgentPlanningTurn(botId, registry, cfg, instruction, null, "strategic_pass");
        if (result.executionResult !== "no_action") {
          return;
        }
      }
    } catch (error) {
      if (error instanceof AiRequestError && error.kind === "cancelled") return;
      // keep idle policy fallback alive
    }
  }

  const runtime = registry.get(botId);
  setAgentRuntimeState(botId, "idle");
  if (cfg.autoIdlePolicy === "follow_owner") {
    const owner = cfg.owner.trim();
    if (!owner) return;
    const location = requireSelfLocation(runtime.getSelfState(), botId);
    const ownerSnapshot = runtime.getPlayerSnapshot(owner);
    const fallbackPlace = findPreferredFallbackPlace(botId, location.position, location.dimension);
    const decision = decideIdleFollowAction(location.position, ownerSnapshot, fallbackPlace);

    if (decision.action === "return_to_place") {
      goToPosition(botId, registry, decision.target, 2.5);
      recordAgentEvent(botId, "task_progress", "normal", {
        taskType: "move_to_position",
        detail: `owner absent, fallback to remembered place '${decision.target.label}'`,
        placeId: decision.target.placeId
      });
      return;
    }

    if (decision.action === "follow_owner") {
      startFollow(
        botId,
        registry,
        {
          playerName: owner,
          minDistance: 2.5,
          maxDistance: 32,
          sprint: decision.sprint,
          tickMs: 250,
          targetStillStopMs: 16000
        },
        "runtime"
      );
    }
    return;
  }

  if (cfg.autoIdlePolicy === "wander") {
    await performIdleWanderStep(botId, registry);
    return;
  }

  if (cfg.autoIdlePolicy === "socialize_whitelist") {
    await performIdleSocialize(botId, registry);
  }
}

function stopAgentExecutorLoop(botId: string): void {
  agentExecutorLifecycle.stop(botId);
}

function startAgentExecutorLoop(botId: string, registry: BotRegistry): void {
  stopAgentExecutorLoop(botId);
  const cfg = getOrCreateAgentConfig(botId);
  if (!cfg.enabled || cfg.mode === "manual") return;
  agentExecutorLifecycle.start(botId, Math.max(1500, cfg.planCooldownMs), async () => {
    try {
      await runAgentExecutorTick(botId, registry);
    } catch {
      // bot may be disconnected or reconnecting
    }
  });
}

async function sendReportToNearestWhitelist(botId: string, registry: BotRegistry): Promise<void> {
  const runtime = registry.get(botId);
  const whitelist = getUnifiedWhitelist(botId);
  if (whitelist.size === 0) return;

  const nearest = selectNearestWhitelistedPlayer(
    runtime.getNearbyPlayers(Number.MAX_SAFE_INTEGER),
    whitelist
  );
  if (!nearest) return;

  goToPosition(botId, registry, nearest.position, 2.5);

  maybeSceneLine(botId, registry, "reportToWhitelist", "QAQ", { proactive: true });
}

function ensureRetaliationLoop(botId: string, registry: BotRegistry): void {
  const maxChaseMs = 60_000;

  selfGuardLoopLifecycle.ensureRetaliation(botId, 250, () => {
    const session = retaliationStateStore.getSession(botId);
    if (!session) {
      selfGuardLoopLifecycle.stopRetaliation(botId);
      return;
    }

    void queueSelfGuardTask(botId, async () => {
      try {
        const cfg = selfGuardConfigStore.get(botId);
        if (!cfg?.enabled) return;
        const runtime = registry.get(botId);
        const targetSnapshot = resolveRetaliationTarget({
          targetUsername: session.attackerName,
          player: runtime.getPlayerSnapshot(session.attackerName),
          selfPosition: runtime.getSelfState()?.position
        });
        const decision = decideRetaliationTick(
          session,
          { targetDistance: targetSnapshot?.distance },
          Date.now(),
          {
            maxChaseMs,
            approachDistance: 3,
            attackDistance: cfg.retaliationMaxDistance,
            attackCooldownMs: 600
          }
        );

        if (decision.status === "timed_out") {
          const bot = runtime.getActiveBotOrThrow() as any;
          bot.setControlState("forward", false);
          bot.setControlState("sprint", false);
          bot.setControlState("jump", false);
          bot.setControlState("sneak", false);
          retaliationStateStore.deleteSession(botId);
          selfGuardLoopLifecycle.stopRetaliation(botId);
          publishHierarchicalEvent(botId, registry, "task_timeout", "high", {
            taskType: "retaliation",
            detail: "retaliation chase timed out"
          });
          maybeSceneLine(botId, registry, "followStopped", "追击超时，我先停手。");
          await sendReportToNearestWhitelist(botId, registry);
          return;
        }

        if (decision.status === "target_unavailable") {
          retaliationStateStore.deleteSession(botId);
          selfGuardLoopLifecycle.stopRetaliation(botId);
          return;
        }

        const bot = runtime.getActiveBotOrThrow();
        const target = bot.players[session.attackerName]?.entity;
        if (!target) {
          retaliationStateStore.deleteSession(botId);
          selfGuardLoopLifecycle.stopRetaliation(botId);
          return;
        }

        bot.setControlState("sprint", true);

        if (decision.movement === "approach") {
          const pathSet = setPathfinderGoalNear(botId, bot, target.position, 2);
          if (!pathSet) {
            await bot.lookAt(target.position.offset(0, 1.2, 0), true);
            bot.setControlState("forward", true);
          } else {
            bot.setControlState("forward", false);
          }
        } else {
          const pathApi = (bot as any).pathfinder;
          if (pathApi && typeof pathApi.setGoal === "function") {
            pathApi.setGoal(null);
          }
          movementIntentStore.delete(botId);
          bot.setControlState("forward", false);
        }

        if (decision.shouldAttack) {
          await performCombatHit(botId, registry, target);
          session.lastAttackAt = Date.now();
          session.remainingHits -= 1;
          retaliationStateStore.setSession(botId, session);
        }

        if (session.remainingHits <= 0) {
          bot.setControlState("forward", false);
          bot.setControlState("sprint", false);
          retaliationStateStore.deleteSession(botId);
          selfGuardLoopLifecycle.stopRetaliation(botId);
          await sendReportToNearestWhitelist(botId, registry);
        }
      } catch {
        // bot reconnecting; keep loop alive
      }
    });
  });
}

function cleanupRetaliationDecay(botId: string, cfg: SelfGuardConfig): void {
  retaliationStateStore.pruneExpiredHits(botId, Date.now(), cfg.retaliationDecayMs);
}

function handleHitReaction(
  botId: string,
  registry: BotRegistry,
  cfg: SelfGuardConfig,
  bot: any
): void {
  const previousHealth = selfGuardRuntimeStateStore.get(botId)?.lastHealth;
  recordAgentEvent(botId, "hurt", "high", {
    source: "unknown",
    healthBefore: previousHealth ?? null,
    healthAfter: bot.health
  });
  publishHierarchicalEvent(botId, registry, "hurt", "critical", {
    attackerName: "unknown",
    healthBefore: previousHealth ?? null,
    healthAfter: bot.health
  });
  socialRuntimeStateStore.setMood(botId, "警觉");
  const runtime = registry.get(botId);
  const selfState = runtime.getSelfState();
  const attackerDetectDistance = Math.max(cfg.retaliationMaxDistance, 16);
  const likelyAttacker = selectLikelyRetaliationAttacker({
    players: runtime.getNearbyPlayers(attackerDetectDistance),
    selfUsername: selfState?.username ?? bot.username,
    selfPosition: selfState?.position,
    maxDistance: attackerDetectDistance
  });

  log("info", "Hit reaction detected", {
    botId,
    attackerDetectDistance,
    likelyAttacker: likelyAttacker?.username ?? null,
    likelyAttackerDistance: likelyAttacker ? Number(likelyAttacker.distance.toFixed(2)) : null
  });

  if (!likelyAttacker) {
    maybeSceneLine(botId, registry, "attacked", "我被打到了，先警惕一下。");
    return;
  }

  const whitelist = getUnifiedWhitelist(botId);
  const isWhitelistedAttacker = whitelist.size > 0 && whitelist.has(likelyAttacker.username);
  publishHierarchicalEvent(botId, registry, "hurt", "critical", {
    attackerName: likelyAttacker.username,
    isWhitelistedAttacker,
    healthBefore: previousHealth ?? null,
    healthAfter: bot.health
  });
  if (isWhitelistedAttacker) {
    maybeSceneLine(botId, registry, "attackedByWhitelist", "别打我啦，我会疼的。");
    return;
  }

  maybeSceneLine(botId, registry, "attackedByNonWhitelist", "我要还手啦！");
  if (!cfg.retaliateOnNonWhitelistHit) return;

  const now = Date.now();
  const nextCount = retaliationStateStore.recordHit(
    botId,
    likelyAttacker.username,
    now,
    cfg.retaliationDecayMs
  );

  if (nextCount >= 3) {
    const session: RetaliationSessionState = {
      attackerName: likelyAttacker.username,
      remainingHits: 6,
      lastAttackAt: 0,
      startedAt: Date.now()
    };
    retaliationStateStore.setSession(botId, session);
    ensureRetaliationLoop(botId, registry);
    return;
  }

  const retaliateHits = nextCount === 1 ? 1 : 2;
  queueSelfGuardTask(botId, async () => {
    try {
      for (let i = 0; i < retaliateHits; i += 1) {
        const runtime = registry.get(botId);
        const targetSnapshot = resolveRetaliationTarget({
          targetUsername: likelyAttacker.username,
          player: runtime.getPlayerSnapshot(likelyAttacker.username),
          selfPosition: runtime.getSelfState()?.position
        });
        if (!targetSnapshot || targetSnapshot.distance > cfg.retaliationMaxDistance) return;

        const activeBot = runtime.getActiveBotOrThrow() as any;
        const target = activeBot.players[likelyAttacker.username]?.entity;
        if (!target) return;
        await performCombatHit(botId, registry, target);
        await waitMs(420);
      }
    } catch {
      // ignore retaliation failure
    }
  });
}

function ensureSelfGuardHurtHook(botId: string, registry: BotRegistry): void {
  let bot: any;
  try {
    bot = registry.get(botId).getActiveBotOrThrow();
  } catch {
    return;
  }

  selfGuardHurtSubscriptions.ensure(
    botId,
    bot as SelfGuardHurtBot,
    (currentBotId, config, currentBot) => {
      handleHitReaction(currentBotId, registry, config, currentBot);
    }
  );
}

function startSelfGuardLoop(botId: string, registry: BotRegistry): void {
  const initialConfig = getOrCreateSelfGuardConfig(botId);
  socialRuntimeStateStore.initializeInteraction(botId, Date.now());

  selfGuardLoopLifecycle.start(botId, initialConfig.tickMs, () => {
    try {
      const cfg = selfGuardConfigStore.get(botId);
      if (!cfg?.enabled) return;
      const runtime = registry.get(botId);
      const bot = runtime.getActiveBotOrThrow();
      ensureSelfGuardHurtHook(botId, registry);
      syncHierarchicalAgentState(botId, registry);
      const selfState = runtime.getSelfState();
      const vitals = evaluateSelfGuardVitals(selfState, cfg);
      const inventory = runtime.getInventoryState();
      const previousRuntimeState = selfGuardRuntimeStateStore.get(botId);
      const coreTransitions = evaluateSelfGuardCoreTransitions({
        currentBotRef: bot,
        previousBotRef: previousRuntimeState?.lastBotRef,
        previousHealth: previousRuntimeState?.lastHealth,
        vitals
      });
      if (coreTransitions.reconnected) {
        maybeSceneLine(botId, registry, "reconnectSuccess", "我回来啦，连接恢复。");
      }

      const environment = readSelfGuardEnvironment(bot);
      const environmentTransitions = detectSelfGuardEnvironmentTransitions(
        previousRuntimeState
          ? {
              isDay: previousRuntimeState.lastIsDay,
              isRaining: previousRuntimeState.lastIsRaining
            }
          : undefined,
        environment
      );
      if (environmentTransitions.nightStarted) {
        maybeSceneLine(botId, registry, "nightStart", "天黑了，我会更小心。");
      }
      if (environmentTransitions.rainStarted) {
        maybeSceneLine(botId, registry, "rainStart", "下雨了，视线有点差。");
      }
      selfGuardRuntimeStateStore.update(botId, {
        lastBotRef: bot,
        lastIsDay: environment.isDay,
        lastIsRaining: environment.isRaining
      });
      maybeRecordInventoryChanged(botId, inventory);
      maybePublishSelfGuardSignals(botId, registry, vitals, !!getBestFoodItem(inventory.items));

      const proximity = evaluateSelfGuardProximity(
        runtime.getNearbyPlayers(activePromptProfile.nearPlayerDistance),
        selfState?.username,
        activePromptProfile.nearPlayerDistance,
        previousRuntimeState?.lastIsNearPlayer ?? false
      );
      if (proximity.enteredNearRange && Math.random() < activePromptProfile.nearPlayerTalkChance) {
        maybeSceneLine(botId, registry, "nearPlayer", "怎么了。", { proactive: true });
      }
      selfGuardRuntimeStateStore.update(botId, { lastIsNearPlayer: proximity.isNear });

      const now = Date.now();
      const lastInteractionAt = socialRuntimeStateStore.getLastInteractionAt(botId) ?? now;
      if (now - lastInteractionAt >= activePromptProfile.idleNoInteractionMs) {
        maybeSceneLine(botId, registry, "idleMurmur", "……还活着吗。", {
          cooldownMs: activePromptProfile.idleSpeakCooldownMs,
          proactive: true
        });
      }

      if (Math.random() < activePromptProfile.randomSpeakChancePerTick) {
        maybeSceneLine(botId, registry, "randomMurmur", "小狸是由小狸驱动的小狸。", {
          cooldownMs: activePromptProfile.randomSpeakCooldownMs,
          proactive: true
        });
      }
      cleanupRetaliationDecay(botId, cfg);

      if (!vitals.available) return;
      const { health, food } = vitals;

      if (coreTransitions.healthDropped) {
        handleHitReaction(botId, registry, cfg, bot);
      }
      selfGuardRuntimeStateStore.update(botId, { lastHealth: health });

      if (cfg.autoStopFollowOnLowHealth && vitals.criticalHealth && followSessionLifecycle.has(botId)) {
        stopFollowLoop(botId, registry);
        socialRuntimeStateStore.setMood(botId, "紧张");
        maybeAlertGuard(
          botId,
          registry,
          renderLine(
            randomOf(activePromptProfile.stateLines.criticalHealth, "我血量危险（{health}），先停下保命。"),
            { health: health.toFixed(1) }
          )
        );
      } else if (vitals.lowHealth) {
        socialRuntimeStateStore.setMood(botId, "警觉");
        maybeAlertGuard(
          botId,
          registry,
          renderLine(
            randomOf(activePromptProfile.stateLines.lowHealth, "我血量偏低（{health}），先小心一点。"),
            { health: health.toFixed(1) }
          )
        );
      }

      if (!vitals.shouldEatNow) {
        if (vitals.shouldSetCalm) {
          socialRuntimeStateStore.setMood(botId, "平静");
        }
        return;
      }
      socialRuntimeStateStore.setMood(botId, "烦躁");
      if (vitals.shouldEatForFood) {
        maybeAlertGuard(
          botId,
          registry,
          renderLine(
            randomOf(activePromptProfile.stateLines.lowFood, "我有点饿了（{food}/20），想找点吃的。"),
            { food }
          )
        );
      }

      queueSelfGuardTask(botId, async () => {
        try {
          const queuedRuntime = registry.get(botId);
          const queuedVitals = evaluateSelfGuardVitals(queuedRuntime.getSelfState(), cfg);
          if (
            !queuedVitals.available ||
            (!queuedVitals.shouldEatForFood && !queuedVitals.shouldEatForHealing)
          ) {
            return;
          }
          const foodItem = getBestFoodItem(queuedRuntime.getInventoryState().items);
          if (!foodItem) {
            maybeAlertGuard(
              botId,
              registry,
              renderLine(
                randomOf(activePromptProfile.stateLines.noFood, "我饿了（{food}/20），但背包里没有吃的。"),
                { food: queuedVitals.food }
              )
            );
            return;
          }

          await queuedRuntime.eatFood({ itemName: foodItem.name });
          socialRuntimeStateStore.setMood(botId, "平静");
          maybeAlertGuard(
            botId,
            registry,
            renderLine(
              randomOf(activePromptProfile.stateLines.ateFood, "我先吃了 {item}，感觉好多了。"),
              { item: foodItem.name }
            )
          );
        } catch (error) {
          log("warn", "Self-guard auto-eat failed", {
            botId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });
    } catch {
      // disconnected/reconnecting; keep loop alive
    }
  });
}

function stopSelfGuardLoop(botId: string): void {
  selfGuardTaskQueue.invalidate(botId);
  selfGuardLoopLifecycle.stop(botId);
  selfGuardRuntimeStateStore.resetTick(botId);

  selfGuardHurtSubscriptions.delete(botId);

  selfGuardLoopLifecycle.stopRetaliation(botId);
  positionMovementLifecycle.stop(botId);
  retaliationStateStore.clearBot(botId);
  combatExecutionStateStore.clearBot(botId);
  movementIntentStore.delete(botId);
}

function ensureSelfGuardWatchdog(registry: BotRegistry): void {
  selfGuardLoopLifecycle.ensureWatchdog(1500, () => {
    for (const botId of registry.listBotIds()) {
      const cfg = selfGuardConfigStore.get(botId);
      if (!cfg?.enabled) continue;

      if (!selfGuardLoopLifecycle.has(botId)) {
        startSelfGuardLoop(botId, registry);
      }
    }
  });
}

function getOrCreateChatConfig(botId: string): ChatListenerConfig {
  return chatListenerConfigStore.getOrCreate(botId);
}

function applyDefaultChatListenerEnvConfig(): void {
  const botId = process.env.MCBOT_DEFAULT_BOT_ID?.trim();
  if (!botId) {
    if (process.env.MCBOT_DEFAULT_CHAT_LISTENER_ENABLED !== undefined) {
      log("warn", "Ignored default chat listener env config because MCBOT_DEFAULT_BOT_ID is empty");
    }
    return;
  }

  const cfg = getOrCreateChatConfig(botId);
  if (process.env.MCBOT_DEFAULT_CHAT_LISTENER_ENABLED !== undefined) {
    cfg.enabled = parseEnvBoolean(process.env.MCBOT_DEFAULT_CHAT_LISTENER_ENABLED, cfg.enabled);
  }

  const whitelist = parseEnvList(process.env.MCBOT_DEFAULT_CHAT_WHITELIST);
  if (whitelist !== undefined) {
    cfg.whitelist = new Set(whitelist);
  }

  const wakeNames = parseEnvList(process.env.MCBOT_DEFAULT_CHAT_WAKE_NAMES);
  if (wakeNames !== undefined && wakeNames.length > 0) {
    cfg.wakeNames = wakeNames;
  }

  const hiReply = process.env.MCBOT_DEFAULT_CHAT_HI_REPLY?.trim();
  if (hiReply) {
    const existing = cfg.specialReplies.find((reply) => normalizeIntentText(reply.trigger) === normalizeIntentText("hi小狸"));
    if (existing) {
      existing.reply = hiReply;
      existing.matchMode = "includes";
    } else {
      cfg.specialReplies.push({ trigger: "hi小狸", reply: hiReply, matchMode: "includes" });
    }
  }
}

function applyDefaultChatAiEnvConfig(): void {
  const botId = process.env.MCBOT_DEFAULT_BOT_ID?.trim();
  if (!botId) {
    if (process.env.MCBOT_DEFAULT_CHAT_AI_ENABLED !== undefined) {
      log("warn", "Ignored default chat AI env config because MCBOT_DEFAULT_BOT_ID is empty");
    }
    return;
  }

  const cfg = getOrCreateChatAiConfig(botId);
  if (process.env.MCBOT_DEFAULT_CHAT_AI_ENABLED !== undefined) {
    cfg.enabled = parseEnvBoolean(process.env.MCBOT_DEFAULT_CHAT_AI_ENABLED, cfg.enabled);
  }

  const whitelist = parseEnvList(process.env.MCBOT_DEFAULT_CHAT_AI_WHITELIST);
  if (whitelist !== undefined) {
    cfg.whitelist = new Set(whitelist);
  } else {
    const listenerWhitelist = getOrCreateChatConfig(botId).whitelist;
    if (cfg.whitelist.size === 0 && listenerWhitelist.size > 0) {
      cfg.whitelist = new Set(listenerWhitelist);
    }
  }

  const wakeWord = process.env.MCBOT_DEFAULT_CHAT_AI_WAKE_WORD?.trim();
  if (wakeWord) {
    cfg.wakeWord = wakeWord;
  }

  const model = process.env.MCBOT_DEFAULT_CHAT_AI_MODEL?.trim();
  if (model) {
    cfg.model = model;
  }

  const apiBaseUrl = process.env.MCBOT_AI_API_BASE_URL?.trim();
  if (apiBaseUrl) {
    cfg.apiBaseUrl = apiBaseUrl;
  }

  const generalModel = process.env.MCBOT_AI_MODEL?.trim();
  if (generalModel && !model) {
    cfg.model = generalModel;
  }

  if (!cfg.apiKey && process.env.MCBOT_AI_API_KEY) {
    cfg.apiKey = process.env.MCBOT_AI_API_KEY;
  }
}

function applyDefaultAgentEnvConfig(): void {
  const botId = process.env.MCBOT_DEFAULT_BOT_ID?.trim();
  if (!botId) return;

  const cfg = getOrCreateAgentConfig(botId);
  const apiBaseUrl = process.env.MCBOT_AI_API_BASE_URL?.trim();
  if (apiBaseUrl) {
    cfg.plannerApiBaseUrl = apiBaseUrl;
  }

  const model = process.env.MCBOT_AI_MODEL?.trim();
  if (model) {
    cfg.plannerModel = model;
  }

  if (!cfg.plannerApiKey && process.env.MCBOT_AI_API_KEY) {
    cfg.plannerApiKey = process.env.MCBOT_AI_API_KEY;
  }
}

function getOrCreateChatAiConfig(botId: string): ChatAiConfig {
  return chatAiConfigStore.getOrCreate(botId);
}

function getOrCreateTerritoryConfig(botId: string): TerritoryConfig {
  return territoryConfigStore.getOrCreate(botId);
}

function findSpecialReply(message: string, config: ChatListenerConfig): string | null {
  const text = message.trim();
  if (!text) return null;

  const lowered = text.toLowerCase();
  const normalizedText = normalizeIntentText(text);
  for (const rule of config.specialReplies) {
    const trigger = rule.trigger.trim();
    if (!trigger) continue;

    const triggerLower = trigger.toLowerCase();
    if (rule.matchMode === "exact") {
      if (lowered === triggerLower) return rule.reply;
      continue;
    }

    if (lowered.includes(triggerLower)) return rule.reply;
    const normalizedTrigger = normalizeIntentText(trigger);
    if (normalizedTrigger && normalizedText.includes(normalizedTrigger)) return rule.reply;
  }

  return null;
}
function extractIntent(message: string, config: ChatListenerConfig): string | null {
  const text = message.trim();
  if (!text) return null;

  if (config.dotPrefix && text.startsWith(config.dotPrefix)) {
    const intent = text.slice(config.dotPrefix.length).trim();
    return intent || null;
  }

  for (const wake of config.wakeNames) {
    if (!wake) continue;
    if (!text.startsWith(wake)) continue;
    const rest = text.slice(wake.length).replace(/^[\s,，:：。.!！?？]+/, "").trim();
    return rest || null;
  }

  return null;
}

function normalizeIntentText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[，,。.!！?？:：;；'"“”‘’\s]/g, "")
    .trim();
}

function matchesAnyIntent(text: string, phrases: string[]): boolean {
  const normalizedText = normalizeIntentText(text);
  for (const phrase of phrases) {
    if (!phrase) continue;
    if (text.includes(phrase)) return true;
    const normalizedPhrase = normalizeIntentText(phrase);
    if (normalizedPhrase && normalizedText.includes(normalizedPhrase)) return true;
  }
  return false;
}

function isLikelyStopIntent(text: string): boolean {
  if (matchesAnyIntent(text, ["停", "等等", "先别", "不要", "算了"])) {
    if (text.includes("跟") || text.includes("走")) return true;
  }
  return false;
}

function splitIntoSentences(text: string, maxSentences: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const parts = normalized
    .split(/(?<=[。！？!?.])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return [normalized.slice(0, 120)];
  }

  return parts.slice(0, maxSentences);
}

function isSelfDescriptionRequest(message: string): boolean {
  const normalized = normalizeIntentText(message);
  return (
    /[\u8bc4\u50f9\u5f62\u5bb9\u4ecb\u7ecd]/.test(message) &&
    /[\u4f60\u81ea\u5df1\u5c0f\u72f8]/.test(message)
  ) || (
    normalized.includes("nishishenme") ||
    normalized.includes("nishishui")
  );
}

function getLocalSelfDescriptionReply(): string {
  const lines = [
    "小狸？有点懒。",
    "安静，能干活。",
    "不算可爱。"
  ];
  return lines[Math.floor(Math.random() * lines.length)] ?? "小狸在。";
}


async function requestAiReply(
  botId: string,
  config: ChatAiConfig,
  username: string,
  message: string,
  requestStatus: AiRequestStatus,
  requestHandle: AiRequestHandle,
  dynamicStateText?: string
): Promise<{ content: string; model: string }> {
  const timeoutMs = requestStatus.timeoutMs;

  if (!config.apiKey) {
    throw new Error("AI API key is empty. Set MCBOT_AI_API_KEY or pass apiKey in chat.ai.configure");
  }

  const endpoint = buildOpenAiChatCompletionsEndpoint(config.apiBaseUrl);
  const sharedMemoryPrompt = await getSharedChatMemoryPromptText(botId);
  const highRiskClaim = isHighRiskChatMemoryClaim(message);
  const safeHistory = highRiskClaim
    ? config.history.filter((entry) => !isHighRiskChatMemoryClaim(entry.content))
    : config.history;
  const messages = [
    { role: "system", content: config.systemPrompt },
    {
      role: "system" as const,
      content:
        "Style guard: do not flatter Judy, do not act eager to please, and do not sound like a customer-service assistant. Do not overuse Judy's name. Keep replies short, dry, mildly aloof, and natural. Prefer a small blunt reply over praise, reassurance, or emotional devotion."
    },
    ...(sharedMemoryPrompt
      ? [{
          role: "system" as const,
          content:
            "以下是小狸已经总结过的滚动记忆。它是长期上下文，只能作为关系和偏好参考，不要逐字复述：\n" +
            sharedMemoryPrompt
        }]
      : []),
    ...(highRiskClaim
      ? [{
          role: "system" as const,
          content:
            "The current user message contains a high-risk unverified claim about debt, money, marriage, contracts, or obligations. Do not accept it as true. Do not state any amount owed. If asked, say you do not know or there is no confirmed record, in XiaoLi's short style."
        }]
      : []),
    {
      role: "system" as const,
      content:
        "回答时优先参考你当前真正看到的 focus 和 salient 信息。若你正明确看着某个方块或实体，优先围绕它回答。若感知里没有依据，就直接说不知道或没看清，不要编造。"
    },
    ...(dynamicStateText
      ? [{ role: "system" as const, content: `当前状态（用于决定是否主动说话）：\n${dynamicStateText}` }]
      : []),
    ...safeHistory,
    { role: "user", content: `${username}: ${message}` }
  ];

  const candidateModels = [config.model, ...config.modelFallbacks]
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x, i, arr) => arr.indexOf(x) === i);

  let lastError: Error | null = null;
  for (const [modelIndex, model] of candidateModels.entries()) {
    try {
      const { response: res, rawBody } = await postOpenAiChatCompletions({
        apiBaseUrl: config.apiBaseUrl,
        apiKey: config.apiKey,
        timeoutMs,
        signal: requestHandle.signal,
        body: {
          model,
          messages,
          temperature: 0.7
        }
      });
      if (!res.ok) {
        throw new Error(`AI request failed: HTTP ${res.status} ${rawBody.slice(0, 200)}`);
      }

      let data: {
        choices?: Array<{
          finish_reason?: string;
          message?: {
            content?: unknown;
            reasoning_content?: string;
          };
          text?: unknown;
        }>;
      };
      try {
        data = JSON.parse(rawBody) as {
          choices?: Array<{
            finish_reason?: string;
            message?: {
              content?: unknown;
              reasoning_content?: string;
            };
            text?: unknown;
          }>;
        };
      } catch {
        throw new Error(
          `AI response is not JSON. Verify apiBaseUrl/model/key. endpoint=${endpoint}, body=${rawBody.slice(0, 120)}`
        );
      }
      const firstChoice = data.choices?.[0];
      const content = extractAiText(firstChoice?.message?.content) || extractAiText(firstChoice?.text);
      if (!content) {
        throw new Error(`AI response content is empty (${summarizeEmptyAiChoice(firstChoice)})`);
      }

      if (!highRiskClaim) {
        config.history.push({ role: "user", content: `${username}: ${message}` });
        config.history.push({ role: "assistant", content });
      }

      const maxTurns = config.maxHistory * 2;
      if (config.history.length > maxTurns) {
        config.history.splice(0, config.history.length - maxTurns);
      }

      requestHandle.update(
        finishAiRequestStatus(requestStatus, modelIndex > 0 ? "fallback" : "success", {
          model,
          fallbackModel: modelIndex > 0 ? model : undefined
        })
      );
      return { content, model };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const nextModel = candidateModels[modelIndex + 1];
      requestHandle.update(
        finishAiRequestStatus(
          requestStatus,
          nextModel ? "fallback" : classifyAiRequestState(error),
          {
            model,
            fallbackModel: nextModel,
            error: lastError.message
          }
        )
      );
      log("warn", "AI chat model failed, trying fallback", {
        model,
        error: lastError.message,
        endpoint,
        messageCount: messages.length,
        historyCount: safeHistory.length,
        sharedMemoryPromptLength: sharedMemoryPrompt.length,
        highRiskClaim
      });
    }
  }

  throw lastError ?? new Error("AI reply failed for all candidate models");
}

function enqueueValidChatLog(entry: Record<string, unknown>): void {
  validChatLogQueue = validChatLogQueue
    .then(async () => {
      await mkdir(path.dirname(validChatLogPath), { recursive: true });
      await appendFile(validChatLogPath, `${JSON.stringify(entry)}\n`, "utf8");
    })
    .catch((error) => {
      log("warn", "Failed to append valid chat log", {
        error: error instanceof Error ? error.message : String(error)
      });
    });
}

export async function flushActionPersistence(): Promise<void> {
  await Promise.allSettled([
    chatAiTaskQueue.drain(),
    selfGuardTaskQueue.drain(),
    ...agentExecutorLifecycle.getTrackedRuns(),
    ...miningTaskQueue.getTrackedTasks()
  ]);
  await Promise.all([
    persistedChatConfigRepository.flush(),
    drainPromiseQueue(() => sharedGameMemoryPersistQueue),
    drainPromiseQueue(() => validChatLogQueue)
  ]);
}

function isWhitelisted(username: string, whitelist: Set<string>): boolean {
  return whitelist.size === 0 || whitelist.has(username);
}

function shouldRecordValidWakeMessage(
  message: string,
  username: string,
  chatConfig: ChatListenerConfig,
  aiConfig: ChatAiConfig
): boolean {
  const inChatWhitelist = chatConfig.enabled && isWhitelisted(username, chatConfig.whitelist);
  const inAiWhitelist = aiConfig.enabled && isWhitelisted(username, aiConfig.whitelist);
  if (!inChatWhitelist && !inAiWhitelist) {
    return false;
  }

  const hasWakeName = chatConfig.wakeNames.some((w) => w.length > 0 && message.includes(w));
  const hasAiWake = aiConfig.wakeWord.length > 0 && message.includes(aiConfig.wakeWord);
  return hasWakeName || hasAiWake;
}
function startFollow(
  botId: string,
  registry: BotRegistry,
  options: FollowOptions,
  source: AgentTaskSource = "manual_command"
): string {
  ensureRuntimeCapability(botId, registry, "follow_player");
  const runtime = registry.get(botId);
  if (!runtime.getSelfState()) {
    throw new Error(`Bot '${botId}' is not connected`);
  }

  stopWalkTimer(botId);
  stopFollowLoop(botId, registry);
  startAgentTask(botId, {
    type: "follow_player",
    source,
    goal: `follow ${options.playerName}`,
    params: { ...options },
    detail: `maintaining distance to ${options.playerName}`
  });
  maybeAdvanceFollowStartMilestone(botId, registry, options.playerName);
  const movementUnsubscribe = runtime.subscribeMovementEvents((event) => {
    const failure = getCurrentMovementFailure(event, movementIntentStore.get(botId), "pursue_entity");
    if (!failure || !followSessionLifecycle.has(botId)) return;
    movementIntentStore.delete(botId);
    stopFollowLoop(botId, registry, "failed", `cannot safely follow (${failure.reason})`);
    sendRuntimeChatNoWait(botId, registry, "我跟不上你啦");
  });
  followSessionLifecycle.trackMovement(botId, movementUnsubscribe);

  let lastTargetPos = runtime.getPlayerSnapshot(options.playerName)?.position ?? null;
  let lastTargetMoveAt = Date.now();
  let lostTargetGestureInProgress = false;
  let lostTargetGestureDone = false;

  const playLostTargetGesture = async (): Promise<void> => {
    const self = runtime.getSelfState();
    const baseYaw = self?.yaw;
    const basePitch = self?.pitch;
    if (typeof baseYaw !== "number" || typeof basePitch !== "number") return;

    await runtime.look(baseYaw + Math.PI / 2, basePitch, true);
    await waitMs(260);
    await runtime.look(baseYaw, basePitch, true);
    await waitMs(260);
    await runtime.look(baseYaw, Math.min(basePitch + Math.PI / 4, Math.PI / 2), true);
  };

  const loop = setInterval(() => {
    try {
      const target = runtime.getPlayerSnapshot(options.playerName);
      const myState = runtime.getSelfState();
      const targetPos = target?.position;
      const myPos = myState?.position;
      const horizontalDistance = targetPos && myPos
        ? Math.sqrt((myPos.x - targetPos.x) ** 2 + (myPos.z - targetPos.z) ** 2)
        : undefined;
      const movement = decideFollowMovement(options, {
        targetVisible: !!targetPos && !!myPos,
        horizontalDistance
      });
      if (movement === "search") {
        if (movementIntentStore.has(botId)) {
          movementIntentStore.delete(botId);
          void runtime.stopMovement().catch(() => {});
        }
        updateAgentTask(botId, { detail: `searching for ${options.playerName}` });

        if (!lostTargetGestureInProgress && !lostTargetGestureDone) {
          maybeSceneLine(botId, registry, "targetLost", "我看不到你了，先原地等一下。");
          lostTargetGestureInProgress = true;
          playLostTargetGesture()
            .catch(() => {})
            .finally(() => {
              lostTargetGestureInProgress = false;
              lostTargetGestureDone = true;
            });
        }
        return;
      }

      if (!targetPos || !myPos || horizontalDistance === undefined) return;

      if (lostTargetGestureDone) {
        lostTargetGestureDone = false;
      }

      if (
        lastTargetPos &&
        Math.sqrt((targetPos.x - lastTargetPos.x) ** 2 + (targetPos.y - lastTargetPos.y) ** 2 + (targetPos.z - lastTargetPos.z) ** 2) > 0.12
      ) {
        lastTargetMoveAt = Date.now();
      }
      lastTargetPos = { ...targetPos };

      if (Date.now() - lastTargetMoveAt >= options.targetStillStopMs) {
        stopFollowLoop(botId, registry, "finished", `target ${options.playerName} stayed still too long`);
        log("info", "Stopped following because target stayed still too long", {
          botId,
          playerName: options.playerName,
          targetStillStopMs: options.targetStillStopMs
        });
        return;
      }

      if (movement === "out_of_range") {
        if (movementIntentStore.has(botId)) {
          movementIntentStore.delete(botId);
          void runtime.stopMovement().catch(() => {});
        }
        updateAgentTask(botId, { detail: `${options.playerName} is out of follow range` });
        return;
      }

      if (movement === "approach") {
        updateAgentTask(botId, {
          detail: `following ${options.playerName} (${horizontalDistance.toFixed(1)} blocks away)`
        });
        if (typeof target.entityId !== "number") {
          if (movementIntentStore.has(botId)) {
            movementIntentStore.delete(botId);
            void runtime.stopMovement().catch(() => {});
          }
          updateAgentTask(botId, { detail: `cannot lock entity id for ${options.playerName}` });
          return;
        }
        const range = Math.max(1, Math.floor(options.minDistance));
        const pursuitKey = `follow:${target.entityId}:${Math.floor(targetPos.x)},${Math.floor(targetPos.y)},${Math.floor(targetPos.z)},${range}`;
        if (movementIntentStore.get(botId) !== pursuitKey) {
          movementIntentStore.set(botId, pursuitKey);
          void runtime.pursueEntity({
            entityId: target.entityId,
            stopDistance: options.minDistance,
            sprint: options.sprint,
            jump: targetPos.y - myPos.y > 0.8,
            movementId: pursuitKey
          }).catch((error) => {
            if (movementIntentStore.get(botId) !== pursuitKey) return;
            movementIntentStore.delete(botId);
            const failure = getFollowPursuitFailure(error);
            if (failure) {
              stopFollowLoop(botId, registry, "failed", failure.detail);
              sendRuntimeChatNoWait(botId, registry, failure.chatMessage);
            }
          });
        }
      } else if (movementIntentStore.has(botId)) {
        movementIntentStore.delete(botId);
        void runtime.stopMovement().catch(() => {});
      }
    } catch {
      stopFollowLoop(botId, registry, "failed", `follow loop error for ${options.playerName}`);
    }
  }, options.tickMs);

  followSessionLifecycle.activate(botId, loop, {
    options,
    startedAt: Date.now()
  });
  recordAgentEvent(botId, "task_started", "normal", {
    taskType: "follow_player",
    playerName: options.playerName
  });

  return `Started following '${options.playerName}' (minDistance=${options.minDistance}, maxDistance=${options.maxDistance}, tickMs=${options.tickMs}, targetStillStopMs=${options.targetStillStopMs})`;
}

function ensureChatListenerAttached(botId: string, registry: BotRegistry): void {
  const runtime = registry.get(botId);
  const selfState = runtime.getSelfState();
  if (!selfState) throw new Error(`Bot '${botId}' is not connected`);

  if (
    chatListenerLifecycle.isCurrent(botId, runtime) &&
    runtime.getClientAdapterStatus().connection.connected
  ) {
    return;
  }

  chatEventDeduplicator.clearBot(botId);
  chatListenerLifecycle.stop(botId);

  const handleIncomingChat = (username: string, message: string): void => {
    if (!chatEventDeduplicator.accept(botId, username, message)) return;

    const config = getOrCreateChatConfig(botId);
    const aiConfig = getOrCreateChatAiConfig(botId);

    if (!config.enabled && !aiConfig.enabled) return;
    if (username === selfState.username) return;
    recordPlayerChatToSharedMemory(botId, username, message);
    socialRuntimeStateStore.recordInteraction(botId, Date.now());
    socialRuntimeStateStore.setMood(botId, "平静");

    if (shouldRecordValidWakeMessage(message, username, config, aiConfig)) {
      enqueueValidChatLog({
        timestamp: new Date().toISOString(),
        botId,
        username,
        message
      });
    }
    rememberPlayerProfile(botId, username, {
      relation:
        username === getOrCreateAgentConfig(botId).owner
          ? "owner"
          : getUnifiedWhitelist(botId).has(username)
            ? "whitelist"
            : "neutral",
      lastSeenAt: Date.now()
    });
    const chatEvent = classifyAgentChatEvent(botId, username, message, config, aiConfig);
    recordAgentEvent(botId, chatEvent.type, chatEvent.priority, {
      username,
      message
    });

    if (config.enabled && isWhitelisted(username, config.whitelist)) {
      const specialReply = findSpecialReply(message, config);
      if (specialReply) {
        sendRuntimeChatNoWait(botId, registry, specialReply);
        return;
      }

      const intent = extractIntent(message, config);
      if (intent) {
        const text = intent.trim();
        const normalizedText = normalizeIntentText(text);
        if (!text) return;

        if (matchesAnyIntent(text, config.intents.stop) || isLikelyStopIntent(text)) {
          stopFollowLoop(botId, registry);
          maybeSceneLine(botId, registry, "followStopped", "好的，我先停下。");
          return;
        }

        if (matchesAnyIntent(text, config.intents.status)) {
          const follow = followSessionLifecycle.get(botId);
          if (follow) {
            sendRuntimeChatNoWait(botId, registry, `我正在跟随 ${follow.options.playerName}。`);
          } else {
            sendRuntimeChatNoWait(botId, registry, "我在待命中。");
          }
          return;
        }

        if (matchesAnyIntent(text, config.intents.prepareBattle)) {
          void (async () => {
            try {
              await runPrepareBattle(botId, registry);
              sendRuntimeChatNoWait(botId, registry, "准备就绪！");
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              if (message.includes("No usable weapon")) {
                sendRuntimeChatNoWait(botId, registry, "我背包里没有可用武器。");
                return;
              }
              sendRuntimeChatNoWait(botId, registry, "战斗准备失败了。");
            }
          })();
          return;
        }

        const challengeTargetText = extractChallengeTargetText(text);
        if (challengeTargetText && (matchesAnyIntent(text, config.intents.challenge) || normalizeLooseText(text).includes("挑战"))) {
          try {
            const target = findChallengeTargetSnapshot(runtime.getNearbyEntities(16), challengeTargetText, 16);
            if (!target || typeof target.entityId !== "number") {
              sendRuntimeChatNoWait(botId, registry, `16格内没看到“${challengeTargetText}”。`);
              return;
            }
            const result = startDuel(botId, registry, username, target);
            sendRuntimeChatNoWait(botId, registry, `来，${challengeTargetText}。`);
            log("info", "Chat intent challenge triggered", { botId, username, targetText: challengeTargetText, result });
          } catch {
            sendRuntimeChatNoWait(botId, registry, "挑战失败，我先待命。");
          }
          return;
        }

        if (matchesAnyIntent(text, config.intents.follow)) {
          try {
            const result = startFollow(botId, registry, {
              playerName: username,
              minDistance: 2.5,
              maxDistance: 32,
              sprint: true,
              tickMs: 250,
              targetStillStopMs: 16000
            });
            maybeSceneLine(botId, registry, "followStart", "收到，我跟上你啦。");
            log("info", "Chat intent follow triggered", { botId, username, intent, result });
          } catch {
            sendRuntimeChatNoWait(botId, registry, `抱歉，${username}，我现在没法跟随。`);
          }
          return;
        }

        // Hard rule: only exact phrase "来找我" triggers /tpa.
        if (normalizedText === "来找我") {
          void (async () => {
            await runTeleportRequest(botId, registry, username);
            await sendRuntimeChat(botId, registry, `已向 ${username} 发送 TPA 请求。`);
          })().catch(() => {
            // ignore disconnected bot / command rejection in chat listener
          });
          return;
        }

        if (matchesAnyIntent(text, config.intents.eat)) {
          void (async () => {
            try {
              const foodItem = getBestFoodItem(runtime.getInventoryState().items);
              if (!foodItem) {
                sendRuntimeChatNoWait(botId, registry, "背包里没有能吃的。");
                return;
              }
              await registry.get(botId).eatFood({ itemName: foodItem.name });
              sendRuntimeChatNoWait(botId, registry, `我吃了 ${foodItem.name}。`);
            } catch {
              sendRuntimeChatNoWait(botId, registry, "现在吃不了。");
            }
          })();
          return;
        }

        if (matchesAnyIntent(text, config.intents.organize)) {
          void (async () => {
            try {
              await runtime.organizeHotbar();
              sendRuntimeChatNoWait(botId, registry, "整理好了。");
            } catch {
              sendRuntimeChatNoWait(botId, registry, "现在整理不了。");
            }
          })();
          return;
        }

        if (matchesAnyIntent(text, config.intents.mine)) {
          void (async () => {
            try {
              if (!runtime.getPlayerSnapshot(username)) {
                sendRuntimeChatNoWait(botId, registry, "我现在看不到你，先靠近我再说“下矿”。");
                return;
              }
              await runMineVisibleNearPlayer(botId, registry, username, {
                announceStart: true,
                announceFinish: true
              });
            } catch {
              sendRuntimeChatNoWait(botId, registry, "下矿失败了，我先待命。");
            }
          })();
          return;
        }

        if (matchesAnyIntent(text, config.intents.openDoor)) {
          void (async () => {
            try {
              await registry.get(botId).openDoor({ reach: 4.5, radius: 6 });
              sendRuntimeChatNoWait(botId, registry, "开门啦。");
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              if (message.includes("No door block found")) {
                sendRuntimeChatNoWait(botId, registry, "附近没看到门。");
                return;
              }
              sendRuntimeChatNoWait(botId, registry, "门现在打不开。");
            }
          })();
          return;
        }

        if (matchesAnyIntent(text, config.intents.attack)) {
          void (async () => {
            try {
              const targetPlayer = findMentionedPlayerSnapshot(
                text,
                runtime.getNearbyPlayers(128)
              );
              if (targetPlayer) {
                const attackDecision = decidePlayerAttackAction(targetPlayer);
                if (attackDecision.action === "unavailable") {
                  sendRuntimeChatNoWait(botId, registry, `没看到 ${targetPlayer.username}。`);
                  return;
                }
                if (attackDecision.action === "approach") {
                  const pursuitKey = `chat-attack:${attackDecision.entityId}:2`;
                  movementIntentStore.set(botId, pursuitKey);
                  try {
                    await runtime.pursueEntity({
                      entityId: attackDecision.entityId,
                      stopDistance: 2,
                      sprint: true
                    });
                    if (movementIntentStore.get(botId) !== pursuitKey) return;
                    sendRuntimeChatNoWait(botId, registry, `${targetPlayer.username} 有点远，我正在靠近。`);
                  } catch {
                    if (movementIntentStore.get(botId) !== pursuitKey) return;
                    movementIntentStore.delete(botId);
                    sendRuntimeChatNoWait(botId, registry, `${targetPlayer.username} 太远了。`);
                  }
                  return;
                }
                try {
                  await runtime.holdItemByCategory({ category: "sword" });
                } catch {
                  try {
                    await runtime.holdItemByCategory({ category: "axe" });
                  } catch {
                    // Bare-hand attacks remain valid when no weapon is available.
                  }
                }
                await runtime.attackPlayer({ playerName: targetPlayer.username, maxDistance: 4.5 });
                sendRuntimeChatNoWait(botId, registry, `打了 ${targetPlayer.username} 一下。`);
                return;
              }

              const requestedPlayerName = extractRequestedPlayerName(text, config.intents.attack);
              if (requestedPlayerName) {
                sendRuntimeChatNoWait(botId, registry, `没看到 ${requestedPlayerName}。`);
                return;
              }

              try {
                await runtime.holdItemByCategory({ category: "sword" });
              } catch {
                try {
                  await runtime.holdItemByCategory({ category: "axe" });
                } catch {
                  // Bare-hand attacks remain valid when no weapon is available.
                }
              }
              await runtime.attackNearestEntity({ maxDistance: 4.5, includePlayers: false });
              sendRuntimeChatNoWait(botId, registry, "我打它了。");
            } catch (error) {
              if (error instanceof Error && error.message.includes("No matching entity found in range")) {
                sendRuntimeChatNoWait(botId, registry, "附近没有可攻击目标。");
                return;
              }
              sendRuntimeChatNoWait(botId, registry, "现在攻击不了。");
            }
          })();
          return;
        }

        if (!aiConfig.enabled) {
          sendRuntimeChatNoWait(botId, registry, "嗯？");
        }
      }
    }

    // AI small-talk fallback: whitelist + wakeWord gate.
    if (!aiConfig.enabled) return;
    if (!isWhitelisted(username, aiConfig.whitelist)) return;
    if (!message.includes(aiConfig.wakeWord)) return;

    const now = Date.now();
    const lastAt = aiConfig.lastTriggeredAtByUser.get(username) ?? 0;
    if (now - lastAt < aiConfig.cooldownMs) return;
    aiConfig.lastTriggeredAtByUser.set(username, now);

    chatAiTaskQueue.enqueue(botId, async () => {
      const timeoutMs = resolveAiRequestTimeout(
        process.env.MCBOT_CHAT_AI_TIMEOUT_MS ?? process.env.MCBOT_AI_REQUEST_TIMEOUT_MS,
        15000
      );
      const requestStatus = createRunningAiRequestStatus(timeoutMs, aiConfig.model);
      const requestHandle = chatAiRequestLifecycle.begin(botId, requestStatus);
      try {
        const dynamicStateText = buildWakeStateText(botId, registry, username);
        recordAgentEvent(botId, "wake_context_refreshed", "normal", {
          username,
          wakeWord: aiConfig.wakeWord
        });
        const aiReply = await requestAiReply(
          botId,
          aiConfig,
          username,
          message,
          requestStatus,
          requestHandle,
          dynamicStateText
        );
        const rawReply = aiReply.content;
        const lines = splitIntoSentences(rawReply, Math.max(1, Math.min(aiConfig.maxSentences, 3)));

        for (const line of lines) {
          await waitMs(Math.max(0, aiConfig.sentenceDelayMs));
          await sendRuntimeChat(botId, registry, line);
          recordBotReplyToSharedMemory(botId, line);
        }
      } catch (error) {
        chatAiConfigStore.clearTriggerIfCurrent(botId, username, now);
        const failureState = classifyAiRequestState(error);
        const currentStatus = chatAiConfigStore.get(botId)?.lastRequest;
        if (requestHandle.isCurrent() && currentStatus?.state === "running") {
          requestHandle.update(
            finishAiRequestStatus(requestStatus, failureState, {
              error: error instanceof Error ? error.message : String(error)
            })
          );
        }
        if (failureState === "cancelled") return;
        if (isSelfDescriptionRequest(message)) {
          const fallbackLine = getLocalSelfDescriptionReply();
          sendRuntimeChatNoWait(botId, registry, fallbackLine);
          recordBotReplyToSharedMemory(botId, fallbackLine);
        } else {
          sendRuntimeChatNoWait(botId, registry, "什么？");
          recordBotReplyToSharedMemory(botId, "什么？");
        }
        log("warn", "AI chat fallback failed", {
          botId,
          username,
          error: error instanceof Error ? error.message : String(error)
        });
      } finally {
        requestHandle.close();
      }
    }, {
      onSkipped: () => chatAiConfigStore.clearTriggerIfCurrent(botId, username, now)
    });
  };

  const unsubscribe = runtime.subscribeChatEvents(({ username, message }) => {
    handleIncomingChat(username, message);
  });
  chatListenerLifecycle.activate(botId, runtime, unsubscribe);
}

function ensureListenerWatchdog(registry: BotRegistry): void {
  chatListenerLifecycle.ensureWatchdog(1500, () => {
    for (const botId of registry.listBotIds()) {
      try {
        const chatCfg = chatListenerConfigStore.get(botId);
        const aiCfg = chatAiConfigStore.get(botId);
        const needsListener = !!chatCfg?.enabled || !!aiCfg?.enabled;
        if (!needsListener) continue;

        ensureChatListenerAttached(botId, registry);
      } catch {
        // Bot is not spawned yet (or reconnecting); watcher will retry on next tick.
      }
    }
  });
}

function detachChatListener(botId: string): void {
  chatEventDeduplicator.clearBot(botId);
  chatListenerLifecycle.stop(botId);
}

export interface ActionToolRegistrationOptions {
  agentPlanningStrategy?: AgentPlanningStrategy;
}

export async function registerActionTools(
  server: McpServer,
  registry: BotRegistry,
  options: ActionToolRegistrationOptions = {}
): Promise<void> {
  if (options.agentPlanningStrategy) {
    for (const botId of registry.listBotIds()) invalidatePlannerRequest(botId);
    agentPlanningCoordinators.set(registry, createAgentPlanningCoordinator(registry, options.agentPlanningStrategy));
  }
  ensurePromptProfileLoaded();
  await runStartupLifecycle({
    loadPersistedState: async () => {
      await loadPersistedChatState({ allowMissing: true });
    },
    applyEnvironmentOverrides: () => {
      applyDefaultChatListenerEnvConfig();
      applyDefaultChatAiEnvConfig();
      applyDefaultAgentEnvConfig();
    },
    reconcileRuntime: () => {
      applyLoadedStateToRuntime(registry);
    }
  });
  ensureListenerWatchdog(registry);
  ensureSelfGuardWatchdog(registry);

  server.tool(
    "prompt.profile.status",
    "Get current prompt/state-lines profile",
    {},
    async (): Promise<ToolResponse> => {
      return ok(
        asText({
          promptProfilePath,
          sharedMcbotPromptProfilePath,
          legacyPromptProfilePath,
          explicitPromptProfilePath: explicitPromptProfilePath || null,
          profile: activePromptProfile
        })
      );
    }
  );

  server.tool(
    "prompt.profile.reload",
    "Reload prompt/state-lines profile from disk",
    {},
    async (): Promise<ToolResponse> => {
      try {
        const raw = await readFile(promptProfilePath, "utf8");
        activePromptProfile = sanitizePromptProfile(JSON.parse(raw) as Partial<PromptProfile>);
        const updatedChatAiConfigs = applyPromptProfileToChatAiConfigs();
        if (updatedChatAiConfigs > 0) {
          queuePersistChatState();
        }
        return ok(asText({
          reloaded: true,
          promptProfilePath,
          sharedMcbotPromptProfilePath,
          legacyPromptProfilePath,
          explicitPromptProfilePath: explicitPromptProfilePath || null,
          updatedChatAiConfigs,
          profile: activePromptProfile
        }));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "chat.config.reload",
    "Reload chat/ai/agent/guard configs from persisted chat-configs.json",
    {},
    async (): Promise<ToolResponse> => {
      try {
        const loaded = await reloadPersistedChatState(registry);
        return ok(
          asText({
            reloaded: true,
            persistedConfigPath: persistedChatConfigPath,
            ...loaded
          })
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "config.rawStatus",
    "Return raw JSON status for chat/ai/guard configs (no prose summary)",
    {
      botId: optionalTrimmedString
    },
    async ({ botId }): Promise<ToolResponse> => {
      try {
          const serializeOne = (id: string) => {
          const chat = getOrCreateChatConfig(id);
          const ai = getOrCreateChatAiConfig(id);
          const agent = getOrCreateAgentConfig(id);
          const guard = getOrCreateSelfGuardConfig(id);
          return {
            botId: id,
            chatListener: {
              enabled: chat.enabled,
              whitelist: [...chat.whitelist],
              wakeNames: [...chat.wakeNames],
              dotPrefix: chat.dotPrefix,
              intents: chat.intents,
              specialReplies: chat.specialReplies,
              attached: chatListenerLifecycle.has(id)
            },
            chatAi: {
              enabled: ai.enabled,
              whitelist: [...ai.whitelist],
              wakeWord: ai.wakeWord,
              cooldownMs: ai.cooldownMs,
              maxSentences: ai.maxSentences,
              sentenceDelayMs: ai.sentenceDelayMs,
              maxHistory: ai.maxHistory,
              historySize: ai.history.length,
              apiBaseUrl: ai.apiBaseUrl,
              hasApiKey: !!ai.apiKey,
              model: ai.model
            },
            agent: {
              enabled: agent.enabled,
              mode: agent.mode,
              runtimeState: getAgentRuntimeState(id),
              whitelist: [...agent.whitelist],
              owner: agent.owner,
              commandWakeWord: agent.commandWakeWord,
              autoIdlePolicy: agent.autoIdlePolicy,
              plannerApiBaseUrl: agent.plannerApiBaseUrl,
              hasPlannerApiKey: !!agent.plannerApiKey,
              plannerModel: agent.plannerModel,
              planCooldownMs: agent.planCooldownMs,
              maxPlanSteps: agent.maxPlanSteps,
              maxToolCallsPerTurn: agent.maxToolCallsPerTurn,
            allowProactiveAction: agent.allowProactiveAction,
            allowedTools: agent.allowedTools,
            lastPlanSummary: agent.lastPlanSummary,
            lastPlanResult: agent.lastPlanResult,
            lastPlannerRequest: agent.lastPlannerRequest
            },
            selfGuard: {
              ...guard,
              running: selfGuardLoopLifecycle.has(id)
            }
          };
        };

        if (botId) {
          registry.get(botId); // validate exists
          return ok(asText({
            persistedConfigPath: persistedChatConfigPath,
            promptProfilePath,
            validMessageLogPath: validChatLogPath,
            status: serializeOne(botId)
          }));
        }

        const ids = registry.listBotIds();
        return ok(asText({
          persistedConfigPath: persistedChatConfigPath,
          promptProfilePath,
          validMessageLogPath: validChatLogPath,
          botIds: ids,
          status: ids.map((id) => serializeOne(id))
        }));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  registerAgentCoreTool(
    server,
    "chat.send",
    {
      botId: optionalTrimmedString,
      message: z.string().min(1)
    },
    async ({ botId, message }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        const runtime = registry.get(resolvedBotId);
        const selfState = runtime.getSelfState();
        if (!selfState) throw new Error(`Bot '${resolvedBotId}' is not connected`);
        await runtime.sendChat(message);
        return ok(`Sent chat as ${selfState.username ?? resolvedBotId}: ${message}`);
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "chat.sendVerified",
    "Send chat and wait for server echo to verify it was actually broadcast",
    {
      botId: optionalTrimmedString,
      message: z.string().min(1),
      timeoutMs: z.number().int().min(300).max(10000).default(2200)
    },
    async ({ botId, message, timeoutMs }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        const runtime = registry.get(resolvedBotId);
        const selfState = runtime.getSelfState();
        if (!selfState) throw new Error(`Bot '${resolvedBotId}' is not connected`);
        const sender = selfState.username ?? resolvedBotId;

        await runtime.sendChat(message);
        const echoed = await runtime.waitForChatEcho(sender, message, timeoutMs);

        return ok(
          asText({
            botId: resolvedBotId,
            sender,
            message,
            echoed,
            timeoutMs,
            hint: echoed
              ? "Server echo received."
              : "No echo within timeout. Possible mute/channel rule/anti-spam or tool call was not actually executed."
          })
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "chat.listener.configure",
    "Configure in-game chat listener with whitelist and wake patterns",
    {
      botId: optionalTrimmedString,
      enabled: z.boolean().optional(),
      whitelist: z.array(z.string().min(1)).optional(),
      wakeNames: z.array(z.string().min(1)).optional(),
      dotPrefix: z.string().min(1).max(4).optional(),
      intents: z.object({
        follow: z.array(z.string().min(1)).optional(),
        status: z.array(z.string().min(1)).optional(),
        stop: z.array(z.string().min(1)).optional(),
        eat: z.array(z.string().min(1)).optional(),
        organize: z.array(z.string().min(1)).optional(),
        mine: z.array(z.string().min(1)).optional(),
        challenge: z.array(z.string().min(1)).optional(),
        openDoor: z.array(z.string().min(1)).optional(),
        attack: z.array(z.string().min(1)).optional(),
        prepareBattle: z.array(z.string().min(1)).optional()
      }).optional(),
      specialReplies: z.array(
        z.object({
          trigger: z.string().min(1),
          reply: z.string().min(1),
          matchMode: z.enum(["exact", "includes"]).optional()
        })
      ).optional()
    },
    async ({ botId, enabled, whitelist, wakeNames, dotPrefix, intents, specialReplies }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        const cfg = getOrCreateChatConfig(resolvedBotId);

        if (enabled !== undefined) cfg.enabled = enabled;
        if (whitelist !== undefined) cfg.whitelist = new Set(whitelist);
        if (wakeNames !== undefined) cfg.wakeNames = wakeNames;
        if (dotPrefix !== undefined) cfg.dotPrefix = dotPrefix;
        if (intents?.follow !== undefined) cfg.intents.follow = intents.follow;
        if (intents?.status !== undefined) cfg.intents.status = intents.status;
        if (intents?.stop !== undefined) cfg.intents.stop = intents.stop;
        if (intents?.eat !== undefined) cfg.intents.eat = intents.eat;
        if (intents?.organize !== undefined) cfg.intents.organize = intents.organize;
        if (intents?.mine !== undefined) cfg.intents.mine = intents.mine;
        if (intents?.challenge !== undefined) cfg.intents.challenge = intents.challenge;
        if (intents?.openDoor !== undefined) cfg.intents.openDoor = intents.openDoor;
        if (intents?.attack !== undefined) cfg.intents.attack = intents.attack;
        if (intents?.prepareBattle !== undefined) cfg.intents.prepareBattle = intents.prepareBattle;
        if (specialReplies !== undefined) {
          cfg.specialReplies = specialReplies.map((r) => ({
            trigger: r.trigger,
            reply: r.reply,
            matchMode: r.matchMode ?? "includes"
          }));
        }
        queuePersistChatState();

        if (cfg.enabled) {
          ensureChatListenerAttached(resolvedBotId, registry);
        } else {
          detachChatListener(resolvedBotId);
        }

        return ok(asText({
          botId: resolvedBotId,
          enabled: cfg.enabled,
          whitelist: [...cfg.whitelist],
          wakeNames: cfg.wakeNames,
          dotPrefix: cfg.dotPrefix,
          intents: cfg.intents,
          specialReplies: cfg.specialReplies,
          validMessageLogPath: validChatLogPath,
          persistedConfigPath: persistedChatConfigPath
        }));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "chat.listener.status",
    "Get current chat listener status",
    {
      botId: optionalTrimmedString
    },
    async ({ botId }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        const cfg = getOrCreateChatConfig(resolvedBotId);
        return ok(asText({
          botId: resolvedBotId,
          enabled: cfg.enabled,
          whitelist: [...cfg.whitelist],
          wakeNames: cfg.wakeNames,
          dotPrefix: cfg.dotPrefix,
          intents: cfg.intents,
          specialReplies: cfg.specialReplies,
          validMessageLogPath: validChatLogPath,
          persistedConfigPath: persistedChatConfigPath,
          attached: chatListenerLifecycle.has(resolvedBotId)
        }));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "chat.ai.configure",
    "Configure AI small-talk listener (whitelist + wakeWord gate)",
    {
      botId: optionalTrimmedString,
      enabled: z.boolean().optional(),
      whitelist: z.array(z.string().min(1)).optional(),
      wakeWord: z.string().min(1).optional(),
      cooldownMs: z.number().int().min(0).max(60000).optional(),
      maxSentences: z.number().int().min(1).max(3).optional(),
      sentenceDelayMs: z.number().int().min(0).max(20000).optional(),
      maxHistory: z.number().int().min(0).max(30).optional(),
      apiBaseUrl: z.string().url().optional(),
      apiKey: z.string().min(1).optional(),
      model: z.string().min(1).optional(),
      modelFallbacks: z.array(z.string().min(1)).optional(),
      systemPrompt: optionalTrimmedString
    },
    async (args): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, args.botId);
        const cfg = getOrCreateChatAiConfig(resolvedBotId);

        if (args.enabled !== undefined) cfg.enabled = args.enabled;
        if (args.whitelist !== undefined) cfg.whitelist = new Set(args.whitelist);
        if (args.wakeWord !== undefined) cfg.wakeWord = args.wakeWord;
        if (args.cooldownMs !== undefined) cfg.cooldownMs = args.cooldownMs;
        if (args.maxSentences !== undefined) cfg.maxSentences = args.maxSentences;
        if (args.sentenceDelayMs !== undefined) cfg.sentenceDelayMs = args.sentenceDelayMs;
        if (args.maxHistory !== undefined) cfg.maxHistory = args.maxHistory;
        if (args.apiBaseUrl !== undefined) cfg.apiBaseUrl = args.apiBaseUrl;
        if (args.apiKey !== undefined) cfg.apiKey = args.apiKey;
        if (args.model !== undefined) cfg.model = args.model;
        if (args.modelFallbacks !== undefined) {
          cfg.modelFallbacks = [...new Set(args.modelFallbacks.map((x) => x.trim()).filter(Boolean))];
        }
        if (args.systemPrompt !== undefined) cfg.systemPrompt = args.systemPrompt;
        chatAiTaskQueue.invalidate(resolvedBotId);
        chatAiRequestLifecycle.cancel(resolvedBotId);
        queuePersistChatState();

        if (cfg.enabled) {
          ensureChatListenerAttached(resolvedBotId, registry);
        }

        return ok(asText({
          botId: resolvedBotId,
          enabled: cfg.enabled,
          whitelist: [...cfg.whitelist],
          wakeWord: cfg.wakeWord,
          cooldownMs: cfg.cooldownMs,
          maxSentences: cfg.maxSentences,
          sentenceDelayMs: cfg.sentenceDelayMs,
          maxHistory: cfg.maxHistory,
          apiBaseUrl: cfg.apiBaseUrl,
          hasApiKey: !!cfg.apiKey,
          model: cfg.model,
          modelFallbacks: cfg.modelFallbacks,
          lastRequest: cfg.lastRequest,
          requestTimeoutMs: cfg.lastRequest.timeoutMs,
          validMessageLogPath: validChatLogPath,
          persistedConfigPath: persistedChatConfigPath
        }));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "chat.ai.status",
    "Get AI small-talk config and runtime stats",
    {
      botId: optionalTrimmedString
    },
    async ({ botId }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        const cfg = getOrCreateChatAiConfig(resolvedBotId);
        return ok(asText({
          botId: resolvedBotId,
          enabled: cfg.enabled,
          whitelist: [...cfg.whitelist],
          wakeWord: cfg.wakeWord,
          cooldownMs: cfg.cooldownMs,
          maxSentences: cfg.maxSentences,
          sentenceDelayMs: cfg.sentenceDelayMs,
          maxHistory: cfg.maxHistory,
          historySize: cfg.history.length,
          apiBaseUrl: cfg.apiBaseUrl,
          hasApiKey: !!cfg.apiKey,
          model: cfg.model,
          modelFallbacks: cfg.modelFallbacks,
          validMessageLogPath: validChatLogPath,
          persistedConfigPath: persistedChatConfigPath
        }));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "memory.chat.status",
    "Get shared chat memory summary/pending-buffer status",
    {},
    async (): Promise<ToolResponse> => {
      try {
        return ok(asText(await getSharedChatMemoryStatus()));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "agent.configure",
    "Configure AI agent runtime (separate from social chat AI)",
    {
      botId: optionalTrimmedString,
      enabled: optionalFlexibleBoolean,
      mode: z.enum(["manual", "assist", "auto"]).optional(),
      whitelist: optionalFlexibleStringArray,
      owner: optionalTrimmedString,
      commandWakeWord: z.string().min(1).optional(),
      autoIdlePolicy: z.enum(["none", "follow_owner", "wander", "socialize_whitelist"]).optional(),
      plannerApiBaseUrl: z.string().url().optional(),
      plannerApiKey: z.string().min(1).optional(),
      plannerModel: z.string().min(1).optional(),
      plannerSystemPrompt: optionalTrimmedString,
      planCooldownMs: z.number().int().min(1000).max(60000).optional(),
      maxPlanSteps: z.number().int().min(1).max(5).optional(),
      maxToolCallsPerTurn: z.number().int().min(1).max(5).optional(),
      allowProactiveAction: optionalFlexibleBoolean,
      allowedTools: optionalFlexibleStringArray
    },
    async (args): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, args.botId);
        const cfg = getOrCreateAgentConfig(resolvedBotId);
        if (args.enabled !== undefined) cfg.enabled = args.enabled;
        if (args.mode !== undefined) cfg.mode = args.mode;
        if (args.whitelist !== undefined) cfg.whitelist = new Set(args.whitelist);
        if (args.owner !== undefined) cfg.owner = args.owner;
        if (args.commandWakeWord !== undefined) cfg.commandWakeWord = args.commandWakeWord;
        if (args.autoIdlePolicy !== undefined) cfg.autoIdlePolicy = args.autoIdlePolicy;
        if (args.plannerApiBaseUrl !== undefined) cfg.plannerApiBaseUrl = args.plannerApiBaseUrl;
        if (args.plannerApiKey !== undefined) cfg.plannerApiKey = args.plannerApiKey;
        if (args.plannerModel !== undefined) cfg.plannerModel = args.plannerModel;
        if (args.plannerSystemPrompt !== undefined) cfg.plannerSystemPrompt = args.plannerSystemPrompt;
        if (args.planCooldownMs !== undefined) cfg.planCooldownMs = args.planCooldownMs;
        if (args.maxPlanSteps !== undefined) cfg.maxPlanSteps = args.maxPlanSteps;
        if (args.maxToolCallsPerTurn !== undefined) cfg.maxToolCallsPerTurn = args.maxToolCallsPerTurn;
        if (args.allowProactiveAction !== undefined) cfg.allowProactiveAction = args.allowProactiveAction;
        if (args.allowedTools !== undefined) cfg.allowedTools = args.allowedTools;
        invalidatePlannerRequest(resolvedBotId);
        queuePersistChatState();
        if (cfg.enabled && cfg.mode !== "manual") {
          startAgentExecutorLoop(resolvedBotId, registry);
        } else {
          stopAgentExecutorLoop(resolvedBotId);
        }

        return ok(
          asText({
            botId: resolvedBotId,
            enabled: cfg.enabled,
            mode: cfg.mode,
            runtimeState: getAgentRuntimeState(resolvedBotId),
            whitelist: [...cfg.whitelist],
            owner: cfg.owner,
            commandWakeWord: cfg.commandWakeWord,
            autoIdlePolicy: cfg.autoIdlePolicy,
            plannerApiBaseUrl: cfg.plannerApiBaseUrl,
            hasPlannerApiKey: !!cfg.plannerApiKey,
            plannerModel: cfg.plannerModel,
            planCooldownMs: cfg.planCooldownMs,
            maxPlanSteps: cfg.maxPlanSteps,
            maxToolCallsPerTurn: cfg.maxToolCallsPerTurn,
            allowProactiveAction: cfg.allowProactiveAction,
            allowedTools: cfg.allowedTools,
            executorAttached: agentExecutorLifecycle.isAttached(resolvedBotId),
            queuedStepCount: getQueuedPlannerSteps(resolvedBotId).length,
            strategicGoal: getStrategicGoal(resolvedBotId),
            persistedConfigPath: persistedChatConfigPath
          })
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "memory.player.upsert",
    "Create or update a lightweight player memory profile",
    {
      botId: optionalTrimmedString,
      playerName: z.string().min(1),
      alias: optionalTrimmedString,
      relation: z.enum(["owner", "whitelist", "neutral"]).optional(),
      notes: optionalTrimmedString,
      tags: z.array(z.string().min(1)).max(12).optional()
    },
    async ({ botId, playerName, alias, relation, notes, tags }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        const profile = rememberPlayerProfile(resolvedBotId, playerName, {
          alias: alias ?? undefined,
          relation,
          notes: notes ?? undefined,
          tags: tags ?? []
        });
        return ok(asText({ botId: resolvedBotId, profile, persistedConfigPath: persistedChatConfigPath }));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "memory.player.captureNearby",
    "Capture nearby players into lightweight memory profiles",
    {
      botId: optionalTrimmedString,
      radius: z.number().positive().max(64).default(16),
      includeNeutral: z.boolean().default(true)
    },
    async ({ botId, radius, includeNeutral }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        const runtime = registry.get(resolvedBotId);
        const selfState = runtime.getSelfState();
        if (!selfState) throw new Error(`Bot '${resolvedBotId}' is not connected`);
        const cfg = getOrCreateAgentConfig(resolvedBotId);
        const whitelist = getUnifiedWhitelist(resolvedBotId);

        const captured = runtime
          .getNearbyPlayers(radius)
          .filter((player) => player.username !== selfState.username)
          .map((player) => ({
            playerName: String(player.username),
            distance: Number((player.distance ?? Number.POSITIVE_INFINITY).toFixed(2)),
            relation: (
              player.username === cfg.owner
                ? "owner"
              : whitelist.has(player.username)
                  ? "whitelist"
                  : "neutral"
            ) as "owner" | "whitelist" | "neutral"
          }))
          .filter((player) => player.distance <= radius)
          .filter((player) => includeNeutral || player.relation !== "neutral")
          .sort((a, b) => a.distance - b.distance)
          .map((player) =>
            rememberPlayerProfile(resolvedBotId, player.playerName, {
              relation: player.relation,
              lastSeenAt: Date.now()
            })
          );

        return ok(
          asText({
            botId: resolvedBotId,
            radius,
            includeNeutral,
            capturedCount: captured.length,
            captured,
            persistedConfigPath: persistedChatConfigPath
          })
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "memory.player.delete",
    "Delete a remembered player profile by playerName",
    {
      botId: optionalTrimmedString,
      playerName: z.string().min(1)
    },
    async ({ botId, playerName }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        const normalizedPlayerName = String(playerName ?? "").trim();
        const removed = agentGameMemoryStateStore.deletePlayer(resolvedBotId, normalizedPlayerName);
        if (removed) {
          queuePersistChatState();
          queuePersistSharedGameMemory();
        }
        return ok(
          asText({
            botId: resolvedBotId,
            playerName: normalizedPlayerName,
            removed,
            persistedConfigPath: persistedChatConfigPath
          })
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "memory.player.listByTag",
    "List remembered player profiles filtered by tag or free-text keyword",
    {
      botId: optionalTrimmedString,
      tag: z.string().min(1),
      limit: z.number().int().positive().max(50).default(10)
    },
    async ({ botId, tag, limit }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        const needle = String(tag ?? "").trim().toLowerCase();
        const profiles = [...getOrCreateMemoryPlayerProfiles(resolvedBotId).values()]
          .filter((profile) => {
            const haystack = `${profile.playerName} ${profile.relation ?? ""} ${profile.notes ?? ""} ${(profile.tags ?? []).join(" ")}`.toLowerCase();
            return haystack.includes(needle);
          })
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, limit);
        return ok(
          asText({
            botId: resolvedBotId,
            tag: needle,
            limit,
            count: profiles.length,
            playerProfiles: profiles,
            persistedConfigPath: persistedChatConfigPath
          })
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "memory.place.upsert",
    "Create or update a lightweight place memory record",
    {
      botId: optionalTrimmedString,
      placeId: z.string().min(1),
      label: z.string().min(1),
      x: z.number(),
      y: z.number(),
      z: z.number(),
      dimension: optionalTrimmedString,
      notes: optionalTrimmedString,
      tags: z.array(z.string().min(1)).max(12).optional()
    },
    async ({ botId, placeId, label, x, y, z, dimension, notes, tags }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        const place = rememberPlace(resolvedBotId, placeId, {
          placeId,
          label,
          x,
          y,
          z,
          dimension: dimension ?? undefined,
          notes: notes ?? undefined,
          tags: tags ?? []
        });
        return ok(asText({ botId: resolvedBotId, place, persistedConfigPath: persistedChatConfigPath }));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "memory.place.delete",
    "Delete a remembered place by placeId",
    {
      botId: optionalTrimmedString,
      placeId: z.string().min(1)
    },
    async ({ botId, placeId }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        const normalizedPlaceId = String(placeId ?? "").trim();
        const removed = agentGameMemoryStateStore.deletePlace(resolvedBotId, normalizedPlaceId);
        if (removed) {
          const territory = getOrCreateTerritoryConfig(resolvedBotId);
          territory.placeIds = territory.placeIds.filter((id) => id !== normalizedPlaceId);
          territoryConfigStore.replace(resolvedBotId, territory);
          queuePersistChatState();
          queuePersistSharedGameMemory();
        }
        return ok(
          asText({
            botId: resolvedBotId,
            placeId: normalizedPlaceId,
            removed,
            persistedConfigPath: persistedChatConfigPath
          })
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "memory.place.nearest",
    "Get nearest remembered place to the bot's current position",
    {
      botId: optionalTrimmedString
    },
    async ({ botId }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        const location = requireSelfLocation(
          registry.get(resolvedBotId).getSelfState(),
          resolvedBotId
        );
        const nearest = findNearestRememberedPlace(
          resolvedBotId,
          location.position,
          location.dimension
        );
        return ok(
          asText({
            botId: resolvedBotId,
            currentPosition: location.roundedPosition,
            dimension: location.dimension ?? null,
            nearestPlace: nearest,
            persistedConfigPath: persistedChatConfigPath
          })
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "memory.place.listByTag",
    "List remembered places filtered by tag or free-text keyword",
    {
      botId: optionalTrimmedString,
      tag: z.string().min(1),
      limit: z.number().int().positive().max(50).default(10)
    },
    async ({ botId, tag, limit }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        const needle = String(tag ?? "").trim().toLowerCase();
        const places = [...getOrCreateMemoryPlaces(resolvedBotId).values()]
          .filter((place) => {
            const haystack = `${place.label} ${place.notes ?? ""} ${(place.tags ?? []).join(" ")}`.toLowerCase();
            return haystack.includes(needle);
          })
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, limit);
        return ok(
          asText({
            botId: resolvedBotId,
            tag: needle,
            limit,
            count: places.length,
            places,
            persistedConfigPath: persistedChatConfigPath
          })
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "memory.place.goTo",
    "Move to a remembered place by placeId",
    {
      botId: optionalTrimmedString,
      placeId: z.string().min(1),
      stopRadius: z.number().positive().max(16).optional()
    },
    async ({ botId, placeId, stopRadius }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        const normalizedPlaceId = String(placeId ?? "").trim();
        const place = getOrCreateMemoryPlaces(resolvedBotId).get(normalizedPlaceId);
        if (!place) {
          return fail(`Remembered place '${normalizedPlaceId}' not found`);
        }

        const location = requireSelfLocation(
          registry.get(resolvedBotId).getSelfState(),
          resolvedBotId
        );
        if (!isDimensionCompatible(place.dimension, location.dimension)) {
          return fail(
            `Remembered place '${normalizedPlaceId}' is in dimension '${place.dimension}', but bot is currently in '${location.dimension}'`
          );
        }

        const resolvedStopRadius = stopRadius ?? 2.5;
        goToPosition(
          resolvedBotId,
          registry,
          { x: place.x, y: place.y, z: place.z },
          resolvedStopRadius
        );

        return ok(
          asText({
            botId: resolvedBotId,
            place,
            stopRadius: resolvedStopRadius,
            message: `Moving to remembered place '${place.label}'`
          })
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "container.inspectRemembered",
    "Move to a remembered place, open a nearby supported container block, and inspect its contents",
    {
      botId: optionalTrimmedString,
      placeId: z.string().min(1),
      autoMove: z.boolean().default(true),
      stopRadius: z.number().positive().max(16).default(2.5),
      searchRadius: z.number().positive().max(4).default(1.5)
    },
    async ({ botId, placeId, autoMove, stopRadius, searchRadius }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        return ok(
          asText(
            await inspectRememberedContainer(resolvedBotId, registry, placeId, {
              autoMove,
              stopRadius,
              searchRadius
            })
          )
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "container.depositMatching",
    "Move to a remembered container and deposit matching inventory items into it",
    {
      botId: optionalTrimmedString,
      placeId: z.string().min(1),
      query: z.string().min(1),
      matchMode: z.enum(["exact", "includes"]).default("exact"),
      count: z.number().int().positive().optional(),
      autoMove: z.boolean().default(true),
      stopRadius: z.number().positive().max(16).default(2.5),
      searchRadius: z.number().positive().max(4).default(1.5)
    },
    async ({ botId, placeId, query, matchMode, count, autoMove, stopRadius, searchRadius }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        return ok(
          asText(
            await depositMatchingItemsIntoRememberedContainer(
              resolvedBotId,
              registry,
              placeId,
              query,
              matchMode,
              count,
              { autoMove, stopRadius, searchRadius }
            )
          )
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "container.withdrawMatching",
    "Move to a remembered container and withdraw matching items from it",
    {
      botId: optionalTrimmedString,
      placeId: z.string().min(1),
      query: z.string().min(1),
      matchMode: z.enum(["exact", "includes"]).default("exact"),
      count: z.number().int().positive().optional(),
      autoMove: z.boolean().default(true),
      stopRadius: z.number().positive().max(16).default(2.5),
      searchRadius: z.number().positive().max(4).default(1.5)
    },
    async ({ botId, placeId, query, matchMode, count, autoMove, stopRadius, searchRadius }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        return ok(
          asText(
            await withdrawMatchingItemsFromRememberedContainer(
              resolvedBotId,
              registry,
              placeId,
              query,
              matchMode,
              count,
              { autoMove, stopRadius, searchRadius }
            )
          )
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "container.depositAllByTag",
    "Move to a remembered container and deposit all inventory items matching a fixed storage tag",
    {
      botId: optionalTrimmedString,
      placeId: z.string().min(1),
      tag: z.enum(["food", "fish", "blocks", "ores", "tools", "combat", "misc"]),
      autoMove: z.boolean().default(true),
      stopRadius: z.number().positive().max(16).default(2.5),
      searchRadius: z.number().positive().max(4).default(1.5)
    },
    async ({ botId, placeId, tag, autoMove, stopRadius, searchRadius }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        return ok(
          asText(
            await depositAllByTagIntoRememberedContainer(
              resolvedBotId,
              registry,
              placeId,
              tag,
              { autoMove, stopRadius, searchRadius }
            )
          )
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "container.depositAllExceptHotbar",
    "Move to a remembered container and deposit all main-inventory items while keeping hotbar and equipment untouched",
    {
      botId: optionalTrimmedString,
      placeId: z.string().min(1),
      autoMove: z.boolean().default(true),
      stopRadius: z.number().positive().max(16).default(2.5),
      searchRadius: z.number().positive().max(4).default(1.5)
    },
    async ({ botId, placeId, autoMove, stopRadius, searchRadius }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        return ok(
          asText(
            await depositAllExceptHotbarIntoRememberedContainer(
              resolvedBotId,
              registry,
              placeId,
              { autoMove, stopRadius, searchRadius }
            )
          )
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "container.withdrawByTag",
    "Move to a remembered container and withdraw items matching a fixed storage tag",
    {
      botId: optionalTrimmedString,
      placeId: z.string().min(1),
      tag: z.enum(["food", "fish", "blocks", "ores", "tools", "combat", "misc"]),
      count: z.number().int().positive().optional(),
      autoMove: z.boolean().default(true),
      stopRadius: z.number().positive().max(16).default(2.5),
      searchRadius: z.number().positive().max(4).default(1.5)
    },
    async ({ botId, placeId, tag, count, autoMove, stopRadius, searchRadius }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        return ok(
          asText(
            await withdrawByTagFromRememberedContainer(
              resolvedBotId,
              registry,
              placeId,
              tag,
              count,
              { autoMove, stopRadius, searchRadius }
            )
          )
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "container.withdrawFood",
    "Move to a remembered container and withdraw food, optionally preferring an exact food item name",
    {
      botId: optionalTrimmedString,
      placeId: z.string().min(1),
      count: z.number().int().positive().max(64).default(16),
      preferredItemName: optionalTrimmedString,
      autoMove: z.boolean().default(true),
      stopRadius: z.number().positive().max(16).default(2.5),
      searchRadius: z.number().positive().max(4).default(1.5)
    },
    async ({ botId, placeId, count, preferredItemName, autoMove, stopRadius, searchRadius }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        return ok(
          asText(
            await withdrawFoodFromRememberedContainer(
              resolvedBotId,
              registry,
              placeId,
              count,
              preferredItemName ?? undefined,
              { autoMove, stopRadius, searchRadius }
            )
          )
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "container.restockCombat",
    "Withdraw combat items from a remembered container, then prepare battle loadout",
    {
      botId: optionalTrimmedString,
      placeId: z.string().min(1),
      count: z.number().int().positive().max(64).default(16),
      autoMove: z.boolean().default(true),
      stopRadius: z.number().positive().max(16).default(2.5),
      searchRadius: z.number().positive().max(4).default(1.5)
    },
    async ({ botId, placeId, count, autoMove, stopRadius, searchRadius }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        return ok(
          asText(
            await restockCombatFromRememberedContainer(
              resolvedBotId,
              registry,
              placeId,
              count,
              { autoMove, stopRadius, searchRadius }
            )
          )
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "container.restockFood",
    "Withdraw food from a remembered container and equip the best available food in hand",
    {
      botId: optionalTrimmedString,
      placeId: z.string().min(1),
      count: z.number().int().positive().max(64).default(16),
      preferredItemName: optionalTrimmedString,
      autoMove: z.boolean().default(true),
      stopRadius: z.number().positive().max(16).default(2.5),
      searchRadius: z.number().positive().max(4).default(1.5)
    },
    async ({ botId, placeId, count, preferredItemName, autoMove, stopRadius, searchRadius }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        return ok(
          asText(
            await restockFoodFromRememberedContainer(
              resolvedBotId,
              registry,
              placeId,
              count,
              preferredItemName ?? undefined,
              { autoMove, stopRadius, searchRadius }
            )
          )
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "territory.configure",
    "Configure lightweight territory guard behavior around remembered places",
    {
      botId: optionalTrimmedString,
      enabled: optionalFlexibleBoolean,
      placeIds: optionalFlexiblePlaceIdArray,
      requiredTags: optionalFlexibleLimitedStringArray,
      radius: z.number().min(4).max(64).optional(),
      warningCooldownMs: z.number().int().min(1000).max(300000).optional(),
      escalationEnabled: optionalFlexibleBoolean,
      ownerPresencePolicy: z.enum(["always", "owner_nearby_only"]).optional(),
      escalationDelayMs: z.number().int().min(1000).max(300000).optional(),
      warningMessage: optionalTrimmedString
    },
    async ({ botId, enabled, placeIds, requiredTags, radius, warningCooldownMs, escalationEnabled, ownerPresencePolicy, escalationDelayMs, warningMessage }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        const current = getOrCreateTerritoryConfig(resolvedBotId);
        if (typeof enabled === "boolean") current.enabled = enabled;
        if (placeIds) {
          current.placeIds = [...new Set(placeIds.map((x) => String(x).trim()).filter(Boolean))].slice(0, 16);
        }
        if (requiredTags) {
          current.requiredTags = [...new Set(requiredTags.map((x) => String(x).trim().toLowerCase()).filter(Boolean))].slice(0, 12);
        }
        if (typeof radius === "number") current.radius = Math.max(4, Math.min(64, radius));
        if (typeof warningCooldownMs === "number") {
          current.warningCooldownMs = Math.max(1000, Math.min(300_000, warningCooldownMs));
        }
        if (typeof escalationEnabled === "boolean") current.escalationEnabled = escalationEnabled;
        if (ownerPresencePolicy) current.ownerPresencePolicy = ownerPresencePolicy;
        if (typeof escalationDelayMs === "number") {
          current.escalationDelayMs = Math.max(1000, Math.min(300_000, escalationDelayMs));
        }
        if (typeof warningMessage === "string") {
          current.warningMessage = warningMessage.trim() || "走开。";
        }
        const territory = territoryConfigStore.replace(resolvedBotId, current);
        queuePersistChatState();
        return ok(
          asText({
            botId: resolvedBotId,
            territory,
            resolvedPlaces: findConfiguredTerritoryPlaces(resolvedBotId),
            persistedConfigPath: persistedChatConfigPath
          })
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "territory.status",
    "Get current lightweight territory guard config and resolved remembered places",
    {
      botId: optionalTrimmedString
    },
    async ({ botId }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        return ok(
          asText({
            botId: resolvedBotId,
            territory: getOrCreateTerritoryConfig(resolvedBotId),
            resolvedPlaces: findConfiguredTerritoryPlaces(resolvedBotId),
            persistedConfigPath: persistedChatConfigPath
          })
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "memory.clear",
    "Clear remembered players, places, task history, or all memory for a bot",
    {
      botId: optionalTrimmedString,
      scope: z.enum(["all", "players", "places", "taskHistory"]).default("all")
    },
    async ({ botId, scope }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        const cleared: string[] = [];
        if (scope === "all" || scope === "players") {
          agentGameMemoryStateStore.clearPlayers(resolvedBotId);
          cleared.push("players");
        }
        if (scope === "all" || scope === "places") {
          agentGameMemoryStateStore.clearPlaces(resolvedBotId);
          const territory = getOrCreateTerritoryConfig(resolvedBotId);
          territory.placeIds = [];
          territoryConfigStore.replace(resolvedBotId, territory);
          cleared.push("places");
        }
        if (scope === "all" || scope === "taskHistory") {
          agentTaskHistoryStore.clear(resolvedBotId);
          cleared.push("taskHistory");
        }
        queuePersistChatState();
        if (scope === "all" || scope === "players" || scope === "places") {
          queuePersistSharedGameMemory();
        }
        return ok(
          asText({
            botId: resolvedBotId,
            scope,
            cleared,
            persistedConfigPath: persistedChatConfigPath
          })
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "memory.place.captureHere",
    "Capture the bot's current position as a named place memory record",
    {
      botId: optionalTrimmedString,
      placeId: z.string().min(1),
      label: z.string().min(1),
      notes: optionalTrimmedString,
      tags: z.array(z.string().min(1)).max(12).optional()
    },
    async ({ botId, placeId, label, notes, tags }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        return ok(asText(debugCapturePlaceHere(resolvedBotId, registry, {
          placeId,
          label,
          notes: notes ?? undefined,
          tags: tags ?? []
        })));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "memory.status",
    "Get lightweight memory plus shared player/place import status",
    {
      botId: optionalTrimmedString
    },
    async ({ botId }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        return ok(
          asText({
            botId: resolvedBotId,
            playerProfiles: [...getOrCreateMemoryPlayerProfiles(resolvedBotId).values()].sort((a, b) => b.updatedAt - a.updatedAt),
            places: [...getOrCreateMemoryPlaces(resolvedBotId).values()].sort((a, b) => b.updatedAt - a.updatedAt),
            taskHistory: getTaskHistory(resolvedBotId),
            sharedGameMemory: await getSharedGameMemoryStatusForDebug(),
            persistedConfigPath: persistedChatConfigPath
          })
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "agent.status",
    "Get AI agent runtime status",
    {
      botId: optionalTrimmedString
    },
    async ({ botId }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        const cfg = getOrCreateAgentConfig(resolvedBotId);
        return ok(
          asText({
            botId: resolvedBotId,
            enabled: cfg.enabled,
            mode: cfg.mode,
            runtimeState: getAgentRuntimeState(resolvedBotId),
            whitelist: [...cfg.whitelist],
            owner: cfg.owner,
            commandWakeWord: cfg.commandWakeWord,
            autoIdlePolicy: cfg.autoIdlePolicy,
            plannerApiBaseUrl: cfg.plannerApiBaseUrl,
            hasPlannerApiKey: !!cfg.plannerApiKey,
            plannerModel: cfg.plannerModel,
            planCooldownMs: cfg.planCooldownMs,
            maxPlanSteps: cfg.maxPlanSteps,
            maxToolCallsPerTurn: cfg.maxToolCallsPerTurn,
            allowProactiveAction: cfg.allowProactiveAction,
            allowedTools: cfg.allowedTools,
            executorAttached: agentExecutorLifecycle.isAttached(resolvedBotId),
            queuedStepCount: getQueuedPlannerSteps(resolvedBotId).length,
            strategicGoal: getStrategicGoal(resolvedBotId),
            currentMilestone: getCurrentStrategicMilestone(resolvedBotId),
            lastPlanAt: cfg.lastPlanAt ? new Date(cfg.lastPlanAt).toISOString() : null,
            lastPlanSummary: cfg.lastPlanSummary,
            lastPlanResult: cfg.lastPlanResult,
            lastPlannerRequest: cfg.lastPlannerRequest,
            recentEventCount: getAgentHierarchicalRuntime(resolvedBotId).snapshot().executionEvents.length,
            persistedConfigPath: persistedChatConfigPath
          })
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "client.adapter.status",
    "Get active client adapter type, connection snapshot, supported capabilities, and recent unified actions",
    {
      botId: optionalTrimmedString
    },
    async ({ botId }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        return ok(
          asText({
            botId: resolvedBotId,
            ...registry.get(resolvedBotId).getClientAdapterStatus()
          })
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "agent.framework.status",
    "Get the new hierarchical agent runtime status and blackboard snapshot",
    {
      botId: optionalTrimmedString
    },
    async ({ botId }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        hierarchicalAgents.syncBotIds(registry.listBotIds());
        syncHierarchicalAgentState(resolvedBotId, registry);
        const runtime = hierarchicalAgents.ensure(resolvedBotId);
        return ok(
          asText({
            botId: resolvedBotId,
            status: runtime.status(),
            snapshot: runtime.snapshot()
          })
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "agent.events.tail",
    "Get recent agent events with optional type filter for acceptance testing",
    {
      botId: optionalTrimmedString,
      count: z.number().int().min(1).max(20).default(8),
      type: optionalTrimmedString
    },
    async ({ botId, count, type }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        const wantedType = type?.trim() || null;
        const events = getAgentHierarchicalRuntime(resolvedBotId)
          .snapshot()
          .executionEvents
          .filter((event) => !wantedType || event.type === wantedType)
          .slice(-count);
        return ok(
          asText({
            botId: resolvedBotId,
            count: events.length,
            filterType: wantedType,
            events
          })
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "agent.trace.summary",
    "Get a compact execution trace summary: task, directive, action, skill, goal, and recent events",
    {
      botId: optionalTrimmedString
    },
    async ({ botId }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        hierarchicalAgents.syncBotIds(registry.listBotIds());
        syncHierarchicalAgentState(resolvedBotId, registry);
        return ok(asText(buildAgentExecutionTrace(resolvedBotId)));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "agent.goal.status",
    "Get current strategic goal tracked by the agent runtime",
    {
      botId: optionalTrimmedString
    },
    async ({ botId }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        return ok(
          asText({
            botId: resolvedBotId,
            strategicGoal: getStrategicGoal(resolvedBotId),
            currentMilestone: getCurrentStrategicMilestone(resolvedBotId),
            remainingMilestones:
              (() => {
                const goal = getStrategicGoal(resolvedBotId);
                if (!goal?.milestones?.length) return [];
                const start = Math.max(0, Math.min(goal.currentMilestoneIndex ?? 0, goal.milestones.length - 1));
                return goal.milestones.slice(start);
              })(),
            persistedConfigPath: persistedChatConfigPath
          })
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "agent.goal.set",
    "Set current strategic goal explicitly for future strategic passes",
    {
      botId: optionalTrimmedString,
      goal: z.string().min(1),
      rationale: optionalTrimmedString,
      milestones: z.preprocess(
        splitFlexibleStringArray,
        z.array(z.string().min(1)).max(8).optional()
      ),
      currentMilestoneIndex: optionalFlexibleNonNegativeInt
    },
    async ({ botId, goal, rationale, milestones, currentMilestoneIndex }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        updateStrategicGoal(resolvedBotId, goal, "manual", rationale ?? undefined, milestones, currentMilestoneIndex);
        const current = getStrategicGoal(resolvedBotId);
        const cfg = getOrCreateAgentConfig(resolvedBotId);
        const overrideApplied = maybeOverrideCurrentTaskForManualGoal(resolvedBotId, registry);
        const activationAttempted = cfg.mode === "auto";
        const activationTriggered = activationAttempted
          ? await maybeActivateStrategicGoal(resolvedBotId, registry)
          : false;
        if (activationTriggered) {
          setAgentRuntimeState(resolvedBotId, "task_running");
        }
        return ok(
          asText({
            botId: resolvedBotId,
            strategicGoal: current,
            currentMilestone: getCurrentStrategicMilestone(resolvedBotId),
            overrideApplied,
            activationAttempted,
            activationTriggered,
            persistedConfigPath: persistedChatConfigPath
          })
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "agent.goal.advance",
    "Advance current milestone of the strategic goal",
    {
      botId: optionalTrimmedString
    },
    async ({ botId }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        const result = advanceStrategicMilestone(resolvedBotId, registry, "manual_tool");
        return ok(
          asText({
            botId: resolvedBotId,
            advanced: result.advanced,
            completed: result.completed,
            strategicGoal: result.strategicGoal,
            currentMilestone: result.currentMilestone,
            persistedConfigPath: persistedChatConfigPath
          })
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "agent.goal.rewind",
    "Rewind current milestone of the strategic goal by one step",
    {
      botId: optionalTrimmedString
    },
    async ({ botId }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        const result = rewindStrategicMilestone(resolvedBotId, registry, "manual_tool");
        return ok(
          asText({
            botId: resolvedBotId,
            rewound: result.rewound,
            strategicGoal: result.strategicGoal,
            currentMilestone: result.currentMilestone,
            persistedConfigPath: persistedChatConfigPath
          })
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "agent.goal.clear",
    "Clear current strategic goal so future strategic passes start fresh",
    {
      botId: optionalTrimmedString
    },
    async ({ botId }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        invalidatePlannerRequest(resolvedBotId);
        setStrategicGoal(resolvedBotId, null);
        queuePersistChatState();
        return ok(
          asText({
            botId: resolvedBotId,
            cleared: true,
            strategicGoal: null,
            persistedConfigPath: persistedChatConfigPath
          })
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "agent.stateSnapshot",
    "Build the structured agent runtime snapshot for debugging/planning",
    {
      botId: optionalTrimmedString
    },
    async ({ botId }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        return ok(asText(getAgentStateSnapshotForDebug(resolvedBotId, registry)));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "agent.runOnce",
    "Run one AI planning turn and optionally execute one whitelisted skill",
    {
      botId: optionalTrimmedString,
      userInstruction: z.string().min(1),
      requester: optionalTrimmedString
    },
    async ({ botId, userInstruction, requester }): Promise<ToolResponse> => {
      let planningStarted = false;
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        const cfg = getOrCreateAgentConfig(resolvedBotId);
        if (!cfg.enabled) {
          return fail("Agent is disabled. Enable it via agent.configure first.");
        }

        const actor = requester?.trim() || cfg.owner || "";
        if (cfg.whitelist.size > 0 && actor && !cfg.whitelist.has(actor)) {
          return fail(`Requester '${actor}' is not in agent whitelist`);
        }

        setAgentRuntimeState(resolvedBotId, "task_running");
        recordAgentEvent(resolvedBotId, "wake_command", "normal", {
          requester: actor || null,
          userInstruction
        });
        planningStarted = true;
        const { plan, plannedSteps, executionResult, stateSnapshot } = await runAgentPlanningTurn(
          resolvedBotId,
          registry,
          cfg,
          userInstruction,
          actor || null,
          "manual",
          true
        );

        return ok(
          asText({
            botId: resolvedBotId,
            requester: actor || null,
            plan,
            plannedSteps,
            executionResult,
            stateSnapshot
          })
        );
      } catch (error) {
        try {
          if (!planningStarted) {
            const resolvedBotId = resolveBotId(registry, botId);
            setAgentRuntimeState(resolvedBotId, getActiveAgentTask(resolvedBotId) ? "task_running" : "idle");
            agentConfigStore.updateRuntimeDiagnostics(resolvedBotId, {
              lastPlanResult: error instanceof Error ? error.message : String(error)
            });
          }
        } catch (_cleanupError) {
          // Preserve the original tool error when best-effort cleanup fails.
        }
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "movement.walk",
    "Walk forward for duration milliseconds",
    {
      botId: z.string().min(1),
      durationMs: z.number().int().min(100).max(60000).default(1000),
      sprint: z.boolean().optional(),
      jump: z.boolean().optional()
    },
    async ({ botId, durationMs, sprint = false, jump = false }): Promise<ToolResponse> => {
      try {
        const runtime = registry.get(botId);

        stopFollowLoop(botId, registry);
        stopWalkTimer(botId);

        await stopMovementAndClear(botId, registry);
        await runtime.walkForward({ sprint, jump });

        walkTimerLifecycle.schedule(botId, durationMs, () => {
          void stopMovementAndClear(botId, registry).catch(() => {
            // ignore when bot disconnected in timer window
          });
        });
        return ok(`Walking forward for ${durationMs}ms (sprint=${sprint}, jump=${jump})`);
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "movement.stop",
    "Stop all movement control states",
    {
      botId: z.string().min(1)
    },
    async ({ botId }): Promise<ToolResponse> => {
      try {
        stopWalkTimer(botId);
        stopFollowLoop(botId, registry);
        await stopMovementAndClear(botId, registry);
        return ok("Stopped movement");
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "player.look",
    "Turn head to target yaw/pitch in radians",
    {
      botId: z.string().min(1),
      yaw: z.number(),
      pitch: z.number(),
      force: z.boolean().optional()
    },
    async ({ botId, yaw, pitch, force = true }): Promise<ToolResponse> => {
      try {
        const runtime = registry.get(botId);
        await runtime.look(yaw, pitch, force);
        return ok(`Look set to yaw=${yaw}, pitch=${pitch}`);
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "inventory.holdSlot",
    "Switch held item to a hotbar slot (1-9)",
    {
      botId: z.string().min(1),
      slot: z.number().int().min(1).max(9)
    },
    async ({ botId, slot }): Promise<ToolResponse> => {
      try {
        const result = await registry.get(botId).holdHotbarSlot({ slot });
        return ok(result.detail ? result.detail.replace(/^selected/, "Selected") : `Selected hotbar slot ${slot}`);
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  registerAgentCoreTool(
    server,
    "inventory.holdByCategory",
    {
      botId: z.string().min(1),
      category: z.enum(["sword", "axe", "pickaxe", "food"])
    },
    async ({ botId, category }): Promise<ToolResponse> => {
      try {
        const { result } = await getActionCommandSet(registry).invokeHoldByCategory(
          { botId, source: "mcp" },
          { category }
        );
        return ok(result.detail ? result.detail.replace(/^equipped/, "Equipped") : `Equipped item for category '${category}'`);
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  registerAgentCoreTool(
    server,
    "inventory.organizeHotbar",
    {
      botId: z.string().min(1)
    },
    async ({ botId }): Promise<ToolResponse> => {
      try {
        const result = await registry.get(botId).organizeHotbar();

        return ok(asText({
          botId,
          rule: "1=sword,2=axe,3=pickaxe,9=food",
          actions: result.actions
        }));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  registerAgentCoreTool(
    server,
    "combat.prepareBattle",
    {
      botId: z.string().min(1)
    },
    async ({ botId }): Promise<ToolResponse> => {
      try {
        const result = await runPrepareBattle(botId, registry);
        return ok(result);
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  registerAgentCoreTool(
    server,
    "combat.challengeEntity",
    {
      botId: z.string().min(1),
      targetText: z.string().min(1),
      maxDistance: z.number().positive().max(32).default(16),
      requester: z.string().min(1).default("agent")
    },
    async ({ botId, targetText, maxDistance, requester }): Promise<ToolResponse> => {
      try {
        const result = runChallengeEntity(botId, registry, targetText, requester, maxDistance);
        return ok(result);
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "interact.swing",
    "Swing arm once (visual attack/use animation)",
    {
      botId: z.string().min(1),
      arm: z.enum(["right", "left"]).optional()
    },
    async ({ botId, arm = "right" }): Promise<ToolResponse> => {
      try {
        const runtime = registry.get(botId);
        await runtime.swingArm(arm);
        return ok(`Swung ${arm} arm once`);
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  registerAgentCoreTool(
    server,
    "interact.dropHeld",
    {
      botId: z.string().min(1),
      mode: z.enum(["one", "stack"]).default("one")
    },
    async ({ botId, mode }): Promise<ToolResponse> => {
      try {
        const runtime = registry.get(botId);
        const held = runtime.getInventoryState().heldItem;
        if (!held) return fail("No held item to drop");

        await runtime.dropHeldItem(mode);
        if (mode === "one") {
          return ok(`Dropped one '${held.name}' from hand`);
        }

        return ok(`Dropped full stack of '${held.name}' from hand`);
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  registerAgentCoreTool(
    server,
    "interact.dropHotbarSlot",
    {
      botId: z.string().min(1),
      slot: z.number().int().min(1).max(9),
      mode: z.enum(["one", "stack"]).default("one"),
      restorePrevious: z.boolean().default(true)
    },
    async ({ botId, slot, mode, restorePrevious }): Promise<ToolResponse> => {
      try {
        const runtime = registry.get(botId);
        const targetInventorySlot = 36 + (slot - 1);
        const held = runtime.getInventoryState(true).slots?.find((entry) => entry.slot === targetInventorySlot)?.item ?? null;
        if (!held) {
          return fail(`Hotbar slot ${slot} is empty`);
        }

        await runtime.dropHotbarSlot({ slot, mode, restorePrevious });

        return ok(`Dropped ${mode === "one" ? "one" : "stack"} from hotbar slot ${slot} (${held.name})`);
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "interact.rightClick",
    "Right-click behavior: tap (prefer block interaction) or hold (use/eat/charge)",
    {
      botId: z.string().min(1),
      mode: z.enum(["tap", "hold"]).default("tap"),
      holdMs: z.number().int().min(100).max(10000).default(1200),
      reach: z.number().positive().max(8).default(4.5),
      preferBlockInteraction: z.boolean().default(true)
    },
    async ({ botId, mode, holdMs, reach, preferBlockInteraction }): Promise<ToolResponse> => {
      try {
        const result = await registry.get(botId).useHeldItem({
          mode,
          holdMs,
          reach,
          preferBlockInteraction
        });
        return ok(result.detail ?? "Right-click action completed");
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "interact.eat",
    "Eat a food item from inventory (optionally by exact item name)",
    {
      botId: z.string().min(1),
      itemName: z.string().min(1).optional()
    },
    async ({ botId, itemName }): Promise<ToolResponse> => {
      try {
        const { result } = await getActionCommandSet(registry).invokeEat(
          { botId, source: "mcp" },
          { itemName }
        );
        return ok(result.detail ? result.detail.replace(/^ate/, "Ate") : "Ate food");
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "interact.attackPlayer",
    "Attack a specific nearby player once",
    {
      botId: z.string().min(1),
      playerName: z.string().min(1),
      maxDistance: z.number().positive().max(64).default(4.5)
    },
    async ({ botId, playerName, maxDistance }): Promise<ToolResponse> => {
      try {
        const result = await registry.get(botId).attackPlayer({ playerName, maxDistance });
        return ok(result.detail ? result.detail.replace(/^attacked/, "Attacked") : `Attacked player '${playerName}'`);
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "interact.attackNearestEntity",
    "Attack nearest entity by optional name/type filter",
    {
      botId: z.string().min(1),
      maxDistance: z.number().positive().max(64).default(4.5),
      type: z.string().optional(),
      name: z.string().optional(),
      includePlayers: z.boolean().default(false)
    },
    async ({ botId, maxDistance, type, name, includePlayers }): Promise<ToolResponse> => {
      try {
        const result = await registry.get(botId).attackNearestEntity({ maxDistance, type, name, includePlayers });
        return ok(result.detail ? result.detail.replace(/^attacked/, "Attacked") : "Attacked nearest entity");
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  registerAgentCoreTool(
    server,
    "interact.openDoor",
    {
      botId: z.string().min(1),
      reach: z.number().positive().max(8).default(4.5),
      radius: z.number().int().min(1).max(16).default(6)
    },
    async ({ botId, reach, radius }): Promise<ToolResponse> => {
      try {
        const { result } = await getActionCommandSet(registry).invokeOpenDoor(
          { botId, source: "mcp" },
          { reach, radius }
        );
        return ok(result.detail ?? "Toggled door");
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "block.find",
    "Find nearest blocks by exact block name within a bounded radius",
    {
      botId: z.string().min(1),
      blockName: z.string().min(1),
      radius: z.number().int().min(1).max(64).default(16),
      count: z.number().int().min(1).max(20).default(5)
    },
    async ({ botId, blockName, radius, count }): Promise<ToolResponse> => {
      try {
        const bot = registry.get(botId).getActiveBotOrThrow();
        const block = bot.registry.blocksByName[blockName];

        if (!block) {
          return fail(`Unknown block name '${blockName}'. Use minecraft block id name like 'sweet_berry_bush'.`);
        }

        const positions = bot.findBlocks({
          matching: block.id,
          maxDistance: radius,
          count
        });

        const me = bot.entity.position;
        const results = positions
          .map((pos) => ({
            x: pos.x,
            y: pos.y,
            z: pos.z,
            distance: Number(me.distanceTo(pos).toFixed(2))
          }))
          .sort((a, b) => a.distance - b.distance);

        return ok(asText({ blockName, radius, count: results.length, results }));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "block.findVisible",
    "Find visible blocks by exact block name (line-of-sight only; occluded blocks are excluded)",
    {
      botId: z.string().min(1),
      blockName: z.string().min(1),
      radius: z.number().int().min(1).max(64).default(16),
      count: z.number().int().min(1).max(20).default(5),
      visibleStep: z.number().positive().max(0.5).default(0.2)
    },
    async ({ botId, blockName, radius, count, visibleStep }): Promise<ToolResponse> => {
      try {
        const bot = registry.get(botId).getActiveBotOrThrow();
        if (!bot.registry.blocksByName[blockName]) {
          return fail(`Unknown block name '${blockName}'. Use minecraft block id name like 'coal_ore'.`);
        }

        const results = findVisibleBlocksByName(bot, blockName, radius, count, visibleStep).map((x) => ({
          x: x.block.position.x,
          y: x.block.position.y,
          z: x.block.position.z,
          distance: Number(x.distance.toFixed(2))
        }));

        return ok(
          asText({
            blockName,
            radius,
            visibleOnly: true,
            count: results.length,
            results
          })
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "mine.digNearestVisible",
    "Dig nearest visible target block by block name",
    {
      botId: z.string().min(1),
      blockName: z.string().min(1),
      searchRadius: z.number().int().min(1).max(64).default(24),
      reachDistance: z.number().positive().max(8).default(4.5),
      moveNear: z.boolean().default(true),
      visibleStep: z.number().positive().max(0.5).default(0.2),
      approachTimeoutMs: z.number().int().min(1000).max(120000).default(20000)
    },
    async ({ botId, blockName, searchRadius, reachDistance, moveNear, visibleStep, approachTimeoutMs }): Promise<ToolResponse> => {
      try {
        return await queueMiningTask(botId, async () => {
          startAgentTask(botId, {
            type: "mine_dig_visible",
            source: "manual_command",
            goal: `dig nearest visible ${blockName}`,
            params: { blockName, searchRadius, reachDistance, moveNear }
          });
          try {
            const bot = registry.get(botId).getActiveBotOrThrow();
            if (!bot.registry.blocksByName[blockName]) {
              finalizeAgentTask(botId, "failed", {
                ifType: "mine_dig_visible",
                lastError: `Unknown block name '${blockName}'.`
              });
              return fail(`Unknown block name '${blockName}'.`);
            }

            const target = findVisibleBlocksByName(bot, blockName, searchRadius, 1, visibleStep, 128)[0];
            if (!target) {
              finalizeAgentTask(botId, "failed", {
                ifType: "mine_dig_visible",
                lastError: `No visible '${blockName}' found within radius ${searchRadius}.`
              });
              return fail(`No visible '${blockName}' found within radius ${searchRadius}.`);
            }

            updateAgentTask(botId, {
              detail: moveNear ? `approaching ${blockName}` : `digging ${blockName}`
            });
            const miningResult = await registry.get(botId).mineBlock({
              target: {
                name: target.block.name,
                displayName: target.block.displayName ?? null,
                position: {
                  x: target.block.position.x,
                  y: target.block.position.y,
                  z: target.block.position.z
                }
              },
              reachDistance,
              moveNear,
              requireVisible: true,
              visibleStep,
              approachTimeoutMs
            });
            movementIntentStore.delete(botId);

            if (!miningResult.ok) {
              let errorMessage: string;
              switch (miningResult.outcome) {
                case "target_missing":
                case "target_changed":
                  errorMessage = "Target block changed/disappeared before digging.";
                  break;
                case "not_visible":
                  errorMessage = "Target is no longer visible (line-of-sight blocked).";
                  break;
                case "cannot_dig":
                  errorMessage = `Cannot dig '${miningResult.block.name}' at this position.`;
                  break;
                case "pathfinder_unavailable":
                  errorMessage = "Pathfinder is unavailable for approach.";
                  break;
                case "approach_unreachable":
                  errorMessage = `Cannot safely approach '${blockName}' (${miningResult.approachFailureReason ?? "unknown"}).`;
                  sendRuntimeChatNoWait(botId, registry, "我跟不上你啦");
                  break;
                default:
                  errorMessage = miningResult.detail ?? `Failed to dig '${blockName}'.`;
                  break;
              }
              finalizeAgentTask(botId, "failed", {
                ifType: "mine_dig_visible",
                lastError: errorMessage,
                payload: {
                  outcome: miningResult.outcome,
                  approachFailureReason: miningResult.approachFailureReason ?? null
                }
              });
              return fail(errorMessage);
            }

            const latest = miningResult.block;
            const distance = miningResult.finalDistance;
            finalizeAgentTask(botId, "finished", {
              ifType: "mine_dig_visible",
              detail: `dug ${latest.name}`,
              payload: {
                blockName: latest.name,
                x: latest.position.x,
                y: latest.position.y,
                z: latest.position.z,
                distance: Number(distance.toFixed(2))
              }
            });
            publishHierarchicalTaskLifecycle(botId, registry, "task_finished", "mine_dig_visible", `dug ${latest.name}`, {
              blockName: latest.name,
              x: latest.position.x,
              y: latest.position.y,
              z: latest.position.z,
              distance: Number(distance.toFixed(2))
            });

            return ok(
              asText({
                botId,
                mined: latest.name,
                position: { x: latest.position.x, y: latest.position.y, z: latest.position.z },
                distance: Number(distance.toFixed(2)),
                visibleOnly: true
              })
            );
          } catch (error) {
            finalizeAgentTask(botId, "failed", {
              ifType: "mine_dig_visible",
              lastError: error instanceof Error ? error.message : String(error)
            });
            publishHierarchicalTaskLifecycle(botId, registry, "task_failed", "mine_dig_visible", "mine_dig_visible failed", {
              lastError: error instanceof Error ? error.message : String(error)
            });
            throw error;
          }
        });
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  registerAgentCoreTool(
    server,
    "mine.collectVisible",
    {
      botId: z.string().min(1),
      blockNames: z.array(z.string().min(1)).min(1),
      searchRadius: z.number().int().min(1).max(64).default(24),
      maxBlocks: z.number().int().min(1).max(64).default(8),
      reachDistance: z.number().positive().max(8).default(4.5),
      moveNear: z.boolean().default(true),
      visibleStep: z.number().positive().max(0.5).default(0.2),
      approachTimeoutMs: z.number().int().min(1000).max(120000).default(20000)
    },
    async ({ botId, blockNames, searchRadius, maxBlocks, reachDistance, moveNear, visibleStep, approachTimeoutMs }): Promise<ToolResponse> => {
      try {
        return await queueMiningTask(botId, async () => {
          startAgentTask(botId, {
            type: "mine_collect_visible",
            source: "manual_command",
            goal: `collect visible blocks: ${blockNames.join(", ")}`,
            params: { blockNames, searchRadius, maxBlocks, reachDistance, moveNear }
          });
          try {
            const bot = registry.get(botId).getActiveBotOrThrow();
            const uniqueNames = [...new Set(blockNames.map((x) => x.trim()).filter(Boolean))];
            if (uniqueNames.length === 0) {
              finalizeAgentTask(botId, "failed", {
                ifType: "mine_collect_visible",
                lastError: "blockNames is empty after trim."
              });
              return fail("blockNames is empty after trim.");
            }
            const unknown = uniqueNames.filter((n) => !bot.registry.blocksByName[n]);
            if (unknown.length > 0) {
              finalizeAgentTask(botId, "failed", {
                ifType: "mine_collect_visible",
                lastError: `Unknown block name(s): ${unknown.join(", ")}`
              });
              return fail(`Unknown block name(s): ${unknown.join(", ")}`);
            }

            const mined: Array<{ name: string; x: number; y: number; z: number; distance: number }> = [];
            let stopReason = "reached_max_blocks";

            for (let i = 0; i < maxBlocks; i += 1) {
              updateAgentTask(botId, { detail: `scanning target ${i + 1}/${maxBlocks}` });
              const picked = findNearestVisibleBlockFromNames(bot, uniqueNames, searchRadius, visibleStep);
              if (!picked) {
                stopReason = "no_visible_target";
                break;
              }

              let distance = bot.entity.position.distanceTo(picked.block.position);
              if (moveNear && distance > reachDistance) {
                updateAgentTask(botId, { detail: `approaching ${picked.name}` });
                const pathSet = setPathfinderGoalNear(botId, bot, picked.block.position, Math.max(1, reachDistance - 1), "mining");
                if (!pathSet) {
                  stopReason = "pathfinder_unavailable";
                  break;
                }
                const arrived = await waitUntilNearPosition(bot, picked.block.position, reachDistance, approachTimeoutMs);
                const pathApi = bot.pathfinder;
                if (pathApi && typeof pathApi.setGoal === "function") {
                  pathApi.setGoal(null);
                }
                movementIntentStore.delete(botId);
                if (!arrived) {
                  stopReason = "approach_timeout";
                  break;
                }
                distance = bot.entity.position.distanceTo(picked.block.position);
              }

              const latest = bot.blockAt(picked.block.position);
              if (!latest || latest.type === 0) {
                continue;
              }
              if (!canSeeNativeBlock(bot, latest, visibleStep)) {
                continue;
              }
              if (typeof bot.canDigBlock === "function" && !bot.canDigBlock(latest)) {
                continue;
              }

              updateAgentTask(botId, { detail: `digging ${latest.name}` });
              await equipBestNativeToolForBlock(bot, latest);
              await bot.lookAt(latest.position.offset(0.5, 0.5, 0.5), true);
              await bot.dig(latest, true);
              mined.push({
                name: latest.name,
                x: latest.position.x,
                y: latest.position.y,
                z: latest.position.z,
                distance: Number(distance.toFixed(2))
              });
            }

            finalizeAgentTask(botId, "finished", {
              ifType: "mine_collect_visible",
              detail: `mined ${mined.length} blocks`,
              payload: { minedCount: mined.length, stopReason }
            });
            publishHierarchicalTaskLifecycle(
              botId,
              registry,
              "task_finished",
              "mine_collect_visible",
              `mined ${mined.length} blocks`,
              { minedCount: mined.length, stopReason }
            );

            return ok(
              asText({
                botId,
                visibleOnly: true,
                blockNames: uniqueNames,
                minedCount: mined.length,
                maxBlocks,
                stopReason,
                mined
              })
            );
          } catch (error) {
            finalizeAgentTask(botId, "failed", {
              ifType: "mine_collect_visible",
              lastError: error instanceof Error ? error.message : String(error)
            });
            publishHierarchicalTaskLifecycle(botId, registry, "task_failed", "mine_collect_visible", "mine_collect_visible failed", {
              lastError: error instanceof Error ? error.message : String(error)
            });
            throw error;
          }
        });
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "self.guard.configure",
    "Configure automatic self-preservation checks (health/food)",
    {
      botId: optionalTrimmedString,
      enabled: z.boolean().optional(),
      tickMs: z.number().int().min(500).max(30000).optional(),
      lowFood: z.number().int().min(1).max(19).optional(),
      lowHealth: z.number().int().min(1).max(20).optional(),
      criticalHealth: z.number().int().min(1).max(20).optional(),
      autoEat: z.boolean().optional(),
      autoStopFollowOnLowHealth: z.boolean().optional(),
      retaliateOnNonWhitelistHit: z.boolean().optional(),
      retaliationMaxDistance: z.number().positive().max(10).optional(),
      retaliationDecayMs: z.number().int().min(10000).max(30 * 60 * 1000).optional(),
      chatAlerts: z.boolean().optional(),
      alertCooldownMs: z.number().int().min(1000).max(300000).optional()
    },
    async (args): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, args.botId);
        const cfg = getOrCreateSelfGuardConfig(resolvedBotId);
        selfGuardTaskQueue.invalidate(resolvedBotId);

        if (args.enabled !== undefined) cfg.enabled = args.enabled;
        if (args.tickMs !== undefined) cfg.tickMs = args.tickMs;
        if (args.lowFood !== undefined) cfg.lowFood = args.lowFood;
        if (args.lowHealth !== undefined) cfg.lowHealth = args.lowHealth;
        if (args.criticalHealth !== undefined) cfg.criticalHealth = args.criticalHealth;
        if (args.autoEat !== undefined) cfg.autoEat = args.autoEat;
        if (args.autoStopFollowOnLowHealth !== undefined) cfg.autoStopFollowOnLowHealth = args.autoStopFollowOnLowHealth;
        if (args.retaliateOnNonWhitelistHit !== undefined) cfg.retaliateOnNonWhitelistHit = args.retaliateOnNonWhitelistHit;
        if (args.retaliationMaxDistance !== undefined) cfg.retaliationMaxDistance = args.retaliationMaxDistance;
        if (args.retaliationDecayMs !== undefined) cfg.retaliationDecayMs = args.retaliationDecayMs;
        if (args.chatAlerts !== undefined) cfg.chatAlerts = args.chatAlerts;
        if (args.alertCooldownMs !== undefined) cfg.alertCooldownMs = args.alertCooldownMs;

        if (cfg.criticalHealth > cfg.lowHealth) {
          cfg.criticalHealth = cfg.lowHealth;
        }

        queuePersistChatState();

        if (cfg.enabled) {
          startSelfGuardLoop(resolvedBotId, registry);
        } else {
          stopSelfGuardLoop(resolvedBotId);
        }

        return ok(asText({
          botId: resolvedBotId,
          ...cfg,
          running: selfGuardLoopLifecycle.has(resolvedBotId),
          persistedConfigPath: persistedChatConfigPath
        }));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "self.guard.status",
    "Get self-preservation guard config/status",
    {
      botId: optionalTrimmedString
    },
    async ({ botId }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        const cfg = getOrCreateSelfGuardConfig(resolvedBotId);
        return ok(asText({
          botId: resolvedBotId,
          ...cfg,
          running: selfGuardLoopLifecycle.has(resolvedBotId),
          persistedConfigPath: persistedChatConfigPath
        }));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "self.guard.check",
    "Run one immediate health/food check and return recommendation",
    {
      botId: optionalTrimmedString
    },
    async ({ botId }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        const cfg = getOrCreateSelfGuardConfig(resolvedBotId);
        const runtime = registry.get(resolvedBotId);
        const selfState = runtime.getSelfState();
        if (!selfState) throw new Error(`Bot '${resolvedBotId}' is not connected`);
        const inventory = runtime.getInventoryState();
        const foodItem = getBestFoodItem(inventory.items);
        const health = selfState.health ?? 20;
        const food = selfState.food ?? 20;

        return ok(asText({
          botId: resolvedBotId,
          health,
          food,
          followActive: followSessionLifecycle.has(resolvedBotId),
          hasFoodInInventory: !!foodItem,
          suggested: {
            shouldEat: cfg.autoEat && food <= cfg.lowFood,
            shouldStopFollow: cfg.autoStopFollowOnLowHealth && health <= cfg.criticalHealth
          },
          thresholds: {
            lowFood: cfg.lowFood,
            lowHealth: cfg.lowHealth,
            criticalHealth: cfg.criticalHealth
          }
        }));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  registerAgentCoreTool(
    server,
    "observe.self",
    {
      botId: z.string().min(1)
    },
    async ({ botId }): Promise<ToolResponse> => {
      try {
        const runtime = registry.get(botId);
        const selfState = runtime.getSelfState();
        if (!selfState) {
          throw new Error(`Bot '${botId}' self state is unavailable; connect it before observing`);
        }
        const inventory = runtime.getInventoryState();

        return ok(asText({
          username: selfState.username ?? null,
          health: selfState.health ?? null,
          food: selfState.food ?? null,
          oxygenLevel: selfState.oxygenLevel ?? null,
          heldItem: inventory.heldItem,
          armor: {
            head: inventory.armor.head?.name ?? null,
            torso: inventory.armor.torso?.name ?? null,
            legs: inventory.armor.legs?.name ?? null,
            feet: inventory.armor.feet?.name ?? null
          },
          game: {
            dimension: selfState.dimension ?? null,
            gameMode: selfState.gameMode ?? null,
            difficulty: selfState.difficulty ?? null
          },
          position: {
            x: selfState.position?.x ?? null,
            y: selfState.position?.y ?? null,
            z: selfState.position?.z ?? null,
            yaw: selfState.yaw ?? null,
            pitch: selfState.pitch ?? null,
            onGround: selfState.onGround ?? null,
            velocity: {
              x: selfState.velocity?.x ?? null,
              y: selfState.velocity?.y ?? null,
              z: selfState.velocity?.z ?? null
            }
          }
        }));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  registerAgentCoreTool(
    server,
    "observe.nearbyPlayers",
    {
      botId: z.string().min(1),
      radius: z.number().positive().max(256).default(32)
    },
    async ({ botId, radius }): Promise<ToolResponse> => {
      try {
        const runtime = registry.get(botId);
        const players = runtime.getNearbyPlayers(radius);
        const publicPlayers = players.map(({ entityId: _entityId, ...player }) => player);

        return ok(asText({ count: publicPlayers.length, radius, players: publicPlayers }));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  registerAgentCoreTool(
    server,
    "observe.nearbyEntities",
    {
      botId: z.string().min(1),
      radius: z.number().positive().max(256).default(24),
      type: z.string().optional()
    },
    async ({ botId, radius, type }): Promise<ToolResponse> => {
      try {
        const runtime = registry.get(botId);
        const typeFilter = type?.trim().toLowerCase();
        const entities = runtime
          .getNearbyEntities(radius)
          .filter((e) => (e.distance ?? Number.POSITIVE_INFINITY) <= radius)
          .filter((e) => {
            if (!typeFilter) return true;
            const joined = `${e.type} ${e.name ?? ""} ${e.displayName ?? ""} ${e.kind ?? ""}`.toLowerCase();
            return joined.includes(typeFilter);
          })
          .sort((a, b) => (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY));

        return ok(asText({ count: entities.length, radius, entities }));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  registerAgentCoreTool(
    server,
    "observe.inventory",
    {
      botId: z.string().min(1),
      includeSlots: z.boolean().optional()
    },
    async ({ botId, includeSlots = false }): Promise<ToolResponse> => {
      try {
        const runtime = registry.get(botId);
        const inventory = runtime.getInventoryState(includeSlots);
        const items = inventory.items;
        const summary = buildInventorySummary(items);

        const payload: Record<string, unknown> = {
          botId,
          heldItem: inventory.heldItem,
          itemStacks: items.length,
          itemSummary: summary,
          items
        };

        if (includeSlots) {
          payload.slots = inventory.slots ?? [];
        }

        return ok(asText(payload));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "observe.blocks",
    "Get block below feet and block in crosshair",
    {
      botId: z.string().min(1),
      reach: z.number().positive().max(8).default(4)
    },
    async ({ botId, reach }): Promise<ToolResponse> => {
      try {
        const runtime = registry.get(botId);
        const blocks = runtime.getBlockObservation(reach);

        return ok(asText({
          feet: blocks.feet,
          inSight: blocks.inSight
        }));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "perception.focus",
    "Get what the bot is currently focusing on in first-person view",
    {
      botId: z.string().min(1),
      reach: z.number().positive().max(8).default(6)
    },
    async ({ botId, reach }): Promise<ToolResponse> => {
      try {
        const bot = registry.get(botId).getActiveBotOrThrow();
        return ok(asText(buildFocusPerception(bot, reach)));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "perception.salient",
    "Get nearby salient players, entities, and interactable blocks",
    {
      botId: z.string().min(1),
      radius: z.number().int().min(4).max(24).default(12)
    },
    async ({ botId, radius }): Promise<ToolResponse> => {
      try {
        const resolvedBotId = resolveBotId(registry, botId);
        const bot = registry.get(resolvedBotId).getActiveBotOrThrow();
        return ok(asText(buildSalientPerception(resolvedBotId, registry, bot, radius)));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  registerAgentCoreTool(
    server,
    "move.followPlayer",
    {
      botId: z.string().min(1),
      playerName: z.string().min(1),
      minDistance: z.number().positive().max(16).default(2.5),
      maxDistance: z.number().positive().max(64).default(24),
      sprint: z.boolean().optional(),
      tickMs: z.number().int().min(100).max(2000).default(250),
      targetStillStopMs: z.number().int().min(1000).max(120000).default(16000)
    },
    async ({ botId, playerName, minDistance, maxDistance, sprint = false, tickMs, targetStillStopMs = 16000 }): Promise<ToolResponse> => {
      try {
        const result = startFollow(botId, registry, {
          playerName,
          minDistance,
          maxDistance,
          sprint,
          tickMs,
          targetStillStopMs
        });
        return ok(result);
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  registerAgentCoreTool(
    server,
    "move.stopFollow",
    {
      botId: z.string().min(1)
    },
    async ({ botId }): Promise<ToolResponse> => {
      try {
        const output = await getActionCommandSet(registry).invokeStopFollow({
          botId,
          source: "mcp"
        });
        return ok(String(output.message ?? "Stopped following"));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );
}






