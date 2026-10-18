# 手动测试指南

这是项目唯一的手动测试主入口。第一次或隔很久再次测试时，先完成第 0 节；只有对应冒烟步骤通过后，才进入后面的专项回归。

架构说明、未来规划和历史记录不放在这里，统一从 [文档索引](README.md) 进入。当前仍待手测的项目以本文的折叠积压和根目录 [`TODO.md`](../TODO.md) 为准。

## 0. 十分钟启动与冒烟路径

### 0.1 第一次准备

在 PowerShell 中进入项目并确认 Node.js 版本：

```powershell
cd C:\xiaoli\moony-mcbot
node --version
```

必须是 Node.js 22 或更高版本。首次拉取或 `package-lock.json` 变化后再安装依赖：

```powershell
npm install
```

只在 `.env.local` 不存在时复制模板，已有文件不要覆盖：

```powershell
if (-not (Test-Path .env.local)) {
  Copy-Item .env.local.example .env.local
}
```

打开 `.env.local`，至少确认这些值有效：

| 配置 | 用途 |
| --- | --- |
| `MCBOT_DEFAULT_ENABLED=true` | 创建默认 Bot runtime |
| `MCBOT_DEFAULT_BOT_ID` | Web、MCP 和日志使用的 Bot 标识 |
| `MCBOT_DEFAULT_AUTH_API_BASE_URL` | Yggdrasil API 根地址 |
| `MCBOT_DEFAULT_USERNAME` / `MCBOT_DEFAULT_PASSWORD` | 本地登录凭据，只能留在 `.env.local` |
| `MCBOT_DEFAULT_SERVER_HOST` / `MCBOT_DEFAULT_VERSION` | Minecraft 服务器与协议版本 |
| `MCBOT_DEFAULT_AUTO_CONNECT=true` | 启动后自动连接 |
| `MCBOT_DEBUG_WEB_HOST=127.0.0.1` / `MCBOT_DEBUG_WEB_PORT=4637` | 本机调试面板 |

AI key、闲聊和 Agent planner 都不是首次启动的前置条件。先证明本地服务、Web 面板和 Bot 连接正常，再启用 AI。

### 0.2 启动唯一推荐入口

直接运行项目脚本，不要先从 Cherry Studio 或 MCP Inspector 启动：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-mcp-server.ps1
```

脚本会读取 `.env.local`、执行 build，然后启动 MCP server、Web 面板和默认 Bot。保持这个 PowerShell 窗口打开。

终端至少应出现：

- `Debug web panel started`
- `Default bot runtime created`
- `MCP server started`
- 连接成功时出现 `Default bot auto-connected`

出现 `Default bot auto-connect failed` 时，Web 面板仍应可用，但先排查认证或服务器连接，不要继续测试游戏动作。

### 0.3 检查 Web 面板

打开：

```text
http://127.0.0.1:4637
```

按顺序检查：

1. 右上角不再一直显示“加载中”。
2. Bot 下拉框能看到 `MCBOT_DEFAULT_BOT_ID`。
3. Bot 卡片最终显示 `spawned`；未连接时应显示明确状态或错误，不能是空白页。
4. `Client Adapter` 显示 `mineflayer`。
5. `Chat Listener`、`Last Action Result`、`Action History` 和 `Recent Events` 区块存在。

若浏览器拒绝连接，直接跳到“调试面板拒绝连接”；若 Bot 不存在，跳到“bot.status 显示 not found”。

### 0.4 不依赖游戏画面的冒烟

在 Web 面板完成：

1. 点击 `Refresh`，确认状态能持续刷新。
2. 展开 `Bot Status`、`Agent Status`、`Client Adapter` 和 `Action History`。
3. 点击 `Observe Self`、`Observe Inventory` 和 `Observe Nearby Players`。
4. 如果 Bot 尚未 `spawned`，观察工具应返回明确错误；不能伪造成功数据。
5. 点一次 `Copy Snapshot`，确认能导出当前调试状态。

到这里可以证明本地启动链和调试链工作，但不能证明游戏动作成功。

### 0.5 游戏内安全冒烟

能在游戏里看到小狸时，只按这个顺序测试：

1. 白名单玩家发送 `hi小狸`，确认固定回复只出现一次。
2. 设置 `Follow Judy`，确认小狸开始跟随。
3. 点击 `Stop Follow`，确认游戏内停下，同时后台出现停止动作记录。
4. 让 Judy 走到明显不可达或需要危险绕路的位置，确认小狸不挖路、不搭路，并且只说一次“我跟不上你啦”。

首次冒烟不要测试攻击、丢物品、批量采矿、容器存取或领地反击。

### 0.6 核心 Agent 验收矩阵

下面的矩阵已经合并旧的 Agent 验收场景和核心链路清单。模型自然语言不是证据，至少同时保留游戏行为和一个后台状态来源。

| 场景 | 触发 | 游戏侧通过标准 | 后台证据 |
| --- | --- | --- | --- |
| Goal 持久化 | 设置两步目标后重启 | 无额外动作要求 | `agent.goal.status` 保留 goal、milestones 和索引 |
| Follow | 设置 `Follow Judy` | 开始跟随且保持距离 | `activationTriggered=true`，trace 出现 follow task |
| Stop Follow | 点击 `Stop Follow` | 立即停下且不被旧追击重新拉动 | Command/Action History 与 active task 同步结束 |
| Milestone | `Advance Goal` 后再 `Rewind Goal` | 无额外动作要求 | 目标索引和 `milestone_advanced` / `milestone_rewound` 一致 |
| Mine | 明确设置附近可见矿目标 | 只挖明确目标，不挖接近路径 | Adapter 动作和事件给出目标或结构化失败原因 |
| Report | 完成或放弃单步目标 | 附近可信玩家收到简短汇报 | `goal_completed` / `goal_abandoned` 与汇报事件一致 |
| Auto executor | `manual -> auto -> manual` | 不产生重复或停止后的新动作 | `executorAttached` 与新 planner tick 是否继续一致 |
| Repair | 让活动任务失败 | 不继续重复失败动作 | repair 优先于普通 lifecycle/proactive pass |

详细参数和观察字段见第 5、6、7、9、12 至 14 节。

### 0.7 失败停止点和测试记录

遇到以下任一情况就停止后续危险测试：

- Web 面板打不开或持续加载。
- Bot 状态不是 `spawned`，或游戏里出现重复 Bot。
- 后台显示成功但游戏行为完全不一致。
- 停止动作后仍继续移动、追击或攻击。
- 日志出现密码、API key、access token 或 client token。

每轮只记录：启动命令与时间、终端关键错误、Web snapshot、游戏内实际行为、对应 Action/Command History。不要把聊天模型的总结当作测试结果。

## 1. 测试入口怎么选

推荐顺序：

1. 项目自带 Web 调试面板：最适合看状态。
2. VS Code MCP Inspector / MCP 客户端：最适合手动调用工具。
3. 游戏内观察：最终判断动作有没有真的发生。

不要只相信聊天模型的自然语言总结。关键结果以工具原始 JSON、调试面板状态、游戏内真实行为为准。

## 2. 启动与配置详细参考

<details>
<summary>展开完整环境变量、Web 安全和面板说明</summary>

确认 Node.js 为 22 或更高版本。项目 `.nvmrc` 默认使用 22，CI 另验证 Node 24；Node 20 已不再受支持。

```powershell
node --version
```

确认依赖和构建：

```powershell
cd C:\xiaoli\moony-mcbot
npm install
cmd /c npm run build
```

推荐用 `.env.local` 启动默认 bot，避免每次手填，也避免把秘密值写进 MCP 客户端配置。

```powershell
cd C:\xiaoli\moony-mcbot
if (-not (Test-Path .env.local)) {
  Copy-Item .env.local.example .env.local
}
```

然后打开 `.env.local`，填入你的账号、密码和可选 AI API key。

`.env.local` 已被 git ignore，不要提交。`npm test` 不会自动读取这个文件，并会把 AppData、共享记忆和 prompt profile 路径覆盖到进程独立的临时目录；只有 `npm run dev`、`npm start` 或直接执行程序入口时才会通过 bootstrap 加载真实本地配置。定向测试用 `npm test -- test/example.test.ts`，这样不会绕过隔离 setup。

如果你希望启动后立刻能在游戏内测试 `hi小狸 -> hihi`，保留或填写：

```text
MCBOT_DEFAULT_CHAT_LISTENER_ENABLED=true
MCBOT_DEFAULT_CHAT_WHITELIST=Judy
MCBOT_DEFAULT_CHAT_WAKE_NAMES=小狸
MCBOT_DEFAULT_CHAT_HI_REPLY=hihi
```

如果有多个白名单玩家，用英文逗号分隔：

```text
MCBOT_DEFAULT_CHAT_WHITELIST=Judy,AnotherPlayer
```

如果你只是临时测试，也可以用环境变量。下面的账号和密码请换成你自己的，不要写进仓库文件。

```powershell
$env:MCBOT_DEFAULT_ENABLED = "true"
$env:MCBOT_DEFAULT_BOT_ID = "XiaoLi_26.3.3_newnancity"
$env:MCBOT_DEFAULT_AUTH_API_BASE_URL = "https://authmc.newnan.city"
$env:MCBOT_DEFAULT_USERNAME = "<your-username-or-email>"
$env:MCBOT_DEFAULT_PASSWORD = "<your-password>"
$env:MCBOT_DEFAULT_SERVER_HOST = "main.newnan.city"
$env:MCBOT_DEFAULT_USE_SRV = "true"
$env:MCBOT_DEFAULT_VERSION = "1.20.1"
$env:MCBOT_DEFAULT_AUTO_CONNECT = "true"
$env:MCBOT_DEFAULT_AUTO_CONNECT_DELAY_MS = "5000"
```

如果要测试 AI 聊天或 agent planner，还需要设置 AI API key。推荐写在 `.env.local`：

```text
MCBOT_AI_API_KEY=<your-ai-api-key>
```

临时环境变量也可以：

```powershell
$env:MCBOT_AI_API_KEY = "<your-ai-api-key>"
```

这个 key 不要写进 `chat-configs.json`、`mcp.json` 或 README 示例里。现在代码会忽略旧版配置文件里残留的 `apiKey` / `plannerApiKey` 字段。

注意：`MCBOT_AI_API_KEY` 只提供密钥，不会自动开启游戏内闲聊。若要启动后直接能闲聊，还需要加：

```text
MCBOT_AI_API_BASE_URL=https://api.openai.com/v1
MCBOT_DEFAULT_CHAT_AI_ENABLED=true
MCBOT_DEFAULT_CHAT_AI_WHITELIST=Judy
MCBOT_DEFAULT_CHAT_AI_WAKE_WORD=小狸
MCBOT_DEFAULT_CHAT_AI_MODEL=gpt-5-nano
```

如果服务已经启动，也可以在 Web 调试面板点击 `Enable AI Chat` 临时开启。

启动时配置覆盖顺序是：代码默认值 -> 持久化 `chat-configs.json` -> `.env.local` 环境变量。修改 `MCBOT_AI_API_BASE_URL` 或 `MCBOT_AI_MODEL` 后重启服务即可覆盖旧的 chat/planner 地址或模型；不需要手动编辑持久化 JSON。

模型请求默认超时 15 秒。可用 `MCBOT_AI_REQUEST_TIMEOUT_MS` 统一调整，或分别设置 `MCBOT_CHAT_AI_TIMEOUT_MS`、`MCBOT_PLANNER_TIMEOUT_MS`、`MCBOT_MEMORY_SUMMARY_TIMEOUT_MS`。诊断时查看：`chat.ai.status.lastRequest`、`agent.status.lastPlannerRequest`、`memory.chat.status.lastSummaryRequest`。

### Web 面板安全配置

本机默认地址 `127.0.0.1` 不要求 token。若要让其他设备访问：

```text
MCBOT_DEBUG_WEB_HOST=0.0.0.0
MCBOT_DEBUG_WEB_PORT=4637
MCBOT_DEBUG_WEB_AUTH_TOKEN=<local-debug-token>
MCBOT_DEBUG_WEB_ALLOWED_ORIGINS=http://192.168.1.20:4637
```

然后在其他设备打开 `http://192.168.1.20:4637/?token=<local-debug-token>`。API 请求不带 token 会返回 `401`，Origin 不在白名单会返回 `403`，超过 `MCBOT_DEBUG_WEB_MAX_BODY_BYTES` 的 POST JSON 会返回 `413`。不要把 token 写进 `mcp.json` 或提交到仓库。

启动：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-mcp-server.ps1
```

如果你不想每次启动时自动 build，可以先手动 build，再跳过：

```powershell
cmd /c npm run build
powershell -ExecutionPolicy Bypass -File .\scripts\start-mcp-server.ps1 -SkipBuild
```

启动后打开：

```text
http://127.0.0.1:4637
```

预期：

- 页面能自动发现 bot。
- `bot status.state` 最终变成 `spawned`。
- 游戏里能看到小狸上线。
- 调试面板使用明亮主题，常用按钮、区块标题、弹窗和状态栏消息带中文说明，顶部按钮按功能分组。
- 顶部概览卡用颜色和状态徽标显示：绿色为已就绪，橙色为进行中，灰色为等待，橙红色为异常；`Attack Nearest` 使用单独风险样式。
- 点击 Bot、Agent、Goal 或 Task 概览卡，会自动展开并定位到对应详情；Goal 和 Task 会打开 `Trace Summary`。
- `Expand All` / `Collapse All` 的结果会记在当前浏览器中；刷新调试页后仍会保留，不会影响 bot 或共享记忆。
- 需要细看一次动作后的返回值时，可点 `暂停刷新 Pause` 冻结页面；它只暂停网页的 3 秒轮询，不会停止 bot、Agent 或聊天监听。
- `Chat Listener` 区块能看到固定回复监听是否启用。
- `Client Adapter` 区块能看到当前 adapter 类型、连接快照和统一能力支持表；当前正常原版路线应显示 `mineflayer`。
- 执行一次 `Hold Slot`、`Eat`、`Right Click` 或 `Open Door` 后刷新并展开 `Client Adapter`：`recentActions` 应出现对应的动作名和结果。聊天动作只记录为 `chat sent`，不会显示发出的文本。
- 该区块的 `label` 是中文展示说明，`id` 和 `action` 仍是与代码、日志和 `/api/debug` 原始数据对应的机器字段。
- 不使用 Web 面板时，可调用 `client.adapter.status` 查询同一份原始状态：

```json
{
  "botId": "XiaoLi_26.3.3_newnancity"
}
```

  - 单 bot 运行时可以省略 `botId`
  - `recentActions` 只覆盖已经经过 `BotRuntime` adapter 委托的方法，不代表所有 Mineflayer 原生路径

`observe.self` 的回归预期：所有字段（自身状态、位置、游戏信息、手持物、四件护甲）都来自统一 self/inventory adapter 快照。bot 未连接或 adapter 无法提供自身状态时，工具应明确返回观察不可用错误。

注意：Planner/Skill 内部同名 `observe.self` 使用紧凑文本摘要，不是上述 MCP JSON。该摘要也只读取 Adapter 快照；可选生命或饥饿值缺失时对应字段为 `unknown`，其余玩家、实体和背包上下文仍应保留。

`agent.stateSnapshot` 的回归预期：`selfState` 的位置、朝向、运动、生命、饥饿、氧气、手持物、护甲、空槽、食物、工具和物品汇总，`localWorld.terrain` 的脚下/准星方块，以及玩家/非玩家 `entities` 来自统一 adapter 快照；可见方块、效果和 pathfinder 状态仍可能来自 Mineflayer。`observe.nearbyPlayers` 的公开返回结构保持不变，不会额外暴露内部实体 ID。
- `Last Action Result` 会显示最近一次按钮操作的原始 JSON 结果。
- `Command History` 当前显示 `move.stopFollow`、`interact.eat`、`inventory.holdByCategory` 与 `interact.openDoor` 从 MCP、Web 或 Agent 发起的统一记录，包括 source、requestId、耗时和 `executed` / `failed`。它不保存原始输入；`executed` 不是游戏确认。
- `Action History` records the latest Web quick actions with timestamp, action name, sanitized payload, result, and error status. Payload/result/error are recursively copied and redacted before storage; the endpoint response remains unchanged. Use it when remote-control testing makes in-game feedback hard to see.
- `Prompt Profile` shows the active prompt profile path. After editing `C:\xiaoli\memory\prompts\mcbot-prompt-profile.json`, click `Reload Prompt` and check `Last Action Result.updatedChatAiConfigs`.
- `Shared Chat Memory` shows `C:\xiaoli\memory\chat-summary-state.json`, pending counts, summary threshold, and whether the memory summarizer has an API key.
- `Shared Game Memory` 显示 `players.json` / `places.json` 的共享目录、已落盘记录数、最近一次双写时间和错误。它只同步玩家与地点资料，不显示或保存密钥、账号、聊天原文或任务历史。
- 如果按钮操作失败，例如 `Eat` 没有可吃食物或当前无法进食，也会在 `Last Action Result` 中显示错误 JSON。
- `Observe Self` / `Observe Inventory` / `Observe Nearby Players` / `Observe Nearby Entities` / `Observe Blocks` show common read-only snapshots. Use `Refresh Observe` or wait for auto-refresh to update them.

调试面板当前可以直接点这些高频按钮，不需要 CherryStudio 或 MCP Inspector：

- `Set Goal`：用一个集中表单设置战略目标、理由、里程碑和起始索引；表单会显示字段说明和 `Follow Judy` 的完整样例。目标是想完成的事，理由是背景，里程碑是可选分步清单；起始索引通常填 `0`，代表从第一项开始。里程碑可每行一项或用英文逗号分隔，Esc 或 `Cancel` 不会执行动作。
- `Advance Goal` / `Rewind Goal`：推进或回退当前里程碑。
- `Run Once`：手动触发一次 agent planner，适合测试“给一句指令后会不会调用工具”。
- `Reload Prompt`: reload the active McBot prompt profile from disk after editing it.
- `Enable hi Reply`：运行时启用 `hi小狸 -> hihi` 这类固定回复。
- `Enable AI Chat`：运行时启用游戏内 AI 闲聊。
- `Hold Slot`: select a hotbar slot from 1 to 9, then verify `Observe Inventory.heldItem`.
- `Hold Category`: equip the best `sword` / `axe` / `pickaxe` / `food` item through the adapter path.
- `Eat`：尝试吃背包里的食物。
- `Right Click`：右键方块或使用手持物。
- `Open Door`：尝试打开准星或附近的门。
- `Attack Nearest`：攻击最近的非玩家实体，按钮会先二次确认。
- `Clear Goal`：清空战略目标。
- `Stop Follow`：停止跟随。
- `Capture Place`：把当前位置记录成地点记忆。
- `Refresh Observe`: refresh self, inventory, nearby, and block observation sections; useful for checking adapter-backed runtime readings.

如果浏览器提示“拒绝连接”，先确认服务进程和端口真的存在：

```powershell
Get-NetTCPConnection -LocalPort 4637 -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "name = 'node.exe'" | Select-Object ProcessId,CommandLine
```

如果第一条没有任何输出，说明 `http://127.0.0.1:4637/` 没有服务在监听。此时需要重新启动 `npm run dev`，或者确认你的 MCP 客户端已经真正启动了 `C:\xiaoli\moony-mcbot\dist\main.js` / `src\main.ts`。

注意：这个调试面板不是独立网站，它跟 MCP server 同进程启动。只打开浏览器不会自动启动面板。

</details>

### 2.1 Raw Action Runner

Web 调试面板里的 `Raw Action Runner` 是一个受控 JSON 调试入口，用来替代一部分 MCP Inspector 手填参数的场景。

使用方式：

1. 展开 `Raw Action Runner`
2. 在 `Action endpoint` 里选择动作，例如 `set-goal`、`run-once`、`eat-food`
3. 点击 `Load Template` 载入示例 JSON
4. 保持 `Inject selected botId` 勾选，通常就不需要在 JSON 里手写 `botId`
   - 当前动作选择、JSON 和勾选状态会保存在浏览器；刷新页面后仍会保留
5. 点击 `Run JSON Action`
6. 看 `Last Action Result` 和 `Action History`；执行 `stop-follow`、`eat-food`、`hold-category` 或 `open-door` 时同时看 `Command History`
7. 需要保留测试证据时，点 `Copy Result` 复制最近结果，或点 `Copy JSON` 复制当前 raw 参数
8. 需要保存整轮测试记录时，点顶部 `Copy History` 或 `Download History` 导出当前 `Action History`
9. 开始新一轮测试前，可以点顶部 `Clear History` 清空当前 bot 的历史；清理动作本身会留下记录
10. 需要一次性分享全部调试面板状态时，点顶部 `Copy Snapshot` 或 `Download Snapshot` 导出最近一次 `/api/debug` 快照

边界：

- 它只调用当前 Web 面板已有的 `/api/action/*` 调试动作。
- 它不是完整 MCP 工具执行器，不能直接调用所有 MCP 工具。
- `attack-nearest` 仍会二次确认，避免误攻击。
- `bot.connect` / `bot.disconnect` 仍未开放到 Web 面板。
- 不要用真实密码、token 或 API key 验证脱敏。无需进入游戏即可运行 `npx tsx --test test/diagnostic-redaction.test.ts test/debug-web-security.test.ts`；测试会使用固定假值检查嵌套 payload、数组、错误文本、Bearer 凭据和循环引用。

## 2.2 统一命令试点检查

当前 `move.stopFollow`、`interact.eat`、`inventory.holdByCategory` 与 `interact.openDoor` 已接入统一 CommandDispatcher。三个调用入口仍保留自己的公开返回契约，Command History 只补充统一执行证据。

### 停止跟随

1. 在 Web 面板选中已存在的 bot，点击 `Stop Follow`。
2. `Last Action Result` 应保持原 body：`stopped=true`、`message="Stopped following"`。
3. 展开 `Command History`，最新记录应为 `commandId="move.stopFollow"`、`source="web"`、`status="executed"`，并带 requestId、startedAt、completedAt、durationMs。
4. 用 MCP 客户端调用一次 `move.stopFollow`；工具成功文本仍应为 `Stopped following`。
5. 刷新 Web 面板，最新记录的 `source` 应变成 `mcp`。使用不存在的 botId 调用时，MCP 仍应返回 `isError=true`；该失败属于另一个 botId，不会混进当前所选 bot 的面板历史，失败历史记录由离线集成测试覆盖。
6. 如果能观察游戏，再确认小狸实际停下。`status="executed"` 只证明停止 handler 已运行，不证明服务器已确认角色静止。

### 进食

1. 确保背包里有可吃食物且饥饿值未满，在 Web 点击 `Eat`。
2. `Last Action Result` 应继续返回 `{ botId, action: "eatFood", result }`，Command History 最新记录应为 `commandId="interact.eat"`、`source="web"`。
3. 再用 MCP 调用 `interact.eat`；成功文本仍应以 `Ate` 开头，失败仍应设置 `isError=true`。
4. `status="executed"` 只表示客户端动作 handler 返回；是否实际吃下仍看游戏画面、饥饿值和 Adapter `eat_food` 记录。

### 按类别持有物品

1. 确保背包里有剑、斧、镐或食物，在 Web 点击 `Hold Category` 并选择一种类别。
2. `Last Action Result` 应继续返回 `{ action: "hold-category", result }`，不能因为统一命令而额外出现 `botId`；Command History 最新记录应为 `commandId="inventory.holdByCategory"`、`source="web"`。
3. 用 MCP 调用 `inventory.holdByCategory`，例如 `category="sword"`；成功文本仍以 `Equipped` 开头，刷新面板后 source 应为 `mcp`。
4. 在 Raw Action Runner 向 `hold-category` 发送 `{"category":"hoe"}`；应走原 HTTP 错误并写入失败的 Action History，但不能新增 Command History，因为输入尚未通过 Web 边缘校验。
5. 如果能观察游戏，再确认小狸切到该类别的最佳物品。`status="executed"` 不代替游戏画面或 Adapter `hold_item_by_category` 结果。

### 开门

1. 让小狸准星对着门或站在门附近，在 Web 点击 `Open Door`。
2. `Last Action Result` 应继续返回 `{ botId, action: "openDoor", result }`；Command History 最新记录应为 `commandId="interact.openDoor"`、`source="web"`。
3. 用 MCP 调用 `interact.openDoor`，可省略 reach/radius；原 MCP schema 应补成 `4.5` / `6`，成功文本和 `isError` 语义不变，刷新面板后 source 应为 `mcp`。
4. Web 省略 reach/radius 时仍由 Adapter 使用默认值，不应因 canonical 层套用 MCP 范围而改变 HTTP 响应。
5. 检查 Adapter 最近动作出现 `open_door`，并观察游戏内门是否切换。`status="executed"` 只表示 handler 返回，不代表门状态已由服务器确认。

Agent 来源、参数边界和四个命令的三入口兼容已有离线集成测试覆盖：

```powershell
npx tsx --test --import ./scripts/test-setup.ts test/command-dispatcher.test.ts test/action-command-set.test.ts test/stop-follow-command-integration.test.ts test/eat-command-integration.test.ts test/hold-category-command-integration.test.ts test/open-door-command-integration.test.ts
```

## 2.3 当前积压待测清单（首次启动跳过）

<details>
<summary>展开完整积压清单</summary>

本轮新增待测项：

- [ ] Web 面板安全：本机 `127.0.0.1` 无 token 应可打开；设置非回环地址但不提供 `MCBOT_DEBUG_WEB_AUTH_TOKEN` 时启动应拒绝；带 token 访问 API 应成功，错误 token 或未允许的 `Origin` 应返回 `401/403`，超大 action 请求应返回 `413`。
- [ ] Agent 状态一致性：设置一个带两个 milestone 的目标并启动跟随，比较 `agent.framework.status`、`agent.trace.summary`、`agent.goal.status` 与 `agent.stateSnapshot`；goal、current milestone、active task、runtimeState 应一致，完整快照中的 `selfState`、`localWorld`、`entities`、`taskContext` 和 `memorySummary` 不应缺失。停止跟随后再次查询，active task 应为空；通过 `agent.runOnce` 产生多步计划时，`queuedActions`、`queuedStepCount` 与 `queuedLegacySteps` 应对应同一队列。
- [ ] Agent executor 生命周期：将一个测试 Bot 配为 `mode=auto` 并确认 `agent.status.executorAttached=true`，再切换为 `manual` 确认立即变为 `false` 且冷却到期后不再出现新 planner tick；切回 `auto` 后不应出现重复 loop。让一次 planner 调用正在执行时按 `Ctrl+C`，shutdown 应停止新 tick，并在当前被跟踪 Promise 结束后完成 flush。配置删除/停用不会取消已开始的 executor run 本身，这是兼容边界，不应误判为取消测试通过。
- 本轮的 Agent timeout/tick 协调迁移只改变内部所有权，不新增游戏侧验收；`test/agent-blackboard.test.ts` 已覆盖同 Bot timeout 替换/清除/过期和 tick 冷却边界。实服测试仍按上一条观察 executor loop、Agent 事件与 shutdown，不需要额外填写参数。
- 本轮的 planner 冷却迁移同样只改变内部所有权；`test/agent-blackboard.test.ts` 已覆盖首次请求、恰好到期、时钟回退和旧配置诊断时间戳同步。配置中的 `lastPlanAt` 仍可在状态里查看，但只是诊断镜像；并发 planner 请求、请求取消和执行队列语义没有改变，不新增游戏侧验收。
- 本轮的任务历史 Store 迁移不新增游戏动作验收；`test/agent-task-history-store.test.ts` 已覆盖多 Bot 隔离、深拷贝、20 条上限、替换、清空和删除，`test/chat-config-reload.test.ts` 覆盖既有 `memory.taskHistory` 恢复。后续手测只需在 Agent 状态一致性场景中确认任务完成后历史仍可见、重启后仍保留，不需要额外游戏动作。
- 本轮的 task progress 节流迁移不新增游戏动作验收；`test/agent-blackboard.test.ts` 覆盖只读判定、严格 1200ms 边界、详情/任务变化、时钟回退和按 Bot 清理。需要观察事件时仍按 Agent 事件一致性场景检查 `task_progress` 的 payload/顺序；本轮不改变事件发布方式，也不代表 planner 或完整 Agent tick 已迁移。
- 本轮的战略生命周期去重迁移不新增游戏动作验收；`test/agent-blackboard.test.ts` 覆盖普通提示首次/重复/事件替换、完成汇报只读判定与成功记账、两类状态隔离，以及配置删除清理。后续仍按 Agent 事件一致性场景确认目标完成/放弃后最多汇报一次；本轮不改变聊天文本、目标选择、事件历史或 planner 行为。
- 本轮的库存变化摘要基线迁移不新增游戏动作验收；`test/agent-blackboard.test.ts` 覆盖首次建基线、重复抑制、变化、回变和 Agent 配置删除清理，`test/self-guard-state.test.ts` 继续覆盖摘要稳定排序。仍按 self-guard Adapter 周期状态场景改变一次背包并确认只出现一条 `inventory_changed`；本轮不改变摘要、事件 payload、库存动作或持久化。
- 本轮的空闲社交尝试冷却迁移不新增游戏动作验收；`test/agent-blackboard.test.ts` 覆盖旧时间戳初值、重复抑制、精确边界、时钟回退和配置删除清理，`test/idle-social-policy.test.ts` 继续覆盖候选筛选与评分。仍按“空闲白名单社交 Adapter 选择”场景观察目标、任务和短句；本轮不改变候选、冷却时长、失败尝试占用、转头、聊天或持久化。
- 本轮的玩家/地点记忆 Store 迁移也不新增游戏动作验收；`test/agent-game-memory-state-store.test.ts` 已覆盖多 Bot 隔离、输入/输出副本、共享基线、严格较新合并、同时间戳聚合、清空和删除，`test/chat-config-reload.test.ts` 覆盖 Judy 与 home 的恢复及配置删除清理。可选实机回归只需重启后确认 `memory.status` 和 Web `Shared Game Memory` 仍显示同一批记录，不需要重新创建地点或改变 Voice 读取方式。
- 本轮的 `TerritoryConfigStore` 迁移不新增游戏动作验收；`test/territory-config-store.test.ts` 覆盖默认值、多 Bot 隔离、输入/输出副本、替换和删除，`test/chat-config-reload.test.ts` 覆盖完整配置恢复、热重载替换和配置删除后的默认值。领地入侵者选择、presence 清理、警告冷却和升级行为仍按原 7.9 场景验证；本轮没有改变这些游戏侧行为。
- 本轮的 `TerritoryPresenceStore` 迁移同样不新增游戏动作验收；`test/territory-presence-store.test.ts` 覆盖复合 key 读写、多 Bot 隔离、副本、active-key prune 和按 Bot 清理，既有 `test/territory-presence.test.ts` 继续覆盖纯入侵者决策。7.9 的游戏侧领地场景仍需确认玩家离开后可重新触发警告、冷却和主人在场升级；本轮只修复运行时状态所有权与配置删除清理。
- 本轮的 `territory-warning-state` 迁移不新增操作步骤；`test/territory-warning-state.test.ts` 覆盖首次警告、冷却窗内抑制、精确冷却/升级边界、主人不在时等待、禁用/重复升级、旧 falsy 时间戳和非法时间 fail-closed。仍按 7.9 验证真实聊天与战斗，尤其确认冷却到期的 tick 先再次警告，只有后续 tick 才允许升级；事件文案、返回值和决斗目标应保持原样。
- 本轮的 `TerritoryRuntime` 收口不新增操作步骤；`test/territory-runtime.test.ts` 覆盖 presence prune、状态写回、hook 调用顺序、离开重入、多 Bot/clear 和 hook 抛错。仍按 7.9 做真实聊天、事件和决斗验收，因为具体 hooks 仍在 `action-tools.ts`，离线测试不代表服务器已确认战斗效果。
- 本轮的社交与人格短期状态收口不新增游戏动作验收；`test/social-runtime-state-store.test.ts` 覆盖多 Bot 隔离、互动初始化、主动发言时间、回复上下文副本、心情、场景冷却的精确边界/时钟回退和按 Bot 清理。现有动态 AI、聊天记忆和 self-guard 场景仍可用于确认外部行为没有变化；这些状态是进程内短期状态，重启后不恢复，也不代表共享 memory 已写入新的字段。
- 本轮的聊天监听资源生命周期收口不新增游戏动作步骤；`test/chat-listener-lifecycle.test.ts` 覆盖订阅隔离、Runtime 引用匹配、解绑顺序/失败、watchdog 与 shutdown，`test/chat-listener-lifecycle-integration.test.ts` 覆盖 MCP 启用、重复启用和停用接线。能看游戏时仍按“聊天回显与监听”场景确认白名单消息只触发一次，并在 `chat.listener.status.attached` 观察启停；离线通过不代表真实服务器回显或断线重连已经确认。
- [ ] Agent 事件一致性：执行一次目标设置、跟随启动和停止，比较 `agent.framework.status.snapshot.executionEvents`、`agent.trace.summary.recentEvents` 与 `agent.events.tail`；三者应显示同一组最近 20 条可观察事件，类型、写入顺序和最后一条动作证据一致。内部 `recentEvents` 可能额外包含 `tick` / `perception_updated`，不作为调试尾部比较对象。
- [ ] Adapter 低风险动作：在已连接 Mineflayer bot 上依次调用 `observe.self`、`observe.inventory`、`chat.send`、`inventory.holdByCategory`、`interact.openDoor` 和 `interact.dropHeld`；确认结果正常，并在 `client.adapter.status.recentActions` 看到对应动作记录。`chat.sendVerified` 单独验证收到回显时 `echoed=true`，超时或无回显时 `echoed=false`。
- [ ] 统一按类别持有：分别从 Web 与 MCP 调用 `inventory.holdByCategory`，确认旧返回体/文本不变、Command History source 正确、Adapter 最近动作出现 `hold_item_by_category`，且游戏内实际切到对应类别的最佳物品；再按 2.2 用非法 Web 类别确认只产生 Action History 错误、不产生假的 Command History。Agent source 与缺失 bot 路径已有离线测试，不要求依赖 planner 复现。
- [ ] 统一开门：分别从 Web 与 MCP 调用 `interact.openDoor`，确认旧 `{ botId, action: "openDoor", result }` / 文本不变、Command History source 正确、Adapter 最近动作出现 `open_door`，且游戏内门实际切换；MCP 省略参数应使用 4.5/6，Web 省略参数应继续交给 Adapter 默认值。Agent 数值字符串转换与缺失 bot 路径已有离线测试，不要求依赖 planner 复现。
- [ ] Agent 紧凑状态摘要：通过 `agent.runOnce` 让 planner 只执行一次 `observe.self`，确认执行结果包含 activity、health、food、held、bestFood、players 和 entities，且不出现 `state=unavailable`。这不是 MCP `observe.self` 的完整 JSON 契约；真实 Mineflayer 应继续显示实际血量/饥饿值，未来 Adapter 缺字段时允许显示 `unknown`。
- [ ] Planner 上下文投影回归：使用真实模型分别执行一次跟随、附近可见挖矿和失败后的 repair；确认规划仍能使用生命/背包/距离/当前任务信息，同时服务日志或代理抓包中的请求不再出现 `完整状态JSON`、绝对 `position`、`entityId`、任务 `params`、记忆 `notes` 或事件 `payload`。`agent.stateSnapshot` 和 Web 本地调试快照仍应保留完整字段。
- [ ] AI 闲聊动态状态与准星 focus：启用 `chat.ai` 后，让 bot 分别处于手持物品、背包带食物、玩家近处、准星对准方块和准星对准实体的状态，再用唤醒词询问当前状态；同时调用 `perception.focus` 核对原始结果。实体在视野中心且无遮挡时应得到 `focusType=entity`，更近方块挡在实体前时应得到 `focusType=block`，侧面或超过 reach 的实体不能抢占 focus。检查回复使用的生命、饥饿、手持物和环境信息与游戏一致，且连接正常时不退化为仅含“待命/未知”的四行 fallback。精确实体注视的数据采集仍是 Mineflayer 增强，本项不代表未来 Modded Client 已支持实体 focus；模型措辞可变化，不能只按固定句子验收。
- [ ] salient Adapter 角色感知：调用 `perception.salient`，让白名单与非白名单玩家同时进入半径，并放置/引来 creeper、zombie、skeleton、boat、minecart 或 wolf；确认 `nearbyPlayers` 按距离排序并正确标记 `whitelist/neutral`，`interestingEntities` 只包含既有关键词且按距离排序。箱子、门、工作台等仍应出现在 `interactableBlocks`；这部分方块扫描仍是 Mineflayer 边界。可再查看 `agent.stateSnapshot.localWorld.salient`，结果应与工具一致。
- [ ] Agent 自定义进食权限：保持默认配置时确认 `agent.status.allowedTools` 不含 `interact.eat`；仅在测试配置中显式加入后，触发一次 `eat_food` directive，确认 Agent 执行结果不再是 `Unsupported agent tool`，并在 Adapter 最近动作看到 `eat_food`。测试结束后恢复原 allowlist。
- [ ] Agent 超时恢复观察：让一个 Agent 任务进入 `task_timeout`，再检查 `agent.trace.summary` / `agent.framework.status`；恢复动作应执行 `observe.nearbyEntities`，不能出现缺少 `yaw/pitch` 的 `player.look` 或 `Unsupported agent tool 'player.look'`。该路径已有离线回归测试，游戏侧只需确认事件与摘要可见。
- [ ] 安全移动：让 bot 跟随玩家绕过方块，确认跟随过程中不会挖方块、搭一格高塔或放脚手架；目标移动跨方块时 Adapter 最近动作应出现 `pursue_entity`，进入最小距离或停止时出现 `stop_movement`；Pathfinder 不可用、拒绝目标，或首轮/后续规划返回 `noPath` / `timeout` / 长绕行时不得继续直走，Adapter 最近动作应记录失败，follow task 应结束且游戏聊天只出现一次“我跟不上你啦”；再按 7.10 单独调用 `mine.digNearestVisible`，确认显式挖矿仍可工作且不会破坏沿途方块。
- [ ] 旧可见扫描与批量采矿：对同一处无遮挡矿石先调用 `block.findVisible`，确认按距离排序且遮挡矿石不返回；再分别触发 MCP `mine.collectVisible`、Agent `mine.collectVisible` 和“清理玩家附近可见矿”，确认扫描数量、射线过滤、接近、逐块显式挖掘、`no_visible_target` / `pathfinder_unavailable` / `approach_timeout` 停止原因与游戏行为一致。寻路途中不得挖路或搭路；该项只回归旧 Mineflayer 链，不代表批量采矿已迁入 Adapter。
- 采矿串行队列迁移本身不新增游戏手测步骤：离线测试已覆盖同 Bot 串行、跨 Bot 并发、失败恢复和 shutdown 单次快照；真实行为仍只按上一项验收，不能把队列测试视为采矿动作确认。
- [ ] 固定坐标移动：按 7.9 使用 Web Raw Action Runner 调用 Agent 内部 `move.goToPosition` 移动到空旷坐标，确认无需 Mineflayer 专用坐标参数，Adapter 最近动作出现一次 `move_to_position`，到达后出现 `stop_movement`，Agent task 结束；途中停止后不能再次自行前进。连续提交两个目标时，State Snapshot 的 current activity 应切到最新 key，旧目标的迟到失败不得终止新任务。
- [ ] 定点移动资源生命周期：在固定坐标移动运行中分别执行到达、主动停止、self-guard 停止和进程 `Ctrl+C`；确认 interval 不再继续触发，movement subscription 不重复消费事件，shutdown 先释放 interval 再逐个清订阅。该项只观察 Web 的 Action History、Adapter 最近动作、Agent task/trace 和服务日志，不把 `executed` 当作服务器确认。
- [ ] 持续行走计时器生命周期：只在平坦、封闭且远离悬崖/岩浆/深水的测试区调用 MCP `movement.walk`，确认时长到达后 Adapter 最近动作出现 `stop_movement`，随后再次启动并立刻调用 `movement.stop`，旧 timer 到期时不得再次影响新动作；运行中的 `Ctrl+C` 应清除 timer，shutdown 后不得再出现停止回调。该项不改变 `movement.walk` 缺少地形前视的限制，也不建议开放默认 Agent 权限。
- [ ] 白名单汇报目标：让两个白名单玩家同时处于已加载范围，触发 self-guard 追击超时或结束汇报；bot 应朝距离更近且坐标有效的白名单玩家移动，非白名单玩家即使更近也不能成为汇报目标。该项只验证目标选择迁移，不代表反击循环已完全脱离 Mineflayer。
- [ ] self-guard Adapter 周期状态：将 `lowFood` 临时调到高于当前饥饿值并启用 `autoEat`，确认 Web Agent 事件出现一次 `low_food`，Adapter 最近动作出现 `eat_food` 成功或明确失败；背包没有食物时应有“没有吃的”反馈且不能产生假的成功动作。改变背包内容后应出现 `inventory_changed`。让非自身玩家从范围外首次进入 `nearPlayerDistance` 时仍可按配置概率触发原场景逻辑；持续停留不应被每个 tick 当作重新进入，离开后再次进入才允许产生新的进入机会，缺失、负数或非有限距离快照应被忽略。该项只验证周期快照与自动进食，不代表受伤事件、天气或原生实体反击已迁移。
- [ ] self-guard reactive 阈值信号：清空短期 tick 状态后同时进入普通低生命和低饥饿阈值，Web Agent 事件应按 `low_health`、`low_food` 顺序各出现一次，payload 的 health、food、hasFood、severity 和 reason 应与状态一致；维持同一状态多个 tick 不得重复。继续降到 critical 应新增一条 critical `low_health`，恢复到普通低生命应新增一条 warning `low_health`，完全恢复不应生成恢复事件；再次进入阈值后才允许重新报告。事件发布和 reactive flags 写入仍在旧编排层，本项不代表完整 tick 已迁移。
- [ ] self-guard 告警冷却：临时启用 `chatAlerts` 并把 `alertCooldownMs` 设为便于观察的合法值，在持续低生命或低饥饿状态下确认同一冷却窗只发送第一条告警，恰好经过冷却后才允许再次发送；改为 `chatAlerts=false` 后不得继续发告警。若发送时断线，冷却仍应先被消耗，重连后不能立即补发。本项只验证纯冷却判定与旧副作用顺序，不代表完整 tick 已迁移。
- [ ] self-guard 核心转场：首次启用并完成第一个 tick 时不应出现“我回来啦”；断线并成功连接到新的 Bot 实例后应至多出现一次既有重连短句，后续 tick 不得重复。受到实际伤害时，周期健康比较只有在 vitals 可用且相较上一轮严格下降超过 `0.5` 才允许进入既有受伤处理；Mineflayer `entityHurt` 订阅可能同时触发，因此精确 `0.5` 容差和损坏历史值的 fail-closed 以 `test/self-guard-state.test.ts` 离线回归为准。本项不代表真实伤害来源已可识别。
- [ ] self-guard 昼夜/天气转场：在白天无雨时启动，跨到夜晚应只出现一次“天黑了…”；由无雨转下雨应只出现一次“下雨了…”；直接在夜晚/雨中启动或重启不应把首次快照误判为刚转场。该项只回归现有 Mineflayer 天气源，不代表 Modded Adapter 已具备世界环境快照。
- [ ] self-guard 疑似攻击者、目标复核与持续 tick：让一个白名单玩家和一个非白名单玩家同时处于检测半径内并造成一次伤害，检查服务日志 `Hit reaction detected` 的 `likelyAttacker` 与实际距离最近的玩家一致。白名单玩家更近时只应进入白名单提醒分支，不能改打第二近的非白名单玩家；非白名单玩家更近且启用 `retaliateOnNonWhitelistHit` 时应继续进入既有反击链。再连续触发到持续反击，分别让同名目标位于 3 格内、3 格外、攻击距离边界外和离开已加载范围：3 格内应停止接近，3 格外应追击，攻击距离外不能隔空命中，快照消失后 session 应停止且不能改打其他玩家；相邻成功攻击不得快于约 600ms，持续追击达到约 60 秒应超时、停止并汇报。结合 Adapter/Action History 与 session 状态判断，只有成功攻击才递减剩余命中。该项验证 Adapter 目标复核和纯 tick 决策；`entityHurt` 不提供真实伤害来源，生物/环境伤害仍可能被误归因给最近玩家，追击、控制状态和攻击也仍是 Mineflayer 实现。
- [ ] 地点 Adapter 快照：先在 Web 点击 `Capture Place`，再调用 `memory.place.captureHere`，确认保存坐标与当前维度正确且坐标为三位小数；调用 `memory.place.nearest` 应返回相同格式的 `currentPosition`；同维度 `memory.place.goTo` 应进入安全定点移动，跨维度地点必须返回原维度冲突错误且不能开始移动。该项不覆盖容器和领地扫描。
- [ ] 记忆容器物品投影：在已记录地点附近放置箱子或木桶，准备同名多堆物品和不同 display name 的物品；依次调用 `container.inspectRemembered`、`container.depositMatching` 与 `container.withdrawMatching`，确认 inspect 汇总会合并同名堆并按数量/名称排序，exact 只匹配物品 ID，includes 可匹配 ID 或显示名，存取数量、返回 items 和游戏内容器实际变化一致。该项只验收现有原版 Mineflayer 容器路径，不代表 Modded Client、机械动力保险库或精妙存储容器已接入。
- [ ] 领地 Adapter 玩家快照：配置一个 remembered place 和 `territory.configure`，让非白名单玩家进入半径边界内，确认只警告一次且 Web 事件显示正确玩家/地点；玩家离开后刷新应清除 presence，再次进入可重新触发。分别验证 `owner_nearby_only` 在主人不在领地附近时不升级、主人进入后允许升级，以及 `always` 在主人不在时仍可升级。白名单、owner 和缺少有效实体快照的玩家不得成为入侵者；战斗动作应继续出现在 Adapter 最近动作中。
- [ ] 战略目标 Adapter 激活：auto 模式设置 `Follow Judy` 时，Judy 可见应保持 `activationTriggered=true` 并开始跟随，不可见时不得误触发；再设置一个能匹配记忆地点的目标，同维度应进入安全定点移动，跨维度应保持未激活。自动采矿目标不计入本项。
- [ ] 空闲跟随主人 Adapter 策略：配置 `mode=auto`、`autoIdlePolicy=follow_owner` 和正确 owner；主人在 4.5 格内时 bot 应待命，超过 4.5 格应开始安全跟随，超过 8 格时允许冲刺。主人离开已加载范围后，应在距离优先记忆地点超过 3.5 格时退回该地点；附近没有合适地点时保持原地。检查 `Client Adapter` 最近动作中的 `pursue_entity` / `move_to_position` / `stop_movement` 和 Agent 事件，不要求只靠游戏画面判断。
- [ ] 空闲白名单社交 Adapter 选择：配置 `mode=auto`、`autoIdlePolicy=socialize_whitelist`，让多个白名单玩家同时位于 `nearPlayerDistance + 2` 范围内；通过 `memory.player.upsert` 分别设置 owner、trusted/friend 标签和普通关系，确认优先对象符合既有加权公式（owner `+6`、whitelist relation `+2`、优先标签 `+2`、最近 10 分钟活跃 `+1`、距离 `-distance/6`）。目标应被看向并收到原有短句；非白名单、范围外和无有效坐标玩家不能入选。目标在选择后离开加载范围时任务应记录失败而不是看向错误位置。本项不代表 Modded Client 已支持按世界坐标观察。
- [ ] 聊天去重：发送一条带唤醒词的聊天，确认只产生一次回复、一次 Agent 事件和一次记忆记录；两秒后再次发送同样内容，应允许再次处理。
- [ ] 聊天重连订阅：断开并重新连接 bot 后发送一条白名单聊天，确认仍能触发监听，且不会出现重复回复或重复记忆记录。
- [ ] 重连后聊天去重状态应清空：重连后发送同样内容，不应因为重连前的消息被吞掉。
- [ ] 聊天普通攻击：近距离说“小狸，攻击 <玩家名>”应持有可用的剑或斧并只攻击一次；目标超过 4.5 格时应回复正在靠近且暂不攻击；明确写出的玩家不在视野内时应回复“没看到”，不能改打附近生物；未写玩家名且附近没有非玩家实体时应回复“附近没有可攻击目标”。随后在 `client.adapter.status.recentActions` 核对远距离 `pursue_entity`、近距离 `hold_item_by_category` 与 `attack_player` / `attack_nearest_entity` 的成功或失败记录。
- [ ] Adapter 快捷栏整理：分别验证普通背包、目标快捷栏已占用、缺少某类物品和背包全满四种情况；确认不会覆盖或丢失物品，MCP 返回逐类别 `actions`，聊天指令有明确反馈，并在 Adapter 最近动作看到 `organize_hotbar`。
- [ ] 准备战斗换槽：背包有铁剑且快捷栏第 1 格被占用时调用 `combat.prepareBattle`，确认占位物进入空槽、铁剑进入第 1 格且工具及时返回；背包全满时应回退到直接持有最佳武器，不能卡住或覆盖物品。
- [ ] 持续挑战状态机：分别用中文别名和英文实体名发起挑战，确认选中最近的匹配非玩家实体；目标短暂离开视野不应立即结束，持续丢失超过约 2.5 秒应取消；3 格外追击、4.5 格内按约 650ms 冷却攻击，目标死亡后发送“就这”并结束任务；在 Adapter 最近动作核对 `pursue_entity`、`attack_entity` 和停止记录。
- [ ] 对决资源生命周期：持续对决中分别触发目标死亡、自身死亡、持续丢失、追击失败和进程 `Ctrl+C`；确认每次只结算一次、结束后不再出现 tick/追击/攻击，entity/movement 订阅不重复消费事件。shutdown 只验证本地资源释放与日志顺序，不把游戏画面或 `executed` 当作服务器确认。
- [ ] 模型超时/失败：让 chat AI 或 planner 使用不可达地址，确认在超时后返回本地 fallback 或明确失败状态，不应无限等待。
- [ ] 模型取消：请求进行中调用 `chat.ai.configure` 或 `agent.configure` 停用对应功能，确认状态变为 `cancelled`，不会在稍后继续发送旧回复或执行旧规划。
- [ ] 原子持久化与退出 flush：按“持久化退出回归”一节启动独立进程，在产生配置变更和未满 20 条聊天 pending 后按一次 `Ctrl+C`；确认关闭日志完整、两个 JSON 可解析、没有 `.tmp` 残留，重启后配置与 pending count 均恢复。
- [x] 致命进程异常协调：`test/process-lifecycle.test.ts` 与 `test/runtime-shutdown-lifecycle.test.ts` 已覆盖 fatal 失败码、幂等 shutdown、signal/fatal 竞争、hook 失败、事件卸载，以及 Web drain 时立即停止动作 runtime；不需要在真实游戏中故意制造崩溃。

这部分是最近新增但还没有完整跑完的回归项。下次能看游戏画面时，优先按这个顺序补测。

</details>

### 测试记录

- 2026-07-10：A「配置与提示词」已测完。
- 2026-07-10：B「游戏内行为」主体已测完。
- 2026-07-10：`Attack Nearest` 面板有反馈，但游戏内没有看出明确动作；当前按“需要复测”处理。

### A. 配置与提示词

1. `Prompt Profile` / `Reload Prompt`
   - 修改 `C:\xiaoli\memory\prompts\mcbot-prompt-profile.json`
   - 在 Web 调试面板点击 `Reload Prompt`
   - 预期：`Last Action Result.reloaded` 为 `true`，`promptProfilePath` 指向 shared memory 路径，`updatedChatAiConfigs` 有返回值

2. `Shared Chat Memory`
   - 让白名单玩家发几句普通聊天和带唤醒词的聊天
   - 预期：`Shared Chat Memory` 面板显示 `C:\xiaoli\memory\chat-summary-state.json`，对应 bot 的 pending count 会变化
   - 注意：未满 20 条前允许只进 pending；进入提示词的应是总结后的版本，不应把每一句原文长期塞进 prompt
   - 版本预期：`effectiveVersion` 为 `2`，`summaryBotIds` 只列出实际拥有摘要的 Bot；`hasUnassignedLegacySummary` 只报告布尔值，不显示摘要正文

3. `Shared Game Memory`
   - 在 MCP 客户端调用一次 `memory.player.upsert`，或在 Web 面板点击 `记录地点 Capture Place`。
   - 等待下一次页面自动刷新，展开 `Shared Game Memory`。
   - 预期：`mode` 为 `shared_preferred_merge_with_legacy_fallback`，`lastWriteError` 为 `null`，对应 `playerCount` 或 `placeCount` 增加，路径指向 `C:\xiaoli\memory\players.json` 或 `places.json`。
   - 可选：调用对应的 `memory.player.delete` / `memory.place.delete`，或执行 `memory.clear` 的 `players` / `places` 范围，确认共享文件与面板计数同步减少。
   - 重启导入：重启服务后，确认 `loaded` 为 `true`、`lastLoadError` 为 `null`；共享记录比旧配置更新时会导入，旧配置独有或更新时间更晚的记录会保留。

4. `Chat AI`
   - 开启 `Enable AI Chat` 后，在游戏内发送 `小狸 形容一下自己`
   - 预期：按当前模型返回短句；如果上游模型失败，游戏内至少回退为 `什么？`
   - 同时确认日志里不再出现错误但游戏内完全无反馈的情况

### B. 游戏内行为

4. `Chat Listener` 固定回复
   - 开启 `Enable hi Reply`
   - 游戏内发送 `hi小狸`
   - 预期：游戏内回复 `hihi`，`Chat Listener` 面板显示监听已 attached

5. 跟随链路
   - `Set Goal` 设置 `Follow Judy`
   - 确认小狸开始跟随
   - 点击 `Stop Follow`
   - 预期：游戏内停止跟随，`Last Action Result` 和 `Action History` 都记录成功；`Command History` 新增 `source=web`、`status=executed` 的 `move.stopFollow` 记录
   - 可选：让目标走出可见范围后刷新并展开 `Client Adapter`；首次丢失目标时，`recentActions` 应出现最多三条 `look`，对应小狸原地寻找的转头动作

6. 高频动作按钮
   - 依次测试 `Hold Slot`、`Hold Category`、`Eat`、`Right Click`、`Open Door`、`Attack Nearest`
   - 预期：无论成功或失败，`Last Action Result` 都有明确 JSON；`Action History` 记录每次动作
   - 注意：`Eat` 没有可吃食物时也应该明确失败，不应静默无反馈
   - 注意：`Attack Nearest` 默认 `includePlayers=false`，只会攻击最近的非玩家实体。附近没有动物、怪物等实体，或实体超出 `maxDistance` 时，游戏里不会有明显动作。
   - `Attack Nearest` 的 Web 返回会包含 `selection`：看 `matchingCandidateCount`、`nearestMatchingCandidate`、`nearestObservedEntities` 和 `hint` 判断它到底找到了什么；真正执行结果看 `result.ok` / `result.error`。

7. 观察快照
   - 点击 `Refresh Observe`
   - 预期：`Observe Self`、`Observe Inventory`、`Observe Nearby Players`、`Observe Nearby Entities`、`Observe Blocks` 有数据或明确错误

8. `Self Guard` 自动吃东西
   - 需要游戏内制造低血量或低饥饿条件
   - 预期：触发时 `Action History` 或相关状态面板能看到动作记录；如果条件不足，不应误触发

### C. 暂缓项

- `bot.connect` / `bot.disconnect` 的 Web 按钮暂缓：这类按钮会影响账号登录和服务器连接，先不做一键操作。
- `player.look` Agent dispatcher 的游戏验证暂缓：离线测试已覆盖参数与 Runtime 路由，但默认 allowlist 仍关闭，当前也没有可确定注入带角度 `StrategicAction` 的调试入口；不要用 Planner 是否偶然输出角度判断本项成败。现有 MCP `player.look` 只能验证 Adapter 动作，不能替代 Agent dispatcher 验收。
- `movement.walk` Agent dispatcher 的游戏验证暂缓：离线测试已覆盖参数、旧状态取消和定时停止，但该动作是直接向前控制，没有地形前视或落差保护。默认 allowlist 继续关闭；不要在悬崖、岩浆、深水或复杂地形附近通过自定义权限试跑。
- 模组容器、整合包客户端桥接、复杂 mod 工序暂缓：当前还没有稳定测试入口。
- 需要观察游戏画面的行为效果可以先只看 `Action History`，但最终仍要在游戏内确认真实动作。

## 3. MCP Inspector 常见填写规则（可选）

如果使用图形 MCP Inspector，注意这些类型：

- `boolean` 要填真正的布尔值，不是字符串。
- `array` 要填数组，不是逗号分隔字符串。
- `number` 要填数字，不是字符串。

例如 `agent.configure` 里：

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

如果面板把所有输入框都当字符串，可以优先找 JSON/raw 参数模式；否则很容易出现：

- `Expected boolean, received string`
- `Expected array, received string`
- `Expected number, received string`

## 4. 最小冒烟测试

### 4.1 bot.status

工具：`bot.status`

```json
{
  "botId": "XiaoLi_26.3.3_newnancity"
}
```

通过标准：

- `state` 是 `spawned`
- `profileName` 有值
- `serverHost` 正确

### 4.2 observe.self

工具：`observe.self`

```json
{
  "botId": "XiaoLi_26.3.3_newnancity"
}
```

通过标准：

- 能看到坐标、血量、饥饿值、手持物。

### 4.3 observe.inventory

工具：`observe.inventory`

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "includeSlots": true
}
```

通过标准：

- 能看到 `heldItem`
- 能看到 `itemSummary`
- 如果背包有物品，数量聚合正确

## 5. Agent 基础配置测试

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

如果这次测试需要 planner 调用云端模型，优先在启动前设置：

```powershell
$env:MCBOT_AI_API_KEY = "<your-ai-api-key>"
```

也可以临时在 `agent.configure` 里传 `plannerApiKey`，但只对当前进程生效，重启后不会保存在配置文件里：

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "plannerApiKey": "<your-ai-api-key>"
}
```

然后查：

工具：`agent.status`

```json
{
  "botId": "XiaoLi_26.3.3_newnancity"
}
```

通过标准：

- `enabled = true`
- `mode = "auto"`
- `executorAttached = true`
- `owner = "Judy"`
- `whitelist` 包含 `Judy`

## 5.1 游戏内固定回复测试

`hi小狸 -> hihi` 属于 `chat.listener` 的 `specialReplies`，不是 `agent.configure`。

如果只配置了 agent，游戏内喊 `hi小狸` 不一定会有回应。

推荐方式是在 `.env.local` 里启用：

```text
MCBOT_DEFAULT_CHAT_LISTENER_ENABLED=true
MCBOT_DEFAULT_CHAT_WHITELIST=Judy
MCBOT_DEFAULT_CHAT_WAKE_NAMES=小狸
MCBOT_DEFAULT_CHAT_HI_REPLY=hihi
```

如果服务已经启动，也可以直接在 Web 调试面板点击 `Enable hi Reply`，按默认值确认即可。成功后看 `Chat Listener` 区块：

- `enabled = true`
- `attached = true`
- `specialReplies` 里包含 `hi小狸`

也可以运行时手动启用聊天监听：

工具：`chat.listener.configure`

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "enabled": true,
  "whitelist": ["Judy"],
  "wakeNames": ["小狸"],
  "specialReplies": [
    {
      "trigger": "hi小狸",
      "reply": "hihi",
      "matchMode": "includes"
    }
  ]
}
```

然后在游戏里由白名单玩家发送：

```text
hi小狸
```

通过标准：

- 小狸回复 `hihi`
- `chat.listener.status` 里 `enabled = true`
- `specialReplies` 里包含 `hi小狸`

如果没有回应：

- 确认说话玩家在 `whitelist` 中；如果 `whitelist` 为空则不限制玩家
- 确认 bot 在线且监听器已启用
- 在 Web 调试面板的 `Chat Listener` 区块确认 `wakeNames` 是 `小狸`，不是 `灏忕嫺` 这类乱码
- 调 `chat.listener.status` 看 `specialReplies` 是否被旧配置清空
- 注意 `agent.configure` 不会自动启用 `chat.listener`

## 6. Follow / Stop Follow 核心链路

### 6.1 设置跟随目标

工具：`agent.goal.set`

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "goal": "Follow Judy",
  "rationale": "manual-test",
  "milestones": ["Start following Judy", "Maintain proximity to Judy"],
  "currentMilestoneIndex": 0
}
```

通过标准：

- 游戏里小狸开始跟随 Judy。
- 返回里 `activationAttempted = true`。
- 返回里 `activationTriggered = true`。
- `currentMilestone` 变成 `Maintain proximity to Judy` 或跟随任务已进入运行态。
- Web 面板 Adapter 最近动作出现 `pursue_entity`；玩家停在最小距离内后出现 `stop_movement`，且不会每 250ms 重复刷停止记录。
- 玩家走到比小狸高约一格的位置时，pathfinder 不可用的降级路径仍允许跳跃前进；正常安全 pathfinder 不应挖方块或搭柱。

### 6.2 停止跟随

工具：`move.stopFollow`

```json
{
  "botId": "XiaoLi_26.3.3_newnancity"
}
```

通过标准：

- 游戏里小狸停下。
- 调试面板或 `agent.trace.summary` 不再显示跟随中的活动任务。
- Adapter 最近动作包含一次 `stop_movement`，停止后不会因未完成的旧追击 Promise 再次开始前进。
- 后台检查时可同时看 `Client Adapter` 最近动作、`Recent Events`、`Trace Summary` 和 `State Snapshot`：停止前应能看到当前跟随/追击状态，停止后不应再出现新的 follow pursuit；`Command History` 的 `executed` 只代表停止 handler 返回，不代表服务器确认静止。

### 6.3 进程关闭资源观察

这一项用于验证跟随、定点移动、持续对决、限时直接行走与 Agent executor 生命周期收敛，不要求重新进入游戏：

1. 先让 bot 处于跟随、定点移动、持续对决或 `movement.walk` 状态，并把 Agent 配为 `auto`、确认 `executorAttached=true`；Web 的 `Agent Status`、`State Snapshot` 或 Adapter 最近动作应显示对应活动。定点移动可按 7.9 启动，对决可按 7.8 启动，直接行走必须位于安全封闭区域。
2. 在运行服务的终端按 `Ctrl+C`，观察日志先停止动作 runtime，再进入 bot 断开、持久化 flush 和 MCP 关闭阶段。
3. 日志中不应在 shutdown 后继续出现新的 Agent executor tick、follow tick、定点移动 tick、duel tick、限时行走停止回调、追击/攻击动作或新的跟随失败聊天；shutdown 前已经开始的 Agent run 允许完成，并应在 persistence flush 后再结束进程。若订阅清理失败，应有带 botId 和订阅类型的 warning，但其他 shutdown 阶段仍继续。
4. 重启服务后按正常连接流程检查 bot 状态。该项只验证本地资源释放和日志顺序，不能证明真实服务器已完成断线重连回归。

## 7. Adapter 动作回归测试

这些动作最近被迁移到 `BotRuntime -> ClientAdapter -> MineflayerAdapter`，建议重点测。

### 7.1 interact.eat

前提：

- 小狸背包里有普通食物，例如 `bread`、`apple`、`cooked_salmon`。

工具：`interact.eat`

```json
{
  "botId": "XiaoLi_26.3.3_newnancity"
}
```

通过标准：

- 小狸切出食物并尝试吃。
- 工具返回类似 `Ate 'bread'`。
- Web 面板的 `Client Adapter` 最近动作出现 `eat_food`；这是 Runtime 已调用客户端动作的证据。
- Web 面板的 `Command History` 出现 `interact.eat`，并按实际入口显示 `mcp`、`web` 或 `agent` source。
- Command History 的 `executed` 只表示 handler 正常返回；是否真的吃下食物仍以游戏画面、饥饿值变化和 Adapter 结果综合判断。

也可以直接点击 Web 面板的 `吃东西 Eat`。该入口仍使用 `POST /api/action/eat-food`，成功结果应保留 `{ botId, action: "eatFood", result }` 结构，同时继续写入原 `Action History`。

如果饥饿值是满的，Minecraft 可能不允许吃普通食物。测试时最好先让饥饿值下降，或使用可在特殊条件下食用的物品。

### 7.1.1 inventory.holdByCategory

前提：背包里至少有一种可识别的剑、斧、镐或食物。

工具：`inventory.holdByCategory`

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "category": "sword"
}
```

通过标准：

- 小狸切到该类别中当前可用的最佳物品。
- MCP 返回文本以 `Equipped` 开头；Web 返回仍为 `{ action: "hold-category", result }`。
- Adapter 最近动作出现 `hold_item_by_category`，Command History 出现 `inventory.holdByCategory` 并标出实际 source。
- `category` 只接受 `sword`、`axe`、`pickaxe` 或 `food`；非法 Web 输入在入口处失败，不应形成一次 canonical 命令记录。
- Command History 的 `executed` 只表示 handler 正常返回，仍需结合游戏手持物和 Adapter 结果确认。

### 7.2 interact.rightClick

工具：`interact.rightClick`

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "mode": "tap",
  "reach": 4.5,
  "preferBlockInteraction": true
}
```

通过标准：

- 如果准星对着可交互方块，会尝试右键方块。
- 否则会尝试使用手持物一次。

### 7.3 interact.openDoor

前提：

- 小狸准星对着门，或附近半径内有门。

工具：`interact.openDoor`

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "reach": 4.5,
  "radius": 6
}
```

通过标准：

- 游戏里的门被打开或关闭。
- 工具返回门的名称和位置。
- Web `Last Action Result` 保持 `{ botId, action: "openDoor", result }`，Command History 出现 `interact.openDoor` 并标出实际 source。
- Adapter 最近动作出现 `open_door`；Command History 的 `executed` 仍需结合该结果和游戏内门状态判断。

不覆盖：

- 活板门
- 栅栏门
- 红石门
- 锁门
- modded door 特殊逻辑

### 7.4 interact.attackNearestEntity

前提：

- 附近有可攻击实体。
- 不要在会误伤玩家或违反服务器规则的地方测。

工具：`interact.attackNearestEntity`

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "maxDistance": 4.5,
  "includePlayers": false
}
```

通过标准：

- 小狸看向目标并攻击一次。
- 工具返回目标 id、type、name、distance。

这只验证“一次攻击工具”。决斗、自卫反击、持续战斗循环不是这条测试的范围。

### 7.5 聊天指令的一次攻击

前提：

- Chat Listener 已启用，测试玩家在白名单中。
- 先准备一个 4.5 格内的玩家目标，再准备一个 4.5 格外但仍可见的玩家目标。
- 附近不要放置不希望误伤的生物或玩家。

依次在游戏聊天发送：

```text
小狸，攻击 <近距离玩家名>
小狸，攻击 <远距离玩家名>
小狸，攻击 NotVisible_01
小狸，打它
```

通过标准：

- 近距离玩家只被攻击一次；背包有剑时优先持剑，没有剑时尝试斧，两者都没有时允许空手攻击。
- 远距离玩家只触发靠近并回复，不会立刻攻击。
- `NotVisible_01` 不可见时回复“没看到 NotVisible_01”，不会退化为攻击附近实体。
- “打它”只攻击 4.5 格内最近的非玩家实体；没有目标时给出明确反馈。
- Web 面板 Adapter 最近动作能看到武器持有和一次攻击记录；远距离靠近出现 `pursue_entity`，并且不会紧接着出现 `attack_player`。

这条测试不覆盖“挑战”持续决斗；持续决斗已走独立的 Adapter 战斗会话链，按 7.8 节单独验证。快捷栏整理请按下一节单独验证。

### 7.6 inventory.organizeHotbar

规则：快捷栏 1 放最佳剑、2 放最佳斧、3 放最佳镐、9 放优先食物，完成后选中第 1 格。

工具：`inventory.organizeHotbar`

```json
{
  "botId": "XiaoLi_26.3.3_newnancity"
}
```

依次验证：

1. 背包中放入多种材质的剑、斧、镐和食物，确认选择更高材质等级的物品。
2. 让目标快捷栏已有其他物品，确认原物品被移到普通背包空槽，没有消失。
3. 编少一种或多种类别，确认对应 action 为 `missing`，其余类别仍正常整理。
4. 填满背包且让目标槽被占用，确认对应 action 为 `failed_no_empty_slot`，不会覆盖目标槽。
5. 在游戏聊天发送“小狸，整理快捷栏”，确认得到“整理好了”或明确失败反馈。

通过标准：

- MCP 返回 `rule` 和四个分类的结构化 `actions`。
- `client.adapter.status.recentActions` 出现 `organize_hotbar`，详情包含实际槽位移动数与被阻塞数。
- 任一失败都不能造成物品覆盖或静默丢失。

### 7.7 combat.prepareBattle 槽位回归

工具：`combat.prepareBattle`

```json
{
  "botId": "XiaoLi_26.3.3_newnancity"
}
```

依次验证：

1. 把铁剑放在普通背包，快捷栏第 1 格放置其他物品，并至少留一个空槽。
2. 调用工具，确认第 1 格原物品移入空槽、铁剑进入第 1 格、小狸选中铁剑，并继续尝试穿戴护甲。
3. 再次调用，确认铁剑已在第 1 格时不会重复搬动物品。
4. 填满背包并让第 1 格被占用，再次调用；铁剑换槽应安全失败并回退到直接持有最佳剑或斧，调用不能无限等待。

通过标准：

- 正常换槽能在有限时间内返回 `prepared_battle`。
- 满背包时不会覆盖任何槽位；有其他可用武器时仍能完成准备，没有可用武器时返回明确错误。
- 该测试只验证准备阶段，不启动持续决斗。

### 7.8 combat.challengeEntity 持续决斗

前提：

- 在安全测试区域放置两个同类生物，距离不同。
- 不要在公共服务器或可能误伤其他玩家的区域测试。

工具：`combat.challengeEntity`

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "targetText": "僵尸",
  "maxDistance": 16,
  "requester": "Judy"
}
```

依次验证：

1. 使用“僵尸”“苦力怕”“监守者”等中文别名，确认能匹配对应英文实体名，并优先选择最近的非玩家实体。
2. 改用 `zombie` 等英文名，确认结果一致。
3. 让目标短暂离开客户端视野后在 2.5 秒内回来，决斗应继续。
4. 让目标持续不可见超过约 2.5 秒，任务应以 `cancelled` 结束并报告目标丢失。
5. 观察目标在 3 格外时追击、3 格内停止前进、4.5 格内按攻击冷却连续攻击。
6. 击杀目标后确认只发送一次“就这”，停止移动并将 duel task 标记为完成。
7. 让小狸在决斗中死亡，确认任务以 `failed` 结束。
8. 断开并重连小狸后重新发起一次决斗，击杀目标，确认不会重复发送“就这”或重复结束任务。

通过标准：

- `agent.trace.summary` / `agent.events.tail` 中的 duel 生命周期与实际行为一致。
- 不会选择玩家实体，也不会因目标一帧消失就立即取消。
- 结束后没有残留追击、重复攻击或重连遗留的死亡监听器。
- Web 面板 Adapter 最近动作中，目标移动时出现 `pursue_entity`，有效攻击出现 `attack_entity`；目标恰好移出 4.5 格造成一次失败记录可以接受，下一次 tick 应继续追击而不是换目标。

当前限制：持续决斗的 interval、session 元数据和双订阅已由独立生命周期管理，上层动作链也已通过 Adapter；当前只有 Mineflayer Adapter 实现了追击和攻击。生命周期不选择目标、不执行 tick 或动作，离线测试也不能代替真实游戏中的死亡、丢失、追击失败和断线回归，因此本测试不代表整合包客户端已支持持续决斗。

### 7.9 固定坐标移动

前提：

- 在空旷、安全且没有悬崖的位置测试。
- 先用 `observe.self` 记下当前位置，再选择水平距离约 8-12 格、Y 坐标接近的目标。

在 Web 调试面板的 `Raw Action Runner` 中选择 `move.goToPosition`，填写：

```json
{
  "x": 120,
  "y": 64,
  "z": 120,
  "stopRadius": 2.3
}
```

把示例坐标替换为当前世界的安全坐标，然后依次验证：

1. 执行后 bot 开始移动，Web 的 Adapter 最近动作出现 `move_to_position`。
2. 到达目标半径后 bot 停止，最近动作出现 `stop_movement`，Agent task 不再是 `move_to_position`。
3. 再发一个较远目标，途中通过 MCP 调用 `movement.stop`；bot 应立即停止，等待 2 秒也不能重新前进。
4. 连续提交两个不同目标，bot 应以前后最后一个目标为准，旧动作异步失败不能停掉新目标。
5. 在有普通障碍物的安全区域复测，确认不会自动挖方块、搭柱、放脚手架或选择危险落差。
6. 选择一个被完整墙体隔断或必须明显长绕行、但不会让 bot 掉落的目标；首轮规划应失败，`move_to_position` 在 Adapter 最近动作中记录 `SafePathError` 对应原因，bot 保持停止。
7. 选择一条开始时可通行的安全路线，等 bot 已经开始移动后再封住唯一通路；bot 应停止，Adapter 最近动作新增一条失败的 `move_to_position`，错误包含 `continuous route is unavailable or unsafe`。
8. 封路失败后立即提交另一个可达目标；旧目标的迟到事件不得停止新目标。
9. 连续目标执行期间展开 `State Snapshot`：`currentActivity.detail` 应反映最后提交的 `goto:...` key；停止或到达后不应继续显示旧 key。该 key 只用于本地相关性门控，不代表服务器已确认移动。

当前限制：固定坐标移动上层已通过 Adapter，且不会在安全 Pathfinder 不可用时退化为直接移动；interval 与 movement subscription 由独立生命周期管理，movement correlation key 由另一个独立 Store 管理。离线测试已覆盖首轮和后续 `noPath`、`timeout`、长绕行、动态实体位置、目标替换、主动停止及监听清理。真实服务器上的绕障、途中封路和停止行为仍需游戏内回归。容器等待尚未完成迁移，采矿目前只迁移了单块试点。

### 7.10 单块采矿安全接近

前提：

- 小狸附近准备一个能安全走到的矿物，以及一个隔着高墙或深坑、无法在不破坏地形时抵达的矿物。
- 使用 MCP 客户端调用 `mine.digNearestVisible`；`blockName` 填实际方块 ID，例如 `coal_ore`。
- 测试期间不要同时启动 `mine.collectVisible` 或自动“下矿”目标，避免旧批量入口干扰观察。

可达样例：

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "blockName": "coal_ore",
  "searchRadius": 24,
  "reachDistance": 4.5,
  "moveNear": true,
  "visibleStep": 0.2,
  "approachTimeoutMs": 20000
}
```

依次验证：

1. 可达目标被挖掉，沿途没有方块被挖或放置。
2. Web `Client Adapter` 的最近动作出现 `mine_block`，成功结果包含 `outcome: "mined"`、目标坐标和前后距离。
3. 对不可达目标执行同一工具，小狸停止接近，不挖路、不搭路、不搭柱、不放脚手架。
4. 失败结果为 `approach_unreachable`，动作或任务详情包含 `no_path`、`path_timeout`、`detour_too_long` 或 `approach_timeout` 之一。
5. 游戏聊天只出现一次“我跟不上你啦”，等待数秒不应重复刷屏。

当前限制：离线测试已覆盖成功、目标消失/变化、视线受阻、不可挖、pathfinder 缺失、非法输入和 `no_path` 安全配置，但不能代替真实服务器 pathfinder 回归。其余 `mine.collectVisible`、Agent collect 和玩家附近清理仍是旧实现，本轮不要用它们判断试点是否通过。

## 8. Self-Guard 自动吃饭测试

前提：

- 小狸背包里有可识别食物。
- 小狸饥饿值低于阈值，或血量偏低且饥饿值不满。

配置：

工具：`selfGuard.configure`

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "enabled": true,
  "tickMs": 2000,
  "lowFood": 19,
  "lowHealth": 10,
  "criticalHealth": 6,
  "autoEat": true,
  "chatAlerts": true
}
```

立即检查：

工具：`selfGuard.check`

```json
{
  "botId": "XiaoLi_26.3.3_newnancity"
}
```

通过标准：

- `recommendation.shouldEat = true`，如果当前饥饿值低于 `lowFood`。
- 过几秒后小狸尝试吃东西。
- 工具层不应直接报 `consume` 相关错误；吃饭动作应走 `runtime.eatFood()`。
- Web 面板的 Agent 事件应出现一次 `low_food`，`Client Adapter.recentActions` 应出现 `eat_food` 的成功或明确失败记录。
- 背包没有食物时应收到“没有吃的”反馈，不能静默假装吃过。

注意：

- 目前还没有食物白名单、询问 Judy、性价比算法。
- 当前只是基础自动进食能力。
- 本节的周期生命、饥饿和背包判断已读取 Adapter 快照；受伤事件、天气与原生实体反击不在本节迁移范围。

## 9. Agent 状态观察

常用工具：

### agent.goal.status

```json
{
  "botId": "XiaoLi_26.3.3_newnancity"
}
```

看：

- `strategicGoal`
- `currentMilestone`
- `remainingMilestones`

### agent.trace.summary

```json
{
  "botId": "XiaoLi_26.3.3_newnancity"
}
```

看：

- `activeTask`
- `lastAction`
- `lastSkill`
- `lastGoal`
- `recentEvents`

### agent.events.tail

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "count": 20
}
```

看：

- `goal_completed`
- `milestone_advanced`
- `task_finished`
- `task_failed`
- `low_food`
- `low_health`

如果工具返回的 events 和游戏内行为不一致，以游戏内行为和底层工具 JSON 为准，不要让聊天模型总结带偏。

### 9.1 规划请求拆分回归（待你方便时测）

本轮离线测试已覆盖请求体、冷却、错误诊断、计划翻译和完整模拟执行链，不需要现在进游戏。以后先完成第 0 节，再补下面这一项：

1. 记录当前 Agent 模式。确认 planner 地址、模型和 key 有效，Agent 已启用，`executorAttached=true`；`assist` 或 `auto` 均可，`manual` 不消费排队动作。
2. 先用已验证的 `Follow Judy` 让小狸跟随，再在 Web 工具运行器或 MCP 调用 `agent.runOnce`：

   ```json
   {
     "botId": "XiaoLi_26.3.3_newnancity",
     "userInstruction": "停止跟随，然后待命，不要做其他动作。",
     "requester": "Judy"
   }
   ```

3. 检查 `agent.status.lastPlannerRequest.state=success`。查看原始 `plan` 和 `executionResult`，确认计划是停止跟随；`applied_directive_...` 只表示计划已入黑板，尚不是执行成功。
4. 等待一个 executor 周期，在 Command History 查 `move.stopFollow`、`source=agent` 的结果，同时确认游戏内确实停下。有 handler 成功记录但游戏未停，仍判为未通过。
5. 用 `agent.framework.status` 查看 `snapshot.executionEvents`，再用 `agent.events.tail` 和 `agent.trace.summary` 对照；`planner_requested`、`planner_result` 和对应 Skill 的 `task_finished` 或 `task_failed` 应在三处使用同一组可观察事件。`snapshot.recentEvents` 是内部规范化输入流，可能额外包含感知刷新，不作为三处调试出口的唯一依据。
6. 若请求失败，保留 `lastPlannerRequest` 和原始错误。未结束冷却时再次调用应提示 `cooling down`；失败请求不能伪报计划成功。最后恢复原模式，按第 10 节清理目标。

没有真实服务器或 API 时，只需开发者执行 `npm test -- test/openai-agent-planner.test.ts test/planner-request-runner.test.ts test/agent-plan-to-directive.test.ts test/agent-planner-integration.test.ts test/agent-planning-strategy.test.ts test/agent-planning-turn.test.ts test/agent-planning-injection-integration.test.ts`；它使用隔离目录、临时本机模型服务和模拟客户端，不读取正式账号。

2026-10-18 补充：请求级和完整轮次离线回归已覆盖超时、信号取消、失效后迟到回复、同 Bot 请求交错、多 Bot 隔离、配置重载、shutdown 和异步聊天；生产协调器已接入，取消后的旧结果不会新增目标、队列或计划发言。真实 API 和游戏仍需按本节第 1-6 步确认，离线测试不等于服务器执行证据。

### 9.2 分层动作执行回归（积压，方便时测）

先完成第 9.1 节的停止跟随测试，不需要为本项开放新工具或更换配置文件：

1. 在 Web 的 `State Snapshot` / `agent.framework.status` 展开 `activeAction`、`activeSkill` 和 `queuedActions`。动作尚未执行时在队列；执行期间可能短暂显示 active 状态，停止跟随很快，看不到这个瞬间不算失败。
2. 等一个 executor 周期后，核对 `task_finished.payload.skill=move.stopFollow`，并检查 active action/skill 已清空、该动作不再排队。游戏内应实际停止；`executed` 和 `task_finished` 都不单独证明服务器已确认。
3. 若出现 `hierarchical runtime blocked tool '...'`，表示 Skill 没有当前工具权限，预期有 normal 优先级的 `task_failed`，不应有该次客户端动作。记录当前 `allowedTools`，不要为了消除提示直接开放全部权限。
4. 若出现 `failed ...`，保留 `task_failed.payload.skill` / `lastError`、`lastPlanResult` 和相关 Command History；已绑定的工具执行结束后 active action/skill 应清空。确认下一条安全指令仍可执行。
5. 尚有 active task 时，部分冲突动作会继续留在队列；先通过正常停止入口结束原任务，再观察它能否执行。当前跟随任务允许 `move.stopFollow` 打断，不需要等跟随自行完成。

本轮已离线验证以上权限、冲突、失败和清理边界。开发者定向命令：`npm test -- test/agent-runtime-action-executor.test.ts test/agent-planner-integration.test.ts`。规划请求的取消保护覆盖计划提交之前；已提交或开始的动作、旧工具兼容步骤没有因本次抽取获得取消或回滚保证。

权限拒绝事件的订阅者异常清理已由离线故障注入测试覆盖，无需在游戏中专门制造故障。若实际运行出现订阅者异常，保留后台原错误，并在下一次刷新确认 `activeAction` / `activeSkill` 不残留被拒动作、下一条安全指令仍能执行。同步事件派发可能在异常处中断，因此缺少 `task_failed` 记录时应同时查看后台错误日志。

### 9.3 Agent 指定食物回归（积压，方便时测）

这项验证规划后的 `eat_food` 编译链，直接点击 Web「吃东西」只能覆盖第 7.1 节，不能代替本项。目前不需要立刻测试。

1. 先按第 0 节启动，确认 Agent 为 `assist` 或 `auto`、`executorAttached=true`。检查当前 `allowedTools` 是否已有 `interact.eat`；若没有，保留此项待测，不要为测试开放全部工具。记录原模式与权限，结束后恢复。
2. 让小狸背包同时有 `cooked_salmon` 和另一种食物（如 `bread`），饥饿值低于满值，停止原跟随任务。通过 Web 工具运行器或 MCP 调用 `agent.runOnce`：

   ```json
   {
     "botId": "XiaoLi_26.3.3_newnancity",
     "userInstruction": "只吃背包中的熟鲑鱼 cooked_salmon，不要选其他食物，不做其他动作。",
     "requester": "Judy"
   }
   ```

3. 检查原始返回的 `plan`：应有 `eat_food.params.itemName="cooked_salmon"`，或旧 `interact.eat` 的 `arguments.itemName`。模型若漏掉或选错名称，记录为规划问题；不能只凭自然语言回复认定已测试指定食物。`applied_directive_...` 只表示排队。
4. 等一个 executor 周期，检查 Command History 的 `interact.eat`、`source=agent` 结果和 `task_finished`；结果应包含 `ate 'cooked_salmon'`。同时看游戏手持、熟鲑鱼数量及饥饿值，确认没有改吃面包，active action/skill 最终清空。
5. 移走熟鲑鱼、保留另一种食物，等 planner 冷却后再次发同一请求；先确认计划仍指定 `cooked_salmon`。预期 `task_failed` / 命令失败包含 `Food item 'cooked_salmon' not found in inventory`，不能改吃其他食物。如果模型改为观察或不执行，该次没有覆盖“指定食物缺失”路径，保留待测。
6. 最后不指定食物地请求「吃点东西」，确认计划的 `eat_food.params` 没有 `itemName` 时仍能自动选择可用食物；满饥饿值导致不能吃不算参数传递失败，按第 7.1 节准备条件后再测。

离线回归已覆盖指定名称、自动选择、无效类型/空串、显式动作与旧步骤接线，开发者命令：`npm test -- test/agent-eat-skill.test.ts test/agent-planner-integration.test.ts test/agent-tool-executors.test.ts test/eat-command-integration.test.ts test/skill-permission-audit.test.ts`。未找到食物及实际消耗仍以 Adapter 和游戏证据为准。

## 10. 清理测试状态

停止跟随：

```json
{
  "tool": "move.stopFollow",
  "arguments": {
    "botId": "XiaoLi_26.3.3_newnancity"
  }
}
```

清空 goal：

```json
{
  "tool": "agent.goal.clear",
  "arguments": {
    "botId": "XiaoLi_26.3.3_newnancity"
  }
}
```

断开 bot：

```json
{
  "tool": "bot.disconnect",
  "arguments": {
    "botId": "XiaoLi_26.3.3_newnancity"
  }
}
```

## 11. 常见问题

### 调试面板空白

先等 5 到 10 秒。默认 bot 可能晚于页面启动。

如果仍然没有：

- 看终端里有没有默认 bot 创建日志。
- 调 `bot.status` 看 bot 是否存在。
- 确认 `MCBOT_DEFAULT_ENABLED=true`。
- 确认 `MCBOT_DEFAULT_AUTO_CONNECT=true`。

### 调试面板拒绝连接

这说明端口没有服务在监听，不是 bot 没上线。

如果页面已经打开后 MCP server 短暂重启，顶部状态会显示 `刷新失败 refresh failed`，并保留最近一次成功加载的数据。server 恢复后，页面下一轮自动刷新会重新加载；也可以手动点 `刷新 Refresh`。

检查端口：

```powershell
Get-NetTCPConnection -LocalPort 4637 -ErrorAction SilentlyContinue
```

检查 Node 进程：

```powershell
Get-CimInstance Win32_Process -Filter "name = 'node.exe'" | Select-Object ProcessId,CommandLine
```

如果看不到 `moony-mcbot`、`tsx src/main.ts`、`dist/main.js` 之类的命令行，说明当前没有启动本项目服务。回到项目目录执行：

```powershell
cd C:\xiaoli\moony-mcbot
powershell -ExecutionPolicy Bypass -File .\scripts\start-mcp-server.ps1
```

如果你是通过 MCP Inspector / Cherry Studio / VS Code MCP 启动的，也必须保持那个 MCP server 连接处于运行状态；断开连接后，同进程的调试面板也会消失。

### bot.status 显示 not found

说明当前进程里还没有这个 bot runtime。

处理方式：

- 检查默认 bot 环境变量。
- 或手动调用 `bot.create`。

### agent.configure 类型错误

通常是 Inspector 把值当字符串传了。

确认：

- `enabled` 是 `true`，不是 `"true"`。
- `allowProactiveAction` 是 `false`，不是 `"false"`。
- `whitelist` 是 `["Judy"]`，不是 `"Judy"`。
- `currentMilestoneIndex` 是 `0`，不是 `"0"`。

### agent 设置了目标但游戏里没动作

检查：

- `agent.status.executorAttached`
- `agent.status.mode`
- `agent.status.allowProactiveAction`
- `agent.goal.status`
- `agent.trace.summary`
- 目标是否能被当前保守激活规则识别，例如 `Follow Judy` 或 `下矿`

### interact.eat 没吃

常见原因：

- 饥饿值是满的，普通食物不能吃。
- 背包里没有被当前 allowlist 识别为食物的物品。
- 手上动作被服务器/状态打断。

先用 `observe.inventory` 和 `observe.self` 确认饥饿值与食物。

### AI / planner 报 API key 为空

现在 API key 有两个可用入口：

1. 推荐：启动前设置环境变量。

```powershell
$env:MCBOT_AI_API_KEY = "<your-ai-api-key>"
```

2. 临时：运行后通过工具传入。

`chat.ai.configure`：

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "apiKey": "<your-ai-api-key>"
}
```

`agent.configure`：

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "plannerApiKey": "<your-ai-api-key>"
}
```

注意：

- 这两个工具参数只作为本次运行时秘密值使用。
- 不会写入 `chat-configs.json`。
- 如果旧配置文件里还有 `apiKey` / `plannerApiKey`，新版会忽略它们。
- 如果重启服务后又提示 key 为空，说明你没有重新设置环境变量，或者没有重新调用 configure 工具。

### AI 返回空内容

如果日志显示 AI response content is empty，说明请求已经到达模型服务，但返回里没有可直接发送到游戏聊天的正文。继续看括号里的诊断字段：

- has_reasoning_content=true：模型可能只返回了推理内容，建议换非 thinking 输出模型，或调整模型服务参数。
- inish_reason=length：输出可能被截断，建议换模型或降低上下文长度。
- message_keys / content_type：用于判断服务是否返回了非标准 OpenAI-compatible 格式。

对于 ModelScope 这类 OpenAI-compatible 网关，优先确认：

- MCBOT_AI_API_BASE_URL 是否包含 /v1。
- MCBOT_DEFAULT_CHAT_AI_MODEL 是否是该网关实际支持且会返回 message.content 的 chat 模型。
- 如果一个模型一直返回空内容，先换一个明确支持普通 chat completion 输出的模型做对照。
## 12. 连接生命周期回归

自动化部分不需要进入游戏，用于覆盖最容易出错的竞态和监听器所有权：

- 认证尚未返回时调用 `bot.disconnect`，旧连接完成后不得把状态改回 `spawned`。
- 自动重连等待期间调用 `bot.disconnect`，旧定时器不得再次调用认证或建立连接。
- 同一轮重复断开只调用一次 Adapter，并返回同一个 Promise；断开清理完成前不得开始新连接。
- Mineflayer 断开必须等待 `end`，`quit()` 抛错或 5 秒内未收到 `end` 时向调用方报告失败，并清理临时监听器。
- 连接失败只移除 Runtime 自己注册的 `login` / `kicked` / `error` / `end` 监听器，不得清空 Mineflayer 或插件监听器。

```powershell
cd C:\xiaoli\moony-mcbot
npx tsx --test test/mc-client-service-lifecycle.test.ts test/client-adapter-lifecycle.test.ts test/bot-runtime-connection.test.ts
```

真实服务器仍需手测：

1. 等待 `bot.status.state` 为 `spawned`，在游戏中确认只出现一个小狸实例。
2. 调用一次 `bot.disconnect`；可在第一条尚未返回时再调用一次，两个请求都不应造成重复退出、重复错误或自动重连。
3. 游戏中确认小狸实际下线；后台状态应保持 `disconnected`、`reconnectInProgress=false`。正常服务端应很快返回，超过 5 秒则工具明确失败，不能继续显示 `spawned`。
4. 再调用 `bot.connect`，确认只建立一个新连接，旧连接不会迟到后重新上线。
5. 单独启动服务后按一次 `Ctrl+C`，确认 shutdown 等待 bot 断开，游戏中不留下在线实例。

当前状态：离线回归已通过；真实服务器的重复断开、断开后重连和 `Ctrl+C` 仍待验证。

安全移动回归：跟随、定点移动、追击和 `mine.digNearestVisible` 的接近阶段使用不可挖掘、不可搭路/搭柱的 Pathfinder 配置。定点移动与实体追击在 Pathfinder 缺失、拒绝目标，或首轮及后续规划 `noPath`、`timeout`、长绕行时会停止并记录失败，不再切换为直接移动；跟随上层只反馈一次“我跟不上你啦”。持续失败以 `movementId` 关联当前任务，旧目标事件不能停止新目标。`movement.walk` / `wander_area` 是限时直接前进，不属于这条安全 Pathfinder 保证，默认权限保持关闭。单块工具只会在进入可触及范围并复核目标后显式挖目标方块；`mine.collectVisible` 等三个批量入口尚未迁移，仍需分开看待。

## 13. 持久化退出回归

这项不要求进入游戏，但必须从一个可按 `Ctrl+C` 的独立 PowerShell 启动，不要借 Cherry Studio 或 Inspector 代管进程：

```powershell
cd C:\xiaoli\moony-mcbot
powershell -ExecutionPolicy Bypass -File .\scripts\start-mcp-server.ps1
```

1. 在 Web 面板执行一次会修改持久化配置的动作，例如 `Set Goal`、`Enable hi Reply` 或 `Enable AI Chat`。
2. 让白名单玩家产生 1-19 条可记录聊天，或先确认 `Shared Chat Memory` 的 pending count 大于 0。
3. 回到启动服务的 PowerShell，只按一次 `Ctrl+C`。
4. 日志应依次出现收到 shutdown signal 和 shutdown completed；不应持续出现 watchdog、planner 或聊天回复动作。
5. 用以下命令确认配置、聊天状态和共享游戏记忆 JSON 完整且没有临时文件残留：

```powershell
Get-Content "$env:LOCALAPPDATA\moony-mcbot\config\chat-configs.json" -Raw | ConvertFrom-Json | Out-Null
Get-Content "C:\xiaoli\memory\chat-summary-state.json" -Raw | ConvertFrom-Json | Out-Null
@("C:\xiaoli\memory\players.json", "C:\xiaoli\memory\places.json") | ForEach-Object {
  if (Test-Path $_) { Get-Content $_ -Raw | ConvertFrom-Json | Out-Null }
}
Get-ChildItem "$env:LOCALAPPDATA\moony-mcbot\config", "C:\xiaoli\memory" -Force -Filter "*.tmp"
```

如果本轮没有创建玩家或地点记忆，对应共享文件可能尚不存在；命令会自动跳过，一旦存在就必须可解析。

6. 重新启动服务，确认目标/聊天配置仍存在，`Shared Chat Memory` 的 pending count 与退出前一致。

边界：`SIGKILL`、任务管理器“结束进程”、断电或系统崩溃不会执行 shutdown hook；原子 rename 只能保证旧 JSON 不被半写覆盖。`chat-summary-state.json` 已在后续修复中升级为兼容 v1 读取的 `version: 2`；`chat-configs.json` 仍没有顶层版本字段。

### 多 Bot 聊天摘要隔离

此项主要由离线回归测试覆盖。需要手测时，准备两个不同 `botId`，分别累计 20 条可记录聊天并刷新 `Shared Chat Memory`：

1. `summaryBotIds` 应同时列出两个 Bot。
2. 两个 Bot 的 AI 回复只能使用自己的滚动摘要，不应提及只在另一个 Bot 会话中出现的玩家或话题。
3. 重启后 `effectiveVersion` 仍为 `2`，两个 pending count 和摘要归属保持不变。
4. 无法准备第二个 Bot 时可跳过，不影响小狸当前单 Bot 使用；不要为了此项在正式服务器创建无用途账号。

### 配置热重载事务检查

此项不需要进入游戏。先运行离线回归：

```powershell
cd C:\xiaoli\moony-mcbot
npx tsx --test test/chat-config-reload.test.ts
```

该测试会使用临时目录，不会修改正式 `chat-configs.json`；它覆盖损坏 JSON 不改状态、手动缺文件失败、启动缺文件可继续、存续条目的运行时 key 保留、删除条目生效，以及 MCP 只有成功时才返回 `reloaded: true`。

需要人工复核时，先备份 `%LOCALAPPDATA%\moony-mcbot\config\chat-configs.json`，再在独立测试实例中操作：

1. 调用 `config.rawStatus` 记录当前 Agent owner 和四类配置状态。
2. 把某个已知布尔字段临时改成字符串，例如 `"enabled": "true"`，调用 `chat.config.reload`。
3. 预期结果为 MCP error，内容包含具体字段路径；响应中不应出现 `reloaded: true`，再次查看 `config.rawStatus` 应与步骤 1 一致。
4. 恢复合法 JSON，从四个 `*ByBotId` 表中删除测试 Bot 条目，再调用 `chat.config.reload`。
5. 成功响应应包含 `reloaded: true`，并在对应的 `removedCounts` 中显示删除数量。若 `.env.local` 配置了同一个默认 Bot，环境层可能在提交后重新创建或覆盖该 Bot，这是既定优先级，不是删除失败。
6. 测试结束后恢复备份并再次重载。不要把 API key 或密码写进测试文件。

### MCP SDK 1.30 外部客户端回归

这项不需要进入游戏，用于补充离线内存传输测试无法证明的 stdio 客户端兼容性：

1. 在项目目录执行 `npm run build`。
2. 用 VS Code MCP、MCP Inspector 或其他 stdio 客户端启动 `C:\Program Files\nodejs\node.exe`，参数为 `C:\xiaoli\moony-mcbot\dist\main.js`。不要同时让两个客户端占用同一个 stdio 进程。
3. 刷新工具列表，确认至少能看到 `bot.list`、`agent.status`、`agent.goal.status` 和 `observe.self`，且没有初始化或 schema 错误。
4. 调用无参数的 `bot.list`，确认返回 MCP text content；若当前进程已自动创建默认 Bot，再用其 `botId` 调用 `agent.status`。
5. 关闭客户端，确认子进程正常结束，不留下持续运行的重复 bot 实例。

当前状态：待手动验证。离线自动化已覆盖 SDK Client -> 内存 Transport -> McpServer 的工具发现与调用，但不能替代真实外部客户端的 stdio 生命周期。

### Yggdrasil 1.8 真实认证回归

先运行不使用正式账号的本地契约测试：

```powershell
cd C:\xiaoli\moony-mcbot
npx tsx --test test/auth-service.test.ts test/bot-runtime-connection.test.ts
```

这 5 项测试验证自定义 `/authserver/authenticate` 路径、请求字段、profile UUID 规范化、缺字段、认证拒绝和连接取消，但不访问真实 Yggdrasil 或 Minecraft 服务器。

真实回归步骤：

1. 确认账号、密码只存在 `.env.local` 或当前进程环境变量中，不粘贴到测试、文档、Web Raw Action 或聊天记录。
2. 单独启动项目，等待默认 Bot 自动连接；记录 `bot.status` 的 `authenticating -> connecting -> spawned` 状态变化。
3. 确认 `profileName` / `profileId` 与账号一致，游戏中只出现一个小狸实例，错误日志不包含密码、access token 或 client token。
4. 执行一次正常断开，再重新连接；旧连接不得在新连接后重复 spawn，session server 握手不得报 token/profile 错误。
5. 若认证失败，保留脱敏后的状态码、错误消息和连接代次，不要把正式凭据发到 issue 或测试记录中。

当前状态：待手动验证。本机 2026-08-14 的 `npm audit --omit=dev` 返回 0 项，但这不能替代真实认证、session server 或游戏行为验收。

## 14. 真实服务器回归门槛

以下项目不能由当前 Fake Adapter 和离线测试证明。按顺序执行；任何一项失败都先保留日志、Web action history 和 `bot.status`，不要继续测试后续危险动作。

| 状态 | 场景 | 游戏内观察 | 后台证据 |
| --- | --- | --- | --- |
| 待测 | Yggdrasil 登录与 spawn | 小狸正常出现且不会重复上线 | `bot.status.state=spawned`，只有一个连接 generation |
| 待测 | 手动断开与自动重连 | 断开后不被旧连接拉回；服务器断线后按策略重连 | reconnect 次数、错误码和 generation 连续可解释 |
| 待测 | 跟随与停止 | 开始跟随、停止后立即停下 | 当前 movement、action history 与游戏行为一致 |
| 待测 | 不可达跟随 | 不挖路、不搭路、不跳危险落差，只说一次“我跟不上你啦” | 一条结构化 movement failure，旧 `movementId` 不影响新任务 |
| 待测 | 单块采矿 | 只挖指定可见方块，不挖接近路径 | `mineBlock` 包含目标复核、接近和最终结果证据 |
| 待测 | 攻击与决斗 | 单次攻击不追杀；持续决斗按会话结束 | 稳定 entity id、结束原因和攻击记录一致 |
| 待测 | 容器会话 | 箱子/木桶打开、读写、关闭均正确 | 失败时有明确阶段，物品数量前后可核对 |
| 待测 | 聊天回显与监听 | 一条白名单消息最多触发一次回复/动作 | 去重事件、AI 请求和记忆 pending 各增加一次 |
| 待测 | 正常退出与重启 | 退出后 bot 下线，重启恢复配置 | shutdown 各阶段完成，JSON 可解析且无 `.tmp` 残留 |

当前不把整合包客户端、模组 GUI 或模组容器列入这张表；它们要等 `ModdedClientAdapter` Bridge MVP 存在后单独建立验收矩阵。
