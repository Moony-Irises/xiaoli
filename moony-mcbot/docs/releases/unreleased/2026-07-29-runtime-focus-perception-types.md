---
type: refactor
scope: runtime
audience: developer
summary: 抽取可离线测试的准星实体聚焦选择器并收窄 Mineflayer focus 类型
breaking: false
demo_ready: false
tests: npx tsx --test test/focus-perception.test.ts test/dynamic-ai-state.test.ts test/salient-perception.test.ts test/mcp-tool-registration.test.ts; npm run lint; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/runtime/focus-perception.ts
  - src/runtime/README.md
  - src/tools/action-tools.ts
  - test/focus-perception.test.ts
  - package.json
  - docs/manual-testing-guide.md
  - docs/architecture-convergence-roadmap.md
  - TODO.md
  - CLAUDE.md
---

## What changed

将第一人称准星实体选择中的视锥判断、距离限制、方块遮挡容差和候选评分抽成纯 runtime 选择器，并增加边界回归测试。`perception.focus`、AI 动态状态和 salient 方块扫描路径改用 Mineflayer Bot 与明确快照类型，删除该段 9 处显式 `any` 文本命中。

## Why it matters

精确实体 focus 原先完全嵌在巨型工具文件和动态对象里，必须连接游戏才能验证。现在核心选择语义可以离线复现，也为未来把实体/方块采集接到 Modded Client Adapter capability 保留了稳定的纯逻辑边界。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA，不改变 MCP 工具名、输入 schema、输出字段、评分阈值或实体优先于方块的现有行为。实体和方块候选仍由 Mineflayer 提供；本轮没有新增公共 Adapter capability，也没有宣称真实服务器视觉回归已经完成。
