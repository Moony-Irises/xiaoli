---
type: refactor
scope: runtime
audience: developer
summary: 将 Agent 核心目录内剩余只读观察工具迁移到 Catalog 驱动注册
breaking: false
demo_ready: false
tests: npx tsx --test test/mcp-tool-registration.test.ts test/tool-catalog.test.ts; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/catalog/tool-catalog.ts
  - src/catalog/mcp-tool-registration.ts
  - src/catalog/README.md
  - src/tools/action-tools.ts
  - test/mcp-tool-registration.test.ts
  - docs/tool-skill-catalog-design.md
  - README.md
  - TODO.md
  - CLAUDE.md
---

## What changed

Migrated `observe.nearbyPlayers`, `observe.nearbyEntities`, and `observe.inventory` to the same catalog-backed MCP registration helper already used by `observe.self`. Catalog descriptions now preserve the exact pre-migration MCP descriptions, and registration tests cover each tool's Zod defaults and invalid inputs.

## Why it matters

The Agent core observe domain now has one metadata source without moving business handlers into the catalog. This removes repeated tool names and descriptions while retaining the existing SDK v1 registration contract.

## Demo posture / limitations

This is an internal refactor, not an install demo, published release or GA feature. It does not change tool names, schemas, handlers, responses, titles, annotations or default permissions. `observe.blocks` remains outside the current Agent core Catalog, and write/destructive domains are not migrated here.
