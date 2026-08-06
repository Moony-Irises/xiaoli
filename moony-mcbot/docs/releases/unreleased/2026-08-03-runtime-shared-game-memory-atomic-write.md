---
type: fix
scope: runtime
audience: developer
summary: 共享玩家与地点记忆改用统一原子 JSON 写入器并清理失败临时文件
breaking: false
demo_ready: false
tests:
  - npx tsx --test test/shared-game-memory-store.test.ts test/atomic-json-file.test.ts
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/memory/game-memory-store.ts
  - src/runtime/atomic-json-file.ts
  - test/shared-game-memory-store.test.ts
  - docs/persistence-lifecycle-design.md
---

## What changed

`SharedGameMemoryStore` 删除独立的弱临时写入实现，`players.json` 与 `places.json` 改为复用 `writeJsonAtomic`。新增回归测试，确认最终 rename 失败时会关闭句柄并删除同目录临时文件。

## Why it matters

共享游戏记忆现在与配置、聊天摘要状态使用同一套先序列化、排他创建临时文件、写入同步、关闭、rename 和失败清理边界，避免替换失败后持续堆积残留文件。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。改动不修改共享记忆目录、`version: 1` schema、归一化、按 `updatedAt` 合并或公共 API；原子 writer 不提供并发冲突解决或业务顺序，上层持久化队列仍是 McBot 快照顺序的所有者。
