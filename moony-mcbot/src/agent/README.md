# Agent 模块

该模块实现分层 Agent 的黑板、事件、反应规则、Skill Catalog 和运行时调度，不直接持有 Mineflayer 客户端。

黑板内部保留 `recentEvents` 作为反应规则使用的规范化输入流，同时按记录顺序维护最多 20 条可观察事件。`HierarchicalAgentRuntime.snapshot()`、`agent.framework.status`、`agent.events.tail` 和 `agent.trace.summary` 使用后者；它会合并执行事件与有意义的框架事件，排除 `tick` 和 `perception_updated` 噪声，并按事件 ID 去重。规划器和生命周期判断仍读取原始黑板快照，避免调试视图改变行为。

## 主要入口

- `types.ts`：分层 Agent 的稳定数据契约。
- `blackboard.ts`：目标、任务、动作队列和执行事件状态。
- `reactive-rules.ts`：将高优先级事件转换为战略动作。
- `skill-catalog.ts`：评估战略动作并编译为工具调用。
- `openai-agent-planner.ts`：通过内部 `AgentPlanRequester` 边界构造规划请求、筛选上下文并解析模型回复，默认使用现有 OpenAI-compatible 传输。
- `plan-to-directive.ts`：将已解析的模型计划转换为高层 `StrategicDirective`，并保留未映射旧工具步骤的兼容回退。
- `planner-request-runner.ts`：管理单次 planner 请求的超时输入、取消信号和成功/失败诊断终态，并向整轮协调器提供有效性作用域。
- `planning-strategy.ts`：注入模型请求器并返回保留原始计划的完整规划决策。
- `planning-turn-coordinator.ts`：统一冷却、事件、失效复核、目标/指令应用、兼容步骤和入口返回。
- `runtime-action-executor.ts`：单个分层动作的 Skill 权限复核、任务冲突判断、绑定、执行、结果事件与执行后清理。
- `tool-executors.ts`：可离线测试的 Agent 工具执行语义；当前包含进食、转头和限时步行执行器。
- `runtime.ts`：组织事件、动作选择、Skill 绑定和执行状态。

Agent 周期 tick 的 interval 与按 Bot 串行运行 tail 不由本模块持有；资源边界见 [`src/runtime/agent-executor-lifecycle.ts`](../runtime/agent-executor-lifecycle.ts)。`HierarchicalAgentRuntime` 现在拥有每个 Bot 的任务 timeout timer、executor tick 冷却门、planner 冷却时间戳判定、task progress 节流状态、战略生命周期去重标记、库存变化事件基线和空闲社交尝试冷却。规划轮次和单个分层动作执行各有独立协调边界，`action-tools.ts` 保留 tick 顺序、状态采集、领域工具和旧工具步骤的兼容执行分支。

任务 timeout 会在同一 Bot 上替换旧 timer，并通过既有 `pollExpiredTimers()` 生成 `task_timeout` 事件；tick 冷却保持旧的严格最小间隔语义。planner 使用 `syncPlannerTimestamp()`、`canStartPlanner()`、`plannerCooldownRemaining()` 和 `markPlannerCompleted()` 保留首次请求、恰好到期与时钟回退边界。task progress 使用只读的 `canPublishTaskProgress()`、成功发布后的 `markTaskProgressPublished()` 和显式 `clearTaskProgress()` 保留首次/详情变化、1200ms 边界、时钟回退和任务清理语义。战略生命周期使用 `claimStrategicLifecycleInstruction()` 记录已占用的普通提示事件，使用 `canPublishStrategicLifecycleReport()` / `markStrategicLifecycleReportPublished()` 保留完成/放弃汇报的成功后记账语义，并由 `clearStrategicLifecycle()` 在配置删除时清理；两类标记彼此独立，生命周期历史仍在黑板事件流。`observeInventorySummary()` 会先更新本轮摘要，再仅在已有基线且摘要变化时返回 `true`；`clearInventorySummary()` 只在 Agent 配置删除路径调用，普通 self-guard stop 继续保留基线。`claimIdleSocialAttempt()` 在冷却允许时立即记录本次尝试，因此后续目标实体丢失或聊天未发送也不会回滚；恰好到期可再次尝试，普通 executor 停止和空闲策略切换不清理，`clearIdleSocialAttempt()` 只在 Agent 配置删除时调用。配置 `lastPlanAt` 仍是诊断镜像；并发请求、请求取消和执行队列没有在本轮迁移。这些方法不读取配置、不调用 Adapter，也不改变公共 Agent/MCP/Web 契约。

## 规划请求边界

`OpenAiAgentPlanner.plan()` 接收每次请求的配置、指令、本地快照、超时和 `AbortSignal`，返回原有 `AgentPlan`。模块内部应用上下文白名单，再组装既有系统提示、10 个示例和记忆摘要；不持有 Bot、配置 Store、冷却或黑板状态。构造器可注入传输函数，离线测试无需账号或真实 API key。

生产组合使用 `AgentPlanRequester`。`DefaultAgentPlanningStrategy` 组合请求和纯翻译，`AgentPlanningTurnCoordinator` 负责冷却、事件、权限、目标更新、失效复核和执行入口返回；MCP、Web、自动战略 pass 共用它。`types.ts` 中接收黑板、返回 `StrategicDirective` 的旧 `StrategicPlanner` 仍保留兼容入口，尚未替换成完整决策接口。

设计和当前边界见 [Strategic Layer 生产注入设计](../../docs/strategic-planner-injection-design.md)。旧 runner 仍保留“上游忽略取消时返回迟到计划”的兼容行为；生产协调器在目标、队列、聊天和 executor 前复核作用域，因此迟到计划不会提交。定向回归覆盖真实信号取消、失效后的迟到完成、同 Bot 请求交错、多 Bot 隔离、配置重载、shutdown 和异步聊天。

响应保持旧规则：读取第一个 choice，支持文本片段、choice text 回退和 JSON 代码围栏，拒绝空文本、坏 JSON 和未知 intent。嵌套动作的完整 schema 校验没有随本次抽取新增。

## 工具权限

`executeAgentRuntimeAction(runtime, hooks)` 复用黑板的 Skill 预览/绑定和动作排序，通过四个内部 hooks 获取当前权限、判断任务冲突、执行工具和写诊断。权限拒绝消费该动作、发布 normal 优先级 `task_failed` 并返回 `false`；任务冲突不消费动作。成功或工具异常处理后返回 `true`，分别发布 `task_finished` 或 high 优先级 `task_failed`。执行期间 active action/skill 可观察，已绑定工具执行的 `finally` 负责释放状态；工具结果和事件仍只表示本地执行链证据。

权限拒绝的事件发布也由独立 `finally` 清理：直接或通配事件订阅者抛错后，active action/skill 会释放，原异常继续向上传递，后续队列保留，被拒动作不会重试。EventBus 仍同步发布；订阅异常可能中断后续订阅者及黑板事件写入，本项不提供事件投递保证，也不改变 Skill 预览或绑定异常的行为。

快照同步、tick 和任务超时轮询在调用层先完成；旧 `tool_call` 步骤保留原分支。执行器不新增取消、回滚、并发锁或权限默认值，不会改变已提交动作的 stop/config/shutdown 语义，详见 [执行边界](../../docs/strategic-planner-injection-design.md#8-分层动作执行边界)。

每个 `SkillModuleDescriptor` 必须声明 `toolDependencies`。`auditSkillCatalogToolPermissions()` 可将这些依赖与某个 Agent allowlist 比较，但不会自行改变权限或过滤运行时动作。

当前默认权限缺口及启用条件见 [Skill 权限策略](../../docs/skill-permission-policy.md)。默认 allowlist 的事实源仍是 `src/catalog/tool-catalog.ts`。

`interact.eat`、`player.look` 与 `movement.walk` 的 Agent 参数执行器已可用，但仍不属于默认 allowlist；自定义权限配置之外的 Agent 行为没有变化。`interact.eat` 的实际执行还会经过 MCP/Web 共用的 `ActionCommandSet` 与 CommandDispatcher，并保留现有 Agent 参数错误与成功文本。转头执行器要求有限数字 `yaw/pitch`；步行执行器沿用 MCP 的 100-60000ms 整数范围，严格校验布尔参数并保证计时停止。

`move.stopFollow` 保持原默认权限和 `stopped follow` 成功文本，但现在会经过共享 `ActionCommandSet` 与 CommandDispatcher，与 MCP/Web 共用领域 handler 并写入跨入口命令历史。其 `executed` 终态只表示停止 handler 正常完成，游戏内停止仍需 Adapter/事件证据确认。

`inventory.holdByCategory` 同样保留原默认权限、类别 trim、错误文本和成功 detail，但实际持有动作现在经过共享 CommandDispatcher。非法类别仍由 Agent 边缘拒绝；有效命令会按 `source=agent` 写入 Command History，`executed` 不等于游戏客户端已经显示切换后的手持物。

`interact.openDoor` 保留原默认权限、`Number(...)` 参数转换、默认 reach/radius 和成功文本，实际开门动作则经过共享 CommandDispatcher。MCP 的严格范围只属于协议边缘，不会被反向强加给 Agent；`source=agent` 的 `executed` 记录仍需结合 Adapter 与游戏内门状态判断。

`social-skill` 只会把成对且有限的 `yaw/pitch` 编译为 `player.look`。缺少有效角度时，`socialize` 改读附近玩家，`observe_target` 改读附近实体，因此超时恢复不会再生成无效转头参数；真正的定向转头仍保持默认权限关闭。

`wander-skill` 不再隐式转换 planner 参数类型；错误类型会交给 dispatcher 明确拒绝。当前 `movement.walk` 仍是直接向前控制，没有地形前视或落差保护，因此不能作为安全 Pathfinder 闲逛，也不应默认开放。

## 验证

```powershell
npm test -- test/agent-blackboard.test.ts test/agent-executor-lifecycle.test.ts test/agent-executor-integration.test.ts test/agent-tool-executors.test.ts test/action-command-set.test.ts test/eat-command-integration.test.ts test/hold-category-command-integration.test.ts test/open-door-command-integration.test.ts test/skill-permission-audit.test.ts test/tool-catalog.test.ts
npm test -- test/openai-agent-planner.test.ts test/planner-request-runner.test.ts test/ai-request-lifecycle.test.ts test/agent-planner-integration.test.ts test/agent-planning-strategy.test.ts test/agent-planning-turn.test.ts test/agent-planning-injection-integration.test.ts
npm test -- test/agent-runtime-action-executor.test.ts test/agent-planner-integration.test.ts
```
