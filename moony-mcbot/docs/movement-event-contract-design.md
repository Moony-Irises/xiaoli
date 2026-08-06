# 持续移动事件契约设计

## 目标

让定点移动和实体追击在首轮安全路径已经接受后，仍能处理世界变化导致的 `noPath`、`timeout` 或明显长绕行。失败必须停止移动、留下后台证据，并且只能终止产生该事件的任务。

本设计只覆盖 Pathfinder 驱动的 `moveTo()` 与 `pursueEntity()`。直接控制状态的 `movement.walk`、采矿接近和未来 Modded Client Bridge 不在本轮实现范围。

## 为什么需要关联 ID

`path_update` 是 Mineflayer 全局事件，不携带上层任务身份。跟随目标移动时会频繁替换动态目标；如果只按动作类型消费失败，旧目标的迟到事件可能停止新目标。

调用方因此为每次移动传入 `movementId`，Adapter 将同一 ID 原样放入后续事件。上层只消费与当前缓存 ID 相等的事件。

## Additive 公共契约

计划为移动输入增加可选字段，不修改现有必填字段：

```ts
interface MoveToInput {
  x: number;
  y: number;
  z: number;
  stopRadius?: number;
  movementId?: string;
}

interface PursueEntityInput {
  entityId: number;
  stopDistance?: number;
  sprint?: boolean;
  jump?: boolean;
  movementId?: string;
}
```

计划新增一个判别联合事件和订阅入口：

```ts
type ClientMovementAction = "move_to_position" | "pursue_entity";

interface ClientMovementFailedEvent {
  type: "movement_failed";
  movementId: string;
  action: ClientMovementAction;
  reason:
    | "pathfinder_unavailable"
    | "goal_rejected"
    | "no_path"
    | "path_timeout"
    | "detour_too_long";
  detail: string;
}

type ClientMovementEvent = ClientMovementFailedEvent;
type ClientMovementEventHandler = (event: ClientMovementEvent) => void;

interface ClientAdapter {
  subscribeMovementEvents(handler: ClientMovementEventHandler): () => void;
}
```

`movementId` 缺省时由 Adapter 生成，仅用于后台证据；需要关联任务的上层调用必须显式传入。显式值会去除首尾空白，并拒绝空字符串、换行或过长输入。

## 数据流

1. 上层生成当前任务唯一的 `movementId`，调用 `moveTo()` 或 `pursueEntity()`。
2. Adapter 在 `setGoal()` 前注册监听并等待首轮完整路径。
3. 首轮失败仍以 `SafePathError` 拒绝 Promise，不额外发送事件，避免双重处理。
4. 首轮成功后 Promise 正常返回，监听转入持续阶段。
5. 持续阶段发现安全失败时，Adapter 先清空目标和控制状态，再清理监听，最后只发送一次 `movement_failed`。
6. `BotRuntime` 转发事件，并将异步失败记录为一条失败的 Adapter action history。
7. 定点移动、跟随或决斗仅在事件 ID 等于当前任务 ID 时结束任务；跟随只发送一次“我跟不上你啦”。

## 生命周期与边界

- 新目标：静默取消旧监听，不发送失败事件。
- 主动停止：静默取消监听，不发送失败事件。
- 到达目标：由现有上层位置轮询结束并调用停止；本轮不新增 `movement_reached`。
- 断线或清空 bot：卸载监听，不发送失败事件。
- 首轮成功后的 `partial`：继续等待；若路线长度已超过安全阈值，则按长绕行失败。
- 动态实体目标：每次评估读取实体当前位置，不固定使用首次调用时的位置快照。
- 事件处理器异常：不得阻止其他处理器或破坏 Adapter 清理。
- 同一失败：每个 `movementId` 最多发送一次。

## 兼容性

- 不修改 MCP 工具参数、Tool Catalog、Planner allowlist 或 Web Raw Action schema。
- 不修改现有 `ActionResult` 结构，也不改变首轮失败通过 Promise 报告的行为。
- `movementId` 和 `subscribeMovementEvents()` 都是 additive TypeScript 接口变更，但所有 `ClientAdapter` 实现与 conformance tests 必须同步更新。
- Modded Client Adapter 尚未实现；未来实现必须产生同一标准化事件，而不是暴露客户端私有错误。

## 测试顺序

1. 契约测试：方法存在、未连接订阅返回可重复调用的取消函数。
2. Adapter 测试：首轮成功后再触发 `noPath`、`timeout`、长绕行，确认停止和单次事件。
3. 生命周期测试：新目标、主动停止、断线均清理旧监听且不发失败事件。
4. 关联测试：旧 `movementId` 事件不能停止新的定点移动、跟随或决斗。
5. Runtime 测试：事件转发一次，action history 只保留一条对应失败证据。
6. 游戏回归：普通绕障、无法上坡、目标移动后封路、停止后不复走。

## 实施状态

上述 additive `ClientAdapter` 契约已确认并实现。离线测试覆盖契约、首轮与持续失败、动态目标位置、处理器隔离、监听清理、Runtime 单次证据和关联路由；真实服务器中的途中封路行为仍按手动测试指南待验收。本轮未扩展成功、进度或到达事件。
