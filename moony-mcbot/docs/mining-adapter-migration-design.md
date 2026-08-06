# 采矿 ClientAdapter 迁移设计

## 1. 目的

将“接近已选中的方块并完成一次挖掘”收敛为客户端能力，避免高层编排继续直接操作 Mineflayer 的 pathfinder、方块对象、工具装备和 `bot.dig()`。

本方案不改变现有 MCP 工具名、参数或返回结构，也不扩展新的采矿玩法。可见方块扫描暂时仍由旧工具层负责，后续单独迁移。

## 2. 当前问题

以下四条路径重复实现了接近、等待、停止寻路、重新读取方块、视线检查、可挖检查、选工具和挖掘：

1. 战略目标触发的玩家附近可见矿清理。
2. Agent executor 的 `mine.collectVisible`。
3. MCP `mine.digNearestVisible`。
4. MCP `mine.collectVisible`。

重复实现使超时、错误文字和停止行为容易漂移，也让未来 Modded Client 必须模拟 Mineflayer 私有细节。

## 3. 已实现契约

已新增 additive capability `mine_block`，未删除或修改现有能力：

```ts
interface MineBlockInput {
  target: BlockSnapshot;
  reachDistance?: number;
  moveNear?: boolean;
  requireVisible?: boolean;
  visibleStep?: number;
  approachTimeoutMs?: number;
}

type MineBlockOutcome =
  | "mined"
  | "target_missing"
  | "target_changed"
  | "not_visible"
  | "cannot_dig"
  | "pathfinder_unavailable"
  | "approach_unreachable";

interface MineBlockResult extends ActionResult {
  outcome: MineBlockOutcome;
  block: BlockSnapshot;
  initialDistance: number;
  finalDistance: number;
  equippedTool?: string | null;
}
```

`ClientAdapter.mineBlock(input)` 完成一次原子动作：

1. 校验数值参数和预期方块名。
2. 必要时使用与普通移动相同的零破坏安全 profile 接近目标。
3. 在超时、到达或目标消失时停止本次寻路。
4. 重新读取目标坐标，拒绝挖掘已变化的方块。
5. 按配置检查视线和 `canDigBlock`。
6. 选择当前最快工具、看向方块中心并调用客户端挖掘能力。
7. 返回结构化 outcome，供单块和批量编排采取不同策略。

## 4. 兼容映射

现有 MCP 外部契约保持不变：

- `mined`：沿用当前成功返回和 task finished 生命周期。
- `target_missing` / `target_changed` / `not_visible` / `cannot_dig`：单块工具返回现有失败语义；批量工具跳过该目标并继续扫描。
- `pathfinder_unavailable` / `approach_unreachable`：单块工具失败；批量工具保留当前 stopReason 并结束循环。
- 未预期异常：保持 task failed，并由 Adapter 动作历史记录错误。

第一阶段已经只迁移 `mine.digNearestVisible` 的执行链。游戏内回归通过后，再依次迁移 MCP 批量采矿、Agent executor 和玩家附近清理。`mine.collectVisible` 后续接入 Tool Catalog 仅收敛 MCP 注册元数据，不代表这里描述的批量执行链已经迁移。

## 5. 寻路安全与不可达反馈

迁移前的 `mining` profile 实际使用 `mineflayer-pathfinder` 的默认 `Movements`，没有项目级约束。官方文档说明默认 `canDig = true`，而 pathfinder 同时支持挖掘和放置方块。该行为不符合项目需要，因此本轮也把仍在使用旧链路的 `mining` profile 收紧为零破坏配置。

确认后的统一规则：

- 所有寻路都使用零破坏安全 profile：不能挖路、搭路、搭柱或放脚手架。
- 采矿只允许在到达可触及位置后显式挖掘 `MineBlockInput.target` 指定的目标方块。
- `path_update` 返回 `noPath` / `timeout`、总接近超时，或规划路径长度超过 `max(24, 直线距离 * 2.5)` 时，返回 `approach_unreachable`。
- Adapter 不直接聊天。跟随玩家或响应玩家指令的上层收到该结果后，只回复一次“我跟不上你啦”。

这是明确的安全收紧：依赖破坏或搭建世界才能到达的目标将被拒绝，不再尝试修改沿途环境。

`mining` 名称暂时保留用于兼容旧调用方，但不再代表拥有挖路或放置方块权限。显式目标挖掘只能由 `mineBlock` 或旧采矿链到达后调用的单次 `dig` 完成。

## 6. 测试顺序

1. `pathfinder-movement-profile`：采矿接近同样禁止挖掘、搭建和危险移动。
2. `mining-approach`：覆盖 noPath、timeout、路线长度阈值和正常路径。
3. `client-adapter-mining`：覆盖成功、目标消失、方块变化、不可见、不可挖、pathfinder 不可用和接近不可达。
4. `client-adapter-conformance` / `client-adapter-status`：覆盖方法、capability 和动作证据。
5. `mine.digNearestVisible` 试点：验证 MCP 返回、Agent task 生命周期和原有错误文字。
6. 游戏内回归通过后，再迁移三个批量入口。

### 6.1 旧扫描链类型边界

可见方块扫描、`GoalNear` 接近、位置等待和三个批量入口仍保留原执行位置与语义，但已经改用 Mineflayer Bot/Block、Pathfinder、Movements 和普通坐标窄类型。Movements 缓存改为按 bot 实例持有的 `WeakMap`，不再给 Mineflayer Bot 动态挂载私有字段。

`mineflayer-mining.ts` 的旧窄客户端与 Mineflayer 4.33 的 effects/digTime 类型仍有偏差；当前只在射线和工具选择两个局部桥接点转为 `unknown`，后续应拆出只描述射线所需字段的接口。该类型整理没有迁移扫描 capability，也没有改变扫描半径、数量、排序、射线步长、接近超时或批量采矿停止原因。

## 7. 暂不处理

- 不迁移可见方块扫描和射线算法。
- 不实现洞穴探索、矿脉规划、照明、回家或背包满处理。
- 不改变采矿队列串行化。
- 不实现 Modded Client 的实际挖掘后端。
- 不让 LLM 直接控制高频采矿 tick。
