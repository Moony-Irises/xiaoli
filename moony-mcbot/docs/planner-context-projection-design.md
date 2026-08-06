# 云端 Planner 上下文投影设计

## 1. 背景

当前 `requestAgentPlan()` 同时发送精简观察、记忆摘要和完整 `agent.stateSnapshot`。完整快照包含绝对坐标、实体 ID、玩家关系资料、地点 notes、任务参数和内部事件 payload。它适合本地 Web/MCP 调试，但不应默认进入任意 OpenAI-compatible 云端服务。

本设计只收窄云端 planner 输入，不修改 `agent.stateSnapshot`、Web 调试面板、MCP 返回结构或本地 Agent 黑板。[OpenAI 官方数据控制文档](https://platform.openai.com/docs/models/default-usage-policies-by-endpoint)说明 API 请求内容可能进入滥用监控日志，因此项目应在发送前执行数据最小化，而不是依赖具体提供商的保留策略。

## 2. 目标

- planner 仍能判断当前状态、资源、附近目标、任务、风险和近期生命周期事件。
- 默认不发送绝对坐标、实体 ID、原始玩家关系档案、自由文本 notes 和内部事件 payload。
- 新增状态字段默认不外发；只有显式加入投影白名单后才能进入请求。
- 投影函数不依赖 Mineflayer、网络或全局 Map，可通过离线单元测试验证。
- 保持 planner API base URL、模型、超时、prompt、返回解析和 MCP 契约不变。

## 3. 非目标

- 不删除或收窄本地调试快照。
- 不改变确定性 goal activation、Reactive Layer 或 Skill 执行逻辑。
- 不在本轮增加加密、供应商级数据保留配置或用户可编辑投影模板。
- 不统一 planner、闲聊和记忆总结的业务 prompt。

## 4. 接口

新增纯模块 `src/runtime/planner-context-projection.ts`：

```ts
export interface PlannerContextProjection {
  mode: string | null;
  runtimeState: string | null;
  self: PlannerSelfProjection;
  world: PlannerWorldProjection;
  nearbyPlayers: PlannerPlayerProjection[];
  nearbyEntities: PlannerEntityProjection[];
  task: PlannerTaskProjection;
  recentEvents: PlannerEventProjection[];
  memory: PlannerMemoryProjection;
}

export function buildPlannerContextProjection(
  snapshot: Record<string, unknown>
): PlannerContextProjection;
```

实现必须逐字段构造返回对象，不允许先复制完整快照再删除敏感键。

## 5. 字段白名单

### 自身状态

允许：

- movement 的 `isMoving`、`isFollowing`、`isPathfinding`、`onGround`
- vitals 的 `health`、`food`、`oxygenLevel`、`isHurt`、`isHungry`、`isCritical`
- 手持物名称/数量、护甲名称
- 背包空位、食物数量、最佳食物、物品汇总和工具布尔摘要
- `currentActivity.type`

禁止：绝对位置、旋转角、速度向量、槽位编号和包含路径坐标的 activity detail。

### 世界与目标

允许：维度、昼夜/天气、脚下与准星方块名称、目标名称、显示名、距离、可见性、威胁等级和危险标记。

禁止：所有 `position`、`x/y/z`、实体 ID、原始 focus targetPosition 和 pathfinder goal。

玩家只保留名称、距离以及由当前运行策略得出的 `isOwner` / `isWhitelisted`。不发送玩家 profile notes、tags、更新时间或自由文本关系描述。两个布尔值属于动作授权上下文，不代表情感或长期关系模型。

### 任务与事件

任务允许：type、status、source、goal、subTask type/status、risk level/reasons，以及明确白名单中的非坐标参数，例如 playerName、targetName、blockNames、searchRadius、maxBlocks、category、slot 和 mode。

禁止：taskId、targetId、goalKey、requester、时间戳和未知 params。

最近事件最多 8 条，只保留 type、priority、timestamp，以及 `taskType`、`status`、`goal`、`reason` 这类明确允许字段。禁止透传整个 payload、聊天原文、坐标和内部对象。

### 记忆

允许：owner 名称、whitelist 名称、自动空闲策略、战略目标及里程碑、玩家名称/alias、地点 label/dimension/tags、最近任务 type/status/goal。

禁止：地点坐标、玩家/地点 notes、lastSeenAt、updatedAt、完整聊天摘要和其他未知记忆字段。

## 6. 数据流

```text
buildAgentStateSnapshot()        本地完整快照
          |                         | 
          |                         +--> Web / MCP debug（保持完整）
          v
buildPlannerContextProjection()  字段白名单 + 数量上限
          |
          v
requestAgentPlan()               单个“规划上下文 JSON”消息
          |
          v
OpenAI-compatible transport
```

`requestAgentPlan()` 不再附加“完整状态 JSON”消息，也不能在投影失败时回退发送完整快照。投影函数应对缺失或类型错误字段使用 `null`、空对象或空数组，避免异常数据扩大外发范围。

## 7. 测试与验收

单元测试至少覆盖：

1. 正常快照保留规划所需字段。
2. 顶层和深层绝对坐标、实体 ID、notes、未知字段不会出现在序列化投影中。
3. 玩家仅保留动作授权布尔值，不透传 relation/tags/profile。
4. 任务 params 与事件 payload 使用白名单，未知键默认丢弃。
5. 玩家、实体、事件和记忆列表有固定上限。
6. 缺失、数组类型错误和非有限数值不会抛错或产生 `NaN` / `Infinity`。
7. `requestAgentPlan()` 请求体不再包含“完整状态 JSON”。

完成后运行定向测试、`npm test`、`npm run typecheck`、`npm run build` 和 `git diff --check`。真实游戏只需回归 planner 能继续生成跟随、停止、进食和采矿计划；投影本身可离线验收。

## 8. 兼容与回退

- 这是 planner 输入收窄，可能降低依赖自由文本 detail 或绝对坐标的长尾规划质量。
- 本地确定性地点移动继续使用完整本地记忆，不受云端投影影响。
- 若某个规划场景确实需要新字段，应先新增显式字段、测试和文档，而不是恢复完整快照。
- 不提供“发送完整状态”环境开关，避免隐私边界因临时调试长期失效。
