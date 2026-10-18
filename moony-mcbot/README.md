# Moony MCBot

## 当前阶段

项目当前是面向原版/协议兼容服务器的本地 Minecraft 同伴 bot 成熟原型，正在从旧工具编排层收敛到统一 Agent、Action Dispatcher 与 ClientAdapter 运行链；真实整合包客户端 Bridge 尚未实现，也还不是经过完整真实服务器回归的稳定发行版。当前风险、应保留模块和实施顺序见 [2026-07-31 全项目架构与实现审计](docs/project-audit-2026-07-31.md)。

当前短期社交与人格运行态由 `SocialRuntimeStateStore` 按 Bot 隔离管理，包含最近互动、主动发言时间、回复上下文、心情和场景台词冷却。它只存在于进程内，不属于共享记忆或持久化配置；具体聊天、self-guard 和记忆编排仍在 `action-tools.ts`。Agent 的 planner 请求、计划到指令翻译和生产规划轮次已有独立边界，但旧 `StrategicPlanner` 兼容入口和执行队列仍在后续收敛中。Agent 调试状态的 framework、tail、trace 和 Web 事件出口已共用有界可观察视图，内部 `recentEvents` 仍保留给 Reactive 和 planner 输入。

聊天监听配置与运行资源也已分离：ConfigStore 保存开关和规则，`ChatListenerLifecycle` 按 Bot 管理实际订阅，并统一拥有监听 watchdog。消息处理、去重、重连协调和具体回复仍由 `action-tools.ts` 编排，外部 MCP、Web 和游戏行为不变。

## 快速入口

- 第一次启动或隔很久再次测试：[手动测试指南](docs/manual-testing-guide.md)
- 不知道该看哪份文档：[文档索引](docs/README.md)
- 查看当前架构和后续顺序：[架构收敛路线图](docs/architecture-convergence-roadmap.md)
- 查看未完成问题和当前任务：[TODO](TODO.md)

<details>
<summary>展开当前能力清单</summary>

最小实现已支持：
- 多 bot 实例注册（`bot.create`）
- Yggdrasil 1.8.0 认证 + 入服（`bot.connect`）；本地 HTTP 契约测试覆盖自定义 authserver、请求字段、profile 规范化和认证错误，真实外置认证仍需手测
- 状态查询（`bot.status`）
- 客户端适配状态查询（`client.adapter.status`）
- 断开连接（`bot.disconnect`）
- 基础行为（`chat.send` / `movement.walk` / `movement.stop` / `player.look`）
- 交互动作（`interact.eat` / `interact.attackPlayer` / `interact.attackNearestEntity` / `interact.openDoor`）
- 战斗准备（`combat.prepareBattle`，铁剑换入快捷栏第 1 格时使用 Promise 式安全槽位移动，满背包不会覆盖原物品）
- 实体对决（`combat.challengeEntity`）
- 传送请求（`chat.requestTeleportToPlayer`，发送 `/tpa <player>`）
- 物品操作（`inventory.holdSlot` / `inventory.holdByCategory` / `interact.dropHeld` / `interact.dropHotbarSlot`）
- 一键整理（`inventory.organizeHotbar`，规则：1剑/2斧/3镐/9食物）
- 观察工具（`observe.self` / `observe.inventory` / `observe.nearbyPlayers` / `observe.nearbyEntities` / `observe.blocks`）
- 可见性方块与挖矿（`block.findVisible` / `mine.digNearestVisible` / `mine.collectVisible`）
- 聊天发送校验（`chat.sendVerified`：发送并等待服务器回显）
- 跟随工具（`move.followPlayer` / `move.stopFollow`）
- 聊天挑战（白名单语句“`小狸 挑战 xxx`”触发 16 格内目标生物对决，目标死亡发“就这”）
- 路径寻路（基于 `mineflayer-pathfinder`，跟随/追击/定点移动只允许走安全寻路）
- 普通跟随、定点移动、追击和已迁移的单块采矿接近使用零破坏安全寻路配置，不会挖路、搭路、搭柱、放脚手架或走大落差；Pathfinder 缺失、拒绝目标，或首轮及后续重规划返回 `noPath`、`timeout`、明显长绕行时会停止并记录结构化失败，不再退化为直接前进；跟随失败只回复一次“我跟不上你啦”；`movement.walk` / `wander_area` 仍是限时直接前进，不在这项安全保证内且默认权限关闭
- AI 接管骨架（`agent.configure` / `agent.status` / `agent.runOnce`）
- Agent 状态快照（`agent.stateSnapshot`）
- 分层 runtime 调试（`agent.framework.status`）
- Agent 事件尾部与执行摘要（`agent.events.tail` / `agent.trace.summary`）
- 最小记忆层（`memory.player.upsert` / `memory.player.captureNearby` / `memory.player.delete` / `memory.player.listByTag` / `memory.place.upsert` / `memory.place.delete` / `memory.place.captureHere` / `memory.place.nearest` / `memory.place.listByTag` / `memory.place.goTo` / `memory.clear` / `memory.status`）
- 资源后勤基础入口（`container.inspectRemembered` / `container.depositMatching` / `container.withdrawMatching` / `container.depositAllByTag` / `container.depositAllExceptHotbar` / `container.withdrawByTag` / `container.withdrawFood` / `container.restockCombat` / `container.restockFood`，走到记忆地点后检查或存取附近箱子/木桶/潜影盒）
- 轻量领地模块（`territory.configure` / `territory.status`，基于 remembered places 对非白名单玩家先警告，持续逗留后升级为战斗）
- `socialize_whitelist` 现在通过 Adapter 玩家快照筛选候选，并参考玩家记忆（`relation` / `tags` / `lastSeenAt`）决定优先互动对象；最终按世界坐标转头仍是 Mineflayer 可选执行边界
- 自动战略 pass 现在会参考记忆里的优先地点（如 `home` / `base` / `safe` / `mine` 标签）和熟悉玩家，影响汇报对象与低频规划倾向
- 高确定性 strategic goal 现在也支持记忆地点激活：`回家` / `回基地` / `去安全点` 这类目标会优先命中已记住地点，不依赖 planner
- AI 聊天唤醒上下文现在会带上当前说话人的记忆关系与回应策略提示（owner / trusted / default）
- `memory.player.upsert` 现在支持 `alias`，例如把 `Judy` 记成 `茉莉`；更新后会立即影响社交 fallback、AI 聊天上下文和规划提示，不需要重启
- milestone 推进现在更偏真实任务结果：`follow` 的“开始阶段”在成功启动跟随后推进，`mine/move` 更依赖任务完成结果而不是泛关键词
- 其中 `mine` 类 milestone 现在会直接参考任务 payload（如 `minedCount`），不是只看文本 detail
- `goal_completed / goal_abandoned` 在附近有可信玩家时，现在会先走一条本地汇报 fallback（例如“搞定了。”/“这个先不做了。”），再交给后续战略层继续调整
- 战略目标管理（`agent.goal.status` / `agent.goal.set` / `agent.goal.advance` / `agent.goal.rewind` / `agent.goal.clear`）
- 分层智能体骨架（`src/agent/`：事件总线 / 黑板 / 反应规则 / 技能目录 / 层次运行时）
- 客户端适配层骨架（`ClientAdapter` / Factory / `MineflayerAdapter`，为未来整合包客户端桥接预留底层抽象）
- 客户端连接与断开生命周期已统一经过 Adapter：手动断开、连接失败和进程退出都会等待 Mineflayer `end`（最多 5 秒），并发断开幂等，断开期间拒绝重连；Runtime 只清理自己注册的监听器。直接调用 `BotRuntime.disconnect()` 的 TypeScript 代码必须 `await`，MCP `bot.disconnect` 契约保持不变
- `ClientAdapterFactory`、`BotRuntime` 与 `BotRegistry` 已支持内部构造注入，并校验请求/返回 kind 一致；默认仍固定 Mineflayer，`BotCreateInput`、MCP、环境变量和持久化配置尚未开放 Adapter 选择，Fake `modded-client` 通过构造测试不代表 Bridge 可以连接
- `move.stopFollow`、`interact.eat`、`inventory.holdByCategory` 与 `interact.openDoor` 已作为统一 Command Invocation / Action Result 的前四个试点：各自的 MCP、Web 和 Agent 入口经过共享 dispatcher handler，并记录来源、requestId、耗时及 `executed` / `failed` 终态；各入口原有参数和返回文本保持不变。当前 `executed` 只表示 handler 完成，不代表服务器已确认游戏动作
- 单块采矿 Adapter（`mineBlock` / `mine_block`）负责安全接近、目标复核、工具选择和一次挖掘；`mine.digNearestVisible` 已作为首个兼容试点，其他批量采矿入口等待游戏内回归
- 旧批量采矿四条执行入口的按 Bot 串行 Promise tail 已由 `MiningTaskQueue` 管理，原结果、错误隔离与 shutdown 单次快照等待语义不变；这不代表批量采矿已迁入 Adapter 或完成游戏内验收
- Agent 核心工具 Catalog（`src/catalog/tool-catalog.ts`）统一当前 17 项默认 allowlist 的 ID、标题、领域、风险和受众；持久化自定义 allowlist 保持兼容，MCP 注册仍按领域逐步迁移
- Agent 核心目录中的 Observe、Inventory、Interaction、Combat、`mine.collectVisible` 以及现有 Movement/Chat MCP 工具已读取 Catalog 名称和描述；MCP SDK 已精确固定为 1.30.0，并由内存传输协议测试覆盖工具发现和调用，风险、输入 schema、handler 和返回结构保持不变；`move.goToPosition` 与 `chat.requestTeleportToPlayer` 仍是内部执行 ID，`mine.digNearestVisible` 继续使用原 MCP 注册入口
- Skill Module 现在声明完整工具依赖，并可离线审计 allowlist；当前四项权限缺口保持关闭，详见 `docs/skill-permission-policy.md`
- `interact.eat` 已补齐 Agent 参数执行器并复用 `BotRuntime.eatFood()`，三入口实际执行还会写入统一 Command History；默认 allowlist 仍不开放该工具
- `inventory.holdByCategory` 的三入口实际执行已统一复用 `BotRuntime.holdItemByCategory()` 并写入 Command History；原类别 trim、错误文本、Web 返回体和默认 Agent 权限保持不变
- `interact.openDoor` 的三入口实际执行已统一复用 `BotRuntime.openDoor()` 并写入 Command History；MCP 严格范围、Web 可选 number、Agent 数值转换、原返回体和默认权限继续各自兼容
- 上述四个统一命令（含 `move.stopFollow`）的 canonical schema、输出校验、handler 和 typed invocation 已集中到 `src/commands/action-command-set.ts`；MCP/Web/Agent 入口仍只负责各自兼容映射
- `socialize` / `observe_target` 只有在提供完整有限 `yaw/pitch` 时才编译为 `player.look`；无有效角度时改用附近玩家/实体观察，超时恢复不再生成无效转头参数
- `player.look` 已补齐 Agent 内部 dispatcher，严格校验有限数字角度和可选布尔 `force` 后复用 `BotRuntime.look()`；默认 allowlist 仍不开放该工具
- `movement.walk` 已补齐 Agent 内部 dispatcher：严格校验 100-60000ms 整数时长和布尔参数，取消旧移动并保证到时停止；因尚无地形前视/落差保护，默认 allowlist 仍不开放
- `movement.walk` 的每 Bot 停止 timeout 已由 `src/runtime/walk-timer-lifecycle.ts` 统一管理；Agent/MCP 入口和进程关闭保留原创建、到期与清理顺序，停止移动和 movement intent 副作用仍由 `action-tools.ts` 编排
- Agent executor 的每 Bot interval 与串行运行 tail 已由 `src/runtime/agent-executor-lifecycle.ts` 统一管理；任务 timeout timer、executor tick 冷却门、planner 冷却判定、task progress 节流、战略生命周期去重、库存变化事件基线和空闲社交尝试冷却由 `HierarchicalAgentRuntime` 管理，`lastPlanAt` 仅保留为诊断镜像；状态、配置删除和退出 flush 保持原不可取消与单次快照语义，planner 请求/工具执行、生命周期提示、完成汇报、库存事件发布和具体空闲社交副作用仍由 `action-tools.ts` 编排
- Agent 最近任务历史已由 `src/runtime/agent-task-history-store.ts` 按 Bot 管理，读取返回副本并稳定保留最近 20 条；任务结算和 `memory.taskHistory` 持久化组合仍由 `action-tools.ts` 负责
- Agent 模型请求已抽到 `src/agent/openai-agent-planner.ts`，单次请求生命周期已抽到 `src/agent/planner-request-runner.ts`，计划到战略指令的纯翻译已抽到 `src/agent/plan-to-directive.ts`；`DefaultAgentPlanningStrategy` 与 `AgentPlanningTurnCoordinator` 已让 MCP、Web、自动规划共用一轮次，离线接线回归覆盖 MCP → 黑板 → Skill → 命令 → 模拟客户端。失效后的迟到计划不会更新目标、入队或发言；旧 `StrategicPlanner` 接口仍保留，真实 API/游戏证据仍待手测，详见 [Agent 模块](src/agent/README.md#规划请求边界) 与 [注入设计](docs/strategic-planner-injection-design.md)
- Agent 玩家/地点工作集与共享基线已由 `src/memory/agent-game-memory-state-store.ts` 按 Bot 管理，统一复制、严格较新合并、跨 Bot 快照、清空和删除；输入归一化、时间戳、旧配置投影与共享文件队列仍由 `action-tools.ts` 编排
- Agent 领地配置已由 `src/config/territory-config-store.ts` 按 Bot 管理；`src/runtime/territory-runtime.ts` 组合玩家 presence、短期状态和警告/升级判定，并固定 prune、状态写回与副作用 hook 顺序；配置/记忆/快照采集及聊天、事件、决斗 hook 仍由 `action-tools.ts` 提供
- `chat.send` / `chat.sendVerified` 已开始走 adapter/runtime 统一发送入口，`chat.sendVerified` 的服务器回显等待仍沿用原生 mineflayer 事件
- `chat.requestTeleportToPlayer` 和“来找我”TPA 硬规则现在也复用 adapter/runtime 统一发送入口
- 部分本地自动汇报/警告（战略目标完成汇报、领地警告、挖矿开始/结束提示）也开始复用 adapter/runtime 发送入口
- 白名单聊天监听里的固定回复（状态、战斗准备、挑战、跟随失败、吃东西、整理、开门、攻击等）也开始复用 adapter/runtime 发送入口
- planner `speak` 和 agent step `speak` 现在也复用 adapter/runtime 发送入口；`action-tools.ts` 已不再直接调用原生 `bot.chat()`
- self-guard 自动进食和白名单聊天里的“吃东西”意图现在也复用 `runtime.eatFood()`；具体 `consume()` 调用集中在 adapter 内部
- self-guard 周期 tick 的生命、饥饿、食物背包、库存变化和附近玩家检测现在读取 Adapter 快照；缺失/非有限 vitals 时不会误触发告警、停跟随或进食。聊天告警开关与冷却边界、低生命/低饥饿 reactive 信号的首次进入、重复抑制、critical 升降级与 payload，Bot 引用变化、严格超过 `0.5` 的健康下降，以及附近玩家的自身排除、距离边界与首次进入转场均已由纯 runtime 决策管理。主/持续反击 interval 与 watchdog 句柄、反击 session/命中衰减、告警冷却/上一轮观察状态、昼夜/下雨兼容读取与转场判定，以及受伤后的最近疑似攻击者选择、后续反击目标复核和持续反击 tick 决策均由独立 runtime 边界管理；目标复核使用 Adapter 坐标重算精确距离，tick 决策保持 60 秒超时、3 格移动边界、配置攻击距离和 600ms 冷却。允许告警时仍先记录冷却再尝试发送，聊天失败不会回滚。Agent 事件发布和 reactive flags 写入仍在旧编排层；环境输入暂时仍来自原生 Mineflayer Bot，受伤事件也仍是 Mineflayer 边界，但 listener 已由独立 registry 管理并在触发时读取当前配置。`entityHurt` 不提供真实伤害来源，完整 tick、Adapter 世界环境快照、追击和攻击动作仍待迁移
- `follow` 链的距离决策、稳定玩家实体 ID 追击、停止和目标丢失时的观察转头均已通过 adapter/runtime 边界；Mineflayer pathfinder/control-state 只保留在具体 adapter 内，安全追击在首轮或后续重规划不可达、超时或绕行过长时会结束任务并只反馈一次
- 跟随的 interval、session 元数据和 movement subscription 已由 `src/runtime/follow-session-lifecycle.ts` 统一管理；普通停止和进程关闭保留原清理顺序。跟随 tick、任务结算和失败聊天仍由 `action-tools.ts` 编排，真实服务器跟随/断线回归仍需手测
- 定点移动的 interval 与 movement subscription 已由 `src/runtime/position-movement-lifecycle.ts` 统一管理；普通停止、self-guard 停止和进程关闭保留旧清理顺序。安全路径决策、任务结算和停止移动仍由 `action-tools.ts` 编排，离线通过不代表真实服务器地形回归已完成
- 持续对决的 interval、session 元数据和 entity/movement subscription 已由 `src/runtime/duel-session-lifecycle.ts` 统一管理；普通停止和进程关闭保留原清理顺序。目标选择、追击/攻击、聊天和任务结算仍由 `action-tools.ts` 编排，真实服务器决斗与断线回归仍需手测
- follow、定点移动、决斗、聊天攻击和采矿共用的当前移动相关标识已由 `src/runtime/movement-intent-store.ts` 管理，用于屏蔽旧 Promise 和 movement event；该本地 key 不是 Pathfinder goal 或服务器动作确认
- `observe.self` 现在完全读取统一的 self/inventory adapter 快照；`observe.nearbyPlayers` 也优先读取 adapter 快照
- `observe.nearbyEntities` 现在也开始优先读取 adapter 快照；实体筛选与返回字段保持原工具形态
- `observe.blocks` 的脚下方块和准星方块现在开始优先读取 adapter 快照；更复杂的可见方块扫描仍保留在原生 `mineflayer` 路线中
- `observe.inventory` 的基础背包/手持/槽位快照现在开始优先读取 adapter 快照；容器会话和槽位交互仍保留在原生 `mineflayer` 路线中
- `agent.stateSnapshot.selfState` 的自身状态、装备、背包汇总、空槽、食物和工具摘要，`localWorld.terrain` 的脚下/准星方块，以及附近玩家/非玩家实体现在读取统一 adapter 快照；可见扫描、效果与路径信息仍保留在原生 `mineflayer` 路线中
- 云端 planner 不再接收完整 `agent.stateSnapshot`：请求只包含生命/装备/任务/目标等字段白名单和去坐标的附近摘要；完整坐标、实体 ID、任务 params、记忆 notes 与事件 payload 仍只留在本地调试链，详见 [Planner 上下文投影设计](docs/planner-context-projection-design.md)
- Agent 内部 `observe.self` 的紧凑规划摘要现在也只读取 Adapter 的自身、背包、玩家和实体快照；缺失或非有限的可选生命/饥饿字段显示 `unknown`，不会让整段上下文退化为不可用
- AI 闲聊的动态状态基础字段也改读 Adapter 的自身、背包、玩家和方块快照；精确实体注视暂时保留为 Mineflayer 可选增强，断线时继续使用原有简化状态
- `perception.salient` 与 Agent state snapshot 的附近玩家关系和重要实体筛选现在读取 Adapter 快照；可交互方块扫描仍保留为 Mineflayer 增强
- self-guard 结束后的就近白名单汇报目标现在由 Adapter 玩家快照选择，不再遍历原生 Mineflayer 玩家表；后续移动仍复用既有安全定点移动链
- Web / MCP 的当前位置记录、最近地点查询和地点移动维度校验现在读取 Adapter 自身快照；地点坐标持久化与查询返回继续保留三位小数，容器方块扫描仍是 Mineflayer 专用逻辑
- 领地警告的入侵者选择、presence 清理、主人在场、警告冷却和升级状态已由 `TerritoryRuntime` 统一协调；它只消费 Adapter 快照并调用注入 hooks，领地半径、分支优先级、事件文案、handled 返回及后续稳定实体 ID 决斗链保持不变
- auto 战略目标的确定性跟随激活使用 Adapter 玩家快照，记忆地点激活使用 Adapter 自身维度与普通坐标；原有激活返回字段、事件和跟随参数保持不变
- `follow_owner` 空闲策略现在使用 Adapter 自身/主人快照决定原地等待、开始跟随或退回记忆地点；4.5 格跟随、8 格冲刺、3.5 格回退触发和既有安全移动入口保持不变
- Agent 内部 `move.goToPosition` dispatcher 现在直接把普通坐标交给安全定点移动链，不再为了构造 Mineflayer Vec3 读取原生 bot 句柄；工具参数、返回文本和默认停止半径保持不变
- `movement.walk` / `movement.stop` / `player.look` 现在走 adapter/runtime 统一入口；follow 与固定坐标移动的距离决策、追击、到达和停止也已通过 adapter 边界，固定坐标移动和实体追击会审计首轮及后续安全路径结果，并以 `movementId` 隔离旧目标的迟到失败；挖矿专用 pathfinder 循环仍在迁移
- `inventory.holdSlot` / `inventory.holdByCategory` / `inventory.organizeHotbar` 现在走 adapter/runtime 统一入口；快捷栏整理先由纯规划器生成安全槽位移动，再由客户端适配层执行
- `interact.swing` / `interact.dropHeld` / `interact.dropHotbarSlot` / `interact.rightClick` / `interact.eat` / `interact.openDoor` / `interact.attackPlayer` / `interact.attackNearestEntity` 现在开始走 adapter/runtime 动作入口；聊天中明确玩家的远距离攻击意图通过稳定实体 ID 追击并保持“只靠近、不自动补刀”，持续决斗的目标选择、时序、生命周期、追击和攻击也已完整通过 adapter 边界
- 测试、架构、契约、规划和历史文档统一从 `docs/README.md` 导航
- 手动测试只维护 `docs/manual-testing-guide.md` 一套主流程
- Release entry 契约与归档边界（`docs/release-entry-lifecycle.md`）
- 整合包客户端适配规划（`docs/modded-client-adapter-plan.md`）
- 游戏 / TTS 共享记忆迁移规划（`docs/shared-memory-plan.md`）
- 游戏 / TTS / 直播共享提示词与上下文规划（`docs/shared-prompt-context-plan.md`）
- 灵感收集箱（`docs/idea-inbox.md`）
- 启动自动恢复默认 bot（环境变量）
- `SIGINT` / `SIGTERM`、未处理 Promise、未捕获异常和启动失败共用幂等 shutdown；fatal 会立即锁定失败退出码，动作 runtime 不等待 Web 活动连接完全排空才停止
- Local Web debug panel (bot status / agent status / trace / observe / snapshot / memory / territory / recent events + common action buttons)

</details>

## Requirements

- Node.js 22+；Node 20 已不再属于项目支持范围。仓库 `.nvmrc` 默认选择 Node 22。
- Mineflayer 精确锁定为 4.35.0，CI 同时验证 Node 22 与 24 两条 LTS 线。4.37.x 尚未完成真实登录和游戏行为回归，不会由宽松 semver 范围自动引入。

## Install

```bash
npm install
```

## Run (stdio MCP)

```bash
npm run dev
```

## Verify

```bash
npm run validate:releases
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run validate:releases` 会只读检查全部未发布条目的文件名、frontmatter 与正文契约。`npm run typecheck` 会分别检查生产源码，以及 `scripts/**/*.ts` 与 `test/**/*.ts`；`npm test` 使用 `tsx --test` 自动发现测试文件，并预加载临时运行时路径 setup，不需要手工维护测试清单，也不会读取真实 AppData、共享记忆或旧 prompt profile。定向执行使用 `npm test -- test/example.test.ts`，不要绕过默认 setup。生产构建仍只读取 `tsconfig.json` 中的 `src/**/*.ts`。

MCP SDK 1.30.0 的离线兼容测试会经过真实的 SDK Client、内存 Transport 和 McpServer 调用项目工具注册封装。外部 stdio 客户端、真实登录和游戏内动作仍按 `docs/manual-testing-guide.md` 手动验证。

Yggdrasil 已精确固定为 1.8.0。离线测试使用随机本机端口和假凭据验证现有 `AuthService` 的真实 HTTP 编码与响应处理，不读取正式账号；它不能替代第三方认证服务、session server 与 Minecraft spawn 回归。

当前自动化测试覆盖离线 runtime 的 client-adapter 状态、动作历史上限、错误记录、聊天脱敏，以及 Command/Action 调试历史的递归秘密脱敏；真实登录与游戏内动作仍按 `docs/manual-testing-guide.md` 手动验证。

仓库根目录的 GitHub Actions 会在 `moony-mcbot/**` 变化时按上述顺序执行干净安装与验证；release entry 契约与尚未执行的归档流程见 [Release Entry 生命周期](docs/release-entry-lifecycle.md)，其余门禁见 [Lint 与 CI 设计](docs/lint-ci-design.md)。

## Debug Web Panel

- 服务启动时会默认在本机启动一个本地调试面板：
  - `http://127.0.0.1:4637`
- 面板内容：
  - `bot status`
  - `agent status`
  - `trace summary`
  - `prompt profile`
  - `client adapter`
  - `chat listener`
  - `chat ai`
  - `observe self / inventory / nearby players / nearby entities / blocks`
  - `state snapshot`
  - `memory`
  - `shared chat memory`
  - `territory`
  - `command history`
  - `action history`
  - `recent events`
- 面板 UI：
  - 明亮主题
  - 常用按钮和状态区块使用中文 + 英文标签
  - 鼠标悬停按钮可看到更具体的中文说明
  - 常用弹窗和状态栏消息也使用中文优先、英文辅助的提示
  - 顶部按钮按状态、历史、目标、聊天、物品、交互、危险动作分组
  - 顶部四张概览卡会用颜色和徽标标出就绪、进行中、等待或异常状态
  - 点击概览卡可自动展开并定位到对应的详细状态；支持 Enter 或空格键
  - `Attack Nearest` 会使用单独的风险样式，避免与普通操作混淆
- 常用视图控制：
  - `Pause Refresh` / `Resume Refresh`：暂停或恢复页面每 3 秒自动刷新，不影响 bot 运行
  - `Expand All`
  - `Collapse All`
- 面板区块的展开/折叠状态会保存在当前浏览器中；刷新页面后保留，清除浏览器站点数据后恢复默认。
- `Raw Action Runner` 可以用 JSON 调用当前 Web 面板已有的 `/api/action/*` 调试动作，并可自动注入当前选中的 `botId`。
- `Raw Action Runner` 会在当前浏览器保留动作选择、JSON 和 `botId` 自动注入选项；清除浏览器站点数据后恢复默认模板。
- `Copy Result` / `Copy JSON` 用于复制最近动作结果和 raw action 参数，方便远程测试时保存证据。
- `Copy History` / `Download History` 用于导出当前 `Action History`，方便保存一次远程测试会话的完整动作记录。
- `Clear History` 会清空当前选中 bot 的 Web action history，并保留一条清理动作记录。
- `Copy Snapshot` / `Download Snapshot` 用于导出最近一次完整 `/api/debug` 状态快照，方便一次性分享全部面板状态。
- 当前内置快捷动作：
  - `Set Goal`
  - `Advance Goal`
  - `Rewind Goal`
  - `Run Once`
  - `Reload Prompt`
  - `Enable hi Reply`
  - `Enable AI Chat`
  - `Hold Slot`
  - `Hold Category`
  - `Eat`
  - `Right Click`
  - `Open Door`
  - `Attack Nearest`
  - `Clear Goal`
  - `Stop Follow`
  - `Capture Place`
- `Set Goal` 使用集中表单一次填写目标、理由、里程碑与起始索引；表单会先显示字段说明和完整的 `Follow Judy` 示例。里程碑可每行一项或用英文逗号分隔，不再连续弹出多个输入框。
- The panel shows the raw JSON result of the last quick action and exposes common `observe` snapshots as separate sections, so daily checks do not require CherryStudio or MCP Inspector.
- `Action History` keeps the latest Web quick actions with timestamp, payload, result, and error status. Stored payload/result/error values use the same recursive diagnostic redaction as Command History; HTTP responses remain unchanged, and real credentials must never be used as test fixtures.
- `Command History` 当前记录 `move.stopFollow`、`interact.eat`、`inventory.holdByCategory` 与 `interact.openDoor` 从 MCP、Web 或 Agent 发起的统一终态；它不保存原始输入，也不会把 `executed` 显示成游戏确认。其他动作仍只出现在原有 Web 或 Adapter 历史中。
- `Prompt Profile` shows the active prompt file paths, including the shared memory path, and `Reload Prompt` hot-reloads the file after edits.
- `Shared Chat Memory` shows the rolling chat-memory paths, pending counts, summary threshold, and whether a summary API key is available.
- `Attack Nearest` debug results include a `selection` object with nearby candidates, filter reasons, and a hint, so failed attacks can be diagnosed without relying only on the game screen.
- `Client Adapter` 显示最近 24 条经统一 adapter 入口执行的动作；聊天动作只显示 `chat sent`，不在该面板回显聊天内容。
- `Client Adapter` 在 Web 展示中会为能力和动作补中文说明，同时保留原始 `id` / `action` 字段，方便对照代码与日志。
- 非 Web 客户端可调用 `client.adapter.status` 查询同一份 adapter 类型、连接状态、能力表与最近统一动作记录。
- 面板会持续轮询并自动重新发现 bot：
  - 如果页面先打开、bot 后上线，不需要手动刷新整个页面
  - 在等待期间会显示 `waiting for bot runtime...`

可选环境变量：
- `MCBOT_DEBUG_WEB_ENABLED`：默认 `true`
- `MCBOT_DEBUG_WEB_HOST`：默认 `127.0.0.1`
- `MCBOT_DEBUG_WEB_PORT`：默认 `4637`
- `MCBOT_DEBUG_WEB_AUTH_TOKEN`：设置后所有 `/api/*` 请求需要 Bearer token；绑定非回环地址时必须设置
- `MCBOT_DEBUG_WEB_ALLOWED_ORIGINS`：逗号分隔的浏览器 Origin 白名单；不设置时仅允许面板自身的本机 Origin
- `MCBOT_DEBUG_WEB_MAX_BODY_BYTES`：POST JSON 请求体上限，默认 `65536`，最大 `1048576`
- 局域网访问时可打开 `http://<host>:<port>/?token=<MCBOT_DEBUG_WEB_AUTH_TOKEN>`，前端会把 token 放入当前浏览器 sessionStorage 并清理地址栏参数

## Auto Bootstrap Default Bot (Recommended)

通过环境变量让服务启动后自动 `bot.create`，并可选自动 `bot.connect`。

最省心的本地方式：

1. 复制 `.env.local.example` 为 `.env.local`
2. 在 `.env.local` 里填账号、密码和可选 `MCBOT_AI_API_KEY`
3. 用统一脚本启动 MCP server

```powershell
if (-not (Test-Path .env.local)) {
  Copy-Item .env.local.example .env.local
}
powershell -ExecutionPolicy Bypass -File .\scripts\start-mcp-server.ps1
```

进程入口会自动读取仓库根目录的 `.env.local`，所以直接用 `node dist/main.js` / `npm start` 启动时同样会生效；如果需要使用其它 env 文件，可以先设置 `MCBOT_ENV_FILE` 指向目标文件。加载副作用只存在于 `main` 的 bootstrap 边界，普通业务模块和自动化测试导入不会读取工作区 `.env.local`。

`.env.local` 已被 git ignore，不要提交。

PowerShell 手动设置示例（只对当前会话生效）：

```powershell
$env:MCBOT_DEFAULT_ENABLED = "true"
$env:MCBOT_DEFAULT_BOT_ID = "XiaoLi_26.3.3_newnancity"
$env:MCBOT_DEFAULT_AUTH_API_BASE_URL = "https://authmc.newnan.city"
$env:MCBOT_DEFAULT_USERNAME = "<your-username-or-email>"
$env:MCBOT_DEFAULT_PASSWORD = "<your-password>"
$env:MCBOT_DEFAULT_SERVER_HOST = "main.newnan.city"
$env:MCBOT_DEFAULT_USE_SRV = "true"
$env:MCBOT_DEFAULT_VERSION = "1.20.1"
$env:MCBOT_DEFAULT_AUTO_CONNECT = "true"
$env:MCBOT_DEFAULT_AUTO_CONNECT_DELAY_MS = "5000"
```

可选参数：
- `MCBOT_DEFAULT_SERVER_PORT`（默认 25565）
- `MCBOT_DEFAULT_AUTO_RECONNECT`（默认 true）
- `MCBOT_DEFAULT_MAX_AUTO_RECONNECT_ATTEMPTS`
- `MCBOT_DEFAULT_RECONNECT_BASE_DELAY_MS`
- `MCBOT_DEFAULT_RECONNECT_MAX_DELAY_MS`
- `MCBOT_DEFAULT_CONNECT_MAX_RETRIES`

### Inspector Notes

- 你当前用的 VS Code `MCP Inspector` 面板是“手动连接器”，不会自动读取 `mcp.json`。
- 也就是说，单独写 `mcp.json` 不会让这个面板自动带出默认 bot。
- 对这个面板，最稳的做法是直接用启动脚本；脚本会读取 `.env.local`：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-inspector-default-bot.ps1
```

- 如果你要在 Inspector 的手动表单里填：
  - Command: `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`
  - Arguments: `-NoProfile -ExecutionPolicy Bypass -File C:\xiaoli\moony-mcbot\scripts\start-mcp-server.ps1 -SkipBuild`
- 如果你要给支持 `mcp.json` 的客户端用，当前已有本地文件：
  - `C:\xiaoli\mcp.json`
- 这个 `mcp.json` 不应包含账号、密码或 API key，只负责调用 `start-mcp-server.ps1`。

### Default Chat Listener

如果你希望启动后游戏内直接能用固定回复，例如 `hi小狸 -> hihi`，可以在 `.env.local` 里启用：

```text
MCBOT_DEFAULT_CHAT_LISTENER_ENABLED=true
MCBOT_DEFAULT_CHAT_WHITELIST=Judy
MCBOT_DEFAULT_CHAT_WAKE_NAMES=小狸
MCBOT_DEFAULT_CHAT_HI_REPLY=hihi
```

说明：

- 这只影响默认 bot，即 `MCBOT_DEFAULT_BOT_ID`
- `MCBOT_DEFAULT_CHAT_WHITELIST` 用英文逗号分隔多个玩家名
- 如果本地持久化配置里显式设置了 `specialReplies: []`，那代表你有意清空固定回复
- 启动后也仍然可以用 `chat.listener.configure` 覆盖

### Default Chat AI

`MCBOT_AI_API_KEY` 只提供模型调用密钥，不会自动开启游戏内 AI 闲聊。若希望启动后直接能用 `小狸 ...` 触发闲聊，可以在 `.env.local` 里启用：

```text
MCBOT_AI_API_BASE_URL=https://api.openai.com/v1
MCBOT_DEFAULT_CHAT_AI_ENABLED=true
MCBOT_DEFAULT_CHAT_AI_WHITELIST=Judy
MCBOT_DEFAULT_CHAT_AI_WAKE_WORD=小狸
MCBOT_DEFAULT_CHAT_AI_MODEL=gpt-5-nano
```

也可以启动后在 Web 调试面板点击 `Enable AI Chat` 临时开启。

说明：

- `MCBOT_AI_API_BASE_URL` 同时作为 `chat.ai` 和 agent planner 的默认 API base URL。
- `MCBOT_AI_API_BASE_URL` 填 OpenAI-compatible base URL，例如 `https://api.openai.com/v1` 或 `https://api-inference.modelscope.cn/v1`；不要填完整的 `/chat/completions` endpoint。
- 启动时覆盖顺序是：代码默认值 -> `chat-configs.json` 持久化值 -> `.env.local` 环境变量；因此修改 `MCBOT_AI_API_BASE_URL` 或 `MCBOT_AI_MODEL` 后，已有配置也会使用新值。
- 模型请求默认超时 15 秒，可用 `MCBOT_AI_REQUEST_TIMEOUT_MS` 统一调整，或用 `MCBOT_CHAT_AI_TIMEOUT_MS`、`MCBOT_PLANNER_TIMEOUT_MS`、`MCBOT_MEMORY_SUMMARY_TIMEOUT_MS` 分层覆盖。
- 请求状态可在 `chat.ai.status.lastRequest`、`agent.status.lastPlannerRequest` 和 `memory.chat.status.lastSummaryRequest` 查看；chat AI 还会标记是否进入 fallback。
- 如果需要运行时分开配置，可以用 `chat.ai.configure.apiBaseUrl` 和 `agent.configure.plannerApiBaseUrl`。
- planner、AI 闲聊和聊天记忆总结现在共用 `src/runtime/openai-compatible-client.ts` 处理 endpoint、Bearer 鉴权、JSON POST 与超时；三条链仍分别维护自己的 prompt、fallback、响应解析和错误文案。

### Shared Chat Memory

- 白名单玩家与小狸的聊天会进入共享记忆短期缓冲。
- 未满 20 条时，pending 缓冲保存在 `C:\xiaoli\memory\chat-summary-state.json`，用于抗重启。
- 满 20 条后会生成滚动摘要，写入：
  - `C:\xiaoli\memory\chat-summaries.jsonl`
  - `C:\xiaoli\memory\episodes.jsonl`
- `chat-summary-state.json` 当前使用 `version: 2`：pending 与滚动摘要均按 `botId` 隔离，后续 AI 闲聊只读取当前 Bot 的 `summariesByBotId[botId]`，不会把 pending 原文或其他 Bot 的摘要塞进提示词。
- 启动时兼容迁移旧 `version: 1`：只有一个候选 Bot 时自动归属旧摘要；归属不明确时只保存在 `unassignedLegacySummary`，不会注入任何 Bot。
- 可用 `memory.chat.status` 查看 pending 数量、summary 路径、状态版本、摘要 Bot 列表和是否存在未归属旧摘要；状态接口不会返回摘要正文。

### Shared Game Memory

- `memory.player.*` 与 `memory.place.*` 继续保存到原有运行时配置，同时异步双写到共享目录的 `players.json` 和 `places.json`。
- 内存工作集和共享基线由 `AgentGameMemoryStateStore` 管理；`SharedGameMemoryStore` 只负责共享文件规范化与原子 I/O，二者都不接管 territory 或 Voice 的写入权限。
- 共享目录默认是 `C:\xiaoli\memory`；可用 `XIAOLI_MEMORY_DIR` 或兼容的 `MCBOT_MEMORY_DIR` 覆盖。
- 删除玩家/地点，以及 `memory.clear` 的 `players`、`places` 或 `all` 范围，也会同步更新共享文件。
- Web 调试面板的 `Shared Game Memory` 显示路径、文件记录数、最后写入时间和错误；写入队列是异步的，刷新一次后仍可等待下一次自动刷新确认。
- `players.json` 与 `places.json` 复用公共原子 writer，以同目录排他临时文件完成同步和 rename，失败时清理临时文件；上层持久化队列继续负责快照写入顺序。
- 启动时会先恢复旧 `chat-configs.json`，再按 `updatedAt` 合并共享文件中更新更晚的同名记录；旧配置独有的记录保留作为 fallback。可用 `memory.status.sharedGameMemory` 或 Web 面板确认导入状态。
- 任务历史、聊天 pending、账号、密码与 API key 不会写入这两个共享文件。

## Tool flow example

1. `bot.connect`（`botId` 可省略：当且仅当实例唯一时自动选择）

```json
{}
```

2. `observe.self`

```json
{
  "botId": "moony-1"
}
```

3. `observe.nearbyPlayers`

```json
{
  "botId": "moony-1",
  "radius": 32
}
```

4. `move.followPlayer`

```json
{
  "botId": "moony-1",
  "playerName": "SomePlayer",
  "minDistance": 2.5,
  "maxDistance": 24,
  "sprint": false,
  "tickMs": 250
}
```

5. `move.stopFollow`

```json
{
  "botId": "moony-1"
}
```

## Observe Contract

- 观察类工具现在按“机器字段优先，展示字段附加”输出。
- 优先依赖这些字段做判断：
  - `name`
  - `type`
  - `entityId`
  - `position`
- `displayName` 仅用于展示，不应该作为决策主键。
- 当前已统一到这几个工具：
  - `observe.self`
  - `observe.nearbyPlayers`
  - `observe.nearbyEntities`
  - `observe.blocks`
  - `observe.inventory`

## Territory

- `territory.configure`
  - 基于已记住地点配置轻量领地警告
  - 当前行为：先警告，持续逗留超过 `escalationDelayMs` 后进入战斗
  - 可按 `ownerPresencePolicy` 区分主人在场/不在场时的升级策略
- `territory.status`
  - 查看当前领地配置和已解析出的 remembered places

最小示例：

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "enabled": true,
  "placeIds": ["home_main"],
  "requiredTags": ["home", "base"],
  "radius": 12,
  "warningCooldownMs": 30000,
  "warningMessage": "走开。",
  "ownerPresencePolicy": "owner_nearby_only",
  "escalationEnabled": true,
  "escalationDelayMs": 8000
}
```

- `requiredTags`
  - 可选
  - 仅当 remembered place 自身带有这些标签时，才作为领地生效
  - 例如只对 `home` / `base` 类型地点启用领地
- `ownerPresencePolicy`
  - `owner_nearby_only`：默认。只有主人在领地附近时才会从警告升级到战斗
  - `always`：主人不在场也允许升级到战斗

## Containers

- `container.inspectRemembered`
  - 基于 remembered place 找附近容器并读取内容
  - 当前支持：
    - `chest`
    - `trapped_chest`
    - `barrel`
    - `*_shulker_box`
- `container.depositMatching`
  - 按物品名把背包物品存入 remembered container
- `container.withdrawMatching`
  - 按物品名从 remembered container 取出物品
- `container.depositAllByTag`
  - 按固定后勤标签批量存入
  - 当前标签：
    - `food`
    - `fish`
    - `blocks`
    - `ores`
    - `tools`
    - `combat`
    - `misc`
- `container.depositAllExceptHotbar`
  - 批量存入主背包物品
  - 不碰快捷栏、护甲、副手
- `container.withdrawByTag`
  - 按固定后勤标签批量取出
- `container.withdrawFood`
  - 从容器取食物
  - 可选优先指定一个精确食物名
- `container.restockCombat`
  - 组合动作
  - 先从容器取战斗物资，再执行战斗准备
- `container.restockFood`
  - 组合动作
  - 先从容器取食物，再切到食物手持

最小示例：

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "placeId": "warehouse_main",
  "autoMove": true,
  "stopRadius": 2.5,
  "searchRadius": 1.5
}
```

存入示例：

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "placeId": "warehouse_main",
  "query": "cobblestone",
  "matchMode": "exact",
  "count": 32
}
```

取出示例：

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "placeId": "warehouse_main",
  "query": "beef",
  "matchMode": "includes",
  "count": 16
}
```

按标签批量存入示例：

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "placeId": "warehouse_main",
  "tag": "blocks"
}
```

批量存主背包示例：

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "placeId": "warehouse_main"
}
```

按标签批量取出示例：

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "placeId": "warehouse_main",
  "tag": "combat",
  "count": 16
}
```

取食物示例：

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "placeId": "warehouse_main",
  "count": 16,
  "preferredItemName": "cooked_beef"
}
```

战斗补给示例：

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "placeId": "warehouse_main"
}
```

食物补给示例：

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "placeId": "warehouse_main",
  "count": 16,
  "preferredItemName": "cooked_beef"
}
```
  - `observe.nearbyEntities`
  - `observe.blocks`
  - `agent.stateSnapshot`

## Hierarchical Agent Runtime

- 新的分层智能体 runtime 位于 `src/agent/`。
- 当前阶段仍是“桥接运行”：
  - 旧的行为系统继续实际执行
  - 旧系统的状态与关键事件会同步写入新的分层 runtime
  - 新 runtime 产出的部分 reactive action 会回桥到旧工具执行
- 目前已桥接的关键事件包括：
  - `tick`
  - `hurt`
  - `low_health`
  - `low_food`
  - `task_finished`
  - `task_failed`
  - `task_timeout`
- 当前已接通的运行机制：
  - 任务超时定时器会写入新 runtime
  - 新 runtime 的动作会经由 skill catalog 编译后，回桥到旧 MCP 工具执行
  - self-guard 阈值检测会把低血/低饥饿事件写入新 runtime
  - `agent.runOnce` 会优先把 planner 结果翻译成 `directive/actions` 写入新 runtime，只有翻不动的步骤才回退到旧 queue
  - planner 现在优先被要求输出高层 `directive.actions`，并内置了 follow / stop+eat / mine / speak / prepare_battle / drop_item / challenge_entity / request_teleport_to_player 的 few-shot 示例
  - `agent.mode = "auto"` 且 `allowProactiveAction = true` 时，空闲状态会触发低频 strategic pass，自动生成下一步高层 directive
  - 即使 `allowProactiveAction = false`，在空闲状态下若刚发生 `milestone_advanced` / `milestone_completed` / `goal_completed` / `goal_abandoned` 等 lifecycle 事件，也会触发一次保守的 strategic adjustment pass
  - 这类 lifecycle-driven strategic pass 会优先考虑对附近 owner / whitelist 做一句简短汇报，而不是立即发散到新任务
  - planner 产出的 directive.goal 会被记成当前 strategic goal，后续 auto strategic pass 会优先延续它
  - 遇到 `task_failed/task_timeout` 后，auto strategic pass 会优先尝试对当前 strategic goal 做一次 repair 规划
  - 当前 strategic goal 会持久化到 `chat-configs.json`，可通过 `agent.goal.status` 查看，`agent.goal.clear` 清除
  - 可通过 `agent.goal.set` 显式设置长期目标；在 `mode = auto` 下，设置完成后会立即尝试一次明确目标激活；若新 goal 明确是“下矿”且当前正处于跟随任务，会先停止跟随再切换；连续 repair 失败会提高失败计数，并在后续 repair prompt 中要求更保守的降级策略
  - strategic goal 现在支持 `milestones` 和 `currentMilestoneIndex`，可由 planner 产出，也可通过 `agent.goal.set` 手动指定
  - 在 `mode = auto` 且 bot 空闲时，若当前 goal 或当前 milestone 能被明确解析为“跟随某个玩家”或“去下矿/挖矿”，会触发保守的 goal activation rule，直接启动对应行为，不依赖 planner key
  - 当 `autoIdlePolicy = follow_owner` 且 owner 不在附近时，会优先退回最近记住的 `home/base/safe` 类地点待命
  - 可通过 `agent.goal.advance` / `agent.goal.rewind` 手动推进或回退当前 milestone
  - 当任务成功且当前 milestone 与任务类型语义大致匹配时，系统会保守地自动推进 milestone
  - 当最后一个 milestone 完成时，strategic goal 会自动记为完成并清空；连续 repair 失败过多时会自动废弃并清空
  - 新增统一 action/skill 覆盖：`challenge_entity` / `prepare_battle` / `request_teleport_to_player` / `move_to_position` / `organize_inventory` / `equip_category` / `drop_item` / `open_door`
- 调试工具：
  - `agent.framework.status`
    - 返回新 runtime 的 `status`
    - 返回黑板 `snapshot`

### `observe.inventory`

- 主字段：
  - `heldItem`
  - `itemSummary`
  - `items`
- 其中：
  - `itemSummary` 是按 `name` 聚合后的统计
  - `items` 是逐物品栈明细

### `observe.nearbyEntities`

- 主字段：
  - `entityId`
  - `name`
  - `type`
  - `kind`
  - `distance`
  - `position`
- 附加字段：
  - `displayName`

### `agent.stateSnapshot`

- 现在会附带：
  - `selfState.inventory.itemSummary`
  - `entities[*].displayName`
- 但 Agent 规划应优先看：
  - `entities[*].name`
  - `entities[*].type`
  - `taskContext`
  - `events`

## Chat Listener Notes

- 监听来源是游戏内 `chat` 事件，不是 MCP 后台对话。
- 监听器在 bot 断线重连后会自动重新挂载（前提是 `chat.listener.configure` 或 `chat.ai.configure` 已启用）。
- `chat` 与 `messagestr` 对同一发送者和同一消息在 1.5 秒内只处理一次；超过窗口的重复发言仍会正常处理。
- 有效对话日志默认写入：`%LOCALAPPDATA%\\moony-mcbot\\logs\\valid-whitelist-chat.jsonl`
- 仅记录满足以下条件的消息：
  - 发送者在白名单中（对应 `chat.listener` 或 `chat.ai` 的白名单）
  - 消息包含唤醒词（`wakeNames` 任一项，或 `chat.ai` 的 `wakeWord`）
- 聊天/AI 配置会自动持久化并在重启后恢复，默认文件：`%LOCALAPPDATA%\\moony-mcbot\\config\\chat-configs.json`
- 配置文件读取、Zod 解析、串行原子写入和 shutdown flush 已由独立 `PersistedChatConfigRepository` 管理；聊天监听、Chat AI、Agent 核心配置与 self-guard 配置的默认值、运行时状态和持久化投影由各自 ConfigStore 管理，实际聊天订阅与监听 watchdog 由 `ChatListenerLifecycle` 管理。Chat AI 与 planner 当前请求的取消/失效、请求代次和诊断回写由独立 `AiRequestLifecycle` 管理；Chat AI 与 self-guard 排队 tail、待执行任务代次和动态 drain 由各自 `InvalidatableTaskQueue` 管理，self-guard 原生受伤绑定由独立订阅 registry 管理，主/持续反击 interval 与 watchdog 句柄由独立 `SelfGuardLoopLifecycle` 管理，反击 session 与命中衰减由独立 `RetaliationStateStore` 管理，告警冷却与上一轮观察由独立 `SelfGuardRuntimeStateStore` 管理，旧编排层共享的装备节流与反击命中序号由独立 `CombatExecutionStateStore` 管理，告警冷却允许条件、生命/饥饿、reactive 阈值信号、Bot 重连/健康下降核心转场、库存摘要和附近玩家进入判定由纯 `self-guard-state` 边界管理，昼夜/下雨兼容读取与转场判定由纯 `self-guard-environment` 边界管理，最近疑似攻击者选择、后续目标快照复核和持续反击 tick 条件由纯 `self-guard-retaliation` 边界判定。Agent 的战略目标/记忆/任务历史/领地组合、planner 轮次编排/执行、self-guard 完整 tick/追击与攻击业务和四表热重载 commit 仍保留在旧编排层；planner 冷却时间戳判定已由 `HierarchicalAgentRuntime` 管理。环境输入仍来自原生 Mineflayer Bot，尚未进入公共 Adapter，真实伤害来源也仍是旧实现，外部路径和 JSON 契约不变。
- 旧采矿执行链的串行 Promise tail 由 `MiningTaskQueue` 作为纯进程内状态持有；shutdown 只等待取得快照时已登记的任务，不提供取消或动态 drain。
- `chat.config.reload` 会先完整解析并校验四个配置表，再同步提交运行时快照；损坏 JSON、错误字段类型、空 Bot ID 或手动重载时缺文件都会返回 MCP 错误，旧运行状态保持不变。
- 成功重载会删除文件中已经消失的 chat、AI、Agent 和 self-guard 条目，并返回 `removedCounts`；Agent 条目删除时一并清理其持久化记忆、战略目标和领地派生状态。
- 存续 Chat AI 条目的运行时 API key、聊天历史和请求诊断，以及存续 Agent 条目的 planner API key 和最近规划诊断不会因重载直接丢失；进行中请求的后续诊断会按 botId 写入当前 Store，旧请求不能覆盖较新请求状态。提交后仍按既定顺序应用 `.env.local` / 进程环境覆盖，因此环境层可能重新覆盖默认 Bot 的有效值。
- Chat AI 配置热重载、删除或 `chat.ai.configure` 会跳过尚未开始的旧代次回复并撤销其用户冷却；已经运行的请求仍按当前请求 lifecycle 完成或取消。shutdown 会关闭队列、拒绝新任务并等待仍被队列拥有的 tail。
- self-guard 配置热重载、删除、停用或 `self.guard.configure` 会跳过尚未开始的旧自动进食/反击任务；主 tick、持续反击 tick 与受伤 handler 在执行时读取当前 ConfigStore，session/命中衰减、上一轮观察和战斗执行节流状态均按 Bot 清理。聊天告警的启用、严格冷却边界和无效时间 fail-closed 由纯决策负责；允许时仍先写冷却再尝试发送，失败不回滚。低生命和低饥饿 reactive 事件只在首次进入阈值时产生；critical 状态变化会重新产生低生命事件，完全恢复只清 flags，事件顺序仍是 low-health、low-food、Store 写入。首次 Bot 采样不会误报重连，只有已有旧 Bot 引用且对象身份变化时才触发既有重连短句；周期健康比较只在 vitals 可用、历史健康值有限且下降严格超过 `0.5` 时进入既有受伤处理。附近玩家转场只在有效非自身玩家首次进入包含边界的范围时成立，持续接近不会重复产生进入信号，随机说话与状态写入顺序保持不变。昼夜/下雨兼容读取会抑制首次观察，只在白天转夜晚或无雨转下雨时触发既有短句；受伤 handler 从 Adapter 玩家坐标选择最近疑似攻击者后才判断白名单，不会因最近玩家在白名单中而改打第二近玩家。持续/短反击每次执行前也从 Adapter 快照复核同名目标和精确距离；持续反击再由纯决策区分超时、目标不可用、接近/停留和是否达到攻击冷却。快照缺失或损坏时不会继续攻击，只有成功动作才递减剩余命中。普通 stop 保留告警冷却并清理装备节流/反击命中序号，配置条目删除时才全清短期观察状态。已开始的短任务不会强制中断，shutdown 会等待仍被队列拥有的 tail。
- `chat-configs.json`、`chat-summary-state.json`、共享 `players.json` 与 `places.json` 使用同目录临时文件、文件同步和 rename 原子替换；收到 `SIGINT` / `SIGTERM` 时会先停止动作循环与请求，再等待配置、共享记忆、有效聊天日志和短期聊天记忆写盘，详见 [持久化与退出生命周期设计](docs/persistence-lifecycle-design.md)。
- 安全边界：
  - `chat.ai.configure.apiKey` 和 `agent.configure.plannerApiKey` 只作为本次运行时秘密值使用，不再写入 `chat-configs.json`
  - 推荐用 `MCBOT_AI_API_KEY` 注入 API key
  - 如果旧版 `chat-configs.json` 中已经包含 `apiKey` / `plannerApiKey`，新版会忽略这些旧字段；请手动删除旧文件里的明文 key
- 可用环境变量覆盖默认路径：
  - `MCBOT_DATA_DIR`
  - `MCBOT_VALID_CHAT_LOG_PATH`
  - `MCBOT_CHAT_CONFIG_PATH`

## Chat AI

- `chat.ai.configure` 现在支持：
  - `model`
  - `modelFallbacks`
- 调用顺序为：
  1. 先尝试 `model`
  2. 失败后按 `modelFallbacks` 顺序继续尝试
- 每次玩家用 `wakeWord` 唤醒 AI 聊天时，系统会先刷新一轮当前状态感知：
  - 动态状态（生命、饥饿、手持物、食物数量、最近玩家距离和准星方块来自 Adapter 快照）
  - `focus perception`（Mineflayer 可选的精确实体/方块增强）
  - `salient perception`
- 因此 AI 回复会优先参考“当前正在看什么”和“附近最值得注意的内容”，而不是只依赖旧历史。

示例：

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "enabled": true,
  "wakeWord": "小狸",
  "model": "gpt-5-nano",
  "modelFallbacks": ["gpt-4.1-mini", "gpt-4o-mini"]
}
```

## Self Guard

- 新增工具：
  - `self.guard.configure`
  - `self.guard.status`
  - `self.guard.check`
- 功能：
  - 低饥饿自动进食（背包有食物时）
  - 低血量提示
  - 危险血量时自动停止跟随（可配置）
- 配置会和聊天配置一起持久化到 `chat-configs.json`，重启自动恢复。

## Prompt Profile

- 提示词与状态台词支持独立文件：
  - 默认路径：`C:\\xiaoli\\memory\\prompts\\mcbot-prompt-profile.json`
  - 可用 `MCBOT_PROMPT_PROFILE_PATH` 覆盖
- 启动时自动加载；若共享 memory 文件不存在，会先从旧路径 `%LOCALAPPDATA%\\moony-mcbot\\config\\prompt-profile.json` 复制一次；旧文件也不存在时才自动生成默认文件。
- McBot 只读取自己的 prompt profile，不读取 Voice/直播用的 `context/context-pack.json`。
- 工具：
  - `prompt.profile.status` 查看当前生效内容
  - `prompt.profile.reload` 修改文件后热重载
  - `chat.config.reload` 修改 `chat-configs.json` 后热重载
- 示例模板：`config/prompt-profile.example.json`
- 场景台词（可在 profile 中配置）：
  - `sceneLines.followStart`
  - `sceneLines.followStopped`
  - `sceneLines.targetLost`
  - `sceneLines.reconnectSuccess`
  - `sceneLines.nightStart`
  - `sceneLines.rainStart`
  - `sceneLines.attacked`
  - `sceneLines.attackedByWhitelist`
  - `sceneLines.attackedByNonWhitelist`
  - `sceneLines.reportToWhitelist`
  - `sceneLines.nearPlayer`
  - `sceneLines.idleMurmur`
  - `sceneLines.randomMurmur`
  - `sceneCooldownMs`（防止重复刷屏）
- 行为参数：
  - `nearPlayerDistance` / `nearPlayerTalkChance`
  - `idleNoInteractionMs` / `idleSpeakCooldownMs`
  - `randomSpeakChancePerTick` / `randomSpeakCooldownMs`

## 文档

- [文档索引](docs/README.md)：按使用、架构、契约、维护、未来规划和历史记录分类。
- [手动测试指南](docs/manual-testing-guide.md)：从启动开始的唯一测试主入口。
- [架构收敛路线图](docs/architecture-convergence-roadmap.md)：当前进度、未完成迁移和实施顺序。
- [整合包客户端适配规划](docs/modded-client-adapter-plan.md)：未来 Companion Mod + Local Bridge 路线。
