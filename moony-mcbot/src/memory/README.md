# Memory Runtime

`src/memory/` 负责 McBot 自己拥有的共享记忆读写，不读取 Voice 的 raw pending buffer。

## 聊天摘要

- `chat-memory.ts` 将白名单聊天按 `botId` 暂存，每 20 条生成一轮摘要。
- `chat-summary-state.json` 使用 `version: 2`，全局计数之外的 pending 和滚动摘要均按 Bot 隔离。
- v1 只有一个候选 Bot 时自动迁移；归属不明的旧摘要保存在 `unassignedLegacySummary`，不会进入任何 prompt。
- `chat-summaries.jsonl` 与 `episodes.jsonl` 保持 append-only 历史格式，不随状态迁移重写。
- 状态替换使用 `writeJsonAtomic`，退出时由 `flushSharedChatMemory()` 等待当前队列完成。

## 游戏记忆

- `game-memory-store.ts` 管理共享 `players.json` 与 `places.json`。
- `agent-game-memory-state-store.ts` 管理 Agent 按 Bot 隔离的玩家/地点工作集和共享基线；输入、查询与聚合快照都会复制记录，并统一处理替换、严格较新合并、删除和清空语义。
- `AgentGameMemoryStateStore` 不读取环境变量、不操作文件，也不持有 Bot、ConfigStore、持久化队列或 territory；输入归一化与时间戳生成仍由调用层负责。
- 两个完整 JSON 文档都复用 `writeJsonAtomic`：先在内存序列化，再以同目录排他临时文件写入、同步、关闭和 rename；替换失败会清理临时文件。
- `SharedGameMemoryStore` 不负责同一目标文件的业务写入顺序；McBot 的双写调用由 `action-tools` 持久化队列串行化，退出时等待该队列 drain。
- 文件路径、`version: 1` schema、归一化和按 `updatedAt` 合并规则保持不变。详细跨模块边界见 [共享记忆计划](../../docs/shared-memory-plan.md)。
