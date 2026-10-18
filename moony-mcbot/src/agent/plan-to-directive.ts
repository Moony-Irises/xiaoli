import type { AgentPlan, AgentPlanStep } from "./openai-agent-planner.js";
import type { StrategicAction, StrategicDirective } from "./types.js";

const ALLOWED_STRATEGIC_ACTION_KINDS: readonly StrategicAction["kind"][] = [
  "follow_player",
  "attack_target",
  "challenge_entity",
  "stop_follow",
  "eat_food",
  "prepare_battle",
  "request_teleport_to_player",
  "move_to_position",
  "organize_inventory",
  "equip_category",
  "drop_item",
  "open_door",
  "wander_area",
  "socialize",
  "mine_visible",
  "observe_target",
  "speak",
  "idle"
];

export interface AgentPlanTranslation {
  directive: StrategicDirective | null;
  leftoverSteps: AgentPlanStep[];
}

function normalizeAgentPlan(plan: AgentPlan, maxSteps: number): AgentPlanStep[] {
  const fromSteps = Array.isArray(plan.steps)
    ? plan.steps
        .filter((step) => step && typeof step.tool === "string" && step.tool.trim().length > 0)
        .map((step) => ({
          tool: step.tool.trim(),
          arguments: step.arguments ?? {},
          speak: step.speak?.trim() || undefined
        }))
    : [];

  const steps = fromSteps.length > 0
    ? fromSteps
    : plan.intent === "execute_skill" && plan.tool?.trim()
      ? [{
          tool: plan.tool.trim(),
          arguments: plan.arguments ?? {},
          speak: plan.speak?.trim() || undefined
        }]
      : [];

  return steps.slice(0, Math.max(1, maxSteps));
}

function mapToolStepToStrategicActions(step: AgentPlanStep): StrategicAction[] {
  const actions: StrategicAction[] = [];
  const makeAction = (
    kind: StrategicAction["kind"],
    params: Record<string, unknown>,
    priority: StrategicAction["priority"] = "normal",
    style?: string
  ): StrategicAction => ({
    id: `planned_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    kind,
    params,
    priority,
    style,
    source: "llm",
    createdAt: Date.now()
  });

  if (step.speak) {
    actions.push(makeAction("speak", { text: step.speak }, "normal"));
  }

  switch (step.tool) {
    case "chat.send": {
      const message = String(step.arguments?.message ?? "").trim();
      if (message) actions.push(makeAction("speak", { text: message }, "normal"));
      return actions;
    }
    case "move.followPlayer": {
      const playerName = String(step.arguments?.playerName ?? "").trim();
      if (!playerName) return actions;
      actions.push(makeAction("follow_player", { ...step.arguments, playerName }, "normal"));
      return actions;
    }
    case "move.stopFollow":
      actions.push(makeAction("stop_follow", { reason: "planner_requested_stop" }, "high"));
      return actions;
    case "mine.collectVisible":
      actions.push(makeAction("mine_visible", { ...step.arguments }, "normal"));
      return actions;
    case "interact.attackPlayer": {
      const playerName = String(step.arguments?.playerName ?? "").trim();
      if (!playerName) return actions;
      actions.push(makeAction("attack_target", { targetName: playerName }, "high", String(step.arguments?.style ?? "default")));
      return actions;
    }
    case "combat.challengeEntity": {
      const targetText = String(step.arguments?.targetText ?? step.arguments?.targetName ?? "").trim();
      if (!targetText) return actions;
      actions.push(makeAction("challenge_entity", { ...step.arguments, targetText }, "high"));
      return actions;
    }
    case "movement.walk":
      actions.push(makeAction("wander_area", { ...step.arguments }, "low"));
      return actions;
    case "interact.eat":
      actions.push(makeAction("eat_food", { ...step.arguments }, "high", "self_guard"));
      return actions;
    case "combat.prepareBattle":
      actions.push(makeAction("prepare_battle", { ...step.arguments }, "high"));
      return actions;
    case "chat.requestTeleportToPlayer": {
      const playerName = String(step.arguments?.playerName ?? "").trim();
      if (!playerName) return actions;
      actions.push(makeAction("request_teleport_to_player", { playerName }, "normal"));
      return actions;
    }
    case "inventory.organizeHotbar":
      actions.push(makeAction("organize_inventory", {}, "normal"));
      return actions;
    case "inventory.holdByCategory": {
      const category = String(step.arguments?.category ?? "").trim();
      if (!category) return actions;
      actions.push(makeAction("equip_category", { category }, "normal"));
      return actions;
    }
    case "interact.openDoor":
      actions.push(makeAction("open_door", { ...step.arguments }, "normal"));
      return actions;
    case "interact.dropHeld":
    case "interact.dropHotbarSlot":
      actions.push(makeAction("drop_item", { ...step.arguments }, "normal"));
      return actions;
    case "move.goToPosition":
      if (
        typeof step.arguments?.x !== "number" ||
        typeof step.arguments?.y !== "number" ||
        typeof step.arguments?.z !== "number"
      ) {
        return actions;
      }
      actions.push(makeAction("move_to_position", { ...step.arguments }, "normal"));
      return actions;
    default:
      return [];
  }
}

export function buildDirectiveFromPlan(
  botId: string,
  userInstruction: string,
  plan: AgentPlan,
  maxSteps: number
): AgentPlanTranslation {
  const explicitActions = (plan.directive?.actions ?? [])
    .map((action): StrategicAction | null => {
      if (!action?.kind || typeof action.kind !== "string") return null;
      if (!ALLOWED_STRATEGIC_ACTION_KINDS.includes(action.kind as StrategicAction["kind"])) return null;
      return {
        id: `planned_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        kind: action.kind as StrategicAction["kind"],
        params: action.params ?? {},
        style: action.style,
        priority: action.priority ?? "normal",
        source: "llm",
        createdAt: Date.now()
      };
    })
    .filter((action): action is StrategicAction => !!action);

  if (plan.speak?.trim()) {
    explicitActions.unshift({
      id: `planned_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      kind: "speak",
      params: { text: plan.speak.trim() },
      priority: "normal",
      source: "llm",
      createdAt: Date.now()
    });
  }

  if (explicitActions.length > 0) {
    return {
      directive: {
        id: `directive_${botId}_${Date.now()}`,
        goal: plan.directive?.goal?.trim() || userInstruction,
        rationale: plan.directive?.rationale?.trim() || undefined,
        desiredMode: plan.directive?.desiredMode,
        actions: explicitActions.slice(0, Math.max(1, maxSteps)),
        createdAt: Date.now()
      },
      leftoverSteps: []
    };
  }

  const normalizedSteps = normalizeAgentPlan(plan, maxSteps);
  const actions: StrategicAction[] = [];
  const leftoverSteps: AgentPlanStep[] = [];
  for (const step of normalizedSteps) {
    const mapped = mapToolStepToStrategicActions(step);
    if (mapped.length > 0) {
      actions.push(...mapped);
    } else {
      leftoverSteps.push(step);
    }
  }

  return {
    directive:
      actions.length > 0
        ? {
            id: `directive_${botId}_${Date.now()}`,
            goal: userInstruction,
            rationale: "translated_from_legacy_tool_steps",
            actions: actions.slice(0, Math.max(1, maxSteps)),
            createdAt: Date.now()
          }
        : null,
    leftoverSteps
  };
}
