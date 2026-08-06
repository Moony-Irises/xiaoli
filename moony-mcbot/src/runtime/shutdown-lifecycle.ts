import type { Server } from "node:http";

export interface RuntimeShutdownHooks {
  closeDebugServer(): Promise<void>;
  stopActionRuntime(): Promise<void>;
  disconnectBots(): Promise<void>;
  flushPersistence(): Promise<void>;
  closeMcpServer(): Promise<void>;
}

type ShutdownStageName = keyof RuntimeShutdownHooks;

export async function closeHttpServer(server: Server | null): Promise<void> {
  if (!server?.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export class RuntimeShutdownLifecycle {
  private shutdownPromise: Promise<void> | null = null;

  constructor(private readonly hooks: RuntimeShutdownHooks) {}

  run(): Promise<void> {
    if (!this.shutdownPromise) {
      this.shutdownPromise = this.runStages();
    }
    return this.shutdownPromise;
  }

  private async runStages(): Promise<void> {
    const failures: Error[] = [];
    const initialStages: ShutdownStageName[] = ["closeDebugServer", "stopActionRuntime"];
    const initialFailures = await Promise.all(initialStages.map((stage) => this.runStage(stage)));
    failures.push(...initialFailures.filter((error): error is Error => error !== null));

    const remainingStages: ShutdownStageName[] = [
      "disconnectBots",
      "flushPersistence",
      "closeMcpServer"
    ];

    for (const stage of remainingStages) {
      const failure = await this.runStage(stage);
      if (failure) failures.push(failure);
    }

    if (failures.length > 0) {
      throw new AggregateError(failures, "Runtime shutdown completed with errors");
    }
  }

  private async runStage(stage: ShutdownStageName): Promise<Error | null> {
    try {
      await this.hooks[stage]();
      return null;
    } catch (error) {
      return new Error(`${stage}: ${toError(error).message}`, { cause: error });
    }
  }
}
