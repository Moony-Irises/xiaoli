---
type: refactor
scope: runtime
audience: developer
summary: 将 observe.self 作为首个 Catalog 驱动的只读 MCP 注册试点
breaking: false
demo_ready: false
tests: npm run typecheck; npx tsx --test test/mcp-tool-registration.test.ts test/tool-catalog.test.ts; npm test; npm run build; git diff --check
artifacts:
  - src/catalog/mcp-tool-registration.ts
  - src/catalog/tool-catalog.ts
  - src/tools/action-tools.ts
  - test/mcp-tool-registration.test.ts
  - test/tool-catalog.test.ts
  - docs/tool-skill-catalog-design.md
  - README.md
  - TODO.md
  - CLAUDE.md
---

## What changed

Added a thin catalog-backed MCP registration helper and migrated only `observe.self` to use it. The helper reads the canonical tool name and description from the Agent core catalog while retaining the SDK v1 `server.tool(name, description, shape, handler)` registration path.

## Why it matters

This proves one tool can consume shared catalog metadata without moving its business handler into the catalog or rewriting all MCP registrations at once. The registration test checks the final SDK object instead of assuming the SDK stores raw Zod shapes unchanged.

## Demo posture / limitations

This is an internal registration refactor, not an install demo, published release or GA feature. It does not change the `observe.self` name, input constraints, handler, response, title or annotations. Other observe tools and all write/destructive tools remain on their existing registration paths.
