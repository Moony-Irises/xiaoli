# Catalog 模块

该模块保存 MCP、Agent 和未来 Web 入口可复用的稳定工具元数据与暴露策略，不持有领域 handler 或 Zod 输入 schema。

## 入口

- `tool-catalog.ts`：Agent 核心工具元数据、默认 allowlist 派生和完整性校验。
- `mcp-tool-registration.ts`：用 Catalog 名称与描述组合领域 schema/handler 的 MCP SDK v1 薄包装。

## 兼容边界

- 已持久化的自定义 allowlist 不过滤、不重排。
- 工具 schema、handler 和返回结构仍由 `src/tools/` 领域代码负责。
- `src/commands/` 负责跨入口调用结果与执行历史；它与 metadata Catalog 分离，当前只试点 `move.stopFollow`。
- 新增默认工具或扩大 Agent 权限必须单独评估，不能借注册迁移静默完成。
- Catalog 条目不表示工具必然通过 MCP 暴露；注册入口仍需显式调用。

## 当前迁移范围

- Observe：`observe.self`、`observe.inventory`、`observe.nearbyPlayers`、`observe.nearbyEntities`。
- Inventory：`inventory.holdByCategory`、`inventory.organizeHotbar`。
- Movement MCP：`move.followPlayer`、`move.stopFollow`；`move.goToPosition` 当前仅供 Agent/Web 执行。
- Interaction：`interact.dropHeld`、`interact.dropHotbarSlot`、`interact.openDoor`。
- Chat MCP：`chat.send`；`chat.requestTeleportToPlayer` 当前仅供 Agent/聊天硬规则执行。
- Combat：`combat.prepareBattle`、`combat.challengeEntity`。
- Mining MCP：`mine.collectVisible`；`mine.digNearestVisible` 不在核心 Catalog，继续使用原注册入口。
- 未列出的 MCP 工具继续由原注册入口负责。

## 验证

```powershell
npx tsx --test test/tool-catalog.test.ts test/mcp-tool-registration.test.ts
```
