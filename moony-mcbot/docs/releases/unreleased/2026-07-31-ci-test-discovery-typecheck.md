---
type: test
scope: ci
audience: developer
summary: 默认测试改为自动发现，并把全部测试文件纳入严格 TypeScript 检查
breaking: false
demo_ready: false
tests: npx tsx --test test/quality-gates.test.ts; npm run typecheck:test; npm run lint; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - package.json
  - tsconfig.test.json
  - test/quality-gates.test.ts
  - test/client-adapter-entity-actions.test.ts
  - test/client-adapter-mining.test.ts
  - test/client-adapter-status.test.ts
  - test/mcp-tool-registration.test.ts
  - test/skill-permission-audit.test.ts
  - README.md
  - CLAUDE.md
  - TODO.md
  - docs/lint-ci-design.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
---

## What changed

`npm test` 从手工枚举测试文件改为 `tsx --test` 自动发现。新增独立 `tsconfig.test.json` 和源码/测试双 typecheck 脚本，并用质量门禁测试固定命令与覆盖范围。首次测试类型检查暴露出的测试夹具收窄、MCP schema 联合类型和过期事件字段已做最小修正。

## Why it matters

新增 `*.test.ts` 不会再因为忘记修改 `package.json` 而被默认测试漏掉，测试代码也不再只经过无类型检查的运行时转译。生产构建配置保持不变，CI 仍使用同一个 `npm run typecheck` 入口。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA，也不增加游戏能力。门禁只覆盖离线静态检查和自动测试发现；真实 Yggdrasil 登录、Minecraft spawn、断线重连及游戏内动作仍需要手动回归。
