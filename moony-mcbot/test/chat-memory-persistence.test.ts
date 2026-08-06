import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  flushSharedChatMemory,
  getSharedChatMemoryPromptText,
  migrateSharedChatMemoryState,
  recordSharedChatMemory
} from "../src/memory/chat-memory.js";

async function writeState(memoryDir: string, state: object): Promise<void> {
  await writeFile(
    path.join(memoryDir, "chat-summary-state.json"),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8"
  );
}

test("flushSharedChatMemory persists pending chat state atomically", async () => {
  const memoryDir = await mkdtemp(path.join(os.tmpdir(), "mcbot-chat-memory-"));
  const previousMemoryDir = process.env.XIAOLI_MEMORY_DIR;
  process.env.XIAOLI_MEMORY_DIR = memoryDir;

  try {
    recordSharedChatMemory({
      timestamp: "2026-07-29T00:00:00.000Z",
      botId: "test-bot",
      speaker: "player",
      player: "Judy",
      message: "今天去看看新地方",
      relation: "owner"
    });

    await flushSharedChatMemory();

    const state = JSON.parse(
      await readFile(path.join(memoryDir, "chat-summary-state.json"), "utf8")
    ) as {
      version: number;
      totalObservedEntries: number;
      pendingByBotId: Record<string, Array<{ message: string }>>;
    };
    assert.equal(state.version, 2);
    assert.equal(state.totalObservedEntries, 1);
    assert.equal(state.pendingByBotId["test-bot"]?.[0]?.message, "今天去看看新地方");
    assert.deepEqual((await readdir(memoryDir)).filter((name) => name.endsWith(".tmp")), []);
  } finally {
    if (previousMemoryDir === undefined) {
      delete process.env.XIAOLI_MEMORY_DIR;
    } else {
      process.env.XIAOLI_MEMORY_DIR = previousMemoryDir;
    }
    await rm(memoryDir, { recursive: true, force: true });
  }
});

test("v1 single-bot summary is not exposed to another bot", async () => {
  const memoryDir = await mkdtemp(path.join(os.tmpdir(), "mcbot-chat-memory-v1-"));
  const previousMemoryDir = process.env.XIAOLI_MEMORY_DIR;
  process.env.XIAOLI_MEMORY_DIR = memoryDir;

  try {
    await writeState(memoryDir, {
      version: 1,
      totalObservedEntries: 20,
      totalSummarizedEntries: 20,
      lastSummary: "McBot: summary owned by bot-a",
      lastSummaryAt: "2026-07-31T00:00:00.000Z",
      pendingByBotId: {
        "bot-a": []
      }
    });

    assert.match(await getSharedChatMemoryPromptText("bot-a"), /summary owned by bot-a/);
    assert.equal(await getSharedChatMemoryPromptText("bot-b"), "");

    const migration = await migrateSharedChatMemoryState();
    assert.deepEqual(migration, {
      statePath: path.join(memoryDir, "chat-summary-state.json"),
      sourceVersion: 1,
      targetVersion: 2,
      migrated: true,
      assignedLegacySummaryBotId: "bot-a",
      hasUnassignedLegacySummary: false
    });
    const migratedState = JSON.parse(
      await readFile(path.join(memoryDir, "chat-summary-state.json"), "utf8")
    ) as {
      version: number;
      summariesByBotId: Record<string, { lastSummary: string }>;
      unassignedLegacySummary: unknown;
    };
    assert.equal(migratedState.version, 2);
    assert.equal(migratedState.summariesByBotId["bot-a"]?.lastSummary, "McBot: summary owned by bot-a");
    assert.equal(migratedState.unassignedLegacySummary, null);
  } finally {
    if (previousMemoryDir === undefined) {
      delete process.env.XIAOLI_MEMORY_DIR;
    } else {
      process.env.XIAOLI_MEMORY_DIR = previousMemoryDir;
    }
    await rm(memoryDir, { recursive: true, force: true });
  }
});

test("v2 summaries are selected by bot id", async () => {
  const memoryDir = await mkdtemp(path.join(os.tmpdir(), "mcbot-chat-memory-v2-"));
  const previousMemoryDir = process.env.XIAOLI_MEMORY_DIR;
  process.env.XIAOLI_MEMORY_DIR = memoryDir;

  try {
    await writeState(memoryDir, {
      version: 2,
      totalObservedEntries: 40,
      totalSummarizedEntries: 40,
      summariesByBotId: {
        "bot-a": {
          lastSummary: "McBot: only bot-a knows this",
          lastSummaryAt: "2026-07-31T00:00:00.000Z"
        },
        "bot-b": {
          lastSummary: "McBot: only bot-b knows this",
          lastSummaryAt: "2026-07-31T00:01:00.000Z"
        }
      },
      pendingByBotId: {
        "bot-a": [],
        "bot-b": []
      }
    });

    const botAPrompt = await getSharedChatMemoryPromptText("bot-a");
    const botBPrompt = await getSharedChatMemoryPromptText("bot-b");
    assert.match(botAPrompt, /only bot-a knows this/);
    assert.doesNotMatch(botAPrompt, /only bot-b knows this/);
    assert.match(botBPrompt, /only bot-b knows this/);
    assert.doesNotMatch(botBPrompt, /only bot-a knows this/);
  } finally {
    if (previousMemoryDir === undefined) {
      delete process.env.XIAOLI_MEMORY_DIR;
    } else {
      process.env.XIAOLI_MEMORY_DIR = previousMemoryDir;
    }
    await rm(memoryDir, { recursive: true, force: true });
  }
});

test("v1 summary with ambiguous bot ownership is not injected", async () => {
  const memoryDir = await mkdtemp(path.join(os.tmpdir(), "mcbot-chat-memory-v1-ambiguous-"));
  const previousMemoryDir = process.env.XIAOLI_MEMORY_DIR;
  process.env.XIAOLI_MEMORY_DIR = memoryDir;

  try {
    await writeState(memoryDir, {
      version: 1,
      totalObservedEntries: 40,
      totalSummarizedEntries: 40,
      lastSummary: "McBot: ownership is ambiguous",
      lastSummaryAt: "2026-07-31T00:00:00.000Z",
      pendingByBotId: {
        "bot-a": [],
        "bot-b": []
      }
    });

    assert.equal(await getSharedChatMemoryPromptText("bot-a"), "");
    assert.equal(await getSharedChatMemoryPromptText("bot-b"), "");

    const migration = await migrateSharedChatMemoryState();
    assert.equal(migration.migrated, true);
    assert.equal(migration.assignedLegacySummaryBotId, null);
    assert.equal(migration.hasUnassignedLegacySummary, true);
    const migratedState = JSON.parse(
      await readFile(path.join(memoryDir, "chat-summary-state.json"), "utf8")
    ) as {
      version: number;
      summariesByBotId: Record<string, unknown>;
      unassignedLegacySummary: { lastSummary: string } | null;
    };
    assert.equal(migratedState.version, 2);
    assert.deepEqual(migratedState.summariesByBotId, {});
    assert.equal(migratedState.unassignedLegacySummary?.lastSummary, "McBot: ownership is ambiguous");
  } finally {
    if (previousMemoryDir === undefined) {
      delete process.env.XIAOLI_MEMORY_DIR;
    } else {
      process.env.XIAOLI_MEMORY_DIR = previousMemoryDir;
    }
    await rm(memoryDir, { recursive: true, force: true });
  }
});

test("rolling summaries do not inherit another bot summary", async () => {
  const memoryDir = await mkdtemp(path.join(os.tmpdir(), "mcbot-chat-memory-rollup-"));
  const previousMemoryDir = process.env.XIAOLI_MEMORY_DIR;
  const previousSummaryKey = process.env.MCBOT_MEMORY_SUMMARY_API_KEY;
  const previousAiKey = process.env.MCBOT_AI_API_KEY;
  process.env.XIAOLI_MEMORY_DIR = memoryDir;
  delete process.env.MCBOT_MEMORY_SUMMARY_API_KEY;
  delete process.env.MCBOT_AI_API_KEY;

  try {
    for (let index = 0; index < 20; index += 1) {
      recordSharedChatMemory({
        timestamp: `2026-07-31T00:00:${String(index).padStart(2, "0")}.000Z`,
        botId: "bot-a",
        speaker: "player",
        player: "Alice",
        message: `alpha topic ${index}`
      });
    }
    for (let index = 0; index < 20; index += 1) {
      recordSharedChatMemory({
        timestamp: `2026-07-31T00:01:${String(index).padStart(2, "0")}.000Z`,
        botId: "bot-b",
        speaker: "player",
        player: "Bob",
        message: `beta topic ${index}`
      });
    }
    await flushSharedChatMemory();

    const state = JSON.parse(
      await readFile(path.join(memoryDir, "chat-summary-state.json"), "utf8")
    ) as {
      version: number;
      summariesByBotId?: Record<string, { lastSummary: string }>;
    };
    assert.equal(state.version, 2);
    assert.match(state.summariesByBotId?.["bot-a"]?.lastSummary ?? "", /Alice/);
    assert.doesNotMatch(state.summariesByBotId?.["bot-a"]?.lastSummary ?? "", /Bob/);
    assert.match(state.summariesByBotId?.["bot-b"]?.lastSummary ?? "", /Bob/);
    assert.doesNotMatch(state.summariesByBotId?.["bot-b"]?.lastSummary ?? "", /Alice/);
  } finally {
    if (previousMemoryDir === undefined) {
      delete process.env.XIAOLI_MEMORY_DIR;
    } else {
      process.env.XIAOLI_MEMORY_DIR = previousMemoryDir;
    }
    if (previousSummaryKey === undefined) {
      delete process.env.MCBOT_MEMORY_SUMMARY_API_KEY;
    } else {
      process.env.MCBOT_MEMORY_SUMMARY_API_KEY = previousSummaryKey;
    }
    if (previousAiKey === undefined) {
      delete process.env.MCBOT_AI_API_KEY;
    } else {
      process.env.MCBOT_AI_API_KEY = previousAiKey;
    }
    await rm(memoryDir, { recursive: true, force: true });
  }
});

test("unsupported state versions are rejected without replacing the file", async () => {
  const memoryDir = await mkdtemp(path.join(os.tmpdir(), "mcbot-chat-memory-unsupported-"));
  const previousMemoryDir = process.env.XIAOLI_MEMORY_DIR;
  process.env.XIAOLI_MEMORY_DIR = memoryDir;
  const unsupportedState = {
    version: 99,
    marker: "must remain unchanged"
  };

  try {
    await writeState(memoryDir, unsupportedState);
    await assert.rejects(
      migrateSharedChatMemoryState(),
      /Unsupported chat summary state version: 99/
    );
    assert.deepEqual(
      JSON.parse(await readFile(path.join(memoryDir, "chat-summary-state.json"), "utf8")),
      unsupportedState
    );
  } finally {
    if (previousMemoryDir === undefined) {
      delete process.env.XIAOLI_MEMORY_DIR;
    } else {
      process.env.XIAOLI_MEMORY_DIR = previousMemoryDir;
    }
    await rm(memoryDir, { recursive: true, force: true });
  }
});
