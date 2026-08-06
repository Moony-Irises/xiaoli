# Agent Core Chain Checklist

这份清单只覆盖当前最重要的 3 条链路：

1. `follow`
2. `mine`
3. `report`

调试时只看：

- 游戏内真实行为
- `agent.trace.summary`
- `agent.events.tail`
- `agent.goal.status`

不要把上层聊天模型的自然语言总结当成真实状态。

## 0. 通用准备

先保证 bot 已连接、可见、可行动。

推荐先配：

工具：`agent.configure`

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "enabled": true,
  "mode": "auto",
  "owner": "Judy",
  "whitelist": ["Judy"],
  "commandWakeWord": "小狸",
  "autoIdlePolicy": "none",
  "allowProactiveAction": false
}
```

可选：给 owner 加别称，方便观察汇报链。

工具：`memory.player.upsert`

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "playerName": "Judy",
  "alias": "茉莉",
  "relation": "owner",
  "tags": ["trusted", "important"]
}
```

## 1. Follow Chain

### 1.1 设置目标

工具：`agent.goal.set`

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "goal": "Follow Judy",
  "rationale": "core-chain-check",
  "milestones": ["Start following Judy", "Maintain proximity to Judy"],
  "currentMilestoneIndex": 0
}
```

### 1.2 通过标准

- 游戏里开始跟随 `Judy`
- 跟随目标的可见性从 Adapter 玩家快照读取；不可见玩家不能让 `activationTriggered` 变为 `true`
- `agent.goal.set` 返回中：
  - `activationAttempted = true`
  - `activationTriggered = true`
- `agent.goal.status` 中：
  - `currentMilestoneIndex` 从 `0` 推进到 `1`
- `agent.events.tail` 中能看到：
  - `milestone_advanced`
  - 或 `goal_activation_rule triggered follow for Judy`

### 1.3 失败时先查

工具：`agent.trace.summary`

```json
{
  "botId": "XiaoLi_26.3.3_newnancity"
}
```

看：

- `activeTask`
- `runtimeState`
- `currentMilestone`

## 2. Mine Chain

### 2.1 前提

- `Judy` 在 bot 附近
- 附近有肉眼可见矿物
- bot 当前不在别的任务里

必要时先停跟随：

工具：`move.stopFollow`

```json
{
  "botId": "XiaoLi_26.3.3_newnancity"
}
```

### 2.2 设置目标

工具：`agent.goal.set`

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "goal": "下矿",
  "rationale": "core-chain-check",
  "milestones": ["开始下矿", "完成附近可见矿清理"],
  "currentMilestoneIndex": 0
}
```

### 2.3 通过标准

- bot 去挖 `Judy` 附近 32 格内的可见矿
- 挖矿过程中能看到切合适工具
- 结束后回到 `Judy` 附近
- 游戏里发出：
  - `搞定！`

同时看：

- `agent.events.tail`
- `agent.trace.summary`

应能看到：

- `goal_activation_rule triggered mining near Judy`
- `mine_collect_visible`
- `milestone_advanced`

### 2.4 常见失败点

- bot 还在跟随任务中
- 附近没有“可见矿物”
- 上层模型把“下矿”错误解释成挖石头

调试时不要信聊天模型总结，只信工具原始 JSON 和游戏内行为。

## 3. Report Chain

### 3.1 前提

- 附近 12 格内有可信玩家（如 `Judy`）
- 最好已给这个玩家设置 `alias`

### 3.2 完成汇报

最简单做法是先设一个只有 1 个 milestone 的目标，然后推进完成。

工具：`agent.goal.set`

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "goal": "Test report completion",
  "rationale": "core-chain-check",
  "milestones": ["Only step"],
  "currentMilestoneIndex": 0
}
```

工具：`agent.goal.advance`

```json
{
  "botId": "XiaoLi_26.3.3_newnancity"
}
```

### 3.3 通过标准

- 游戏里出现：
  - `茉莉，搞定了。`
  - 如果没 alias，则是 `Judy，搞定了。`
- `agent.events.tail` 中能看到：
  - `goal_completed`
  - `strategic_lifecycle_report sent for goal_completed`

### 3.4 放弃汇报

如果后面要测 `goal_abandoned`，方式类似：

- 先有一个 goal
- 触发放弃
- 看游戏里是否出现：
  - `茉莉，这个先不做了。`

## 4. 推荐观测顺序

每次只开这 3 个工具看：

1. `agent.goal.status`
2. `agent.trace.summary`
3. `agent.events.tail`

## 5. 记录结果建议

每条链只记 3 件事：

1. 游戏里真实发生了什么
2. `agent.trace.summary` 的关键字段
3. `agent.events.tail` 最后 5 条

这样后续修问题会快很多。
