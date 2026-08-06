import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  PersistedChatConfigRepository
} from "../src/config/persisted-chat-config-repository.js";
import type { PersistedChatState } from "../src/config/persisted-chat-config.js";

function createState(botId: string): PersistedChatState {
  return {
    chatByBotId: {
      [botId]: {
        enabled: true,
        whitelist: ["Judy"]
      }
    },
    aiByBotId: {},
    agentByBotId: {},
    guardByBotId: {}
  };
}

async function withTemporaryDirectory(
  run: (directory: string) => Promise<void>
): Promise<void> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mcbot-config-repository-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("repository loads and validates an existing persisted chat config", async () => {
  await withTemporaryDirectory(async (directory) => {
    const filePath = path.join(directory, "chat-configs.json");
    const state = createState("bot-a");
    await writeFile(filePath, JSON.stringify(state), "utf8");
    const repository = new PersistedChatConfigRepository({ filePath });

    assert.equal(repository.filePath, filePath);
    assert.deepEqual(await repository.load({ allowMissing: false }), state);
  });
});

test("repository distinguishes optional and required missing config files", async () => {
  await withTemporaryDirectory(async (directory) => {
    const filePath = path.join(directory, "missing", "chat-configs.json");
    const repository = new PersistedChatConfigRepository({ filePath });

    assert.equal(await repository.load({ allowMissing: true }), null);
    await assert.rejects(
      repository.load({ allowMissing: false }),
      new RegExp(`Persisted chat config file not found: ${filePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)
    );
  });
});

test("repository rejects malformed or schema-invalid persisted chat config", async () => {
  await withTemporaryDirectory(async (directory) => {
    const filePath = path.join(directory, "chat-configs.json");
    const repository = new PersistedChatConfigRepository({ filePath });

    await writeFile(filePath, "{", "utf8");
    await assert.rejects(repository.load({ allowMissing: false }), /Invalid chat config JSON/);

    await writeFile(filePath, '{"chatByBotId":{"bot-a":{"enabled":"true"}}}', "utf8");
    await assert.rejects(
      repository.load({ allowMissing: false }),
      /chatByBotId\.bot-a\.enabled/
    );
  });
});

test("repository serializes queued writes and flushes work appended while draining", async () => {
  let releaseFirstWrite: (() => void) | undefined;
  const firstWriteGate = new Promise<void>((resolve) => {
    releaseFirstWrite = resolve;
  });
  const writes: string[] = [];
  let activeWrites = 0;
  let maximumActiveWrites = 0;
  const repository = new PersistedChatConfigRepository({
    filePath: "C:\\isolated\\chat-configs.json",
    async writeState(_filePath, state) {
      activeWrites += 1;
      maximumActiveWrites = Math.max(maximumActiveWrites, activeWrites);
      const botId = Object.keys(state.chatByBotId)[0] ?? "empty";
      writes.push(botId);
      if (writes.length === 1) await firstWriteGate;
      activeWrites -= 1;
    }
  });

  repository.enqueue(createState("bot-a"));
  const flushing = repository.flush();
  await new Promise<void>((resolve) => setImmediate(resolve));
  repository.enqueue(createState("bot-b"));
  releaseFirstWrite?.();
  await flushing;

  assert.deepEqual(writes, ["bot-a", "bot-b"]);
  assert.equal(maximumActiveWrites, 1);
});

test("repository reports a failed write and continues processing later writes", async () => {
  const reportedErrors: string[] = [];
  const completedWrites: string[] = [];
  let attempt = 0;
  const repository = new PersistedChatConfigRepository({
    filePath: "C:\\isolated\\chat-configs.json",
    async writeState(_filePath, state) {
      attempt += 1;
      if (attempt === 1) throw new Error("disk unavailable");
      completedWrites.push(Object.keys(state.chatByBotId)[0] ?? "empty");
    },
    onWriteError(error) {
      reportedErrors.push(error instanceof Error ? error.message : String(error));
    }
  });

  repository.enqueue(createState("bot-a"));
  repository.enqueue(createState("bot-b"));
  await repository.flush();

  assert.deepEqual(reportedErrors, ["disk unavailable"]);
  assert.deepEqual(completedWrites, ["bot-b"]);
});
