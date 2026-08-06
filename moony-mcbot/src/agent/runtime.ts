import { AgentBlackboard } from "./blackboard.js";
import { AgentEventBus } from "./event-bus.js";
import { createDefaultReactiveRules, runReactiveRules } from "./reactive-rules.js";
import { createDefaultSkillCatalog, scoreActionAgainstCatalog } from "./skill-catalog.js";
import {
  AgentBlackboardSnapshot,
  AgentEvent,
  AgentTimer,
  ReactiveRule,
  SkillInvocation,
  SkillModuleDescriptor,
  StrategicAction,
  StrategicDirective,
  StrategicPlanner
} from "./types.js";

export class HierarchicalAgentRuntime {
  readonly blackboard: AgentBlackboard;
  readonly events: AgentEventBus;
  private readonly reactiveRules: ReactiveRule[];
  private readonly skillCatalog: SkillModuleDescriptor[];
  private lastPlannerAt = 0;

  constructor(
    readonly botId: string,
    private readonly planner?: StrategicPlanner,
    options?: {
      reactiveRules?: ReactiveRule[];
      skillCatalog?: SkillModuleDescriptor[];
    }
  ) {
    this.blackboard = new AgentBlackboard(botId);
    this.events = new AgentEventBus();
    this.reactiveRules = options?.reactiveRules ?? createDefaultReactiveRules();
    this.skillCatalog = options?.skillCatalog ?? createDefaultSkillCatalog();
  }

  updateSelfState(selfState: Record<string, unknown>): void {
    this.blackboard.updateSelfState(selfState);
  }

  updatePerception(perception: Record<string, unknown>): void {
    this.blackboard.updatePerception(perception);
    this.ingestEvent({
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: "perception_updated",
      priority: "low",
      createdAt: Date.now(),
      payload: {}
    });
  }

  ingestEvent(event: AgentEvent): void {
    this.events.publish(event);
    this.blackboard.recordEvent(event);
    const reactions = runReactiveRules(this.reactiveRules, event, this.blackboard.snapshot());
    this.blackboard.enqueueActions(reactions);
  }

  applyDirective(directive: StrategicDirective | null): void {
    this.blackboard.setDirective(directive);
    if (!directive) return;
    this.blackboard.enqueueActions(directive.actions);
    this.lastPlannerAt = Date.now();
  }

  scheduleTimer(timer: AgentTimer): void {
    this.blackboard.upsertTimer(timer);
  }

  pollExpiredTimers(now = Date.now()): AgentEvent[] {
    const expired = this.blackboard.popExpiredTimers(now);
    const events = expired.map<AgentEvent>((timer) => ({
      id: `evt_${timer.id}_${now}`,
      type: timer.type === "deadline" ? "task_deadline" : "task_timeout",
      priority: "high",
      createdAt: now,
      payload: {
        label: timer.label,
        timerId: timer.id,
        ...timer.payload
      }
    }));
    for (const event of events) {
      this.ingestEvent(event);
    }
    return events;
  }

  async runStrategicPass(now = Date.now(), minIntervalMs = 4000): Promise<StrategicDirective | null> {
    if (!this.planner) return null;
    if (now - this.lastPlannerAt < minIntervalMs) return null;
    const directive = await this.planner.plan(this.blackboard.snapshot());
    if (directive) {
      this.applyDirective(directive);
    }
    return directive;
  }

  peekNextAction(): StrategicAction | null {
    return this.blackboard.peekNextAction();
  }

  dequeueNextAction(): StrategicAction | null {
    return this.blackboard.dequeueNextAction();
  }

  requeueAction(action: StrategicAction): void {
    this.blackboard.enqueueActions([action]);
  }

  chooseNextSkillInvocation(): { action: StrategicAction; invocation: SkillInvocation } | null {
    const action = this.blackboard.peekNextAction();
    if (!action) return null;
    const scored = scoreActionAgainstCatalog(action, this.blackboard.snapshot(), this.skillCatalog);
    const best = scored[0];
    if (!best) return null;
    const invocations = best.module.compile(action, this.blackboard.snapshot());
    const invocation = invocations[0];
    if (!invocation) return null;
    return { action, invocation };
  }

  bindNextAction(): { action: StrategicAction; invocation: SkillInvocation } | null {
    const choice = this.chooseNextSkillInvocation();
    if (!choice) return null;
    this.blackboard.dequeueNextAction();
    this.blackboard.setActiveAction(choice.action);
    this.blackboard.setActiveSkill(choice.invocation);
    return choice;
  }

  finishActiveExecution(): void {
    this.blackboard.setActiveSkill(null);
    this.blackboard.setActiveAction(null);
  }

  snapshot(): AgentBlackboardSnapshot {
    return this.blackboard.snapshot();
  }

  status(): Record<string, unknown> {
    const snap = this.blackboard.snapshot();
    return {
      botId: this.botId,
      runtimeState: snap.runtimeState,
      queuedActions: snap.queuedActions.length,
      activeDirectiveId: snap.activeDirective?.id ?? null,
      strategicGoal: snap.strategicGoal,
      currentMilestone:
        snap.strategicGoal?.milestones?.[snap.strategicGoal.currentMilestoneIndex ?? 0] ?? null,
      activeTask: snap.activeTask,
      activeActionId: snap.activeAction?.id ?? null,
      activeSkill: snap.activeSkill?.skill ?? null,
      recentEvents: snap.recentEvents.length,
      recentExecutionEvents: snap.executionEvents.length,
      timers: snap.timers.length,
      lastPlannerAt: this.lastPlannerAt || null
    };
  }
}

export class HierarchicalAgentSupervisor {
  private readonly runtimes = new Map<string, HierarchicalAgentRuntime>();

  ensure(botId: string): HierarchicalAgentRuntime {
    const existing = this.runtimes.get(botId);
    if (existing) return existing;
    const created = new HierarchicalAgentRuntime(botId);
    this.runtimes.set(botId, created);
    return created;
  }

  get(botId: string): HierarchicalAgentRuntime {
    const runtime = this.runtimes.get(botId);
    if (!runtime) {
      throw new Error(`Hierarchical agent runtime for '${botId}' not found`);
    }
    return runtime;
  }

  syncBotIds(botIds: string[]): void {
    const next = new Set(botIds);
    for (const botId of botIds) {
      this.ensure(botId);
    }
    for (const botId of this.runtimes.keys()) {
      if (!next.has(botId)) {
        this.runtimes.delete(botId);
      }
    }
  }

  listBotIds(): string[] {
    return [...this.runtimes.keys()];
  }
}
