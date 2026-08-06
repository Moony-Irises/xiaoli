---
type: docs
scope: docs
audience: developer
summary: 定义云端 planner 的字段白名单上下文投影与隐私边界
breaking: false
demo_ready: false
tests: git diff --check
artifacts:
  - docs/planner-context-projection-design.md
  - README.md
  - TODO.md
  - CLAUDE.md
---

## What changed

新增云端 planner 上下文投影设计，明确完整本地快照与云端规划 payload 的边界，并定义自身、世界、玩家、实体、任务、事件和记忆的字段白名单、数量上限及缺失字段行为。

## Why it matters

当前 planner 请求会附带完整 `agent.stateSnapshot`，使绝对坐标、实体 ID、notes 和内部事件 payload 默认进入云端模型。先固化白名单契约可以保证未来新增本地状态字段时不会自动扩大外发范围，也为后续纯函数测试提供稳定规格。

## Demo posture / limitations

本轮仅完成设计，不是 install demo、已发布版本或 GA 功能。运行代码和 planner 请求体尚未改变，现有完整状态仍会被发送；必须在后续测试与实现任务完成后，才算真正建立云端数据最小化边界。
