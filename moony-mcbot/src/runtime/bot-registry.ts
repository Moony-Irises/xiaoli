import { BotRuntime } from "./bot-runtime.js";
import { BotCreateInput } from "../types.js";
import type { BotRuntimeDependencies } from "./bot-runtime.js";

export class BotRegistry {
  private readonly runtimes = new Map<string, BotRuntime>();
  private readonly runtimeDependencies: BotRuntimeDependencies;

  constructor(runtimeDependencies: BotRuntimeDependencies = {}) {
    this.runtimeDependencies = { ...runtimeDependencies };
  }

  create(input: BotCreateInput): BotRuntime {
    if (this.runtimes.has(input.botId)) {
      throw new Error(`Bot '${input.botId}' already exists`);
    }

    const runtime = new BotRuntime(input.botId, input, this.runtimeDependencies);
    this.runtimes.set(input.botId, runtime);
    return runtime;
  }

  get(botId: string): BotRuntime {
    const runtime = this.runtimes.get(botId);
    if (!runtime) {
      throw new Error(`Bot '${botId}' not found`);
    }
    return runtime;
  }

  delete(botId: string): boolean {
    return this.runtimes.delete(botId);
  }

  listBotIds(): string[] {
    return [...this.runtimes.keys()];
  }
}
