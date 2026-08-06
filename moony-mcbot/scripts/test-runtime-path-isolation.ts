import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface RuntimePathIsolation {
  rootDir: string;
  cleanup(): void;
}

export function installRuntimePathIsolation(
  env: NodeJS.ProcessEnv = process.env,
  tempBaseDir = os.tmpdir()
): RuntimePathIsolation {
  const rootDir = mkdtempSync(path.join(tempBaseDir, "mcbot-test-runtime-"));
  const dataDir = path.join(rootDir, "data");
  const memoryDir = path.join(rootDir, "memory");

  Object.assign(env, {
    MCBOT_TEST_TEMP_ROOT: rootDir,
    MCBOT_DATA_DIR: dataDir,
    XIAOLI_MEMORY_DIR: memoryDir,
    MCBOT_MEMORY_DIR: memoryDir,
    MCBOT_CHAT_CONFIG_PATH: path.join(dataDir, "config", "chat-configs.json"),
    MCBOT_PROMPT_PROFILE_PATH: path.join(memoryDir, "prompts", "mcbot-prompt-profile.json"),
    MCBOT_VALID_CHAT_LOG_PATH: path.join(dataDir, "logs", "valid-whitelist-chat.jsonl"),
    MCBOT_ENV_FILE: path.join(rootDir, "missing.env")
  });

  let cleaned = false;
  return {
    rootDir,
    cleanup(): void {
      if (cleaned) return;
      cleaned = true;
      rmSync(rootDir, { recursive: true, force: true });
    }
  };
}
