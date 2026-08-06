# Tool/Skill Catalog 收敛设计

## 1. 目的

让 MCP 工具 ID、Agent 默认 allowlist、Skill 编译目标和可共享展示元数据逐步收敛到可校验的事实源，减少字符串漂移，同时不把所有业务执行代码塞进一个巨型注册表。

本设计不重命名现有 MCP 工具，不改变输入参数、返回结构、错误语义或持久化配置。第一阶段只处理当前新 bot 默认启用的 17 个 Agent 工具。

## 2. 当前重复来源

项目目前存在四类相关但不相同的定义：

1. `action-tools.ts` 与 `bot-tools.ts` 通过 `server.tool(...)` 注册 MCP 名称、描述、Zod shape 和 handler。
2. `getOrCreateAgentConfig()` 单独维护默认 `allowedTools` 字符串数组。
3. `skill-catalog.ts` 把 `StrategicAction` 编译成字符串形式的 `SkillInvocation.skill`。
4. Web 面板维护快捷动作模板和 Adapter action 中文标签。

其中前 3 类存在真实一致性约束：默认 allowlist 和 Skill 编译目标必须对应可执行 MCP 工具。第 4 类包含 Web endpoint 与 Adapter action，它们不等于 MCP 工具，不能只因名称相似就强行合并。

## 3. 官方协议约束

MCP 工具定义天然包含唯一 `name`、可读 `title`、`description`、`inputSchema`、可选 `outputSchema` 和行为 annotations。SDK 使用输入 schema 在 handler 运行前校验参数。

因此 Catalog 应保存项目需要跨入口复用的稳定元数据和暴露策略；Zod schema 与 handler 仍由领域模块所有。后续迁移某个工具时，可以由薄注册函数组合 Catalog 元数据、领域 schema 和领域 handler，但不在第一阶段批量改写注册代码。

## 4. 第一阶段数据模型

```ts
type ToolDomain =
  | "observe"
  | "mine"
  | "movement"
  | "combat"
  | "chat"
  | "inventory"
  | "interaction";

type ToolRisk = "read" | "write" | "destructive";
type ToolAudience = "agent" | "developer" | "web";

interface ToolCatalogEntry {
  id: string;
  title: string;
  description: string;
  domain: ToolDomain;
  risk: ToolRisk;
  audiences: readonly ToolAudience[];
  defaultAgentAllowed: boolean;
}
```

实现时以 `as const satisfies readonly ToolCatalogEntry[]` 保留工具 ID 字面量类型，并提供：

- `getToolCatalogEntry(id)`：读取元数据。
- `getDefaultAgentToolIds()`：生成新 bot 的默认 allowlist。
- `assertToolCatalogIntegrity()`：启动或测试时检查重复 ID 和非法策略组合。
- `isAgentToolId(id)`：供 Skill 编译目标与执行器校验。

`defaultAgentAllowed: true` 必须同时包含 `agent` audience。破坏性工具可以允许 Agent 使用，但必须显式标记，不能靠名称推断风险。

## 5. Skill Catalog 关系

Skill Module 与 Tool Catalog 不合并：

- Skill Module 决定某个战略动作是否可执行、评分、tick 频率以及如何编译。
- Tool Catalog 描述编译结果指向的工具是什么、面向谁、风险等级和默认是否开放。
- 测试遍历默认 Skill Catalog 的可编译样例，确认每个 `SkillInvocation.skill` 都已登记且允许 Agent 使用。

这保持 `StrategicAction -> SkillInvocation` 的现有职责，也避免 MCP 工具注册反向依赖 Agent 黑板类型。

## 6. 兼容与迁移策略

### 阶段 A：metadata-only

1. 登记当前 17 个默认 Agent 工具。
2. 新 bot 的默认 `allowedTools` 改由 `getDefaultAgentToolIds()` 生成。
3. 已持久化的 `allowedTools` 保持原样恢复，不因 Catalog 缺项被静默删除。
4. 增加 Catalog、allowlist 和 Skill 引用的离线测试。

### 阶段 B：只读注册试点

选择 `observe.self` 等只读工具，将其改为通过薄包装注册。工具名称、描述、schema、handler 和返回内容保持兼容，并对注册前后的工具清单做快照测试。

### 阶段 C：按领域迁移

依次迁移 observe、inventory、movement、interaction、combat 和 mining。高风险工具在 Catalog 中补充 MCP annotations，并让 Web 在确有同一 MCP 工具入口时读取标题和风险。

## 7. 明确不做

- 不在第一阶段迁移全部 MCP 注册。
- 不把 handler、Agent 编译逻辑和 Web endpoint 全部放进一个文件。
- 不把 `mine_block` 这类 Adapter capability 当成 MCP 工具 ID。
- 不把 `set-goal` 这类 Web 快捷 endpoint 当成 MCP 工具 ID。
- 不自动清理用户持久化的未知 `allowedTools`，只在执行时沿用现有拒绝与错误机制。
- 不升级 MCP SDK v2 alpha，也不改变当前 SDK v1 的注册方式。

## 8. 验收条件

1. 17 个默认 Agent 工具由 Catalog 按既有顺序生成，重启后的默认行为不变。
2. 重复 ID、`defaultAgentAllowed` 与 audience 冲突会被测试捕获。
3. 默认 Skill Catalog 编译出的工具全部存在且允许 Agent 使用。
4. 自定义持久化 allowlist 不被过滤、重排或覆盖。
5. `npm run typecheck`、`npm test`、`npm run build` 和 `git diff --check` 通过。
6. 第一阶段不改变 MCP Inspector 中的工具数量、名称、schema 或返回。

## 9. 当前实施状态

阶段 A 的 metadata-only Catalog 已实现：

- `src/catalog/tool-catalog.ts` 登记并校验原有 17 项默认 Agent 工具。
- 新 bot 的默认 `allowedTools` 由 Catalog 按原顺序生成。
- 持久化 allowlist 继续保留未知自定义值、原顺序和显式空数组。
- MCP 工具注册、参数 schema、handler 与 Web action 均未改动。

实施时发现默认 Skill Catalog 还会编译到 4 个不在原默认 allowlist 中的工具：`interact.attackPlayer`、`interact.eat`、`movement.walk`、`player.look`。这属于已有策略缺口。阶段 A 不静默扩大默认 Agent 权限；待明确哪些能力应默认开放后，再登记并收紧 Skill 编译类型。

阶段 B 已完成第一个只读注册试点：

- `observe.self` 通过 `registerAgentCoreTool()` 读取 Catalog 中的名称和描述。
- 薄包装继续调用 SDK v1 的 `server.tool(name, description, shape, handler)` overload，避免首个试点同时改变注册元数据形态。
- 测试直接检查 SDK 最终注册对象中的名称、描述、Zod 约束、annotations 和 handler，并确认没有额外 title。
- `observe.self` 的业务 handler 未改。

阶段 C 已完成 Agent 核心目录内的 Observe 子域迁移：

- `observe.nearbyPlayers`、`observe.nearbyEntities`、`observe.inventory` 已复用同一个薄注册包装器。
- Catalog 描述固定为迁移前的 MCP 对外文案，三个工具的名称、输入 schema、默认值、handler、返回结构、title 和 annotations 均不变。
- `observe.blocks` 不属于现有 17 项默认 Agent allowlist，因此本轮不扩充 Catalog 或默认权限；它继续使用原注册入口。
- 注册契约测试逐项覆盖四个已迁移工具，并校验半径默认值、可选参数和错误输入。

阶段 C 已继续完成 Agent 核心目录内的 Inventory 子域迁移：

- `inventory.holdByCategory`、`inventory.organizeHotbar` 已复用 Catalog 注册包装器。
- 两个工具继续标记为 `write` 风险；旧 MCP 描述、类别枚举、handler、返回结构、title 和 annotations 均保持不变。
- `inventory.holdSlot` 不属于现有 17 项默认 Agent allowlist，因此继续使用原注册入口，本轮不扩充 Catalog 或默认权限。
- 注册契约测试覆盖合法类别、非法类别和空 botId；快捷栏整理的领域规划测试继续独立保留。

阶段 C 已继续完成现有 MCP Movement 子域迁移：

- `move.followPlayer`、`move.stopFollow` 已复用 Catalog 注册包装器，并继续标记为 `write` 风险。
- follow 的距离、tick 和静止超时默认值以及可选 sprint 参数均保持不变；业务 handler、返回、title 和 annotations 未改。
- `move.goToPosition` 虽属于 17 项 Agent 默认 allowlist，但当前只通过 Agent executor 与 Web Raw Action Runner 执行，没有同名 MCP 注册。本轮不新增公共 MCP 工具。
- Catalog 条目表示 Agent 可识别的工具元数据，不自动等同于已向 MCP 客户端暴露。

阶段 C 已继续完成 Agent 核心 Interaction 子域迁移：

- `interact.dropHeld`、`interact.dropHotbarSlot`、`interact.openDoor` 已复用 Catalog 注册包装器。
- 两项丢弃工具继续标记为 `destructive`，开门继续标记为 `write`；Catalog 风险没有转换成新的 MCP annotations，因此客户端可见注册契约不变。
- 手持丢弃模式、快捷栏槽位范围、恢复原槽位默认值以及开门 reach/radius 默认值均由契约测试固定。
- 业务 handler 和 Adapter 动作入口未改，本阶段不代表新增操作确认或游戏行为变化。

阶段 C 已继续完成现有 MCP Chat 子域迁移：

- `chat.send` 已复用 Catalog 注册包装器，并继续标记为 `write` 风险。
- 它保留可省略且会 trim 的 botId，以及必填非空 message；发送 handler、返回、title 和 annotations 未改。
- `chat.requestTeleportToPlayer` 是 Agent executor 与聊天硬规则使用的内部执行 ID，没有同名 MCP 注册，本轮不新增公共工具。
- `chat.sendVerified` 是 Catalog 外的独立 MCP 工具，继续使用原注册入口。

阶段 C 已继续完成现有 MCP Combat 子域迁移：

- `combat.prepareBattle`、`combat.challengeEntity` 已复用 Catalog 注册包装器。
- 战斗准备继续标记为 `write`，实体挑战继续标记为 `destructive`；Catalog 风险没有转换成新的 MCP annotations。
- `challengeEntity` 的目标文本、16 格默认距离、32 格上限和默认 requester 均由注册契约测试固定。
- 装备选择、目标匹配、决斗状态机、攻击执行、handler 返回、title 和 annotations 均未改。

阶段 C 已继续完成 Agent 核心 Catalog 内的 Mining MCP 注册迁移：

- `mine.collectVisible` 已复用 Catalog 注册包装器，并继续标记为 `destructive` 风险。
- 方块名数组、搜索半径、数量、触及距离、移动开关、可见步长和接近超时的约束及默认值均由契约测试固定。
- `mine.digNearestVisible` 不在现有 17 项核心 Catalog 中，继续使用原注册入口，本轮不扩大目录或默认权限。
- 批量采矿 handler 仍是原生 Mineflayer 实现；本轮不代表其 Adapter 迁移或游戏内验收已经完成。

默认 Skill 权限审计基线已经建立：

- 每个 Skill Module 显式声明可能编译到的 `toolDependencies`，测试覆盖条件编译分支。
- 纯审计函数固定报告 `interact.attackPlayer`、`interact.eat`、`movement.walk`、`player.look` 四项既有缺口。
- `interact.eat`、`player.look` 与 `movement.walk` 的 Agent dispatcher 已补齐，但默认权限仍关闭；`interact.attackPlayer` 仍缺 dispatcher。`player.look` 只接受完整有限角度；`movement.walk` 不再隐式转换 planner 类型，并保证限时停止，但仍因缺少地形前视/落差保护而不适合默认开放。
- 逐项启用门槛和风险拆分见 [Skill 工具权限策略](skill-permission-policy.md)。

后续若切换到 `registerTool()` 并开始输出 title / annotations，应作为单独的可见元数据变更处理，不与领域批量迁移混在一起。
