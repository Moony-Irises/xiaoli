# Runtime 模块

该目录负责 bot 生命周期、客户端适配器、Mineflayer 兼容实现和可离线测试的运行时决策/数据投影，不注册 MCP 工具。

安全移动的人工验收以[手动指南第 6.4 节](../../docs/manual-testing-guide.md#64-安全跟随失败与恢复待游戏内验收)为准：首轮路径拒绝通过 Promise 报错，首次成功后的路径失败才发关联移动事件，两者都会产生 Adapter 失败记录。不要将不可见、超出跟随范围或目标静止正常结束误判为安全路径失败。

## 主要边界

- `bot-runtime.ts` / `bot-registry.ts`：bot 实例生命周期与 Adapter 调用入口。
- `client-adapter.ts` / `client-adapter-factory.ts`：跨客户端能力契约与实现选择。
- `mineflayer-adapter.ts`：Mineflayer 的观察、移动、实体动作和单块采矿实现。
- `container-inventory.ts`：容器/背包物品的序列化、汇总、匹配与读取回退纯函数。
- `focus-perception.ts`：第一人称准星实体候选的视锥、距离、遮挡和评分纯选择逻辑。
- `openai-compatible-client.ts`：planner、chat 与 memory 共用的 HTTP 传输层。
- `openai-response-text.ts`：planner 与 chat 共用的文本片段提取及空回复诊断；不把 reasoning 文本当作回复。
- `ai-request-lifecycle.ts`：按 Bot 和请求代次管理当前 AI 请求的取消、失效与诊断写入门控。
- `invalidatable-task-queue.ts`：按 Bot 串行排队，并用代次失效待执行任务和动态 drain 队列 tail。
- `mining-task-queue.ts`：按 Bot 串行旧采矿任务，并提供 shutdown 使用的一次 tail 快照。
- `interval-scheduler.ts`：通用 interval scheduler 契约与系统实现，供不同运行时生命周期复用。
- `agent-executor-lifecycle.ts`：拥有按 Bot 的 Agent executor interval 与串行运行 tail。
- `agent-task-history-store.ts`：拥有按 Bot 的最近任务历史、20 条上限和快照复制边界。
- `../agent/runtime.ts`：拥有 Agent 黑板协调、planner/tick 冷却、task progress 节流、战略生命周期去重、库存事件基线和空闲社交尝试冷却状态。
- `follow-session-lifecycle.ts`：拥有按 Bot 的跟随 interval、session 元数据和 movement subscription 生命周期。
- `position-movement-lifecycle.ts`：拥有按 Bot 的定点移动 interval 与 movement subscription 生命周期。
- `duel-session-lifecycle.ts`：拥有按 Bot 的对决 interval、session 元数据和 entity/movement subscription 生命周期。
- `movement-intent-store.ts`：拥有按 Bot 的当前移动相关标识，用于隔离旧异步结果与事件。
- `territory-presence.ts`：从 Adapter 玩家快照纯判定最近入侵者、有效 presence 键和主人在场条件。
- `territory-presence-store.ts`：拥有按 Bot 的进入、警告与升级时间状态，以及 active-key prune/清理。
- `territory-warning-state.ts`：纯判定首次/冷却警告、等待主人、升级和无动作状态转移。
- `territory-runtime.ts`：组合领地 presence、短期状态和警告判定，并按固定顺序调用副作用 hooks。
- `self-guard-hurt-subscriptions.ts`：按 Bot 绑定/解绑 Mineflayer 受伤事件，并在事件发生时解析当前 self-guard 配置。
- `self-guard-loop-lifecycle.ts`：拥有按 Bot 的 self-guard 主/持续反击 interval 和单例 watchdog 句柄。
- `retaliation-state-store.ts`：拥有按 Bot 的持续反击 session，以及按攻击者归组的命中次数与最后命中时间。
- `self-guard-retaliation.ts`：从 Adapter 玩家坐标中纯选择/复核反击目标，并判定持续反击 tick 的超时、移动与攻击时机。
- `self-guard-environment.ts`：兼容读取 Mineflayer 昼夜/下雨标志，并纯判定 self-guard 环境转场。
- `self-guard-state.ts`：纯判定生命/饥饿阈值、reactive 阈值信号、Bot 重连/健康下降核心转场、背包事件摘要和附近玩家进入转场。
- `self-guard-runtime-state-store.ts`：拥有按 Bot 的告警冷却、上一轮健康/环境/邻近状态、Bot 引用和 reactive flags。
- `social-runtime-state-store.ts`：拥有按 Bot 的最近互动、主动发言时间、短期回复上下文、心情和场景台词冷却。
- `chat-listener-lifecycle.ts`：拥有按 Bot 的聊天订阅资源和单例监听 watchdog interval。
- `atomic-json-file.ts` / `shutdown-lifecycle.ts`：原子持久化和分阶段退出。
- `process-lifecycle.ts`：统一 signal、fatal 和 startup failure 的失败码、日志与幂等 shutdown 协调。

## 客户端生命周期边界

- `BotRuntime` 只通过 `ClientAdapter.connect()`、`awaitReady()` 和 `disconnect()` 建立或关闭客户端；连接失败也走同一 Adapter 清理链。
- `BotRuntime.disconnect()` 返回 `Promise<RuntimeStatus>`。同一轮重复断开复用一个 Promise，断开期间拒绝新连接；MCP `bot.disconnect` 的名称、参数和成功文本不变。
- `MineflayerAdapter` 在断开开始时停止路径评估并撤销聊天、实体和移动订阅，随后等待 `McClientService` 收到 bot `end`；等待上限为 5 秒，失败会向 MCP 和 shutdown 传播。
- Runtime 只注销自己注册的 `login`、`kicked`、`error`、`end` 监听器，不使用 `removeAllListeners()` 破坏 Mineflayer 或插件监听器。

完整契约见 [ClientAdapter 生命周期设计](../../docs/client-adapter-lifecycle-design.md)。

## AI 请求生命周期边界

规划请求体、上下文白名单和模型回复解析由 [`OpenAiAgentPlanner`](../agent/openai-agent-planner.ts) 管理；单次 planner 请求的状态登记、Signal 传递和终态写回由 [`planner-request-runner.ts`](../agent/planner-request-runner.ts) 管理，超时仍由调用层解析后传入。

`AiRequestLifecycle` 只持有每个 Bot 当前请求的 `AbortController` 与单调请求代次，并通过注入的 writer 把状态写入当前 ConfigStore。新请求会使旧 handle 的迟到更新失效，但不会隐式中止旧工作；显式 `cancel` 会中止当前 signal 并允许该请求写入终态，配置删除和 shutdown 使用 `invalidate` 阻止任何后续回写。

该模块不读取环境变量、不解析模型响应、不拥有 Chat AI 队列、planner 请求/执行或 Agent executor。planner 冷却边界由 Agent runtime 持有，业务请求仍由调用方发起，配置和诊断对象仍由对应 ConfigStore 持有。

## 可失效任务队列边界

`InvalidatableTaskQueue` 为每个 key 保存一个串行 tail 和配置代次。`invalidate(key)` 只跳过尚未开始的旧代次任务，不打断已经运行的任务；失效后新入队任务使用新代次，并继续排在当前 tail 后。`close()` 幂等拒绝新任务并跳过所有待执行任务，`drain()` 会重新比较等待期间追加的 tail，直到当前拥有的工作全部结束。

任务异常通过注入的 `onTaskError` 上报并与后续任务隔离；`onSkipped` 供调用方撤销入队时写入的临时状态。Chat AI 与 self-guard 分别创建队列实例，不共享 Bot tail 或错误策略。该队列不持久化任务、不自动重试，也不提供 exactly-once 保证。

## 采矿串行任务队列边界

`MiningTaskQueue` 只拥有旧采矿执行链按 Bot 保存的 Promise tail：同一 Bot 的任务严格串行，不同 Bot 互不阻塞；调用方收到原任务的结果或原异常，内部被跟踪的 tail 会吸收失败，使后续同 Bot 任务仍可继续。已完成 tail 继续保留，直到同 Bot 的下一项任务覆盖它，这是迁移前裸 Map 的兼容行为。

`getTrackedTasks()` 返回调用时的一次数组快照，供 `flushActionPersistence()` 等待当时已登记的采矿工作；快照之后追加的任务不会动态进入本次等待。该队列不提供取消、代次失效、关闭、自动重试、settle 后删除或动态 drain，也不持有 BotRegistry、采矿目标选择、寻路、挖掘动作、结果事件和持久化逻辑。四条旧批量采矿链仍由 `action-tools.ts` 编排并直接依赖现有 Mineflayer 路径，本次迁移不代表它们已进入 Adapter 或完成游戏内验收。

## Agent executor 生命周期边界

`AgentExecutorLifecycle<THandle>` 通过注入的 interval scheduler 只拥有每个 Bot 的 executor interval 和串行 Promise tail。`start` 会先停止同 Bot 的旧 interval，再按指定冷却登记新 loop；tick 通过 `enqueue` 进入同 Bot 的 tail，因此同 Bot 串行、不同 Bot 互不阻塞，单次任务异常会被隔离且不阻断下一次运行。`isAttached` 继续只表示 interval 是否登记，不表示 planner 请求或工具动作已经完成。

普通 `stop` 和进程 shutdown 的 `stopLoopsForShutdown` 只阻止后续 tick，不取消已经运行或排队的 Promise。`getTrackedRuns` 返回调用时的一次快照，供现有 persistence flush 等待；`forgetRun` 只删除跟踪关系，不中止旧工作，并会让同 Bot 的后续任务从新的 tail 开始。已完成 tail 仍保留到被同 Bot 新任务覆盖或显式遗忘，这是迁移前 Map 的兼容行为，不是动态 drain 或可取消队列语义。

该模块不读取 Agent 配置、不持有 BotRegistry，也不执行 planner、Skill、工具、状态写入或持久化。配置判断、tick 业务、异常注释和公共 MCP/Web/Agent 返回仍由 `action-tools.ts` 编排。

Agent runtime 自身拥有任务 timeout timer、executor tick 冷却门、planner 冷却时间戳、task progress 节流状态、战略生命周期去重状态、库存事件摘要基线和空闲社交尝试冷却：`HierarchicalAgentRuntime.scheduleTaskTimeout()` 只维护黑板中的单条任务 timeout，`clearTaskTimeout()` 负责清除它，`shouldPublishTick()` 负责保留旧的最小间隔判定，`canStartPlanner()` / `markPlannerCompleted()` 负责 planner 冷却边界，`canPublishTaskProgress()` / `markTaskProgressPublished()` / `clearTaskProgress()` 负责进度事件的只读判定、成功发布后记录和清理，`claimStrategicLifecycleInstruction()` 负责普通生命周期提示的占用，`canPublishStrategicLifecycleReport()` / `markStrategicLifecycleReportPublished()` / `clearStrategicLifecycle()` 负责完成/放弃汇报的只读判定、成功记账和清理，`observeInventorySummary()` / `clearInventorySummary()` 负责首次建基线、重复抑制、变化记账和 Agent 配置删除清理，`claimIdleSocialAttempt()` / `clearIdleSocialAttempt()` 负责目标选中后的尝试占用、精确冷却边界和配置删除清理。两类生命周期标记相互独立；库存摘要和空闲社交时间戳都不持久化。空闲社交时间戳代表尝试而不是聊天成功，后续实体查找或场景台词失败不会回滚；普通 executor 停止和策略切换也不会清理。配置里的 `lastPlanAt` 仍是兼容诊断镜像，不是第二个冷却判定源。这里不重复持有这些协调 Map，也不代表 planner 请求取消、执行队列或完整 Agent tick 已迁移。

## 社交与人格短期状态边界

`SocialRuntimeStateStore` 按 Bot 持有五组进程内状态：最近互动时间、最近主动发言时间、短期记忆回复上下文、当前心情和按场景划分的台词冷却。Store 只负责隔离、复制、读取和原子占用；聊天监听、self-guard、动态 AI 状态、共享记忆写入和具体发送仍由 `action-tools.ts` 编排。

`claimSceneLine()` 在冷却允许时立即写入时间戳，因此保留“发送前占用”以及失败尝试也进入冷却的旧语义；精确到期可再次触发，时钟回退会抑制触发。回复上下文的输入和输出均为浅副本，30 秒严格过期判断仍在调用层执行。该 Store 不读取配置、环境变量或文件，不写入共享 `memory`，也不改变 MCP/Web/游戏动作。

这些状态是短期运行态，重启后不会恢复。Store 提供 `clearBot()`，但当前没有接入生产清理，因为 `BotRegistry.delete()` 尚无统一的跨模块资源清理钩子；在该生命周期落地前，保持旧的进程内保留语义。

## 聊天监听资源生命周期边界

`ChatListenerLifecycle<THandle, TBotRef>` 按 Bot 持有当前 Runtime 引用与聊天订阅的 `unsubscribe` 回调，并持有一个全局 watchdog interval。调用层用 `isCurrent()` 判断同一 Runtime 是否可复用；需要替换时仍显式停止旧订阅，再创建消息处理器、调用 Runtime 订阅并登记新资源。生命周期对象不隐式替换旧订阅，避免隐藏清理失败。

`stop()` 保留“先 unsubscribe，成功后删除登记”的旧顺序；解绑抛错时登记仍保留，便于后续重试和诊断。进程 shutdown 通过快照枚举订阅，并由调用层逐 Bot 隔离错误；watchdog 只允许登记一个 interval，停止后可重新启动。该模块不读取聊天配置、不做消息去重、不创建聊天处理器、不持有 `BotRegistry`，也不写持久化文件。配置协调、重连判断、去重清理和具体聊天行为仍由 `action-tools.ts` 编排。

## Agent 任务历史边界

`AgentTaskHistoryStore` 只拥有每个 Bot 最近 20 条已结算任务记录。`replace` 用于加载现有持久化快照，`record` 追加并裁剪最旧记录，`get` 返回记录副本，`clear` 保留显式空历史，`delete` 用于配置条目真正移除。输入和输出都不会暴露内部数组或记录引用。

Store 不决定任务何时完成，不读取 Agent 配置或共享记忆，也不操作文件。`action-tools.ts` 仍负责把运行任务转换为历史记录、触发持久化队列，并把历史组合进既有 `memory.taskHistory`；MCP/Web 字段、记录顺序和 20 条上限保持不变。这一步也没有把短期任务历史写入跨模块共享记忆。

## 领地状态边界

`territory-presence.ts` 只根据玩家快照、记忆地点、半径、白名单和主人策略计算当前最近入侵者、全部有效 presence 键及主人是否在场。持久化领地配置由 `config/TerritoryConfigStore` 拥有；`TerritoryPresenceStore` 按 Bot 持有进入时间、最近警告和升级时间；`territory-warning-state.ts` 纯判定 `warn`、`hold_escalation`、`escalate` 或 `none` 及下一状态。`TerritoryRuntime` 组合这三个边界，负责 active-key prune、状态读写、Bot 清理，并在状态写回后按判定调用同步 hooks。

这些模块都不读取环境变量、不操作文件、不持有 BotRegistry，也不直接发送聊天或启动战斗。判定继续保持冷却到期时先警告、后续 tick 才检查升级的旧优先级，以及旧 falsy `escalatedAt` 兼容语义；`action-tools.ts` 仍采集配置、记忆地点和 Adapter 快照，并为 Runtime 注入警告聊天、Agent 事件和 `startDuel` hooks。presence key 格式、hook 调用前写状态的异常顺序、handled 布尔、MCP/Web/JSON 契约和游戏行为保持不变。

## Self-guard 受伤订阅边界

`SelfGuardHurtSubscriptionRegistry` 只拥有每个 Bot 的 `entityHurt` emitter/listener 对，并以 emitter 身份保证幂等绑定。Bot 引用变化时先解绑旧 listener；停用、配置删除和 shutdown 通过同一 registry 删除绑定，不调用 `removeAllListeners()`。

handler 不捕获配置对象，事件发生时通过注入函数按 botId 获取当前配置；配置缺失、已禁用、实体 ID 缺失或不是自身时均不触发反应。该模块不读取环境变量、不持有 BotRegistry、不执行反击，也没有把 `entityHurt` 加入公共 `ClientEntityEvent`；原生事件采集仍是 Mineflayer 兼容边界。

## Self-guard 循环生命周期边界

`SelfGuardLoopLifecycle` 通过注入的 interval scheduler 持有每个 Bot 的主循环、持续反击句柄和一个全局 watchdog。重复 `start` 会先停止同 Bot 的旧主循环，`ensureRetaliation` 与 `ensureWatchdog` 保证各自作用域只启动一次；所有 stop 方法幂等，`stopAll` 统一释放三类句柄，非有限或非正间隔会在创建 timer 前失败。

该模块不读取环境变量或配置，不持有 BotRegistry，也不执行生命值检查、进食、聊天或反击业务。主 tick、持续反击 tick 和 watchdog 的 Bot reconcile 回调仍由 `action-tools.ts` 编排，因此这只是 `GuardRuntime` 的 timer 句柄所有权边界，不是完整迁移。

## Follow 会话生命周期边界

`FollowSessionLifecycle<THandle, TSession>` 只拥有跟随会话的三类运行时资源：每个 Bot 的 interval 句柄、session 元数据和 movement subscription 的 `unsubscribe` 回调。`get` / `has` 提供状态查询，普通 `stop` 按“清 interval -> 调用订阅清理 -> 删除订阅与 session”的旧顺序执行，并保持清理回调抛错时的同步异常语义。

跟随启动仍由 `action-tools.ts` 编排：它先显式停止旧会话，再调用 `trackMovement` 登记订阅，最后调用 `activate` 登记 interval 与 session。生命周期对象不会隐式替换未先停止的资源，这保留了旧实现的创建顺序，也让替换行为由业务层明确控制。进程 shutdown 使用 `stopIntervalsForShutdown` 和 `stopMovementSubscriptionsForShutdown` 两阶段 API，调用方可以逐个隔离订阅清理错误；为兼容旧行为，shutdown 阶段只释放句柄与订阅，不清除 session 元数据。

该模块不读取配置、不持有 BotRegistry 或 ClientAdapter，不执行停止移动、路径寻路、任务结算、事件发布和失败聊天。follow tick、`movementId` 失败判断及“我跟不上你啦”仍属于 `action-tools.ts` 与 Adapter/runtime 的既有编排边界，因此这一步是资源所有权收敛，不是完整 FollowRuntime 迁移。

## 定点移动生命周期边界

`PositionMovementLifecycle<THandle>` 只拥有每个 Bot 的定点移动 interval 和 movement subscription 的 `unsubscribe` 回调。`has` 保留旧定点移动 interval Map 查询的语义，只表示 interval 仍被登记；`isCurrent` 用 interval 句柄判断迟到 Promise 或 movement event 是否仍属于当前定点移动。

定点移动启动仍由 `action-tools.ts` 编排，并在业务层显式停止旧资源后调用 `activate`；生命周期对象不会隐式清理被覆盖的资源。普通 `stop` 按“清 interval -> 调用订阅清理 -> 删除订阅”的旧顺序执行，订阅清理抛错时保持旧的同步异常边界。进程 shutdown 使用 `stopIntervalsForShutdown` 和 `stopMovementSubscriptionsForShutdown` 两阶段 API，调用方负责逐个隔离清理异常。

该模块不读取配置、不持有 BotRegistry 或 ClientAdapter，也不创建 Pathfinder goal、movement intent、Agent task/event 或停止游戏移动。到达/失败结算、`stopMovement()`、安全路径决策和 self-guard 停止时的副作用仍由 `action-tools.ts` 编排；因此本项是定点移动资源所有权收敛，不代表完整 MovementRuntime 已独立完成。

## 对决会话生命周期边界

`DuelSessionLifecycle<THandle, TSession>` 只拥有每个 Bot 的对决 interval、session 元数据以及 entity/movement 两类 subscription。`get` / `has` 继续以 session 作为对决状态来源，tick 更新通过 `setSession` 替换当前状态；启动方仍按“先 session -> 双订阅 -> interval”的旧顺序显式登记，生命周期不会隐式清理被覆盖资源。

普通 `stop` 保留“清 interval -> 删 session -> entity unsubscribe -> movement unsubscribe -> 删订阅”的旧顺序与同步异常语义。进程 shutdown 继续先用 `stopIntervalsForShutdown` 清除全部 interval，再用 `stopSubscriptionsForShutdown` 逐个交给调用方隔离实体/移动订阅错误；为兼容旧行为，shutdown 不清 session 元数据。

该模块不读取配置、不持有 BotRegistry 或 ClientAdapter，也不选择目标、运行 250ms tick、创建 movement intent、追击、攻击、聊天、停止移动或结算 Agent task/event。完整持续对决编排仍在 `action-tools.ts`，因此本项是资源所有权收敛，不代表 DuelRuntime 已独立完成。

## 持续行走计时器生命周期边界

`WalkTimerLifecycle<THandle>` 通过注入的 `TimeoutScheduler` 只拥有每个 Bot 当前登记的持续行走停止计时器。`schedule` 保留旧实现的顺序：先创建 timeout，再登记句柄；到期时先执行调用方提供的停止工作，再删除当前记录。`stop` 和 `stopAll` 分别用于普通停止与进程 shutdown，并保持幂等。

调用方在登记新计时器前仍必须显式停止旧计时器。生命周期不会隐式清理被覆盖的句柄；若违反此前置条件，旧计时器到期时仍会沿用旧行为删除当前记录。该模块不停止游戏移动、不清理 movement intent、不调用 Adapter，也不决定 Agent/MCP 的返回文本；这些副作用和入口兼容映射继续由 `action-tools.ts` 编排。

## 移动意图相关标识边界

`MovementIntentStore` 只保存每个 Bot 当前移动操作的相关标识。follow、定点移动、决斗、聊天攻击和旧采矿接近链继续沿用原有 key 格式；新动作覆盖旧 key 后，旧 Promise 或 movement event 必须先与当前 key 匹配，才能结算或停止任务。`get`、`has`、`set` 和 `delete` 保留旧 `Map` 的覆盖与删除语义，不新增输入校验或自动清理。

该 Store 不是 Pathfinder goal、Adapter 状态或 Agent task 的来源，也不创建、停止或确认任何游戏动作。动作编排、key 创建时机、任务结算、事件过滤、进程 shutdown 和停止移动仍由调用层负责；key 存在只能说明本地仍跟踪一个移动意图，不能证明服务器已接受或完成移动。

## Self-guard 反击状态边界

`RetaliationStateStore` 以 botId 隔离持续反击 session，并把同一攻击者的命中次数和最后命中时间保存在同一条记录中。`recordHit` 会先按当前时间清理到达衰减边界的旧记录，再返回新的连续命中次数；`clearBot` 同时清理该 Bot 的 session 和命中记录。

`getSession` 有意返回当前 session 对象引用，以保持旧 tick 在排队期间共享更新 `remainingHits` / `lastAttackAt` 的语义。该 Store 不创建 timer、不读取配置、不持有 BotRegistry，也不执行追击、攻击或聊天；tick 回调和原生动作仍由 `action-tools.ts` 编排，目标快照复核与 tick 条件判定委托给纯 runtime 边界。

## Self-guard 疑似攻击者选择边界

`selectLikelyRetaliationAttacker` 从现有 `PlayerSnapshot` 列表选择半径内最近的非自身玩家。它使用双方坐标重新计算精确三维距离，不信任 Adapter 为展示保留两位小数的 `distance`；最大距离边界包含在内，同距保留输入顺序，缺失/非有限坐标或用户名为空时 fail-closed。

`resolveRetaliationTarget` 要求快照用户名与 session 目标精确一致，并用当前自身/目标坐标重新计算距离；它不施加攻击半径，以便持续反击保留远距离追击语义。持续反击 tick 与短反击的每次命中现在都先读取 Adapter 玩家/自身快照，缺失或损坏时 fail-closed，再仅在既有寻路、注视和攻击动作边界复核原生实体。

`decideRetaliationTick` 以判别联合返回 `timed_out`、`target_unavailable` 或 `active`。它先判定 60 秒超时，再检查目标距离；active 分支保持“大于 3 格接近，否则停留”、攻击距离包含边界和 600ms 冷却包含边界。它不修改 session，成功攻击后才写 `lastAttackAt` 和递减 `remainingHits` 的旧时序仍由调用方负责。

三个函数都不读取白名单、配置 Store 或运行状态，也不执行聊天和反击。`handleHitReaction` 仍在选出最近玩家后判断白名单。Mineflayer `entityHurt` 没有在此提供真实伤害来源，因此“疑似攻击者”仍只是最近玩家启发式，环境伤害、实体伤害或旁观玩家靠近时可能误归因；追击、控制状态、装备和攻击也仍是 Mineflayer 实现。

## Self-guard 环境兼容边界

`readSelfGuardEnvironment` 从 `unknown` 输入兼容读取 Mineflayer 的 `time.isDay` 与 `isRaining`，并保持旧编排层的 `Boolean(...)` 归一化语义：缺失或形状异常的字段均视为 `false`。`detectSelfGuardEnvironmentTransitions` 只在已有上一轮快照时报告白天转夜晚和无雨转下雨；首次观察、反向变化和状态不变均不产生转场。

该模块不持有 BotRegistry、配置、上一轮状态或聊天副作用。`action-tools.ts` 仍负责从原生 Mineflayer Bot 提供输入、写入 `SelfGuardRuntimeStateStore` 并发送既有场景短句；这一步没有扩展公共 `ClientAdapter`，也不代表 Modded Client 已支持世界环境快照。

## Self-guard 周期状态决策边界

`evaluateSelfGuardAlertCooldown` 纯判定聊天告警开关和冷却窗口：无历史时沿用旧实现的 `0` 基准，严格位于窗口内时抑制，恰好达到边界时允许，负数或非有限时间输入 fail-closed；`evaluateSelfGuardVitals` 对 Adapter 自身快照执行生命、饥饿、自动进食与恢复平静判定；`evaluateSelfGuardReactiveSignals` 根据上一组 reactive flags 生成有序的 `low_health` / `low_food` 语义信号和下一组 flags，首次进入阈值时报告，状态不变时抑制重复事件，critical 升级或降回普通低血量时重新报告，完全恢复只清 flags 不发布恢复事件；`evaluateSelfGuardCoreTransitions` 比较当前/上一轮 Bot 引用和健康值，仅在已有 truthy 旧引用且对象身份变化时报告重连，仅在 vitals 可用、旧健康值有限且本轮下降严格超过 `0.5` 时报告健康下降；`summarizeInventorySnapshotForEvent` 生成稳定排序的库存事件摘要。`evaluateSelfGuardProximity` 只读 Adapter 玩家快照，排除自身并忽略缺失、负数或非有限距离，在包含边界的范围内返回当前是否接近以及是否刚从“不接近”转为“接近”。

这些函数不读取 PromptProfile、ConfigStore 或 RuntimeStateStore，也不掷随机数、不发送聊天或发布 Agent 事件。主 tick 仍负责采集快照；`maybeAlertGuard` 在纯冷却决策允许后仍先写 `lastAlertAt`，随后才尝试聊天，因此发送失败不会回滚冷却；`maybePublishSelfGuardSignals` 仍按纯决策返回顺序发布事件，全部发布后才写 reactive flags；重连短句、受伤处理、附近玩家说话和其余上一轮状态也仍在旧位置。因此这里迁移的是条件和 payload 判定，不是副作用或完整 tick 顺序。

## Self-guard 短期运行状态边界

`SelfGuardRuntimeStateStore` 把原先分散的告警时间、健康、昼夜天气、Bot 引用、邻近玩家和 reactive 去重标志合并为一份按 Bot 记录。reactive flags 契约由纯 `self-guard-state` 定义，并从原 Store 模块 re-export 以兼容既有类型导入；`update` 只合并显式字段，`get` 返回记录副本并额外复制 reactive flags；不透明 Bot 引用保留对象身份，以维持重连检测。

普通 self-guard stop 调用 `resetTick`，清除上一轮观察和 reactive 状态但保留告警冷却；配置条目真正删除时才由 `clearBot` 全量清理。这保持了旧行为。该 Store 不采集 Mineflayer 天气、不执行 tick、聊天或事件发布，也不拥有反击和 combat 状态。

## 战斗执行节流状态边界

`CombatExecutionStateStore` 以 botId 隔离旧编排层共享的“最后一次成功装备武器时间”和“反击命中序号”。`recordEquip` 只在 Mineflayer `equip` 成功后写入，`nextHitIndex` 在看向或攻击目标前递增，因此保留旧实现里失败动作也会消耗跳击序号的时序；`clearBot` 仍由 self-guard stop 调用并同时清理两项状态。

该 Store 不持有 BotRegistry、不执行装备、跳跃或攻击，也不改变 700ms 装备节流和四次攻击中三次跳击的比例。`combat.prepareBattle` 的回退装备路径继续复用同一节流时间；`MineflayerClientAdapter` 内部用于 Adapter 攻击的独立计数器不属于此 Store。

## Adapter 构造注入

- `ClientAdapterFactory` 提供 `create(kind)` 对象契约；现有 `createClientAdapter(kind, dependencies)` 函数继续兼容。
- `BotRuntime` 和 `BotRegistry` 接受可选的内部组合依赖，默认 kind 仍为 `mineflayer`。Factory 返回错误 kind 时构造立即失败，Registry 不记录半成品。
- Adapter kind 尚未进入 `BotCreateInput`、MCP、环境变量或持久化配置。注入 Fake `modded-client` 只能验证构造边界，不代表认证、生命周期事件或 Modded Bridge 已实现。

完整契约见 [ClientAdapter 构造注入设计](../../docs/client-adapter-injection-design.md)。

## 命令边界

Runtime 只提供客户端能力和动作结果，不判断调用来自 MCP、Web 还是 Agent。跨入口的 commandId、来源、请求 ID、耗时与统一终态由 `src/commands/command-dispatcher.ts` 持有，四个试点的具体 schema、输出守卫与 handler 由 `src/commands/action-command-set.ts` 持有；当前 `move.stopFollow`、`interact.eat`、`inventory.holdByCategory` 与 `interact.openDoor` 已接入，且 `executed` 不等于游戏事件确认。

完整边界见 [Command Invocation / Action Result 设计](../../docs/command-invocation-design.md)。

## 容器兼容边界

`container-inventory.ts` 只描述物品数据和已有 Mineflayer Window 的最小读取/存取形状。它不负责寻路、打开或关闭窗口、取消、动作证据及模组容器识别，也不是公共 `ClientAdapter` capability。当前完整容器会话仍由 `action-tools.ts` 的 Mineflayer 兼容路径持有。

## Agent 状态快照边界

`action-tools.ts` 当前仍负责组装完整本地 Agent 状态，但内部同步、唤醒上下文、战略汇报和自治规划统一使用由该构建函数推导的 `AgentStateSnapshot`，不再把已知结构降级为动态字典。Web/MCP 调试接口仍返回原有完整 JSON；云端 planner 继续通过 `planner-context-projection.ts` 把输入视为不可信数据并执行字段白名单投影。

## 可见扫描兼容边界

旧可见方块扫描、`GoalNear` 接近和批量采矿仍位于 `action-tools.ts`，但 Bot、Block、位置、Pathfinder 与 Movements 已使用上游正式类型。Movements 按 bot 实例保存在 `WeakMap`，不再向 bot 动态写缓存字段。射线与工具选择暂时通过两个局部 `unknown` 桥接到 `mineflayer-mining.ts` 的旧窄接口；这不代表扫描已经迁入 `ClientAdapter`。

## 验证

```powershell
npx tsx --test test/pathfinder-movement-profile.test.ts test/mining-approach.test.ts test/client-adapter-mining.test.ts
npx tsx --test test/mc-client-service-lifecycle.test.ts test/client-adapter-lifecycle.test.ts test/bot-runtime-connection.test.ts
npx tsx --test test/client-adapter-factory.test.ts test/bot-runtime-adapter-injection.test.ts
npx tsx --test test/process-lifecycle.test.ts test/runtime-shutdown-lifecycle.test.ts
npx tsx --test test/ai-request-lifecycle.test.ts test/chat-ai-config-store.test.ts test/agent-config-store.test.ts
npx tsx --test test/invalidatable-task-queue.test.ts test/chat-config-reload.test.ts test/runtime-shutdown-lifecycle.test.ts
npx tsx --test test/follow-session.test.ts test/follow-session-lifecycle.test.ts test/stop-follow-command-integration.test.ts
npx tsx --test test/movement-intent-store.test.ts test/movement-event-routing.test.ts test/position-movement.test.ts test/client-adapter-entity-actions.test.ts
npx tsx --test test/self-guard-state.test.ts test/self-guard-retaliation.test.ts test/self-guard-environment.test.ts test/combat-execution-state-store.test.ts test/self-guard-runtime-state-store.test.ts test/retaliation-state-store.test.ts test/self-guard-loop-lifecycle.test.ts test/self-guard-hurt-subscriptions.test.ts test/self-guard-config-store.test.ts
npm run typecheck
```
