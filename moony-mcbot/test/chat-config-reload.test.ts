import assert from "node:assert/strict";
import { mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parsePersistedChatState } from "../src/config/persisted-chat-config.js";
import type { TerritoryConfig } from "../src/config/territory-config-store.js";
import { BotRegistry } from "../src/runtime/bot-registry.js";

function createPersistedState(
  owner = "Judy",
  territoryRadius = 12,
  territoryPlaceIds: readonly string[] = ["home"]
): Record<string, unknown> {
  return {
    chatByBotId: {
      "bot-a": {
        enabled: true,
        whitelist: ["Judy"],
        wakeNames: ["小狸"],
        dotPrefix: ".",
        intents: { follow: ["跟着我"] },
        specialReplies: [{ trigger: "hi小狸", reply: "嗯。", matchMode: "includes" }]
      }
    },
    aiByBotId: {
      "bot-a": {
        enabled: true,
        whitelist: ["Judy"],
        wakeWord: "小狸",
        cooldownMs: 1000,
        maxSentences: 2,
        sentenceDelayMs: 500,
        maxHistory: 8,
        apiBaseUrl: "https://example.test/v1",
        model: "test-model",
        modelFallbacks: ["fallback-model"],
        systemPrompt: "legacy prompt"
      }
    },
    agentByBotId: {
      "bot-a": {
        enabled: true,
        mode: "auto",
        whitelist: ["Judy"],
        owner,
        commandWakeWord: "小狸",
        autoIdlePolicy: "none",
        plannerApiBaseUrl: "https://example.test/v1",
        plannerModel: "test-model",
        plannerSystemPrompt: "Return JSON.",
        planCooldownMs: 4000,
        maxPlanSteps: 1,
        maxToolCallsPerTurn: 1,
        allowProactiveAction: false,
        allowedTools: ["moveFollowplayer"],
        strategicGoal: {
          goal: "Follow Judy",
          source: "manual",
          milestones: ["Start following Judy"],
          currentMilestoneIndex: 0,
          createdAt: 1,
          updatedAt: 2
        },
        memory: {
          playerProfiles: {
            Judy: {
              playerName: "Judy",
              relation: "owner",
              updatedAt: 2
            }
          },
          places: {
            home: {
              placeId: "home",
              label: "Home",
              x: 1,
              y: 64,
              z: 2,
              updatedAt: 2
            }
          },
          taskHistory: [{
            id: "task-1",
            taskType: "follow",
            status: "finished",
            source: "manual_command",
            goal: "Follow Judy",
            createdAt: 1,
            finishedAt: 2
          }]
        },
        territory: {
          enabled: true,
          placeIds: [...territoryPlaceIds],
          requiredTags: ["trusted"],
          radius: territoryRadius,
          warningCooldownMs: 30000,
          warningMessage: "走开。",
          ownerPresencePolicy: "owner_nearby_only",
          escalationEnabled: true,
          escalationDelayMs: 8000
        }
      }
    },
    guardByBotId: {
      "bot-a": {
        enabled: true,
        tickMs: 2000,
        lowFood: 10,
        lowHealth: 10,
        criticalHealth: 6,
        autoEat: true,
        autoStopFollowOnLowHealth: true,
        retaliateOnNonWhitelistHit: true,
        retaliationMaxDistance: 4.5,
        retaliationDecayMs: 60000,
        chatAlerts: true,
        alertCooldownMs: 15000
      }
    }
  };
}

test("parsePersistedChatState accepts the current unversioned document and fills missing maps", () => {
  const parsed = parsePersistedChatState(JSON.stringify({
    chatByBotId: createPersistedState().chatByBotId,
    aiByBotId: createPersistedState().aiByBotId
  }));

  assert.deepEqual(Object.keys(parsed.chatByBotId), ["bot-a"]);
  assert.deepEqual(Object.keys(parsed.aiByBotId), ["bot-a"]);
  assert.deepEqual(parsed.agentByBotId, {});
  assert.deepEqual(parsed.guardByBotId, {});
});

test("parsePersistedChatState rejects malformed JSON and invalid nested values", () => {
  assert.throws(() => parsePersistedChatState("{"), /Invalid chat config JSON/);
  assert.throws(
    () => parsePersistedChatState(JSON.stringify({ chatByBotId: { "bot-a": { enabled: "true" } } })),
    /chatByBotId\.bot-a\.enabled/
  );
  assert.throws(
    () => parsePersistedChatState('{"agentByBotId":{"bot-a":{"memory":{"places":{"home":{"x":1e400}}}}}}'),
    /agentByBotId\.bot-a\.memory\.places\.home\.x/
  );
  assert.throws(
    () => parsePersistedChatState(JSON.stringify({ guardByBotId: { "": { enabled: true } } })),
    /guardByBotId/
  );
});

test("reloadPersistedChatState commits only validated snapshots and deletes absent entries", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mcbot-chat-config-"));
  const configPath = path.join(tempDir, "chat-configs.json");
  const memoryDir = path.join(tempDir, "memory");
  const previousEnv = new Map<string, string | undefined>();
  const env = {
    MCBOT_CHAT_CONFIG_PATH: configPath,
    XIAOLI_MEMORY_DIR: memoryDir,
    MCBOT_ENV_FILE: path.join(tempDir, "missing.env"),
    MCBOT_DEFAULT_BOT_ID: "",
    MCBOT_AI_API_KEY: "runtime-secret"
  };
  for (const [name, value] of Object.entries(env)) {
    previousEnv.set(name, process.env[name]);
    process.env[name] = value;
  }

  try {
    await writeFile(configPath, JSON.stringify(createPersistedState()), "utf8");
    const actionTools = await import("../src/tools/action-tools.js");
    const registry = new BotRegistry();

    const first = await actionTools.reloadPersistedChatState(registry);
    assert.deepEqual(
      { chatCount: first.chatCount, aiCount: first.aiCount, agentCount: first.agentCount, guardCount: first.guardCount },
      { chatCount: 1, aiCount: 1, agentCount: 1, guardCount: 1 }
    );
    assert.deepEqual(first.removedCounts, { chatCount: 0, aiCount: 0, agentCount: 0, guardCount: 0 });
    assert.equal(actionTools.getChatAiStatusForDebug("bot-a").hasApiKey, true);
    assert.equal(actionTools.getAgentStatusForDebug("bot-a").hasPlannerApiKey, true);
    const firstMemory = actionTools.getAgentMemoryStatusForDebug("bot-a");
    assert.deepEqual(
      (firstMemory.playerProfiles as Array<{ playerName: string }>).map((entry) => entry.playerName),
      ["Judy"]
    );
    assert.deepEqual(
      (firstMemory.places as Array<{ placeId: string }>).map((entry) => entry.placeId),
      ["home"]
    );
    assert.deepEqual(
      (firstMemory.taskHistory as Array<{ id: string }>).map((entry) => entry.id),
      ["task-1"]
    );
    assert.deepEqual(
      actionTools.getTerritoryStatusForDebug("bot-a").territory,
      {
        enabled: true,
        placeIds: ["home"],
        requiredTags: ["trusted"],
        radius: 12,
        warningCooldownMs: 30_000,
        warningMessage: "走开。",
        ownerPresencePolicy: "owner_nearby_only",
        escalationEnabled: true,
        escalationDelayMs: 8_000
      } satisfies TerritoryConfig
    );

    delete process.env.MCBOT_AI_API_KEY;
    await writeFile(configPath, JSON.stringify(createPersistedState("Molly", 24, ["home", "gate"])), "utf8");
    await actionTools.reloadPersistedChatState(registry);
    assert.equal(actionTools.getAgentStatusForDebug("bot-a").owner, "Molly");
    assert.equal(actionTools.getChatAiStatusForDebug("bot-a").hasApiKey, true);
    assert.equal(actionTools.getAgentStatusForDebug("bot-a").hasPlannerApiKey, true);
    const replacedTerritory = actionTools.getTerritoryStatusForDebug("bot-a").territory as TerritoryConfig;
    assert.equal(replacedTerritory.radius, 24);
    assert.deepEqual(replacedTerritory.placeIds, ["home", "gate"]);

    await writeFile(configPath, '{"agentByBotId":{"bot-a":{"owner":42}}}', "utf8");
    await assert.rejects(actionTools.reloadPersistedChatState(registry), /agentByBotId\.bot-a\.owner/);
    assert.equal(actionTools.getAgentStatusForDebug("bot-a").owner, "Molly");

    await unlink(configPath);
    await assert.rejects(actionTools.reloadPersistedChatState(registry), /chat-configs\.json/);
    assert.equal(actionTools.getAgentStatusForDebug("bot-a").owner, "Molly");

    const startupServer = new McpServer({ name: "missing-config-startup-test", version: "1.0.0" });
    await actionTools.registerActionTools(startupServer, registry);
    actionTools.stopActionRuntime();
    assert.equal(actionTools.getAgentStatusForDebug("bot-a").owner, "Molly");

    const serverInternals = startupServer as unknown as {
      _registeredTools: Record<string, {
        handler: (args: Record<string, never>, extra: never) => Promise<{
          content: { type: string; text: string }[];
          isError?: boolean;
        }>;
      }>;
    };
    const reloadHandler = serverInternals._registeredTools["chat.config.reload"]?.handler;
    assert.ok(reloadHandler);
    const missingResponse = await reloadHandler({}, {} as never);
    assert.equal(missingResponse.isError, true);
    assert.doesNotMatch(missingResponse.content[0]?.text ?? "", /reloaded/);

    await writeFile(configPath, JSON.stringify({
      chatByBotId: {},
      aiByBotId: {},
      agentByBotId: {},
      guardByBotId: {}
    }), "utf8");
    const successResponse = await reloadHandler({}, {} as never);
    assert.equal(successResponse.isError, undefined);
    const successPayload = JSON.parse(successResponse.content[0]?.text ?? "{}") as {
      reloaded?: boolean;
      removedCounts?: Record<string, number>;
    };
    assert.equal(successPayload.reloaded, true);
    assert.deepEqual(successPayload.removedCounts, {
      chatCount: 1,
      aiCount: 1,
      agentCount: 1,
      guardCount: 1
    });
    assert.equal(actionTools.getChatListenerStatusForDebug("bot-a").enabled, false);
    assert.equal(actionTools.getChatAiStatusForDebug("bot-a").hasApiKey, false);
    assert.equal(actionTools.getAgentStatusForDebug("bot-a").owner, "");
    assert.deepEqual(actionTools.getAgentMemoryStatusForDebug("bot-a").playerProfiles, []);
    assert.deepEqual(actionTools.getAgentMemoryStatusForDebug("bot-a").places, []);
    assert.deepEqual(actionTools.getTerritoryStatusForDebug("bot-a").territory, {
      enabled: false,
      placeIds: [],
      requiredTags: [],
      radius: 12,
      warningCooldownMs: 30_000,
      warningMessage: "走开。",
      ownerPresencePolicy: "owner_nearby_only",
      escalationEnabled: true,
      escalationDelayMs: 8_000
    } satisfies TerritoryConfig);
    await startupServer.close();
  } finally {
    for (const [name, value] of previousEnv.entries()) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
    await rm(tempDir, { recursive: true, force: true });
  }
});
