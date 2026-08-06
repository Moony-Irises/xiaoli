---
type: refactor
scope: runtime
audience: developer
summary: 将 Agent 核心 Interaction MCP 工具迁移到 Catalog 驱动注册
breaking: false
demo_ready: false
tests: npx tsx --test test/mcp-tool-registration.test.ts test/tool-catalog.test.ts test/client-adapter-conformance.test.ts test/client-adapter-status.test.ts; npm run typecheck; npm test; npm run build; git diff --check
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

Migrated `interact.dropHeld`, `interact.dropHotbarSlot`, and `interact.openDoor` to the catalog-backed MCP registration helper. Contract tests preserve drop modes, hotbar slot boundaries, restore behavior, door ranges and explicit catalog risks.

## Why it matters

Interaction metadata now shares the Agent allowlist source while destructive and write classifications remain explicit. Domain handlers and Adapter execution stay outside the catalog.

## Demo posture / limitations

This is an internal refactor, not an install demo, published release or GA feature. It does not change interaction behavior, schemas, responses, permissions, titles or MCP annotations. Catalog risk labels do not add a new client confirmation flow in this change.
