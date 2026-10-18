import {
  OpenAiAgentPlanner,
  type AgentPlan,
  type AgentPlanRequest,
  type AgentPlanRequester,
  type AgentPlanStep
} from "./openai-agent-planner.js";
import { buildDirectiveFromPlan } from "./plan-to-directive.js";
import type { StrategicDirective } from "./types.js";

export interface AgentPlanningDecision {
  plan: AgentPlan;
  directive: StrategicDirective | null;
  leftoverSteps: AgentPlanStep[];
}

export interface AgentPlanningInput extends AgentPlanRequest {
  botId: string;
  maxPlanSteps: number;
}

export interface AgentPlanningStrategy {
  decide(input: AgentPlanningInput): Promise<AgentPlanningDecision>;
}

/** Preserve successful request diagnostics when only plan translation fails. */
export class AgentPlanTranslationError extends Error {
  constructor(readonly plan: AgentPlan, cause: unknown) {
    super("Agent plan translation failed", { cause });
    this.name = "AgentPlanTranslationError";
  }
}

export class DefaultAgentPlanningStrategy implements AgentPlanningStrategy {
  constructor(private readonly requester: AgentPlanRequester = new OpenAiAgentPlanner()) {}

  async decide({ botId, maxPlanSteps, ...request }: AgentPlanningInput): Promise<AgentPlanningDecision> {
    const plan = await this.requester.plan(request);
    try {
      return { plan, ...buildDirectiveFromPlan(botId, request.userInstruction, plan, maxPlanSteps) };
    } catch (error) {
      throw new AgentPlanTranslationError(plan, error);
    }
  }
}
