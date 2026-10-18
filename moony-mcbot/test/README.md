# Automated Tests

默认入口：

```powershell
npm test
```

该命令自动发现 TypeScript 测试，并通过 `scripts/test-setup.ts` 把持久化路径隔离到每个测试进程自己的系统临时目录。不要在测试中读取正式账号、AppData 配置或 `C:\xiaoli\memory`。

定向执行时继续使用 npm 入口，以保留相同 setup：

```powershell
npm test -- test/local-env.test.ts
```

Node reporter 会把预加载的 setup 及其 helper 各显示为一个文件级通过项；它们没有注册业务测试，这是预加载模块的报告口径。

## Agent 规划离线回归

```powershell
npm test -- test/openai-agent-planner.test.ts test/planner-request-runner.test.ts test/agent-planner-integration.test.ts
```

单元测试注入模型传输，覆盖上下文筛选、提示词、兼容回复、HTTP/解析错误和取消/超时错误传递。接线测试使用临时本机 HTTP 服务和模拟客户端，从真实 MCP handler 经过黑板、Skill 和 CommandDispatcher 到达 Adapter；也检查请求诊断与冷却。

接线测试显式开放 `interact.eat`，不改变生产默认权限。状态采集暂用最小原生兼容 fixture，不能据此宣称完整快照已支持 Modded Client，或证明游戏内真实进食成功。

父测试会逐个等待异步子测试，确保子测试结束后才关闭本机 HTTP 服务，遵循 [Node.js 24 子测试生命周期](https://nodejs.org/docs/latest-v24.x/api/test.html#subtests)。

Agent 事件视图的离线回归还覆盖框架事件与执行事件合并、`tick`/感知刷新噪声过滤、时钟回退下的记录顺序、共享 ID 去重、20 条上限和多 Bot 隔离。真实游戏行为仍需按手动指南确认。

`agent-plan-to-directive.test.ts` 覆盖模型计划的高层动作优先级、旧工具步骤兼容回退、缺参数、动作数量上限和元数据保留；它不调用网络或游戏客户端。

`planner-request-runner.test.ts` 覆盖 planner 请求输入、成功诊断、超时/普通错误对象保留、实际信号取消、失效后迟到完成、同 Bot 新旧请求交错和多 Bot 隔离；它不调用网络或游戏客户端。旧 runner 返回迟到计划的兼容行为继续保留，生产协调器负责执行前失效复核，见 [注入设计](../docs/strategic-planner-injection-design.md)。

`agent-planning-turn.test.ts` 覆盖完整轮次的冷却、原始计划与里程碑保留、单次应用、权限/执行错误、取消和失效后的无副作用、同 Bot 交错、异步聊天、shutdown 及多 Bot 隔离。`agent-planning-injection-integration.test.ts` 通过真实 MCP 注册、Web debug helper、配置重载和自动 executor 验证同一注入策略的入口复用；使用假策略和隔离适配器，不连接真实模型或游戏。

`agent-runtime-action-executor.test.ts` 使用真实黑板和 Skill Catalog、注入领域工具 hooks，覆盖不可编译动作、权限拒绝、任务冲突、执行中状态、结果/事件顺序、工具/诊断/事件异常、后续队列继续执行、反应优先级与 Bot 隔离。`agent-planner-integration.test.ts` 同时验证 MCP 排队后的权限拒绝不触达 Adapter，及真实 Dispatcher 接线中的失败诊断与 active 状态释放。测试不证明已提交动作可以回滚，也不取代游戏内验证。

权限拒绝订阅者异常回归先在旧实现复现 active 状态残留，再验证直接/通配订阅者抛出的原异常、清理、下一动作继续执行及另一个 Bot 的 pending Skill 不受影响；不依赖真实 API、游戏或时间延迟。
