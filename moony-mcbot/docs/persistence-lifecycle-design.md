# 持久化与退出生命周期设计

## 目标

避免进程在写配置、聊天短期记忆或共享游戏记忆时退出，留下截断 JSON；同时让 SIGINT/SIGTERM、未处理 Promise、未捕获异常和可捕获的启动失败进入同一套幂等退出流程。

## 原子 JSON 写入

```text
serialize in memory
  -> create parent directory
  -> create unique temp file in the same directory
  -> write + file sync + close
  -> rename temp over destination
  -> remove temp on every failure path
```

临时文件必须与目标文件位于同一目录，避免跨文件系统 rename。序列化必须在创建临时文件之前完成。公共 writer 不负责 schema 校验，调用方继续拥有自己的数据类型和加载兼容逻辑。

`chat-configs.json`、`chat-summary-state.json`、`players.json` 与 `places.json` 的完整文档替换都复用该 writer。writer 只保证一次调用产生完整文件并清理自己的失败现场，不承诺同一目标文件上多个并发调用的业务先后顺序；共享游戏记忆继续由 `action-tools` 队列串行化快照写入。

## 队列 drain

- `PersistedChatConfigRepository`：拥有 chat config 串行写入队列并提供动态 drain；`action-tools` 在总 flush 中等待该仓库、共享 game memory 和有效聊天日志队列。
- `InvalidatableTaskQueue`：Chat AI 与 self-guard 分别用独立实例拥有按 Bot 串行 tail、配置代次和动态 drain；配置 replace/delete 只失效待执行旧任务，不删除 tail 所有权。
- `MiningTaskQueue`：拥有旧采矿执行链按 Bot 串行的 Promise tail；只提供调用时的一次跟踪快照，不提供关闭、失效或动态 drain。
- action runtime 静默时先关闭 Chat AI/self-guard 队列并取消当前 AI 请求，再等待两组队列、Agent executor 和 `MiningTaskQueue` 快照 settle，随后 drain 持久化队列，避免既有尾部任务在 flush 后追加状态。
- `chat-memory`：等待短期聊天缓冲、摘要生成、JSONL append 和状态写入队列。
- 提供动态 drain 的队列必须循环确认引用没有在等待期间被替换；Agent executor 与采矿队列保留旧的一次快照语义。
- 现有队列错误日志策略保持不变；flush 负责等待，不静默创造新的重试语义。

## Shutdown 顺序

```text
receive SIGINT/SIGTERM or fatal process failure
  -> reject duplicate shutdown
  -> start closing Web debug listener
  -> immediately stop action watchdogs, timers, subscriptions and in-flight AI requests
  -> wait for Web debug listener to drain
  -> disconnect bot runtimes
  -> flush action/chat-memory persistence
  -> close MCP server/transport
  -> exit with success or locked failure code
```

关闭编排写成可注入 hooks 的纯生命周期函数，进程协调器统一 signal、fatal 和 startup failure。fatal 一出现就把退出码锁为 `1`；即使 shutdown 是先由 signal 发起，后续 fatal 也不能把结果恢复成成功。日志或某个 shutdown hook 失败不会阻断剩余清理，也不会制造第二个未处理 Promise。

## 配置读取与热重载

`chat-configs.json` 的写入原子性与运行时热重载是两个独立边界：

1. 由独立 `PersistedChatConfigRepository` 读取完整文件，并通过独立 Zod schema 解析四个 Bot 配置表。
2. 任何 JSON、已知字段类型、枚举、有限数字或 Bot ID 校验失败都直接终止，不触碰现有 Map。
3. 校验成功后，在同一个同步提交阶段重建文件中存在的条目、删除缺失条目，并清理被删除 Agent 的记忆、目标和领地派生状态。四类核心配置均由独立 ConfigStore 执行 replace/delete；Agent 的战略目标、记忆、任务历史和领地扩展仍由旧编排层在同一阶段组合应用。

2026-08-20 补充：领地配置的默认构造、运行时副本、replace/delete 已委托给 `TerritoryConfigStore`；`TerritoryRuntime` 组合短期 presence、active-key prune、警告判定、状态写回和按 Bot 清理。旧编排层仍负责把配置组合进 Agent 持久化记录、采集地点/玩家上下文，并提供聊天、事件和决斗 hooks。
4. 存续 Chat AI 条目的 API key、聊天历史、用户冷却表和请求状态，以及存续 Agent 条目的 planner API key、最近规划时间/摘要/结果和请求状态不属于持久化快照，由对应 ConfigStore 显式带入新运行对象；文件中的旧 API key 继续忽略。
5. 提交完成后再应用环境变量覆盖并 reconcile listener、Agent executor 和 self-guard loop。

启动阶段允许文件不存在，以便首次运行继续进入环境默认配置；显式 `chat.config.reload` 缺文件则返回 MCP error。成功响应保留原有四个 count，并新增 `removedCounts`。顶层 schema 仍无 `version`，版本迁移继续作为独立兼容决策处理。

`PersistedChatConfigRepository` 只拥有文件生命周期：读取、解析、串行原子写入和 flush。四个 ConfigStore 分别拥有聊天监听、Chat AI、Agent 核心配置与 self-guard 配置表的默认构造、内存 Map、持久化投影和 replace/delete，但不拥有 listener、Agent 黑板/记忆/领地或守卫循环生命周期。`ChatListenerLifecycle` 持有按 Bot 的聊天订阅、对应 Runtime 引用与单例监听 watchdog；`AiRequestLifecycle` 统一持有 Chat AI 与 planner 当前请求的 `AbortController`、请求代次及诊断写入门控；两份 `InvalidatableTaskQueue` 分别持有 Chat AI 与 self-guard 的排队 tail、待执行任务代次和 drain；`MiningTaskQueue` 持有旧采矿链按 Bot 串行的 tail 及其 shutdown 快照投影；`SelfGuardHurtSubscriptionRegistry` 持有原生受伤 emitter/listener 对；`SelfGuardLoopLifecycle` 持有按 Bot 的主/持续反击 interval 与全局 watchdog 句柄；`RetaliationStateStore` 持有按 Bot 的持续反击 session 与按攻击者归组的命中衰减状态；`SelfGuardRuntimeStateStore` 持有告警冷却与上一轮健康、环境、Bot 引用、邻近和 reactive 状态；`CombatExecutionStateStore` 持有旧编排层共享的装备节流时间和反击命中序号；纯 `self-guard-state` 边界负责告警冷却允许条件、生命/饥饿、reactive 阈值信号与 flags 契约、Bot 重连/健康下降核心转场、库存摘要和附近玩家进入判定；纯 `self-guard-environment` 边界负责兼容读取昼夜/下雨标志并判定场景转场；纯 `self-guard-retaliation` 边界负责从 Adapter 玩家坐标中选择/复核反击目标，并判定持续反击 tick 的超时、移动和攻击时机。planner 冷却时间戳判定已由 `HierarchicalAgentRuntime` 负责；planner 请求/执行、Agent 执行循环和组合状态、采矿业务、self-guard tick 回调/事件发布/攻击业务、四表同步 commit、删除 cleanup、环境覆盖和 runtime reconcile 仍留在 `action-tools`，因此旧编排层尚未完成拆分。

`TerritoryConfigStore` 是 Agent 记录内领地配置的附加配置 Store，不改变上述四个核心表计数。`TerritoryRuntime` 内部持有独立 `TerritoryPresenceStore`，组合纯 presence 与 warning 判定，并在调用同步 hooks 前写回下一状态；配置替换/删除通过 `clearBot()` 清理对应短期状态。Runtime 不读取文件、不持有 memory place 或 BotRegistry；聊天、Agent 事件与决斗的具体 hook 实现仍留在旧编排层，因此这也不是完整领域副作用迁移。

`SocialRuntimeStateStore` 是另一组纯进程内短期状态边界，按 Bot 保存最近互动、主动发言时间、短期回复上下文、心情和场景台词冷却。它不进入 `chat-configs.json`、共享游戏记忆或聊天摘要文件；重启不会恢复。由于 `BotRegistry.delete()` 尚未提供统一的跨模块清理钩子，Store 当前只提供 `clearBot()` 能力而不在生产删除路径调用，保持既有运行态保留语义。

聊天订阅和 watchdog 同样不持久化。重启后，启动 reconcile 读取当前 Chat Listener/Chat AI 配置并重新建立所需订阅；配置热重载删除两类聊天配置时，由调用层协调 `ChatListenerLifecycle.stop()`。生命周期本身不读取配置文件，也不把 Runtime 引用或 unsubscribe 回调序列化。解绑失败会保留运行时登记并向既有清理边界传播，不会写出一个虚假的“已停止”持久化状态。

采矿队列同样只存在于当前进程，不序列化任务或 tail。`flushActionPersistence()` 通过 `getTrackedTasks()` 取得一次快照并等待其中 Promise settle；调用之后新入队的任务不会动态加入该次等待。任务异常原样返回调用方，而被跟踪的内部 tail 会吸收异常，避免阻断同 Bot 后续任务。

Chat AI 请求仍捕获启动时的模型配置，但状态更新通过请求 handle 按 botId 写入当前 Store；热重载复用历史数组，历史裁剪原地执行。新请求会让旧 handle 的迟到诊断失效，配置删除则取消并失效当前请求。排队任务在开始前复核入队代次，热重载、删除或手动配置后会跳过旧代次并清理对应用户冷却；队列继续拥有 tail，shutdown close 后可完整 drain。已经运行的请求不由队列中止，仍交给请求 lifecycle。

planner 请求也继续使用启动时捕获的请求参数，但 `lastPlannerRequest`、`lastPlanAt`、`lastPlanSummary` 与 `lastPlanResult` 已改为按 botId 写入当前 Store。planner 冷却时间戳判定由 `HierarchicalAgentRuntime` 负责，Store 中的 `lastPlanAt` 只是诊断镜像；请求代次只隔离诊断回写，不改变 planner 执行或新旧请求并行语义。

self-guard 配置 replace、手动 configure、停用和删除会推进独立任务队列代次，跳过尚未开始的旧自动进食/反击闭包但保留 tail drain 所有权。主/持续反击 interval 与 watchdog 句柄由独立 lifecycle 负责替换或幂等启动、查询和 shutdown 全量停止；两类 tick 每次执行时读取当前 ConfigStore。`entityHurt` handler 由独立 registry 绑定，并在事件发生时解析当前配置；重连到新原生 Bot 时会解绑旧 emitter。反击 session 与命中次数/最后命中时间由独立 `RetaliationStateStore` 按 Bot 清理；告警冷却和上一轮观察由 `SelfGuardRuntimeStateStore` 持有，stop 只 reset tick 字段，配置删除再全清；装备节流与反击命中序号由 `CombatExecutionStateStore` 持有，并继续在普通 stop 时一起清理；告警开关、严格冷却边界和无效时间 fail-closed，以及生命/饥饿、reactive 阈值信号内容与去重 flags、Bot 引用变化、严格超过 `0.5` 的健康下降与附近玩家首次进入条件由纯周期状态边界负责。允许告警时调用层仍先写 `lastAlertAt` 再尝试聊天，发送失败不会回滚；reactive 信号仍按 low-health、low-food、flags 写入顺序执行，`publishHierarchicalEvent` 内部继续隔离发布异常，调用返回后仍按旧行为写入本轮 flags。重连短句、受伤处理、随机说话和其余上一轮状态写入也保留在旧 tick 原有顺序中。昼夜/下雨兼容读取及首次观察、日转夜、无雨转下雨判定由纯 runtime 边界负责；疑似攻击者选择从 Adapter 玩家坐标重算精确距离，并继续在选中最近玩家后判断白名单；持续/短反击每次执行前也从 Adapter 快照精确复核用户名、位置与距离；持续反击的 60 秒超时、3 格移动边界、配置攻击距离和 600ms 冷却由纯判别联合判定。已经开始的短任务不由队列中止，受伤事件仍未加入公共 Adapter 事件契约；环境源仍是旧编排层取得的原生 Mineflayer Bot，`entityHurt` 的真实伤害来源判定、追击、原生实体动作复核、攻击业务和完整 tick 编排也仍在旧层。完整 tick 快照会改变附近玩家等采集相对既有副作用的时序，因此需等待原子 Adapter 快照或明确的分阶段 plan，未在本轮提前接入。

## 兼容边界

- 不修改文件路径、环境变量、MCP schema 或现有 JSON 字段。
- 本设计落地时 `chat-summary-state.json` 保持 `version: 1`；2026-07-31 后续修复已确认并升级为按 Bot 隔离的 `version: 2`，继续复用同一原子 writer 与退出 flush。
- `chat-configs.json` 本轮保持无版本顶层结构；新增 version 需单独确认。
- 共享 `players.json` / `places.json` 保持 `version: 1`，路径、字段和按更新时间合并语义不变。
- JSONL 摘要/episodes 继续 append，不改历史记录格式；退出时只等待队列完成。
- `SIGKILL`、断电和操作系统崩溃无法运行 shutdown hook，依靠原子 rename 保护最后一个完整 JSON。
- 进程事件处理器在 MCP transport 成功连接后安装；此前可捕获的启动失败由 `main()` 直接交给同一 coordinator，构造阶段的极早失败只设置失败退出码，因为此时尚无运行资源可 drain。

## 验证

- `MiningTaskQueue` 单元测试覆盖同 Bot 串行、跨 Bot 并发、结果与异常原样回传、失败后继续、完成 tail 留存和一次 shutdown 快照边界。
- 单元测试覆盖首次写入、覆盖旧文件、序列化失败、rename 失败、临时文件清理，以及共享玩家文件替换失败后的清理回归。
- 配置仓库测试覆盖正常读取、允许/拒绝缺文件、损坏 JSON、嵌套非法类型、串行写入、写失败恢复和 drain 期间追加写入；聊天监听 Store 测试覆盖多 Bot 默认隔离、旧字段归一化、显式空数组、深拷贝投影和删除检测，聊天监听 Lifecycle 测试覆盖订阅隔离、Runtime 引用匹配、解绑顺序/失败、watchdog 单例/停止、shutdown 错误隔离与 MCP 启停接线；Chat AI Store 测试覆盖注入默认值、数值归一化、文件秘密忽略、运行时字段保留、深拷贝投影、prompt 批量更新和热重载后的当前诊断写入；Agent Store 测试覆盖当前 planner 诊断与执行结果窄写入；AI 请求生命周期测试覆盖当前请求、旧代次隔离、取消、删除失效和批量停止；self-guard Store 测试覆盖默认隔离、上下限、布尔显式 false、健康阈值依赖、独立投影和删除检测；self-guard 受伤订阅测试覆盖幂等绑定、当前配置解析、过滤、emitter 替换和解绑；self-guard 循环生命周期测试覆盖按 Bot 主循环启动/替换、持续反击 interval 隔离/幂等、watchdog 单例、全量释放和非法间隔；反击状态测试覆盖 session 引用语义、Bot/攻击者隔离、精确衰减边界、按 Bot 清理和非法时间参数；周期状态测试覆盖生命/饥饿阈值、reactive vitals 不可用、首次双信号与顺序、重复抑制、critical 升降级、恢复清除、首次/同/异 Bot 引用、严格 `0.5` 健康下降容差、损坏历史 fail-closed、库存摘要、自身排除、无效距离、范围包含边界、首次进入/持续接近和非法范围；疑似攻击者测试覆盖精确选择距离、包含边界、同距顺序、自身/越界/损坏快照过滤、非法半径、后续目标的精确用户名/远距离保留/损坏位置 fail-closed，以及 tick 超时优先级、目标缺失、移动/攻击/冷却边界和非法输入；短期运行状态测试覆盖多 Bot 隔离、增量更新、嵌套副本、两级清理和非法数值；环境兼容测试覆盖正常采集、动态 truthy 兼容、缺失/异常字段默认值、首次观察抑制、双转场和反向/不变状态；配置重载测试继续覆盖运行时秘密保留、缺失条目删除和 MCP 成功标志边界。
- 生命周期测试覆盖顺序、重复调用和某个 hook 失败时仍执行剩余清理。
- 进程协调测试覆盖 fatal 同步锁定失败码、signal/fatal 竞争、hook 失败收敛和事件监听卸载。
- 全量运行测试、类型检查、构建和 diff 检查。
