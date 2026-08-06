---
type: refactor
scope: runtime
audience: developer
summary: 将现有 Agent 核心 Movement MCP 工具迁移到 Catalog 驱动注册
breaking: false
demo_ready: false
tests: npx tsx --test test/mcp-tool-registration.test.ts test/tool-catalog.test.ts test/follow-session.test.ts test/position-movement.test.ts; npm run typecheck; npm test; npm run build; git diff --check
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

Migrated the existing `move.followPlayer` and `move.stopFollow` MCP registrations to the catalog-backed helper. Contract tests preserve follow distance, tick and still-target defaults, optional sprint input, explicit `write` risk and stop validation.

## Why it matters

Movement metadata now follows the same source as the Agent allowlist without moving the follow state machine or pathfinding implementation into the catalog. The documentation also distinguishes Catalog membership from MCP exposure.

## Demo posture / limitations

This is an internal refactor, not an install demo, published release or GA feature. It does not change movement behavior, schemas, responses, permissions, titles or annotations. `move.goToPosition` remains an Agent/Web execution ID and is not introduced as a new MCP tool.
