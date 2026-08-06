---
type: refactor
scope: runtime
audience: developer
summary: 将 Agent 核心 mine.collectVisible MCP 工具迁移到 Catalog 驱动注册
breaking: false
demo_ready: false
tests: npx tsx --test test/mcp-tool-registration.test.ts test/tool-catalog.test.ts test/client-adapter-mining.test.ts test/mining-approach.test.ts test/pathfinder-movement-profile.test.ts; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/catalog/tool-catalog.ts
  - src/catalog/README.md
  - src/tools/action-tools.ts
  - test/mcp-tool-registration.test.ts
  - docs/tool-skill-catalog-design.md
  - docs/mining-adapter-migration-design.md
  - README.md
  - TODO.md
  - CLAUDE.md
---

## What changed

将已有的 `mine.collectVisible` MCP 注册迁移到 Catalog 包装器。契约测试固定原有描述、输入约束、默认值、`destructive` 风险以及不新增 annotations 的兼容边界。

## Why it matters

Agent 默认批量采矿工具现在与 allowlist 共用稳定元数据，同时采矿执行逻辑仍由原领域 handler 所有，避免注册收敛与行为改造互相干扰。

## Demo posture / limitations

本轮是内部重构，不是 install demo、已发布版本或 GA 功能。它不改变批量采矿行为、错误语义、返回结构或默认权限，也不代表 `mine.collectVisible` 已迁移到 ClientAdapter。`mine.digNearestVisible` 仍在核心 Catalog 之外并等待既有游戏内验收。
