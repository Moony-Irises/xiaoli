---
type: refactor
scope: runtime
audience: developer
summary: 空闲白名单社交目标改由 Adapter 玩家快照选择
breaking: false
demo_ready: false
tests: npx tsx --test test/idle-social-policy.test.ts test/idle-follow-policy.test.ts test/client-adapter-status.test.ts; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/runtime/idle-social-policy.ts
  - src/tools/action-tools.ts
  - test/idle-social-policy.test.ts
  - package.json
  - README.md
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
  - TODO.md
  - CLAUDE.md
---

## What changed

新增纯空闲社交目标选择器，根据 Adapter `PlayerSnapshot`、白名单和玩家记忆计算 relation、标签、最近活跃度及距离评分。`performIdleSocialize()` 不再通过原生 `bot.players` 选择候选；最终按世界坐标 `lookAt` 暂时保留在 Mineflayer 兼容边界，目标消失会进入现有任务失败链。

## Why it matters

社交对象优先级属于高层策略，不应依赖 Mineflayer 玩家对象。迁移后候选选择可以离线验证，也能供未来 Modded Client Bridge 复用；无有限距离、无有效坐标、范围外和非白名单快照会在创建任务前被忽略。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA 功能。没有修改 MCP、配置、默认 allowlist 或 `ClientAdapter` 公共契约；距离上限、最低冷却、alias 称呼和场景台词保持不变。当前 Adapter 尚无按世界坐标观察能力，因此实际转头仍依赖 Mineflayer，真实多人目标优先级与目标消失行为仍需按手测文档验证。
