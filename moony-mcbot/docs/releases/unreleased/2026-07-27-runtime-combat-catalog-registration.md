---
type: refactor
scope: runtime
audience: developer
summary: 将现有 Agent 核心 Combat MCP 工具迁移到 Catalog 驱动注册
breaking: false
demo_ready: false
tests: npx tsx --test test/mcp-tool-registration.test.ts test/tool-catalog.test.ts test/duel-session.test.ts test/mineflayer-inventory.test.ts; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/catalog/tool-catalog.ts
  - src/catalog/README.md
  - src/tools/action-tools.ts
  - test/mcp-tool-registration.test.ts
  - docs/tool-skill-catalog-design.md
  - README.md
  - TODO.md
  - CLAUDE.md
---

## What changed

将已有的 `combat.prepareBattle` 和 `combat.challengeEntity` MCP 注册迁移到 Catalog 包装器。契约测试固定原有描述、输入约束、默认值、风险等级以及不新增 annotations 的兼容边界。

## Why it matters

Agent 默认战斗工具现在与 allowlist 共用一份稳定元数据，同时战斗领域 handler 仍保持独立，后续可以继续按子域收敛注册入口。

## Demo posture / limitations

本轮是内部重构，不是 install demo、已发布版本或 GA 功能。它不改变装备选择、目标匹配、追击、攻击、返回结构或默认权限，也不代表已经完成新的游戏内战斗验收。
