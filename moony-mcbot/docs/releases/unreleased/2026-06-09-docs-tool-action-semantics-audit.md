---
type: docs
scope: docs
audience: developer
summary: 澄清 interact.swing 对应摆臂动画而不是 Java 版社交挥手
breaking: false
demo_ready: false
tests:
  - cmd /c npm run build
artifacts:
  - docs/ai-control-architecture.md
  - docs/releases/unreleased/2026-06-09-runtime-adapter-interact-swing.md
---

## What changed

修正 `interact.swing` 的中文语义说明：它对应 `bot.swingArm()`，也就是客户端攻击/使用时的手臂摆动动画，不是 Minecraft Java 版里独立存在的社交“挥手”动作。

同时更新架构文档中“交互类”示例，避免把摆臂动画描述成真实玩法动作。

## Why it matters

工具命名和测试说明必须贴近 Minecraft Java 版实际可见行为。把 `swingArm()` 误说成“挥手”会让测试预期偏掉，也会影响后续 adapter 能力设计。

## Demo posture / limitations

这次是文档和语义澄清，不改变工具实现。`interact.swing` 仍会触发手臂摆动动画；是否表现为攻击、破坏或使用效果取决于上下文和后续具体工具。
