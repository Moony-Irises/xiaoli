import type { HierarchicalAgentRuntime } from "./runtime.js";
import type { AgentEvent } from "./types.js";

export interface AgentRuntimeActionHooks {
  getAllowedTools(): readonly string[];
  canInterrupt(tool: string): boolean;
  executeTool(tool: string, args: Record<string, unknown>): Promise<string>;
  updateLastResult(result: string): void;
}

function executionEvent(
  type: AgentEvent["type"],
  priority: AgentEvent["priority"],
  payload: Record<string, unknown>
): AgentEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    priority,
    createdAt: Date.now(),
    payload
  };
}

export async function executeAgentRuntimeAction(
  runtime: HierarchicalAgentRuntime,
  hooks: AgentRuntimeActionHooks
): Promise<boolean> {
  const preview = runtime.chooseNextSkillInvocation();
  if (!preview) return false;

  if (!hooks.getAllowedTools().includes(preview.invocation.skill)) {
    runtime.bindNextAction();
    try {
      runtime.ingestEvent(executionEvent("task_failed", "normal", {
        taskType: preview.action.kind,
        detail: `hierarchical runtime blocked tool '${preview.invocation.skill}'`
      }));
      return false;
    } finally {
      runtime.finishActiveExecution();
    }
  }

  if (!hooks.canInterrupt(preview.invocation.skill)) return false;

  const bound = runtime.bindNextAction();
  if (!bound) return false;

  try {
    const result = await hooks.executeTool(bound.invocation.skill, bound.invocation.args);
    hooks.updateLastResult(result);
    runtime.ingestEvent(executionEvent("task_finished", "normal", {
      taskType: bound.action.kind,
      detail: `executed ${bound.invocation.skill}`,
      skill: bound.invocation.skill,
      result
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    hooks.updateLastResult(message);
    runtime.ingestEvent(executionEvent("task_failed", "high", {
      taskType: bound.action.kind,
      detail: `failed ${bound.invocation.skill}`,
      skill: bound.invocation.skill,
      lastError: message
    }));
  } finally {
    runtime.finishActiveExecution();
  }

  return true;
}
