---
type: fix
scope: runtime
audience: developer
summary: 聊天滚动摘要升级为按 Bot 隔离的 v2 状态并兼容迁移现有 v1 数据
breaking: false
demo_ready: false
tests: npx tsx --test test/chat-memory-persistence.test.ts test/atomic-json-file.test.ts test/runtime-shutdown-lifecycle.test.ts; npm run lint; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/memory/chat-memory.ts
  - src/memory/README.md
  - src/main.ts
  - test/chat-memory-persistence.test.ts
  - README.md
  - CLAUDE.md
  - TODO.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
  - docs/persistence-lifecycle-design.md
  - docs/manual-testing-guide.md
---

## What changed

`chat-summary-state.json` 从全局 `lastSummary` 升级为 `version: 2` 的 `summariesByBotId`。摘要生成、上一轮摘要和 prompt 读取现在共享同一 `botId` 边界；启动时自动迁移 v1，单一候选 Bot 会继承旧摘要，归属不明的摘要只保留在 `unassignedLegacySummary`。状态接口新增存储版本、有效版本、摘要 Bot 列表和未归属摘要标志，但不返回摘要正文。

## Why it matters

旧结构虽然按 Bot 保存 pending，却让所有 Bot 共用上一轮摘要，导致一个实例的玩家聊天进入另一个实例的提示词。v2 在不修改 MCP 工具名、文件路径或 JSONL 历史格式的前提下关闭了这条跨实例信息泄漏路径。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA。迁移只覆盖 McBot 聊天摘要状态，不合并 Voice 的 `context-pack` 或跨频道摘要；无法判断归属的旧摘要会保留但不参与回复。离线测试证明格式迁移和多 Bot 隔离，真实双 Bot 服务器行为仍列在手测文档中。
