import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

const TEST_MARKER = "MCBOT_TEST_LOCAL_ENV_IMPORT_MARKER";
const EXISTING_MARKER = "MCBOT_TEST_LOCAL_ENV_EXISTING_MARKER";

interface LocalEnvModule {
  loadLocalEnvOnce(envPath?: string): void;
}

async function importFreshLocalEnv(): Promise<LocalEnvModule> {
  const moduleUrl = new URL("../src/utils/local-env.js", import.meta.url);
  moduleUrl.searchParams.set("test", `${Date.now()}-${Math.random()}`);
  return await import(moduleUrl.href) as LocalEnvModule;
}

describe("local env loading", { concurrency: false }, () => {
  test("the utility is import-safe and explicit loading preserves existing variables", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "mcbot-local-env-import-"));
    const envPath = path.join(tempDir, ".env.local");
    const previousEnvFile = process.env.MCBOT_ENV_FILE;
    const previousMarker = process.env[TEST_MARKER];
    const previousExisting = process.env[EXISTING_MARKER];

    await writeFile(
      envPath,
      `${TEST_MARKER}=loaded-explicitly\n${EXISTING_MARKER}=loaded-from-file\n`,
      "utf8"
    );
    process.env.MCBOT_ENV_FILE = envPath;
    process.env[EXISTING_MARKER] = "kept-from-process";
    delete process.env[TEST_MARKER];

    try {
      const localEnv = await importFreshLocalEnv();

      assert.equal(process.env[TEST_MARKER], undefined);

      localEnv.loadLocalEnvOnce();

      assert.equal(process.env[TEST_MARKER], "loaded-explicitly");
      assert.equal(process.env[EXISTING_MARKER], "kept-from-process");
    } finally {
      if (previousEnvFile === undefined) delete process.env.MCBOT_ENV_FILE;
      else process.env.MCBOT_ENV_FILE = previousEnvFile;

      if (previousMarker === undefined) delete process.env[TEST_MARKER];
      else process.env[TEST_MARKER] = previousMarker;

      if (previousExisting === undefined) delete process.env[EXISTING_MARKER];
      else process.env[EXISTING_MARKER] = previousExisting;

      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("importing runtime configuration modules does not load a local env file", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "mcbot-local-env-runtime-"));
    const envPath = path.join(tempDir, ".env.local");
    const previousEnvFile = process.env.MCBOT_ENV_FILE;
    const previousMarker = process.env[TEST_MARKER];

    await writeFile(envPath, `${TEST_MARKER}=loaded-by-runtime-import\n`, "utf8");
    process.env.MCBOT_ENV_FILE = envPath;
    delete process.env[TEST_MARKER];

    try {
      await import("../src/bootstrap/default-bot.js");
      await import("../src/tools/action-tools.js");

      assert.equal(process.env[TEST_MARKER], undefined);
    } finally {
      if (previousEnvFile === undefined) delete process.env.MCBOT_ENV_FILE;
      else process.env.MCBOT_ENV_FILE = previousEnvFile;

      if (previousMarker === undefined) delete process.env[TEST_MARKER];
      else process.env[TEST_MARKER] = previousMarker;

      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("the process bootstrap loads the configured local env file", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "mcbot-local-env-bootstrap-"));
    const envPath = path.join(tempDir, ".env.local");
    const previousEnvFile = process.env.MCBOT_ENV_FILE;
    const previousMarker = process.env[TEST_MARKER];

    await writeFile(envPath, `${TEST_MARKER}=loaded-by-bootstrap\n`, "utf8");
    process.env.MCBOT_ENV_FILE = envPath;
    delete process.env[TEST_MARKER];

    try {
      await import("../src/bootstrap/local-env.js");

      assert.equal(process.env[TEST_MARKER], "loaded-by-bootstrap");
    } finally {
      if (previousEnvFile === undefined) delete process.env.MCBOT_ENV_FILE;
      else process.env.MCBOT_ENV_FILE = previousEnvFile;

      if (previousMarker === undefined) delete process.env[TEST_MARKER];
      else process.env[TEST_MARKER] = previousMarker;

      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("explicit loading ignores a missing env file", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "mcbot-local-env-missing-"));
    const missingPath = path.join(tempDir, "missing.env");
    const previousMarker = process.env[TEST_MARKER];
    delete process.env[TEST_MARKER];

    try {
      const localEnv = await importFreshLocalEnv();

      assert.doesNotThrow(() => localEnv.loadLocalEnvOnce(missingPath));
      assert.equal(process.env[TEST_MARKER], undefined);
    } finally {
      if (previousMarker === undefined) delete process.env[TEST_MARKER];
      else process.env[TEST_MARKER] = previousMarker;

      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
