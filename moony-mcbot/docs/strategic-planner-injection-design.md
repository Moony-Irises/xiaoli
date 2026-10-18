# Strategic Layer 生产注入设计

状态：第一阶段已实现，第二阶段仍在收口。2026-10-18 已接入默认策略、完整轮次协调和执行前失效检查；公共 MCP/Web/自动规划入口继续兼容。进度见 [路线图阶段 2](architecture-convergence-roadmap.md#阶段-2agent-单一真相源)，测试入口见 [手动测试指南第 9.1 节](manual-testing-guide.md#91-规划请求拆分回归待你方便时测)。

## 1. 要解决的问题

当前已经拆出三段可离线验证的逻辑：

- `OpenAiAgentPlanner`：输入指令和本地状态，按白名单构造云端请求，返回原始 `AgentPlan`。
- `runAgentPlannerRequest()`：持有单次请求 handle，转发取消信号并更新请求诊断。
- `buildDirectiveFromPlan()`：把计划翻译成战略指令和未映射的兼容工具步骤，不执行动作。

生产现在通过 `DefaultAgentPlanningStrategy` 和 `AgentPlanningTurnCoordinator` 接入；策略组合请求和翻译，协调器拥有冷却、事件、目标更新、入队、持久化和失效检查。已有 `StrategicPlanner.plan(blackboard)` 只返回 `StrategicDirective | null`，`HierarchicalAgentRuntime.runStrategicPass()` 仍保留旧兼容路径，后续需要在不改变外部契约的前提下决定是否删除。

直接把三段逻辑塞进旧接口会丢失原始计划、里程碑、兼容步骤和 `no_action` 结果，也可能让调用层和 Runtime 各应用一次指令。因此不能只替换构造参数。

## 2. 建议的内部契约

保留现有 `StrategicPlanner` 和 `runStrategicPass()` 的公开签名。生产入口已新增策略边界和轮次协调器；以下接口已经导出，仍属于内部组合 API：

```typescript
interface AgentPlanningDecision {
  plan: AgentPlan;
  directive: StrategicDirective | null;
  leftoverSteps: AgentPlanStep[];
}

interface AgentPlanningInput extends AgentPlanRequest {
  botId: string;
  maxPlanSteps: number;
}

interface AgentPlanningStrategy {
  decide(input: AgentPlanningInput): Promise<AgentPlanningDecision>;
}
```

默认策略组合现有请求构造和纯翻译器，只返回决策。策略不得写黑板、更新目标、发送聊天、操作 Adapter 或持有配置 Store。返回 `plan` 是为了保留现有 `agent.runOnce` / Web 调试结果，里程碑仍从 `plan.directive` 读取；不得重新解析或删去原始计划字段。该策略位于 `planning-strategy.ts`，轮次应用位于 `planning-turn-coordinator.ts`。

应用组合层注入一个策略实例，按调用参数隔离 Bot；离线测试注入假策略。每 Bot 使用不同策略、云端/本地模型路由及公开配置字段留到后续，不随本次增加。

## 3. 数据流与所有权

1. MCP、Web、自动战略 pass 进入同一个轮次协调器，继续携带原 `source` 和 `requester`。
2. 协调器同步黑板并检查既有冷却，发布 `planner_requested`，采集一次现有本地状态快照。
3. 协调器建立 Bot 专属的规划轮次作用域，持有请求生命周期及有效性标记；调用注入策略。
4. 默认策略继续在模型请求前使用既有上下文投影，再调用纯翻译器。完整本地快照不得直接发往云端。
5. 策略返回后，协调器先检查轮次仍有效，再按现有顺序记录诊断、发布 `planner_result`、更新目标、应用指令和处理兼容步骤。
6. executor 继续从黑板取动作，经 Skill、权限复核和 CommandDispatcher 执行。协调器不直接执行战略动作。
7. 协调器负责轮次结束、持久化排队与原返回结构；所有退出路径释放自己持有的作用域。

黑板仍是目标、任务和动作队列的真相源。请求生命周期只管理暂态取消和诊断，不存第二份游戏目标。策略只产出决策，协调器只应用一次；不能再调用会自动应用指令的旧 `runStrategicPass()`。

## 4. 取消与迟到结果

本轮测试确认的实际行为：

- `AiRequestLifecycle` 用请求代次阻止旧状态写回；旧 handle 关闭不会移除新请求。
- `cancel()` 发出中止信号，`invalidate()` 还会移除当前请求登记；不同 Bot 互不影响。
- 如果 requester 忽略中止，现有 runner 仍会返回迟到的原始计划。它只能保证诊断门控，不能证明执行已被取消；现有同 Bot 新请求也不会隐式中止旧请求。

请求 handle 的所有权已经上移到完整轮次协调器，作用域覆盖决策返回到应用阶段；默认策略只消费信号，不再嵌套建立第二个生命周期。旧 runner 保留兼容入口，生产路径改用同一套状态写回辅助逻辑，避免重复 begin/close。

协调器需要同时检查“仍是当前轮次”和“信号未中止”，在目标、队列、聊天等副作用前复核。若中途有 `await`，恢复后再次复核。轮次失效不更新目标、不入队、不发送计划中的短句，也不覆盖新轮次诊断；已经发给客户端的动作仍需专门停止命令，不能宣称已回滚。

这是比旧实现更严格的行为，已通过用户确认和离线回归接入。不能只在 runner 返回前检查一次：协调器在每个可能产生副作用的异步边界后复核同一轮次作用域。

## 5. 必须保留的兼容边界

| 范围 | 迁移要求 |
| --- | --- |
| MCP / Web | 工具名、参数及成功返回的 `plan`、`plannedSteps`、`executionResult`、`stateSnapshot` 不变 |
| 模型输入 | 沿用现有系统提示、示例、记忆摘要和字段白名单，不额外发送完整黑板、账号、密钥或原始聊天 |
| 冷却 | 保留首次/恰好到期/时钟回退边界、`no_action` 处理和原错误文本；现有起始时间记账与 `applyDirective()` 完成时间记账差异须先补基线，不能顺手统一 |
| 计划翻译 | 显式动作优先、动作上限、`speak` 顺序、旧工具未映射回退、空可执行计划报错不变 |
| 目标 | 保留 goal、source、理由、里程碑和当前索引；`desiredMode` 不得自行改变实际 Agent 模式 |
| 权限 | 保留当前 allowlist；当前兼容步骤的权限检查晚于指令应用，迁移阶段先保持顺序，整体原子授权另行设计 |
| 错误 | 保留现有超时/失败分类、错误对象和各入口处理；失效轮次的取消语义单独批准，不伪装成 `no_action` 成功 |
| 执行证据 | 入黑板和 handler 正常返回不等于游戏执行成功；继续核对任务事件和 Adapter / 游戏证据 |

配置文件、持久化 schema、环境变量和默认工具权限均不需要因策略注入而改变。新接口只在内部组合层使用；若最终需要替换已有导出接口，另做兼容评估。

## 6. 分步实施与验证

1. 已完成：增加请求取消、超时、失效、交错和多 Bot 回归，留下真实行为基线。
2. 已完成：增加默认策略和可注入组合入口，保留原始计划、里程碑及兼容步骤；旧入口继续工作。
3. 已完成：抽出整轮协调器并把生命周期所有权上移，固定假策略已验证冷却、事件顺序、只应用一次、权限和原返回。
4. 已完成：增加轮次有效性复核，覆盖忽略 AbortSignal、异步聊天前后取消、旧请求迟到、配置删除/重载、shutdown 和跨 Bot。
5. 进行中：MCP、Web、自动战略 pass 已复用协调器；仍需完整离线门禁后的真实 API 与游戏回归。

最小离线回归命令：

```powershell
npm test -- test/planner-request-runner.test.ts test/ai-request-lifecycle.test.ts test/agent-plan-to-directive.test.ts test/agent-planner-integration.test.ts
```

未来失效结果测试必须断言没有目标更新、队列新增或聊天发送；只看到诊断没有变还不够。应使用可控 deferred promise 安排先后顺序，不依赖真实云端延迟。

## 7. 待确认决定与非目标

当前采用“保留旧接口、新增返回完整决策的策略、由一个协调器应用”的迁移方式，并将失效轮次拒绝提交作为行为修正。后续只需继续收口自动规划的停机证据和真实游戏回归。

本方案不增加玩法、不放开工具权限、不实现 Modded Client、不改变聊天人格或共享记忆，也不把整层迁移描述成已经完成。发现的取消后迟到计划风险及权限顺序限制记在 [TODO](../TODO.md)，不在基线测试阶段直接改行为。

## 8. 分层动作执行边界

后续收敛按单个动作推进：`action-tools.ts` 继续同步快照、发布 tick 并轮询任务超时；独立内部执行器接收 Runtime 和当前权限、任务冲突判断、工具调用及结果诊断四个 hooks，负责预览 Skill、权限复核、绑定动作、执行、发布终态并在 `finally` 释放 active action/skill。

保持现有顺序：权限拒绝会消费该动作并发布 normal 优先级的 `task_failed`、返回 `false`；任务冲突保留队首动作且不绑定；工具成功发布 `task_finished`，异常发布 high 优先级的 `task_failed`，两者都返回 `true`。执行期间 active action/skill 保持可观察，后续队列由黑板持有。事件字段、工具参数、诊断文本和两次 Skill 编译的既有行为保持不变。

旧 `tool_call` 兼容步骤已经存在同一黑板队列中，但尚有单独的执行分支，本步继续保留。规划作用域在计划提交完成后关闭；已经入队或开始的动作不因本次抽取获得取消或回滚保证。后续若改变 stop/config/shutdown 对已提交工作的语义，需要单独设计与确认。
