---
type: feature
scope: runtime
audience: developer
summary: 增加零破坏单块采矿 Adapter，并迁移 mine.digNearestVisible 作为首个试点
breaking: false
demo_ready: false
tests: npm run typecheck; npm run build; npx tsx --test test/client-adapter-mining.test.ts test/mining-approach.test.ts test/client-adapter-conformance.test.ts test/client-adapter-status.test.ts test/pathfinder-movement-profile.test.ts
artifacts:
  - src/runtime/client-adapter.ts
  - src/runtime/bot-runtime.ts
  - src/runtime/mineflayer-adapter.ts
  - src/runtime/mineflayer-mining.ts
  - src/runtime/mining-approach.ts
  - src/runtime/pathfinder-movement-profile.ts
  - src/tools/action-tools.ts
  - test/client-adapter-mining.test.ts
  - test/mining-approach.test.ts
  - test/pathfinder-movement-profile.test.ts
---

## What changed

Added the additive `mine_block` capability and `ClientAdapter.mineBlock()` action. The Mineflayer implementation approaches one selected block with the zero-destruction movement profile, rejects missing or changed targets, checks visibility and dig reach, equips the best available tool, digs once, and records a structured result in Adapter action history. `mine.digNearestVisible` now delegates its execution phase to this action and reports one “我跟不上你啦” message when safe approach fails. The legacy `mining` profile name is retained, but it now receives the same no-dig/no-build movement restrictions.

## Why it matters

Mining no longer requires the pilot MCP path to manipulate Mineflayer pathfinder, inventory and block actions directly. Structured outcomes preserve actionable evidence while the movement policy prevents ordinary approach planning from digging or placing route blocks.

## Demo posture / limitations

This is not an install demo, published release or GA capability. Offline tests do not prove real-server pathfinding behavior. Only `mine.digNearestVisible` uses the new action; batch MCP mining, Agent collection and player-nearby cleanup remain on their legacy paths until the documented game regression passes.
