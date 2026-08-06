# Shared Memory Plan

这份文档规划把“小狸的长期记忆”从 `moony-mcbot` 的单项目配置里拆出来，迁到 `C:\xiaoli\memory`，供后续游戏 bot、TTS 语音、直播助手等模块共用。

当前不直接改运行时代码。先把边界和迁移顺序定清楚，避免把现有 `chat-configs.json`、agent goal、self-guard 配置和真实长期记忆混在一起搬。

## 1. 背景

`C:\xiaoli` 目前至少有：

- `moony-mcbot`：Minecraft bot / agent runtime
- `voice`：小狸 TTS / 直播方向实验目录
- `pic`：图片资源

后续 TTS 和直播助手会需要读取同一个“小狸是谁、Judy 是谁、最近发生过什么、关系如何”的长期记忆。

现在 `moony-mcbot` 的记忆仍保存在：

```text
%LOCALAPPDATA%\moony-mcbot\config\chat-configs.json
```

并且和以下内容混在一起：

- chat listener 配置
- chat AI 配置
- agent 配置
- strategic goal
- player memory
- place memory
- task history
- territory 配置
- self-guard 配置

这对单项目原型足够，但不适合跨游戏 / TTS / 直播共享。

## 2. 目标

长期目标：

```text
C:\xiaoli
├─ moony-mcbot
├─ voice
├─ memory
│  ├─ players.json
│  ├─ places.json
│  ├─ relationship.json
│  ├─ episodes.jsonl
│  ├─ preferences.json
│  └─ schema.json
└─ mcp.json
```

`memory` 目录成为“小狸长期记忆”的共享事实源。

共享记忆写入来源约定：

- `Voice:`：TTS、直播语音、弹幕回复策略写入。
- `McBot:`：moony-mcbot / Minecraft 游戏侧写入。
- `Pic:`：图片、视觉生成、形象素材侧写入。
- `episodes.jsonl` 的 `source` 字段应使用同一组稳定模块名，例如 `Voice`、`McBot`、`Pic`。
- 所有人类可读的 notes / summary 需要带模块名前缀，避免未来合并记忆时分不清来源。

各模块职责：

- `moony-mcbot`：写入游戏内观察、玩家关系、地点、任务经历。
- `voice` / TTS：读取角色身份、称呼、关系、最近事件，决定语音风格和直播回应。
- 未来后台：可视化编辑、备份、导入导出。

## 3. 什么应该迁出去

适合进入共享记忆：

- 玩家资料：`playerName`、`alias`、`relation`、`tags`、`notes`、`lastSeenAt`
- 地点资料：`placeId`、`label`、坐标、维度、标签、说明
- 关系资料：owner、trusted、whitelist、neutral、blocked 等
- 近期经历：一起做过什么、任务成功/失败、重要事件摘要
- 偏好：喜欢的物品、常去地点、称呼习惯、说话风格里的稳定事实

暂时不迁出去：

- API key
- 登录账号 / 密码
- access token
- refresh token
- chat listener 开关
- planner model 配置
- self-guard 阈值
- 当前正在执行的 transient task
- 正在进行中的 follow / pathfinder 状态

这些属于运行时配置或瞬时状态，不是长期记忆。

## 4. 推荐文件结构

### 4.1 `players.json`

```json
{
  "version": 1,
  "players": {
    "Judy": {
      "playerName": "Judy",
      "alias": "茉莉",
      "relation": "owner",
      "tags": ["trusted", "important"],
      "notes": "",
      "lastSeenAt": 1770000000000,
      "updatedAt": 1770000000000
    }
  }
}
```

### 4.2 `places.json`

```json
{
  "version": 1,
  "places": {
    "home": {
      "placeId": "home",
      "label": "家",
      "x": 0,
      "y": 64,
      "z": 0,
      "dimension": "overworld",
      "tags": ["home", "safe"],
      "notes": "",
      "updatedAt": 1770000000000
    }
  }
}
```

### 4.3 `episodes.jsonl`

一行一个事件摘要，适合追加写入和后续压缩：

```jsonl
{"time":1770000000000,"source":"minecraft","type":"task_finished","summary":"小狸跟随 Judy 到达基地。","players":["Judy"],"tags":["follow","base"]}
{"time":1770000100000,"source":"voice","type":"stream_reply","summary":"直播中回应了 Judy 的问候。","players":["Judy"],"tags":["stream","social"]}
```

### 4.4 `preferences.json`

```json
{
  "version": 1,
  "likes": {
    "items": ["salmon", "cooked_salmon", "cod", "tropical_fish"]
  },
  "speech": {
    "defaultTone": "calm_short",
    "ownerAddress": {
      "Judy": "茉莉"
    }
  }
}
```

## 5. 运行时路径

建议新增环境变量：

```text
XIAOLI_MEMORY_DIR=C:\xiaoli\memory
```

`moony-mcbot` 默认仍可使用旧路径，直到迁移完成。

读取优先级建议：

1. `XIAOLI_MEMORY_DIR`
2. `MCBOT_MEMORY_DIR`
3. 兼容旧的 `chat-configs.json` 内嵌 memory

写入策略建议：

- 第一阶段：双写，新旧都写。
- 第二阶段：共享 memory 为主，旧配置只保留运行配置。
- 第三阶段：移除旧 memory 写入，只保留迁移工具。

## 6. 迁移顺序

### Phase 0：只建规划，不改代码

当前阶段。

目标：

- 明确共享记忆目录结构
- 明确哪些数据迁移，哪些不迁移
- 避免误把配置、密钥、瞬时状态当记忆

### Phase 1：新增 `MemoryStore`

新增一个小模块，先只包装现有 player/place/taskHistory 读写，不改变工具契约。

当前进度：`src/memory/game-memory-store.ts` 已完成 Phase 1a 基础。它使用 `XIAOLI_MEMORY_DIR` / `MCBOT_MEMORY_DIR`，支持 `players.json` 与 `places.json` 的规范化、缺失/损坏文件安全降级和原子替换写入。当前尚未接入 McBot runtime，因此不会读取或覆盖真实共享玩家/地点资料；task history 与 `episodes.jsonl` 仍留在后续阶段。

建议接口：

```ts
interface MemoryStore {
  loadPlayers(botId: string): Promise<Map<string, AgentMemoryPlayerProfile>>;
  savePlayers(botId: string, players: Map<string, AgentMemoryPlayerProfile>): Promise<void>;
  loadPlaces(botId: string): Promise<Map<string, AgentMemoryPlaceRecord>>;
  savePlaces(botId: string, places: Map<string, AgentMemoryPlaceRecord>): Promise<void>;
  appendEpisode(event: MemoryEpisode): Promise<void>;
}
```

### Phase 2：双写

当前进度：已完成运行时双写。`memory.player.*`、`memory.place.*`、对应删除，以及 `memory.clear` 的 players/places/all 范围仍会保存到旧 `chat-configs.json`，并会异步更新共享 `players.json` 与 `places.json`。共享快照只含玩家和地点资料，不包含 task history、聊天 pending、API key、账号或运行时配置；启动读取尚未切换，所以不会用共享文件覆盖当前运行时。

`memory.player.*` 和 `memory.place.*`：

- 继续更新内存 Map
- 继续保存到旧 `chat-configs.json`
- 同时保存到 `C:\xiaoli\memory`

调试面板增加：

- shared memory path
- shared memory load status
- last write status

### Phase 3：读共享记忆，旧配置 fallback

当前进度：已完成第一版共享优先合并。启动时会先加载旧 `chat-configs.json`，再读取共享 `players.json` / `places.json`；同名记录只有共享版本的 `updatedAt` 更晚时才覆盖，旧配置独有或更新更晚的记录会保留。空文件、缺失文件和损坏共享文件安全降级为“没有共享导入”。`memory.status` 与 Web `Shared Game Memory` 面板会显示 `loaded`、最近导入与错误状态。

启动时：

1. 先读 `C:\xiaoli\memory`
2. 如果共享文件不存在，再读旧 `chat-configs.json`
3. 如果旧配置里有 memory，提供一次迁移命令

当前边界：尚未删除旧 memory 持久化，也没有提供自动清理旧数据的迁移命令；需要先完成真实重启回归，再决定是否逐步收窄旧配置里的 memory 字段。

### Phase 4：TTS / voice 接入

`voice` 侧只读共享记忆：

- 读取 `players.json` 决定称呼
- 读取 `preferences.json` 决定语音风格
- 读取最近 `episodes.jsonl` 决定直播上下文

不要让 TTS 直接改游戏运行状态。

### Phase 5：后台管理

未来调试面板或独立后台可以加入：

- 玩家记忆编辑
- 地点记忆编辑
- episodes 搜索
- 记忆导出 / 备份
- 手动压缩长期记忆

## 7. 风险和边界

### 7.1 并发写入

游戏 bot 和 TTS 可能同时访问记忆。

建议：

- `players.json` / `places.json` 用原子写入：写临时文件，再 rename。
- `episodes.jsonl` 用 append-only。
- 后续如并发变复杂，再考虑 SQLite。

### 7.2 隐私和密钥

共享记忆目录不能保存：

- API key
- 登录密码
- access token
- refresh token

### 7.3 记忆污染

TTS / 直播上下文可能产生大量闲聊。

建议：

- 默认只写 `episodes.jsonl`
- 只有被规则确认的重要事实，才进入 `players.json` / `preferences.json`
- 重要事实最好带来源和更新时间

### 7.4 schema 演进

所有文件带 `version`。

后续改结构时新增 migration，不直接静默覆盖旧格式。

## 8. 与当前主线的关系

这条线不阻塞当前 adapter/runtime 主线。

优先级建议：

1. 继续完成 `ClientAdapter` 边界收敛
2. 共享记忆先做 `MemoryStore` 和双写
3. TTS 只读接入
4. 再做后台和长期记忆压缩

这样不会因为 TTS 方向打断游戏 bot 当前主线，但会提前把未来共用记忆的坑填好。
