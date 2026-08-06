---
type: fix
scope: runtime
audience: developer
summary: 修复 Social Skill 在缺少有效角度时生成无效 player.look 调用的问题
breaking: false
demo_ready: false
tests: npx tsx --test test/skill-permission-audit.test.ts; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/agent/skill-catalog.ts
  - src/agent/README.md
  - test/skill-permission-audit.test.ts
  - docs/skill-permission-policy.md
  - docs/tool-skill-catalog-design.md
  - docs/manual-testing-guide.md
  - README.md
  - TODO.md
  - CLAUDE.md
---

## What changed

`social-skill` 现在只接受成对且有限的数字 `yaw/pitch` 作为 `player.look` 参数。缺少有效角度时，`socialize` 编译为 `observe.nearbyPlayers`，`observe_target` 编译为 `observe.nearbyEntities`；回归测试覆盖缺失、部分缺失、`NaN`、`Infinity` 和真实 `deadline-recover` 输出。

## Why it matters

任务超时恢复不再把 `undefined` 角度传给未开放的转头工具，而是通过当前默认允许的只读观察能力重新获取环境信息。动作队列可以继续推进，同时不会为了修复参数问题扩大自动操作权限。

## Demo posture / limitations

本轮是分层 Agent 内部编译修复，不是 install demo、已发布版本或 GA 功能。`player.look` 仍缺 Agent dispatcher，也不在 17 项默认 allowlist；只有无角度观察降级可直接使用，真正的定向转头默认行为没有开放。
