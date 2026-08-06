---
type: chore
scope: runtime
audience: developer
summary: MCP SDK 独立升级并精确固定到 1.30.0，补充协议层兼容回归
breaking: false
demo_ready: false
tests: "npx tsx --test test/mcp-tool-registration.test.ts test/chat-config-reload.test.ts; npm run lint; npm run typecheck; npm test; npm run build; npm audit --omit=dev --json (expected non-zero: 17 known vulnerabilities); git diff --check"
artifacts:
  - package.json
  - package-lock.json
  - test/mcp-tool-registration.test.ts
  - README.md
  - CLAUDE.md
  - TODO.md
  - docs/lint-ci-design.md
  - docs/project-audit-2026-07-31.md
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
---

## What changed

`@modelcontextprotocol/sdk` 从 lockfile 中的 1.27.1 独立升级并精确固定为 1.30.0，没有修改 MCP 工具名、输入 schema、stdio 入口、Node engine 或 Minecraft 依赖。新增 SDK Client、内存 Transport 与 McpServer 的协议测试，验证项目 Catalog 注册工具可以被发现、调用并通过 SDK 响应 schema 校验。

## Why it matters

依赖升级现在有独立的协议兼容证据，不只依赖注册表内部字段。精确版本也避免后续安装在未复测时自动漂移到新的 SDK minor；Yggdrasil、Mineflayer 和 Node 运行时基线可以继续作为彼此独立的兼容决策处理。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA，也不增加游戏能力。升级后的生产依赖审计仍是原有 17 项，不能表述为漏洞修复；外部 stdio 客户端、真实 Yggdrasil 登录、Minecraft spawn、寻路和游戏内动作仍未在本轮验证。当前 lockfile 的 Mineflayer 4.35.0 要求 Node 22，而项目 manifest/CI 仍以 Node 20 为基线，该契约冲突尚未解决。
