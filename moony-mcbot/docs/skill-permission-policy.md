# Skill 工具权限策略

## 1. 目的

分层 Agent 会把 `StrategicAction` 交给 Skill Module，再编译成一个或多个 `SkillInvocation`。工具能通过 MCP 被人工调用，不代表它已经适合由 Agent 自动执行；自动执行还必须同时满足内部 dispatcher、参数语义、风险策略和默认 allowlist。

本文件记录当前 Skill Catalog 与 17 项默认 Agent 工具之间的缺口。当前阶段只建立审计，不扩大权限。

## 2. 执行链

```text
event / planner
  -> StrategicAction
  -> SkillModuleDescriptor.compile()
  -> SkillInvocation
  -> allowedTools 检查
  -> executeAgentToolCall()
  -> BotRuntime / ClientAdapter
```

`toolDependencies` 声明每个 Skill Module 可能编译到的所有工具。`auditSkillCatalogToolPermissions()` 负责报告声明依赖中不在指定 allowlist 的项。它是纯审计函数，不参与运行时放行。

## 3. 当前四项缺口

| Skill Module | 工具 | 动作来源 | 当前阻塞 | 风险判断 |
| --- | --- | --- | --- | --- |
| `combat-skill` | `interact.attackPlayer` | planner、受伤反应规则 | Agent dispatcher 无分支；受伤事件只提供名称，不能证明目标一定是玩家 | 高风险，最后开放 |
| `eat-skill` | `interact.eat` | planner、低生命/低饥饿反应规则 | Agent dispatcher 与离线测试已补齐；默认权限待确认 | 中风险，执行前置已完成 |
| `wander-skill` | `movement.walk` | planner 的闲逛动作 | dispatcher 与参数测试已补齐；直接前进尚无地形前视/落差保护 | 中风险，继续关闭 |
| `social-skill` | `player.look` | 带完整有限 yaw/pitch 的 `socialize`、`observe_target` | Agent dispatcher 与离线测试已补齐；默认权限待确认 | 低风险写动作，执行前置已完成 |

这四个 MCP 工具本身已经存在，部分聊天或固定规则也有独立执行路径。这里的缺口专指分层 Agent 的自动执行链。

## 4. 默认策略

1. 默认 allowlist 保持 17 项，不因为 MCP 工具存在就自动开放。
2. Planner 继续只看到当前 `allowedTools`，分层运行时继续拒绝未允许的 SkillInvocation。
3. 持久化自定义 allowlist 继续原样恢复；审计不得删除或重排用户配置。
4. 工具加入默认权限属于公共行为契约变化，实施前必须单独确认。

## 5. 启用门槛

每个候选工具必须分别完成：

1. 在 `executeAgentToolCall()` 增加类型明确的分支，并复用 BotRuntime / ClientAdapter，而不是重新访问原生 Mineflayer。
2. 覆盖正常、边界和错误路径测试，确认参数验证不弱于 MCP schema。
3. 修复对应 Skill 编译语义；尤其不能用缺少 yaw/pitch 的 `player.look`，也不能把未知实体名称直接当作玩家。
4. 明确是否允许 planner、反应规则或两者调用，以及能否打断当前任务。
5. 经确认后再扩展 Tool Catalog、默认 allowlist、注册契约文档和游戏验收步骤。

`social-skill` 已完成无效角度修复：只有成对且有限的数字角度会编译为 `player.look`；无有效角度的 `socialize` 会读取 `observe.nearbyPlayers`，无有效角度的 `observe_target`（包括当前超时恢复规则）会读取 `observe.nearbyEntities`。这两个只读降级工具已经属于默认 17 项 allowlist，不需要扩大权限。

当前 `interact.eat` 已完成第 1-3 项执行前置：`eat-skill` 保留可选 `itemName`，省略时自动选择，空串和非字符串交由执行边缘拒绝，显式与旧计划均有完整模拟接线回归；`player.look` 已完成第 1-3 项。`movement.walk` 也已补齐 dispatcher、MCP 同级的 `100..60000` 整数时长约束、严格布尔参数、旧状态取消和定时停止；Wander Skill 不再把字符串通过 `Number()` / `Boolean()` 隐式转换。

这不代表 `movement.walk` 已适合默认开放：底层仍是直接控制向前，没有地形前视、碰撞绕行或悬崖/大落差保护。`interact.eat`、`player.look`、`movement.walk` 均继续留在默认 Tool Catalog / allowlist 之外。后续先补移动地形安全，再单独评估 `interact.attackPlayer`；高风险攻击权限不与其他能力打包开放。
