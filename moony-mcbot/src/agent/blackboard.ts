import {
  AgentBlackboardSnapshot,
  AgentEvent,
  AgentExecutionEvent,
  AgentRuntimeState,
  AgentStrategicGoal,
  AgentTaskRuntime,
  AgentTimer,
  SkillInvocation,
  StrategicAction,
  StrategicDirective
} from "./types.js";

function toIsoTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

export class AgentBlackboard {
  private selfState: Record<string, unknown> = {};
  private perception: Record<string, unknown> = {};
  private runtimeState: AgentRuntimeState = "idle";
  private readonly recentEvents: AgentEvent[] = [];
  private readonly executionEvents: AgentExecutionEvent[] = [];
  private readonly observableEvents: AgentExecutionEvent[] = [];
  private readonly timers = new Map<string, AgentTimer>();
  private readonly actionQueue: StrategicAction[] = [];
  private activeDirective: StrategicDirective | null = null;
  private strategicGoal: AgentStrategicGoal | null = null;
  private activeTask: AgentTaskRuntime | null = null;
  private activeAction: StrategicAction | null = null;
  private activeSkill: SkillInvocation | null = null;
  private updatedAt = Date.now();

  constructor(private readonly botId: string, private readonly maxRecentEvents = 64) {}

  updateSelfState(selfState: Record<string, unknown>): void {
    this.selfState = { ...selfState };
    this.updatedAt = Date.now();
  }

  updatePerception(perception: Record<string, unknown>): void {
    this.perception = { ...perception };
    this.updatedAt = Date.now();
  }

  setRuntimeState(state: AgentRuntimeState): void {
    this.runtimeState = state;
    this.updatedAt = Date.now();
  }

  recordEvent(event: AgentEvent): void {
    this.recentEvents.push(event);
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents.splice(0, this.recentEvents.length - this.maxRecentEvents);
    }
    if (event.type !== "tick" && event.type !== "perception_updated") {
      this.recordObservableEvent({
        id: event.id,
        timestamp: toIsoTimestamp(event.createdAt),
        type: event.type,
        priority: event.priority,
        payload: event.payload
      });
    }
    this.updatedAt = Date.now();
  }

  recordExecutionEvent(event: AgentExecutionEvent): void {
    this.executionEvents.push({
      ...event,
      payload: { ...event.payload }
    });
    if (this.executionEvents.length > 20) {
      this.executionEvents.splice(0, this.executionEvents.length - 20);
    }
    this.recordObservableEvent(event);
    this.updatedAt = Date.now();
  }

  rawExecutionEvents(): AgentExecutionEvent[] {
    return this.executionEvents.map((event) => ({ ...event, payload: { ...event.payload } }));
  }

  observableExecutionEvents(): AgentExecutionEvent[] {
    return this.observableEvents.map((event) => ({ ...event, payload: { ...event.payload } }));
  }

  private recordObservableEvent(event: AgentExecutionEvent): void {
    // Preserve recording order even when timestamps tie or the system clock moves backwards.
    if (this.observableEvents.some((existing) => existing.id === event.id)) return;
    this.observableEvents.push({ ...event, payload: { ...event.payload } });
    if (this.observableEvents.length > 20) {
      this.observableEvents.splice(0, this.observableEvents.length - 20);
    }
  }

  setDirective(directive: StrategicDirective | null): void {
    this.activeDirective = directive ? { ...directive, actions: directive.actions.map((action) => ({ ...action, params: { ...action.params } })) } : null;
    this.updatedAt = Date.now();
  }

  setStrategicGoal(goal: AgentStrategicGoal | null): void {
    this.strategicGoal = goal
      ? {
          ...goal,
          milestones: goal.milestones ? [...goal.milestones] : undefined
        }
      : null;
    this.updatedAt = Date.now();
  }

  setActiveTask(task: AgentTaskRuntime | null): void {
    this.activeTask = task
      ? {
          ...task,
          params: { ...task.params }
        }
      : null;
    this.updatedAt = Date.now();
  }

  enqueueActions(actions: StrategicAction[]): void {
    if (actions.length === 0) return;
    this.actionQueue.push(...actions);
    this.actionQueue.sort((a, b) => {
      const priorityScore = (value: StrategicAction["priority"]) =>
        value === "critical" ? 4 : value === "high" ? 3 : value === "normal" ? 2 : 1;
      const byPriority = priorityScore(b.priority) - priorityScore(a.priority);
      if (byPriority !== 0) return byPriority;
      const aExpiry = a.expiresAt ?? Number.POSITIVE_INFINITY;
      const bExpiry = b.expiresAt ?? Number.POSITIVE_INFINITY;
      if (aExpiry !== bExpiry) return aExpiry - bExpiry;
      return a.createdAt - b.createdAt;
    });
    this.updatedAt = Date.now();
  }

  peekNextAction(): StrategicAction | null {
    return this.actionQueue[0] ?? null;
  }

  dequeueNextAction(): StrategicAction | null {
    const next = this.actionQueue.shift() ?? null;
    this.updatedAt = Date.now();
    return next;
  }

  setActiveAction(action: StrategicAction | null): void {
    this.activeAction = action;
    this.updatedAt = Date.now();
  }

  setActiveSkill(invocation: SkillInvocation | null): void {
    this.activeSkill = invocation;
    this.updatedAt = Date.now();
  }

  upsertTimer(timer: AgentTimer): void {
    this.timers.set(timer.id, timer);
    this.updatedAt = Date.now();
  }

  removeTimer(timerId: string): void {
    this.timers.delete(timerId);
    this.updatedAt = Date.now();
  }

  popExpiredTimers(now = Date.now()): AgentTimer[] {
    const expired: AgentTimer[] = [];
    for (const timer of this.timers.values()) {
      if (timer.dueAt <= now) {
        expired.push(timer);
        this.timers.delete(timer.id);
      }
    }
    if (expired.length > 0) {
      this.updatedAt = Date.now();
    }
    return expired.sort((a, b) => a.dueAt - b.dueAt);
  }

  snapshot(): AgentBlackboardSnapshot {
    return {
      botId: this.botId,
      updatedAt: this.updatedAt,
      runtimeState: this.runtimeState,
      selfState: { ...this.selfState },
      perception: { ...this.perception },
      recentEvents: [...this.recentEvents],
      executionEvents: this.rawExecutionEvents(),
      timers: [...this.timers.values()].sort((a, b) => a.dueAt - b.dueAt),
      queuedActions: [...this.actionQueue],
      activeDirective: this.activeDirective,
      strategicGoal: this.strategicGoal
        ? {
            ...this.strategicGoal,
            milestones: this.strategicGoal.milestones ? [...this.strategicGoal.milestones] : undefined
          }
        : null,
      activeTask: this.activeTask
        ? {
            ...this.activeTask,
            params: { ...this.activeTask.params }
          }
        : null,
      activeAction: this.activeAction,
      activeSkill: this.activeSkill
    };
  }
}
