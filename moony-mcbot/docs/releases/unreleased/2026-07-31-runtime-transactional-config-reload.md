---
type: fix
scope: runtime
audience: developer
summary: 配置热重载改为先完整校验再事务提交，并正确删除文件中消失的条目
breaking: false
demo_ready: false
tests: npx tsx --test test/chat-config-reload.test.ts; npm run lint; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/config/persisted-chat-config.ts
  - src/config/README.md
  - src/tools/action-tools.ts
  - test/chat-config-reload.test.ts
  - package.json
  - README.md
  - CLAUDE.md
  - TODO.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
  - docs/persistence-lifecycle-design.md
  - docs/manual-testing-guide.md
---

## What changed

`chat.config.reload` 现在先用独立 Zod schema 完整解析当前无版本的 `chat-configs.json`，再同步重建 chat、AI、Agent 和 self-guard 配置。损坏或缺失文件不会修改旧状态；成功提交会删除文件中消失的条目及 Agent 持久化派生状态，并新增 `removedCounts`。存续条目的运行时 API key、聊天历史和请求诊断继续保留，环境覆盖在提交后重新应用。

## Why it matters

旧实现会吞掉读取/解析错误却返回 `reloaded: true`，还会让已经从文件删除的 Bot 配置继续运行。新的边界让后台成功状态、内存状态和磁盘内容可以相互验证，同时不把运行时秘密写回配置文件。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA。配置文件仍没有顶层 schema version；额外字段继续兼容，但未来迁移需要单独设计版本分派。离线测试覆盖事务和 MCP 响应边界，真实服务器上 listener、Agent executor 与 self-guard 的重协调仍保留在手测清单中。
