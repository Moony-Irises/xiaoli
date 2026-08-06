export type AgentLayer = "event" | "blackboard" | "reactive" | "executive" | "strategic" | "skill";

export type AgentRuntimeState = "idle" | "social" | "task_running" | "guarded";

export type AgentPriority = "low" | "normal" | "high" | "critical";

export type AgentEventType =
  | "tick"
  | "hurt"
  | "low_health"
  | "low_food"
  | "milestone_advanced"
  | "milestone_rewound"
  | "milestone_completed"
  | "goal_completed"
  | "goal_abandoned"
  | "chat_wake"
  | "task_deadline"
  | "task_timeout"
  | "task_finished"
  | "task_failed"
  | "perception_updated"
  | "manual_override"
  | "planner_requested"
  | "planner_result";

export interface AgentEvent {
  id: string;
  type: AgentEventType;
  priority: AgentPriority;
  createdAt: number;
  payload: Record<string, unknown>;
}

export interface AgentExecutionEvent {
  id: string;
  timestamp: string;
  type: string;
  priority: AgentPriority;
  payload: Record<string, unknown>;
}

export interface AgentTimer {
  id: string;
  type: "deadline" | "cooldown" | "timeout";
  label: string;
  dueAt: number;
  payload: Record<string, unknown>;
}

export type AgentTaskStatus = "running" | "finished" | "failed" | "cancelled";
export type AgentTaskSource = "manual_command" | "agent" | "runtime";

export interface AgentTaskRuntime {
  taskId: string;
  type: string;
  status: AgentTaskStatus;
  source: AgentTaskSource;
  goal: string;
  params: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  detail?: string;
  lastError?: string;
}

export interface AgentStrategicGoal {
  goal: string;
  rationale?: string;
  source: "manual" | "strategic_pass";
  milestones?: string[];
  currentMilestoneIndex?: number;
  createdAt: number;
  updatedAt: number;
  lastRepairAt?: number;
  lastFailureEventId?: string;
  failureCount?: number;
}

export type StrategicActionKind =
  | "follow_player"
  | "attack_target"
  | "challenge_entity"
  | "stop_follow"
  | "eat_food"
  | "prepare_battle"
  | "request_teleport_to_player"
  | "move_to_position"
  | "organize_inventory"
  | "equip_category"
  | "drop_item"
  | "open_door"
  | "wander_area"
  | "socialize"
  | "mine_visible"
  | "observe_target"
  | "speak"
  | "tool_call"
  | "idle";

export interface StrategicAction {
  id: string;
  kind: StrategicActionKind;
  params: Record<string, unknown>;
  style?: string;
  source: "llm" | "reactive" | "manual";
  priority: AgentPriority;
  createdAt: number;
  expiresAt?: number;
}

export interface StrategicDirective {
  id: string;
  goal: string;
  rationale?: string;
  desiredMode?: "manual" | "assist" | "auto";
  actions: StrategicAction[];
  createdAt: number;
}

export interface SkillInvocation {
  skill: string;
  args: Record<string, unknown>;
  timeoutMs?: number;
}

export interface SkillAffordance {
  canRun: boolean;
  score: number;
  reason: string;
}

export interface SkillModuleDescriptor {
  id: string;
  supportedActions: StrategicActionKind[];
  toolDependencies: readonly string[];
  interruptible: boolean;
  tickRateMs: number;
  estimate: (action: StrategicAction, state: AgentBlackboardSnapshot) => SkillAffordance;
  compile: (action: StrategicAction, state: AgentBlackboardSnapshot) => SkillInvocation[];
}

export interface ReactiveRule {
  id: string;
  watches: AgentEventType[];
  evaluate: (event: AgentEvent, state: AgentBlackboardSnapshot) => StrategicAction[];
}

export interface AgentBlackboardSnapshot {
  botId: string;
  updatedAt: number;
  runtimeState: AgentRuntimeState;
  selfState: Record<string, unknown>;
  perception: Record<string, unknown>;
  recentEvents: AgentEvent[];
  executionEvents: AgentExecutionEvent[];
  timers: AgentTimer[];
  queuedActions: StrategicAction[];
  activeDirective: StrategicDirective | null;
  strategicGoal: AgentStrategicGoal | null;
  activeTask: AgentTaskRuntime | null;
  activeAction: StrategicAction | null;
  activeSkill: SkillInvocation | null;
}

export interface StrategicPlanner {
  plan: (state: AgentBlackboardSnapshot) => Promise<StrategicDirective | null>;
}
