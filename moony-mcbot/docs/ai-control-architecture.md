# Minecraft Bot MCP AI 接管架构规划

## 1. 目标

当前系统已经有两类能力：
- 固定行为工具：跟随、挖矿、攻击、开门、聊天、观察、自保等。
- AI 闲聊能力：基于白名单和唤醒词进行小范围自然语言回复。

下一阶段目标不是继续堆单个指令，而是让 AI 在这些固定行为之上进行“决策与调度”。

这里有一个关键原则：
- 固定行为层继续保留，并且尽量保持可直接调用、可独立测试、可复现。
- AI 接管层不直接操作 Mineflayer 细节，而是只调用固定行为层暴露出来的能力。

这样做的价值：
- 固定行为仍然可以作为回归测试和故障定位工具。
- AI 行为失控时，问题边界更清晰，是“决策错了”还是“底层动作坏了”。
- 未来替换模型、调整提示词、加入本地模型时，不需要重写底层动作实现。

## 2. 总体分层

推荐把系统拆成三层，而不是把 AI 直接塞进现有 `chat.ai`：

```text
+---------------------------------------------------+
|  Chat / Wake Layer                                |
|  - 白名单过滤                                     |
|  - 唤醒词匹配                                     |
|  - 普通闲聊                                       |
|  - AI 接管触发                                    |
+---------------------------------------------------+
|  AI Orchestrator Layer                            |
|  - 状态摘要                                       |
|  - 目标生成                                       |
|  - 工具选择                                       |
|  - 行为计划                                       |
|  - 执行结果反思                                   |
+---------------------------------------------------+
|  Deterministic Skill Layer                        |
|  - move.followPlayer                              |
|  - mine.collectVisible                            |
|  - interact.attackPlayer / duel / openDoor        |
|  - observe.* / self.guard.* / inventory.*         |
+---------------------------------------------------+
```

建议名称：
- 现有固定指令体系：`skill layer`
- 新增 AI 接管体系：`agent layer`

## 3. 为什么不要把 AI 接管直接并进现有 `chat.ai`

现有 `chat.ai` 更像“闲聊回复器”，特点是：
- 输入是聊天文本。
- 输出是聊天文本。
- 行为副作用很弱，最多是语言回应。

但 AI 接管需要的是：
- 输入不只是聊天，还包括世界状态、背包、附近实体、当前任务、自保状态。
- 输出不只是说话，而是一个或多个行为调用。
- 需要有任务生命周期、错误恢复、超时、中断、优先级。

因此更合理的做法是：
- `chat.ai` 保留为 `social chat`。
- 新增单独的 `agent.control` 或 `agent.runtime` 模块负责 AI 行为接管。

## 4. 建议的模块边界

### 4.1 固定行为层

职责：
- 提供可预测、幂等或近似幂等的 MCP 工具。
- 每个工具都应尽量有明确输入、输出、失败原因。

已有能力已经接近这个方向，但还需要继续收敛：
- 移动类：跟随、停下、到指定位置。
- 交互类：开门、摆臂动画（攻击/使用动画）、吃东西、攻击。
- 感知类：观察自己、背包、玩家、实体、方块、可见方块。
- 资源类：可见挖矿、整理背包、切换工具。
- 生存类：自保、进食、低血处理。

设计要求：
- AI 层只能调用这些工具，不直接触达底层 bot 对象。
- 每个工具的返回必须适合被 AI 读取和下一步推理使用。

### 4.2 AI 编排层

这是新模块，职责不再是“回复一句话”，而是：
- 维护当前高层任务。
- 根据世界状态决定是否采取行动。
- 将自然语言目标翻译成一串固定行为调用。
- 在行为失败时决定重试、放弃还是换方案。

推荐拆成四个子组件：

1. `State Builder`
- 聚合 bot 当前状态。
- 生成给模型看的紧凑上下文。
- 当前云端 planner 已通过字段白名单投影读取紧凑上下文，完整 `agent.stateSnapshot` 仅供本地调试；字段边界见 [Planner 上下文投影设计](planner-context-projection-design.md)。

2. `Planner`
- 接收目标，例如“找点浆果”“没事就跟着 Judy”。
- 输出结构化行动计划，而不是自由文本。

3. `Executor`
- 执行模型输出的工具调用。
- 记录执行结果。

4. `Policy Guard`
- 限制模型的调用权限和频率。
- 在危险状态下强制切断计划并交给自保逻辑。

### 4.3 社交层

社交层与 AI 编排层共享模型能力，但职责不同：
- 社交层负责回应玩家。
- AI 编排层负责控制 bot。

两者共享的东西：
- 同一 bot persona
- 同一份长期记忆/短期摘要
- 同一个白名单体系

两者必须分开的东西：
- 聊天回复 cooldown
- 行为计划 cooldown
- 可调用工具白名单
- 失败处理策略

## 5. 推荐的数据模型

### 5.1 Agent Mode

每个 bot 需要一个 AI 控制模式：

```json
{
  "mode": "manual | assist | auto"
}
```

含义：
- `manual`：只有固定行为和闲聊，不允许 AI 发起动作。
- `assist`：AI 只在被唤醒后执行任务。
- `auto`：AI 可在空闲时主动选择行为，比如“无任务时跟随主人”。

建议默认值：
- 默认 `manual`

### 5.2 Agent Goal

每个 bot 同时最多维护一个高层目标：

```json
{
  "type": "follow_owner | gather_visible_ore | gather_food | defend | idle",
  "source": "player_command | policy | self_guard | schedule",
  "status": "pending | running | blocked | done | failed | cancelled",
  "createdAt": "ISO",
  "updatedAt": "ISO",
  "params": {}
}
```

不要一开始就做多任务调度。
先做“单任务 + 中断恢复”已经足够复杂。

### 5.3 Agent Memory

需要三类记忆，不建议直接把完整聊天历史喂给模型：

1. 短期记忆
- 最近几条有效对话
- 最近几次动作结果

2. 状态摘要
- 当前生命、饥饿、背包关键物品、附近威胁、是否跟随、是否空闲

3. 长期偏好
- 主人是谁
- 默认空闲策略是什么
- 人格和台词风格

## 6. AI 接管的输入输出格式

这里建议非常保守，不要让模型直接返回自由文本加工具调用混合体。

推荐让模型只返回结构化 JSON，例如：

```json
{
  "intent": "execute_skill",
  "speak": "我去看看。",
  "tool": "mine.collectVisible",
  "arguments": {
    "searchRadius": 24,
    "maxBlocks": 8,
    "blockNames": ["coal_ore", "deepslate_coal_ore"]
  }
}
```

或者：

```json
{
  "intent": "no_action",
  "speak": "这里没看到矿。"
}
```

这样有三个好处：
- 输出可验证。
- 容易加安全限制。
- 模型出错时能直接回退。

## 7. 建议的接入方式

### 7.1 新增配置，而不是复用 `chat.ai.configure`

建议新增一套独立工具：
- `agent.configure`
- `agent.status`
- `agent.start`
- `agent.stop`
- `agent.runOnce`

原因：
- `chat.ai` 是对话配置。
- `agent.*` 是行为接管配置。
- 两者的参数和风险完全不同。

### 7.2 建议的 Agent Config

```json
{
  "enabled": false,
  "mode": "manual",
  "whitelist": ["Judy"],
  "owner": "Judy",
  "commandWakeWord": "小狸",
  "autoIdlePolicy": "follow_owner",
  "plannerModel": "gpt-5-nano",
  "maxPlanSteps": 3,
  "planCooldownMs": 4000,
  "maxToolCallsPerTurn": 3,
  "allowProactiveAction": false,
  "allowedTools": [
    "observe.self",
    "observe.inventory",
    "observe.nearbyPlayers",
    "observe.nearbyEntities",
    "block.findVisible",
    "mine.collectVisible",
    "move.followPlayer",
    "move.stopFollow",
    "chat.send"
  ]
}
```

## 8. 与现有系统的关系

### 8.1 固定行为层保留

现有固定行为层不但要保留，还应该继续增强，因为它是 AI 的“手脚”：
- 越稳定，AI 越可控。
- 越可观察，AI 越容易调试。

### 8.2 `chat.listener` 保留

`chat.listener` 继续负责：
- 固定短语命令
- 快速测试某个功能是否正常
- 在 AI 失效时仍然能手工接管 bot

### 8.3 `chat.ai` 缩回社交用途

未来建议给 `chat.ai` 重新定义职责：
- 只负责聊天风格和自然回应
- 不直接发起复杂行为

### 8.4 `self.guard` 优先级最高

无论 AI 计划什么，只要触发以下情况，应立即中断：
- 血量危险
- 明确被攻击
- 饥饿/缺氧/坠落等生存风险

优先级建议：

```text
self_guard > manual_command > agent_goal > idle_policy > social_chat
```

## 9. 第一阶段实施建议

不要直接做“完全自主 bot”。
建议分四阶段推进。

### 阶段 A：行为接管骨架

目标：
- 新增 `agent.*` 配置和运行时状态。
- 允许模型做“一次决策，一次工具调用”。

范围：
- 只允许只读观察工具 + 1 个动作工具。
- 不做连续链式规划。

验收：
- 玩家说“`小狸 去挖矿`”，AI 选择一个已存在的固定工具并执行。

### 阶段 B：短计划执行

目标：
- 允许模型在一次任务里做 2-3 步。

例子：
1. 观察背包
2. 观察附近矿物
3. 调用挖矿工具

验收：
- 模型可以根据当前状态选择是否先整理装备或直接行动。

### 阶段 C：空闲策略

目标：
- 没有明确任务时，执行默认策略。

最适合最先做的空闲策略：
- `follow_owner`

验收：
- 没人发命令时自动跟随主人。
- 一旦收到新命令或触发生存风险，立刻中断。

### 阶段 D：带记忆的持续代理

目标：
- 模型维护简单长期偏好和短期摘要。

例如：
- 主人是 `Judy`
- 最近在挖矿
- 背包里缺食物

验收：
- 可以在多个回合里维持同一个任务上下文。

## 10. 推荐的首批 AI 可调用工具

第一批不要开放全部工具。
建议只开放这些：

观察类：
- `observe.self`
- `observe.inventory`
- `observe.nearbyPlayers`
- `observe.nearbyEntities`
- `block.findVisible`

动作类：
- `move.followPlayer`
- `move.stopFollow`
- `mine.collectVisible`
- `chat.send`

控制类：
- `self.guard.status`

先不要给模型的工具：
- 直接 PvP 攻击玩家
- 丢弃物品
- 高风险连续战斗
- 大范围自由挖掘

## 11. 关键风险

### 11.1 模型过度调用工具

风险：
- 一句话触发大量请求
- 行为抖动

控制：
- 每回合最多 1-3 次工具调用
- 工具调用冷却
- 同类计划去重

### 11.2 模型状态认知错误

风险：
- 以为自己能做到，但底层工具失败

控制：
- 每次执行后把结果摘要返回给 Planner
- 失败 2 次后放弃当前计划

### 11.3 社交与行为互相干扰

风险：
- 正在执行任务时被聊天打断

控制：
- 区分 `social turn` 和 `agent turn`
- 当前有高优先级任务时，闲聊只短回应，不重规划

### 11.4 成本与延迟

风险：
- 模型慢、贵、频繁调用

控制：
- 低频计划，高频动作继续交给固定工具执行
- 用小模型做 Planner，大模型只做复杂任务拆解

## 12. 推荐的新文档与配置文件

建议新增：
- `docs/ai-control-architecture.md`
- `docs/agent-roadmap.md`
- `config/agent-profile.example.json`

未来运行时配置建议落到：
- `%LOCALAPPDATA%\\moony-mcbot\\config\\agent-configs.json`

## 13. 当前最合理的下一步

下一步不要急着写“AI 完全接管”。
最合理的是先做一个最小闭环：

1. 新增 `agent.configure / agent.status / agent.runOnce`
2. 新增 `AgentRuntime` 状态对象
3. 让 AI 只可调用：
- `observe.self`
- `observe.inventory`
- `observe.nearbyPlayers`
- `mine.collectVisible`
- `move.followPlayer`
- `chat.send`
4. 让它先完成一个简单任务：
- “没有任务时跟随 Judy”
- “收到命令时去清理可见矿”

这会是第一个可验证、可迭代的 AI 接管版本。
