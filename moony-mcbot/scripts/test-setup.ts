import { installRuntimePathIsolation } from "./test-runtime-path-isolation.js";

const isolation = installRuntimePathIsolation();

process.once("exit", () => {
  try {
    isolation.cleanup();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Failed to clean test runtime directory '${isolation.rootDir}': ${message}\n`);
    process.exitCode = 1;
  }
});
