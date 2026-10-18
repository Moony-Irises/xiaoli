import {
  classifyAiRequestState,
  createRunningAiRequestStatus,
  finishAiRequestStatus
} from "../runtime/ai-request.js";
import { AiRequestLifecycle } from "../runtime/ai-request-lifecycle.js";
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

/** 在请求边界统一维护一次 planner 请求的状态与取消信号。 */
export async function runAgentPlannerRequest(
  input: AgentPlannerRequestRunnerInput
): Promise<AgentPlan> {
  const requestStatus = createRunningAiRequestStatus(input.timeoutMs, input.config.plannerModel);
  const handle = input.lifecycle.begin(input.botId, requestStatus);

  try {
    const plan = await input.requester.plan({
      config: input.config,
      userInstruction: input.userInstruction,
      stateSnapshot: input.stateSnapshot,
      timeoutMs: input.timeoutMs,
      signal: handle.signal
    });
    handle.update(finishAiRequestStatus(requestStatus, "success", {
      model: input.config.plannerModel
    }));
    return plan;
  } catch (error) {
    handle.update(finishAiRequestStatus(requestStatus, classifyAiRequestState(error), {
      model: input.config.plannerModel,
      error: error instanceof Error ? error.message : String(error)
    }));
    throw error;
  } finally {
    handle.close();
  }
}
