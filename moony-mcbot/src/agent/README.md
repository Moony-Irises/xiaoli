# Agent 模块

该模块实现分层 Agent 的黑板、事件、反应规则、Skill Catalog 和运行时调度，不直接持有 Mineflayer 客户端。

## 主要入口

- `types.ts`：分层 Agent 的稳定数据契约。
- `blackboard.ts`：目标、任务、动作队列和执行事件状态。
- `reactive-rules.ts`：将高优先级事件转换为战略动作。
- `skill-catalog.ts`：评估战略动作并编译为工具调用。
- `tool-executors.ts`：可离线测试的 Agent 工具执行语义；当前包含进食、转头和限时步行执行器。
- `runtime.ts`：组织事件、动作选择、Skill 绑定和执行状态。

## 工具权限

每个 `SkillModuleDescriptor` 必须声明 `toolDependencies`。`auditSkillCatalogToolPermissions()` 可将这些依赖与某个 Agent allowlist 比较，但不会自行改变权限或过滤运行时动作。

当前默认权限缺口及启用条件见 [Skill 权限策略](../../docs/skill-permission-policy.md)。默认 allowlist 的事实源仍是 `src/catalog/tool-catalog.ts`。

`interact.eat`、`player.look` 与 `movement.walk` 的内部 dispatcher 已可用，但仍不属于默认 allowlist；自定义权限配置之外的 Agent 行为没有变化。转头执行器要求有限数字 `yaw/pitch`；步行执行器沿用 MCP 的 100-60000ms 整数范围，严格校验布尔参数并保证计时停止。

`move.stopFollow` 保持原默认权限和 `stopped follow` 成功文本，但现在会经过共享 CommandDispatcher，与 MCP/Web 共用领域 handler 并写入跨入口命令历史。其 `executed` 终态只表示停止 handler 正常完成，游戏内停止仍需 Adapter/事件证据确认。

`social-skill` 只会把成对且有限的 `yaw/pitch` 编译为 `player.look`。缺少有效角度时，`socialize` 改读附近玩家，`observe_target` 改读附近实体，因此超时恢复不会再生成无效转头参数；真正的定向转头仍保持默认权限关闭。

`wander-skill` 不再隐式转换 planner 参数类型；错误类型会交给 dispatcher 明确拒绝。当前 `movement.walk` 仍是直接向前控制，没有地形前视或落差保护，因此不能作为安全 Pathfinder 闲逛，也不应默认开放。

## 验证

```powershell
npx tsx --test test/agent-tool-executors.test.ts test/skill-permission-audit.test.ts test/tool-catalog.test.ts
```
