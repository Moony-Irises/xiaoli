---
type: chore
scope: runtime
audience: developer
summary: 统一 Node 22+ 运行时契约，并精确锁定当前已验证的 Mineflayer 4.35.0
breaking: true
demo_ready: false
tests: "npx tsx --test test/quality-gates.test.ts; npm run lint; npm run typecheck; npm test; npm run build; npm audit --omit=dev --json (expected non-zero: 17 known vulnerabilities); git diff --check"
artifacts:
  - package.json
  - package-lock.json
  - .nvmrc
  - ../.github/workflows/moony-mcbot-ci.yml
  - test/quality-gates.test.ts
  - README.md
  - CLAUDE.md
  - TODO.md
  - docs/tech-stack-architecture.md
  - docs/lint-ci-design.md
  - docs/project-audit-2026-07-31.md
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
---

## What changed

项目最低运行时从 Node 20 提升到 Node 22，新增 `.nvmrc`，并将 GitHub CI 改为 Node 22/24 LTS 矩阵。Mineflayer 从宽松的 `^4.33.0` 声明改为精确的 4.35.0；该版本已经存在于变更前的 lockfile 和本地依赖树中，因此本轮没有刷新 Mineflayer 或其他传递依赖。新增质量门禁，约束 manifest、lockfile、本地版本文件和 CI 不再出现互相矛盾的运行时声明。

## Why it matters

Node 20 已 EOL，而 Mineflayer 4.33/4.35 和当前 minecraft-protocol 1.64 都明确要求 Node 22+。统一最低版本可避免 Node 20 CI 在 `npm ci` 时只产生 engine 警告却继续运行，也防止未来普通安装因宽松 semver 范围静默引入尚未验收的 Mineflayer 版本。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA，也不增加游戏能力。它会中断 Node 20 环境，因此明确标记为 breaking；使用者需要先升级到 Node 22 或更高版本。Mineflayer 仍停在 4.35.0，没有升级到 4.37.x；真实 Yggdrasil 登录、Minecraft spawn、跟随、寻路、背包、实体事件和断线重连仍需按手测指南验证。生产依赖审计仍为既有 17 项，不能描述为安全修复。
