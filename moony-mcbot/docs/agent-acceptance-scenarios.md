# Agent Acceptance Scenarios

这份文档只做一件事：把当前分层智能体框架已经具备的关键链路，整理成可逐条手测的验收场景。

目的不是解释实现，而是回答两个问题：

1. 现在到底已经能测什么
2. 每一条应该看什么现象才算通过

## Scope

当前场景覆盖：

- 手动高层规划入口
- 自动战略层
- 生命周期驱动重规划
- 长期目标与 milestone
- 统一 skill catalog 覆盖的关键动作
- goal 完成/放弃后的汇报倾向

不覆盖：

- 复杂建造
- 合成/熔炼
- 箱子存取
- 严格 completion condition

## Common Setup

先保证下面几件事成立：

1. bot 已成功进服
2. `chat.listener` / `chat.ai` 白名单已正确配置
3. `agent` 已启用
4. 你知道当前测试 botId

推荐基础配置：

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "enabled": true,
  "mode": "assist",
  "owner": "Judy",
  "whitelist": ["Judy"],
  "commandWakeWord": "小狸",
  "autoIdlePolicy": "none",
  "allowProactiveAction": false
}
```

自动模式测试时再切：

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "mode": "auto",
  "autoIdlePolicy": "socialize_whitelist",
  "allowProactiveAction": true
}
```

## Observability

建议主要看这几个工具：

1. `agent.status`
2. `agent.framework.status`
3. `agent.goal.status`
4. `agent.stateSnapshot`

重点字段：

- `runtimeState`
- `queuedStepCount`
- `strategicGoal`
- `currentMilestone`
- `recentEvents`
- `activeDirectiveId`
- `activeActionId`
- `activeSkill`

## Scenario 1: Manual Strategic Follow

目标：验证 `agent.runOnce` 已经优先走高层 directive，而不是只堆旧 step queue。

触发：

```json
{
  "tool": "agent.runOnce",
  "arguments": {
    "botId": "XiaoLi_26.3.3_newnancity",
    "instruction": "跟着 Judy，但保持一点距离"
  }
}
```

期望：

- bot 开始跟随 Judy
- `agent.framework.status` 中出现：
  - `activeDirectiveId != null`
  - `activeActionId != null` 或 `activeSkill = move.followPlayer`
- `agent.stateSnapshot.taskContext.activeTask.type = follow_player`

失败信号：

- 只有旧 queue 在动，new runtime 没有 activeDirective
- 或 planner 结果始终落到 leftover steps

## Scenario 2: Manual Duel Challenge

目标：验证 `challenge_entity` 已经走统一 action/skill，而不是只有聊天监听能触发。

触发：

```json
{
  "tool": "agent.runOnce",
  "arguments": {
    "botId": "XiaoLi_26.3.3_newnancity",
    "instruction": "挑战一下附近的监守者"
  }
}
```

前置：

- 16 格内确实存在对应目标实体

期望：

- bot 进入对决
- `agent.framework.status` 中 `activeSkill` 最终落到 `combat.challengeEntity`
- `taskContext.activeTask.type = duel`
- 目标死亡后出现：
  - `entity_dead`
  - `task_finished`
  - 公屏发送 `就这`

## Scenario 3: Prepare Battle as Unified Skill

目标：验证“准备战斗”已不再是单独聊天分支，而是统一 skill。

触发：

```json
{
  "tool": "combat.prepareBattle",
  "arguments": {
    "botId": "XiaoLi_26.3.3_newnancity"
  }
}
```

期望：

- 优先把铁剑放到第一格并切出；没有铁剑时切最佳武器
- 自动装备最佳护甲
- 返回文本类似：
  - `prepared_battle weapon=... armor=...`

补充观察：

- 再调用 `agent.stateSnapshot`
- 检查：
  - `heldItem`
  - `armor`

## Scenario 4: Drop Item via Unified Skill

目标：验证 `drop_item` 已进入统一 action/skill。

触发方式 A，直接丢当前手持：

```json
{
  "tool": "agent.runOnce",
  "arguments": {
    "botId": "XiaoLi_26.3.3_newnancity",
    "instruction": "把手上的东西丢掉"
  }
}
```

触发方式 B，直接调用底层 skill：

```json
{
  "tool": "interact.dropHotbarSlot",
  "arguments": {
    "botId": "XiaoLi_26.3.3_newnancity",
    "slot": 1,
    "mode": "stack",
    "restorePrevious": true
  }
}
```

期望：

- 对应物品被丢出
- 若为高层规划触发，`activeSkill` 应出现：
  - `interact.dropHeld`
  - 或 `interact.dropHotbarSlot`

## Scenario 5: Strict TPA Rule Still Preserved

目标：验证旧语义没有因为统一 skill catalog 被破坏。

游戏内触发：

- 白名单玩家发送：`小狸，来找我`

期望：

- bot 发送：
  - `/tpa <玩家名>`
- 然后发送确认语句：
  - `已向 <玩家名> 发送 TPA 请求。`

负例：

- `小狸，来我这`
- `小狸，跟我来`

这些不应该触发 `/tpa`

说明：

- 这条仍然是严格短语规则
- 只是内部执行现在改成统一走 `chat.requestTeleportToPlayer`

## Scenario 6: Strategic Goal Persistence

目标：验证长期目标会持久化并跨重启恢复。

触发：

```json
{
  "tool": "agent.goal.set",
  "arguments": {
    "botId": "XiaoLi_26.3.3_newnancity",
    "goal": "陪着 Judy 并在安全时完成附近资源采集",
    "rationale": "manual acceptance test",
    "milestones": ["先跟上 Judy", "再处理附近可见矿"],
    "currentMilestoneIndex": 0
  }
}
```

操作：

1. 查看 `agent.goal.status`
2. 重启 MCP
3. 再查看 `agent.goal.status`

期望：

- goal 仍在
- milestones 仍在
- `currentMilestoneIndex` 保留

## Scenario 7: Milestone Advance and Rewind

目标：验证 milestone runtime 已经不是纯静态数据。

操作：

1. 调 `agent.goal.advance`
2. 查看 `agent.goal.status`
3. 调 `agent.goal.rewind`
4. 再查看 `agent.goal.status`

期望：

- 当前 milestone 正确前进/回退
- `recentEvents` 出现：
  - `milestone_advanced`
  - `milestone_rewound`

## Scenario 8: Lifecycle-Driven Strategic Pass

目标：验证 milestone/goal 生命周期事件会触发一次保守的战略调整，而不是只写入日志。

推荐配置：

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "enabled": true,
  "mode": "auto",
  "owner": "Judy",
  "whitelist": ["Judy"],
  "autoIdlePolicy": "none",
  "allowProactiveAction": false
}
```

操作：

1. 先设置一个带 milestones 的 goal
2. 调 `agent.goal.advance` 或让任务成功触发自动 milestone 推进
3. 等一个 executor tick

期望：

- 即使 `allowProactiveAction = false`
- 也会发生一次 lifecycle-driven strategic pass
- `agent.framework.status` 中可见：
  - 新的 `activeDirectiveId`
  - 或 `recentEvents` 中出现新的 `planner_requested` / `planner_result`

说明：

- 这一步不会无限重复
- 同一个 lifecycle 事件只会被消费一次

## Scenario 9: Goal Completion Report Tendency

目标：验证 `goal_completed` 后，战略层开始倾向于做一句汇报。

前置：

- owner 或 whitelist 玩家在 12 格内

操作：

1. 设置一个只有一个 milestone 的 goal
2. 推进到最后完成
3. 等一次 lifecycle-driven strategic pass

期望：

- planner 更倾向于产出：
  - `speak("搞定了。")`
- 而不是立刻无关发散

注意：

- 这是“倾向”，不是绝对硬规则
- 它依赖当前模型和上下文

## Scenario 10: Goal Abandonment Report Tendency

目标：验证 `goal_abandoned` 后，系统倾向于给 trusted player 一句简短说明。

前置：

- 附近有 owner 或 whitelist 玩家

操作：

1. 设置一个 strategic goal
2. 让它连续失败直到 `goal_abandoned`
3. 等一次 lifecycle-driven strategic pass

期望：

- planner 更倾向于产出：
  - `speak("这个先不做了。")`
- 或同等语义的简短汇报

## Scenario 11: Repair Priority Over Lifecycle

目标：验证战略层优先级顺序正确。

当前顺序应为：

1. `repair`
2. `lifecycle-driven adjustment`
3. `proactive autonomous pass`
4. `idle policy`

操作：

1. 让一个 activeTask 失败，触发 `task_failed`
2. 同时最近又发生 milestone 变化
3. 等下一次 auto strategic tick

期望：

- 系统优先走 repair
- 不应先处理 milestone 的一般性推进建议

## Scenario 12: End-to-End Mining Goal

目标：验证长期目标、milestone、技能执行、生命周期事件能串成一条链。

示例 goal：

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "goal": "陪着 Judy，并顺手处理她附近的可见矿",
  "rationale": "end-to-end acceptance",
  "milestones": ["先跟上 Judy", "处理附近可见矿", "完成后汇报"],
  "currentMilestoneIndex": 0
}
```

建议步骤：

1. `agent.goal.set`
2. `agent.runOnce` 或 auto strategic pass 让它进入跟随
3. milestone 推进
4. 进入 visible mining
5. 采完后进入汇报

理想观察：

- `follow_player`
- `mine_visible`
- `milestone_advanced`
- `milestone_completed`
- `goal_completed`
- 最后有一句简短汇报

## Known Gaps

当前场景里仍然有这些现实限制：

1. milestone 完成判定仍偏启发式
2. completion condition 还不够 domain-specific
3. 报告类动作依赖模型服从提示词，不是硬编码 FSM
4. 旧系统与新 runtime 仍在桥接并存，不是完全单源

## Recommended Next Validation Order

如果你要从最有价值的顺序开始测，建议按这个顺序：

1. `Scenario 6` Strategic Goal Persistence
2. `Scenario 7` Milestone Advance and Rewind
3. `Scenario 8` Lifecycle-Driven Strategic Pass
4. `Scenario 9` Goal Completion Report Tendency
5. `Scenario 12` End-to-End Mining Goal
