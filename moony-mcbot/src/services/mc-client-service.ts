import mineflayer from "mineflayer";
import * as Pathfinder from "mineflayer-pathfinder";
import { AuthSession, BotConfig } from "../types.js";
import { normalizeAuthApiBase, normalizeSessionApiBase } from "../utils/identity.js";

type ExtendedBotOptions = mineflayer.BotOptions & {
  hostSRV?: boolean;
  auth?: "mojang";
  authServer?: string;
  sessionServer?: string;
  skipValidation?: boolean;
};

interface PathfinderModule {
  pathfinder?: mineflayer.Plugin;
  default?: { pathfinder?: mineflayer.Plugin };
}

const DEFAULT_DISCONNECT_TIMEOUT_MS = 5000;

export class McClientService {
  createBot(config: BotConfig, session: AuthSession): mineflayer.Bot {
    const options: ExtendedBotOptions = {
      host: config.serverHost,
      port: config.serverPort,
      username: config.username,
      version: config.version,
      session,
      hostSRV: config.useSrv,
      auth: "mojang",
      authServer: normalizeAuthApiBase(config.authApiBaseUrl),
      sessionServer: normalizeSessionApiBase(config.authApiBaseUrl),
      skipValidation: true
    };

    const bot = mineflayer.createBot(options);
    const pf = Pathfinder as unknown as PathfinderModule;
    const plugin = pf.pathfinder ?? pf.default?.pathfinder;
    if (typeof plugin === "function") {
      bot.loadPlugin(plugin);
    }
    return bot;
  }

  awaitSpawn(bot: mineflayer.Bot, timeoutMs = 20000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Spawn timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      const onSpawn = (): void => {
        cleanup();
        resolve();
      };

      const onError = (err: unknown): void => {
        cleanup();
        reject(err instanceof Error ? err : new Error(String(err)));
      };

      const onKicked = (reason: unknown): void => {
        cleanup();
        reject(new Error(`Kicked before spawn: ${this.formatReason(reason)}`));
      };

      const onEnd = (reason: unknown): void => {
        cleanup();
        reject(new Error(`Disconnected before spawn: ${this.formatReason(reason)}`));
      };

      const cleanup = (): void => {
        clearTimeout(timer);
        bot.off("spawn", onSpawn);
        bot.off("error", onError);
        bot.off("kicked", onKicked);
        bot.off("end", onEnd);
      };

      bot.once("spawn", onSpawn);
      bot.once("error", onError);
      bot.once("kicked", onKicked);
      bot.once("end", onEnd);
    });
  }

  disconnect(
    bot: mineflayer.Bot,
    reason = "Disconnected by MCP tool",
    timeoutMs = DEFAULT_DISCONNECT_TIMEOUT_MS
  ): Promise<void> {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return Promise.reject(new Error(`Disconnect timeout must be positive, received ${timeoutMs}`));
    }

    return new Promise((resolve, reject) => {
      const cleanup = (): void => {
        clearTimeout(timer);
        bot.off("end", onEnd);
      };

      const onEnd = (): void => {
        cleanup();
        resolve();
      };

      bot.once("end", onEnd);
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Disconnect timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        bot.quit(reason);
      } catch (error) {
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  formatReason(reason: unknown): string {
    if (reason instanceof Error) {
      return reason.message;
    }
    if (typeof reason === "string") {
      return reason;
    }

    try {
      return JSON.stringify(reason);
    } catch {
      return String(reason);
    }
  }
}

