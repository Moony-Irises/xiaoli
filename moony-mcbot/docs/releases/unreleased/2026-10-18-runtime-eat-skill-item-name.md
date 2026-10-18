---
type: fix
scope: runtime
audience: developer
summary: 修复进食 Skill 丢弃指定食物并误将无效参数变成自动选择的问题
breaking: false
demo_ready: false
tests:
  - npm test -- test/agent-eat-skill.test.ts test/agent-planner-integration.test.ts test/agent-tool-executors.test.ts test/eat-command-integration.test.ts test/skill-permission-audit.test.ts
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
  - npm run validate:releases
  - git diff --check
artifacts:
  - src/agent/skill-catalog.ts
  - test/agent-eat-skill.test.ts
  - test/agent-planner-integration.test.ts
  - src/agent/README.md
  - test/README.md
  - docs/skill-permission-policy.md
  - docs/manual-testing-guide.md
  - README.md
  - CLAUDE.md
  - TODO.md
---

## What changed

`eat-skill` 保留 `eat_food.params.itemName` 原值，未提供或为 undefined 时仍使用空参数自动选择食物。名称 trim、空串和错误类型拒绝由既有执行边缘负责，不转发 reason 等元数据。显式动作、旧 steps 和单个 tool 计划共用这一语义，公共接口、默认 allowlist 和 Adapter 选择规则不变。

## Why it matters

先在旧实现复现“指定熟鲑鱼变为自动选食物”以及“错误类型被丢弃后误触发进食”，再补参数与完整 MCP → 黑板 → Skill → Dispatcher → 模拟 Adapter 的回归。修复让玩家指定的食物到达客户端，错误参数明确失败，原有低饥饿自动选食物仍可用。

## Demo posture / limitations

这次不代表真实游戏中已经吃下指定食物，也不保证模型总会生成正确 itemName；权限未开放时仍会拒绝执行。缺少指定食物的原有 Adapter 错误和实际消耗待按手测指南 9.3 核验；离线测试不连接真实账号、游戏或云端 API。这不是 install demo、已发布版本或 GA。
