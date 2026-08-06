import type {
  ActionResult,
  EatFoodInput,
  WalkForwardInput
} from "../runtime/client-adapter.js";

export interface AgentEatExecutor {
  eatFood(input?: EatFoodInput): Promise<ActionResult>;
}

export interface AgentLookExecutor {
  look(yaw: number, pitch: number, force?: boolean): Promise<ActionResult>;
}

export interface AgentTimedWalkInput extends WalkForwardInput {
  durationMs: number;
}

export interface AgentWalkExecutor {
  walkForDuration(input: AgentTimedWalkInput): Promise<ActionResult>;
}

export async function executeAgentEatTool(
  executor: AgentEatExecutor,
  args: Record<string, unknown>
): Promise<string> {
  let itemName: string | undefined;
  if (args.itemName !== undefined) {
    if (typeof args.itemName !== "string") {
      throw new Error("interact.eat itemName must be a string");
    }
    itemName = args.itemName.trim();
    if (!itemName) {
      throw new Error("interact.eat itemName must be non-empty");
    }
  }

  const result = await executor.eatFood(itemName ? { itemName } : {});
  if (!result.ok) {
    throw new Error(result.detail ?? "interact.eat failed");
  }
  return result.detail ?? "ate food";
}

export async function executeAgentLookTool(
  executor: AgentLookExecutor,
  args: Record<string, unknown>
): Promise<string> {
  const { yaw, pitch } = args;
  if (typeof yaw !== "number" || !Number.isFinite(yaw)) {
    throw new Error("player.look yaw must be a finite number");
  }
  if (typeof pitch !== "number" || !Number.isFinite(pitch)) {
    throw new Error("player.look pitch must be a finite number");
  }
  if (args.force !== undefined && typeof args.force !== "boolean") {
    throw new Error("player.look force must be a boolean");
  }

  const force = args.force ?? true;
  const result = await executor.look(yaw, pitch, force);
  if (!result.ok) {
    throw new Error(result.detail ?? "player.look failed");
  }
  return result.detail ?? `look set to yaw=${yaw}, pitch=${pitch}`;
}

export async function executeAgentWalkTool(
  executor: AgentWalkExecutor,
  args: Record<string, unknown>
): Promise<string> {
  const durationMs = args.durationMs === undefined ? 1000 : args.durationMs;
  if (
    typeof durationMs !== "number" ||
    !Number.isInteger(durationMs) ||
    durationMs < 100 ||
    durationMs > 60000
  ) {
    throw new Error("movement.walk durationMs must be an integer between 100 and 60000");
  }
  if (args.sprint !== undefined && typeof args.sprint !== "boolean") {
    throw new Error("movement.walk sprint must be a boolean");
  }
  if (args.jump !== undefined && typeof args.jump !== "boolean") {
    throw new Error("movement.walk jump must be a boolean");
  }

  const sprint = args.sprint ?? false;
  const jump = args.jump ?? false;
  const result = await executor.walkForDuration({ durationMs, sprint, jump });
  if (!result.ok) {
    throw new Error(result.detail ?? "movement.walk failed");
  }
  return result.detail ?? `walking forward for ${durationMs}ms (sprint=${sprint}, jump=${jump})`;
}
