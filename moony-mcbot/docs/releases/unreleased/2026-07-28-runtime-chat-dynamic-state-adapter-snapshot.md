---
type: refactor
scope: runtime
audience: developer
summary: AI 闲聊动态状态的基础字段改读 Adapter 快照
breaking: false
demo_ready: false
tests: npx tsx --test test/dynamic-ai-state.test.ts test/agent-tool-executors.test.ts test/client-adapter-status.test.ts; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/runtime/dynamic-ai-state.ts
  - src/tools/action-tools.ts
  - test/dynamic-ai-state.test.ts
  - package.json
  - README.md
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
  - TODO.md
  - CLAUDE.md
---

## What changed

新增纯动态状态文本投影器，并将 AI 闲聊上下文中的生命、饥饿、手持物、食物数量、最近玩家距离和准星方块改为读取 `BotRuntime` 提供的 Adapter 快照。Mineflayer 的精确实体注视继续作为可选增强，连接不可用时保留原有四行简化 fallback。

## Why it matters

闲聊模型需要当前游戏状态，但高层提示词构造不应直接遍历 Mineflayer 的玩家表、背包和生命字段。基础状态迁移后，未来 Modded Client Bridge 可以提供同一种快照，同时纯投影器让格式边界和缺失值行为可以离线回归。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA 功能。没有修改 MCP、`ClientAdapter` 或配置公共契约；精确实体 focus 仍依赖 Mineflayer，真实游戏中的聊天状态一致性仍需按手测文档验证，本轮不代表 Modded Client 已具备完整第一人称感知。
