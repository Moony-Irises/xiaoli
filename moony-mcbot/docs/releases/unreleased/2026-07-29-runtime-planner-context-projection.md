---
type: refactor
scope: runtime
audience: developer
summary: 云端 planner 改用字段白名单上下文投影，不再发送完整运行时快照
breaking: false
demo_ready: false
tests: npx tsx --test test/planner-context-projection.test.ts test/agent-tool-executors.test.ts test/mcp-tool-registration.test.ts; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/runtime/planner-context-projection.ts
  - src/tools/action-tools.ts
  - test/planner-context-projection.test.ts
  - package.json
  - README.md
  - docs/planner-context-projection-design.md
  - docs/architecture-convergence-roadmap.md
  - docs/ai-control-architecture.md
  - docs/manual-testing-guide.md
  - TODO.md
  - CLAUDE.md
---

## What changed

新增纯 planner context/memory 投影器，以字段白名单生成云端决策上下文。Agent planner 请求已移除完整 `stateSnapshot` system message，并将精确坐标、实体/任务/事件 ID、任务 params、记忆 notes 和原始事件 payload 留在本地。

## Why it matters

旧请求同时发送精简观察和完整快照，重复消耗 token，也把与当前决策无关的内部状态交给云端。新投影只保留生命、装备、距离、任务、战略目标和有限事件类型；公开状态工具及本地调试信息不受影响。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA 功能，也没有修改 MCP schema、配置结构、模型、planner 输出格式或执行器 fallback。权限类别仍作为安全决策输入发送；直接坐标目标可来自用户指令，记忆地点精确坐标继续由本地确定性规则使用。真实模型对缩减上下文的规划质量仍需按手测文档回归。
