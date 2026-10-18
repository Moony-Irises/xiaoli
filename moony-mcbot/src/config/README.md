# 配置持久化模块

- `persisted-chat-config.ts`：`chat-configs.json` 的纯 Zod 解析边界。
- `persisted-chat-config-repository.ts`：文件读取、解析、串行原子写入和 flush 生命周期。
- `chat-listener-config-store.ts`：聊天监听运行时配置的默认值、状态所有权、replace/delete 和持久化投影。
- `chat-ai-config-store.ts`：Chat AI 配置及运行时秘密、历史、用户冷却和请求状态的所有权边界。
- `agent-config-store.ts`：Agent 核心配置及 planner 秘密、最近规划诊断的所有权边界。
- `self-guard-config-store.ts`：self-guard 配置默认值、阈值归一化、状态所有权和持久化投影。
- `territory-config-store.ts`：领地配置默认值、按 Bot 隔离、复制、替换和删除；不持有入侵 presence 或警告生命周期。

`ChatListenerConfigStore` 只拥有监听开关、白名单、唤醒规则和持久化投影，不持有实际聊天订阅或 watchdog。按 Bot 的 Runtime 引用、`unsubscribe` 回调和单例监听 watchdog 由 `runtime/ChatListenerLifecycle` 管理；`action-tools` 负责在配置提交、重连和 shutdown 时协调两者。

七个模块都不读取环境变量，也不直接操作 Bot 或 Agent runtime。四个核心 ConfigStore 分别拥有 `chatByBotId`、`aiByBotId`、`agentByBotId` 与 `guardByBotId` 配置表，`TerritoryConfigStore` 拥有 Agent 记录中的领地配置运行时副本；Chat AI 与 Agent 默认值通过工厂注入，Agent allowlist 解析通过函数注入。Agent 的战略目标、玩家/地点记忆、任务历史和领地仍由 `action-tools` 组合进同一持久化记录，但任务历史、玩家/地点工作集和领地配置的内存所有权已分别由 `runtime/AgentTaskHistoryStore`、`memory/AgentGameMemoryStateStore` 和本 Store 拥有；`runtime/TerritoryRuntime` 组合 presence、短期状态与警告判定，旧编排层只提供配置/快照和聊天、事件、决斗 hooks。planner 冷却时间戳判定已由 `HierarchicalAgentRuntime` 负责，planner 请求/执行、self-guard tick 回调/反击业务、四表事务提交、监听器 cleanup、环境覆盖和 runtime reconcile 仍由旧编排层负责。当前 AI 请求由 `runtime/AiRequestLifecycle` 管理，Chat AI 与 self-guard 的排队 tail、待执行任务代次由各自的 `runtime/InvalidatableTaskQueue` 实例管理，self-guard 原生受伤 listener 由 `runtime/SelfGuardHurtSubscriptionRegistry` 管理，self-guard 主/持续反击 interval 与 watchdog 句柄由 `runtime/SelfGuardLoopLifecycle` 管理，反击 session 与命中衰减状态由 `runtime/RetaliationStateStore` 管理，告警冷却与上一轮观察状态由 `runtime/SelfGuardRuntimeStateStore` 管理，旧编排层共享的装备节流与反击命中序号由 `runtime/CombatExecutionStateStore` 管理，Mineflayer 昼夜/下雨兼容读取与转场判定由无状态的 `runtime/self-guard-environment` 管理，告警冷却允许条件、周期生命/饥饿、reactive 阈值信号、Bot 重连/健康下降核心转场、库存摘要和附近玩家进入判定由无状态的 `runtime/self-guard-state` 管理，疑似攻击者选择、后续目标快照复核与持续反击 tick 条件判定由无状态的 `runtime/self-guard-retaliation` 管理。

Agent 玩家/地点的运行时工作集及共享基线已由 `memory/AgentGameMemoryStateStore` 拥有；`action-tools` 只保留输入归一化、时间戳生成、旧配置投影、共享文件 I/O 队列和 territory 联动。任务历史继续由 `runtime/AgentTaskHistoryStore` 拥有，二者都不会读取配置文件或环境变量。

## 当前契约

- 继续接受现有无顶层 `version` 的文档，不在本模块隐式升级 schema。
- `chatByBotId`、`aiByBotId`、`agentByBotId`、`guardByBotId` 缺失时按空表处理。
- 兼容旧配置中的缺省字段和额外字段；已出现的已知字段必须满足布尔值、字符串、数组、枚举和有限数字类型。
- Bot ID 不能为空白字符串。
- `apiKey` 与 `plannerApiKey` 只为读取旧文件保留兼容类型；运行时会忽略文件中的秘密值。

## 热重载边界

`action-tools` 先通过 `PersistedChatConfigRepository.load()` 读取并完整校验候选文档，再同步提交四个核心配置表。四类核心配置的 replace/delete 分别委托给对应 Store，Agent 的 territory 配置 replace/delete 也委托给 `TerritoryConfigStore`；Agent 的 goal/memory/territory 持久化组合仍在同一提交阶段由旧编排层应用，配置替换/删除同时通过 `TerritoryRuntime.clearBot()` 清理短期 presence。解析失败不会修改现有内存状态。成功提交会删除文件中已经消失的条目及对应 Agent 记忆、目标和领地派生状态；存续 Chat AI 条目的 API key、聊天历史、用户冷却表和请求诊断对象，以及存续 Agent 条目的 planner API key、最近规划时间/摘要/结果和请求诊断对象都会保留。文件中的旧 `apiKey` / `plannerApiKey` 仍被忽略。

进行中的 Chat AI 请求仍使用启动时捕获的模型配置，但请求状态通过 botId 和请求代次写入当前 Store。热重载复用同一个历史数组，裁剪也原地执行，因此完成记录和 `lastRequest` 不再停留在被替换对象。删除配置会失效当前请求并阻止迟到回写。

进行中的 planner 请求同样继续使用启动时捕获的请求参数，但 `lastPlannerRequest`、`lastPlanAt`、`lastPlanSummary` 和 `lastPlanResult` 均按 botId 写入当前 Store。新请求开始后，旧请求的迟到状态更新会被请求代次拒绝。

Chat AI 配置 replace/delete 会推进对应队列代次，因此已入队但尚未开始的旧任务不会再使用旧配置启动；任务被跳过时只在时间戳仍匹配时撤销自己写入的用户冷却，不能删除后来消息的冷却。删除配置不会删除队列 tail，shutdown 仍能 drain 已运行任务；`chat.ai.configure` 同样失效旧待执行任务并由请求 lifecycle 取消当前请求。

self-guard 配置 replace、手动 configure、停用或删除会推进任务队列代次，尚未开始的旧自动进食/反击任务会被跳过，tail 仍由队列持有并参与 shutdown drain。主 tick、持续反击 tick 与 `entityHurt` handler 在实际执行时按 botId 读取当前 ConfigStore；循环 lifecycle 负责同 Bot 主 interval 替换、持续反击 interval 幂等启动/停止、watchdog 单例和 shutdown 全量停止，事件 registry 负责同 Bot 幂等绑定和重连 emitter 替换，反击状态 Store 负责 session、连续命中和按 Bot 清理，短期运行状态 Store 负责告警冷却与上一轮观察，战斗执行状态 Store 负责装备节流与反击命中序号，纯环境边界负责兼容读取昼夜/下雨标志并判断日转夜和无雨转下雨，纯周期状态边界负责告警冷却允许条件、生命/饥饿、reactive 阈值事件内容与去重 flags、Bot 引用变化、严格超过 `0.5` 的健康下降、库存摘要和附近玩家首次进入判定，纯反击边界负责从 Adapter 玩家坐标中找最近疑似攻击者、按精确用户名和坐标复核目标，并判定持续反击的超时、接近/停留和攻击冷却。允许告警时旧编排层仍先写冷却时间再尝试聊天，发送失败不会回滚；普通 stop 保留告警冷却，但会按旧语义清理战斗执行状态，配置删除才全清短期运行状态。ConfigStore 本身仍不持有 timer、游戏事件或运行态，已经开始的短任务不会被代次强制中断；Agent 事件发布、reactive flags 写入、重连短句和受伤处理仍由旧 tick 在原位置执行，环境输入仍由旧编排层从原生 Mineflayer Bot 提供，受伤来源仍是最近玩家启发式，追击和攻击也尚未脱离 Mineflayer。

提交后才重新应用 `.env.local` / 进程环境覆盖并 reconcile 已连接 runtime。因此环境层仍高于持久化层，可能为默认 Bot 重新创建或覆盖有效配置。

启动加载允许配置文件尚不存在；显式调用 `chat.config.reload` 时缺文件属于错误，不返回成功标志。

## 写入与退出

`enqueue()` 保持原有快照顺序，并复用公共 `writeJsonAtomic` 完成同目录临时文件、同步和 rename。单次写失败经注入的错误回调记录后，队列继续处理后续快照。`flush()` 会循环等待 drain 期间追加的尾部写入；它不新增自动重试或持久化队列格式。

## 验证

```powershell
npm test -- test/self-guard-state.test.ts test/self-guard-retaliation.test.ts test/self-guard-environment.test.ts test/combat-execution-state-store.test.ts test/self-guard-runtime-state-store.test.ts test/retaliation-state-store.test.ts test/self-guard-loop-lifecycle.test.ts test/self-guard-hurt-subscriptions.test.ts test/invalidatable-task-queue.test.ts test/ai-request-lifecycle.test.ts test/agent-config-store.test.ts test/self-guard-config-store.test.ts test/chat-ai-config-store.test.ts test/chat-listener-config-store.test.ts test/persisted-chat-config-repository.test.ts test/chat-config-reload.test.ts test/runtime-shutdown-lifecycle.test.ts
npm test -- test/agent-task-history-store.test.ts test/chat-config-reload.test.ts
npm run typecheck
npm run lint
```
