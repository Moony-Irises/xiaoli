import assert from "node:assert/strict";
import test from "node:test";
import type { AiRequestStatus } from "../src/runtime/ai-request.js";
import { AiRequestLifecycle } from "../src/runtime/ai-request-lifecycle.js";

function createStatus(state: AiRequestStatus["state"], model = "test-model"): AiRequestStatus {
  return {
    state,
    startedAt: state === "idle" ? null : "2026-08-03T00:00:00.000Z",
    finishedAt: state === "running" ? null : "2026-08-03T00:00:01.000Z",
    timeoutMs: 5000,
    model
  };
}

test("AI request lifecycle writes status for the current request until it closes", () => {
  const statuses = new Map<string, AiRequestStatus>();
  const lifecycle = new AiRequestLifecycle({
    writeStatus: (botId, status) => {
      statuses.set(botId, status);
      return true;
    }
  });

  const running = createStatus("running");
  const request = lifecycle.begin("bot-a", running);

  assert.strictEqual(statuses.get("bot-a"), running);
  assert.equal(lifecycle.hasActive("bot-a"), true);
  assert.equal(request.isCurrent(), true);
  assert.equal(request.signal.aborted, false);

  const success = createStatus("success");
  assert.equal(request.update(success), true);
  assert.strictEqual(statuses.get("bot-a"), success);
  assert.equal(request.close(), true);
  assert.equal(request.isCurrent(), false);
  assert.equal(lifecycle.hasActive("bot-a"), false);
  assert.equal(request.update(createStatus("failed")), false);
});

test("a newer request prevents stale status updates without aborting the older work", () => {
  const writes: AiRequestStatus[] = [];
  const lifecycle = new AiRequestLifecycle({
    writeStatus: (_botId, status) => {
      writes.push(status);
      return true;
    }
  });

  const first = lifecycle.begin("bot-a", createStatus("running", "first"));
  const second = lifecycle.begin("bot-a", createStatus("running", "second"));

  assert.equal(first.signal.aborted, false);
  assert.equal(first.isCurrent(), false);
  assert.equal(first.update(createStatus("success", "first")), false);
  assert.equal(first.close(), false);
  assert.equal(second.update(createStatus("success", "second")), true);
  assert.equal(writes.at(-1)?.model, "second");
});

test("cancel aborts the current signal while allowing its terminal status update", () => {
  const writes: AiRequestStatus[] = [];
  const lifecycle = new AiRequestLifecycle({
    writeStatus: (_botId, status) => {
      writes.push(status);
      return true;
    }
  });
  const request = lifecycle.begin("bot-a", createStatus("running"));

  assert.equal(lifecycle.cancel("bot-a"), true);
  assert.equal(request.signal.aborted, true);
  assert.equal(request.isCurrent(), true);
  assert.equal(request.update(createStatus("cancelled")), true);
  assert.equal(writes.at(-1)?.state, "cancelled");
  assert.equal(request.close(), true);
  assert.equal(lifecycle.cancel("bot-a"), false);
});

test("invalidate cancels and blocks late writes for a removed config", () => {
  const writes: AiRequestStatus[] = [];
  const lifecycle = new AiRequestLifecycle({
    writeStatus: (_botId, status) => {
      writes.push(status);
      return true;
    }
  });
  const request = lifecycle.begin("bot-a", createStatus("running"));

  assert.equal(lifecycle.invalidate("bot-a"), true);
  assert.equal(request.signal.aborted, true);
  assert.equal(request.isCurrent(), false);
  assert.equal(request.update(createStatus("cancelled")), false);
  assert.equal(request.close(), false);
  assert.equal(writes.length, 1);
  assert.equal(lifecycle.invalidate("bot-a"), false);
});

test("invalidateAll cancels every current request and clears lifecycle state", () => {
  const lifecycle = new AiRequestLifecycle({
    writeStatus: () => true
  });
  const first = lifecycle.begin("bot-a", createStatus("running", "first"));
  const second = lifecycle.begin("bot-b", createStatus("running", "second"));

  assert.equal(lifecycle.invalidateAll(), 2);
  assert.equal(first.signal.aborted, true);
  assert.equal(second.signal.aborted, true);
  assert.equal(lifecycle.hasActive("bot-a"), false);
  assert.equal(lifecycle.hasActive("bot-b"), false);
  assert.equal(lifecycle.invalidateAll(), 0);
});
