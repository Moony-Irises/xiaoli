---
type: refactor
scope: runtime
audience: developer
summary: 将社交与人格短期运行状态收口到 SocialRuntimeStateStore
breaking: false
demo_ready: false
tests:
  - npm test -- test/social-runtime-state-store.test.ts test/dynamic-ai-state.test.ts test/chat-memory-persistence.test.ts test/chat-config-reload.test.ts test/agent-executor-integration.test.ts test/self-guard-state.test.ts test/self-guard-runtime-state-store.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
  - git diff --check
artifacts:
  - src/runtime/social-runtime-state-store.ts
  - src/runtime/README.md
  - src/tools/action-tools.ts
  - test/social-runtime-state-store.test.ts
  - README.md
  - CLAUDE.md
  - TODO.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
  - docs/persistence-lifecycle-design.md
  - docs/manual-testing-guide.md
---

## What changed

将最近互动、最近主动发言、短期回复上下文、心情和分场景台词冷却五组裸 Map 收口到 `SocialRuntimeStateStore`。Store 按 Bot 隔离状态，提供上下文副本和场景台词原子占用；`action-tools.ts` 继续编排聊天、self-guard、动态 AI、共享记忆和实际发送。

## Why it matters

社交与人格短期状态现在有明确的运行时所有权和可测试边界，避免 chat、self-guard 与记忆路径分别持有隐式全局状态。原有精确冷却、时钟回退、发送前记账、30 秒上下文过期和空心情回退语义保持不变。

## Demo posture / limitations

这不是 install demo、已发布版本或 GA。本轮不新增游戏动作，不把状态写入共享 memory 或配置，也不改变 MCP/Web 公共契约；状态仍是进程内短期状态，重启后不恢复。Store 的 `clearBot()` 尚未接入生产删除路径，因为统一 `BotRegistry.delete()` 跨模块清理钩子仍未完成。
