import {
  AiRequestError,
  classifyAiRequestState,
  createRunningAiRequestStatus,
  finishAiRequestStatus
} from "../runtime/ai-request.js";
import { AiRequestLifecycle } from "../runtime/ai-request-lifecycle.js";
import type { AiRequestHandle } from "../runtime/ai-request-lifecycle.js";
import type { AgentPlan, AgentPlanRequester, AgentPlannerConfig } from "./openai-agent-planner.js";

export interface AgentPlannerRequestRunnerInput {
  botId: string;
  config: AgentPlannerConfig;
  userInstruction: string;
  stateSnapshot: Record<string, unknown>;
  timeoutMs: number;
  requester: AgentPlanRequester;
  lifecycle: AiRequestLifecycle;
}

export interface AgentPlannerRequestScope extends AiRequestHandle {
  assertActive(): void;
  succeed(): boolean;
  fail(error: unknown): boolean;
}

export function beginAgentPlannerRequest(input: {
  botId: string;
  timeoutMs: number;
  model: string;
  lifecycle: AiRequestLifecycle;
}): AgentPlannerRequestScope {
  const status = createRunningAiRequestStatus(input.timeoutMs, input.model);
  const handle = input.lifecycle.begin(input.botId, status);
  return {
    ...handle,
    assertActive: () => {
      if (!handle.isCurrent() || handle.signal.aborted) {
        throw new AiRequestError("cancelled", "Agent planning turn cancelled");
      }
    },
    succeed: () => handle.update(finishAiRequestStatus(status, "success", { model: input.model })),
    fail: (error) => handle.update(finishAiRequestStatus(status, classifyAiRequestState(error), {
      model: input.model,
      error: error instanceof Error ? error.message : String(error)
    }))
  };
}

/** 在请求边界统一维护一次 planner 请求的状态与取消信号。 */
export async function runAgentPlannerRequest(
  input: AgentPlannerRequestRunnerInput
): Promise<AgentPlan> {
  const handle = beginAgentPlannerRequest({
    botId: input.botId, timeoutMs: input.timeoutMs, model: input.config.plannerModel, lifecycle: input.lifecycle
  });

  try {
    const plan = await input.requester.plan({
      config: input.config,
      userInstruction: input.userInstruction,
      stateSnapshot: input.stateSnapshot,
      timeoutMs: input.timeoutMs,
      signal: handle.signal
    });
    handle.succeed();
    return plan;
  } catch (error) {
    handle.fail(error);
    throw error;
  } finally {
    handle.close();
  }
}
