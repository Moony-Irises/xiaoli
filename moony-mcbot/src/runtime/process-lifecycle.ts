import type { EventEmitter } from "node:events";

export type FatalProcessSource = "startup" | "unhandledRejection" | "uncaughtException";

export interface ProcessLifecycleLogEntry {
  level: "info" | "error";
  message: string;
  context: Record<string, unknown>;
}

interface ShutdownLifecycleRunner {
  run(): Promise<void>;
}

interface ProcessExitState {
  exitCode?: string | number | null;
}

export interface ProcessShutdownCoordinatorOptions {
  lifecycle: ShutdownLifecycleRunner;
  exitState: ProcessExitState;
  log(entry: ProcessLifecycleLogEntry): void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class ProcessShutdownCoordinator {
  private shutdownPromise: Promise<void> | null = null;
  private fatalFailureSeen = false;
  private signalSeen = false;

  constructor(private readonly options: ProcessShutdownCoordinatorOptions) {}

  handleSignal(signal: NodeJS.Signals): Promise<void> {
    if (!this.signalSeen) {
      this.signalSeen = true;
      this.writeLog({
        level: "info",
        message: "Shutdown signal received",
        context: { signal }
      });
    }
    return this.beginShutdown(`signal:${signal}`);
  }

  handleFatal(source: FatalProcessSource, error: unknown): Promise<void> {
    this.fatalFailureSeen = true;
    this.options.exitState.exitCode = 1;
    this.writeLog({
      level: "error",
      message: "Fatal process failure",
      context: { source, error: errorMessage(error) }
    });
    return this.beginShutdown(`fatal:${source}`);
  }

  waitForShutdown(): Promise<void> {
    return this.shutdownPromise ?? Promise.resolve();
  }

  private beginShutdown(trigger: string): Promise<void> {
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    let lifecyclePromise: Promise<void>;
    try {
      lifecyclePromise = this.options.lifecycle.run();
    } catch (error) {
      lifecyclePromise = Promise.reject(error);
    }

    this.shutdownPromise = lifecyclePromise.then(
      () => {
        if (!this.fatalFailureSeen) {
          this.options.exitState.exitCode = 0;
        }
        this.writeLog({
          level: "info",
          message: "Runtime shutdown completed",
          context: { trigger, fatalFailureSeen: this.fatalFailureSeen }
        });
      },
      (error: unknown) => {
        this.options.exitState.exitCode = 1;
        this.writeLog({
          level: "error",
          message: "Runtime shutdown completed with errors",
          context: { trigger, error: errorMessage(error) }
        });
      }
    );
    return this.shutdownPromise;
  }

  private writeLog(entry: ProcessLifecycleLogEntry): void {
    try {
      this.options.log(entry);
    } catch {
      // A logging failure must not interrupt fatal cleanup.
    }
  }
}

export function installProcessLifecycleHandlers(
  coordinator: ProcessShutdownCoordinator,
  eventTarget: Pick<EventEmitter, "on" | "once" | "off"> = process
): () => void {
  const onSigint = (): void => { void coordinator.handleSignal("SIGINT"); };
  const onSigterm = (): void => { void coordinator.handleSignal("SIGTERM"); };
  const onUnhandledRejection = (reason: unknown): void => {
    void coordinator.handleFatal("unhandledRejection", reason);
  };
  const onUncaughtException = (error: Error): void => {
    void coordinator.handleFatal("uncaughtException", error);
  };

  eventTarget.once("SIGINT", onSigint);
  eventTarget.once("SIGTERM", onSigterm);
  eventTarget.on("unhandledRejection", onUnhandledRejection);
  eventTarget.on("uncaughtException", onUncaughtException);

  return () => {
    eventTarget.off("SIGINT", onSigint);
    eventTarget.off("SIGTERM", onSigterm);
    eventTarget.off("unhandledRejection", onUnhandledRejection);
    eventTarget.off("uncaughtException", onUncaughtException);
  };
}
