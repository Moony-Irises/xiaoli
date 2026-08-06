import { randomUUID } from "node:crypto";
import type { ZodIssue, ZodType } from "zod";
import {
  projectDiagnosticRecord,
  redactDiagnosticText
} from "../utils/diagnostic-redaction.js";

export type CommandSource = "mcp" | "web" | "agent" | "internal";
export type CommandTerminalStatus = "executed" | "failed";
export type CommandErrorCode =
  | "invalid_input"
  | "execution_failed"
  | "command_not_found";
export type CommandOutput = Readonly<Record<string, unknown>>;

export interface CommandInvocationContext {
  source: CommandSource;
  botId: string;
  requester?: string;
  requestId?: string;
}

export interface CommandInvocationError {
  code: CommandErrorCode;
  message: string;
}

export interface CommandInvocationResult {
  requestId: string;
  commandId: string;
  source: CommandSource;
  botId: string;
  requester?: string;
  status: CommandTerminalStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  output?: CommandOutput;
  error?: CommandInvocationError;
}

export interface CommandInvocationRequest {
  commandId: string;
  input: unknown;
  context: CommandInvocationContext;
}

export interface CommandDefinition<Input> {
  id: string;
  inputSchema: ZodType<Input>;
  execute(
    input: Input,
    context: Readonly<CommandInvocationContext>
  ): CommandOutput | Promise<CommandOutput>;
}

export interface CommandHistoryFilter {
  botId?: string;
  commandId?: string;
  source?: CommandSource;
  limit?: number;
}

export interface CommandDispatcherDependencies {
  now?: () => Date;
  createRequestId?: () => string;
  maxHistory?: number;
}

interface RegisteredCommand {
  inputSchema: ZodType<unknown>;
  execute(
    input: unknown,
    context: Readonly<CommandInvocationContext>
  ): CommandOutput | Promise<CommandOutput>;
}

const DEFAULT_MAX_HISTORY = 100;

function cloneResult(
  result: CommandInvocationResult,
  redactSecrets = false
): CommandInvocationResult {
  return {
    ...result,
    ...(result.output === undefined
      ? {}
      : {
          output: projectDiagnosticRecord(result.output, { redactSecrets })
        }),
    ...(result.error === undefined
      ? {}
      : {
          error: {
            ...result.error,
            message: redactSecrets
              ? redactDiagnosticText(result.error.message)
              : result.error.message
          }
        })
  };
}

function formatIssue(issue: ZodIssue): string {
  const path = issue.path.length > 0 ? issue.path.join(".") : "input";
  return `${path}: ${issue.message}`;
}

function formatValidationError(issues: readonly ZodIssue[]): string {
  return `Invalid command input: ${issues.map(formatIssue).join("; ")}`;
}

function normalizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function validateMaxHistory(value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("maxHistory must be a positive integer");
  }
  return value;
}

export class CommandDispatcher {
  private readonly commands = new Map<string, RegisteredCommand>();
  private readonly history: CommandInvocationResult[] = [];
  private readonly now: () => Date;
  private readonly createRequestId: () => string;
  private readonly maxHistory: number;

  constructor(dependencies: CommandDispatcherDependencies = {}) {
    this.now = dependencies.now ?? (() => new Date());
    this.createRequestId = dependencies.createRequestId ?? randomUUID;
    this.maxHistory = validateMaxHistory(dependencies.maxHistory ?? DEFAULT_MAX_HISTORY);
  }

  register<Input>(definition: CommandDefinition<Input>): void {
    const commandId = definition.id.trim();
    if (!commandId) throw new Error("Command id must be non-empty");
    if (commandId !== definition.id) {
      throw new Error("Command id must not contain surrounding whitespace");
    }
    if (this.commands.has(commandId)) {
      throw new Error(`Command '${commandId}' is already registered`);
    }

    this.commands.set(commandId, {
      inputSchema: definition.inputSchema as ZodType<unknown>,
      execute: (input, context) => definition.execute(input as Input, context)
    });
  }

  async invoke(request: CommandInvocationRequest): Promise<CommandInvocationResult> {
    const startedAt = this.now();
    const requestId = request.context.requestId?.trim() || this.createRequestId();
    const base = {
      requestId,
      commandId: request.commandId,
      source: request.context.source,
      botId: request.context.botId,
      ...(request.context.requester === undefined
        ? {}
        : { requester: request.context.requester })
    };

    const command = this.commands.get(request.commandId);
    if (!command) {
      return this.complete(startedAt, base, {
        status: "failed",
        error: {
          code: "command_not_found",
          message: `Command '${request.commandId}' is not registered`
        }
      });
    }

    const parsed = command.inputSchema.safeParse(request.input);
    if (!parsed.success) {
      return this.complete(startedAt, base, {
        status: "failed",
        error: {
          code: "invalid_input",
          message: formatValidationError(parsed.error.issues)
        }
      });
    }

    try {
      const output = await command.execute(parsed.data, { ...request.context, requestId });
      return this.complete(startedAt, base, {
        status: "executed",
        output: { ...output }
      });
    } catch (error) {
      return this.complete(startedAt, base, {
        status: "failed",
        error: {
          code: "execution_failed",
          message: normalizeError(error)
        }
      });
    }
  }

  getHistory(filter: CommandHistoryFilter = {}): CommandInvocationResult[] {
    const limit = filter.limit === undefined
      ? this.maxHistory
      : Math.max(0, Math.trunc(filter.limit));
    if (limit === 0) return [];

    return this.history
      .slice()
      .reverse()
      .filter((entry) => {
        if (filter.botId !== undefined && entry.botId !== filter.botId) return false;
        if (filter.commandId !== undefined && entry.commandId !== filter.commandId) return false;
        if (filter.source !== undefined && entry.source !== filter.source) return false;
        return true;
      })
      .slice(0, limit)
      .map((entry) => cloneResult(entry));
  }

  private complete(
    startedAt: Date,
    base: Pick<
      CommandInvocationResult,
      "requestId" | "commandId" | "source" | "botId" | "requester"
    >,
    terminal: Pick<CommandInvocationResult, "status" | "output" | "error">
  ): CommandInvocationResult {
    const completedAt = this.now();
    const result: CommandInvocationResult = {
      ...base,
      ...terminal,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime())
    };

    this.history.push(cloneResult(result, true));
    if (this.history.length > this.maxHistory) {
      this.history.splice(0, this.history.length - this.maxHistory);
    }
    return result;
  }
}
