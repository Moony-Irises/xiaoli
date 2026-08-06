---
type: refactor
scope: runtime
audience: developer
summary: chat-configs 文件读取、校验、串行原子写入和 flush 收口到独立 ConfigRepository
breaking: false
demo_ready: false
tests:
  - npm test -- test/persisted-chat-config-repository.test.ts test/chat-config-reload.test.ts test/runtime-shutdown-lifecycle.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/config/persisted-chat-config-repository.ts
  - src/config/README.md
  - src/tools/action-tools.ts
  - test/persisted-chat-config-repository.test.ts
  - docs/persistence-lifecycle-design.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
---

## What changed

新增 `PersistedChatConfigRepository`，统一负责 `chat-configs.json` 的 UTF-8 读取、现有 Zod parser 调用、串行原子写入和动态 queue drain。`action-tools` 改为委托该仓库，并保留原有写失败日志后继续后续快照的行为。测试覆盖正常读取、允许/拒绝缺文件、非法文档、串行写入、写失败恢复和 flush 期间追加写入。

## Why it matters

配置文件生命周期不再与聊天、Agent、自保和领地的运行时状态编排混在同一个超大模块中。这为后续按状态所有权迁移运行时配置 Map 和事务 commit 建立了可独立测试的第一层边界，同时 shutdown 仍能等待 drain 期间新追加的尾部写入。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。它不修改默认配置路径、无版本 JSON schema、MCP/Web 返回、环境覆盖顺序、API key 运行时处理或热重载 commit；四类运行时配置 Map 和删除 cleanup 仍在 `action-tools`，因此不代表 ConfigRepository 或阶段 C 已全部完成。
