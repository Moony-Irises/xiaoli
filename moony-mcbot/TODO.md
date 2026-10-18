# TODO

## 当前任务：分层动作执行边界收敛

- [x] 阅读架构路线图、规划注入设计、黑板/Skill、executor 接线和模块规范；确认兼容步骤已经共用黑板队列，暂不删除旧工具执行路径
- [x] 关键词：Skill 执行、权限复核、任务冲突、执行终态、异步清理；不新增依赖。Notion CLI 不可用，Context7 返回认证错误，测试方法参考 Node 官方文档
- [x] 在现有 MCP → 黑板 → Skill → Adapter 链上补权限拒绝和执行失败的迁移前基线，迁移前后均 11/11 通过
- [x] 将单个分层动作的权限/冲突检查、绑定、工具执行、结果事件和 finally 清理迁到独立内部执行器，调用层保留快照、tick 和 timeout 准备
- [x] 增加空队列、不可编译动作、等待任务、执行中状态、成功/失败、事件顺序、异常上报和 Bot 隔离的定向测试（13/13），Lint 和源码/测试类型检查通过
- [x] 同步模块 README、测试指南第 9.2 节、路线图、CLAUDE 和本轮 release entry；明确已开始动作和旧兼容步骤的取消边界没有随本项改变
- [x] 完成迁移前后接线（11/11）、执行器（13/13）、Lint、源码/测试类型检查、553/553 完整测试、build 和 235 条 release 校验
- [x] 自审执行顺序和异常边界；512 个候选文件未发现高置信密钥或本地密钥原值，275 个 Markdown 文件无断链，CLAUDE 为 2185 字节，私人 memory/voice/环境配置未纳入
- 提交、推送和远端 CI 证据以本轮 Git 提交及完成回复为准。
- [ ] 既有问题（本轮不改）：`eat-skill` 将 `eat_food.params` 编译成空参数，旧 `interact.eat` 步骤翻译后携带的 `itemName` 不会到达执行器；需单独确认指定食物与自动选食物的契约后补回归
- [ ] 既有异常边界（本轮不改）：权限拒绝的 `task_failed` 发布发生在工具执行的 `try/finally` 外；若同步订阅者抛错，可能跳过 `finishActiveExecution()`。预览/绑定/拒绝异常与工具执行异常需另行收敛，不把本轮清理保证扩展到所有路径

## 当前任务：生产规划策略注入与完整轮次有效性

- [x] 用户已确认 `docs/strategic-planner-injection-design.md`：保留旧接口，新增完整决策策略，由协调器单次应用；允许修正失效轮次继续执行的问题
- [x] 阅读 Agent、请求生命周期、MCP/Web/自动战略 pass 和配置重载/退出接线；关键词：规划策略注入、轮次作用域、AbortSignal、迟到结果、请求交错、黑板单写入
- [x] 新增无执行副作用的默认规划策略，保留原始计划、里程碑、指令和兼容步骤，单元验证通过
- [x] 复用请求状态辅助逻辑，新增完整轮次协调器，覆盖原冷却/权限/事件/返回顺序和取消前后有效性复核
- [x] 将 MCP、Web、自动战略 pass 接回注入策略和协调器；阻止旧轮次异常收尾、重载及 shutdown 后的迟到副作用
- [x] 增加受控异步回归：取消/忽略中止、先后交错、异步聊天、Bot 隔离、配置重载/删除与退出；不依赖真实 API 或游戏
- [x] 同步模块 README、路线图、测试指南、精简 CLAUDE 和 release entry，保留待实机测试的明确步骤
- [x] 完成 Lint、源码/测试类型检查、538/538 完整测试、build、234 条 release 校验、文档链接、差异与隐私自审；真实配置/记忆未纳入
- [x] 提交并推送本轮生产接线改动，核对本地与远端 main 提交；实际提交号以 Git 为准

## 当前任务：Strategic Layer 注入设计与迁移前回归

- [x] 阅读分层框架、现有 StrategicPlanner、生产规划轮次及请求生命周期，确认输入/输出不匹配和重复应用风险
- [x] 关键词：StrategicPlanner、规划决策信封、请求代次、AbortSignal、冷却、黑板单写入；沿用现有依赖，Notion CLI 不可用，业务契约以本地代码/测试为准
- [x] 补迁移前请求回归：超时/普通失败、实际取消、失效后的迟到完成、新旧请求交错及多 Bot 隔离；请求与生命周期定向测试 12/12、测试类型检查通过
- [x] 将接口提案、调用顺序、兼容边界和验收标准写入 `docs/strategic-planner-injection-design.md`，关联路线图和测试入口
- [x] 验证完整离线门禁：Lint、源码/测试类型检查、511/511 测试、build、234 条 release 校验、274 个 Markdown 文件链接和 diff 自审全部通过；504 个候选上传文件未发现高置信密钥或本地密钥原值匹配，真实配置/记忆未纳入
- [x] 将已完成的运行态/规划边界积压改动和本轮成果统一提交、推送 GitHub，核对本地与远端 main 提交一致；实际提交号以 Git 为准
- [x] 复杂接口方案已获用户确认，生产规划策略注入与完整轮次协调进入上述当前任务；旧共享接口继续兼容
- [x] 已确认风险：requester 忽略取消时，旧 runner 仍返回迟到计划，生命周期代次只门控诊断；生产协调器已在整轮副作用前复核有效性，旧 runner 的兼容行为保留
- [ ] 既有兼容限制：混合计划先应用指令再检查剩余工具权限；迁移先保留并补基线，若要整轮原子授权需单独确认行为变更

## 当前任务：Agent 单次规划请求生命周期边界

- [x] 阅读 planner 请求、AiRequestLifecycle、计划翻译和现有接线，确认只抽离单次请求边界，不改变轮次编排
- [x] 关键词：Agent planner request、AbortSignal、诊断终态、请求代次、Node 测试；不新增依赖，沿用现有 TypeScript/Node 测试栈
- [x] 将请求输入、Signal、成功/失败状态写回和 handle 关闭迁入 `src/agent/planner-request-runner.ts`
- [x] 接回 MCP/Web/战略 pass 共用的 planner 请求调用路径，保留错误分类、取消和外部返回语义
- [x] 补成功、取消失败、输入转发和生命周期清理测试
- [x] 同步 Agent/Runtime/Test README、路线图、手动测试指南、根 README、CLAUDE 与 changeset
- [x] 完成定向测试、Lint、源码/测试 typecheck、506/506 完整测试、build、233 条 release 校验和 diff 自审
- [x] 完整 StrategicPlanner 生产策略注入与整轮协调已完成第一阶段；真实游戏回归和旧兼容 executor queue 清理仍待后续阶段

## 当前任务：Agent 计划到指令翻译边界

- [x] 阅读路线图、Agent 规划请求、旧步骤翻译、Skill 与 MCP 接线，确认先拆无执行副作用的计划翻译器
- [x] 关键词：Agent plan、StrategicDirective、旧工具步骤兼容、动作上限、Node 子测试；不新增依赖。未找到 Notion CLI/连接；Context7 文档入口明确排除业务重构，测试生命周期参考 Node 官方文档
- [x] 在旧实现上补 MCP 行为基线：显式指令优先、动作截断、旧步骤/未翻译步骤共存、无可执行动作及权限拒绝
- [x] 将动作种类过滤、旧步骤归一化和指令构造迁入 Agent 模块，调用层保留冷却、诊断、权限、目标与执行编排
- [x] 补翻译单元测试：有效映射、缺参数、空计划、动作上限、优先级/样式/顺序与兼容回退
- [x] 同步 Agent/Test README、路线图、手动测试指南、根 README、CLAUDE 与 changeset；真实游戏手测继续搁置
- [x] 完成定向测试、lint、源码/测试 typecheck、完整测试、build、release 校验和 diff 自审

## 当前任务：Agent 调试事件视图收口

- [x] 阅读黑板、Runtime、规划接线、事件查询与测试指南，确认问题是两条事件流的调试可见性差异
- [x] 关键词：Agent blackboard、事件顺序、规划诊断、执行证据、MCP 回归；沿用现有 TypeScript/Node 测试栈，不新增依赖，知识入口可用性沿用上一轮检查
- [x] 确认边界：调试沿用事件字段、最近 20 条、type/count 过滤；内部 reactive、生命周期判断、planner 上下文和低优先级限流仍读原始流
- [x] 补充刷新噪声、跨流顺序、时钟回退、按 ID 去重、容量和 Bot 隔离的回归
- [x] 黑板保存有界可观察事件；Runtime 调试快照和 MCP/Web 事件出口统一读取，排除内部 tick/感知刷新
- [x] 验证规划成功、失败、Skill 执行结果在 framework/tail/trace/Web 状态中一致可见，且 planner 原输入不变
- [x] 同步 Agent/Test README、根 README、路线图、手动测试指南、CLAUDE 与 changeset
- [x] 完成定向回归（21/21）、lint、源码/测试 typecheck、全量测试（496/496）、build、release 校验（231 条）、文档链接（269 个 Markdown 文件）、高置信敏感信息扫描和 diff 自审；真实游戏手测依用户要求继续搁置

## 当前任务：独立 Agent 规划请求边界

- [x] 阅读架构路线图、Agent/Runtime README、上下文投影与请求生命周期代码，确认沿既有 Strategic Layer 收敛计划推进
- [x] 关键词：Agent planner、上下文投影、可替换规划器、OpenAI-compatible transport、黑板事件；不新增依赖或外部 API。未发现 Notion 连接；Context7 查询返回 API key 认证错误，改查 Node.js 官方测试文档，并以仓库实现与离线测试为兼容依据
- [x] 验证现有 executor 接线、上下文投影与模型传输基线（7/7）
- [x] 先补现有 MCP 规划请求的离线接线回归，覆盖成功、冷却、错误诊断以及黑板 → Skill → Dispatcher → 模拟 Adapter（4/4）
- [x] 将请求构造、上下文投影、响应解析迁入 `OpenAiAgentPlanner`，以内部 `AgentPlanRequester` 接口组合，并允许注入传输函数进行测试
- [x] 保持 MCP/Web、配置、提示词、响应文本、权限、冷却和取消语义；不改完整 tick、directive 翻译或游戏能力
- [x] 分单元验证请求体、文本兼容、HTTP/空回复/解析失败和 AbortSignal 传递（请求单元与接线 13/13，相邻回归 44/44）
- [x] 同步 Agent/Runtime/Test README、架构路线图、上下文设计、手动测试指南第 9.1 节、根 README、CLAUDE 与 changeset
- [x] 完成 lint、源码/测试 typecheck、全量测试（493/493）、build、release 校验（230 条）、文档链接（268 个 Markdown 文件）、diff 自审及新文件高置信敏感信息/冲突标记检查；共享响应函数与 planner 提示/错误字面量对比一致，游戏联调继续搁置
- [x] 遗留问题已收口：Runtime 保留 `recentEvents` 作为内部规范化输入，同时维护最多 20 条有界可观察事件；framework/tail/trace/Web 调试出口读取同一视图，原始 execution stream 继续供行为判断和限流使用

## 下一阶段：架构稳定化与收敛

详细设计与验收标准见：[架构收敛与后续路线图](docs/architecture-convergence-roadmap.md)。

### P0：运行安全与确定性
- [x] 将持久化配置、共享记忆和环境默认值加载改为可等待的启动阶段，并固定覆盖顺序
- [x] 持久化配置加载完成后统一激活 chat listener、Agent executor 和 self-guard
- [x] 让 `MCBOT_AI_API_BASE_URL` / `MCBOT_AI_MODEL` 在已有持久化配置时仍能覆盖默认 bot 的 chat/planner 配置
- [x] 为 BotRuntime 连接流程增加取消/代次保护，避免断开后旧连接重新上线
- [x] 为 follow / wander / retreat 增加不可挖掘、不可搭柱的安全移动配置
- [x] 为 `chat` / `messagestr` 增加消息去重
- [x] 为 planner、chat AI、memory summary 请求增加超时、取消和 fallback 状态
- [x] Web 面板开放局域网访问前增加访问令牌、来源校验和请求体限制

### P1：单一真相源
- [x] 让 Agent blackboard 接管 active task、goal、milestone 和 action queue
- [x] 让 blackboard 接管 strategic goal、current milestone 和 active task；goal/task 生命周期与调试查询已改走黑板快照
- [x] 将旧 `agentPlannedSteps` 转换为黑板统一动作队列，保留 `queuedLegacySteps` / `queuedStepCount` 兼容查询字段
- [x] 将 `agentRecentEvents` 迁移到 blackboard execution event stream，保留 `agent.events.tail` 原始字段格式
- [x] 将未持久化的 Agent `runtimeState` 从配置 Map 迁移到 blackboard
- [x] 抽出 `ClientAdapter` Factory，`BotRuntime` 默认通过工厂创建 Mineflayer adapter
- [ ] 在 Modded Client Bridge 可用后，再增加 adapter kind 配置选择和注册流程
- [x] 从 `ClientAdapter` 基础接口移除原生 `mineflayer.Bot` 句柄；保留 `BotRuntime.getActiveBotOrThrow()` 作为暂时兼容出口
- [x] 增加离线 Adapter conformance tests，覆盖统一方法、能力声明和未连接快照
- [x] 将观察、聊天发送、背包持有、开门、丢物品、附近玩家记忆和 self-guard 状态迁移到 adapter/runtime 入口
- [x] 将 `chat.sendVerified` 的事件回显迁移到 Adapter；路径寻路、挖矿、战斗循环和第一人称感知仍待迁移
- [x] 将聊天监听迁移到 Adapter 统一事件订阅，保留去重、白名单和唤醒词逻辑
- [x] 迁移聊天意图中明确玩家的远距离单次攻击寻路，不再读取原生 bot/pathfinder
- [x] 将明确玩家的远距离攻击意图改为按实体 ID 的 Adapter 追击，并保持“只靠近、不自动补刀”契约
- [x] 补充远距离聊天攻击决策测试、Adapter 动作证据和手动回归说明
- [x] 将普通聊天攻击的目标识别、武器持有和近距离单次攻击迁移到 adapter/runtime，并保留远距离寻路兼容行为
- [x] 为聊天攻击目标识别补充离线单元测试和手动回归步骤
- [x] 将快捷栏整理规则抽成可测试的纯规划器，并通过 `organize_hotbar` Adapter 能力执行
- [x] 迁移聊天、Agent executor 和 MCP 的快捷栏整理入口，保留原工具名与结构化 actions 结果
- [x] 持续挑战通过稳定实体 ID 的追击/攻击动作完成 Adapter 迁移，未以单次最近目标攻击替代
- [x] 将挑战目标别名匹配迁移到 `EntitySnapshot` 纯选择器，聊天与 MCP 入口不再遍历原生实体表
- [x] 抽出可测试的决斗状态机，统一目标丢失、自身死亡、追击距离和攻击冷却决策
- [x] 保留 pathfinder 和实际攻击为 Mineflayer 专用执行层，并记录后续 Adapter 移动/战斗能力需求
- [x] 增加 Adapter 统一实体生命周期事件订阅，并在断连/清空客户端引用时卸载监听器
- [x] 将持续决斗的目标死亡与自身死亡处理迁移到 Adapter 事件，不再持有原生 bot 监听器
- [x] 补充实体事件契约、运行时转发与取消订阅的离线回归测试
- [x] 增加按稳定实体 ID 追击与攻击的 Adapter 动作，避免持续决斗在 tick 间切换目标
- [x] 将持续决斗的 pathfinder 追击、停止和实际攻击迁移到 runtime/Adapter 入口
- [x] 补充实体追击/攻击的离线测试、动作证据测试和游戏回归步骤
- [x] 抽出 follow 的丢失/超范围/追击/保持距离纯决策，并补边界测试
- [x] 将 follow tick 的 pathfinder/control-state 操作替换为稳定玩家实体 ID 的 Adapter 追击
- [x] 保留目标丢失转头、静止超时和垂直跳跃降级行为，并补手动回归说明
- [x] 将 follow、定点移动、决斗、聊天攻击和采矿共用的当前 movement correlation key 迁入独立 Store
- [ ] 后续拆分 orchestration capability 与 ClientAdapter capability；当前 `follow_player` / `stop_follow` 仅用于上层能力门控，没有同名 Adapter 方法
- [x] 修复 `ensureIronSwordInHotbar1AndHold` 仍按旧回调形式调用 Promise 式 `moveSlotItem` 的历史问题，并补准备战斗回归测试
- [x] 抽出 Promise 式 Mineflayer 槽位移动适配函数，覆盖同槽空操作、成功和拒绝传播
- [x] 让准备战斗与快捷栏整理共用槽位移动适配函数，并同步手动测试与 changeset
- [ ] 删除旧 Agent Map、旧 executor queue 与 hierarchical runtime 之间的重复状态
- [ ] 移除 `BotRuntime.getActiveBotOrThrow()` 兼容出口，并迁移剩余高层 Mineflayer 调用
- [ ] 增加 Adapter Factory，使 BotRuntime 可选择 Mineflayer 或 Modded Client
- [ ] 建立单一 Tool/Skill Catalog，供 MCP、Agent allowlist、Web 和执行器复用
- [ ] 将 `action-tools.ts` 按 movement / combat / inventory / social / memory / agent / territory 拆分

### P2：可观察性与维护
- [ ] 将 ActionResult 扩展为 accepted / executed / confirmed / failed / cancelled，并携带证据
- [ ] 为 `chat-configs.json` 增加顶层版本；聊天摘要状态已完成 v2 版本化、原子写入和退出 flush
- [x] 让共享 `players.json` / `places.json` 复用公共原子 writer，并覆盖替换失败后的临时文件清理
- [x] 实际盘点确认全部 177 个历史条目已有 `breaking` 等八个必填字段，并将统一 release entry 校验接入 npm 与 CI
- [x] 抽取统一的 OpenAI-compatible client，消除 planner/chat/memory 的重复请求逻辑
- [x] 为云端 planner 增加上下文投影，减少重复 token 和敏感运行时信息外发
- [x] 增加 Adapter conformance tests、连接生命周期测试、聊天去重测试和动作证据测试
- [x] 增加 ESLint 与 GitHub CI 基线，统一执行 lint、typecheck、完整测试和 build
- [ ] MCP SDK 1.30.0、Yggdrasil 1.8.0、Node 22+ 基线与 Mineflayer 4.35.0 精确锁定已完成离线回归；截至 2026-08-14 当前 `npm audit --omit=dev` 返回 0 项，仍需处理真实认证和 Mineflayer 4.37.x 评估
- [x] 将 README 中 8 个 `/c:/xiaoli/...` 机器绝对链接改为仓库相对链接，并收敛到 `docs/README.md` 文档索引

### 整合包 MVP 的进入条件
- [ ] 完成 `启动 -> 自动连接 -> 监听 -> 跟随 -> 停止 -> 聊天 -> 断线 -> 重连` 回归链
- [x] MineflayerAdapter 通过统一 Adapter conformance tests（离线契约层）
- [ ] Web 面板能显示 action 状态、证据、模型超时和 Adapter 连接状态
- [ ] 再实现 Companion Mod + Local Bridge 的 self / players / chat / move / stop MVP

### 明确暂缓
- [ ] 暂不直接实现 Forge/Fabric/NeoForge companion mod 的完整能力
- [ ] 暂不实现复杂模组 GUI、自动合成链和具体模组玩法包
- [ ] 暂不接入 CurseForge、Modrinth、MCMod 在线百科
- [ ] 暂不把完整 84 个工具作为普通聊天模型的默认工具集

## 当前任务：独立 Web 调试面板增强

### 本轮目标
- [x] 确认当前已有独立 MCP server 启动脚本，但完整工具调用仍需要 MCP 客户端
- [x] 将 Web 调试面板定位从只读状态页扩展为本地控制台
- [x] 增加 `Chat Listener` 状态区块
- [x] 增加最后一次快捷动作 JSON 返回展示
- [x] 增加 `Advance Goal` / `Rewind Goal`
- [x] 增加 `Run Once`
- [x] 增加 `Enable hi Reply`
- [x] 增加 `Chat AI` 状态区块与 `Enable AI Chat`
- [x] 更新 README 和手动测试指南

### 后续可做
- [ ] 在 Web 面板增加 bot connect / disconnect，但需要先设计安全确认，避免误退服
- [x] 在 Web 面板增加 observe/self/inventory/nearby 快捷刷新视图
- [x] 在 Web 面板增加常用动作按钮：eat / rightClick / openDoor / attackNearestEntity
- [ ] 评估是否做一个 raw tool runner，用于替代 MCP Inspector 的手填 JSON

### 本轮发现并修复
- [x] `chat.listener` 运行态会被旧持久化配置覆盖 `.env.local` 的默认唤醒词，导致 `wakeNames` 变成乱码后游戏内指令不触发
- [x] `MCBOT_AI_API_KEY` 只提供密钥，不会自动开启 `chat.ai`；已增加默认环境变量和面板按钮用于恢复闲聊

## 当前任务：规划整合包/真实客户端接入路线

### 本轮目标
- [x] 确认当前底层接入仍然是 `mineflayer` / `minecraft-protocol` 单一路线
- [x] 确认高层 agent/runtime/记忆/后勤框架可以保留
- [x] 输出一份整合包支持设计文档
- [x] 在 README 增加该设计文档入口
- [x] 补一条 unreleased 变更记录

### 设计文档需要覆盖
- [x] 为什么现有原版协议 bot 路线不足以支持“本地双开整合包客户端”
- [x] 哪些层可以保留，哪些层必须抽象
- [x] `ClientAdapter` 的最小接口定义
- [x] `MineflayerAdapter` 与未来 `ModdedClientAdapter` 的角色分工
- [x] `ModdedClientBridge` 最小 MVP 能力范围
- [x] 推荐迁移顺序与阶段划分
- [x] 调试策略从 MCP 客户端为主转向项目内调试入口的建议
- [x] Pack Profile / Mod 列表识别层
- [x] Mod 百科缓存层
- [x] Mod Capability Index / Mod Skill Pack 路线
- [x] 云端大模型 / 本地小模型 / 本地代码分工方案

### 暂不在本轮直接实现
- [ ] 不直接改造 `BotRuntime` 为多 adapter
- [ ] 不直接实现 Forge/Fabric/NeoForge companion mod
- [ ] 不直接实现 GUI/容器点击桥接协议
- [ ] 不直接接 CurseForge / Modrinth / MCMOD 在线查询
- [ ] 不直接实现某个具体 mod（如 Farmer's Delight / Create）的自动玩法

## 下一阶段：ClientAdapter 骨架

### 本轮目标
- [x] 新增 `ClientAdapter` / 快照 / 动作结果基础类型
- [x] 新增 `MineflayerAdapter` 骨架实现
- [x] 让 `BotRuntime` 改为内部持有 adapter
- [x] 保持外部 `getActiveBotOrThrow()` 行为不变，先不大面积改工具层
- [x] 让 `chat.send` / `chat.sendVerified` 先真正走 adapter/runtime 统一发送入口
- [x] 让 `chat.requestTeleportToPlayer` / TPA 硬规则先走 adapter/runtime 统一发送入口
- [x] 让 planner `speak` / agent step `speak` 先走 adapter/runtime 统一发送入口
- [x] 让白名单聊天监听的固定回复先走 adapter/runtime 统一发送入口
- [x] 让战略目标汇报/领地警告/挖矿提示先走 adapter/runtime 统一发送入口
- [x] 让 `follow` 链先通过 adapter 读取自身/目标玩家位置，并用 adapter 停止移动
- [x] 让 `follow` 链目标丢失时的观察转头走 adapter/runtime `look` 入口
- [x] 让 `observe.self` / `observe.nearbyPlayers` 先优先走 adapter 观测快照
- [x] 让 `observe.self` 的手持物与四件护甲走统一 inventory adapter 快照
- [x] 让 `agent.stateSnapshot` 的装备和背包摘要走统一 inventory adapter 快照
- [x] 让 `agent.stateSnapshot.selfState` 的自身状态走统一 self adapter 快照
- [x] 让 `agent.stateSnapshot.localWorld.terrain` 的脚下与准星方块走统一 block adapter 快照
- [x] 让 `agent.stateSnapshot` 的附近非玩家实体走统一 entity adapter 快照
- [x] 让 `agent.stateSnapshot` 的附近玩家走统一 player adapter 快照，并保持 observe 工具公开字段兼容
- [x] 让 `observe.nearbyEntities` 先优先走 adapter 观测快照
- [x] 让 `observe.blocks` 的脚下/准星方块先优先走 adapter 观测快照
- [x] 让 `observe.inventory` 的基础背包/手持/槽位快照先优先走 adapter
- [x] 让 `movement.stop` / `player.look` 先优先走 adapter 动作接口
- [x] 让 `movement.walk` 先优先走 adapter 动作接口
- [x] 让 `inventory.holdSlot` / `inventory.holdByCategory` 先优先走 adapter 动作接口
- [x] 让 `interact.swing` 先走 adapter/runtime 动作入口
- [x] 让 `interact.dropHeld` 先走 adapter/runtime 动作入口
- [x] 让 `interact.dropHotbarSlot` 先走 adapter/runtime 动作入口
- [ ] 后续把高频技能逐步从“直接拿 mineflayer bot”迁移到 adapter 能力接口

### 这一步的边界
- [x] 先做底层依赖倒置
- [x] 不改现有 MCP 工具契约
- [x] 不在本轮动 `action-tools.ts` 的大规模调用点

### 发现的技术债 / 后续事项
- [ ] `BotRuntime` 当前直接暴露并依赖 `mineflayer.Bot`，后续抽 adapter 时会牵涉较大范围
- [ ] `action-tools.ts` 中大量技能直接操作 mineflayer 细节，未来要逐步收敛到统一客户端能力接口
- [ ] `follow` 链内部循环仍然直接依赖 `mineflayer` 的 pathfinder/control-state/look 细节，后续再抽最小 helper
- [x] `observe.self` 已完全读取统一 self/inventory adapter 快照，不再直接依赖原生 Mineflayer bot 实体
- [ ] `observe.blocks` 当前只迁了脚下/准星方块，可见方块扫描仍依赖原生 `mineflayer` 视图
- [ ] 容器会话、槽位点击和后勤工具仍主要依赖原生 `mineflayer` 视图，后续继续迁到 adapter
- [x] Chat AI 请求诊断已通过 `AiRequestLifecycle` 按 botId 回写当前 Store，排队旧闭包也通过配置代次跳过
- [x] Self-guard `entityHurt` handler、主 tick 与持续反击 tick 已按 botId 读取当前 Store，重连 emitter 由独立 registry 替换
- [x] 调试面板已显示当前 adapter 类型、连接快照和能力支持表，作为整合包路线的可观测基线
- [x] 调试面板已显示最近 24 条经统一 adapter 入口执行的动作；聊天内容不进入该记录
- [ ] 调试面板目前仍不是完整后台；等 ModdedClientBridge 落地后，再加入 bridge 连接、GUI、事件和 action queue 可视化

## Current task: Shared game memory dual-write

### Completed
- [x] Define a shared `players.json` / `places.json` store matching `docs/shared-memory-plan.md`
- [x] Resolve `XIAOLI_MEMORY_DIR` / `MCBOT_MEMORY_DIR` without reading or writing secrets
- [x] Use atomic file replacement for structured shared-memory writes
- [x] Add offline tests for missing, valid, invalid, and rewritten files
- [x] Keep `memory.player.*` and `memory.place.*` dual-writing to legacy runtime state and shared files
- [x] Reflect player/place delete and scoped clear operations in the shared files
- [x] Add Web debug visibility for shared game-memory paths, counts, last write, and write errors
- [x] Document the storage foundation and manual verification path

### Deferred
- [ ] Do not yet replace `chat-configs.json` runtime memory persistence
- [x] Import shared player/place records into active bot runtime on startup, retaining newer legacy records as fallback
- [ ] Do not write transient task history into the shared long-term store in this phase
- [ ] Add an explicit one-time migration/export command only after real shared-memory restart verification

## Current task: McBot prompt profile in shared memory

### Completed
- [x] Keep McBot on its own game prompt profile; do not load Voice/live `context-pack.json` as the game chat prompt
- [x] Move the default prompt profile path to `C:\xiaoli\memory\prompts\mcbot-prompt-profile.json`
- [x] Keep `MCBOT_PROMPT_PROFILE_PATH` as an explicit override
- [x] Copy the legacy AppData prompt profile once when the shared file is missing
- [x] Update README, shared prompt plan, shared memory README, and release notes
## Current task: Debug panel prompt profile visibility

### Completed
- [x] Add a collapsed `Prompt Profile` panel showing active prompt file paths
- [x] Add `Reload Prompt` Web action and action-history logging
- [x] Update README, manual testing guide, TODO, and release note
## Current task: Debug panel shared chat memory visibility

### Completed
- [x] Add a `Shared Chat Memory` panel showing shared chat-memory paths and pending counts
- [x] Reuse `memory.chat.status` backend logic for the Web debug payload
- [x] Update README, manual testing guide, TODO, and release note

## Current task: Pending test backlog and debug panel visibility controls

### Completed
- [x] Add a consolidated pending-test backlog to `docs/manual-testing-guide.md`
- [x] Add `Expand All` / `Collapse All` controls to the Web debug panel
- [x] Document the new controls in `README.md`
- [x] Add a controlled `Raw Action Runner` for existing Web `/api/action/*` debug actions
- [x] Persist Raw Action Runner inputs in the current browser to reduce repeated JSON entry
- [x] Add copy buttons for the latest action result and current raw JSON payload
- [x] Add `Attack Nearest` debug selection details for nearby candidates and filter reasons
- [x] Add copy/download controls for the current Web `Action History`
- [x] Add `Clear History` for the selected bot's Web action history
- [x] Add copy/download controls for the latest full Web debug snapshot
- [x] Add a bright Web debug-panel theme with Chinese labels and tooltips for common controls
- [x] Localize common Web debug-panel prompts, confirmations, status messages, and raw action labels
- [x] Group Web debug-panel toolbar controls by status, history, goal, chat, item, interaction, and dangerous actions
- [x] Add color-coded summary-card states and a distinct risk style for `Attack Nearest`
- [x] Persist each browser's debug-panel collapse state across page refreshes
- [x] Add a page-only auto-refresh pause and resume control for inspecting remote test evidence
- [x] Make summary cards open and scroll to their corresponding detailed status panels
- [x] Keep the last successful debug snapshot visible when browser refresh polling temporarily fails
- [x] Add a read-only client-adapter status panel for modded-client migration observability
- [x] Expose the same read-only adapter snapshot through `client.adapter.status` for MCP clients
- [x] Add an offline regression test for the Mineflayer adapter status contract
- [x] Cover adapter action-history success, failure, chat-redaction, and 24-entry retention boundaries
- [x] Add Chinese labels for client-adapter capabilities and recent actions in the Web display
- [x] Replace the multi-prompt `Set Goal` flow with one consolidated goal form

### Deferred
- [ ] Keep Web `bot.connect` / `bot.disconnect` buttons deferred until login/account safety is explicitly designed
- [ ] Keep full arbitrary MCP tool execution deferred; the current raw runner is limited to Web debug actions

## 当前任务：固定坐标移动 Adapter 迁移

### 计划
- [x] 抽出固定坐标移动的到达、距离、冲刺和垂直跳跃纯决策，并覆盖边界与非法输入测试
- [x] 增加 `move_to_position` ClientAdapter capability、`moveTo` 动作和 BotRuntime 动作证据
- [x] 将 `goToPosition` 的坐标读取、pathfinder 和 control-state 操作迁移到 Runtime/Adapter
- [x] 保留现有 MCP 参数、200ms 检查周期、停止半径、任务生命周期和所有既有调用入口
- [x] 更新架构进度、测试文档、README、CLAUDE.md 和 unreleased 变更条目

### 本轮边界
- [x] 不迁移挖矿专用寻路、容器会话和 `waitUntilNearPosition` 的原生 Mineflayer 读取
- [x] 不改变固定坐标移动的超时策略；当前循环仍由调用方或停止动作结束
- [x] 游戏内行为回归记录为待测，不用离线测试冒充真实寻路验证

## 当前任务：采矿 Adapter 迁移设计

### 已完成
- [x] 盘点四条重复的可见采矿执行链路
- [x] 定义 additive `mine_block` / `mineBlock` 候选契约和结构化 outcome
- [x] 记录单块与批量采矿的兼容错误映射
- [x] 将 `mine.digNearestVisible` 定为第一阶段试点，不批量重写所有入口
- [x] 对照官方 pathfinder 行为，识别当前 mining profile 仍可能搭方块的风险

### 等待确认
- [x] 确认新增 `ClientAdapter.mineBlock()` 公共契约
- [x] 确认所有寻路禁止挖路、搭路、搭柱、脚手架、跑酷和大落差
- [x] 确认不可达或路线明显绕远时，由玩家指令上层回复一次“我跟不上你啦”

### 确认后实施
- [x] 先写安全 profile、路线绕远判定与 MineBlock outcome 测试
- [x] 实现 Mineflayer `mineBlock` 和 BotRuntime 动作证据
- [x] 仅迁移 `mine.digNearestVisible` 作为试点并即时验证
- [ ] 游戏内回归后再迁移 MCP collect、Agent collect 和玩家附近清理

### 待游戏内验证
- [ ] 可达目标：`mine.digNearestVisible` 只挖指定目标，Adapter 历史出现 `mine_block`
- [ ] 不可达目标：不会挖路、搭路、搭柱或放脚手架，任务记录结构化失败原因
- [ ] `no_path` / `path_timeout` / `detour_too_long` / `approach_timeout` 时只说一次“我跟不上你啦”
- [ ] 游戏回归通过前，不迁移其余三个批量采矿入口

## 当前任务：单一 Tool/Skill Catalog 设计

### 已完成
- [x] 盘点 MCP 注册、默认 Agent allowlist、Skill Catalog 和 Web 标签的重复来源
- [x] 明确 Catalog 只统一工具元数据与暴露策略，不集中领域 handler
- [x] 明确 Skill Module 继续负责战略动作编译，并通过 Catalog 校验目标工具
- [x] 定义“不改工具名、参数、返回与持久化自定义 allowlist”的兼容边界
- [x] 将 17 个默认 Agent 工具定为第一批迁移范围

### 等待确认
- [x] 确认先实现 metadata-only Catalog，不立即批量改写 MCP 注册
- [x] 确认默认 Agent allowlist 改由 Catalog 派生，自定义持久化值仍原样保留
- [x] 确认 MCP 工具、Web 快捷动作和 Adapter action 暂不强行合并为同一种 ID

### 确认后实施
- [x] 新增类型安全的 Agent 核心工具 Catalog、查询函数和完整性校验
- [x] 让新 bot 的默认 `allowedTools` 从 Catalog 派生
- [ ] 校验所有默认 SkillInvocation 引用的工具已登记且允许 Agent 使用（发现 4 个既有缺口，等待权限决策）
- [x] 覆盖重复 ID、非法暴露组合、默认 allowlist 与持久化兼容测试
- [x] 通过后再选择只读观察工具作为首个 MCP 注册迁移试点

### 只读 MCP 注册试点
- [x] 选择 `observe.self`，不同时迁移其他 observe 工具
- [x] 新增读取 Catalog 元数据的薄注册包装，继续使用 SDK v1 兼容 overload
- [x] 验证名称、描述、输入 schema 约束、handler 和返回行为保持一致
- [x] 迁移 `observe.self` 并运行完整回归

### Observe 子域迁移
- [x] 将 `observe.nearbyPlayers`、`observe.nearbyEntities`、`observe.inventory` 改为 Catalog 驱动注册
- [x] 固化三个工具原有名称、描述、输入 schema、annotations 和 handler 契约
- [x] 运行定向注册测试与完整回归
- [x] `observe.blocks` 不在现有 17 项 Agent 核心 Catalog 中，本轮不扩充目录或默认权限

### Inventory 子域迁移
- [x] 将 `inventory.holdByCategory`、`inventory.organizeHotbar` 改为 Catalog 驱动注册
- [x] 固化两个工具原有名称、描述、输入 schema、annotations、风险和 handler 契约
- [x] 运行定向注册测试与完整回归
- [x] `inventory.holdSlot` 不在现有 17 项 Agent 核心 Catalog 中，本轮不扩充目录或默认权限

### Movement 子域迁移
- [x] 将已有 MCP 工具 `move.followPlayer`、`move.stopFollow` 改为 Catalog 驱动注册
- [x] 固化两个工具原有名称、描述、输入 schema、默认值、annotations、风险和 handler 契约
- [x] 运行定向注册测试与完整回归
- [x] `move.goToPosition` 当前仅是 Agent/Web Raw Action Runner 的执行 ID，没有同名 MCP 注册；本轮不新增公共工具

### Interaction 子域迁移
- [x] 将 `interact.dropHeld`、`interact.dropHotbarSlot`、`interact.openDoor` 改为 Catalog 驱动注册
- [x] 固化三项工具原有名称、描述、输入 schema、默认值、handler 与返回契约
- [x] 保留两项丢弃工具的 `destructive` 风险和开门工具的 `write` 风险，不新增 MCP annotations
- [x] 运行定向注册测试与完整回归

### Chat 子域迁移
- [x] 将已有 MCP 工具 `chat.send` 改为 Catalog 驱动注册
- [x] 固化可选且会 trim 的 botId、必填消息、描述、风险、handler 与返回契约
- [x] `chat.requestTeleportToPlayer` 当前仅是 Agent/聊天硬规则执行 ID，本轮不新增同名 MCP 工具
- [x] `chat.sendVerified` 不在现有 17 项 Agent 核心 Catalog 中，继续使用原注册入口
- [x] 运行定向注册测试与完整回归

### Combat 子域迁移

- [x] 将已有 MCP 工具 `combat.prepareBattle`、`combat.challengeEntity` 改为 Catalog 驱动注册
- [x] 固化两个工具原有名称、描述、输入 schema、默认值、handler 与返回契约
- [x] 保留 `prepareBattle` 的 `write` 风险与 `challengeEntity` 的 `destructive` 风险，不新增 MCP annotations
- [x] 不修改装备选择、目标匹配、决斗状态机或攻击逻辑
- [x] 运行定向注册测试、战斗领域测试与完整回归

### Mining 子域迁移

- [x] 仅将 Agent 核心 Catalog 已登记的 MCP 工具 `mine.collectVisible` 改为 Catalog 驱动注册
- [x] 固化工具原有名称、描述、输入 schema、默认值、handler 与返回契约
- [x] 保留 `destructive` 风险，不新增 MCP annotations
- [x] `mine.digNearestVisible` 不在现有 17 项核心 Catalog 中，继续使用原注册入口
- [x] 不迁移批量采矿 handler；其 Adapter 改造仍等待单块采矿游戏内验收
- [x] 运行定向注册测试、采矿领域测试与完整回归

### 发现的现有契约缺口
- [ ] 默认 Skill Catalog 会编译到 `interact.attackPlayer`、`interact.eat`、`movement.walk`、`player.look`，但当前默认 allowlist 不包含它们
- [ ] 在明确是否扩大默认 Agent 权限前，不静默加入上述 4 个工具；第一阶段测试只验证并保留既有 17 项默认集合

### Skill 权限审计

- [x] 为每个 Skill Module 声明完整的 `toolDependencies`，不改变编译结果
- [x] 增加纯审计函数，按 module/tool 报告 allowlist 缺口
- [x] 固化当前四项默认缺口，并验证所有编译分支都包含在声明依赖内
- [x] 审计时确认四项工具最初均缺少 Agent 内部 dispatcher；当前 `interact.eat`、`player.look`、`movement.walk` 已补齐，`interact.attackPlayer` 仍缺失
- [x] 记录 `socialize` / `observe_target` 当前可能生成缺少 yaw/pitch 的 `player.look` 参数
- [x] 保持 17 项默认 allowlist、Planner 暴露和运行时拒绝行为不变
- [x] 运行定向 Skill/Catalog 测试与完整回归

### interact.eat Agent dispatcher

- [x] 新增可独立测试的 Agent 进食执行函数，并复用 `BotRuntime.eatFood()`
- [x] 接入 `executeAgentToolCall()`，不访问原生 Mineflayer
- [x] 校验可选 `itemName` 的类型、trim 和非空约束
- [x] 覆盖默认食物、指定食物、`ok: false` 和底层异常路径
- [x] 保持 `interact.eat` 不在 17 项默认 allowlist，Planner 暴露与 MCP 契约不变
- [x] 运行定向执行器测试与完整回归

### player.look Skill 语义修复

- [x] 确认 `deadline-recover` 生成的 `observe_target` 不携带 `yaw/pitch`
- [x] 先补回归测试，覆盖缺少、部分缺少和非有限角度
- [x] 有完整有限角度时保留 `player.look`
- [x] 无有效角度的 `socialize` / `observe_target` 分别降级为附近玩家 / 实体观察
- [x] 保持 `player.look` 不在 17 项默认 allowlist，不新增 Agent dispatcher 或 MCP 契约
- [x] 运行定向 Skill 测试、类型检查、完整回归与构建

### player.look Agent dispatcher

- [x] 先补回归测试，确认允许该工具时不再落入 `Unsupported agent tool`
- [x] 新增可离线测试的 Agent 转头执行函数，并复用 `BotRuntime.look()`
- [x] 校验 `yaw/pitch` 为有限数字，`force` 为可选布尔值且默认 `true`
- [x] 覆盖成功、无效参数、`ok: false` 和底层异常路径
- [x] 保持 `player.look` 不在 17 项默认 allowlist，不改变 MCP schema 或 Planner 暴露
- [x] 运行定向测试、类型检查、完整回归与构建

### movement.walk Agent dispatcher

- [x] 先补回归测试，覆盖 dispatcher 定时停止与 Wander Skill 类型保持
- [x] 新增 Agent 步行执行函数，校验 `durationMs` 为 100-60000 的整数
- [x] 严格校验 `sprint/jump` 布尔值，不接受字符串等隐式转换
- [x] 取消旧跟随/步行，停止当前移动后再启动，并保证计时结束时停止
- [x] 覆盖成功、边界、无效参数、`ok: false` 和底层异常路径
- [x] 保持 `movement.walk` 不在 17 项默认 allowlist，不改变 MCP schema 或 Planner 暴露
- [x] 运行定向测试、类型检查、完整回归与构建

### movement.walk 权限开放前阻塞

- [ ] 增加地形前视、悬崖/大落差和碰撞保护；当前实现只是限时直接前进，不是 Pathfinder 安全移动
- [ ] 在游戏内验证定时停止、替换旧计时器、取消跟随和断线期间停止失败的可观察结果
- [ ] 上述安全验收完成前，不把 `movement.walk` 加入默认 Tool Catalog 或 allowlist

### 安全移动 fail-closed

- [x] 先补回归测试，禁止 `moveTo` / `pursueEntity` 在 Pathfinder 缺失或拒绝目标时退化为直接前进
- [x] 失败时清除 `forward`、`jump`、`sprint` 控制状态，并通过 Adapter action history 保留失败证据
- [x] 保持 `ClientAdapter` 方法签名、Tool Catalog、MCP schema 和默认 allowlist 不变
- [x] 同步安全移动文档和手动验收项
- [x] 运行定向测试、完整测试、类型检查和构建

### 安全移动后续监控

- [x] 复用现有路线评估，为定点移动和实体追击等待首轮完整 `path_update`
- [x] 首轮 `noPath` / `timeout` / 长绕行归一为结构化移动失败，并清理监听器与移动状态
- [x] 跟随收到结构化不可达失败时结束任务，只发送一次“我跟不上你啦”
- [x] 新目标必须取消旧首轮监听，避免多个动态目标的 `path_update` 串台
- [x] 先定义持续移动事件契约、关联 ID、生命周期和兼容边界，详见 `docs/movement-event-contract-design.md`
- [x] 经确认后，为 `ClientAdapter` 增加 additive `subscribeMovementEvents()`，并为移动输入增加可选 `movementId`
- [x] 先补离线测试，覆盖首轮成功后的 `noPath` / `timeout` / 长绕行、目标替换、主动停止和断线清理
- [x] 让 Mineflayer 首轮监听在成功后转为持续监听；后续失败必须先停止再发一次关联事件
- [x] 通过 `BotRuntime` 转发移动事件，并把异步失败写入 Adapter action history
- [x] 让定点移动、跟随和决斗按 `movementId` 消费事件；旧目标事件不得停止新任务
- [x] 保持 MCP schema、Tool Catalog、默认 allowlist 和现有 Promise 初始失败行为不变
- [ ] 在真实服务器验证障碍绕行、无法上坡、长绕路和失败后停止，不用离线测试替代游戏行为验收

## 当前任务：白名单汇报目标迁移到 Adapter 快照

- [x] 新增纯玩家选择器，按距离选择带有效坐标的最近白名单玩家
- [x] 先覆盖白名单过滤、无效快照、距离排序和无匹配目标测试
- [x] 将 `sendReportToNearestWhitelist()` 从原生 Mineflayer 玩家表迁到 `BotRuntime.getNearbyPlayers()`
- [x] 保持原有移动半径、场景台词、MCP 参数和默认权限不变
- [x] 更新架构说明、changeset 与项目索引，并运行定向测试、完整测试、类型检查和构建

## 当前任务：地点记忆入口迁移到 Adapter 自身快照

- [x] 新增纯自身位置解析器，校验有限坐标、规范化维度并保留三位小数输出
- [x] 先覆盖正常快照、缺失快照、缺失坐标和非有限坐标测试
- [x] 将 Web Capture Place 与 MCP `memory.place.captureHere` 改读 `BotRuntime.getSelfState()`
- [x] 将 MCP `memory.place.nearest` / `memory.place.goTo` 的当前位置和维度读取迁到 Adapter 快照
- [x] 保持 MCP schema、返回字段、维度冲突文案、安全移动入口和持久化格式不变
- [x] 更新 README、路线图、手测积压、changeset 与 CLAUDE，并完成全量验证

## 当前任务：战略目标确定性激活迁移到 Adapter 快照

- [x] 固化地点维度兼容规则并覆盖相同、不同和未知维度测试
- [x] 跟随目标激活改用 `BotRuntime.getPlayerSnapshot()`，保持仅可见玩家才触发
- [x] 记忆地点激活改用 Adapter 自身维度和普通坐标，继续复用安全定点移动
- [x] 保持 auto/busy/queue/task 门槛、激活返回字段、事件文案和默认跟随参数不变
- [x] 更新 README、路线图、核心链手测、changeset 与 CLAUDE，并完成全量验证

## 当前任务：空闲跟随主人策略迁移到 Adapter 快照

- [x] 新增纯空闲跟随决策器，固化主人距离、冲刺和记忆地点回退阈值
- [x] 先覆盖主人可见/不可见、边界距离、无效快照和无回退地点测试
- [x] 将 `follow_owner` 从原生 `bot.players` / `bot.entity` / `bot.game` 迁到 Adapter 玩家与自身快照
- [x] 保持默认跟随参数、记忆地点优先级、事件文案、安全移动入口和配置契约不变
- [x] 记录 `socialize_whitelist` 仍缺少 Adapter 定点观察能力，不在本轮扩展公共接口
- [x] 更新 README、路线图、手测积压、changeset 与 CLAUDE，并完成定向及全量验证

## 当前任务：Agent 定点移动 dispatcher 移除原生 Vec3 依赖

- [x] 先补回归测试，证明 `move.goToPosition` 不需要 `getActiveBotOrThrow()` 也能受理
- [x] 将 `move.goToPosition` 移到 Mineflayer 专用 dispatcher 边界之前并传普通坐标
- [x] 保持数值转换、错误文案、默认 `stopRadius=2.3`、返回文本和安全移动链不变
- [x] 不修改仍依赖方块扫描与挖掘 API 的 `mine.collectVisible`
- [x] 更新 README、路线图、手测积压、changeset 与 CLAUDE，并完成定向及全量验证

## 当前任务：Agent 紧凑状态摘要迁移到 Adapter 快照

- [x] 先补回归测试，证明 Agent 内部 `observe.self` 不需要原生 bot 句柄
- [x] 覆盖完整 vitals 与缺失/非有限 vitals 的摘要输出
- [x] 移除 `buildAgentStateSummary()` 的 `getActiveBotOrThrow()` 及原生 health/food 兜底
- [x] 保持 Mineflayer 正常输出、玩家/实体排序、背包摘要和 MCP `observe.self` 契约不变
- [x] 更新 README、路线图、手测积压、changeset 与 CLAUDE，并完成定向及全量验证

## 当前任务：AI 闲聊动态状态分阶段迁移到 Adapter 快照

- [x] 新增纯动态状态文本投影器，固定距离、时间、vitals 和 focus 格式
- [x] 先覆盖完整状态、阈值边界与缺失/非有限字段测试
- [x] 将生命、饥饿、手持物、食物数量、最近玩家和准星方块改读 Adapter 快照
- [x] 保留 Mineflayer 精确实体 focus 作为可选增强，不扩展 ClientAdapter 公共接口
- [x] 保持 bot 未连接时的原四行 fallback 和当前 Mineflayer 正常输出不变
- [x] 更新 README、路线图、手测积压、changeset 与 CLAUDE，并完成定向及全量验证

## 当前任务：领地入侵检测迁移到 Adapter 玩家快照

- [x] 新增纯领地 presence 决策器，输出最近入侵者、全部活跃 presence key 和主人在场状态
- [x] 先覆盖最近目标、主人/白名单过滤、范围边界、无效快照和 owner policy 测试
- [x] 将 `maybeHandleTerritoryWarning()` 的维度、自身身份和玩家遍历改读 Adapter 快照
- [x] 升级战斗继续使用稳定 `entityId` 的现有 Adapter 决斗链，不扩展公共接口
- [x] 保持警告冷却、presence 清理、事件文案、配置结构和领地半径不变
- [x] 更新 README、路线图、手测积压、changeset 与 CLAUDE，并完成定向及全量验证

## 当前任务：空闲社交目标选择迁移到 Adapter 玩家快照

- [x] 新增纯空闲社交选择器，固化 relation、tags、10 分钟活跃度和距离评分
- [x] 先覆盖 owner 优先、信任标签、活跃边界、距离边界、白名单和无效快照测试
- [x] 将 `performIdleSocialize()` 的候选遍历和评分改读 Adapter 玩家快照
- [x] 精确 `lookAt` 暂留 Mineflayer 兼容边界，玩家消失时走现有任务失败链
- [x] 保持距离上限、最低冷却、alias 称呼、场景台词和配置契约不变
- [x] 更新 README、路线图、手测积压、changeset 与 CLAUDE，并完成定向及全量验证

## 当前任务：自卫周期状态迁移到 Adapter 快照

- [x] 新增纯自卫状态决策器，固化低血量、危险血量、低饥饿和自动进食阈值
- [x] 先覆盖正常、阈值边界、关闭自动进食及缺失/非有限状态的 fail-closed 测试
- [x] 将库存变化摘要、食物存在性和附近玩家检测改读 Adapter 快照
- [x] 将主循环与排队后的自动进食二次检查改读 Adapter 自身/背包快照
- [x] 保留 Mineflayer 受伤事件、昼夜天气和原生实体反击边界，不扩展公共接口
- [x] 更新 README、路线图、手测积压、changeset 与 CLAUDE，并完成定向及全量验证

## 当前任务：salient 感知角色列表迁移到 Adapter 快照

- [x] 新增纯 salient actor 投影器，固化玩家关系、距离排序和重要实体关键词
- [x] 先覆盖白名单/自身过滤、半径边界、数量上限、无效快照和非法半径测试
- [x] 将 `perception.salient` 与 Agent state snapshot 的玩家/实体来源改读 Adapter 快照
- [x] 保留附近可交互方块扫描的 Mineflayer 边界，不扩展公共接口或修改 MCP 返回结构
- [x] 删除迁移后不再使用的原生附近实体摘要 helper
- [x] 更新 README、路线图、手测积压、changeset 与 CLAUDE，并完成定向及全量验证

## 当前任务：统一 OpenAI-compatible 请求传输层

- [x] 先补 endpoint 归一化与 HTTP POST 契约测试，覆盖完整 endpoint、版本化/普通 base URL、鉴权头和 JSON 请求体
- [x] 抽取只负责 endpoint、鉴权、超时和原始响应的公共客户端，不接管业务解析与错误文案
- [x] 逐条迁移 Agent planner、AI 闲聊和聊天记忆总结，保持各自 fallback、返回解析和错误前缀不变
- [x] 更新 README、路线图、changeset 与 CLAUDE，并完成定向、全量、类型检查和构建

## 待确认：`self.guard.check` 缺失 vitals 的公开契约

- [ ] 当前工具在 Adapter 未提供 `health` / `food` 时按 `20` 返回；后续需确认应改为 `available: false`、字段为 `null` 还是工具错误，确认前不修改 MCP 响应语义

## 历史记录：云端 Planner 上下文投影设计（已由下方任务完成）

- [x] 盘点当前 planner 外发的精简观察、记忆摘要与完整状态快照
- [x] 定义字段白名单、数据流、缺失字段行为、数量上限与兼容边界，详见 `docs/planner-context-projection-design.md`
- [x] 经确认后先写纯投影器回归测试，覆盖坐标、实体 ID、notes、未知 params 和事件 payload 不外发
- [x] 实现 `buildPlannerContextProjection()` 并移除 planner 请求中的完整状态消息
- [x] 更新 README、路线图、测试文档、changeset 与 CLAUDE，并完成全量验证

## 当前任务：云端 planner 上下文投影

- [x] 阅读完整状态快照、现有精简观察、任务上下文、记忆摘要和事件结构，明确本地调试与云端请求边界
- [x] 记录字段 allowlist、敏感字段排除规则、兼容边界和后续限制
- [x] 先补纯投影测试，覆盖正常投影、数量上限、敏感字段剔除、畸形输入和不修改原对象
- [x] 提取 planner context/memory 投影器，并移除云端请求中的完整 `stateSnapshot` 消息
- [x] 保持 `agent.stateSnapshot`、planner 输出 schema、HTTP 错误、取消/超时和执行 fallback 不变
- [x] 更新 README、路线图、AI 架构文档、changeset 与 CLAUDE，并完成定向及全量验证

## 当前任务：配置与聊天记忆原子持久化及退出 flush

- [x] 盘点 `chat-configs.json`、共享 game memory、聊天摘要状态和进程退出路径
- [x] 定义同目录临时文件、文件 sync、rename、失败清理、队列 drain 与 shutdown 顺序
- [x] 先补原子 JSON writer 的创建、替换、序列化失败和 rename 失败清理测试
- [x] 将 chat config 与 chat summary state 改用公共原子 writer，保持路径和 JSON schema 不变
- [x] 为配置、共享 game memory、聊天日志和聊天摘要队列增加显式 flush
- [x] 接入 SIGINT/SIGTERM 关闭链，并覆盖执行顺序、重复关闭和失败汇总测试
- [x] 更新 README、路线图、手测文档、changeset 与 CLAUDE
- [x] 完成全量测试、类型检查、构建和 diff 检查

## 待确认：`chat-configs.json` schema version

- [ ] 当前配置文档没有 `version` 字段；新增顶层版本号属于持久化配置结构变更，需确认兼容策略后单独实施

## 当前任务：ESLint 与 GitHub CI 基线

- [x] 盘点现有 TypeScript、Node engine、Git 仓库根和自动化命令
- [x] 对照官方文档选择 flat config，并避开会收紧 Node 契约的 ESLint 10
- [x] 定义 lint 范围、依赖版本、CI 触发路径、命令顺序和兼容边界
- [x] 安装并锁定 ESLint 9、typescript-eslint 与 Node globals
- [x] 先运行 recommended 基线，逐项处理现有诊断且不批量改风格
- [x] 在仓库根增加锁定 action commit 的 GitHub Actions workflow
- [x] 更新 README、路线图、CLAUDE、changeset，并完成 lint/typecheck/test/build/diff 验证

### Lint 已隔离的历史债务

- [x] `src/tools/action-tools.ts` 已删除 7 处未使用符号并恢复 `no-unused-vars` 检查
- [ ] `src/tools/action-tools.ts` 在按领域拆分和原生类型收窄前暂时只豁免 `no-explicit-any`；新模块不继承该豁免
- [ ] `src/runtime/mineflayer-adapter.ts` 仍有少量 Mineflayer 原生对象兼容 `any`；待上游类型/内部窄接口完善后移除文件级豁免

### 依赖安全审计债务

- [x] 2026-07-31 快照中的 17 项依赖告警已记录为历史事实；截至 2026-08-14 重新运行 `npm audit --omit=dev` 返回 0 项，当前未发现生产依赖审计告警
- [ ] MCP SDK 与 Yggdrasil 包版本升级已完成；继续分别验证 MCP Web 传递依赖、UUID/Microsoft 认证链和 Mineflayer，先补齐外部 stdio、真实登录、认证与寻路回归，不执行会建议降级 Mineflayer 的 `npm audit fix --force`
- [ ] 配置 Git remote 并首次推送后，确认 `moony-mcbot CI` 在 GitHub runner 的干净环境通过

## 当前任务：收紧 action-tools 未使用符号检查

- [x] 单独启用 `@typescript-eslint/no-unused-vars`，确认现有豁免只隐藏 7 处确定的未使用符号
- [x] 逐处检查 import、纯 helper、局部变量和旧回调包装器，确认没有静态调用方
- [x] 删除未使用代码，并从 `action-tools.ts` 文件级覆盖中移除 `no-unused-vars` 豁免
- [x] 运行 action-tools 定向 lint、全量 lint、typecheck、完整测试和 build
- [x] 更新 lint 设计、CLAUDE、changeset 与 TODO；`no-explicit-any` 继续作为独立迁移债务保留

## 当前任务：容器物品投影类型收窄

- [x] 盘点记忆容器 inspect/deposit/withdraw 路径及其 Mineflayer Bot、Item、Chest/Dispenser 类型
- [x] 确认本轮只抽取物品序列化、汇总、匹配和容器内容读取，不设计公共 ContainerSession 或 Adapter capability
- [x] 新增纯 `container-inventory` 模块与测试，覆盖序列化、排序汇总、exact/includes 匹配和读取回退顺序
- [x] 将 action-tools 容器段改用窄类型，保持寻路、开箱、等待、存取、关闭和 MCP 契约不变
- [x] 显式 `any` 文本命中由 99 降至 69，并完成定向测试、lint、typecheck、190 项完整测试和 build
- [x] 更新 runtime README、路线图、手测积压、CLAUDE、changeset 与 TODO

### 后续边界

- [ ] 真实箱子/木桶回归通过前，不把纯物品投影视为容器会话迁移完成
- [ ] ContainerSession 与 Adapter capability 需要单独设计取消、关闭、窗口变化、模组容器识别和动作证据，不在本轮追加公共接口

## 当前任务：准星实体聚焦几何与类型收窄

- [x] 盘点 `perception.focus`、AI 动态状态与 salient 方块扫描中的 Mineflayer 原生类型边界
- [x] 抽取纯实体聚焦选择器，并覆盖正前方、角度、距离、方块遮挡和候选排序测试
- [x] 将 focus/salient 调用路径改用 `MineflayerBot` 与明确快照类型，移除对应显式 `any`
- [x] 保持 MCP 工具名、输入 schema、输出字段和实体优先于方块的既有行为不变
- [x] 更新 runtime README、路线图、手测积压、CLAUDE、changeset 与 TODO
- [x] 完成定向测试、lint、typecheck、195 项完整测试、build 和 diff 自审

## 当前任务：Agent 状态快照内部类型收窄

- [x] 盘点状态同步、唤醒上下文、战略汇报、记忆地点摘要、生命周期修复和自治规划消费者
- [x] 确认 planner 安全投影继续接收未知结构，Web/MCP 调试返回契约保持不变
- [x] 让 `buildAgentStateSnapshot()` 使用 Mineflayer 正式类型并推导唯一内部 `AgentStateSnapshot`
- [x] 将内部消费者改用推导类型，移除重复 `Record<string, any>`、元素 `any` 和战略目标强转
- [x] 复用动态状态、planner 投影、Agent 黑板和执行器回归；本轮无新行为，不为私有 helper 扩大导出面

### 后续测试边界

- [ ] 战略汇报评分与记忆地点摘要后续从 `action-tools.ts` 拆成纯模块时，补 owner/whitelist、距离、标签、时效和地点标签排序单测
- [x] 更新 runtime README、路线图、手测积压、CLAUDE、changeset 与 TODO
- [x] 完成 45 项定向测试、lint、typecheck、195 项完整测试、build 和 diff 自审

## 当前任务：旧采矿扫描与 Pathfinder helper 类型收窄

- [x] 阅读采矿 Adapter 迁移设计并盘点玩家附近清理、Agent 批量采矿、MCP 查询与容器接近调用点
- [x] 确认本轮只收紧旧 Mineflayer helper 类型，不迁移可见扫描 capability、不修改安全 profile 或采矿策略
- [ ] 用窄兼容类型保留 Pathfinder named/default 导出回退和 bot movement 缓存
- [ ] 将目标坐标、等待距离、可见方块结果和最近候选改用明确 Mineflayer/坐标类型
- [ ] 移除相关调用点的 bot `any`，保持 MCP 输入输出、超时、扫描数量与排序不变
- [ ] 复用采矿接近、Pathfinder 安全 profile、Adapter 采矿和 MCP 注册回归，不增加测试专用导出
- [x] 更新 runtime README、采矿设计、路线图、手测积压、CLAUDE、changeset 与 TODO
- [x] 完成 30 项定向测试、lint、typecheck、195 项完整测试、build 和 diff 自审

## 当前任务：可见方块扫描与旧采矿寻路类型收窄

- [x] 阅读采矿 Adapter 迁移设计和 `mineflayer-pathfinder` 类型声明，确认可见扫描仍是兼容边界
- [x] 确认普通/采矿 profile 均继续禁止挖路、搭路和危险移动，不调整路径阈值或失败语义
- [x] 用窄模块兼容接口和 `WeakMap` 替代 pathfinder 导出与 Movements 缓存的动态对象写入
- [x] 将 GoalNear、位置等待、可见方块扫描和最近目标选择改用 Mineflayer/位置明确类型
- [x] 收紧相关调用方，保持 MCP schema、扫描数量、排序、射线和批量采矿流程不变
- [ ] 更新 runtime README、采矿设计、路线图、手测积压、CLAUDE、changeset 与 TODO
- [ ] 完成定向测试、lint、typecheck、完整测试、build 和 diff 自审

### 后续类型边界

- [ ] `mineflayer-mining.ts` 的窄客户端把 entity effects 建模为字典，而 Mineflayer 4.33 声明为数组；后续拆分独立 ray-cast 接口，移除可见扫描处的局部 `unknown` 兼容桥

## 当前任务：2026-07-30 全项目架构与实现审计

- [x] 确认本轮只做审计、文档收敛与基线验证，不修改公共接口或顺手重构业务代码
- [x] 盘点目录、依赖、脚本、配置、CI、文档索引与发布条目现状
- [x] 审阅启动、认证、连接、重连、关闭与持久化生命周期
- [x] 审阅 ClientAdapter、动作执行、寻路、采矿、战斗与原生客户端兼容边界
- [x] 审阅 Agent 黑板、事件、规划器、技能目录、权限与状态投影链路
- [x] 审阅聊天、提示词、共享记忆、调试 Web 与 MCP 工具链路
- [x] 盘点自动化测试、真实游戏回归、安全风险、依赖健康度与可观测性缺口
- [x] 输出按严重度排序的审计报告和分阶段收敛建议
- [x] 同步 README、架构路线图、CLAUDE、changeset 与 TODO
- [x] 完成 lint、typecheck、195 项完整测试、build、40 个本地文档链接、165 个 changeset 和 diff 自审

### 审计后实施队列

- [x] P0：为未捕获异常补失败回归测试，并接入幂等 shutdown；异常后不得继续动作循环
- [x] P0：确认 `chat-summary-state.json` 兼容迁移格式后，把摘要和 prompt 按 bot 隔离
- [x] P0：把 `chat.config.reload` 改为解析、校验、提交事务；损坏文件和已删除条目必须有回归测试
- [x] P1：让测试文件进入 TypeScript 类型检查，并自动校验默认测试命令没有漏文件
- [ ] P1：MCP SDK、Yggdrasil、Node 22+ 基线与 Mineflayer 4.35.0 锁定已分别完成；继续完成真实登录回归，再单独评估 Mineflayer 4.37.x
- [ ] P1：确认 Adapter 配置和异步断开兼容策略后，统一 BotRuntime 的 Adapter 生命周期
- [ ] P1：建立统一 Command Invocation / Action Result，再按状态所有权拆分 `action-tools.ts`
- [x] P2：Web action history 递归脱敏、共享 JSON writer 复用和 release entry CI 校验已完成；首次 release 与 TODO 归档批次仍待确认
- [x] P2：隔离自动化测试对工作区 `.env.local` 的加载，避免本地密钥与个人模型配置影响离线测试结果

详细证据、保留项与阶段退出条件见 `docs/project-audit-2026-07-31.md`。

## 当前任务：致命进程异常有序退出

- [x] 阅读主入口、shutdown lifecycle、持久化设计和现有生命周期测试
- [x] 确认不修改 MCP、配置或 JSON 契约，只收口进程事件与启动失败处理
- [x] 先补失败测试：致命错误立即锁定失败退出码，并只启动一次 shutdown
- [x] 覆盖 signal 后再发生 fatal、shutdown hook 失败和事件监听卸载边界
- [x] 让关闭 Web listener 与停止 action runtime 同步起步，避免活动请求拖住停动作
- [x] 在 `main.ts` 建立 lifecycle，并把 signal、fatal 和 startup failure 接到同一 coordinator
- [x] 更新 runtime README、持久化设计、架构审计、CLAUDE、changeset 与 TODO
- [x] 完成 10 项定向测试、lint、typecheck、201 项完整测试、build、真实 Node fatal 子进程探针、文档链接和 diff 自审

## 当前任务：多 Bot 聊天摘要隔离与 v1 兼容迁移

- [x] 盘点 `chat-summary-state.json`、摘要 JSONL、McBot prompt 和 Voice/shared-context 读取边界
- [x] 确认 Voice 不直接消费该状态文件，当前 v1 状态及最近摘要记录可唯一归属到同一个 Bot
- [x] 确认 v2 schema：保留全局计数和 `pendingByBotId`，新增 `summariesByBotId`，对归属不明的旧摘要只保留不注入
- [x] 先补 v1 单 Bot 迁移、歧义迁移隔离、v2 多 Bot prompt 隔离和持久化回归测试
- [x] 实现 v1/v2 严格解析、按 Bot 摘要滚动、原子 v2 写入及兼容调试状态
- [x] 更新共享 memory README、项目 README、路线图、审计报告、CLAUDE、changeset 与 TODO
- [x] 完成 14 项相关测试、lint、typecheck、206 项完整测试、build、v1 备份与真实 v2 迁移探针、24 个本地文档链接、新 changeset 和 diff 自审

## 当前任务：配置热重载事务化

- [x] 盘点 `chat-configs.json` 类型、四个配置 Map、Agent 派生状态、启动加载和 `chat.config.reload` 契约
- [x] 确认旧实现会边解析边修改全局状态，异常后返回零计数，且不会删除文件中消失的条目
- [x] 确认方案：纯解析校验后同步提交，保留存续条目的运行时秘密/历史，清除已删除条目及其持久化派生状态
- [x] 先补损坏 JSON 不改状态、删除条目生效、合法配置完整替换和缺文件边界测试
- [x] 实现 Zod 配置文档解析器、事务式提交、手动 reload 失败语义和兼容响应
- [x] 更新配置模块 README、项目 README、路线图、审计、手测、CLAUDE、changeset 与 TODO
- [x] 完成 48 项定向测试、lint、typecheck、209 项完整测试、build、真实临时配置/MCP 探针、7 份文档链接、changeset 字段、diff 与代码自审

## 当前任务：测试自动发现与类型门禁

- [x] 核对 Node 20、`tsx --test`、现有 CI、ESLint 和 TypeScript 配置边界
- [x] 确认不修改生产构建与运行时契约：`tsconfig.json` 继续只构建 `src/`，测试使用独立配置
- [x] 先补质量门禁测试，约束默认测试命令必须自动发现且测试 TypeScript 配置必须覆盖 `test/**/*.ts`
- [x] 将 `npm test` 从手写文件清单改为 `tsx --test`
- [x] 新增测试 TypeScript 配置，并让 `npm run typecheck` 同时检查源码与测试
- [x] 修复新门禁暴露出的既有测试类型错误，不借机修改无关生产逻辑
- [x] 更新 README、Lint/CI 设计、路线图、CLAUDE、changeset 与 TODO
- [x] 完成 3 项门禁测试、50 项相关测试、lint、源码/测试 typecheck、212 项完整测试、build、38 个本地文档链接、changeset 字段和 diff 自审；本机为 Node 24.16，Node 20 实跑保留给现有 CI runner

## 当前任务：MCP SDK 1.x 独立升级

- [x] 核对 npm registry、上游仓库、当前 lockfile、Node engine 与生产依赖审计
- [x] 确认边界：只升级 `@modelcontextprotocol/sdk`，不修改 MCP 工具名、schema、stdio 入口、Node engine、Yggdrasil 或 Mineflayer
- [x] 发现现有 lockfile 已解析 Mineflayer 4.35.0，而该版本要求 Node 22；当前 `node >=20` 与 Node 20 CI 的矛盾留待单独确认
- [x] 使用当前 MCP SDK 1.27.1 跑 18 项工具注册和配置重载基线
- [x] 将 MCP SDK 精确固定到 1.30.0；基线比较确认仅 SDK 自身 lock 条目变化，无其他直接或传递依赖漂移
- [x] 增加 MCP Client -> 内存 Transport -> McpServer 协议冒烟测试，覆盖工具发现、调用与 SDK schema 响应校验
- [x] 重跑 MCP 定向测试、lint、源码/测试 typecheck、213 项完整测试和 build
- [x] 比较升级前后的生产依赖审计；总数和依赖名称均未变化，MCP Web 传递链与 Minecraft 认证链继续分开处理
- [x] 更新 README、Lint/CI 设计、架构审计、手测指南、CLAUDE、changeset 与 TODO
- [x] 完成 package/lockfile、39 个本地文档链接、changeset 字段和 diff 自审

### 待手动验证

- [ ] 用外部 stdio MCP 客户端刷新工具列表并调用 `bot.list` / `agent.status`，确认进程初始化与关闭正常

## 当前任务：Yggdrasil 1.8.0 独立升级

- [x] 盘点 `AuthService`、自定义 `authserver` 路径、认证响应映射、连接代次测试和依赖图
- [x] 核对 1.7.0 -> 1.8.0 上游 diff：运行时代码未变化，只更新包版本、`uuid` 8 -> 10、开发依赖与 CI/发布配置
- [x] 确认边界：精确固定 Yggdrasil 1.8.0，不修改 `AuthService`、登录字段、Node engine、Mineflayer、MCP 或持久化契约
- [x] 记录安全限制：1.8.0 仍依赖受当前 `<11.1.1` advisory 影响的 `uuid@10`，预计不会减少现有 17 项生产审计告警
- [x] 新增本地 HTTP 认证契约测试，覆盖请求路径/字段、UUID 规范化、响应缺字段和服务端错误传播，不读取正式账号或网络认证服务
- [x] 在 Yggdrasil 1.7.0 上运行 5 项认证契约与连接取消基线
- [x] 仅升级 Yggdrasil；package/lockfile 只变更根声明、Yggdrasil 条目和其嵌套 `uuid@10`，生产审计总数与名称不变
- [x] 运行 5 项认证/连接定向测试、lint、源码/测试 typecheck、216 项完整测试和 build
- [x] 更新 README、技术栈/审计/手测文档、CLAUDE、changeset 与 TODO
- [x] 完成 39 个本地文档链接、changeset 字段、package/lockfile 和 diff 自审

### 待手动验证

- [ ] 使用真实外置 Yggdrasil 账号完成认证、profile/session 校验、Minecraft spawn 和一次断开重连；错误日志不得包含密码或 token

## 当前任务：Node 22 运行时基线与 Mineflayer 4.35 锁定

- [x] 核对 manifest、lockfile、CI、本机 Node、Mineflayer 与 minecraft-protocol 的 engine 契约
- [x] 核对上游维护状态：Node 20 已 EOL，Node 22/24 仍为 LTS；Mineflayer 4.33/4.35 均要求 Node 22+
- [x] 确认边界：将最低运行时提升到 Node 22，精确锁定当前已验证的 Mineflayer 4.35.0，不升级到 4.37.x，不修改游戏行为或公共工具接口
- [x] 先补运行时版本一致性测试，覆盖 manifest、lockfile、本地版本文件与 CI LTS 矩阵
- [x] 更新 Node engine、`.nvmrc`、CI 22/24 LTS 矩阵和 Mineflayer 精确版本
- [x] 比较 package/lockfile 和生产依赖审计，确认没有意外传递依赖漂移；生产审计仍为原 17 项
- [x] 运行 4 项质量门禁、lint、源码/测试 typecheck、217 项完整测试和 build（本机 Node 24.16）
- [x] 更新 README、技术栈/CI/审计/路线图、CLAUDE、changeset 与 TODO
- [x] 完成 39 个本地文档链接、changeset 字段、CLAUDE 体积、版本契约、package/lockfile 和 diff 自审

### 待手动验证

- [ ] 在 Node 22 环境完成真实 Yggdrasil 登录、Minecraft spawn、跟随/停止跟随和一次断开重连；Node 24 本机离线门禁不能替代该验证

## 当前任务：BotRuntime 与 ClientAdapter 生命周期统一

- [x] 盘点 Runtime、Adapter、Mineflayer service、MCP 工具、进程关闭和全部直接 disconnect 调用方
- [x] 核对上游断开语义：Mineflayer `quit()` 委托 `end()`，底层连接关闭后向 bot 转发 `end` 事件
- [x] 确认边界：不增加 `adapterKind` 配置、不实现 Modded Client、不修改 MCP 工具 schema 或游戏动作
- [x] 写明异步断开、并发幂等、连接失败清理、事件解绑、超时和错误传播契约
- [x] 先补失败测试，覆盖 Runtime 委托/等待、并发断开、断开中连接、Adapter 无 bot/成功/失败/超时及监听解绑
- [x] 让 Mineflayer service 等待 `end` 并提供有界超时，Adapter 始终释放自身引用与订阅
- [x] 让 BotRuntime 只通过 Adapter 连接/断开，显式持有生命周期监听解绑函数，连接失败不再 `removeAllListeners()`
- [x] 将 `BotRuntime.disconnect()` 改为 Promise，并迁移 MCP、process shutdown 和现有测试调用方
- [x] 运行定向测试、lint、源码/测试 typecheck、完整测试和 build
- [x] 更新 Runtime README、项目 README、路线图、审计、手测、CLAUDE、changeset 与 TODO
- [x] 完成文档链接、changeset 字段、公共契约、监听器、package/lockfile 和 diff 自审

### 待手动验证

- [ ] 真实进服后依次验证手动断开、断开中重复点击、断开后重连和进程 `Ctrl+C`；不得出现重复重连、残留动作或超过超时仍显示 spawned

## 当前任务：ClientAdapter 构造选择注入

- [x] 盘点 BotRuntime、BotRegistry、Factory、Bot 配置与现有 Factory/Runtime 测试调用方
- [x] 确认边界：不修改 `BotCreateInput` / `BotConfig`、MCP、环境变量或持久化格式，不实现 Modded Client
- [x] 写明 Factory 对象契约、Runtime/Registry 注入、默认值、kind 校验和构造失败原子性
- [x] 先补失败测试，覆盖默认兼容、自定义 kind/Factory、kind 不匹配和 Registry 构造失败不留半成品
- [x] 实现默认 Factory 对象、BotRuntime 可选依赖和 BotRegistry 透传
- [x] 运行定向测试、lint、源码/测试 typecheck、完整测试和 build
- [x] 更新 Runtime README、项目 README、路线图、审计、CLAUDE、changeset 与 TODO
- [x] 完成文档链接、公共契约、package/lockfile 和 diff 自审

### 待后续确认

- [ ] 是否把 Adapter 选择加入 `BotConfig` / 持久化配置；在真实 Modded Bridge 存在前不提前增加该字段

## 当前任务：统一 Command Invocation / Action Result 试点

- [x] 盘点 Catalog、MCP、Web、Agent 与 `move.stopFollow` 的真实调用路径
- [x] 核对 MCP 工具级错误与协议级错误边界；Context7 当前因 API key 无效不可用，改查官方 MCP TypeScript SDK 文档
- [x] 确认边界：只迁移 `move.stopFollow`，不修改 MCP/Web/Agent 公共输入输出，不拆 follow 状态所有权
- [x] 写明 commandId、调用上下文、输入校验、终态结果、历史上限和入口兼容映射
- [x] 先补 dispatcher 成功、校验失败、执行失败、未知/重复命令和历史边界测试
- [x] 先补 MCP、Web、Agent 三入口兼容回归测试
- [x] 实现独立 CommandDispatcher，并将 `move.stopFollow` 三入口接入同一命令处理器
- [x] 在 Web debug payload 暴露跨入口 command history，保留原 action history
- [x] 运行定向测试、lint、源码/测试 typecheck、完整测试和 build
- [x] 更新 Commands/Runtime README、项目 README、路线图、审计、手测、CLAUDE、changeset 与 TODO
- [x] 完成公共契约、历史深拷贝/脱敏、文档链接、changeset、package/lockfile 和 diff 自审；package/lockfile 仅保留前序依赖修改，本轮未编辑

### 后续命令生命周期

- [ ] 在真实异步动作队列和事件证据存在后，再设计 `accepted`、`confirmed`、`cancelled`；本轮不得把 handler 返回伪装成游戏确认
- [x] Web Action History 的 payload/result/error 已复用统一递归脱敏投影；endpoint 原响应保持不变

## 当前任务：统一调试历史递归脱敏

- [x] 盘点 Command History 与 Web Action History 的 payload、result、error 存储边界
- [x] 确认不修改 Web endpoint、HTTP 状态、响应 body 或 CommandDispatcher 调用方可见结果
- [x] 先补失败回归测试，覆盖嵌套对象、数组、敏感文本、Bearer token、循环引用和副本隔离
- [x] 抽取统一 diagnostics 脱敏投影，并让 Command History 与 Action History 共同使用
- [x] 更新 Debug/Commands README、架构路线图、审计、CLAUDE、changeset 与 TODO
- [x] 完成 15 项定向测试、lint、源码/测试 typecheck、248 项完整测试、build、41 个本地文档链接、changeset、CLAUDE 体积与 diff 自审

## 当前任务：共享游戏记忆原子写入收敛

- [x] 盘点 `SharedGameMemoryStore`、通用 `writeJsonAtomic`、上层持久化队列与现有测试边界
- [x] 核对 Node.js 文件系统并发语义，确认通用写入器负责完整替换和失败清理，上层队列继续负责语义顺序
- [x] 确认不修改共享记忆目录、`version: 1` schema、归一化规则、读取兼容或公开 API
- [x] 先补替换失败后不得残留临时文件的回归测试，并确认旧实现稳定失败
- [x] 让 players/places 写入复用通用 `writeJsonAtomic`
- [x] 更新 Memory README、持久化设计、手测指南、路线图、审计、项目索引、changeset 与 TODO
- [x] 完成 9 项持久化定向测试、lint、源码/测试 typecheck、249 项完整测试、build、41 个本地文档链接、changeset、CLAUDE 体积与 diff 自审

## 当前任务：未发布条目契约校验与 CI 门禁

- [x] 盘点 177 个未发布条目的字段、枚举、正文和历史 `tests` 表达形式
- [x] 确认本轮不移动历史条目、不生成首次 release、不改变运行时或持久化公共契约
- [x] 核对 GitHub Actions 非零退出码失败语义；Context7 因本机 API key 无效不可用，改查 GitHub 官方文档
- [x] 先补文件名、frontmatter、列表、正文、CLI 失败码和真实目录回归测试，并确认缺少实现/门禁时失败
- [x] 实现无新增依赖、只读且不改写文件的 TypeScript release entry 校验器
- [x] 补 scope 一致性失败回归，并确认 9 个旧文件名不符合当前 `<scope>` 契约且没有外部引用
- [x] 接入 `validate:releases`、lint、typecheck 和 GitHub CI
- [x] 更新 scripts README、release 生命周期、Lint/CI 设计、路线图、审计、README、CLAUDE、changeset 与 TODO
- [x] 完成 14 项定向测试、release 178 项校验、lint、源码/脚本/测试 typecheck、259 项完整测试、build、41 个本地文档链接、9 个旧名残留检查、CLAUDE 体积与 diff 自审

### 待确认的归档边界

- [ ] 确认首次 release 的版本、日期、受众和归档目录后，再批量移动 `unreleased` 条目并从条目生成 release note
- [ ] 确认完成任务的保留周期后，再从 `TODO.md` 迁移历史完成记录；本轮不删除已有任务证据

## 当前任务：自动化测试与本地环境文件隔离

- [x] 盘点 `.env.local` 加载器、三处导入入口、顶层环境变量读取和现有测试污染路径
- [x] 确认边界：保留 `.env.local` 默认路径、`MCBOT_ENV_FILE`、已有值优先和正式 `dev/start` 启动语义，不新增公开配置字段
- [x] 检索 Node.js 测试环境约定；Context7 因本机 API key 无效不可用，改查 Node.js 官方文档，避免依赖仅用于 reporter 的 `NODE_TEST_CONTEXT`
- [x] 先补“普通模块导入不得加载环境文件”的失败回归测试，并确认旧实现会因导入时写入 marker 失败
- [x] 将环境加载器改为无导入副作用的显式 API，并增加只由进程入口引用的 bootstrap 模块
- [x] 删除业务模块对环境加载副作用的依赖，验证正式入口仍先加载环境再初始化运行模块
- [x] 覆盖显式加载、已有变量保护、缺失文件和自动化测试不读取工作区配置的正常/边界路径
- [x] 更新 README、模块说明、路线图、审计、CLAUDE、changeset 与 TODO
- [x] 完成 31 项相关定向测试、179 项 release 校验、lint、源码/脚本/测试 typecheck、263 项完整测试、build、45 个本地文档链接、工作区 env 未加载探针、CLAUDE 体积和 diff 自审

### 后续测试隔离债务

- [x] 将仍会读取真实 AppData 持久化配置、旧 prompt profile 或共享记忆目录的集成测试统一接入进程级临时路径 setup

## 当前任务：测试运行时持久化路径隔离

- [x] 盘点直接或间接导入 `action-tools` / `debug-server` 的测试，以及 AppData、共享记忆和旧 prompt profile 的顶层路径冻结点
- [x] 确认边界：不修改生产路径解析、配置 schema、MCP/Web 接口或共享记忆格式；`npm test` 外部命令保持不变
- [x] 核对 Node 测试进程隔离和命令行选项继承；Context7 因本机 API key 无效不可用，改查 Node.js 官方文档
- [x] 先补默认测试命令必须预加载 setup、隔离路径必须位于临时根目录且可清理的失败回归，并确认旧命令/缺少 helper 时失败
- [x] 实现可单测的测试路径隔离 helper，并由 `scripts/test-setup.ts` 在每个测试进程安装和退出清理
- [x] 让默认测试命令统一预加载 setup，验证真实 AppData、共享记忆和旧 prompt profile 不再被读取
- [x] 更新测试说明、README、路线图、审计、CLAUDE、changeset 与 TODO
- [x] 完成 6 项定向门禁、180 项 release 校验、lint、源码/脚本/测试 typecheck、266 项完整测试、build、真实路径/临时目录探针、46 个本地文档链接、CLAUDE 体积和 diff 自审

## 当前任务：ConfigRepository 文件生命周期第一阶段

- [x] 盘点 `chat-configs.json` 的纯解析、运行时提交、原子写入队列和 shutdown flush 边界
- [x] 确认边界：本轮只迁移文件读取、Zod 解析、串行原子写入和 flush；四类运行时配置 Map、环境覆盖、热重载提交顺序及 MCP/Web/JSON 契约保持不变
- [x] 检索 `node:fs/promises` 文件读取语义；Context7 因本机 API key 无效不可用，改查 Node.js 官方文档；当前没有可用 Notion 连接
- [x] 先补正常读取、允许/拒绝缺文件、损坏 JSON、串行写入、写失败恢复和动态 flush 回归测试
- [x] 实现独立 `PersistedChatConfigRepository`，复用现有 Zod parser、原子 JSON writer 与 promise queue drain
- [x] 将 `action-tools` 的配置文件读取、写队列和 flush 委托给仓库，保留原日志与错误文本契约
- [x] 更新 Config README、持久化设计、路线图、审计、README、CLAUDE、changeset 与 TODO
- [x] 完成 13 项定向测试、181 项 release 校验、lint、源码/脚本/测试 typecheck、271 项完整测试、build、52 个本地文档链接、旧配置 I/O 引用归零、CLAUDE 体积和 diff 自审

## 当前任务：ChatListenerConfigStore 状态所有权迁移

- [x] 盘点四类运行时配置 Map、四表同步 commit、listener cleanup 与持久化投影耦合
- [x] 确认边界：本轮只迁移 `chatConfigs` 的类型、默认值、Map、replace/delete 和持久化投影；listener 生命周期、环境覆盖、四表 commit 顺序及 MCP/Web/JSON 契约保持不变
- [x] 检索 TypeScript 类型与类边界；Context7 因本机 API key 无效不可用，改查 TypeScript 官方 Handbook；当前没有可用 Notion 连接
- [x] 先补多 Bot 默认隔离、持久化 replace 兼容、深拷贝投影、删除检测和显式空数组回归测试
- [x] 实现独立 `ChatListenerConfigStore`，不暴露底层 Map
- [x] 将 `action-tools` 的 chat listener 配置状态、序列化和 replace/delete 委托给 store
- [x] 更新 Config README、持久化设计、路线图、审计、README、CLAUDE、changeset 与 TODO
- [x] 完成 11 项定向测试、182 项 release 校验、lint、源码/测试 typecheck、275 项完整测试、build、45 个本地文档链接、旧 chat config 引用归零、CLAUDE 体积和 diff 自审

## 当前任务：ChatAiConfigStore 状态所有权迁移

- [x] 盘点 Chat AI 持久化字段、运行时秘密、聊天历史、用户冷却、请求状态、队列和 AbortController 耦合
- [x] 确认边界：Store 迁移配置类型、默认构造、Map、replace/delete、持久化投影和批量 prompt 更新；热重载保留 API key、历史、冷却表和请求状态；队列、取消、listener 生命周期及四表 commit 顺序保持不变
- [x] 检索 TypeScript 私有状态封装；Context7 因本机 API key 无效不可用，改查 TypeScript 官方 Handbook；当前没有可用 Notion 连接
- [x] 先补默认值隔离、持久化归一化、运行时字段保留、秘密排除、深拷贝投影、prompt 更新和删除检测回归测试
- [x] 实现独立 `ChatAiConfigStore`，通过默认值工厂注入环境与当前 prompt，不直接读取环境变量
- [x] 将 `action-tools` 的 Chat AI 配置状态、序列化、replace/delete 和 prompt 批量更新委托给 Store
- [x] 更新 Config README、持久化设计、路线图、审计、README、CLAUDE、changeset 与 TODO
- [x] 完成 12 项定向测试、183 项 release 校验、lint、源码/测试 typecheck、280 项完整测试、build、45 个本地文档链接、旧 Chat AI 状态引用和 Store 环境读取归零、CLAUDE 体积和 diff 自审

## 当前任务：SelfGuardConfigStore 状态所有权迁移

- [x] 盘点 self-guard 配置、interval、受伤监听、自动进食任务、告警节流、反击状态和 reconnect 派生状态耦合
- [x] 确认边界：Store 只迁移配置类型、默认值、Map、replace/delete 和持久化投影；循环、任务、事件 handler、派生状态、四表 commit 顺序及 MCP/Web/JSON 契约保持不变
- [x] 检索 TypeScript 私有状态封装；Context7 因本机 API key 无效不可用，改查 TypeScript 官方 Handbook；当前没有可用 Notion 连接
- [x] 先补多 Bot 默认隔离、持久化 clamp、布尔缺省/显式 false、阈值依赖、独立投影和删除检测回归测试
- [x] 实现独立 `SelfGuardConfigStore`，不读取环境变量且不持有 timer、Promise 或游戏对象
- [x] 将 `action-tools` 的 self-guard 配置状态、序列化和 replace/delete 委托给 Store
- [x] 更新 Config README、持久化设计、路线图、审计、README、CLAUDE、changeset 与 TODO
- [x] 完成 13 项定向测试、184 项 release 校验、lint、源码/测试 typecheck、284 项完整测试、build、45 个本地文档链接、旧 self-guard 配置引用和 Store 运行时依赖归零、CLAUDE 体积和 diff 自审

## 当前任务：AgentConfigStore 核心配置所有权迁移

- [x] 盘点 Agent 核心配置、planner 秘密/诊断、战略目标黑板、玩家/地点记忆、任务历史、领地状态、执行循环和四表 commit 耦合
- [x] 确认边界：Store 只迁移核心配置类型、默认构造、Map、replace/delete、秘密与 planner 诊断运行态保留及核心持久化投影；goal/memory/territory 继续由 `action-tools` 组合，执行循环、AbortController、环境覆盖和外部 JSON/MCP/Web 契约保持不变
- [x] 检索 TypeScript 私有状态封装；Context7 因本机 API key 无效不可用，改查 TypeScript 官方 Handbook；当前没有可用 Notion 连接
- [x] 先补多 Bot 默认隔离、持久化 clamp/allowlist、运行时字段保留、秘密排除、深拷贝投影和删除检测回归测试
- [x] 实现独立 `AgentConfigStore`，通过工厂和 allowlist resolver 注入环境/catalog 默认值，不直接读取环境变量或持有 Agent runtime
- [x] 将 `action-tools` 的 Agent 核心配置状态、序列化和 replace/delete 委托给 Store，并保留 goal/memory/territory 的现有组合持久化
- [x] 记录既有风险：进行中的 planner 请求与热重载并发时，完成状态可能写回已被替换的旧配置对象
- [x] 更新 Config README、持久化设计、路线图、审计、README、CLAUDE、changeset 与 TODO
- [x] 完成 18 项定向测试、185 项 release 校验、lint、源码/测试 typecheck、289 项完整测试、build、39 个相关本地文档链接、旧 Agent 核心 Map 引用和 Store 运行时依赖归零、CLAUDE 体积和 diff 自审

## 当前任务：Chat AI 与 planner 请求生命周期收口

- [x] 盘点 Chat AI 队列、planner 调用、两组 AbortController Map、ConfigStore replace/delete、shutdown 和运行诊断回写耦合
- [x] 确认边界：新增按 botId 与请求代次隔离的 `AiRequestLifecycle`，负责当前 AbortController 和迟到回写门控；ConfigStore 只暴露窄诊断写入；聊天队列、fallback、planner 冷却/执行、公开状态和配置 schema 保持不变
- [x] 检索 Node.js AbortController 生命周期；Context7 因本机 API key 无效不可用，改查 Node.js 官方文档；当前没有可用 Notion 连接
- [x] 先补请求开始/更新/关闭、旧请求隔离、取消、删除失效、批量停止，以及热重载后写入当前 ConfigStore 的回归测试
- [x] 实现 `AiRequestLifecycle`，不读取环境变量、不操作配置文件、不解析模型响应
- [x] 为 Chat AI / Agent ConfigStore 增加当前诊断窄写入，并将 Chat AI/planner 请求与 cleanup 委托给 lifecycle
- [x] 将异步 Agent 执行结果改为按 botId 回写当前 Store；聊天历史裁剪改为原地更新，避免热重载共享数组被旧对象替换
- [x] 既有问题已解决：Chat AI 队列通过配置代次跳过热重载/删除后尚未开始的旧任务，删除配置不再丢弃可 drain 的 tail 所有权
- [x] 更新 runtime/config README、持久化设计、路线图、审计、README、CLAUDE、changeset 与 TODO
- [x] 完成 27 项定向测试、186 项 release 校验、lint、源码/测试 typecheck、296 项完整测试、build、34 个相关本地文档链接、旧请求 controller Map/直接诊断写入/聊天历史替换引用归零、lifecycle 运行时依赖归零、CLAUDE 体积和 diff 自审

## 当前任务：Chat AI 排队任务代次与 drain 所有权

- [x] 复核 Chat AI 入队、配置热重载/删除、手动配置、请求取消、runtime stop 与 persistence flush 顺序
- [x] 确认边界：新增纯运行时 `InvalidatableTaskQueue`，按 botId 串行执行并用代次跳过尚未开始的旧任务；不隐式中止已运行任务，不修改 MCP、配置 schema、fallback 或聊天输出
- [x] 检索 Node.js Promise/AbortController 官方语义；Context7 因本机 API key 无效不可用，当前没有可用 Notion 连接
- [x] 先补按 key 串行、失效仅跳过待执行任务、新代次恢复、close 拒绝新任务、跳过回调、异常隔离和动态 drain 回归测试
- [x] 实现 `InvalidatableTaskQueue`，不读取环境变量、不依赖 Bot/ConfigStore、不解析聊天或模型响应
- [x] 将 Chat AI 入队、热重载/删除、`chat.ai.configure`、runtime stop 与 persistence flush 委托给新队列；跳过任务会清理对应用户冷却
- [x] 更新 runtime/config README、持久化设计、路线图、审计、README、CLAUDE、changeset 与 TODO
- [x] 完成 31 项定向测试、187 项 release 校验、lint、源码/测试 typecheck、303 项完整测试、build、33 个相关本地文档链接、旧 Chat AI queue Map/helper 引用和队列运行时违规依赖归零、6 处生命周期接线、CLAUDE 体积和 diff 自审

## 当前任务：Self-guard 事件与排队任务生命周期收口

- [x] 盘点 self-guard interval、`entityHurt` handler、持续反击 loop、自动进食/反击 Promise、热重载/手动配置、删除与 shutdown 耦合
- [x] 确认边界：新增内部受伤订阅所有者并复用 `InvalidatableTaskQueue`；按 botId 动态读取当前配置，不扩展公共 `ClientEntityEvent`、MCP schema、配置文件结构或游戏反馈
- [x] 检索 Node.js EventEmitter 与 Mineflayer `entityHurt` 绑定/解绑语义；Context7 因本机 API key 无效不可用，当前没有可用 Notion 连接
- [x] 先补同 Bot 幂等绑定、配置 replace 后动态读取、禁用/非自身事件过滤、Bot emitter 替换和解绑回归测试
- [x] 实现 `SelfGuardHurtSubscriptionRegistry`，只拥有受伤事件 handler，不读取环境变量、不操作配置文件
- [x] 将 self-guard 主 tick、持续反击 tick 和 hurt handler 改为执行时读取当前 Store
- [x] 将 self-guard 排队任务、配置 replace/configure/delete、runtime stop 与 persistence flush 委托给可失效队列
- [x] 更新 runtime/config README、持久化设计、路线图、审计、README、CLAUDE、changeset 与 TODO
- [x] 完成 28 项定向测试、188 项 release 校验、lint、源码/测试 typecheck、307 项完整测试、build、42 个相关本地文档链接、旧 self-guard handler/task Map 与订阅模块违规依赖归零、6 处队列/4 处订阅/3 处当前配置读取接线、CLAUDE 体积和 diff 自审

## 当前任务：Self-guard 主循环与 watchdog 所有权迁移

- [x] 盘点 `selfGuardLoops`、`selfGuardWatchdogTimer`、热重载重启、状态查询和 shutdown 清理引用
- [x] 确认边界：新增可注入 timer scheduler 的 `SelfGuardLoopLifecycle`，只迁移主 interval 与 watchdog；反击 interval、tick 业务、MCP/JSON 字段和 Adapter 契约保持不变
- [x] 检索 Node.js `setInterval` / `clearInterval` 官方语义；Context7 因本机 API key 无效不可用，当前没有可用 Notion 连接
- [x] 先补按 Bot 启动、重复启动替换、幂等停止、watchdog 单例、全量停止和非法间隔回归测试
- [x] 实现 `SelfGuardLoopLifecycle`，不读取环境变量、不持有 BotRegistry/ConfigStore、不执行守卫业务
- [x] 将 self-guard start/stop/watchdog/status/shutdown 委托给 lifecycle，并移除旧 Map 与 timer 变量
- [x] 更新 runtime README、持久化设计、路线图、审计、README、CLAUDE、changeset 与 TODO
- [x] 完成 34 项定向测试、189 项 release 校验、lint、源码/测试 typecheck、313 项完整测试、build、42 个相关本地文档链接、旧 timer 引用和 lifecycle 违规依赖归零、9 处 lifecycle 接线、CLAUDE 体积和 diff 自审

## 当前任务：Self-guard 持续反击 interval 所有权迁移

- [x] 盘点 `retaliationLoops` 的创建、重复启动、完成/超时/目标丢失停止、配置停用和 shutdown 清理引用
- [x] 确认边界：扩展 `SelfGuardLoopLifecycle` 管理按 Bot 的持续反击 interval；session、命中衰减、攻击动作、250ms tick、60s 超时和外部契约保持不变
- [x] 检索 Node.js timer 句柄/取消语义；Context7 因本机 API key 无效不可用，当前没有可用 Notion 连接
- [x] 先补反击 interval 幂等启动、按 Bot 隔离、停止、全量释放和非法间隔回归测试
- [x] 扩展 `SelfGuardLoopLifecycle`，不新增第二套 timer scheduler 或重复 registry 抽象
- [x] 将持续反击启动、所有终止路径、self-guard stop 和 shutdown 委托给 lifecycle，并移除 `retaliationLoops`
- [x] 更新 runtime/config README、持久化设计、路线图、审计、README、CLAUDE、changeset 与 TODO
- [x] 完成 35 项定向测试、190 项 release 校验、lint、源码/测试 typecheck、314 项完整测试、build、42 个相关本地文档链接、旧反击 Map/原始 timer 调用和 lifecycle 违规依赖归零、6 处直接反击 lifecycle 接线、CLAUDE 体积和 diff 自审

## 当前任务：Self-guard 反击 session 与命中状态迁移

- [x] 盘点 `retaliationSessions`、`retaliateHitCountByAttacker`、`retaliateLastHitAtByAttacker` 的全部读写、衰减和 cleanup 引用
- [x] 确认边界：新增纯内存 `RetaliationStateStore`，只拥有 session 与按攻击者命中记录；timer、配置、BotRegistry、攻击、装备冷却、暴击计数和外部契约保持不变
- [x] 检索 TypeScript 私有类状态边界；Context7 因本机 API key 无效不可用，当前没有可用 Notion 连接
- [x] 先补 session 读写/删除、Bot/攻击者隔离、衰减边界、按 Bot 清理和非法时间参数回归测试
- [x] 实现 `RetaliationStateStore`，保留当前 session 对象引用语义并合并两份可能失配的命中 Map
- [x] 将持续反击 tick、受伤计数、周期衰减和 self-guard stop 委托给 Store，并移除三份旧 Map
- [x] 更新 runtime/config README、持久化设计、路线图、审计、README、CLAUDE、changeset 与 TODO
- [x] 完成 40 项定向测试、191 项 release 校验、lint、源码/测试 typecheck、319 项完整测试、build、42 个相关本地文档链接、旧 Map 引用和 Store 违规依赖归零、10 处 Store 接线、CLAUDE 2183 字节和 diff 自审

## 当前任务：Self-guard 短期运行状态所有权迁移

- [x] 盘点告警冷却、健康、昼夜天气、Bot 引用、邻近玩家和 reactive flags 七份 Map 的读写与两级 cleanup 语义
- [x] 确认边界：新增纯内存 `SelfGuardRuntimeStateStore`；tick 回调、配置、反击、聊天、事件发布、`combatHitCounter` 与 `combatLastEquipAt` 保持不变
- [x] 检索 TypeScript 私有/readonly 类状态边界；Context7 因本机 API key 无效不可用，当前没有可用 Notion 连接
- [x] 先补多 Bot 隔离、增量更新、嵌套副本、停循环保留告警冷却、配置删除全清理和非法数值回归测试
- [x] 实现 `SelfGuardRuntimeStateStore`，以单个按 Bot 记录替代七份可能分散清理的 Map
- [x] 将 reactive 去重、告警冷却、周期观察和 stop/remove cleanup 委托给 Store，并移除七份旧 Map
- [x] 更新 runtime/config README、持久化设计、路线图、审计、README、CLAUDE、changeset 与 TODO
- [x] 完成 45 项定向测试、192 项 release 校验、lint、源码/测试 typecheck、324 项完整测试、build、42 个相关本地文档链接、七份旧 Map 引用和 Store 违规依赖归零、12 处 Store 接线、CLAUDE 2198 字节和 diff 自审

## 当前任务：战斗执行节流状态所有权迁移

- [x] 盘点 `combatHitCounter`、`combatLastEquipAt` 的全部读写、调用方和 self-guard stop 清理语义
- [x] 确认边界：新增纯内存 `CombatExecutionStateStore`；装备成功后写入、攻击前递增、700ms 装备节流、四次三跳击、`combat.prepareBattle` 与 MCP/Web 契约保持不变
- [x] 检索 TypeScript 私有/readonly 类状态边界；Context7 因本机 API key 无效不可用，当前没有可用 Notion 连接
- [x] 先补多 Bot 隔离、装备时间与命中序号共存、清理幂等和非法时间参数回归测试，并确认实现缺失时测试按预期红灯
- [x] 实现 `CombatExecutionStateStore`，以单个按 Bot 记录替代两份分散 Map
- [x] 将武器装备节流、跳击序号和 self-guard stop cleanup 委托给 Store，并移除两份旧 Map
- [x] 更新 runtime/config README、持久化设计、路线图、审计、README、CLAUDE、changeset 与 TODO
- [x] 完成 50 项定向测试、193 项 release 校验、lint、源码/测试 typecheck、329 项完整测试、build、42 个相关本地文档链接、旧编排层 Map 引用和 Store 违规依赖归零、6 处生产接线、CLAUDE 2144 字节和 diff 自审

## 当前任务：Self-guard 昼夜与天气兼容采集迁移

- [x] 盘点主 tick 对原生 `bot.time.isDay`、`bot.isRaining`、上一轮环境状态和场景提示的读写顺序
- [x] 确认边界：新增纯 `readSelfGuardEnvironment` 与 `detectSelfGuardEnvironmentTransitions`；首次观察抑制、日转夜/无雨转下雨条件、聊天文本、状态写入、公共 Adapter/MCP/配置契约保持不变
- [x] 检索 TypeScript `unknown` narrowing 与 Mineflayer `time.isDay`/`isRaining` 官方语义；Context7 因本机 API key 无效不可用，当前没有可用 Notion 连接
- [x] 先补正常采集、缺失/动态值兼容、首次观察抑制、双转场和反向/不变转场回归测试，并确认实现缺失时测试按预期红灯
- [x] 实现纯 runtime 环境兼容模块，不持有 BotRegistry、配置、状态或聊天副作用
- [x] 将 self-guard 主 tick 的原生字段读取和转场条件委托给新模块
- [x] 更新 runtime/config README、持久化设计、路线图、审计、README、CLAUDE、changeset 与 TODO
- [x] 完成 55 项定向测试、194 项 release 校验、lint、源码/测试 typecheck、334 项完整测试、build、42 个相关本地文档链接、旧 self-guard 内联读取/条件和模块违规依赖归零、2 个函数的 4 处生产接线、CLAUDE 2207 字节和 diff 自审

## 当前任务：Self-guard 疑似攻击者选择迁移

- [x] 盘点 `handleHitReaction` 对原生 `bot.players`、实体位置、最近距离、白名单判断和后续反击链的顺序依赖
- [x] 确认边界：新增纯疑似攻击者选择器并改读现有 Adapter 玩家快照；仍先选最近玩家再判断白名单，聊天、事件、反击计数/升级、攻击动作和公共 Adapter/MCP/配置契约保持不变
- [x] 检索 Mineflayer `bot.players` / 远距离玩家缺少 entity 的官方语义；Context7 因本机 API key 无效不可用，当前没有可用 Notion 连接
- [x] 先补最近玩家、边界/同距、自身与损坏快照过滤、非法半径回归测试，并确认实现缺失时测试按预期红灯
- [x] 实现纯 `selectLikelyRetaliationAttacker`，不持有 BotRegistry、配置、白名单、状态或攻击副作用
- [x] 将 `handleHitReaction` 的原生玩家遍历和距离计算替换为 Adapter 快照选择，保留白名单判断在选择之后
- [x] 更新 runtime/config README、持久化设计、路线图、审计、README、CLAUDE、手动测试、changeset 与 TODO
- [ ] 搁置：真实伤害来源归因需要单独设计公共受伤事件证据或等价能力；现有 `entityHurt` 链继续保留最近玩家启发式，不能据此宣称识别了实际攻击者
- [x] 完成 60 项定向测试、195 项 release 校验、lint、源码/测试 typecheck、339 项完整测试、build、42 个相关本地文档链接、旧原生攻击者遍历和模块/测试违规依赖归零、4 行生产接线、CLAUDE 2265 字节和 diff 自审

## 当前任务：Self-guard 反击目标复核迁移

- [x] 盘点持续反击和短反击对原生 `bot.players`、自身/目标位置与距离的重复读取
- [x] 确认边界：新增纯目标复核函数并改读现有 Adapter 玩家/自身快照；追击、控制状态、攻击执行、节奏、命中次数、超时与公共 Adapter/MCP/配置契约保持不变
- [x] 检索 Mineflayer `bot.players` 与远距离玩家 `entity` 可为空的官方语义；Context7 因本机 API key 无效不可用，当前没有可用 Notion 连接
- [x] 先补用户名匹配、精确距离、边界和损坏快照 fail-closed 回归测试，并确认实现缺失时测试按预期红灯
- [x] 实现纯反击目标复核，不持有 BotRegistry、配置、状态、timer 或攻击副作用
- [x] 将持续反击和短反击的目标存在性/距离复核替换为 Adapter 快照，同时只在原生动作边界解析实体
- [x] 更新 runtime/config README、持久化设计、路线图、审计、README、CLAUDE、手动测试、changeset 与 TODO
- [ ] 搁置：追击、控制状态、装备、跳击和攻击仍依赖 Mineflayer 原生实体；需在不改变现有反击节奏和安全寻路契约的前提下单独迁移
- [x] 完成 44 项定向测试、196 项 release 校验、lint、源码/测试 typecheck、343 项完整测试、build、44 个相关本地文档链接、旧原生目标距离复核和模块/测试违规依赖归零、2 处生产目标复核接线、CLAUDE 2292 字节和 diff 自审

## 当前任务：Self-guard 持续反击 tick 决策迁移

- [x] 盘点持续反击 tick 的 60 秒超时、目标缺失、3 格移动边界、配置攻击距离、600ms 冷却和 session 完成顺序
- [x] 确认边界：新增纯 `decideRetaliationTick` 判别联合；原生实体竞态复核、追击/停止、攻击成功后计数、汇报、聊天和公共 Adapter/MCP/配置契约保持不变
- [x] 检索 TypeScript 判别联合与控制流收窄官方语义；Context7 因本机 API key 无效不可用，当前没有可用 Notion 连接
- [x] 先补超时优先级、目标缺失、移动/攻击距离边界、冷却边界和非法输入回归测试，并确认实现缺失时测试按预期红灯
- [x] 实现纯 `decideRetaliationTick`，不持有 BotRegistry、配置 Store、session Store、timer 或动作副作用
- [x] 将持续反击循环的内联条件委托给纯决策，同时保持成功攻击后才更新 session
- [x] 更新 runtime/config README、持久化设计、路线图、审计、README、CLAUDE、手动测试、changeset 与 TODO
- [ ] 搁置：原生实体竞态复核、追击、控制状态、装备、跳击和攻击仍依赖 Mineflayer，真实伤害来源也仍无法由 `entityHurt` 确认；后续需按独立动作与事件契约迁移
- [x] 完成 49 项定向测试、197 项 release 校验、lint、源码/测试 typecheck、348 项完整测试、build、43 个相关本地文档链接、旧内联 tick 条件和模块/测试违规依赖归零、1 处生产决策接线、CLAUDE 2308 字节、尾随空白与 diff 自审

## 当前任务：Self-guard 附近玩家转场判定迁移

- [x] 盘点主 tick 对 Adapter 玩家快照、自身用户名、距离有效性、范围边界和上一轮接近状态的内联判定
- [x] 确认边界：新增纯 `evaluateSelfGuardProximity`；随机概率、场景聊天、RuntimeStateStore 写入和公共 Adapter/MCP/配置契约保持不变
- [x] 检索 TypeScript `readonly` 数组参数官方语义；Context7 因本机 API key 无效不可用，当前没有可用 Notion 连接
- [x] 先补自身排除、无效距离、范围边界、首次进入和持续接近回归测试，并确认实现缺失时测试按预期红灯
- [x] 实现纯附近玩家转场判定，不持有 BotRegistry、配置、Store、随机数或聊天副作用
- [x] 将 self-guard 主 tick 的内联筛选/排序委托给纯判定，并保持说话概率和状态写入顺序
- [x] 更新 runtime/config README、持久化设计、路线图、审计、README、CLAUDE、手动测试、changeset 与 TODO
- [ ] 搁置：附近玩家随机说话、场景冷却和 `lastIsNearPlayer` 写入仍在旧主 tick；后续应与重连、环境、空闲发言和受伤检查一起设计完整 tick plan
- [x] 完成 24 项定向测试、198 项 release 校验、lint、源码/测试 typecheck、352 项完整测试、build、43 个相关本地文档链接、旧内联筛选/排序和模块/测试违规依赖归零、1 处生产接线、CLAUDE 2331 字节、尾随空白与 diff 自审

## 当前任务：Self-guard 主 tick 核心转场迁移

- [x] 盘点主 tick 的原生 Bot 引用变化、上一轮健康值与 0.5 血量下降容差条件
- [x] 确认边界：新增纯 `evaluateSelfGuardCoreTransitions`；环境/玩家采集顺序、提示、受伤处理、Store 写入和公共契约保持不变
- [x] 检索 TypeScript 命名对象类型与可选字段官方语义；Context7 因本机 API key 无效不可用，当前没有可用 Notion 连接
- [x] 先补首次观察、同/异 Bot 引用、血量下降容差边界、vitals 不可用和损坏历史值回归测试，并确认实现缺失时测试按预期红灯
- [x] 实现纯核心转场判定，不持有 BotRegistry、配置、Store、随机数、聊天或反击副作用
- [x] 将主 tick 的重连和血量下降内联条件委托给纯判定，保持两处副作用原有位置
- [x] 更新 runtime/config README、持久化设计、路线图、审计、README、CLAUDE、手动测试、changeset 与 TODO
- [ ] 搁置：随机场景聊天、环境/玩家采集、上一轮 Store 写入、`entityHurt` 订阅和 `handleHitReaction` 仍在旧主 tick；真实伤害来源与完整 tick plan 后续单独设计
- [x] 完成 28 项定向测试、199 项 release 校验、lint、源码/测试 typecheck、356 项完整测试、build、44 个相关本地文档链接、旧内联条件和模块/测试违规依赖归零、1 处生产接线、CLAUDE 2366 字节、尾随空白与 diff 自审

## 当前任务：Self-guard reactive 阈值信号迁移

- [x] 盘点 `maybePublishSelfGuardSignals` 的首次进入、重复抑制、critical 升降级、恢复清除、事件顺序和 reactive flags 写入语义
- [x] 确认边界：新增纯 reactive 信号决策；`publishHierarchicalEvent`、Store 读取/写入位置、事件顺序、聊天、随机数、反击和公共 Adapter/MCP/配置契约保持不变
- [x] 检索 TypeScript 判别联合与控制流收窄官方语义；Context7 因本机 API key 无效不可用，当前没有可用 Notion 连接
- [x] 运行 self-guard 状态/Store 定向基线，现有 19 项测试通过
- [x] 先补 vitals 不可用、首次双信号、重复抑制、critical 升降级和恢复清除回归测试，并确认实现缺失时测试按预期红灯
- [x] 将 reactive flags 契约归入纯状态边界，并实现不持有 BotRegistry、Store、随机数或发布副作用的决策函数
- [x] 将 `maybePublishSelfGuardSignals` 的内联条件委托给纯决策，保持 low-health、low-food、Store 写入顺序
- [x] 更新 runtime/config README、持久化设计、路线图、审计、README、CLAUDE、手动测试、changeset 与 TODO
- [ ] 搁置：Agent 事件 ID/时间戳、发布失败隔离、reactive flags Store 写入和完整 tick 编排仍在 `action-tools.ts`；后续应与其他 tick 副作用统一设计
- [x] 完成 33 项定向测试、200 项 release 校验、lint、源码/测试 typecheck、361 项完整测试、build、44 个相关本地文档链接、旧内联 reactive 条件和模块/测试违规依赖归零、1 处生产决策接线、1 处兼容类型 re-export、CLAUDE 2394 字节、尾随空白与 diff 自审

## 当前任务：Self-guard 告警冷却判定迁移

- [x] 盘点 `maybeAlertGuard` 的启用开关、首次告警、严格冷却边界、时间输入和先写 Store 后发送聊天的旧语义
- [x] 确认边界：新增纯告警冷却决策；ConfigStore、RuntimeStateStore、聊天发送、主动发言时间和公共 Adapter/MCP/Web/配置契约保持不变
- [x] 检索 TypeScript `Readonly` 与判别联合官方语义；Context7 因本机 API key 无效不可用，当前没有可用 Notion 连接
- [x] 先补禁用、首次允许、冷却内抑制、等于边界允许和无效输入 fail-closed 回归测试，并确认实现缺失时测试红灯
- [x] 实现不持有 Store、BotRegistry、时钟或聊天副作用的纯冷却决策
- [x] 将 `maybeAlertGuard` 的内联条件委托给纯决策，保持成功决策先写 `lastAlertAt`、随后尝试聊天的顺序
- [x] 更新 runtime/config README、持久化设计、路线图、审计、README、CLAUDE、手动测试、changeset 与 TODO
- [ ] 搁置：完整 tick 快照会提前附近玩家等采集并改变异常路径；等待原子 Adapter 快照或明确的分阶段 tick plan 后再迁移
- [x] 完成 38 项定向测试、201 项 release 校验、lint、源码/测试 typecheck、366 项完整测试、build、44 个相关本地文档链接、旧内联告警条件和模块违规依赖归零、1 处生产决策接线、CLAUDE 2415 字节、尾随空白与 diff 自审

## 当前任务：上传前隐私审计与 GitHub 推送

- [x] 确认 Git 顶层为 `C:\xiaoli`，根忽略规则覆盖真实 `.env*`、`mcp.json`、`memory/`、`voice/`、`pic/` 与本地计划表
- [x] 确认当前 `main` 仅有一个本地初始提交、没有 remote，GitHub CLI 的 `Moony-Irises` 凭据已失效
- [x] 扫描全部待提交文件的已知 token、私钥、Bearer、通用 secret/password 赋值、真实邮箱与既往已知凭据，不回显命中值；仅命中安全测试夹具与 `example.invalid` 示例邮箱
- [x] 扫描现有 Git 历史和暂存区，并复核 `.env.local.example` 的账号、密码、API key 仅包含安全占位符，非空真实配置仅为公开 API Base URL
- [x] 已按明确授权重建唯一旧提交，移除旧 README 登录邮箱历史，并将提交身份改为 GitHub noreply 邮箱
- [x] 仅暂存明确允许上传的根 `.gitignore`、`.github/` 与 `moony-mcbot/`，最终索引共 368 个文件，范围外文件为 0
- [x] 运行 release 校验、lint、typecheck、366 项完整测试、build 与最终索引秘密扫描，结果全部通过
- [x] 使用 Conventional Commit 重建干净根提交，并将 `main` 推送至 `https://github.com/Moony-Irises/xiaoli.git`

结果：可达历史仅保留使用 GitHub noreply 身份的新根提交；旧 README 登录邮箱未进入新快照。`origin/main` 已建立，真实本地配置和共享模块目录继续由根 `.gitignore` 隔离。

## 当前任务：GitHub 仓库首页

- [x] 盘点 Git 根目录、现有项目 README、CLAUDE 索引、CI、启动命令、架构与测试文档
- [x] 确认边界：根 README 面向首次访问者，详细能力清单继续保留在 `moony-mcbot/README.md`；不把 Modded Client Bridge、真实服务器回归或稳定发行描述为已完成
- [x] 尝试 Context7 与 Notion 知识检索；Context7 因本机 API key 无效不可用，当前没有可用 Notion 连接，改用 GitHub 与 Mineflayer 官方资料核对
- [x] 新增根 `README.md`，包含项目定位、状态、能力、限制、架构图、快速开始、目录、文档入口、安全提示与路线图
- [x] 同步 `CLAUDE.md` 精简索引与本轮 release entry
- [x] 校验 11 个 Markdown 相对链接、203 条 release entry、lint、源码/测试 typecheck、366 项完整测试和 build，结果全部通过
- [x] 完成新增行隐私、成熟度表述、4 文件范围与最终 diff 自审；网络恢复后已推送 `main`，并同步 GitHub 仓库描述与 6 个 topics

## 当前任务：interact.eat 统一 Command Invocation 迁移

- [x] 盘点 MCP、Web 与 Agent 三个 `interact.eat` 入口、`BotRuntime.eatFood()` 以及现有 CommandDispatcher 试点
- [x] 确认边界：统一命令输出保持 Web 现有 `{ botId, action, result }` 结构；MCP 文本/`isError`、Web endpoint/HTTP/action history、Agent 参数校验/文本和默认 allowlist 均保持不变
- [x] 尝试 Context7 与 Notion 知识检索；Context7 因本机 API key 无效不可用，当前没有可用 Notion 连接，改用 MCP 官方 TypeScript SDK 文档核对工具级错误语义
- [x] 运行现有 Agent、CommandDispatcher 与 stop-follow 跨入口测试基线，现有 32 项测试通过
- [x] 先补 Agent、MCP、Web 三入口兼容与统一历史回归测试，并确认实现缺失时 3 项测试均因命令历史为空而按预期红灯
- [x] 将 `interact.eat` 注册到现有 CommandDispatcher，并把三个入口的实际执行委托给统一命令
- [x] 分别验证 Agent、MCP、Web 正常路径和失败路径，35 项相关回归、源码/测试 typecheck 与局部 lint 通过，旧公共契约保持不变
- [x] 更新 Commands/Agent README、命令设计、架构路线图、项目审计、手动测试、根 README、CLAUDE 与 changeset；204 条 release entry 校验通过，CLAUDE 为 2534 字节
- [x] 完成 35 项定向测试、204 项 release 校验、lint、源码/测试 typecheck、369 项完整测试、build、34 个相关本地文档链接、三入口旧直接调用归零、默认权限未扩大、CLAUDE 2534 字节和 diff 自审

## 当前任务：inventory.holdByCategory 统一 Command Invocation 迁移

- [x] 比较 `interact.openDoor`、`player.look` 与 `inventory.holdByCategory` 的三入口契约，选择参数已对齐且默认允许的库存类别持有作为第三试点
- [x] 确认边界：canonical 输出保持 Web 现有 `{ action: "hold-category", result }`；MCP schema/文本/`isError`、Web endpoint/HTTP/action history、Agent 类别错误/文本和默认 allowlist 均保持不变
- [x] 尝试 Context7 与 Notion 知识检索；Context7 因本机 API key 无效不可用，当前没有可用 Notion 连接，改用 MCP 官方 TypeScript SDK 文档核对 schema 与工具级错误语义
- [x] 运行现有 MCP 注册、Catalog 与 Agent 框架测试基线，现有 27 项测试通过
- [x] 先补 Agent、MCP、Web 三入口正常/失败、类别 trim 与统一历史回归测试；3 项测试均仅因统一命令历史为空而按预期红灯，测试类型检查通过
- [x] 注册 `inventory.holdByCategory` canonical 命令，新增 Web helper，并把三个入口的实际执行委托给统一命令
- [x] 分别验证三入口旧返回契约、Command History source 与默认权限保持不变；36 项相邻回归、源码/测试 typecheck 与局部 lint 通过
- [x] 更新 Commands/Agent README、命令设计、路线图、审计、手动测试、根 README、CLAUDE 与 changeset；205 条 release entry 与 8 个相关文件中的 34 个本地链接校验通过
- [x] 完成 205 条 release 校验、lint、源码/测试 typecheck、372 项完整测试、build、8 个相关文件中的 34 个本地链接、入口直调/默认权限审计、尾随空白/冲突标记与 diff 自审；`CLAUDE.md` 为 2565 字节

## 当前任务：interact.openDoor 统一 Command Invocation 迁移

- [x] 盘点 MCP、Web、Agent 三入口与 `BotRuntime.openDoor()`，确认三处默认值、类型转换和范围校验并不完全相同
- [x] 确认边界：canonical 输出保持 Web 现有 `{ botId, action: "openDoor", result }`；MCP schema/文本/`isError`、Web endpoint/HTTP/action history、Agent `Number(...)` 转换/文本和默认 allowlist 均保持不变
- [x] 尝试 Context7 与 Notion 知识检索；Context7 仍因本机 API key 无效不可用，当前没有可用 Notion 连接，继续以仓库契约与 MCP 官方 TypeScript SDK 文档核对协议边缘校验和工具级错误语义
- [x] 运行现有 MCP 注册、Catalog、Adapter 与前三个 CommandDispatcher 试点测试基线，现有 45 项测试通过
- [x] 先补 Agent、MCP、Web 三入口正常/失败、默认值/类型转换与统一历史回归测试；3 项测试均仅因统一命令历史为空而按预期红灯，测试类型检查通过
- [x] 注册 `interact.openDoor` canonical 命令，迁移 Web helper、Agent 与 MCP 的实际执行调用
- [x] 验证三入口旧返回契约、Command History source、Adapter 参数和默认权限保持不变；48 项相邻回归、源码/测试 typecheck 与局部 lint 通过
- [ ] 待确认：Agent `interact.openDoor` 对非数值字符串沿用 `Number(...) -> NaN` 并继续传给 Runtime；本轮为兼容保留并补回归，后续若改为明确参数错误需先确认公共 Agent 执行语义
- [x] 更新 Commands/Agent/Runtime README、命令设计、路线图、审计、手动测试、根 README、CLAUDE 与 changeset；206 条 release entry 与 9 个相关文件中的 37 个本地链接校验通过
- [x] 完成 206 条 release 校验、lint、源码/测试 typecheck、375 项完整测试、build、9 个相关文件中的 37 个本地链接、入口直调/MCP schema/默认权限审计、尾随空白/冲突标记与 diff 自审；`CLAUDE.md` 为 2585 字节

## 当前任务：Canonical Action Command 模块所有权收敛

- [x] 比较剩余 Web/MCP/Agent 入口；`hold-slot`、`right-click`、`organizeHotbar` 均缺少至少一个入口，攻击与丢弃属于高风险，不扩展第五个试点
- [x] 确认边界：仅抽取现有四个 canonical 命令的 schema、输出校验、注册与 typed invocation；MCP/Web/Agent 输入输出、默认权限、命令 ID、历史格式和跟随状态清理顺序保持不变
- [x] 尝试 Context7 检索 TypeScript 模块边界；本机 API key 仍无效，当前没有可用 Notion 连接，改用 TypeScript 官方模块文档核对 type-only import 与 NodeNext `.js` 路径语义
- [x] 运行四个现有试点与 CommandDispatcher 定向测试基线，现有 20 项测试通过
- [x] 先补 ActionCommandSet 的注册、依赖注入、typed invocation、失败和历史回归测试，并确认实现缺失时因模块不存在按预期红灯
- [x] 新建明确的 commands 模块并将 `action-tools.ts` 收敛为组合根与入口适配层
- [x] 分别验证四个试点的 Agent、MCP、Web 契约和 Command History 不变，22 项定向测试、源码/测试 typecheck 与局部 lint 通过
- [x] 更新 Commands/Agent/Runtime README、命令设计、路线图、审计、根 README、CLAUDE、手动测试与 changeset
- [x] 完成 50 项扩展回归、207 条 release 校验、lint、源码/测试 typecheck、377 项完整测试、build、10 个相关文件中的 37 个本地链接、旧 canonical 所有权引用与 commands 层违规依赖归零、CLAUDE 2600 字节、尾随空白及 diff 自审

## 当前任务：跟随会话资源生命周期收敛

- [x] 盘点 follow interval、session 元数据、movement subscription 的全部读写点与普通停止/全局停机顺序
- [x] 确认边界：新生命周期仅拥有上述三类状态；移动相关标识、Agent task/event、停止移动、提示语和 follow tick 业务继续留在编排层
- [x] 核对 Node.js `setInterval` 返回句柄可交给 `clearInterval` 取消；Context7 明确不适用于仓库内部重构，当前环境没有可用 Notion 工具
- [x] 运行现有 follow 决策、stop-follow 跨入口与停机测试基线，现有 11 项测试通过
- [x] 先补生命周期注册、查询、普通停止、异常顺序和全局清理回归测试，并确认实现缺失时按预期红灯；新增 7 项生命周期测试
- [x] 实现 `FollowSessionLifecycle`，将 `action-tools.ts` 的三张 follow Map 替换为单一所有者
- [x] 验证 follow 状态读取、启动/停止、断线失败和全局停机契约保持不变；50 项相邻回归通过
- [x] 更新 Runtime README、架构路线图、审计、根 README、CLAUDE、手动测试、changeset 与 TODO
- [x] 完成 7 项生命周期、50 项相邻回归、208 项 release 校验、lint、源码/测试 typecheck、384 项完整测试、build、文档与依赖审计、敏感信息扫描和 diff 自审
- [ ] 搁置：普通停止时 movement unsubscribe 抛错会阻断 session 删除与任务终态；本轮为保持旧异常顺序不修复，后续若改需单独确认运行语义
- [ ] 搁置：`stopActionRuntime()` 旧行为只释放 follow interval 与 movement subscription，不清 session 元数据；本轮用分阶段停机 API 保持兼容，后续应单独补“停机后状态不可见”契约再修复

## 当前任务：移动意图相关标识所有权收敛

- [x] 盘点旧移动相关标识 Map 的全部读写点、动作类型和清理语义
- [x] 确认新 Store 只拥有每个 bot 当前 movement correlation key，不拥有 Pathfinder、Adapter、任务或事件副作用
- [x] 先补 Store 的 bot 隔离、覆盖、查询和删除测试；3 项通过
- [x] 将 follow、定点移动、决斗、聊天攻击和采矿的相关标识读写迁移到 `MovementIntentStore`
- [x] 验证旧动作取消、迟到 Promise/事件隔离和状态快照契约不变；75 项相邻回归通过
- [x] 更新 Runtime README、架构路线图、审计、手动测试、changeset、README、CLAUDE 与 TODO
- [x] 完成 3 项 Store 单测、75 项相邻回归、209 项 release 校验、lint、源码/测试 typecheck、387 项完整测试、build、244 份 Markdown/51 个本地链接、旧 Map/模块违规依赖/高置信敏感信息命中归零、CLAUDE 2650 字节和 diff 自审

## 当前任务：定点移动资源生命周期收敛

- [x] 盘点 `goToPosition` interval、movement subscription 的全部读写点，以及普通停止、self-guard 停止和进程 shutdown 的清理顺序
- [x] 确认边界：新生命周期只拥有每个 Bot 的 interval 与 unsubscribe；路径决策、movement correlation key、Adapter 动作、Agent task/event 和停止移动继续留在编排层
- [x] 尝试 Context7 与 Notion 知识检索；Context7 因本机 API key 无效不可用，当前没有可用 Notion 连接。本轮无新增第三方 API，按仓库现有 timer 与 lifecycle 契约推进
- [x] 运行定点移动、Agent 执行、movement event、self-guard lifecycle 与 shutdown 测试基线，现有 37 项测试通过
- [x] 先补资源注册、当前句柄判定、普通停止、异常顺序和两阶段 shutdown 回归测试；新增 6 项生命周期测试并确认缺少实现时按预期红灯
- [x] 实现 `PositionMovementLifecycle`，将 `action-tools.ts` 的两张定点移动资源 Map 替换为单一所有者
- [x] 验证定点移动启动/到达/失败、self-guard 停止、迟到结果隔离和全局停机契约保持不变；43 项相邻回归、源码 typecheck 与局部 lint 通过
- [x] 更新 Runtime README、架构路线图、审计、根 README、CLAUDE、手动测试、changeset 与 TODO
- [x] 完成 210 条 release 校验、lint、源码/测试 typecheck、393 项完整测试和 build
- [x] 完成旧定点移动 Map 引用、runtime 违规依赖、高置信敏感信息、冲突标记、Markdown 本地链接与 diff 自审；`CLAUDE.md` 为 2670 字节
- [ ] 待手测：真实服务器上的定点移动绕障、途中封路、主动停止、self-guard 停止与进程 shutdown 观察，详见 `docs/manual-testing-guide.md` 的 7.9、6.3 和 2.3

## 当前任务：对决会话资源生命周期收敛

- [x] 盘点 duel interval、session 元数据、entity/movement subscription 的全部读写点，以及普通停止与进程 shutdown 的清理顺序
- [x] 确认边界：新生命周期只拥有上述四类资源；目标选择、250ms tick、movement correlation key、Adapter 追击/攻击、聊天、Agent task/event 和停止移动继续留在编排层
- [x] 尝试 Context7 与 Notion 知识检索；Context7 因本机 API key 无效不可用，当前没有可用 Notion 连接。本轮无新增第三方 API，按仓库现有 timer、订阅和 lifecycle 契约推进
- [x] 运行对决决策、Agent/MCP 契约、Adapter 实体动作、movement event 与 shutdown 测试基线，现有 61 项测试通过
- [x] 先补 session 注册/更新、资源查询、普通停止、双订阅异常顺序和两阶段 shutdown 回归测试；新增 7 项生命周期测试并确认缺少实现时按预期红灯
- [x] 实现 `DuelSessionLifecycle`，将 `action-tools.ts` 的三张 duel 资源 Map 替换为单一所有者
- [x] 验证对决启动、目标死亡、自身死亡、目标丢失、追击失败、迟到事件和全局停机契约保持不变；78 项相邻回归、源码 typecheck 与局部 lint 通过
- [x] 更新 Runtime README、架构路线图、审计、根 README、CLAUDE、手动测试、changeset 与 TODO
- [x] 完成 release 校验、lint、源码/测试 typecheck、完整测试、build、文档/依赖/敏感信息检查和 diff 自审；211 个发布条目有效，400 项测试通过
- [ ] 待手测：真实服务器上持续对决的目标死亡、自身死亡、目标短暂/持续丢失、追击失败、主动停止、断线与进程 shutdown，详见 `docs/manual-testing-guide.md` 的 6.3 和 7.8
- [ ] 搁置：普通停止时若 entity 或 movement 订阅清理抛错，后续资源清理与任务结算会被中断；这是迁移前既有行为，本轮为兼容而保留，后续需单独定义容错契约
- [ ] 搁置：进程 shutdown 会清除 duel interval 与订阅，但保留 session 元数据；这是迁移前既有行为，若后续支持同进程重启 Action Runtime，需要另行决定是否清空 session

## 当前任务：持续行走计时器生命周期收敛

- [x] 盘点 `walkTimers` 的 Agent/MCP 创建、覆盖、到期删除、手动停止、跟随抢占与进程 shutdown 路径
- [x] 确认边界：新生命周期只拥有每个 Bot 的持续行走 timeout；停止移动、清理 movement intent、Adapter 调用和各入口返回文本继续由 `action-tools.ts` 编排
- [x] 完成知识检索判断：本轮无新增第三方依赖，Context7 明确不用于普通业务重构，当前也没有可用 Notion 连接；按仓库已有 timer/lifecycle 契约推进
- [x] 运行 Agent/MCP 行走与 shutdown 相关测试基线，现有 53 项测试通过
- [x] 先补 timer 登记、到期、普通停止、替换兼容语义和全局停止回归测试，并确认缺少实现时按预期红灯；新增 7 项生命周期测试
- [x] 实现 `WalkTimerLifecycle`，将 `action-tools.ts` 的 `walkTimers` Map 替换为单一所有者
- [x] 验证 Agent/MCP 行走、停止、跟随抢占和进程 shutdown 契约保持不变；63 项相邻回归、源码/测试 typecheck 与局部 lint 通过
- [x] 更新 Runtime README、架构路线图、审计、根 README、CLAUDE、手动测试、changeset 与 TODO
- [x] 完成 release 校验、lint、源码/测试 typecheck、完整测试、build、文档/依赖/敏感信息检查和 diff 自审；212 个发布条目有效，410 项测试通过
- [ ] 待手测：在安全封闭区域验证 MCP `movement.walk` 自然到期、`movement.stop` 提前取消和运行中 `Ctrl+C`，详见 `docs/manual-testing-guide.md` 的积压清单与 6.3
- [ ] 搁置：`WalkTimerLifecycle.schedule` 为兼容旧行为不会隐式停止同 Bot 的旧 timer；调用方必须先调用 `stop`，否则旧 timer 到期会删除当前登记。现有 Agent/MCP 入口均遵守此前置条件，后续若调整替换语义需单独评估

## 当前任务：Agent executor 资源生命周期收敛

- [x] 盘点 executor interval、按 Bot 串行 Promise tail、配置删除、状态投影、重载与 shutdown/flush 的全部读写点
- [x] 确认边界：新生命周期只拥有 interval 与运行 tail；Agent tick、配置判断、planner/工具执行、状态文本和公共 MCP/Web/Agent 契约保持不变
- [x] 完成知识检索判断：Context7 的工具契约明确排除仓库内部重构，当前环境没有可用 Notion 工具；本轮无新增第三方依赖，按仓库现有 lifecycle 与 Promise 队列契约推进
- [x] 运行 Agent 配置、状态、重载、通用队列与 shutdown 定向测试基线，现有 20 项测试通过；首次沙箱内运行因 Node 子进程 `spawn EPERM` 失败，获批后在沙箱外复跑通过
- [x] 先补 loop 登记/替换、按 Bot 串行/并行、异常隔离、run 遗忘和 shutdown/flush 兼容测试，并确认实现缺失时因模块不存在按预期红灯；新增 8 项生命周期测试和 1 项 MCP 状态接线测试
- [x] 实现 `AgentExecutorLifecycle`，将 `action-tools.ts` 的两张 executor Map 替换为单一所有者
- [x] 验证 executor 启停、状态投影、配置删除、热重载、任务串行和 shutdown/flush 契约保持不变；29 项相邻回归、源码/测试 typecheck 与局部 lint 通过
- [x] 更新 Runtime README、架构路线图、审计、根 README、CLAUDE、手动测试、changeset 与 TODO
- [ ] 待手测：真实服务中切换 Agent `auto/manual`、重载/删除配置和 `Ctrl+C` 时观察 `executorAttached`、新 tick 停止、已开始 run 的 flush 顺序；不要求进入游戏，详见 `docs/manual-testing-guide.md` 的 2.3 和 6.3
- [ ] 搁置：planner 请求取消、可取消 executor run 和动态 drain 尚未引入；本轮刻意保持旧的不可取消与 flush 快照语义，后续需单独定义公共状态和退出契约
- [x] 完成 213 条 release 校验、lint、源码/测试 typecheck、419 项完整测试、build、敏感信息/旧引用/diff 自审；`CLAUDE.md` 为 2710 字节

## 当前任务：Agent 黑板协调状态收口

- [x] 盘点任务超时 timer 当前 ID 与层级 tick 冷却的读写、Bot 删除和 executor 调用路径
- [x] 确认边界：由已有 `HierarchicalAgentRuntime` 负责这两类黑板协调状态；不改变 timer 过期事件、tick 最小间隔、planner 请求、公共入口或状态文本
- [x] 完成知识检索判断：Context7 明确排除仓库内部重构，当前环境没有可用 Notion 工具；本轮无新增第三方 API，按已有 Agent runtime 契约推进
- [x] 先补任务 timer 替换/清除/过期和 tick 首次/冷却边界回归测试，并确认实现缺失时按预期红灯
- [x] 将 `action-tools.ts` 的 `hierarchicalTaskTimerIds`、`hierarchicalLastTickAt` 迁入 Agent runtime，并保持旧调用顺序
- [x] 更新 Agent/Runtime README、架构路线图、审计、手动测试、CLAUDE、changeset 与本 TODO
- [x] 运行定向测试、release 校验、lint、源码/测试 typecheck、完整测试、build 和 diff 自审；214 条 release 校验、421 项完整测试、lint、typecheck、build 均通过
- [ ] 搁置：Agent 任务历史/记忆、planner 请求与执行、完整 tick 副作用编排仍在 `action-tools.ts`；planner 冷却判定已在后续小步迁入 runtime，本轮不扩展到其余公共行为

## 当前任务：Agent planner 冷却判定收口

- [x] 盘点 `lastPlanAt`、`planCooldownMs` 与 Agent runtime planner 时间戳的读写和热重载边界
- [x] 确认边界：只迁移冷却判定与时间戳所有权；保留配置诊断镜像、并发请求语义、请求取消和 planner 执行队列
- [x] 先补 runtime 的首次、恰好到期、时钟回退和配置时间戳同步测试，并确认实现缺失时按预期红灯
- [x] 让 `HierarchicalAgentRuntime` 负责 planner 冷却判定，`action-tools.ts` 只负责配置读取、请求和诊断写回
- [x] 更新 Runtime/Agent 文档、架构路线图、审计、手动测试、CLAUDE、changeset 与本 TODO
- [x] 运行定向测试、release 校验、lint、源码/测试 typecheck、完整测试、build 和 diff 自审
- [ ] 搁置：planner 请求取消、可取消 executor run、动态 drain、任务历史/记忆和完整 tick 副作用仍不在本轮范围

## 当前任务：启动优先的测试与文档导航收敛

- [x] 盘点根 README、测试指南、Agent 验收清单、早期技术栈文档和 `docs/` 内部引用
- [x] 确认边界：保留运行契约和活跃设计文档；本轮只整理信息架构，不修改 MCP、Web、Agent、配置或游戏行为
- [x] 确认本轮不涉及第三方 API 或依赖选型，外部知识检索不能提高仓库内文档归并的准确性，以当前代码、脚本和文档引用为事实源
- [x] 在手动测试指南最前面增加从环境检查、启动、Web 健康检查到核心冒烟的唯一推荐路径
- [x] 增加 `docs/README.md` 文档索引，区分使用入口、当前架构、技术契约、未来规划和历史记录
- [x] 将重复的 Agent 验收场景、核心链清单和早期登录技术栈文档收敛为兼容跳转页，保留旧链接但移除重复正文
- [x] 修复根 README 的测试入口、文档索引和机器绝对链接，并折叠过长能力清单
- [x] 更新 CLAUDE、手测积压说明和 changeset
- [x] 运行 Markdown 本地链接检查（27 个文件）、release 校验（216 条）、lint、typecheck、完整测试（422 项）、build 和 diff 自审

## 当前任务：Agent 任务历史所有权收口

- [x] 盘点 `agentTaskHistory` 的按 Bot 读写、持久化投影、热重载替换、清理和调试/MCP 消费路径
- [x] 确认边界：只迁移最近任务历史的内存所有权与复制/上限语义；任务生命周期、文件写队列、玩家/地点记忆和公共返回契约保持不变
- [x] 确认本轮不新增依赖或外部 API；按现有 Store/lifecycle 模式实现纯 TypeScript 运行时模块
- [x] 先补 Store 的多 Bot 隔离、深拷贝、替换、上限、清空、删除和非法上限回归测试
- [x] 实现 `AgentTaskHistoryStore`，不读取环境变量、不持有 Bot 或 ConfigStore、不操作文件
- [x] 将 `action-tools.ts` 的任务历史读写、持久化投影和清理路径委托给 Store
- [x] 更新 Runtime/Config README、架构路线图、审计、手动测试、CLAUDE、changeset 与本 TODO
- [x] 完成定向测试（8/8）、217 条 release 校验、lint、源码/测试 typecheck、完整测试（427/427）、build、文档链接检查和 diff 自审

## 当前任务：Agent 玩家/地点记忆状态所有权收口

- [x] 盘点按 Bot 玩家/地点 Map、共享基线 Map、配置加载、共享文件合并、跨 Bot 汇总、工具删除/清空和调试读取路径
- [x] 确认边界：新 Store 只拥有四组内存状态及复制/合并语义；输入规范化、时间戳生成、文件 I/O、持久化队列、territory 联动和公共 MCP/Web/JSON 契约保持不变
- [x] 确认共享兼容：`players.json` / `places.json` 的 `version: 1` schema、共享记录严格较新才导入、跨 Bot 同时间戳后遍历覆盖语义保持不变；Voice 继续只读共享文件
- [x] 确认本轮不新增依赖或外部 API；Notion/Context7 当前不可用，内部状态迁移不需要无关网络检索
- [x] 先补多 Bot 隔离、输入/输出深拷贝、共享种子、严格时间戳合并、跨 Bot 最新快照、替换、删除和清空回归测试
- [x] 实现 `AgentGameMemoryStateStore`，不读取环境变量、不操作文件、不持有 Bot、ConfigStore、持久化队列或 territory
- [x] 将 `action-tools.ts` 的玩家/地点及共享基线全部读写委托给 Store，并删除四张旧裸 Map 与重复 clone/merge helper
- [x] 在配置热重载集成测试中确认玩家/地点恢复和配置删除清理，保持 task history 与 territory 断言
- [x] 更新 Memory/Config README、共享记忆计划、架构路线图、审计、手动测试、根 README、CLAUDE、changeset 与本 TODO
- [x] 完成定向测试（19/19）、218 条 release 校验、lint、源码/测试 typecheck、完整测试（432/432）、build、文档链接、敏感信息和 diff 自审

## 当前任务：领地配置状态所有权收口

- [x] 盘点 `territoryConfigs` 的默认构造、持久化投影、热重载替换、工具配置、地点删除/清空联动、状态查询和 Bot 配置删除路径
- [x] 确认边界：本轮只迁移持久化领地配置的内存所有权与复制/替换/删除语义；参数归一化、警告/升级行为、持久化队列、公共 MCP/Web/JSON 契约和 `territoryPresence` 保持不变
- [x] 确认不新增依赖或外部 API；Context7 明确不适用于仓库内部重构，当前没有可用 Notion 连接，以现有 ConfigStore 模式和本地测试为事实源
- [x] 先补默认值、多 Bot 隔离、输入/输出副本、替换、已有状态查询和删除回归测试，并确认实现缺失时按预期红灯
- [x] 实现 `TerritoryConfigStore`，不读取环境变量、不操作文件、不持有 Bot、记忆、presence、持久化队列或领地行为
- [x] 将 `action-tools.ts` 的领地配置读写委托给 Store，并删除旧 `territoryConfigs` 裸 Map 与内联默认构造
- [x] 在配置热重载集成测试中确认领地配置恢复、替换和配置删除清理，保持玩家/地点/任务历史断言
- [x] 更新 Config/Runtime README、架构路线图、审计、手动测试、根 README、CLAUDE、changeset 与本 TODO
- [x] 完成定向测试（12/12）、219 条 release 校验、lint、源码/测试 typecheck、完整测试（436/436）、build、文档链接、敏感信息和 diff 自审
- [x] 原搁置项已完成：`territoryPresence` 时间状态已迁入独立 runtime Store，后续任务又将警告冷却与升级条件迁入纯判定；状态写回和副作用仍留在旧编排层
- [x] 既有清理问题已修复：配置替换/删除通过 `TerritoryPresenceStore.clearBot()` 清理按 Bot 分层的全部复合 key，并由 Store 回归测试覆盖

## 当前任务：领地 presence 短期状态所有权收口

- [x] 盘点 `territoryPresence` 的复合 key、进入/警告/升级时间、prune、配置替换和 Bot 删除路径
- [x] 确认边界：只迁移短期 presence 时间状态与按 Bot 清理；纯匹配决策、配置归一化、警告/战斗副作用、公共 MCP/Web/JSON 契约保持不变
- [x] 先补多 Bot 隔离、输入/输出副本、复合 key 读写、按 active key prune 和按 Bot clear 回归测试，并确认缺实现时红灯
- [x] 实现 `TerritoryPresenceStore`，不读取配置/环境变量、不操作文件、不持有 BotRegistry、不发送聊天或启动战斗
- [x] 将 `action-tools.ts` 的 presence 读写、prune、配置替换和 Bot 删除委托给 Store，修复按 Bot 清理复合 key 的既有问题
- [x] 同步 Runtime README、架构/持久化文档、手动测试、根 README、CLAUDE、changeset 与本 TODO
- [x] 完成定向测试（12/12）、220 条 release 校验、lint、源码/测试 typecheck、完整测试（440/440）、build、文档链接、敏感信息和 diff 自审

## 当前任务：领地警告冷却与升级判定收口

- [x] 盘点 `maybeHandleTerritoryWarning` 的首次警告、冷却边界、升级延迟、主人在场和已升级状态转移
- [x] 确认边界：保持“冷却到期先警告、下一 tick 才可能升级”的既有顺序；不迁移聊天、Agent 事件、决斗、配置归一化或公共契约
- [x] 先补纯判定的正常、边界、owner policy、重复升级和无效输入测试，并确认缺实现时红灯
- [x] 实现独立 territory warning decision 模块，输出动作和下一状态，不持有 Store、BotRegistry、配置或副作用
- [x] 将 `action-tools.ts` 的警告/等待/升级分支委托纯判定，保留原事件文案、发送顺序和 `startDuel` 调用
- [x] 同步 Runtime README、架构路线图、审计、手动测试、根 README、CLAUDE、changeset 与本 TODO
- [x] 完成定向测试（21/21）、221 条 release 校验、lint、源码/测试 typecheck、完整测试（449/449）、build、文档链接、敏感信息和 diff 自审

## 当前任务：TerritoryRuntime 副作用编排收口

- [x] 盘点领地 tick 调用位置、配置/快照采集、presence prune、状态写回、聊天、事件和决斗顺序
- [x] 确认接口：Runtime 接收规范化输入和同步 hooks，内部拥有 `TerritoryPresenceStore`；调用层继续拥有 BotRegistry、配置/记忆读取和具体副作用
- [x] 确认兼容边界：不改变 Agent tick 优先级、handled 布尔、事件文案、决斗目标、MCP/Web/JSON、持久化或真实游戏行为
- [x] 先补首次警告、冷却优先、等待/升级、离开重入、多 Bot/clear 和 hook 异常状态顺序测试，并确认缺实现时红灯
- [x] 实现 `TerritoryRuntime`，组合现有 presence/decision/Store，不读取环境变量或文件，不持有 BotRegistry
- [x] 将 `action-tools.ts` 改为采集上下文并提供副作用 hooks，配置替换/删除改用 Runtime 清理
- [x] 同步 Runtime README、架构路线图、审计、持久化/手测文档、根 README、CLAUDE、changeset 与本 TODO
- [x] 完成定向测试（27/27）、222 条 release 校验、lint、源码/测试 typecheck、完整测试（455/455）、build、42 个本地文档链接、高置信敏感信息、冲突标记、旧所有权引用和 diff 自审

## 当前任务：Agent 任务进度节流状态收口

- [x] 盘点 `agentTaskProgressAt` 的读取、写入、任务结算和 Agent 配置删除路径，以及 `task_progress` 事件发布顺序
- [x] 确认接口：`HierarchicalAgentRuntime` 负责进度判定、成功发布后的时间记录和显式清理；Supervisor 提供不创建新 Runtime 的按 Bot 清理
- [x] 确认兼容边界：保持事件成功写入后才记录节流状态、同任务/同详情 1200ms 精确边界、任务或详情变化立即允许、时钟回退抑制，以及原事件 payload/顺序
- [x] 完成知识检索判断：Context7 明确排除仓库内部重构，当前没有 Notion 连接；本轮不新增依赖或外部 API，以现有 Agent runtime 与 455 项测试基线为事实源
- [x] 先补首次、只读判定、冷却边界、详情/任务变化、时钟回退和清理测试，并确认新增接口缺失时红灯
- [x] 实现 Runtime/Supervisor 任务进度状态所有权，并删除 `action-tools.ts` 的旧裸 Map
- [x] 同步 Agent/Runtime README、架构路线图、审计、手动测试、根 README、CLAUDE、changeset 与本 TODO
- [x] 完成定向测试（20/20）、223 条 release 校验、lint、源码/测试 typecheck、完整测试（457/457）、build、文档链接、敏感信息和 diff 自审

## 当前任务：Agent 战略生命周期去重状态收口

- [x] 盘点普通生命周期提示与完成/放弃汇报的两条去重路径、成功记账时机和 Agent 配置删除清理
- [x] 确认接口：Runtime 分别拥有“提示已占用”和“汇报已发送”两种状态，Supervisor 提供不创建新 Runtime 的按 Bot 清理
- [x] 确认兼容边界：普通提示继续读取即占用，完成/放弃汇报继续只在聊天成功后记账，两类状态互不覆盖，生命周期历史与副作用留在编排层
- [x] 完成知识检索判断：Context7 不适用于仓库内部状态迁移，当前没有可用 Notion 连接；本轮不新增依赖或公共 API，以现有 Runtime、编排时序和离线测试为事实源
- [x] 先补首次、重复、事件替换、两类状态隔离、只读判定、成功记账和清理回归测试，并确认接口缺失时红灯
- [x] 将 `action-tools.ts` 的两张战略生命周期 Map 迁移到 Runtime/Supervisor，保持事件与聊天行为不变
- [x] 同步 Agent/Runtime README、架构路线图、审计、手动测试、根 README、CLAUDE、changeset 与本 TODO
- [x] 完成定向测试（10/10）、224 条 release 校验、lint、源码/测试 typecheck、完整测试（459/459）、build、44 个本地文档链接、高置信敏感信息、冲突标记、旧 Map 引用和 diff 自审

## 当前任务：Agent 库存变化摘要基线收口

- [x] 盘点 `agentInventorySnapshots` 的首次采样、重复抑制、变化事件和 Agent 配置删除清理路径
- [x] 确认接口：`HierarchicalAgentRuntime` 更新库存摘要并返回是否相对已有基线发生变化，Supervisor 提供不创建新 Runtime 的按 Bot 清理
- [x] 确认兼容边界：首次观察只建立基线，摘要相同不报告，变化时先更新基线再由编排层发布事件，普通 self-guard stop 不清理，Agent 配置删除才清理
- [x] 完成知识检索判断：本轮是仓库内部状态所有权迁移，不新增依赖或外部 API；Context7 不适用且当前没有可用 Notion 连接
- [x] 先补首次、重复、变化、回变、清理和缺失 Runtime 回归测试，并确认接口缺失时红灯
- [x] 将 `action-tools.ts` 的 `agentInventorySnapshots` 裸 Map 迁移到 Runtime/Supervisor，保持摘要与事件行为不变
- [x] 同步 Agent/Runtime README、架构路线图、审计、手动测试、根 README、CLAUDE、changeset 与本 TODO
- [x] 完成定向测试（12/12）、相邻回归（44/44）、225 条 release 校验、lint、源码/测试 typecheck、完整测试（461/461）、build、35 个本地文档链接、高置信敏感信息、冲突标记、旧 Map 引用和 diff 自审

## 当前任务：Agent 空闲社交尝试冷却收口

- [x] 盘点 `agentIdleSocialAt` 的目标选择后判定、冷却边界、尝试前记账和 Agent 配置删除清理路径
- [x] 确认接口：`HierarchicalAgentRuntime` 负责判定并占用下一次空闲社交尝试，Supervisor 提供不创建新 Runtime 的按 Bot 清理
- [x] 确认兼容边界：保留时间戳初值为 `0`、冷却恰好到期可触发、时钟回退抑制、失败尝试仍占用冷却，以及普通 executor 停止/策略切换不清理的语义
- [x] 完成知识检索判断：本轮是仓库内部状态所有权迁移，不新增依赖或外部 API；Context7 明确不适用于内部重构，当前没有可用 Notion 连接
- [x] 先补首次/初值、重复、精确边界、时钟回退、失败前记账和缺失 Runtime 清理回归测试，并确认接口缺失时红灯
- [x] 将 `action-tools.ts` 的 `agentIdleSocialAt` 裸 Map 迁移到 Runtime/Supervisor，保持目标选择、任务与聊天行为不变
- [x] 同步 Agent/Runtime README、架构路线图、审计、手动测试、根 README、CLAUDE、changeset 与本 TODO
- [x] 完成定向测试（14/14）、相邻回归（24/24）、226 条 release 校验、lint、源码/测试 typecheck、完整测试（463/463）、build、44 个本地文档链接、高置信敏感信息、冲突标记、旧 Map 引用和 diff 自审

## 当前任务：社交与人格短期运行状态收口

- [x] 盘点最近互动、最近主动发言、短期回复归属、心情和分场景冷却五组裸 Map 的 chat/self-guard 读写路径
- [x] 确认接口：新增 `SocialRuntimeStateStore` 按 Bot 管理五组短期状态，场景台词使用原子 `claimSceneLine()` 保留判定与占用顺序
- [x] 确认兼容边界：保留场景时间戳初值 `0`、精确冷却边界、时钟回退抑制、发送前占用、主动发言成功路径记账、30 秒回复上下文严格过期判断和空心情回退语义
- [x] 确认生命周期边界：本轮不把整组状态绑定到 chat/AI/Agent/self-guard 任一配置删除或普通停止；Store 提供按 Bot 清理能力，但不新增生产清理调用
- [x] 完成知识检索判断：本轮不新增依赖或外部 API；Context7 明确排除内部重构，当前没有可用 Notion 连接，以现有调用顺序和测试为事实源
- [x] 先补多 Bot 隔离、互动初始化、主动发言、回复上下文副本、心情、场景边界/回退和按 Bot 清理测试，并确认缺实现时红灯
- [x] 实现 Store 并替换 `action-tools.ts` 的五张裸 Map，保持聊天、self-guard、AI 动态状态和共享记忆行为不变
- [x] 同步 Runtime README、架构路线图、审计、持久化/手动测试、根 README、CLAUDE、changeset 与本 TODO
- [x] 完成定向测试（46/46）、release 校验（227 条）、lint、源码/测试 typecheck、完整测试（467/467）、build、文档链接（265 个 Markdown 文件）、敏感信息、冲突标记、旧 Map 所有权和 diff 自审
- [ ] 搁置：`BotRegistry.delete()` 尚无生产级统一资源清理钩子；在该生命周期落地前，不调用 `SocialRuntimeStateStore.clearBot()` 改变现有进程内保留语义

## 当前任务：聊天监听资源生命周期收口

- [x] 盘点聊天订阅句柄、Bot 引用、监听状态查询、配置删除、重连替换、watchdog 和 shutdown 清理路径
- [x] 确认接口：新增 `ChatListenerLifecycle`，按 Bot 拥有订阅资源并拥有单例 watchdog interval；调用层继续创建消息处理器和读取配置
- [x] 确认兼容边界：保留同 Runtime 且已连接时复用、替换/停止先 unsubscribe 后删除、解绑抛错时保留记录、订阅创建失败时不登记，以及 shutdown 逐 Bot 隔离错误的语义
- [x] 完成知识检索判断：本轮不新增依赖或公共 API，属于仓库内部资源生命周期迁移；Context7 不适用，当前没有可用 Notion 连接
- [x] 先补订阅隔离、引用匹配、停止顺序、解绑失败、watchdog 单例/停止、shutdown 错误隔离和非法间隔测试，并确认缺实现时红灯
- [x] 实现 Lifecycle 并替换 `action-tools.ts` 的 `chatHandlers` Map 与 `listenerWatchdogTimer`，并补 MCP 启用/重复启用/停用接线回归
- [x] 同步 Runtime/Config README、架构路线图、审计、持久化/手动测试、根 README、CLAUDE、changeset 与本 TODO
- [x] 完成定向测试（22/22）、release 校验（228 条）、lint、源码/测试 typecheck、完整测试（475/475）、build、文档链接（266 个 Markdown 文件）、敏感信息、冲突标记、旧状态所有权和 diff 自审

## 当前任务：采矿串行任务队列所有权收口

- [x] 盘点四条采矿排队入口、同 Bot 串行、错误隔离、结果回传和 shutdown flush 快照语义
- [x] 确认接口：新增窄边界 `MiningTaskQueue`，只拥有按 Bot 的 Promise tail，并向调用层返回原任务结果
- [x] 确认兼容边界：保留失败后继续、跨 Bot 并发、已完成 tail 留存和单次快照 flush；不引入取消、代次失效、close 或动态 drain
- [x] 完成知识检索判断：本轮不新增依赖或公共 API，属于仓库内部任务所有权迁移；Context7 不适用，当前没有可用 Notion 连接
- [x] 先补串行、跨 Bot 并发、结果/错误、失败恢复、tail 留存和 flush 快照回归，并确认缺实现时红灯
- [x] 实现 Queue 并替换 `action-tools.ts` 的 `miningTasks` Map，保持四条旧采矿执行链不变
- [x] 同步 Runtime README、架构路线图、审计、持久化/手动测试、根 README、CLAUDE、changeset 与本 TODO
- [x] 完成定向测试（63/63）、release 校验（229 条）、lint、源码/测试 typecheck、完整测试（480/480）、build、文档链接（267 个 Markdown 文件）、敏感信息、冲突标记、顶层裸 Map 所有权和 diff 自审
