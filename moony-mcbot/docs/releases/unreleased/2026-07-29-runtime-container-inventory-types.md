---
type: refactor
scope: runtime
audience: developer
summary: 抽取类型安全的容器物品投影边界并收窄记忆容器路径中的 Mineflayer any
breaking: false
demo_ready: false
tests: npx tsx --test test/container-inventory.test.ts test/mcp-tool-registration.test.ts test/client-adapter-conformance.test.ts; npm run lint; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/runtime/container-inventory.ts
  - src/runtime/README.md
  - src/tools/action-tools.ts
  - test/container-inventory.test.ts
  - package.json
  - docs/manual-testing-guide.md
  - docs/architecture-convergence-roadmap.md
  - TODO.md
  - CLAUDE.md
---

## What changed

新增纯 runtime 模块，统一现有物品 JSON 形状、同名堆汇总排序、exact/includes 匹配，以及 `containerItems()` 优先、`items()` 回退的容器读取规则。记忆容器 inspect/deposit/withdraw 路径改用 Mineflayer Bot/Block 与最小容器结构类型，移除该段重复读取代码和 30 处显式 `any` 文本命中。

## Why it matters

容器逻辑此前混合动态 Bot、Block、Item 和 Window 对象，无法在不启动游戏的情况下固定数据语义。现在纯投影规则可独立测试，同时为后续 ContainerSession 与 Modded Client bridge 设计提供一个不依赖具体窗口实现的数据层。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA，不改变 MCP 工具名称、schema、返回字段、等待时间、存取顺序或游戏行为。它没有新增 `ClientAdapter` 容器 capability，也不支持机械动力保险库、精妙存储箱子、地面背包等模组容器。真实原版箱子/木桶行为仍列在手测积压中。
