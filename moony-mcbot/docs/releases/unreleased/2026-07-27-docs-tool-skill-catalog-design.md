---
type: docs
scope: docs
audience: developer
summary: 定义 metadata-first Tool/Skill Catalog 的边界、兼容策略和分阶段验收条件
breaking: false
demo_ready: false
tests: git diff --check
artifacts:
  - docs/tool-skill-catalog-design.md
  - docs/architecture-convergence-roadmap.md
  - TODO.md
  - CLAUDE.md
---

## What changed

Documented a staged Tool/Skill Catalog convergence plan. The first phase catalogs only the 17 default Agent tools, derives the new-bot allowlist, validates SkillInvocation targets, and leaves domain schemas and handlers in their existing modules.

## Why it matters

MCP registration, Agent policy and skill compilation currently repeat tool IDs in separate files. A metadata-first catalog catches drift without creating a central module that owns every behavior or forcing unrelated Web and Adapter identifiers into one namespace.

## Demo posture / limitations

This is design-only. It does not change MCP registration, tool exposure, Agent behavior, Web actions, SDK versions, install-demo status, publication status or GA readiness. Implementation requires confirmation and a separate tested changeset.
