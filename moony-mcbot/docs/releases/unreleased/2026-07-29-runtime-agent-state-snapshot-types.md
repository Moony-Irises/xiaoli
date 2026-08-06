---
type: refactor
scope: runtime
audience: developer
summary: 让 Agent 完整状态快照成为内部消费者的唯一推导类型
breaking: false
demo_ready: false
tests: npx tsx --test test/dynamic-ai-state.test.ts test/planner-context-projection.test.ts test/agent-blackboard.test.ts test/agent-tool-executors.test.ts test/mcp-tool-registration.test.ts; npm run lint; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/tools/action-tools.ts
  - src/runtime/README.md
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
  - TODO.md
  - CLAUDE.md
---

## What changed

`buildAgentStateSnapshot()` 不再把完整快照声明为宽泛动态字典，而是从唯一构建实现推导内部 `AgentStateSnapshot`。状态同步、唤醒上下文、战略汇报目标、记忆地点摘要、目标生命周期指令和自治规划改用该类型，并让构建阶段直接使用正式 Mineflayer Bot 类型；本轮移除 20 处显式 `any` 文本命中。

## Why it matters

此前内部代码先构建一个结构确定的对象，再在每个消费者处反复强转，字段漂移只能在运行时暴露。现在构建结构变化会由 strict typecheck 直接传播到所有内部消费者，同时 planner 的字段白名单与畸形输入防护仍保持在独立投影层。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA，不改变 `agent.stateSnapshot`、Web 调试 JSON、MCP 工具、planner 请求字段或游戏行为。完整快照目前仍由 `action-tools.ts` 组装；战略汇报评分和记忆地点摘要尚未拆成独立纯模块，后续拆分时再补其专用评分测试。
