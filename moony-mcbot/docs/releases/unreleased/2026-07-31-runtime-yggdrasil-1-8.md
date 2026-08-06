---
type: chore
scope: runtime
audience: developer
summary: Yggdrasil 独立升级并精确固定到 1.8.0，补充无正式凭据的认证契约测试
breaking: false
demo_ready: false
tests: "npx tsx --test test/auth-service.test.ts test/bot-runtime-connection.test.ts; npm run lint; npm run typecheck; npm test; npm run build; npm audit --omit=dev --json (expected non-zero: 17 known vulnerabilities); git diff --check"
artifacts:
  - package.json
  - package-lock.json
  - test/auth-service.test.ts
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

`yggdrasil` 从 1.7.0 独立升级并精确固定为 1.8.0，没有修改 `AuthService`、认证参数、session 结构、Node engine、Mineflayer 或 MCP 契约。新增本地随机端口 HTTP 测试，使用假凭据验证自定义 authserver 路径、请求体、成功 session 映射、profile UUID 规范化、缺字段拒绝和服务端错误传播。

## Why it matters

认证依赖升级现在有直接经过 Yggdrasil 包网络编码层的回归证据，不只依赖连接层 mock。package/lockfile 比较确认无关依赖没有漂移，真实账号也不会进入自动化测试或测试产物。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA，也不增加游戏能力。Yggdrasil 1.8.0 的主要运行依赖变化是新增嵌套 `uuid@10`；该版本已停止支持并仍命中当前 `<11.1.1` advisory，因此生产审计仍为原有 17 项，不能表述为漏洞修复。真实外置 Yggdrasil 认证、session server、Minecraft spawn 和断开重连仍需按手测指南验证。
