---
type: docs
scope: docs
audience: developer
summary: 统一安全跟随失败与恢复的验收步骤及后台证据
breaking: false
demo_ready: false
tests:
  - npm test -- test/pathfinder-movement-profile.test.ts test/client-adapter-entity-actions.test.ts test/client-adapter-status.test.ts test/follow-session.test.ts test/follow-session-lifecycle.test.ts test/movement-event-routing.test.ts test/stop-follow-command-integration.test.ts
  - npm run validate:releases
  - git diff --check
artifacts:
  - docs/manual-testing-guide.md
  - src/runtime/README.md
  - README.md
  - CLAUDE.md
  - TODO.md
---

## What changed

删除手测指南中 Pathfinder 不可用时跳跃前进的旧说明，补上停止后重新启动跟随的冒烟步骤。第 6.4 节集中说明可达、首轮不可达、途中封路、停止与恢复；区分首轮 Promise 错误、途中关联移动事件及面板可见的 Adapter 失败记录。

## Why it matters

避免把未启动跟随、目标不在加载范围、距离超限或静止超时当成寻路失败，也不再要求每个失败都出现内部 movement_failed 或 movementId 字段。测试流程使用现有人工工具，不依赖模型 API，并将一次告知限定于单次跟随会话。

## Demo posture / limitations

这次不代表跟随实现或公共接口发生变更，也不代表已完成真实服务器验收。原有安全路径、状态和事件测试作为文档依据；实际绕障、封路、聊天回显与恢复仍需按指南人工验证。工具元数据中的旧 steering fallback 描述另记 TODO，本轮未修改。不是 install demo、已发布版本或 GA。
