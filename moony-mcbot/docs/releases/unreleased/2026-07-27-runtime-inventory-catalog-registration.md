---
type: refactor
scope: runtime
audience: developer
summary: 将 Agent 核心 Inventory 工具迁移到 Catalog 驱动注册
breaking: false
demo_ready: false
tests: npx tsx --test test/mcp-tool-registration.test.ts test/tool-catalog.test.ts test/hotbar-organization.test.ts; npm run typecheck; npm test; npm run build; git diff --check
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

Migrated `inventory.holdByCategory` and `inventory.organizeHotbar` to the catalog-backed MCP registration helper. The catalog now preserves their exact pre-migration MCP descriptions, while contract tests cover the category enum, invalid input and explicit `write` risk.

## Why it matters

Inventory tool metadata now has one source shared with the Agent default allowlist. Domain handlers and the hotbar organization planner remain separate from registration metadata.

## Demo posture / limitations

This is an internal refactor, not an install demo, published release or GA feature. It does not change inventory execution, schemas, responses, default permissions, titles or annotations. `inventory.holdSlot` remains outside the Agent core Catalog and on its existing registration path.
