import assert from "node:assert/strict";
import test from "node:test";
import {
  AGENT_CORE_TOOL_CATALOG,
  assertToolCatalogIntegrity,
  getDefaultAgentToolIds,
  getToolCatalogEntry,
  isAgentCoreToolId,
  resolveAgentToolAllowlist,
  ToolCatalogEntry
} from "../src/catalog/tool-catalog.js";

const EXPECTED_DEFAULT_AGENT_TOOLS = [
  "observe.self",
  "observe.inventory",
  "observe.nearbyPlayers",
  "observe.nearbyEntities",
  "mine.collectVisible",
  "move.followPlayer",
  "move.stopFollow",
  "move.goToPosition",
  "combat.challengeEntity",
  "chat.requestTeleportToPlayer",
  "chat.send",
  "combat.prepareBattle",
  "inventory.holdByCategory",
  "inventory.organizeHotbar",
  "interact.dropHeld",
  "interact.dropHotbarSlot",
  "interact.openDoor"
] as const;

function entry(overrides: Partial<ToolCatalogEntry> = {}): ToolCatalogEntry {
  return {
    id: "observe.test",
    title: "测试工具",
    description: "Read a test snapshot",
    domain: "observe",
    risk: "read",
    audiences: ["agent", "developer"],
    defaultAgentAllowed: true,
    ...overrides
  };
}

test("Agent core catalog preserves the existing 17-tool default allowlist order", () => {
  assert.equal(AGENT_CORE_TOOL_CATALOG.length, 17);
  assert.deepEqual(getDefaultAgentToolIds(), EXPECTED_DEFAULT_AGENT_TOOLS);
  assert.notEqual(getDefaultAgentToolIds(), getDefaultAgentToolIds());
});

test("Agent core catalog supports typed lookup without accepting unknown tools", () => {
  assert.equal(getToolCatalogEntry("mine.collectVisible")?.risk, "destructive");
  assert.equal(isAgentCoreToolId("observe.self"), true);
  assert.equal(isAgentCoreToolId("interact.eat"), false);
  assert.equal(getToolCatalogEntry("missing.tool"), undefined);
});

test("tool catalog integrity rejects duplicate ids and invalid Agent exposure", () => {
  assert.doesNotThrow(() => assertToolCatalogIntegrity([entry()]));
  assert.throws(
    () => assertToolCatalogIntegrity([entry(), entry()]),
    /Duplicate tool catalog id 'observe\.test'/
  );
  assert.throws(
    () => assertToolCatalogIntegrity([entry({ audiences: ["developer"] })]),
    /default Agent allowed without Agent audience/
  );
  assert.throws(
    () => assertToolCatalogIntegrity([entry({ audiences: ["agent", "agent"] })]),
    /duplicate audiences/
  );
});

test("persisted Agent allowlists keep unknown values, order, and explicit emptiness", () => {
  const persisted = ["custom.privateTool", "observe.self", ""];
  assert.deepEqual(resolveAgentToolAllowlist(persisted), ["custom.privateTool", "observe.self"]);
  assert.deepEqual(resolveAgentToolAllowlist([]), []);
  assert.deepEqual(resolveAgentToolAllowlist(undefined, ["fallback.tool"]), ["fallback.tool"]);
});
