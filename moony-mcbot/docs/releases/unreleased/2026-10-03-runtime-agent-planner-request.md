---
type: refactor
scope: runtime
audience: developer
summary: 抽取独立 Agent 规划请求组件并验证规划到模拟客户端的执行链
breaking: false
demo_ready: false
tests:
  - npm test -- test/openai-agent-planner.test.ts test/agent-planner-integration.test.ts
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
  - npm run validate:releases
  - git diff --check
artifacts:
  - src/agent/openai-agent-planner.ts
  - src/runtime/openai-response-text.ts
  - src/tools/action-tools.ts
  - src/agent/README.md
  - src/runtime/README.md
  - test/openai-agent-planner.test.ts
  - test/agent-planner-integration.test.ts
  - test/README.md
  - docs/planner-context-projection-design.md
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
  - README.md
  - CLAUDE.md
  - TODO.md
---

## What changed

将规划请求构造、上下文白名单、记忆摘要与响应解析移到 `OpenAiAgentPlanner`。旧轮次编排通过内部 `AgentPlanRequester` 调用默认实现，超时和取消 signal 由调用层传入。planner 和 chat 复用抽出的原文本解析函数，原提示词、10 个示例、响应兼容和错误文案保持一致。

新增请求单元测试与 MCP 接线回归。接线使用临时本机模型服务、隔离持久化目录和模拟 Adapter，覆盖无动作、冷却、错误诊断与黑板 → Skill → CommandDispatcher → Adapter 的进食链。

## Why it matters

模型请求现在有独立、可替换的内部边界，无需真实游戏或云端 API 即可验证请求契约与后续执行接线。调用层不再同时维护业务轮次和模型协议细节，后续可继续迁移完整 Strategic Layer。

## Demo posture / limitations

这次不代表完整 Strategic Layer 已迁移、Modded Client 已实现或真实游戏验收通过，也不是 install demo、已发布版本或 GA。生产规划器仍在组合点固定构造；请求生命周期、directive 翻译、权限及工具执行仍由旧编排层管理，嵌套计划 schema 校验保持原状。

接线测试显式授权进食，不修改生产默认 allowlist；模拟客户端成功不能替代游戏行为证据。黑板 `recentEvents` 与 `agent.events.tail` 的 `executionEvents` 仍有口径差异，已记录到 TODO 和测试指南。
