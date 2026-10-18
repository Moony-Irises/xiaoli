import {
  buildPlannerContextProjection,
  buildPlannerMemorySummary
} from "../runtime/planner-context-projection.js";
import { postOpenAiChatCompletions } from "../runtime/openai-compatible-client.js";
import { extractAiText, summarizeEmptyAiChoice } from "../runtime/openai-response-text.js";

export interface AgentPlannerConfig {
  plannerApiBaseUrl: string;
  plannerApiKey: string;
  plannerModel: string;
  plannerSystemPrompt: string;
  allowedTools: readonly string[];
}

export interface AgentPlanStep {
  tool: string;
  arguments?: Record<string, unknown>;
  speak?: string;
}

export interface AgentPlan {
  intent: "execute_skill" | "no_action";
  speak?: string;
  tool?: string;
  arguments?: Record<string, unknown>;
  steps?: AgentPlanStep[];
  directive?: {
    goal?: string;
    rationale?: string;
    desiredMode?: "manual" | "assist" | "auto";
    milestones?: string[];
    currentMilestoneIndex?: number;
    actions?: Array<{
      kind?: string;
      params?: Record<string, unknown>;
      style?: string;
      priority?: "low" | "normal" | "high" | "critical";
    }>;
  };
}

export interface AgentPlanRequest {
  config: AgentPlannerConfig;
  userInstruction: string;
  stateSnapshot: Record<string, unknown>;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface AgentPlanRequester {
  plan(request: AgentPlanRequest): Promise<AgentPlan>;
}

export class OpenAiAgentPlanner implements AgentPlanRequester {
  constructor(private readonly sendRequest: typeof postOpenAiChatCompletions = postOpenAiChatCompletions) {}

  async plan({
    config, userInstruction, stateSnapshot, timeoutMs, signal
  }: AgentPlanRequest): Promise<AgentPlan> {
    if (!config.plannerApiKey) {
      throw new Error("Agent planner API key is empty. Set MCBOT_AI_API_KEY or configure plannerApiKey in agent.configure");
    }

    const plannerObservation = buildPlannerContextProjection(stateSnapshot);
    const plannerMemorySummary = buildPlannerMemorySummary(stateSnapshot);
    const { response, rawBody } = await this.sendRequest({
      apiBaseUrl: config.plannerApiBaseUrl,
      apiKey: config.plannerApiKey,
      timeoutMs,
      signal,
      body: {
        model: config.plannerModel,
        temperature: 0.2,
        messages: [
          { role: "system", content: config.plannerSystemPrompt },
          {
            role: "system",
            content:
              "允许工具:\n" +
              config.allowedTools.join("\n") +
              "\n\n输出格式:\n" +
              '{"intent":"execute_skill"|"no_action","speak":"可选","tool":"可选","arguments":{},"steps":[{"tool":"必填","arguments":{},"speak":"可选"}],"directive":{"goal":"可选","rationale":"可选","desiredMode":"manual|assist|auto","milestones":["可选阶段1","可选阶段2"],"currentMilestoneIndex":0,"actions":[{"kind":"follow_player|attack_target|challenge_entity|stop_follow|eat_food|prepare_battle|request_teleport_to_player|move_to_position|organize_inventory|equip_category|drop_item|open_door|wander_area|socialize|mine_visible|observe_target|speak|idle","params":{},"style":"可选","priority":"low|normal|high|critical"}]}}\n' +
              "优先输出 directive.actions；只有当你无法稳定映射到高层 action 时，才退回 steps/tool。\n" +
              "决策时优先参考 task 和 recentEvents；如果 task.activeTask 正在运行，默认不要无故打断。\n" +
              "输出必须是单个 JSON 对象，不要 Markdown，不要解释，不要额外文本。"
          },
          {
            role: "system",
            content:
              '示例1:\n用户: "跟着 Judy，但保持一点距离"\n输出:\n' +
              '{"intent":"execute_skill","directive":{"goal":"follow Judy","rationale":"owner-like follow request","actions":[{"kind":"follow_player","params":{"playerName":"Judy","minDistance":2.5,"maxDistance":5,"sprint":false,"tickMs":250},"priority":"normal"}]}}'
          },
          {
            role: "system",
            content:
              '示例2:\n用户: "先别跟着了，吃点东西"\n输出:\n' +
              '{"intent":"execute_skill","directive":{"goal":"recover safely","rationale":"stop current follow and recover","actions":[{"kind":"stop_follow","params":{"reason":"recover"},"priority":"high"},{"kind":"eat_food","params":{"reason":"recover"},"priority":"high"}]}}'
          },
          {
            role: "system",
            content:
              '示例3:\n用户: "附近有可见煤矿就去挖"\n输出:\n' +
              '{"intent":"execute_skill","directive":{"goal":"mine nearby visible coal","rationale":"resource gathering request","actions":[{"kind":"mine_visible","params":{"blockNames":["coal_ore","deepslate_coal_ore"],"searchRadius":24,"maxBlocks":8},"priority":"normal"}]}}'
          },
          {
            role: "system",
            content:
              '示例4:\n用户: "你现在在做什么"\n输出:\n' +
              '{"intent":"execute_skill","directive":{"goal":"answer status question","rationale":"user asked for a spoken response only","actions":[{"kind":"speak","params":{"text":"我现在在待命。"},"priority":"normal"}]}}'
          },
          {
            role: "system",
            content:
              '示例5:\n用户: "准备战斗"\n输出:\n' +
              '{"intent":"execute_skill","directive":{"goal":"prepare for combat","rationale":"combat readiness requested","actions":[{"kind":"prepare_battle","params":{"preferIronSword":true,"equipArmor":true},"priority":"high"}]}}'
          },
          {
            role: "system",
            content:
              '示例6:\n用户: "把第一格的东西丢掉"\n输出:\n' +
              '{"intent":"execute_skill","directive":{"goal":"drop item from hotbar","rationale":"explicit inventory drop request","actions":[{"kind":"drop_item","params":{"slot":1,"mode":"stack","restorePrevious":true},"priority":"normal"}]}}'
          },
          {
            role: "system",
            content:
              '示例7:\n用户: "挑战一下监守者"\n输出:\n' +
              '{"intent":"execute_skill","directive":{"goal":"challenge nearby warden","rationale":"start a full duel instead of a single hit","actions":[{"kind":"challenge_entity","params":{"targetText":"监守者","maxDistance":16},"priority":"high"}]}}'
          },
          {
            role: "system",
            content:
              '示例8:\n用户: "向 Judy 发个 tpa"\n输出:\n' +
              '{"intent":"execute_skill","directive":{"goal":"request teleport to Judy","rationale":"send the server teleport request command","actions":[{"kind":"request_teleport_to_player","params":{"playerName":"Judy"},"priority":"normal"}]}}'
          },
          {
            role: "system",
            content:
              '示例9:\n用户: "刚刚完成了一个长期目标，Judy 在旁边"\n输出:\n' +
              '{"intent":"execute_skill","directive":{"goal":"report completed goal","rationale":"a goal lifecycle event just completed and a nearby trusted player can be informed","actions":[{"kind":"speak","params":{"text":"搞定了。"},"priority":"normal"}]}}'
          },
          {
            role: "system",
            content:
              '示例10:\n用户: "刚刚放弃了当前目标，附近有白名单玩家"\n输出:\n' +
              '{"intent":"execute_skill","directive":{"goal":"report abandoned goal briefly","rationale":"goal was abandoned and should be reported briefly without inventing a new task","actions":[{"kind":"speak","params":{"text":"这个先不做了。"},"priority":"normal"}]}}'
          },
          { role: "system", content: `记忆摘要:\n${plannerMemorySummary}` },
          { role: "system", content: `任务上下文投影JSON:\n${JSON.stringify(plannerObservation, null, 2)}` },
          { role: "user", content: userInstruction }
        ]
      }
    });
    if (!response.ok) {
      throw new Error(`Agent planner request failed: HTTP ${response.status} ${rawBody.slice(0, 200)}`);
    }

    const data = JSON.parse(rawBody) as {
      choices?: Array<{
        finish_reason?: string;
        message?: { content?: unknown; reasoning_content?: string };
        text?: unknown;
      }>;
    };
    const firstChoice = data.choices?.[0];
    const content = extractAiText(firstChoice?.message?.content) || extractAiText(firstChoice?.text);
    if (!content) {
      throw new Error(`Agent planner returned empty content (${summarizeEmptyAiChoice(firstChoice)})`);
    }

    const normalized = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(normalized) as AgentPlan;
    if (parsed.intent !== "execute_skill" && parsed.intent !== "no_action") {
      throw new Error("Agent planner returned invalid intent");
    }
    return parsed;
  }
}
