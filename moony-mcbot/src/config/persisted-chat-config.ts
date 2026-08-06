import { z } from "zod";

const stringArraySchema = z.array(z.string());
const finiteNumberSchema = z.number().finite();

const chatIntentPhrasesSchema = z.object({
  follow: stringArraySchema.optional(),
  status: stringArraySchema.optional(),
  stop: stringArraySchema.optional(),
  eat: stringArraySchema.optional(),
  organize: stringArraySchema.optional(),
  mine: stringArraySchema.optional(),
  challenge: stringArraySchema.optional(),
  openDoor: stringArraySchema.optional(),
  attack: stringArraySchema.optional(),
  prepareBattle: stringArraySchema.optional()
}).passthrough();

const chatSpecialReplySchema = z.object({
  trigger: z.string(),
  reply: z.string(),
  matchMode: z.enum(["exact", "includes"]).optional()
}).passthrough();

const persistedChatConfigSchema = z.object({
  enabled: z.boolean().optional(),
  whitelist: stringArraySchema.optional(),
  wakeNames: stringArraySchema.optional(),
  dotPrefix: z.string().optional(),
  intents: chatIntentPhrasesSchema.optional(),
  specialReplies: z.array(chatSpecialReplySchema).optional()
}).passthrough();

const persistedChatAiConfigSchema = z.object({
  enabled: z.boolean().optional(),
  whitelist: stringArraySchema.optional(),
  wakeWord: z.string().optional(),
  cooldownMs: finiteNumberSchema.optional(),
  maxSentences: finiteNumberSchema.optional(),
  sentenceDelayMs: finiteNumberSchema.optional(),
  maxHistory: finiteNumberSchema.optional(),
  apiBaseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  modelFallbacks: stringArraySchema.optional(),
  systemPrompt: z.string().optional()
}).passthrough();

const strategicGoalSchema = z.object({
  goal: z.string(),
  rationale: z.string().optional(),
  source: z.enum(["manual", "strategic_pass"]).optional(),
  milestones: stringArraySchema.optional(),
  currentMilestoneIndex: finiteNumberSchema.optional(),
  createdAt: finiteNumberSchema.optional(),
  updatedAt: finiteNumberSchema.optional(),
  lastRepairAt: finiteNumberSchema.optional(),
  lastFailureEventId: z.string().optional(),
  failureCount: finiteNumberSchema.optional()
}).passthrough();

const playerProfileSchema = z.object({
  playerName: z.string().optional(),
  alias: z.string().optional(),
  relation: z.enum(["owner", "whitelist", "neutral"]).optional(),
  notes: z.string().optional(),
  tags: stringArraySchema.optional(),
  lastSeenAt: finiteNumberSchema.optional(),
  updatedAt: finiteNumberSchema.optional()
}).passthrough();

const placeRecordSchema = z.object({
  placeId: z.string().optional(),
  label: z.string().optional(),
  x: finiteNumberSchema.optional(),
  y: finiteNumberSchema.optional(),
  z: finiteNumberSchema.optional(),
  dimension: z.string().optional(),
  notes: z.string().optional(),
  tags: stringArraySchema.optional(),
  updatedAt: finiteNumberSchema.optional()
}).passthrough();

const taskHistoryRecordSchema = z.object({
  id: z.string().optional(),
  taskType: z.string().optional(),
  status: z.enum(["running", "finished", "failed", "cancelled"]).optional(),
  source: z.enum(["manual_command", "agent", "runtime"]).optional(),
  goal: z.string().optional(),
  detail: z.string().optional(),
  lastError: z.string().optional(),
  createdAt: finiteNumberSchema.optional(),
  finishedAt: finiteNumberSchema.optional()
}).passthrough();

const agentMemorySchema = z.object({
  playerProfiles: z.record(playerProfileSchema).optional(),
  places: z.record(placeRecordSchema).optional(),
  taskHistory: z.array(taskHistoryRecordSchema).optional()
}).passthrough();

const territoryConfigSchema = z.object({
  enabled: z.boolean().optional(),
  placeIds: stringArraySchema.optional(),
  requiredTags: stringArraySchema.optional(),
  radius: finiteNumberSchema.optional(),
  warningCooldownMs: finiteNumberSchema.optional(),
  warningMessage: z.string().optional(),
  ownerPresencePolicy: z.enum(["always", "owner_nearby_only"]).optional(),
  escalationEnabled: z.boolean().optional(),
  escalationDelayMs: finiteNumberSchema.optional()
}).passthrough();

const persistedAgentConfigSchema = z.object({
  enabled: z.boolean().optional(),
  mode: z.enum(["manual", "assist", "auto"]).optional(),
  whitelist: stringArraySchema.optional(),
  owner: z.string().optional(),
  commandWakeWord: z.string().optional(),
  autoIdlePolicy: z.enum(["none", "follow_owner", "wander", "socialize_whitelist"]).optional(),
  plannerApiBaseUrl: z.string().optional(),
  plannerApiKey: z.string().optional(),
  plannerModel: z.string().optional(),
  plannerSystemPrompt: z.string().optional(),
  planCooldownMs: finiteNumberSchema.optional(),
  maxPlanSteps: finiteNumberSchema.optional(),
  maxToolCallsPerTurn: finiteNumberSchema.optional(),
  allowProactiveAction: z.boolean().optional(),
  allowedTools: stringArraySchema.optional(),
  strategicGoal: strategicGoalSchema.optional(),
  memory: agentMemorySchema.optional(),
  territory: territoryConfigSchema.optional()
}).passthrough();

const persistedSelfGuardConfigSchema = z.object({
  enabled: z.boolean().optional(),
  tickMs: finiteNumberSchema.optional(),
  lowFood: finiteNumberSchema.optional(),
  lowHealth: finiteNumberSchema.optional(),
  criticalHealth: finiteNumberSchema.optional(),
  autoEat: z.boolean().optional(),
  autoStopFollowOnLowHealth: z.boolean().optional(),
  retaliateOnNonWhitelistHit: z.boolean().optional(),
  retaliationMaxDistance: finiteNumberSchema.optional(),
  retaliationDecayMs: finiteNumberSchema.optional(),
  chatAlerts: z.boolean().optional(),
  alertCooldownMs: finiteNumberSchema.optional()
}).passthrough();

function botConfigRecord<T extends z.ZodTypeAny>(valueSchema: T): z.ZodEffects<z.ZodRecord<z.ZodString, T>> {
  return z.record(valueSchema).superRefine((entries, context) => {
    for (const botId of Object.keys(entries)) {
      if (botId.trim().length > 0) continue;
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [botId],
        message: "Bot ID must not be empty"
      });
    }
  });
}

const persistedChatStateSchema = z.object({
  chatByBotId: botConfigRecord(persistedChatConfigSchema).default({}),
  aiByBotId: botConfigRecord(persistedChatAiConfigSchema).default({}),
  agentByBotId: botConfigRecord(persistedAgentConfigSchema).default({}),
  guardByBotId: botConfigRecord(persistedSelfGuardConfigSchema).default({})
}).passthrough();

export type PersistedChatConfig = z.infer<typeof persistedChatConfigSchema>;
export type PersistedChatAiConfig = z.infer<typeof persistedChatAiConfigSchema>;
export type PersistedAgentConfig = z.infer<typeof persistedAgentConfigSchema>;
export type PersistedSelfGuardConfig = z.infer<typeof persistedSelfGuardConfigSchema>;
export type PersistedChatState = z.infer<typeof persistedChatStateSchema>;

function formatIssuePath(path: PropertyKey[]): string {
  return path.length > 0 ? path.map(String).join(".") : "<root>";
}

export function parsePersistedChatState(raw: string): PersistedChatState {
  let document: unknown;
  try {
    document = JSON.parse(raw) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid chat config JSON: ${message}`);
  }

  const parsed = persistedChatStateSchema.safeParse(document);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${formatIssuePath(issue.path)}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid persisted chat config: ${details}`);
  }
  return parsed.data;
}
