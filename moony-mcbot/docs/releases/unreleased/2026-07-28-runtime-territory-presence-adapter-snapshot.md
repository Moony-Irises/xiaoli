---
type: refactor
scope: runtime
audience: developer
summary: 领地入侵检测改由 Adapter 玩家快照驱动
breaking: false
demo_ready: false
tests: npx tsx --test test/territory-presence.test.ts test/duel-session.test.ts test/client-adapter-status.test.ts; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/runtime/territory-presence.ts
  - src/tools/action-tools.ts
  - test/territory-presence.test.ts
  - package.json
  - README.md
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
  - TODO.md
  - CLAUDE.md
---

## What changed

新增纯领地 presence 决策器，根据 Adapter `PlayerSnapshot` 和 remembered places 选择最近入侵者、计算全部活跃 presence key，并判断主人是否满足领地升级策略。领地运行时不再遍历原生 Mineflayer `bot.players` 或构造原生坐标，升级战斗继续交给现有稳定实体 ID 决斗链。

## Why it matters

入侵者选择和主人在场判断属于高层领地策略，不应绑定 Mineflayer 玩家对象。迁移后 Mineflayer 与未来 Modded Client Bridge 可以提供同一种玩家快照，无效实体 ID、缺失坐标和非有限坐标会在进入警告/战斗状态前被安全忽略。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA 功能。没有修改 MCP、配置或 `ClientAdapter` 公共契约；警告冷却、领地半径、升级延迟、presence key 格式和事件文案保持不变。真实服务器上的多人进入/离开、冷却重入和两种 owner policy 仍需按手测文档验证，本轮不代表容器或领地方块扫描已脱离 Mineflayer。
