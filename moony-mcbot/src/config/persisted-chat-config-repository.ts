import { readFile } from "node:fs/promises";
import { writeJsonAtomic } from "../runtime/atomic-json-file.js";
import { drainPromiseQueue } from "../runtime/promise-queue.js";
import {
  parsePersistedChatState,
  type PersistedChatState
} from "./persisted-chat-config.js";

export interface PersistedChatConfigLoadOptions {
  readonly allowMissing: boolean;
}

export interface PersistedChatConfigRepositoryOptions {
  readonly filePath: string;
  readonly readTextFile?: (filePath: string) => Promise<string>;
  readonly writeState?: (
    filePath: string,
    state: PersistedChatState
  ) => Promise<void>;
  readonly onWriteError?: (error: unknown, filePath: string) => void;
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function readUtf8File(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

async function writePersistedState(
  filePath: string,
  state: PersistedChatState
): Promise<void> {
  await writeJsonAtomic(filePath, state);
}

export class PersistedChatConfigRepository {
  readonly filePath: string;

  private readonly readTextFile: (filePath: string) => Promise<string>;
  private readonly writeState: (
    filePath: string,
    state: PersistedChatState
  ) => Promise<void>;
  private readonly onWriteError: (error: unknown, filePath: string) => void;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(options: PersistedChatConfigRepositoryOptions) {
    this.filePath = options.filePath;
    this.readTextFile = options.readTextFile ?? readUtf8File;
    this.writeState = options.writeState ?? writePersistedState;
    this.onWriteError = options.onWriteError ?? (() => undefined);
  }

  async load(options: PersistedChatConfigLoadOptions): Promise<PersistedChatState | null> {
    let raw: string;
    try {
      raw = await this.readTextFile(this.filePath);
    } catch (error) {
      if (options.allowMissing && isMissingFileError(error)) return null;

      const message = error instanceof Error ? error.message : String(error);
      const detail = isMissingFileError(error)
        ? `Persisted chat config file not found: ${this.filePath}`
        : `Failed to read persisted chat config '${this.filePath}': ${message}`;
      throw new Error(detail);
    }

    return parsePersistedChatState(raw);
  }

  enqueue(state: PersistedChatState): void {
    this.writeQueue = this.writeQueue
      .then(async () => {
        await this.writeState(this.filePath, state);
      })
      .catch((error: unknown) => {
        this.onWriteError(error, this.filePath);
      });
  }

  async flush(): Promise<void> {
    await drainPromiseQueue(() => this.writeQueue);
  }
}
