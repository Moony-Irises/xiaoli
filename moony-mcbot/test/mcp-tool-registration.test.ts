import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { registerAgentCoreTool } from "../src/catalog/mcp-tool-registration.js";
import { getToolCatalogEntry } from "../src/catalog/tool-catalog.js";
import type { AgentCoreToolId, ToolRisk } from "../src/catalog/tool-catalog.js";

interface McpServerInternals {
  _registeredTools: Record<string, RegisteredTool>;
}

interface RegistrationContract {
  toolId: AgentCoreToolId;
  description: string;
  risk: ToolRisk;
  inputSchema: Record<string, z.ZodTypeAny>;
  validInput: Record<string, unknown>;
  expectedParsedInput: Record<string, unknown>;
  invalidInput: Record<string, unknown>;
  additionalValidInputs?: readonly {
    input: Record<string, unknown>;
    expected: Record<string, unknown>;
  }[];
}

const AGENT_CORE_REGISTRATION_CONTRACTS: readonly RegistrationContract[] = [
  {
    toolId: "observe.self",
    description: "Get bot's own status snapshot",
    risk: "read",
    inputSchema: { botId: z.string().min(1) },
    validInput: { botId: "bot-1" },
    expectedParsedInput: { botId: "bot-1" },
    invalidInput: { botId: "" }
  },
  {
    toolId: "observe.nearbyPlayers",
    description: "List nearby players by distance",
    risk: "read",
    inputSchema: {
      botId: z.string().min(1),
      radius: z.number().positive().max(256).default(32)
    },
    validInput: { botId: "bot-1" },
    expectedParsedInput: { botId: "bot-1", radius: 32 },
    invalidInput: { botId: "bot-1", radius: 257 }
  },
  {
    toolId: "observe.nearbyEntities",
    description: "List nearby non-player entities",
    risk: "read",
    inputSchema: {
      botId: z.string().min(1),
      radius: z.number().positive().max(256).default(24),
      type: z.string().optional()
    },
    validInput: { botId: "bot-1", type: "hostile" },
    expectedParsedInput: { botId: "bot-1", radius: 24, type: "hostile" },
    invalidInput: { botId: "bot-1", radius: 0 }
  },
  {
    toolId: "observe.inventory",
    description: "List bot inventory items and currently held item",
    risk: "read",
    inputSchema: {
      botId: z.string().min(1),
      includeSlots: z.boolean().optional()
    },
    validInput: { botId: "bot-1", includeSlots: true },
    expectedParsedInput: { botId: "bot-1", includeSlots: true },
    invalidInput: { botId: "bot-1", includeSlots: "true" }
  },
  {
    toolId: "mine.collectVisible",
    description: "Collect multiple visible blocks by names (line-of-sight constrained mining loop)",
    risk: "destructive",
    inputSchema: {
      botId: z.string().min(1),
      blockNames: z.array(z.string().min(1)).min(1),
      searchRadius: z.number().int().min(1).max(64).default(24),
      maxBlocks: z.number().int().min(1).max(64).default(8),
      reachDistance: z.number().positive().max(8).default(4.5),
      moveNear: z.boolean().default(true),
      visibleStep: z.number().positive().max(0.5).default(0.2),
      approachTimeoutMs: z.number().int().min(1000).max(120000).default(20000)
    },
    validInput: {
      botId: "bot-1",
      blockNames: ["coal_ore", "deepslate_coal_ore"]
    },
    expectedParsedInput: {
      botId: "bot-1",
      blockNames: ["coal_ore", "deepslate_coal_ore"],
      searchRadius: 24,
      maxBlocks: 8,
      reachDistance: 4.5,
      moveNear: true,
      visibleStep: 0.2,
      approachTimeoutMs: 20000
    },
    invalidInput: { botId: "bot-1", blockNames: [] },
    additionalValidInputs: [
      {
        input: {
          botId: "bot-1",
          blockNames: ["diamond_ore"],
          searchRadius: 64,
          maxBlocks: 64,
          reachDistance: 8,
          moveNear: false,
          visibleStep: 0.5,
          approachTimeoutMs: 120000
        },
        expected: {
          botId: "bot-1",
          blockNames: ["diamond_ore"],
          searchRadius: 64,
          maxBlocks: 64,
          reachDistance: 8,
          moveNear: false,
          visibleStep: 0.5,
          approachTimeoutMs: 120000
        }
      }
    ]
  },
  {
    toolId: "move.followPlayer",
    description: "Continuously follow a nearby player (pathfinder first, steering fallback)",
    risk: "write",
    inputSchema: {
      botId: z.string().min(1),
      playerName: z.string().min(1),
      minDistance: z.number().positive().max(16).default(2.5),
      maxDistance: z.number().positive().max(64).default(24),
      sprint: z.boolean().optional(),
      tickMs: z.number().int().min(100).max(2000).default(250),
      targetStillStopMs: z.number().int().min(1000).max(120000).default(16000)
    },
    validInput: { botId: "bot-1", playerName: "Judy" },
    expectedParsedInput: {
      botId: "bot-1",
      playerName: "Judy",
      minDistance: 2.5,
      maxDistance: 24,
      tickMs: 250,
      targetStillStopMs: 16000
    },
    invalidInput: { botId: "bot-1", playerName: "Judy", tickMs: 99 }
  },
  {
    toolId: "move.stopFollow",
    description: "Stop follow loop for this bot",
    risk: "write",
    inputSchema: { botId: z.string().min(1) },
    validInput: { botId: "bot-1" },
    expectedParsedInput: { botId: "bot-1" },
    invalidInput: { botId: "" }
  },
  {
    toolId: "chat.send",
    description: "Send chat message in game",
    risk: "write",
    inputSchema: {
      botId: z.preprocess(
        (value) => {
          if (typeof value !== "string") return value;
          const trimmed = value.trim();
          return trimmed.length === 0 ? undefined : trimmed;
        },
        z.string().min(1).optional()
      ),
      message: z.string().min(1)
    },
    validInput: { message: "hello" },
    expectedParsedInput: { message: "hello" },
    invalidInput: { message: "" },
    additionalValidInputs: [
      {
        input: { botId: "  bot-1  ", message: "hello" },
        expected: { botId: "bot-1", message: "hello" }
      }
    ]
  },
  {
    toolId: "inventory.holdByCategory",
    description: "Equip best item in category: sword/axe/pickaxe/food",
    risk: "write",
    inputSchema: {
      botId: z.string().min(1),
      category: z.enum(["sword", "axe", "pickaxe", "food"])
    },
    validInput: { botId: "bot-1", category: "pickaxe" },
    expectedParsedInput: { botId: "bot-1", category: "pickaxe" },
    invalidInput: { botId: "bot-1", category: "bow" }
  },
  {
    toolId: "inventory.organizeHotbar",
    description: "One-click organize hotbar: 1=sword, 2=axe, 3=pickaxe, 9=food",
    risk: "write",
    inputSchema: { botId: z.string().min(1) },
    validInput: { botId: "bot-1" },
    expectedParsedInput: { botId: "bot-1" },
    invalidInput: { botId: "" }
  },
  {
    toolId: "combat.prepareBattle",
    description: "Prepare for combat: prefer iron sword in hotbar 1, otherwise best weapon; equip best armor; hold the weapon",
    risk: "write",
    inputSchema: { botId: z.string().min(1) },
    validInput: { botId: "bot-1" },
    expectedParsedInput: { botId: "bot-1" },
    invalidInput: { botId: "" }
  },
  {
    toolId: "combat.challengeEntity",
    description: "Start a full duel against a nearby non-player entity matched by target text",
    risk: "destructive",
    inputSchema: {
      botId: z.string().min(1),
      targetText: z.string().min(1),
      maxDistance: z.number().positive().max(32).default(16),
      requester: z.string().min(1).default("agent")
    },
    validInput: { botId: "bot-1", targetText: "zombie" },
    expectedParsedInput: {
      botId: "bot-1",
      targetText: "zombie",
      maxDistance: 16,
      requester: "agent"
    },
    invalidInput: { botId: "bot-1", targetText: "zombie", maxDistance: 33 },
    additionalValidInputs: [
      {
        input: {
          botId: "bot-1",
          targetText: "僵尸",
          maxDistance: 32,
          requester: "Judy"
        },
        expected: {
          botId: "bot-1",
          targetText: "僵尸",
          maxDistance: 32,
          requester: "Judy"
        }
      }
    ]
  },
  {
    toolId: "interact.dropHeld",
    description: "Drop currently held item: one (tap Q) or stack (hold Q)",
    risk: "destructive",
    inputSchema: {
      botId: z.string().min(1),
      mode: z.enum(["one", "stack"]).default("one")
    },
    validInput: { botId: "bot-1" },
    expectedParsedInput: { botId: "bot-1", mode: "one" },
    invalidInput: { botId: "bot-1", mode: "all" }
  },
  {
    toolId: "interact.dropHotbarSlot",
    description: "Drop item from a specific hotbar slot (1-9): one or full stack",
    risk: "destructive",
    inputSchema: {
      botId: z.string().min(1),
      slot: z.number().int().min(1).max(9),
      mode: z.enum(["one", "stack"]).default("one"),
      restorePrevious: z.boolean().default(true)
    },
    validInput: { botId: "bot-1", slot: 9 },
    expectedParsedInput: {
      botId: "bot-1",
      slot: 9,
      mode: "one",
      restorePrevious: true
    },
    invalidInput: { botId: "bot-1", slot: 0 }
  },
  {
    toolId: "interact.openDoor",
    description: "Open or toggle a door block by right-clicking it",
    risk: "write",
    inputSchema: {
      botId: z.string().min(1),
      reach: z.number().positive().max(8).default(4.5),
      radius: z.number().int().min(1).max(16).default(6)
    },
    validInput: { botId: "bot-1" },
    expectedParsedInput: { botId: "bot-1", reach: 4.5, radius: 6 },
    invalidInput: { botId: "bot-1", radius: 17 }
  }
];

for (const contract of AGENT_CORE_REGISTRATION_CONTRACTS) {
  test(`catalog registration preserves ${contract.toolId} MCP contract`, async () => {
    const server = new McpServer({ name: "catalog-registration-test", version: "1.0.0" });
    const handler = async (input: Record<string, unknown>) => ({
      content: [{ type: "text" as const, text: JSON.stringify(input) }]
    });

    const registered = registerAgentCoreTool(
      server,
      contract.toolId,
      contract.inputSchema,
      handler
    );
    const internals = server as unknown as McpServerInternals;

    assert.equal(internals._registeredTools[contract.toolId], registered);
    assert.equal(getToolCatalogEntry(contract.toolId)?.risk, contract.risk);
    assert.equal(registered.title, undefined);
    assert.equal(registered.description, contract.description);
    assert.ok(registered.inputSchema instanceof z.ZodObject);
    const registeredInputSchema = registered.inputSchema;
    for (const [key, schema] of Object.entries(contract.inputSchema)) {
      assert.equal(registeredInputSchema.shape[key], schema);
    }
    assert.deepEqual(registeredInputSchema.parse(contract.validInput), contract.expectedParsedInput);
    for (const additional of contract.additionalValidInputs ?? []) {
      assert.deepEqual(registeredInputSchema.parse(additional.input), additional.expected);
    }
    assert.equal(registeredInputSchema.safeParse(contract.invalidInput).success, false);
    assert.equal(registered.annotations, undefined);
    assert.equal(registered.handler, handler);
    assert.deepEqual(await handler(contract.expectedParsedInput), {
      content: [{ type: "text", text: JSON.stringify(contract.expectedParsedInput) }]
    });

    await server.close();
  });
}

test("registered agent tool is callable through the MCP transport", async () => {
  const server = new McpServer({ name: "catalog-transport-test", version: "1.0.0" });
  const client = new Client({ name: "catalog-transport-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  registerAgentCoreTool(
    server,
    "observe.self",
    { botId: z.string().min(1) },
    async (input) => ({
      content: [{ type: "text" as const, text: JSON.stringify(input) }]
    })
  );

  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map((tool) => tool.name), ["observe.self"]);

    const result = CallToolResultSchema.parse(
      await client.callTool({
        name: "observe.self",
        arguments: { botId: "bot-1" }
      })
    );
    const firstContent = result.content[0];
    assert.equal(firstContent?.type, "text");
    if (!firstContent || firstContent.type !== "text") {
      assert.fail("observe.self should return text content");
    }
    assert.deepEqual(JSON.parse(firstContent.text), { botId: "bot-1" });
  } finally {
    await client.close();
    await server.close();
  }
});
