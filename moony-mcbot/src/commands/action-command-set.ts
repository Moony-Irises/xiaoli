import { z } from "zod";
import { CommandDispatcher } from "./command-dispatcher.js";
import type {
  CommandHistoryFilter,
  CommandInvocationContext,
  CommandInvocationResult,
  CommandOutput
} from "./command-dispatcher.js";
import type {
  ActionResult,
  EatFoodInput,
  HoldItemByCategoryInput,
  OpenDoorInput
} from "../runtime/client-adapter.js";

export interface ActionCommandRuntime {
  eatFood(input?: EatFoodInput): Promise<ActionResult>;
  holdItemByCategory(input: HoldItemByCategoryInput): Promise<ActionResult>;
  openDoor(input?: OpenDoorInput): Promise<ActionResult>;
}

export interface ActionCommandRuntimeRegistry {
  get(botId: string): ActionCommandRuntime;
}

export interface ActionCommandSetDependencies {
  registry: ActionCommandRuntimeRegistry;
  stopFollow(botId: string): void | Promise<void>;
}

export type StopFollowCommandOutput = CommandOutput & Readonly<{
  botId: string;
  stopped: true;
  message: "Stopped following";
}>;

export type EatFoodCommandOutput = CommandOutput & Readonly<{
  botId: string;
  action: "eatFood";
  result: ActionResult;
}>;

export type HoldItemByCategoryCommandOutput = CommandOutput & Readonly<{
  action: "hold-category";
  result: ActionResult;
}>;

export type OpenDoorCommandOutput = CommandOutput & Readonly<{
  botId: string;
  action: "openDoor";
  result: ActionResult;
}>;

const stopFollowCommandInputSchema = z.object({
  botId: z.string().min(1)
});

const eatFoodCommandInputSchema = z.object({
  botId: z.string().min(1),
  itemName: z.string().min(1).optional()
});

const holdItemByCategoryCommandInputSchema = z.object({
  botId: z.string().min(1),
  category: z.enum(["sword", "axe", "pickaxe", "food"])
});

// MCP owns range checks; Web and Agent historically accept any JavaScript number.
const legacyNumericCommandInputSchema = z.custom<number>(
  (value): value is number => typeof value === "number"
);

const openDoorCommandInputSchema = z.object({
  botId: z.string().min(1),
  reach: legacyNumericCommandInputSchema.optional(),
  radius: legacyNumericCommandInputSchema.optional()
});

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isActionResult(value: unknown): value is ActionResult {
  if (!isRecord(value)) return false;
  return typeof value.ok === "boolean"
    && (value.detail === undefined || typeof value.detail === "string");
}

function isStopFollowCommandOutput(
  output: CommandOutput | undefined
): output is StopFollowCommandOutput {
  return output !== undefined
    && typeof output.botId === "string"
    && output.stopped === true
    && output.message === "Stopped following";
}

function isEatFoodCommandOutput(
  output: CommandOutput | undefined
): output is EatFoodCommandOutput {
  return output !== undefined
    && typeof output.botId === "string"
    && output.action === "eatFood"
    && isActionResult(output.result);
}

function isHoldItemByCategoryCommandOutput(
  output: CommandOutput | undefined
): output is HoldItemByCategoryCommandOutput {
  return output !== undefined
    && output.action === "hold-category"
    && isActionResult(output.result);
}

function isOpenDoorCommandOutput(
  output: CommandOutput | undefined
): output is OpenDoorCommandOutput {
  return output !== undefined
    && typeof output.botId === "string"
    && output.action === "openDoor"
    && isActionResult(output.result);
}

export class ActionCommandSet {
  private readonly dispatcher = new CommandDispatcher();

  constructor(private readonly dependencies: ActionCommandSetDependencies) {
    this.registerCommands();
  }

  async invokeStopFollow(
    context: Readonly<CommandInvocationContext>
  ): Promise<StopFollowCommandOutput> {
    const output = await this.invoke("move.stopFollow", { botId: context.botId }, context);
    if (!isStopFollowCommandOutput(output) || output.botId !== context.botId) {
      throw new Error("move.stopFollow completed with invalid output");
    }
    return output;
  }

  async invokeEat(
    context: Readonly<CommandInvocationContext>,
    input: EatFoodInput = {}
  ): Promise<EatFoodCommandOutput> {
    const output = await this.invoke(
      "interact.eat",
      {
        botId: context.botId,
        ...(input.itemName === undefined ? {} : { itemName: input.itemName })
      },
      context
    );
    if (!isEatFoodCommandOutput(output) || output.botId !== context.botId) {
      throw new Error("interact.eat completed with invalid output");
    }
    return output;
  }

  async invokeHoldByCategory(
    context: Readonly<CommandInvocationContext>,
    input: HoldItemByCategoryInput
  ): Promise<HoldItemByCategoryCommandOutput> {
    const output = await this.invoke(
      "inventory.holdByCategory",
      { botId: context.botId, category: input.category },
      context
    );
    if (!isHoldItemByCategoryCommandOutput(output)) {
      throw new Error("inventory.holdByCategory completed with invalid output");
    }
    return output;
  }

  async invokeOpenDoor(
    context: Readonly<CommandInvocationContext>,
    input: OpenDoorInput = {}
  ): Promise<OpenDoorCommandOutput> {
    const output = await this.invoke(
      "interact.openDoor",
      {
        botId: context.botId,
        reach: input.reach,
        radius: input.radius
      },
      context
    );
    if (!isOpenDoorCommandOutput(output) || output.botId !== context.botId) {
      throw new Error("interact.openDoor completed with invalid output");
    }
    return output;
  }

  getHistory(filter: CommandHistoryFilter = {}): CommandInvocationResult[] {
    return this.dispatcher.getHistory(filter);
  }

  private registerCommands(): void {
    this.dispatcher.register({
      id: "move.stopFollow",
      inputSchema: stopFollowCommandInputSchema,
      execute: async ({ botId }) => {
        await this.dependencies.stopFollow(botId);
        return {
          botId,
          stopped: true,
          message: "Stopped following"
        };
      }
    });
    this.dispatcher.register({
      id: "interact.eat",
      inputSchema: eatFoodCommandInputSchema,
      execute: async ({ botId, itemName }) => {
        const result = await this.dependencies.registry.get(botId).eatFood(
          itemName === undefined ? {} : { itemName }
        );
        return {
          botId,
          action: "eatFood",
          result
        };
      }
    });
    this.dispatcher.register({
      id: "inventory.holdByCategory",
      inputSchema: holdItemByCategoryCommandInputSchema,
      execute: async ({ botId, category }) => {
        const result = await this.dependencies.registry
          .get(botId)
          .holdItemByCategory({ category });
        return {
          action: "hold-category",
          result
        };
      }
    });
    this.dispatcher.register({
      id: "interact.openDoor",
      inputSchema: openDoorCommandInputSchema,
      execute: async ({ botId, reach, radius }) => {
        const result = await this.dependencies.registry.get(botId).openDoor({ reach, radius });
        return {
          botId,
          action: "openDoor",
          result
        };
      }
    });
  }

  private async invoke(
    commandId: string,
    input: unknown,
    context: Readonly<CommandInvocationContext>
  ): Promise<CommandOutput | undefined> {
    const result = await this.dispatcher.invoke({ commandId, input, context });
    if (result.status === "failed") {
      throw new Error(result.error?.message ?? `${commandId} failed`);
    }
    return result.output;
  }
}
