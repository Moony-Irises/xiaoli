---
type: refactor
scope: runtime
audience: developer
summary: 删除 action-tools 中 7 处未使用符号并恢复文件级未使用检查
breaking: false
demo_ready: false
tests: npx eslint src/tools/action-tools.ts --max-warnings=0; npm run lint; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/tools/action-tools.ts
  - eslint.config.js
  - docs/lint-ci-design.md
  - docs/architecture-convergence-roadmap.md
  - TODO.md
  - CLAUDE.md
---

## What changed

删除一个未使用 import、三个无调用方 helper、一个无读取局部变量和两个旧回调式丢弃包装器。`action-tools.ts` 的 ESLint 文件级覆盖不再关闭 `@typescript-eslint/no-unused-vars`，后续新增死代码会使 lint 失败。

## Why it matters

此前巨型兼容文件同时豁免 `any` 与未使用符号，使普通死代码也会被隐藏。把两类债务拆开后，现有行为继续保留，而未使用代码检查重新成为可执行质量门槛。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA，不新增或改变任何游戏行为、MCP 工具、输入 schema、返回结构或默认权限。`action-tools.ts` 仍有 99 处旧 Mineflayer/容器/战斗兼容 `any`，本轮没有为追求零诊断而批量重写这些边界。
