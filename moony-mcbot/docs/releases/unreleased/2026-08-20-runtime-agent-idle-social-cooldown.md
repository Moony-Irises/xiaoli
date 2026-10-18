---
type: refactor
scope: runtime
audience: developer
summary: 将 Agent 空闲社交尝试冷却收口到 HierarchicalAgentRuntime
breaking: false
demo_ready: false
tests:
  - npm test -- test/agent-blackboard.test.ts test/idle-social-policy.test.ts test/agent-executor-integration.test.ts test/chat-config-reload.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
  - git diff --check
artifacts:
  - src/agent/runtime.ts
  - src/agent/README.md
  - src/runtime/README.md
  - src/tools/action-tools.ts
  - test/agent-blackboard.test.ts
  - README.md
  - CLAUDE.md
  - TODO.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
  - docs/manual-testing-guide.md
---

## What changed

`HierarchicalAgentRuntime` 新增按 Bot 的空闲社交尝试冷却，允许调用方在冷却到期时原子地判定并占用本次尝试；Supervisor 可在不创建缺失 Runtime 的情况下清理该时间戳。`action-tools.ts` 删除 `agentIdleSocialAt` 裸 Map，并在空闲白名单社交和 Agent 配置删除路径调用 Runtime。

## Why it matters

空闲社交的短期协调状态不再由大型工具编排文件隐式拥有。旧时间戳初值、重复抑制、精确冷却边界、时钟回退和按 Bot 清理现在可以离线测试，同时保留“目标选中后、任务开始前立即占用”的原顺序，避免失败尝试在每个 executor tick 重复触发。

## Demo posture / limitations

这不是 install demo、已发布版本或 GA。本轮只迁移空闲社交尝试冷却，不迁移候选筛选、记忆评分、Mineflayer 转头、Agent 任务、场景聊天或持久化；真实服务器上的目标选择和短句仍按现有 `socialize_whitelist` 场景验证。
