---
type: refactor
scope: runtime
audience: developer
summary: salient 感知的附近玩家与重要实体改由 Adapter 快照投影
breaking: false
demo_ready: false
tests: npx tsx --test test/salient-perception.test.ts test/client-adapter-conformance.test.ts; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/runtime/salient-perception.ts
  - src/tools/action-tools.ts
  - test/salient-perception.test.ts
  - package.json
  - README.md
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
  - TODO.md
  - CLAUDE.md
---

## What changed

新增纯 salient actor 投影器，根据 Adapter `PlayerSnapshot` / `EntitySnapshot` 生成附近玩家关系和重要实体列表。`perception.salient` 与 Agent state snapshot 现在共用该逻辑；原生附近实体摘要 helper 已删除。

## Why it matters

高层感知不应依赖 Mineflayer 的原生玩家和实体表。迁移后白名单关系、距离排序、数量上限及 creeper、zombie、skeleton、boat、minecart、wolf 等既有关键词可以离线验证，也能供未来 Modded Client Adapter 复用。缺少有限距离或坐标的快照会被安全忽略。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA 功能。没有修改 MCP schema、返回字段、默认 allowlist 或 `ClientAdapter` 公共契约；玩家上限 4、候选实体上限 12、重要实体上限 6 和半径语义保持不变。箱子、门、工作台等可交互方块扫描及精确 focus 仍依赖 Mineflayer，真实服务器输出仍需按手测文档验证。
