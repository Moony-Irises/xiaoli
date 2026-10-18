---
type: docs
scope: docs
audience: developer
summary: 将测试文档重排为从本地启动开始的单一入口并增加分类索引
breaking: false
demo_ready: false
tests:
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
  - PowerShell Markdown local link check (27 files)
  - git diff --check
artifacts:
  - docs/manual-testing-guide.md
  - docs/README.md
  - docs/agent-acceptance-scenarios.md
  - docs/agent-core-chain-checklist.md
  - docs/tech-stack-architecture.md
  - README.md
  - CLAUDE.md
  - TODO.md
---

## What changed

手动测试指南新增从 `.env.local`、启动脚本、Web 健康检查、无游戏画面冒烟到游戏内安全冒烟的最短路径，并把完整积压清单折叠为按需内容。新增 `docs/README.md` 分类索引；旧 Agent 验收、核心链清单和早期登录技术栈正文收敛为指向当前文档的兼容入口。

## Why it matters

测试者不再需要先理解 MCP Inspector、历史架构或数十项专项回归才能启动项目。根 README、CLAUDE 和文档索引现在都指向同一个测试入口，旧链接仍可解释地跳转，不会继续维护多套互相漂移的通过标准。

## Demo posture / limitations

本轮只调整文档信息架构，不是 install demo、尚未发布，也不是 GA。没有改变启动脚本、环境变量、MCP/Web/Agent 契约或游戏行为；真实 Yggdrasil、Minecraft 服务器和游戏动作仍需按手动测试指南执行，兼容入口文件暂时保留以避免历史 release entry 和外部链接失效。
