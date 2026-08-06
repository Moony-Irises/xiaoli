---
type: refactor
scope: runtime
audience: developer
summary: 聊天监听运行时配置状态和持久化投影收口到独立 ConfigStore
breaking: false
demo_ready: false
tests:
  - npm test -- test/chat-listener-config-store.test.ts test/chat-config-reload.test.ts test/local-env.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/config/chat-listener-config-store.ts
  - src/config/README.md
  - src/tools/action-tools.ts
  - test/chat-listener-config-store.test.ts
  - docs/persistence-lifecycle-design.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
---

## What changed

新增 `ChatListenerConfigStore`，统一拥有聊天监听配置的类型、默认值、运行时 Map、持久化 replace/delete 和深拷贝投影。`action-tools` 改为通过该 Store 读取和更新 `chatByBotId`，同时移除原模块中的重复默认值及序列化/反序列化实现。测试锁定多 Bot 默认隔离、旧配置归一化、显式空数组、缺省字段、深拷贝和删除检测。

## Why it matters

聊天监听配置现在有了可独立测试的状态所有者，不再要求通过超大编排模块间接验证默认值和持久化语义。这为按单一状态集合继续迁移 AI、Agent 与 self-guard 配置建立了重复使用的边界，同时避免一次性重写四表 commit。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。它不修改 MCP/Web 工具名、输入输出、`chat-configs.json` 路径或字段、环境覆盖顺序、listener 生命周期和游戏行为。AI、Agent、self-guard 三类运行时配置及四表同步 commit 仍在 `action-tools`，因此不代表 ConfigRepository 或阶段 C 已全部完成。
