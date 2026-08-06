#!/usr/bin/env node

import "./bootstrap/local-env.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerBotTools } from "./tools/bot-tools.js";
import {
  flushActionPersistence,
  reconcileActionRuntime,
  registerActionTools,
  stopActionRuntime
} from "./tools/action-tools.js";
import { BotRegistry } from "./runtime/bot-registry.js";
import { log } from "./logger.js";
import { readDefaultBotBootstrapFromEnv } from "./bootstrap/default-bot.js";
import { startDebugWebServer } from "./debug/debug-server.js";
import {
  flushSharedChatMemory,
  migrateSharedChatMemoryState
} from "./memory/chat-memory.js";
import {
  closeHttpServer,
  RuntimeShutdownLifecycle
} from "./runtime/shutdown-lifecycle.js";
import {
  installProcessLifecycleHandlers,
  ProcessShutdownCoordinator
} from "./runtime/process-lifecycle.js";

function readAutoConnectDelayMs(): number {
  const raw = process.env.MCBOT_DEFAULT_AUTO_CONNECT_DELAY_MS;
  if (!raw) return 0;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.trunc(value);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function bootstrapDefaultBot(registry: BotRegistry): Promise<void> {
  const bootstrap = readDefaultBotBootstrapFromEnv();
  if (!bootstrap) {
    return;
  }

  const runtime = registry.create(bootstrap.config);
  log("info", "Default bot runtime created", {
    botId: bootstrap.config.botId,
    serverHost: bootstrap.config.serverHost,
    autoConnect: bootstrap.autoConnect
  });

  if (!bootstrap.autoConnect) {
    return;
  }

  const delayMs = readAutoConnectDelayMs();
  if (delayMs > 0) {
    log("info", "Delaying default bot auto-connect", {
      botId: bootstrap.config.botId,
      delayMs
    });
    await sleep(delayMs);
  }

  try {
    await runtime.connect();
    log("info", "Default bot auto-connected", {
      botId: bootstrap.config.botId
    });
  } catch (error) {
    log("warn", "Default bot auto-connect failed; MCP server will continue running", {
      botId: bootstrap.config.botId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

async function disconnectAllBots(registry: BotRegistry): Promise<void> {
  const failures: Error[] = [];
  for (const botId of registry.listBotIds()) {
    try {
      await registry.get(botId).disconnect("Process shutdown");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(new Error(`${botId}: ${message}`, { cause: error }));
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, "One or more bot runtimes failed to disconnect");
  }
}

async function migrateSharedChatMemoryAtStartup(): Promise<void> {
  try {
    const migration = await migrateSharedChatMemoryState();
    if (!migration.migrated) return;
    log("info", "Shared chat memory state migrated", {
      statePath: migration.statePath,
      sourceVersion: migration.sourceVersion,
      targetVersion: migration.targetVersion,
      assignedLegacySummaryBotId: migration.assignedLegacySummaryBotId,
      hasUnassignedLegacySummary: migration.hasUnassignedLegacySummary
    });
  } catch (error) {
    log("warn", "Shared chat memory state migration failed; runtime will continue", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

async function main(): Promise<void> {
  const server = new McpServer({
    name: "moony-mcbot",
    version: "0.1.0"
  });

  const registry = new BotRegistry();
  let debugServer: ReturnType<typeof startDebugWebServer> = null;
  const shutdownLifecycle = new RuntimeShutdownLifecycle({
    closeDebugServer: () => closeHttpServer(debugServer),
    stopActionRuntime: async () => stopActionRuntime(),
    disconnectBots: () => disconnectAllBots(registry),
    flushPersistence: async () => {
      await flushActionPersistence();
      await flushSharedChatMemory();
    },
    closeMcpServer: () => server.close()
  });
  const processLifecycle = new ProcessShutdownCoordinator({
    lifecycle: shutdownLifecycle,
    exitState: process,
    log: ({ level, message, context }) => log(level, message, context)
  });

  try {
    registerBotTools(server, registry);
    await migrateSharedChatMemoryAtStartup();
    await registerActionTools(server, registry);
    debugServer = startDebugWebServer(registry);

    await bootstrapDefaultBot(registry);
    reconcileActionRuntime(registry);

    const transport = new StdioServerTransport();
    await server.connect(transport);
    installProcessLifecycleHandlers(processLifecycle);
    log("info", "MCP server started");
  } catch (error) {
    await processLifecycle.handleFatal("startup", error);
  }
}

void main().catch((error: unknown) => {
  log("error", "Fatal bootstrap failure", {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
});
