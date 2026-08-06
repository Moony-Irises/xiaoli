import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { installRuntimePathIsolation } from "../scripts/test-runtime-path-isolation.js";

test("runtime path isolation overrides persistent paths and removes its temporary root", () => {
  const env: NodeJS.ProcessEnv = {
    MCBOT_DATA_DIR: "C:\\real-data",
    XIAOLI_MEMORY_DIR: "C:\\real-memory",
    MCBOT_PROMPT_PROFILE_PATH: "C:\\real-prompt.json"
  };
  const isolation = installRuntimePathIsolation(env, os.tmpdir());

  try {
    assert.equal(env.MCBOT_TEST_TEMP_ROOT, isolation.rootDir);
    for (const name of [
      "MCBOT_DATA_DIR",
      "XIAOLI_MEMORY_DIR",
      "MCBOT_MEMORY_DIR",
      "MCBOT_CHAT_CONFIG_PATH",
      "MCBOT_PROMPT_PROFILE_PATH",
      "MCBOT_VALID_CHAT_LOG_PATH",
      "MCBOT_ENV_FILE"
    ]) {
      const value = env[name];
      assert.ok(value, `${name} should be configured`);
      assert.equal(path.relative(isolation.rootDir, value).startsWith(".."), false);
    }
    assert.equal(existsSync(isolation.rootDir), true);
  } finally {
    isolation.cleanup();
  }

  assert.equal(existsSync(isolation.rootDir), false);
  assert.doesNotThrow(() => isolation.cleanup());
});
