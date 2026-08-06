---
type: refactor
scope: runtime
audience: developer
summary: 用类型安全 Catalog 派生并校验现有 17 项 Agent 默认工具集合
breaking: false
demo_ready: false
tests: npm run typecheck; npx tsx --test test/tool-catalog.test.ts
artifacts:
  - src/catalog/tool-catalog.ts
  - src/tools/action-tools.ts
  - test/tool-catalog.test.ts
  - docs/tool-skill-catalog-design.md
  - README.md
  - TODO.md
  - CLAUDE.md
---

## What changed

Added a typed metadata catalog for the existing 17 default Agent tools and changed new Agent configuration to derive `allowedTools` from that catalog. Catalog validation rejects duplicate IDs, duplicate audiences and invalid default Agent exposure. Persisted custom allowlists retain unknown values, ordering and explicit empty arrays.

## Why it matters

The default tool policy no longer duplicates a raw string list inside Agent configuration. Tool identity, display metadata, domain and risk can now be reused and validated before MCP registration is migrated incrementally.

## Demo posture / limitations

This is an internal metadata refactor, not an install demo, published release or GA feature. It does not change MCP tool registration, schemas, handlers, Web actions or the existing 17-tool default permission set. Four pre-existing Skill Catalog targets remain outside the default allowlist and are intentionally not enabled by this change.
