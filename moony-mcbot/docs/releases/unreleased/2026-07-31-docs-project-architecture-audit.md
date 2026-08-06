---
type: docs
scope: docs
audience: developer
summary: 通读项目并记录运行安全、架构收敛、测试与依赖风险的优先级审计
breaking: false
demo_ready: false
tests: npm run lint; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - docs/project-audit-2026-07-31.md
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
  - README.md
  - CLAUDE.md
  - TODO.md
---

## What changed

新增全项目审计报告，覆盖启动与退出、配置热重载、多 bot 聊天记忆、ClientAdapter、动作入口、Agent、Web/MCP、测试、依赖和文档规模，并把发现按 P0-P2 排序。路线图、手测指南和项目索引同步指向同一份审计基线。

## Why it matters

项目已经拥有大量可工作的局部能力，但运行安全问题、旧编排层和多个控制入口混在一起时，很容易继续增加功能却无法判断真实状态。明确修复顺序可以保护现有安全寻路与状态投影成果，并为整合包 Bridge 建立可验收门槛。

## Demo posture / limitations

本轮只是开发者审计和规划收敛，不是 install demo、已发布版本或 GA；没有修改运行行为，也没有完成真实 Minecraft 登录、动作、重连或整合包客户端验证。依赖告警记录自本地 npm 审计，升级仍需分链回归。
