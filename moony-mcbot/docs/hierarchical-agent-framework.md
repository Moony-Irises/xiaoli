# Hierarchical Agent Framework

目标：把当前 bot 从“工具集合 + 若干临时循环”重构成分层智能体。

核心原则：
- 高频反应不交给 LLM
- 低频寓意、策略、状态切换交给 LLM
- 具体动作由编码技能模块完成
- 所有层共享同一份黑板状态和事件流

## 借鉴来源

这个框架主要借鉴了几类成熟方案：

- SayCan：高层语言模型只负责在“可执行技能集合”里做语义选择，具体可行性由底层技能/价值判断决定。
- ProgPrompt：高层规划必须输出受约束的程序化动作，而不是自由文本。
- ReAct：推理、动作、观察要形成闭环，并允许在异常后修正。
- Voyager：技能库应该可复用、可组合，并且允许长期积累。

参考：
- Voyager: https://arxiv.org/abs/2305.16291
- ReAct: https://arxiv.org/abs/2210.03629
- SayCan: https://arxiv.org/abs/2204.01691
- ProgPrompt: https://arxiv.org/abs/2209.11302

## 分层

### 1. Event Layer

职责：
- 接收高频外部信号
- 统一转换成结构化事件
- 给 Reactive / Executive / Blackboard 提供统一输入

典型事件：
- `tick`
- `hurt`
- `chat_wake`
- `task_deadline`
- `task_finished`
- `task_failed`
- `perception_updated`
- `manual_override`

要求：
- 不做复杂推理
- 不直接控制技能

### 2. Blackboard Layer

职责：
- 维护当前共享状态
- 存放：
  - 自身状态
  - 感知摘要
  - 活动任务
  - 高层意图
  - 待执行 action 队列
  - 事件历史
  - 到期任务/定时器

这层是所有层的唯一共享真相来源。

### 3. Reactive Layer

职责：
- 处理必须快速响应的事件
- 高优先级，可打断低层策略

适合放这里的逻辑：
- 受击后的短时反击/闪避
- 低血停止危险任务
- 任务超时中断
- 主人靠近时的即时视线/招呼

原则：
- 规则化
- 快
- 可预测
- 只做短时局部决策

### 4. Executive Layer

职责：
- 执行当前任务
- 把高层 action 编译成一个或多个技能调用
- 管理任务状态机、步骤推进、超时、取消、失败回退

这层是整个系统的“干活层”。

推荐做法：
- 一个 `StrategicAction` 编译成若干 `SkillInvocation`
- 每次 tick 推进一步
- 技能完成后产出 `task_finished` / `task_failed`

### 5. Strategic Layer

职责：
- 低频调用 LLM
- 根据黑板状态决定：
  - 当前寓意/目标
  - 状态切换
  - 新 action
  - action 参数
  - action 风格

这层不直接操作 bot，不直接写控制键。

输出示例：
- `attack_target(target=Judy, style=aggressive_jump_crit)`
- `wander(area=home_front, style=curious)`
- `follow_player(player=Moony, style=close_guard)`
- `mine_visible(blocks=[coal_ore, iron_ore], center=owner_area)`
- `speak(text="搞定！", style=brief)`

### 6. Skill Layer

职责：
- 全部编码实现
- 只接受明确参数，不理解自然语言

技能模块示例：
- FollowSkill
- WanderSkill
- DuelSkill
- VisibleMiningSkill
- SelfGuardSkill
- SocialLookSkill
- ChatSkill

要求：
- 输入稳定
- 输出结构化
- 有成功/失败/取消结果
- 可报告进度

## 关键接口

### StrategicAction

高层动作统一抽象为：

```ts
type StrategicAction = {
  id: string;
  kind: string;
  params: Record<string, unknown>;
  style?: string;
  source: "llm" | "reactive" | "manual";
  priority: "low" | "normal" | "high" | "critical";
  createdAt: number;
  expiresAt?: number;
};
```

这里的 `style` 用来表达“以某种风格行动”，例如：
- `aggressive_jump_crit`
- `gentle_follow`
- `curious_wander`

### SkillInvocation

执行层不会直接消费自然语言，只消费编译后的技能调用：

```ts
type SkillInvocation = {
  skill: string;
  args: Record<string, unknown>;
  timeoutMs?: number;
};
```

## 运行频率建议

- Event Layer：高频，100ms - 500ms
- Reactive Layer：高频，100ms - 500ms
- Executive Layer：中频，200ms - 1000ms
- Strategic Layer：低频，2s - 10s

策略：
- 高频层只做局部与即时
- 低频层只做方向与状态切换

## 抢占规则

推荐优先级：

`manual_override > critical_reactive > active_task > idle_policy > proactive_social`

具体含义：
- 手动命令最高
- 自保/受击/超时类反应可打断普通任务
- 普通任务执行中，LLM 不应频繁改主意
- 空闲策略永远最低

## 当前项目迁移建议

### 现有模块映射

- `self.guard.*` -> Reactive Layer
- `move.followPlayer` / `mine.collectVisible` / `duel` -> Skill Layer
- `agent.runOnce` -> Strategic Layer 雏形
- `agentActiveTasks` / `events` / `snapshot` -> Blackboard 雏形

### 下一步重构顺序

1. 从 `action-tools.ts` 中抽出 `src/agent/`
2. 建立统一事件总线
3. 建立黑板
4. 建立 `StrategicAction -> SkillInvocation[]` 编译器
5. 建立 `HierarchicalAgentRuntime`
6. 最后再逐步迁移旧 follow/mining/duel/self-guard 逻辑

## 本项目的最小落地目标

先做到下面这条链：

`Event -> Blackboard -> Reactive/Strategic -> StrategicAction -> Executive -> SkillInvocation -> Result Event`

只要这条链打通，后面再扩技能、记忆、人格，都不会再继续失控地堆到一个大文件里。
