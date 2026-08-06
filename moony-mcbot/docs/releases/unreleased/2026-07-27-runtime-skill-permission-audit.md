---
type: refactor
scope: runtime
audience: developer
summary: 为 Skill Catalog 增加显式工具依赖和默认权限缺口审计
breaking: false
demo_ready: false
tests: npx tsx --test test/skill-permission-audit.test.ts test/tool-catalog.test.ts; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/agent/types.ts
  - src/agent/skill-catalog.ts
  - src/agent/README.md
  - test/skill-permission-audit.test.ts
  - package.json
  - docs/skill-permission-policy.md
  - docs/tool-skill-catalog-design.md
  - README.md
  - TODO.md
  - CLAUDE.md
---

## What changed

每个默认 Skill Module 现在声明 `toolDependencies`，并提供纯权限审计函数。新增测试覆盖所有编译分支，并固定当前四项默认 allowlist 缺口。

## Why it matters

项目现在可以区分“存在 MCP 工具”和“Agent 自动执行链已经安全可用”，避免只修改 allowlist 后才在运行时发现 dispatcher 或参数语义缺失。

## Demo posture / limitations

本轮是内部审计重构，不是 install demo、已发布版本或 GA 功能。默认工具仍为原有 17 项，Planner 暴露和运行时拒绝行为不变；四项缺口均未开放，也未补充其 Agent dispatcher。
