import { AgentBlackboardSnapshot, AgentEvent, ReactiveRule, StrategicAction } from "./types.js";

function makeAction(
  kind: StrategicAction["kind"],
  params: Record<string, unknown>,
  source: StrategicAction["source"],
  priority: StrategicAction["priority"],
  style?: string
): StrategicAction {
  return {
    id: `action_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    kind,
    params,
    source,
    priority,
    style,
    createdAt: Date.now()
  };
}

export function createDefaultReactiveRules(): ReactiveRule[] {
  return [
    {
      id: "hurt-retaliate",
      watches: ["hurt"],
      evaluate: (event) => {
        const attackerName = String(event.payload.attackerName ?? "").trim();
        if (!attackerName) return [];
        if (event.payload.isWhitelistedAttacker === true) return [];
        return [
          makeAction(
            "attack_target",
            {
              targetName: attackerName,
              reason: "retaliate_on_hurt"
            },
            "reactive",
            "critical",
            "defensive"
          )
        ];
      }
    },
    {
      id: "deadline-recover",
      watches: ["task_deadline", "task_timeout"],
      evaluate: (event, state) => {
        const label = String(event.payload.label ?? "expired_task");
        return [
          makeAction(
            "observe_target",
            {
              reason: label,
              lastGoal: state.activeDirective?.goal ?? null
            },
            "reactive",
            "high",
            "reassess"
          )
        ];
      }
    },
    {
      id: "critical-health-stop-follow",
      watches: ["low_health"],
      evaluate: (event) => {
        if (event.payload.severity !== "critical") return [];
        return [
          makeAction("stop_follow", { reason: "critical_health" }, "reactive", "critical", "defensive")
        ];
      }
    },
    {
      id: "low-health-eat",
      watches: ["low_health", "low_food"],
      evaluate: (event) => {
        if (event.payload.hasFood === false) return [];
        return [
          makeAction(
            "eat_food",
            {
              reason: String(event.payload.reason ?? event.type)
            },
            "reactive",
            event.type === "low_health" && event.payload.severity === "critical" ? "critical" : "high",
            "self_guard"
          )
        ];
      }
    }
  ];
}

export function runReactiveRules(
  rules: ReactiveRule[],
  event: AgentEvent,
  state: AgentBlackboardSnapshot
): StrategicAction[] {
  return rules
    .filter((rule) => rule.watches.includes(event.type))
    .flatMap((rule) => rule.evaluate(event, state));
}
