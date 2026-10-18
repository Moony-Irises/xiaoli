import { AiRequestError } from "../runtime/ai-request.js";
import type { AiRequestLifecycle } from "../runtime/ai-request-lifecycle.js";
import type { AgentRuntimeDiagnosticsUpdate } from "../config/agent-config-store.js";
import type { AgentPlan, AgentPlannerConfig, AgentPlanStep } from "./openai-agent-planner.js";
import { beginAgentPlannerRequest, type AgentPlannerRequestScope } from "./planner-request-runner.js";
import {
  AgentPlanTranslationError,
  type AgentPlanningDecision,
  type AgentPlanningStrategy
} from "./planning-strategy.js";
import type { HierarchicalAgentRuntime } from "./runtime.js";
import type { AgentEvent } from "./types.js";

export type AgentPlanningSource = "manual" | "strategic_pass";

export interface AgentPlanningTurnConfig extends AgentPlannerConfig {
  lastPlanAt: number;
  planCooldownMs: number;
  maxPlanSteps: number;
}

export interface AgentPlanningTurnInput {
  botId: string;
  config: AgentPlanningTurnConfig;
  userInstruction: string;
  requester: string | null;
  source: AgentPlanningSource;
  timeoutMs: number;
  onFailure?: (error: unknown) => void;
}

export interface AgentPlanningTurnResult<TSnapshot> {
  plan: AgentPlan;
  plannedSteps: AgentPlanStep[];
  executionResult: string;
  stateSnapshot: TSnapshot;
}

export interface AgentPlanningTurnHooks<TSnapshot> {
  getRuntime(botId: string): HierarchicalAgentRuntime;
  syncState(botId: string): void;
  captureState(botId: string): TSnapshot;
  updateDiagnostics(botId: string, update: AgentRuntimeDiagnosticsUpdate): void;
  updateGoal(botId: string, source: AgentPlanningSource, decision: AgentPlanningDecision): void;
  sendSpeech(botId: string, text: string): Promise<void>;
  enqueueSteps(botId: string, steps: AgentPlanStep[]): void;
  startExecutor(botId: string): void;
  finishTurn(botId: string, source: AgentPlanningSource, executionResult: string): void;
}

function plannerEvent(type: AgentEvent["type"], payload: Record<string, unknown>): AgentEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type, priority: "normal", createdAt: Date.now(), payload
  };
}

export class AgentPlanningTurnCoordinator<TSnapshot extends Record<string, unknown>> {
  constructor(
    private readonly strategy: AgentPlanningStrategy,
    private readonly lifecycle: AiRequestLifecycle,
    private readonly hooks: AgentPlanningTurnHooks<TSnapshot>,
    private readonly now: () => number = Date.now
  ) {}

  async run(input: AgentPlanningTurnInput): Promise<AgentPlanningTurnResult<TSnapshot>> {
    const { botId, config, userInstruction, requester, source } = input;
    let scope: AgentPlannerRequestScope | undefined;
    let receivedPlan = false;
    try {
      const startedAt = this.now();
      const runtime = this.hooks.getRuntime(botId);
      runtime.syncPlannerTimestamp(config.lastPlanAt);
      const remaining = runtime.plannerCooldownRemaining(startedAt, config.planCooldownMs);
      if (remaining > 0) throw new Error(`Agent planner is cooling down (${remaining}ms remaining)`);

      this.hooks.syncState(botId);
      runtime.ingestEvent(plannerEvent("planner_requested", { requester, userInstruction, source }));
      const stateSnapshot = this.hooks.captureState(botId);
      const requestScope = beginAgentPlannerRequest({
        botId, timeoutMs: input.timeoutMs, model: config.plannerModel, lifecycle: this.lifecycle
      });
      scope = requestScope;

      const recordPlan = (plan: AgentPlan): void => {
        requestScope.assertActive();
        receivedPlan = true;
        requestScope.succeed();
        this.hooks.updateDiagnostics(botId, {
          lastPlanAt: runtime.markPlannerCompleted(startedAt), lastPlanSummary: JSON.stringify(plan)
        });
      };

      let decision: AgentPlanningDecision;
      try {
        decision = await this.strategy.decide({
          botId, config, userInstruction, stateSnapshot, timeoutMs: input.timeoutMs,
          maxPlanSteps: config.maxPlanSteps, signal: scope.signal
        });
      } catch (error) {
        // Translation errors happen after a successful model request in the legacy path.
        if (error instanceof AgentPlanTranslationError) {
          recordPlan(error.plan);
          throw error.cause;
        }
        throw error;
      }
      recordPlan(decision.plan);
      scope.assertActive();
      runtime.ingestEvent(plannerEvent("planner_result", {
        source, hasDirective: !!decision.directive,
        translatedActionCount: decision.directive?.actions.length ?? 0,
        leftoverStepCount: decision.leftoverSteps.length
      }));

      const { plan, directive, leftoverSteps: plannedSteps } = decision;
      let executionResult = "no_action";
      if (directive) {
        scope.assertActive();
        this.hooks.updateGoal(botId, source, decision);
        scope.assertActive();
        runtime.applyDirective(directive);
        executionResult = `applied_directive_${directive.actions.length}_action(s)`;
      }

      if (plan.speak && !directive && plannedSteps.length === 0) {
        scope.assertActive();
        try {
          await this.hooks.sendSpeech(botId, plan.speak);
        } catch (_error) {
          // Preserve best-effort speech; cancellation is checked again below.
        }
        scope.assertActive();
      }

      scope.assertActive();
      if (plannedSteps.length > 0) {
        const disallowed = plannedSteps.find((step) => !config.allowedTools.includes(step.tool));
        if (disallowed) throw new Error(`Tool '${disallowed.tool}' is not allowed for agent`);
        this.hooks.enqueueSteps(botId, plannedSteps);
        scope.assertActive();
        this.hooks.startExecutor(botId);
        executionResult = executionResult === "no_action"
          ? `enqueued_${plannedSteps.length}_step(s)`
          : `${executionResult};enqueued_${plannedSteps.length}_step(s)`;
      } else if (plan.intent === "execute_skill" && !directive) {
        throw new Error("Agent plan missing executable step");
      }

      scope.assertActive();
      this.hooks.updateDiagnostics(botId, { lastPlanResult: executionResult });
      scope.assertActive();
      this.hooks.finishTurn(botId, source, executionResult);
      return { plan, plannedSteps, executionResult, stateSnapshot };
    } catch (error) {
      const cancelled = scope && (!scope.isCurrent() || scope.signal.aborted);
      const failure = cancelled && !(error instanceof AiRequestError && error.kind === "cancelled")
        ? new AiRequestError("cancelled", "Agent planning turn cancelled", { cause: error })
        : error;
      if (!receivedPlan || cancelled) scope?.fail(failure);
      if (!scope || scope.isCurrent()) input.onFailure?.(failure);
      throw failure;
    } finally {
      scope?.close();
    }
  }
}
