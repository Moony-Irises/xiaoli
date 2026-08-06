---
type: refactor
scope: runtime
audience: developer
summary: 将现有 Agent 核心 Chat MCP 工具迁移到 Catalog 驱动注册
breaking: false
demo_ready: false
tests: npx tsx --test test/mcp-tool-registration.test.ts test/tool-catalog.test.ts test/client-adapter-status.test.ts test/client-adapter-conformance.test.ts; npm run typecheck; npm test; npm run build; git diff --check
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

Migrated the existing `chat.send` MCP registration to the catalog-backed helper. Contract tests preserve optional trimmed bot selection, required non-empty messages, the explicit `write` risk and the absence of added registration annotations.

## Why it matters

The default Agent chat tool now shares metadata with its allowlist entry without moving send behavior into the catalog. Documentation now distinguishes internal TPA execution from actual MCP exposure.

## Demo posture / limitations

This is an internal refactor, not an install demo, published release or GA feature. It does not change message sending, responses, permissions, titles or annotations. `chat.requestTeleportToPlayer` remains internal, while `chat.sendVerified` remains outside the Agent core Catalog and on its existing registration path.
