# 整合包客户端适配改造方案

## 1. 目标

当前落地状态：`BotRuntime` 已通过 `ClientAdapter` Factory 创建 Mineflayer adapter，公共 `ClientAdapter` 契约不再暴露原生 Mineflayer bot 句柄；旧的 `BotRuntime.getActiveBotOrThrow()` 仍作为迁移期间兼容出口。Modded Client Bridge 尚未实现。

当前项目的高层目标已经不是“让 bot 能连上服务器”，而是维护一个可持续演进的具身智能体框架：

- 高层：LLM 低频策略、goal、milestone、repair、memory
- 中层：event bus、runtime、blackboard、trace、state snapshot
- 低层：具体动作技能（follow / mine / inventory / territory / container）

现在要解决的新问题是：

> 让小狸不只玩原版/协议兼容服，而是能和真人一起进入需要同款整合包客户端的环境。

目标场景：

- 本地同时启动两个整合包客户端
- 一个由玩家操控
- 一个由“小狸”操控
- 两者进入同一个整合包世界

这要求小狸不再只是一个协议层 bot，而是一个真正运行模组客户端的“玩家实例”。

## 2. 为什么现有路线不足以支持整合包

当前底层接入建立在以下事实之上：

- `McClientService` 直接调用 `mineflayer.createBot(...)`
- `BotRuntime` 直接持有 `mineflayer.Bot`
- 上层技能通过 `BotRuntime.getActiveBotOrThrow()` 获取活动 bot
- 很多能力默认假设“世界状态和动作控制都来自 mineflayer API”

这种路线的优点：

- 原版协议自动化成熟
- 可读可控
- 适合服务端插件环境
- 非常适合作为当前 agent 原型的下层执行器

但它有明确边界：

1. 它不是完整 Minecraft 客户端
- 不加载 Forge / Fabric / NeoForge 整合包
- 不存在模组 GUI、机器界面、自定义 HUD、JEI 等真实客户端状态

2. 它不天然理解模组自定义协议与自定义网络通道
- 某些整合包服务器要求客户端参与自定义握手、频道同步、数据包交互
- 单纯协议 bot 很容易在这里失配

3. 它无法保证拥有“客户端视角”的全部信息
- 当前屏幕/容器/槽位点击上下文
- 某些模组物品/方块的 NBT 或能力系统
- 某些必须通过客户端逻辑维护的交互状态

因此：

> 现有 mineflayer 路线适合“原版/协议兼容自动化”，不适合直接承担“完整整合包客户端玩家”的角色。

## 3. 现有系统中哪些部分可以保留

这次改造不应该推倒重来。

### 可以保留的层

1. **Strategic Layer**
- `agent.configure`
- `agent.goal.*`
- `agent.runOnce`
- strategic pass / repair / lifecycle

2. **Runtime / Event / Blackboard 思路**
- `src/agent/`
- `agent.framework.status`
- `agent.trace.summary`
- `agent.events.tail`
- `agent.stateSnapshot`

3. **记忆与关系层**
- `memory.player.*`
- `memory.place.*`
- `memory.status`

4. **业务模块**
- territory
- container logistics
- social policy
- report / milestone / task lifecycle

这些都属于“上层语义与调度能力”，并不依赖底层一定是 mineflayer。

### 必须改造或抽象的层

1. `McClientService`
2. `BotRuntime` 内部对 `mineflayer.Bot` 的持有方式
3. 大量直接读取 `mineflayer` 细节的技能实现
4. 观察工具与交互工具的底层数据来源

## 4. 目标架构：Client Adapter Layer

下一阶段应把“bot 底层接入”抽象成一层统一客户端适配器，而不是继续让 runtime 直接依赖 mineflayer。

```text
+------------------------------------------------------+
| Strategic / Reactive / Executive / Memory            |
| - goals, milestones, repair, events, container, etc. |
+------------------------------------------------------+
| Client Adapter Layer                                 |
| - unified capabilities                               |
| - state snapshots                                    |
| - actions / interactions                             |
+------------------------------------------------------+
| Concrete Adapters                                    |
| - MineflayerAdapter                                  |
| - ModdedClientAdapter (future)                       |
+------------------------------------------------------+
| Transport / Runtime                                  |
| - mineflayer / minecraft-protocol                    |
| - companion mod + local bridge                       |
+------------------------------------------------------+
```

核心原则：

- 高层只面向“能力”，不面向 mineflayer 细节
- 底层具体由哪个客户端实现，不影响 goal / event / memory 框架
- `MineflayerAdapter` 继续承担原版路线
- `ModdedClientAdapter` 承担未来整合包路线

## 5. 建议的统一能力接口

下面不是最终代码，而是推荐的抽象边界。

### 5.1 Runtime-facing 基础能力

```ts
interface ClientAdapter {
  readonly kind: "mineflayer" | "modded-client";

  connect(config: ClientConnectConfig): Promise<void>;
  disconnect(reason?: string): Promise<void>;
  getConnectionState(): ClientConnectionState;

  getSelfState(): Promise<SelfStateSnapshot>;
  getInventoryState(): Promise<InventorySnapshot>;
  getNearbyPlayers(radius?: number): Promise<PlayerSnapshot[]>;
  getNearbyEntities(radius?: number): Promise<EntitySnapshot[]>;
  getVisibleBlocks(query?: VisibleBlockQuery): Promise<BlockSnapshot[]>;
  subscribeEntityEvents(handler: ClientEntityEventHandler): () => void;

  followPlayer(input: FollowPlayerInput): Promise<ActionResult>;
  stopFollow(): Promise<ActionResult>;
  moveTo(input: MoveToInput): Promise<ActionResult>;
  lookAt(input: LookAtInput): Promise<ActionResult>;

  attack(input: AttackInput): Promise<ActionResult>;
  attackEntity(input: AttackEntityInput): Promise<ActionResult>;
  pursueEntity(input: PursueEntityInput): Promise<ActionResult>;
  useHeldItem(input?: UseItemInput): Promise<ActionResult>;
  eat(): Promise<ActionResult>;
  openDoor(input?: OpenDoorInput): Promise<ActionResult>;

  sendChat(message: string): Promise<ActionResult>;

  openContainer(input: OpenContainerInput): Promise<ContainerSession>;
}
```

当前持续决斗已明确依赖稳定 `entityId`：目标快照、追击动作、攻击动作和死亡事件必须使用同一实体标识。未来 `ModdedClientAdapter` 不能用“每次重新选择最近实体”近似实现，否则会在多个同类生物之间切换目标。

### 5.2 为什么这样划分

因为这组接口覆盖了现在上层真正关心的东西：

- 自己是谁、在哪、状态如何
- 周围有什么
- 能否移动/跟随/攻击/交互
- 能否打开容器并操作槽位

高层不需要知道：

- 这是不是 mineflayer bot
- 这是 GUI click 还是协议包
- 背后是 WebSocket 还是本地 mod

## 6. `MineflayerAdapter` 应扮演什么角色

它不是要被废弃，而是要被“降级”为一个 adapter 实现。

### 责任

- 继续支持原版/协议兼容服务器
- 继续为现有动作技能提供默认执行后端
- 作为 `ClientAdapter` 的第一实现

### 价值

- 现在已经可用的 follow / mine / territory / container 不需要立即丢弃
- 后续重构时，可以用 `MineflayerAdapter` 做回归基线
- 整合包路线失败时，也保留一条成熟 fallback

## 7. `ModdedClientAdapter` 应该怎么实现

最推荐的路线不是“让 Node 直接控制整合包 JVM 客户端内部”，而是：

## **Companion Mod + Local Bridge**

### 7.1 结构

在“小狸专用整合包客户端”里安装一个 companion mod，它负责：

1. 从真实客户端采集状态
- 玩家状态
- 背包
- 附近实体
- 当前容器/GUI
- 部分模组状态

2. 接收本地控制命令
- 移动
- 转头
- 攻击
- 使用物品
- 点击 GUI 槽位
- 发送聊天

3. 通过本地桥接协议与 Node agent 通信

桥接协议可以选：

- `WebSocket`
- 本地 `HTTP`
- `Named Pipe`
- 本地 TCP

第一版最简单的是：
- `WebSocket` 或本地 `HTTP + SSE`

### 7.2 为什么 companion mod 是正确路线

因为它天然拥有：

- 完整模组客户端上下文
- 所有真实 GUI 状态
- 整合包里安装的所有客户端 mod 能力
- 最接近真人玩家的输入/观察通道

## 8. Modded Client MVP 范围

第一阶段不要追求“能玩所有整合包内容”，只追求证明这条路能跑通。

### MVP 能力

#### 读状态
- 自己的位置 / 朝向 / 维度
- 血量 / 饱食 / 生命状态
- 当前手持
- 背包物品列表
- 附近玩家 / 实体

#### 发动作
- 基础移动
- 停止移动
- 转头
- 左键攻击
- 右键使用
- 发聊天

### 先不做

- 复杂机器 GUI
- 自动合成链
- 模组多方块结构识别
- 高级战斗微操
- 完整 pathfinder 替换

这样做的目标是：

> 尽快证明“小狸能作为真实整合包客户端进入世界，并完成基本跟随/观察/说话/简单交互”。

## 8.5 Pack Profile / Mod 列表识别

在真正“会玩 mod”之前，系统需要先知道当前到底进入了什么整合包环境。

### 目标

第一次进入某个整合包环境时，建立一个可缓存的 `PackProfile`：

```ts
type PackProfile = {
  packId: string;
  packDisplayName?: string;
  mcVersion: string;
  loader: "forge" | "fabric" | "neoforge" | "unknown";
  loaderVersion?: string;
  modSetHash: string;
  mods: Array<{
    id: string;
    version?: string;
    displayName?: string;
  }>;
};
```

### 为什么这一步很关键

因为后续所有与整合包相关的知识缓存、容器识别、recipe 理解，都不该只挂在“世界名字”或“服务器地址”上，而应该挂在：

- 当前 MC 版本
- 当前 loader
- 当前 mod 列表

也就是：

> 先识别“我在玩哪一个包”，后面才能缓存“这个包里有哪些 mod、这些 mod 大概做什么、我已经学会了什么”。

## 8.6 Mod Encyclopedia Layer（整合包百科层）

这层的目标不是立刻让小狸“会玩 mod”，而是先让她在第一次进入一个整合包时，能建立一个可检索的百科缓存。

### 推荐数据来源优先级

1. CurseForge / CurseForge API
2. Modrinth / Modrinth API
3. MCMOD（中文说明优先）
4. 官方 Wiki / GitHub README

### 每个 mod 建议缓存的信息

```ts
type ModKnowledgeEntry = {
  modId: string;
  displayName?: string;
  summary: string;
  categories: string[];
  workstations?: string[];
  containerTypes?: string[];
  commonItems?: string[];
  sourceLinks: {
    curseforge?: string;
    modrinth?: string;
    mcmod?: string;
    wiki?: string;
  };
};
```

### 这一层当前定位

现阶段它更像一个“百科全书”，而不是“技能系统”。

也就是说：

- 现在先允许它回答“这个 mod 是做什么的”
- 先允许 planner / social layer 利用这些知识做解释与描述
- 暂时不要求它已经能执行这些工序

这一步虽然保守，但很重要。因为后面如果没有这层知识缓存，系统就很难稳定地进入“会玩某个 mod”的阶段。

## 8.7 Mod Capability Index（模组能力索引）

这是从“百科”走向“可执行技能”的桥梁层。

目标不是只知道某个 mod 的介绍，而是知道：

- 哪些方块/物品是容器
- 哪些交互对象本质上提供 inventory capability
- 哪些是工作站
- 哪些有 recipe / processing 行为

### 典型能力分类

1. **Container Capability**
- 普通箱子类容器
- 多格大容器
- 模组箱子 / 木桶 / 保险库 / 储物箱
- 地上的背包 / 便携存储
- 机器输入输出槽

2. **Workstation Capability**
- 烹饪台 / 切菜板 / 锅
- 机器 processing block
- 模组 crafting station
- 特殊终端 / 存储终端

3. **Recipe Capability**
- 配方读取
- 工序顺序
- 替代材料
- 中间产物

### 为什么容器能力抽象很重要

后面我们不应该为每一个 mod 容器都写独立逻辑。

正确路线是：

- 先抽象“它是不是一个能读写物品槽位的对象”
- 再只为少数复杂对象做特化

这样未来像下面这些都能被统一纳入同一层：

- 机械动力保险库
- Sophisticated Storage / Sophisticated Backpacks
- 模组箱子、木桶、柜子
- 放在地上的背包

## 8.8 从“知道 mod”到“会玩 mod”的能力分层

后期真正要做到“会玩某个 mod”，不能只靠百科信息，需要至少四层能力叠加：

1. **Mod Knowledge**
- 这个 mod 做什么
- 常见工作站、容器、物品是什么

2. **Recipe / Process Graph**
- 目标物品怎么做
- 需要哪些原料
- 工序顺序是什么

3. **Logistics**
- 材料在哪
- 从哪个容器取
- 成品放哪

4. **GUI / Interaction Execution**
- 打开界面
- 槽位点击
- 放置 / 取回
- 失败恢复

也就是说，后面“会玩 Farmer’s Delight 做菜”本质上是：

> mod knowledge + recipe graph + workstation interaction + logistics

而不是某个单一按钮或工具。

## 9. 对现有模块的迁移顺序建议

### 阶段 A：先抽象，不新增整合包能力

目标：
- 不改变当前功能对外表现
- 只是把 mineflayer 细节从 runtime 边界里抽出去

任务：

1. 定义 `ClientAdapter` 类型与快照模型
2. 实现 `MineflayerAdapter`
3. 让 `BotRuntime` 持有 adapter，而不是直接持有 `mineflayer.Bot`
4. 让状态查询和基础 observe 走 adapter 能力

### 阶段 B：让高频技能逐步改走 adapter

任务：

1. `follow / stop follow`
2. `move / look / chat`
3. `eat / attack / use item`
4. `inventory / open door / visible observe`

目标：
- 让最关键链路先脱离直接 mineflayer 依赖

### 阶段 C：做 Modded Client Bridge MVP

任务：

1. companion mod 原型
2. 本地 bridge 协议
3. `ModdedClientAdapter` 雏形
4. 跑通：
   - connect
   - self state
   - nearby players
   - send chat
   - simple movement

### 阶段 D：再接复杂后勤与 GUI

任务：

1. container session 抽象
2. slot click / transfer
3. remembered place + storage 流程迁移
4. territory / battle / mining 行为逐步适配

### 阶段 E：建立 Pack Knowledge 与 Mod Skill Pack

任务：

1. 读取 mod 列表并建立 `PackProfile`
2. 做整合包百科缓存（CurseForge / Modrinth / MCMOD）
3. 建立 `ModCapabilityIndex`
4. 为单个 mod 设计专门的 skill pack

推荐第一个目标 mod：

- `Farmer's Delight`
  - 适合验证 recipe 工序和工作站交互
- 或 `Sophisticated Storage`
  - 适合验证统一容器能力抽象

不建议第一个就上 `Create`

因为它的系统跨度太大，不适合作为第一条“会玩 mod”的验证链。

## 10. 对当前调试方式的影响

如果走整合包客户端路线，MCP 不应继续承担主要调试入口。

更适合的调试结构是：

1. **项目自带 Web 调试面板**
- 看 bot / agent / goal / events / memory
- 当前已显示 adapter 类型、连接快照和已声明能力支持表
- 后续在 bridge 落地后增加 bridge 连接、GUI、事件与 action queue 状态

2. **Scenario Runner**
- 跑 follow / report / container 之类固定场景

3. **MCP**
- 保留给外部客户端和日常操作
- 不再承担主要底层诊断职责

未来调试面板建议新增：

- 当前 adapter 类型（已实现）
- bridge 连接状态
- 客户端当前 GUI / screen
- 最近 bridge events
- 最近 adapter actions（Mineflayer 基线已实现；bridge action queue 仍待实现）
- 当前 pack profile
- 当前已识别 mod 列表
- 当前百科缓存命中情况
- 当前 capability index 命中情况

## 10.5 Model Role Split（云端 / 本地模型 / 本地代码分工）

随着整合包能力和任务复杂度上升，单纯把所有决策都压给云端 API 会越来越不划算，也不稳定。

更推荐的长期结构是：

### 1. 云端大模型

负责高价值、低频、复杂推理任务：

- 长期目标生成
- milestone 规划
- 失败后 repair / replan
- 复杂 recipe / 工序理解
- 复杂多步资源调度

这部分贵，但价值最高，应该把预算花在这里。

### 2. 本地小模型

负责便宜但需要一点语义能力的任务：

- 社交聊天
- 场景短句
- 轻量任务解释
- 整合包百科问答
- 对 mod 简介、工作站用途、物品说明做本地知识检索增强

这部分适合后续逐步本地化，用来减少闲聊和轻量问答的云端消耗。

### 3. 本地代码与规则

负责绝大多数高频、可确定执行的任务：

- follow / move / stop / attack / eat
- territory / self-guard / reactive rules
- container / inventory / logistics
- GUI 点击与工作站交互执行
- 事件收集、状态快照、memory 维护

也就是说：

> 复杂思考走云端，轻量解释走本地模型，明确执行走本地代码。

这是后续成本与稳定性最优的分工。

## 11. 现阶段结论

当前项目并没有走错路。

更准确的说法是：

- **高层智能体框架已经成型**
- **底层仍然只覆盖了“原版协议客户端”这一种执行载体**

所以现在最正确的下一步，不是继续给 mineflayer 线堆更多整合包玩法，而是：

> 先把底层执行层改造成“可插拔客户端适配器”，再为真实整合包客户端接一条新的后端。

## 12. 推荐的下一个实际任务

按优先级：

1. 定义 `ClientAdapter` 与统一快照/动作类型
2. 让 `BotRuntime` 改为持有 adapter
3. 实现 `MineflayerAdapter`
4. 跑通 follow / status / chat 的 adapter 化回归
5. 再开 companion mod MVP 文档与原型

不要直接跳到“写整合包 mod”，否则会把当前能跑的原版路线和高层框架一起拖乱。

## 13. 整合包路线的长期形态

如果后续按这条路推进，项目最终应形成三层并行能力：

1. **原版执行后端**
- `MineflayerAdapter`
- 继续服务原版/协议兼容场景

2. **整合包执行后端**
- `ModdedClientAdapter`
- 服务真实客户端双开场景

3. **包知识与模组技能层**
- `PackProfile`
- `ModKnowledgeCache`
- `ModCapabilityIndex`
- `ModSkillPack`

4. **模型职责分工层**
- `plannerModel`：云端强模型，做高层规划
- `chatModel`：本地或便宜模型，做闲聊和轻量解释
- `knowledgeModel`：可选，本地知识检索/百科问答
- 规则与技能执行：本地代码，不走模型

也就是说，未来的小狸不只是“接入一个整合包客户端”，而是：

- 知道自己在什么整合包里
- 知道这些 mod 大致是干什么的
- 知道哪些对象可以当容器、哪些对象可以当工作站
- 再逐步学会其中某些 mod 的完整玩法链路

## 14. 进入整合包路线前的架构门槛

本方案的方向保持不变，但不能直接从当前状态跳到 Companion Mod。当前实现仍处于“Adapter 骨架已存在、旧工具层仍是主要执行者”的过渡期。进入真实客户端接入前，必须先完成以下稳定化工作：

- 启动时统一完成持久化配置、共享记忆和环境默认值加载，并固定覆盖顺序。
- 连接流程支持取消，避免手动断开后旧连接再次上线。
- 普通 follow / wander / retreat 禁止 pathfinder 自动挖掘和搭路；采矿技能单独使用可挖掘移动配置。
- `chat` 与 `messagestr` 消息去重，避免一条游戏聊天重复触发动作。
- planner、chat、memory summary 请求具备超时、取消和可观测失败结果。
- Web 面板在开放到局域网前增加认证、来源校验和请求体限制。

完整的优先级、验收链、Agent 收敛顺序和测试矩阵见：[架构收敛与后续路线图](architecture-convergence-roadmap.md)。

## 15. Adapter 收敛要求

`ClientAdapter` 不能继续把 `mineflayer.Bot` 作为基础接口的一部分。原生 Mineflayer 对象只能存在于 `MineflayerAdapter` 内部；高层技能应只依赖能力接口、快照和结构化动作结果。

在 ModdedClientAdapter 开始实现前，应先完成一套 Adapter conformance tests，至少覆盖 self、inventory、nearby players/entities、look、move、stop、follow、attack、use item、eat、chat 和连接生命周期。

动作结果也需要从单一 `ok` 升级为“accepted / executed / confirmed / failed / cancelled”，并携带目标、时间、证据或失败原因。这样 Web 面板才能区分“工具被调用”和“游戏内确实发生了行为”。

## 16. 模型与工具暴露策略

云端 planner 只负责低频目标和复杂步骤；本地模型负责闲聊与轻量解释；确定性动作由本地代码执行。Planner 请求应使用上下文投影，不默认上传完整坐标、关系记忆和内部事件。

MCP 继续保留为外部操作接口，但不再把全部工具作为普通模型的默认工具集。后续应将用户级工具与开发者级工具分组，Web 面板负责完整调试和动作证据查看。
