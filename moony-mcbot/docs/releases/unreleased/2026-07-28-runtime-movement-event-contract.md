---
type: docs
scope: runtime
audience: developer
summary: 定义首轮成功后持续路径失败的关联事件契约和实现边界
breaking: false
demo_ready: false
tests: git diff --check
artifacts:
  - docs/movement-event-contract-design.md
  - docs/architecture-convergence-roadmap.md
  - TODO.md
  - CLAUDE.md
---

## What changed

新增持续移动事件契约设计，定义可选 `movementId`、`movement_failed` 事件、首轮与持续阶段的错误边界、监听生命周期、Runtime 证据和上层任务关联方式。TODO 已拆成可逐项验证的实现步骤。

## Why it matters

Mineflayer 的 `path_update` 不携带上层任务身份。没有关联 ID 时，频繁重规划的跟随或决斗可能把旧目标的迟到失败错误地应用到新任务。先固定契约可以避免在 Adapter、Runtime 和编排层分别发明不兼容的处理方式。

## Demo posture / limitations

本轮仅完成设计，不是 install demo、已发布版本或 GA 功能。运行时代码和公共接口尚未修改，首轮成功后再次失路仍不会通知上层；必须在用户确认 additive 契约后才开始实现。
