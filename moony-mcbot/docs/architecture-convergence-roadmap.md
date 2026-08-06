# 架构收敛与后续路线图

这份文档把当前项目从“可以继续扩展的原型”推进到“可长期演进的本地智能体控制平面”所需的工作拆成可验收阶段。

2026-07-31 的全项目复核确认现有方向无需推倒重写，但发现三个必须先处理的运行确定性问题：致命异常后进程继续运行、多 bot 聊天摘要串线、配置热重载失败仍报告成功。证据、依赖基线和完整优先级见 [全项目架构与实现审计](project-audit-2026-07-31.md)。

## 一、当前判断

项目不是推倒重来的状态。当前已经具备：

- Mineflayer 原版/协议兼容执行后端
- `BotRuntime` 生命周期与重连骨架
- `ClientAdapter` 类型和 `MineflayerAdapter` 初始实现
- Agent 的事件、黑板、Reactive、Skill Catalog 雏形
- 共享游戏记忆与聊天摘要的本地存储边界
- 独立 Web 调试面板
- MCP 作为外部操作入口

但这些能力还没有收敛成一条唯一运行链。当前真正执行任务的主体仍在 `action-tools.ts`，新 Agent runtime 主要通过同步桥接旧状态和旧工具运行。

因此当前阶段的核心目标不是继续增加玩法，而是：

> 先把启动、动作、状态、事件和适配器的边界稳定下来，再接入真实整合包客户端。

## 二、优先级

### P0：先修运行安全与确定性

- 未捕获异常、未处理 Promise 和启动失败复用幂等 shutdown；fatal 同步锁定失败退出码，动作 runtime 与 Web listener 关闭并发起步。（本轮已落地）
- 聊天摘要状态已升级到 `version: 2`，pending、上一轮摘要、滚动生成和 prompt 读取均按 bot 隔离；v1 单 Bot 摘要可自动归属，歧义摘要只保留不注入。（本轮已落地）
- 配置热重载先以 Zod 完整解析校验候选文档，再同步替换四个配置表；失败保留旧状态且不返回 `reloaded: true`，成功删除缺失条目并报告 `removedCounts`。（本轮已落地）
- 启动时等待配置、共享记忆和环境默认值完成加载，明确覆盖顺序。（本轮已落地）
- 让持久化的 chat、Agent、self-guard 配置在启动后统一激活。（本轮已落地）
- 给连接流程增加取消/代次标记，避免断开后旧连接再次上线。（本轮已落地）
- 普通跟随、巡逻和撤退使用不可挖掘、不可搭柱的 pathfinder 配置。（本轮已落地）
- 为聊天监听增加消息去重，避免 `chat` 与 `messagestr` 重复处理。（本轮已落地）
- 为规划、闲聊和记忆总结请求增加超时、取消和明确失败状态。（本轮已落地）
- Web 面板保持本机绑定；在允许局域网访问前增加访问令牌、来源校验和请求体限制。（本轮已落地）

### P1：让框架只保留一套真相源

- Agent 黑板成为任务、动作、技能和生命周期状态的唯一来源；goal、milestone、active task、runtimeState、planner action queue 和 execution event stream 已收口，配置兼容镜像仍待后续清理。
- 逐步删除 `action-tools.ts` 中与黑板重复的任务队列、目标和事件状态。
- 将 `ClientAdapter` 基础接口与 Mineflayer 原生对象解耦；当前原生句柄已从接口移除，Agent 紧凑状态摘要、salient 玩家/实体感知、就近白名单汇报、地点记忆、确定性 follow/place 目标激活、`follow_owner` 空闲策略、self-guard 周期状态、受伤后的最近疑似攻击者选择和后续反击目标复核已改读 Adapter 快照。`BotRuntime` 的连接、连接失败清理、手动断开和进程退出也已统一经过 Adapter，异步断开具备并发幂等、事件解绑和有界超时；仅保留 BotRuntime 的兼容原生句柄出口供其余高层调用迁移。
- 由 Adapter Factory 创建具体适配器；当前已增加 `ClientAdapterFactory` 对象契约，`BotRuntime` / `BotRegistry` 可由应用组合层注入 kind 与 Factory，默认仍创建 `MineflayerAdapter`，并拒绝 Factory 返回错误 kind。该选择尚未进入 Bot 配置、环境变量或持久化，Modded Client 的公开配置等待 bridge 实现后接入。
- 统一 Command Invocation / Action Result 已完成 `move.stopFollow` 首个试点：MCP、Web 和 Agent 共用 canonical 输入复核与领域 handler，保留各自旧返回契约，并在 Web 显示跨入口来源、requestId、耗时和 `executed` / `failed` 历史。其他动作、统一权限和游戏确认仍未迁移，详见 [Command Invocation / Action Result 试点设计](command-invocation-design.md)。
- 建立唯一 Tool/Skill Catalog，同时供 MCP 注册、Agent allowlist、Web 标签和执行器使用；分阶段边界见 [Tool/Skill Catalog 收敛设计](tool-skill-catalog-design.md)。
- 把 `action-tools.ts` 按领域拆成 movement、combat、inventory、social、memory、agent、territory 等服务；当前已先迁移低风险 adapter-backed 调用，并抽出容器物品序列化、汇总、匹配和读取回退的纯 runtime 边界。完整 Agent 状态仍在该文件组装，但内部消费者已统一使用构建函数推导出的唯一快照类型，planner 的不可信输入投影边界保持独立。开箱、寻路、deposit/withdraw 与关闭仍是 Mineflayer 专用会话，等待独立 ContainerSession/Adapter 设计后再迁移。

### P2：提高可观察性与长期维护能力

- CommandDispatcher 已先为 `move.stopFollow` 建立 `executed` / `failed` 终态和有界历史；后续仍需把“已接受、已确认、取消”及游戏事件证据接入统一事件流，不能把 handler 返回当成确认。
- Command History 与 Web Action History 已共用递归 diagnostics 投影：写入内存历史的 payload、result 和 error 会深拷贝并脱敏常见敏感键、赋值文本与 Bearer 凭据，入口原响应不变。该规则不能识别普通字段里的任意秘密，真实凭据仍不得进入调试请求。
- 配置、聊天记忆与共享游戏记忆的原子写入和退出 flush 第一阶段已完成：`chat-configs.json` 的读取、Zod 解析、串行写队列与动态 flush 已收口到独立 ConfigRepository，聊天监听、Chat AI、Agent 核心配置和 self-guard 配置的默认构造、运行时 Map、replace/delete 与持久化投影也已迁入各自 ConfigStore；Chat AI 与 planner 当前请求的 `AbortController`、请求代次和诊断写入门控已收口到 `AiRequestLifecycle`，热重载后的结果按 botId 回写当前 Store；Chat AI 与 self-guard 排队 tail、配置代次失效和动态 drain 由各自 `InvalidatableTaskQueue` 实例拥有，self-guard 原生受伤 handler 由独立订阅 registry 管理并动态读取当前配置，主/持续反击 interval 与 watchdog 句柄由 `SelfGuardLoopLifecycle` 管理，反击 session 与命中衰减由 `RetaliationStateStore` 管理，告警冷却与上一轮观察由 `SelfGuardRuntimeStateStore` 管理，旧编排层共享的装备节流与反击命中序号由 `CombatExecutionStateStore` 管理，昼夜/下雨兼容读取与场景转场由纯 `self-guard-environment` 边界管理，最近疑似攻击者选择、后续目标快照复核和持续反击 tick 条件由纯 `self-guard-retaliation` 边界判定。它与 `chat-summary-state.json`、`players.json`、`places.json` 复用同一个同目录临时文件、文件同步和 rename writer，失败路径清理临时文件。Agent 的目标/记忆/任务历史/领地组合、planner 冷却/执行、self-guard 完整 tick/攻击业务和四表 commit 仍在旧编排层；环境输入仍来自原生 Mineflayer Bot，尚未进入 Adapter 世界快照，真实伤害来源判定与追击/攻击动作也仍是旧实现。共享游戏快照仍由上层队列保证写入顺序。`SIGINT` / `SIGTERM` 会先静默动作 runtime，再断开 bot、等待持久化并关闭 MCP。聊天摘要已升级到按 Bot 隔离的 `version: 2`；共享游戏文件保持 `version: 1`，`chat-configs.json` 顶层版本仍需确认兼容策略后单独加入，详见 [持久化与退出生命周期设计](persistence-lifecycle-design.md)。
- Self-guard 主 tick 的 Bot 引用变化和严格超过 `0.5` 的健康下降条件也已委托给纯 `self-guard-state` 决策；首次采样、vitals 不可用和非有限历史值均 fail-closed。重连短句、受伤处理和上一轮状态写入仍由旧编排层按原顺序执行。
- Self-guard 的低生命/低饥饿 reactive 转场、事件优先级/payload 和下一组去重 flags 已委托给同一纯状态边界。调用层仍按既有顺序发布 Agent 事件并在最后写 Store；事件 ID、时间戳和发布失败处理没有迁移。
- Self-guard 聊天告警的启用开关、严格冷却边界与无效时间 fail-closed 已委托给纯状态边界。调用层仍先写冷却时间再尝试发送，聊天失败不会回滚；完整 tick 快照因会提前部分采集并改变异常路径而暂缓。
- 未发布条目已有独立 TypeScript 契约校验器和 CI 门禁：文件名 scope、八个 frontmatter 字段、tests/artifacts 与三段正文会在 lint 前检查，9 个旧式文件名已规范化。校验不会移动文件或宣布发布；首次 release 批次和 TODO 历史归档仍需确认，详见 [Release Entry 生命周期](release-entry-lifecycle.md)。
- OpenAI-compatible 请求传输层第一阶段已完成：planner、chat、memory 共用 endpoint 归一化、Bearer 鉴权、JSON POST 和超时边界；业务响应解析、错误前缀与模型 fallback 仍由各调用方维护，后续再评估是否抽取响应解析而不抹平提供商差异。
- 云端 planner 上下文投影第一阶段已完成：默认只发送字段白名单、距离摘要、任务/目标状态和事件类型，不再发送完整状态、绝对坐标、实体/任务/事件 ID、任务 params、记忆 notes 或事件 payload；权限类别仍作为行为安全输入保留，详见 [Planner 上下文投影设计](planner-context-projection-design.md)。
- ESLint 9 flat config 与按子目录触发的 GitHub CI 第一阶段已完成，统一执行 lint、源码/测试 typecheck、自动发现的完整测试和 build；`action-tools.ts` 已恢复未使用符号检查，只与少量 Mineflayer 原生兼容边界暂时豁免 `no-explicit-any`。MCP SDK 1.30.0 与 Yggdrasil 1.8.0 已分别完成精确锁定和离线协议/认证回归；Node 基线现已统一为 22+，CI 覆盖 22/24 LTS，Mineflayer 按当前已验证 lock 条目精确固定为 4.35.0。生产审计仍保留原 17 项，Yggdrasil 的嵌套 `uuid@10` 也仍被标记；Mineflayer 4.37.x 与真实登录/游戏行为回归继续单独处理，详见 [Lint 与 CI 设计](lint-ci-design.md)。

## 三、目标运行链

```text
Minecraft Client / Server Events
              |
              v
      Event Normalizer
              |
              v
         Agent Blackboard <---- Memory Read Model
          /          \
         v            v
   Reactive Rules   Strategic Planner
         \            /
          v          v
        Strategic Action
              |
              v
       Skill / Action Dispatcher
              |
              v
          ClientAdapter
          /           \
         v             v
  Mineflayer       Modded Bridge
              |
              v
       Action Result + Evidence Event
```

MCP 和 Web 都只调用 `Skill / Action Dispatcher`，不能各自实现一套动作逻辑。游戏聊天监听也应通过同一入口执行，不能直接拿原生 bot 发消息。

## 四、分阶段计划

### 阶段 0：稳定化基线

先不增加新玩法，完成以下回归链：

```text
启动 -> 自动连接 -> chat listener -> 跟随 -> 停止 -> 发消息 -> 断线 -> 重连
```

验收条件：

- `.env.local`、持久化配置和默认值每次启动结果一致。
- 自动化测试导入业务模块时不读取工作区 `.env.local`；环境文件只由进程入口 bootstrap 加载。
- 默认和定向自动化测试均通过统一 setup 使用进程独立的临时 AppData、共享记忆和 prompt 路径，退出后不残留目录。
- 手动断开后不会出现旧连接重新上线。
- 跟随不会挖掘或搭路。
- 一条聊天指令最多产生一次动作和一次记忆记录。
- 所有模型请求在有限时间内结束，并在 Web 面板显示结果。

### 阶段 1：运行时收口

新增应用级初始化和关闭生命周期：

- `RuntimeBootstrap`：加载配置、记忆、环境覆盖并启动 watchdog。当前已先把 `.env.local` 收敛为仅由 `main` 引用的显式 bootstrap，普通模块导入无加载副作用。
- `ConfigRepository`：文件生命周期第一阶段已抽出，负责现有无版本 schema 的读取校验、串行原子写入和 flush；聊天监听、Chat AI、Agent 核心配置与 self-guard 运行时配置已迁入独立 Store，AI 当前请求的取消/失效与诊断代次、Chat AI/self-guard 排队任务代次与 drain、self-guard 受伤订阅、self-guard 主/持续反击 interval 与 watchdog 句柄、反击 session/命中衰减、告警冷却/上一轮观察、装备节流/反击命中序号所有权、reactive 阈值信号、Bot 重连/健康下降核心转场、昼夜/下雨兼容读取与转场判定，以及疑似攻击者选择、后续目标 Adapter 快照复核和持续反击 tick 决策也已迁入独立 runtime 边界。Agent 组合状态、planner 冷却/执行、self-guard 完整 tick/事件发布/追击与攻击业务、真实伤害来源判定、Adapter 环境快照及四表事务 commit 仍待后续迁移。
- `GuardRuntime`：聊天告警冷却、周期生命/饥饿、reactive 阈值信号与去重 flags、Bot 引用变化、健康下降容差、库存摘要和附近玩家首次进入条件已有纯 runtime 决策；附近玩家判定会排除自身、忽略无效距离并包含范围边界。Agent 事件发布、重连/受伤副作用、随机概率、场景聊天、上一轮状态写入和完整 tick 顺序仍由旧编排层负责。
- `RuntimeShutdown`：停止循环、卸载监听器、断开 bot、等待写入队列。
- `ActionDispatcher`：统一校验能力、执行动作、记录结果和发布事件。当前仅完成 `move.stopFollow` 的 CommandDispatcher 试点，权限和证据事件仍待扩展。

这一阶段不改变现有 MCP 工具名，先保持外部契约兼容。

### 阶段 2：Agent 单一真相源

迁移顺序：

1. 让黑板接管 active task、goal、milestone 和 action queue；本轮已完成。
2. 让旧 Agent 工具只读写黑板，不再直接维护重复 Map。
3. 将 `StrategicAction -> SkillInvocation` 和执行结果事件接通。
4. 让 planner 成为可注入的 Strategic Layer，而不是隐藏在工具文件里的特殊流程。
5. 删除旧 executor queue 和同步桥，保留兼容查询字段一段时间。

完成标志是 `agent.framework.status`、`agent.trace.summary` 和实际执行状态来自同一份黑板数据。

### 阶段 3：Adapter conformance

先为 Adapter 写不依赖 Minecraft 的契约测试，再分别运行：

- `MineflayerAdapter`
- `FakeClientAdapter`
- 未来的 `ModdedClientAdapter`

最小能力集合：

- self / inventory / nearby players / nearby entities
- look / move / stop / follow
- attack / use item / eat
- send chat
- connection lifecycle

当前迁移进度：聊天事件订阅、聊天回显、观察/背包基础动作、快捷栏整理及普通近距离单次攻击已经通过 Adapter，Agent 内部 `observe.self` 紧凑摘要不再读取原生 health/food，AI 闲聊动态状态的生命、饥饿、手持物、食物数量、最近玩家和准星方块也改读 Adapter 快照。`perception.salient` 与 Agent state snapshot 的附近玩家关系和重要实体筛选也已迁移。精确实体 focus 的视锥、距离、方块遮挡和候选评分已经抽成可离线测试的纯逻辑，但实体/方块数据采集与可交互方块扫描仍是 Mineflayer 增强，尚未扩展为公共 Adapter capability。self-guard 周期 tick 的生命、饥饿、食物背包、库存变化和附近玩家检测也已迁移；缺失或非有限 vitals 时采用 fail-closed，不触发阈值动作。领地入侵者选择、presence 清理和主人在场判断也已迁到 Adapter 玩家快照，升级战斗继续复用稳定实体 ID 决斗链。聊天中明确玩家的远距离攻击意图改为按稳定实体 ID 追击，但仍保持“只靠近、不自动补刀”的原契约。持续挑战的目标匹配和 tick 决策基于 `EntitySnapshot` 纯逻辑，目标死亡/自身死亡由标准化事件驱动，追击与攻击通过稳定实体 ID 动作执行。follow 与固定坐标移动的距离决策、追击/寻路、到达和停止也已完成上层解耦；Agent 内部 `move.goToPosition` dispatcher 不再为普通坐标构造 Vec3，`follow_owner` 空闲策略的主人可见性、距离和记忆地点回退也改由 Adapter 快照驱动。Mineflayer 的定点移动和实体追击要求零破坏 Pathfinder 可用，并审计首轮及后续完整 `path_update`，将 `noPath`、`timeout` 和明显长绕行转成结构化失败。持续失败通过标准化移动事件进入 Runtime action history，定点移动、跟随和决斗只消费当前 `movementId`，新目标、主动停止和断线会静默清理旧监听。契约见 [移动事件契约设计](movement-event-contract-design.md)。单块 `mineBlock` 和 `mine.digNearestVisible` 试点已迁移；self-guard 昼夜/下雨兼容读取和转场判定已抽出纯 runtime 边界，但输入仍来自原生 Mineflayer Bot。受伤后的最近疑似攻击者选择，以及持续/短反击每次执行前的目标用户名、位置和精确距离复核，已改用 Adapter 快照；持续反击的超时、接近/停留和攻击冷却也由纯 tick 决策判定。`entityHurt` 仍未提供真实伤害来源，追击、控制状态和攻击仍是 Mineflayer 实现。受伤事件契约、Adapter 世界环境快照、原生实体反击、批量采矿和容器等待仍待迁移。

Self-guard 附近玩家判定现已从主 tick 的筛选/排序代码中抽出：有效非自身玩家首次进入包含边界的范围时才产生进入信号，持续停留不会重复触发。当前随机说话、场景冷却与 `lastIsNearPlayer` 写入仍保留在旧 tick 编排中，因此这不是完整 `GuardRuntime` 迁移。

同一周期状态边界也接管了主 tick 的两个核心转场条件：只有已有 truthy 旧 Bot 引用且对象身份变化才报告重连，只有可用 vitals 相比有限历史健康值严格下降超过 `0.5` 才报告健康下降。主 tick 仍在原位置发送重连短句、调用受伤处理并更新 `lastBotRef` / `lastHealth`，所以副作用顺序和外部契约没有变化。

Reactive 阈值信号也已从 `maybePublishSelfGuardSignals` 的内联条件中抽出：首次进入低生命/低饥饿会依次产生对应语义信号，状态不变不重复，critical 升降级会重新报告低生命，完全恢复只清 flags。调用层仍负责真正发布事件，并在调用发布函数后写 Store；发布函数内部继续吞掉桥接异常，因此发布失败后仍更新 flags 的旧行为保持不变。这不代表完整 tick 已迁移。

聊天告警冷却条件也已从 `maybeAlertGuard` 抽出：关闭告警优先返回，无历史沿用 `0`，窗口内严格抑制、边界允许，损坏时间输入不发送。调用层继续在发送前写入冷却时间；完整 tick 组合要等采集时序有明确契约后再做。

`socialize_whitelist` 的候选过滤、记忆评分和目标选择已改读 Adapter 玩家快照；最终仍通过 Mineflayer `lookAt` 看向选中的玩家。当前 Adapter 只有 yaw/pitch 转头，没有按世界坐标观察的正式能力；在确认新增 capability 和兼容策略前，不用近似角度计算静默替换。

采矿迁移采用“单块原子动作先行、可见扫描后移”的分阶段方案。`mineBlock` 已实现零破坏接近、目标复核、工具选择、结构化失败和动作证据；旧可见方块扫描、`GoalNear` 接近和批量入口已收紧为 Mineflayer/Pathfinder 明确类型并使用实例级 WeakMap 缓存，但仍未成为 Adapter capability。待游戏回归通过后再迁移批量入口。契约、安全配置和兼容映射见 [采矿 ClientAdapter 迁移设计](mining-adapter-migration-design.md)。

容器、可见方块扫描、GUI 和模组能力作为后续可选 capability，不应假装所有 Adapter 都支持。

### 阶段 4：整合包客户端 MVP

采用 Companion Mod + Local Bridge，而不是让 Node 进程直接模拟 Forge/Fabric/NeoForge 客户端内部逻辑。

第一版只证明：

- 小狸可以启动真实整合包客户端并进入世界。
- Node 可以读到位置、生命、背包、附近玩家和聊天。
- Node 可以发送移动、转头、攻击、使用物品、聊天和停止命令。
- Web 面板可以看到 bridge 状态、事件、动作队列和失败原因。

第一版明确不做复杂机器 GUI、自动合成链、完整模组玩法和高级战斗微操。

## 五、模型职责

### 云端大模型

低频负责长期目标、复杂规划、失败修复和多步资源调度。输入使用经过筛选的上下文投影，而不是完整运行时对象。

### 本地小模型

负责闲聊、短句、轻量意图解释和模组百科检索增强。它不能直接拥有危险动作权限。

### 本地代码

负责移动、停止、跟随、战斗、进食、背包、容器、Reactive、自保、事件和记忆持久化。

原则是：

> 复杂思考走云端，轻量表达走本地模型，确定性执行走本地代码。

## 六、调试入口策略

Web 面板是项目自己的主要调试入口，MCP 是外部客户端和日常操作入口。

Web 面板后续应优先显示：

- 当前配置来源和覆盖顺序
- 当前 action 的状态与证据
- Agent 黑板和事件流
- Adapter/Bridge 能力和连接状态
- 模型请求耗时、超时和 fallback 原因
- 当前 Pack Profile、Mod 列表和 capability 命中情况

不建议继续把全部工具都暴露给模型。84 个工具适合开发者和 Web raw runner，不适合直接作为普通聊天模型的完整工具集。后续应提供精简的用户级工具集，并保留完整开发工具集。

## 七、暂不做

- 不立即重写全部 `action-tools.ts`。
- 不立即实现具体模组玩法，例如 Farmer's Delight 或 Create。
- 不立即接入 CurseForge、Modrinth、MCMod 在线百科。
- 不在没有鉴权的情况下开放 Web 面板到局域网。
- 不为了追求“全自动”让 LLM 直接控制高频 tick 或危险动作。
