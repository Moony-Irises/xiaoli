# 2026-07-31 全项目架构与实现审计

## 1. 结论

当前项目已经不是“只有 MCP 工具的脚本集合”，而是一个具备本地控制面、事件与黑板、客户端适配层、持久化记忆和安全动作约束的 **Minecraft 同伴 bot 成熟原型**。

它目前适合：

- 在原版或协议兼容服务器上运行一个本地 bot；
- 通过 Web、MCP 或游戏聊天观察和触发确定性动作；
- 验证分层 Agent、共享记忆和安全移动策略；
- 为未来的真实整合包客户端 Bridge 保留上层接口。

它目前还不是：

- 可直接操作 Forge、Fabric 或 NeoForge 客户端内部状态的整合包 bot；
- 已完成真实服务器回归的稳定发行版；
- 只有一套动作、状态和配置真相源的收敛架构；
- 可以在无人监护下长期运行的生产服务。

因此下一阶段不应继续堆玩法，也不应推倒重写。正确顺序是：**先修运行确定性，再收口动作和适配器边界，最后接 Modded Client Bridge。**

## 2. 审计范围与基线

本轮审阅了启动、认证、连接、重连、退出、持久化、ClientAdapter、动作、寻路、采矿、战斗、Agent、提示词、共享记忆、MCP、Web、测试、CI 和依赖链。

审计开始时的静态基线（不含本轮新增审计报告和 changeset）：

| 项目 | 结果 |
| --- | ---: |
| `src/**/*.ts` | 59 个文件 |
| `test/*.test.ts` | 42 个文件 |
| `docs/**/*.md` | 183 个文件 |
| 未发布 changeset | 164 个文件 |
| `src/tools/action-tools.ts` | 11,048 行 |
| `src/debug/debug-server.ts` | 1,866 行 |
| 动作工具注册 | 5 个 bot 工具、15 个 Catalog 工具、64 个旧式动作工具 |
| 生产依赖审计 | 17 项：1 low、7 moderate、9 high |

本轮没有连接真实 Minecraft 服务器，真实登录、协议握手、游戏内动作和断线重连结论仍以手工回归为准。

## 3. 当前运行链

```text
.env.local / persisted config / shared memory
                    |
                    v
                 main.ts
                    |
         +----------+----------+
         |                     |
         v                     v
    BotRegistry          Web debug server
         |
         v
     BotRuntime ------> ClientAdapter ------> Mineflayer
         |                    |
         |                    +---- snapshots / actions / events
         v
 action-tools.ts
   |      |      |
   v      v      v
 MCP    Chat   Agent bridge ------> Agent Blackboard
```

目标形态仍应是：MCP、Web 和聊天只负责接收请求，统一调用 `ActionDispatcher`；Dispatcher 再经过权限、能力和参数校验调用 Adapter，并把动作证据写回同一份黑板和事件流。

## 4. 按严重度排序的发现

### P0（已修复）：进程级异常只记录日志，运行时会继续存活

审计时现象：旧 `src/main.ts` 为 `unhandledRejection` 和 `uncaughtException` 安装了只写日志的处理器；当时的有序退出生命周期只绑定在 `SIGINT` / `SIGTERM` 上。

影响：未捕获异常后，Node 进程可能继续保留 bot 连接、定时器和动作循环。此时内部状态是否一致已经不可证明，继续执行动作比直接退出更危险。

建议：先补进程生命周期测试，再让致命异常触发同一个幂等 shutdown，并在 drain 完成后设置失败退出码。shutdown 建立前的启动异常也要使用最小清理路径，避免直接 `process.exit(1)` 跳过可用资源清理。

实施状态：2026-07-31 已新增 [process-lifecycle.ts](../src/runtime/process-lifecycle.ts)，signal、fatal 和 startup failure 现在共用 shutdown coordinator；fatal 同步锁定退出码 `1`，Web listener drain 不再阻塞动作 runtime 停止。定向回归覆盖 signal/fatal 竞争、重复触发、hook 失败和监听器卸载。

### P0（已修复）：聊天摘要在多 bot 之间串线

证据：[src/memory/chat-memory.ts](../src/memory/chat-memory.ts#L282) 的 pending buffer 按 `botId` 分组，但 `lastSummary`、`previousSummary` 和 prompt 读取仍是全局单值；`getSharedChatMemoryPromptText(botId)` 只在标题中使用 `botId`，实际返回同一份摘要。

影响：一个 bot 的玩家聊天会进入另一个 bot 的提示词。项目公开支持多 bot，这既是行为污染，也是跨实例信息边界错误。

建议：把摘要状态改为 `summaryByBotId`，提供旧 `version: 1` 全局摘要的兼容读取和一次性迁移。该修改涉及持久化 schema，实施前需确认迁移格式，但不能继续用全局摘要作为长期方案。

实施状态：2026-07-31 已将状态升级为 `version: 2` 的 `summariesByBotId`，摘要生成、`previousSummary` 和 prompt 读取使用同一个 `botId` 边界。v1 只有一个候选 Bot 时自动归属；多候选的旧摘要进入 `unassignedLegacySummary`，保留但不注入。启动迁移使用原子写入，JSONL 历史格式不变。

### P0（已修复）：配置热重载会把失败报告为成功，并保留已删除配置

修复前证据：旧加载器捕获文件读取和 JSON 解析错误后仍返回零计数，`chat.config.reload` 随后固定返回 `reloaded: true`；加载过程只覆盖文件中存在的 Map 条目，没有删除内存里已移除的 Bot 配置。该失效模式现由 [配置热重载回归测试](../test/chat-config-reload.test.ts) 固定复现边界。

影响：损坏 JSON、误删配置或希望通过删除条目停用某 bot 时，面板会显示成功，但运行时继续使用旧值。这会直接破坏“热加载可验证”的契约。

建议：先解析并完整校验到临时快照，成功后同步替换内存状态并 reconcile；失败时保持旧快照并返回 MCP error，只有成功路径可以出现 `reloaded: true`。环境覆盖应在提交新快照后按固定顺序应用。

实施状态：2026-07-31 已增加独立 Zod 文档解析边界。读取和校验完成前不修改运行态；合法文档同步重建四个配置表，删除文件中消失的条目及 Agent 持久化派生状态，同时保留存续条目的运行时秘密、聊天历史和请求诊断。手动重载遇到损坏 JSON、非法类型或缺文件时返回 MCP error，只有成功路径包含 `reloaded: true`；响应新增 `removedCounts`，原有计数字段保持不变。环境覆盖仍在提交后按固定顺序应用。

### P1：ClientAdapter 还是迁移边界，不是真正可替换后端

审计时证据：[src/runtime/bot-runtime.ts](../src/runtime/bot-runtime.ts) 固定创建 `mineflayer`；[src/runtime/client-adapter-factory.ts](../src/runtime/client-adapter-factory.ts) 对 `modded-client` 直接报未实现；当时 `BotRuntime.disconnect()` 绕过 `adapter.disconnect()`，直接调用 Mineflayer service。

影响：上层接口看似支持多个 Adapter，但实例选择、连接清理和兼容句柄仍由 Mineflayer 决定。现在直接实现 Companion Mod 会把两套生命周期叠在一起。

建议：先为 Adapter 构造、连接、断开、事件解绑和能力查询建立契约测试，再讨论给 `BotConfig` 增加 adapter kind。配置和 `disconnect()` 签名都属于公共契约，修改前需确认兼容策略。

实施状态：2026-07-31 已完成生命周期和内部构造注入部分。`BotRuntime` 的连接失败、手动断开和进程退出统一委托 Adapter；断开返回并发幂等 Promise，等待 Mineflayer `end` 并设 5 秒上限，断开期间拒绝新连接，Runtime 只解除自己注册的生命周期监听器。`ClientAdapterFactory`、Runtime 与 Registry 可由应用组合层注入 kind/Factory，并拒绝 kind 不匹配或构造失败的半成品。MCP 工具契约保持不变，直接 TypeScript 断开契约改为异步。`BotConfig.adapterKind`、公开选择入口、非 Mineflayer 认证/事件链和 Modded Client 实现仍待后续阶段。

### P1：动作存在三套入口，元数据和结果会继续漂移

当前 MCP 有约 84 个运行时工具注册，Agent 核心 Catalog 只有 17 个默认 allowlist 条目，Web 又维护自己的 action router。三者复用了一部分 runtime helper，但没有共同的参数 schema、权限决策、调用入口和结果证据。

影响：同一个动作在 MCP 可见、Agent 不可调用、Web 参数不同或结果状态不同的情况会持续出现；模型幻觉只是表现，根因是控制面没有单一命令契约。

建议：Catalog 下一阶段不只是 metadata，应增加统一 `invoke(commandId, input, context)` 边界。先迁移低风险、已 Adapter 化的动作，并保留现有 MCP 工具名作为兼容别名。

实施状态：2026-07-31 已完成 `move.stopFollow` 首个试点。MCP、Web 和 Agent 现在经过同一个 CommandDispatcher handler，保留原输入与返回契约，并记录来源、requestId、耗时及 `executed` / `failed` 终态；Web 可直接查看跨入口 Command History。MCP 仍保留原 SDK schema 作为协议边缘校验，其他命令、统一权限、`accepted` / `confirmed` / `cancelled` 和证据事件仍未完成，因此“三套入口”问题只缩小了一个切面。

### P1：`action-tools.ts` 是主要状态所有者和最大变更热点

证据：[src/tools/action-tools.ts](../src/tools/action-tools.ts#L407) 同时持有聊天、AI、Agent、记忆、领地、自保、跟随、移动、战斗和采矿 Map、定时器与持久化队列，文件共 11,048 行。

影响：任何一个领域的修改都可能触碰全局状态和退出顺序；测试只能通过大量私有流程间接覆盖，也让 Agent 黑板难以成为唯一真相源。

建议：不要按行数机械拆文件。按“状态所有权 + 生命周期”依次抽取 `ConfigRepository`、`ChatRuntime`、`GuardRuntime`、`MovementRuntime`、`AgentCoordinator`，每次只迁移一份状态和对应 cleanup，并保留旧 MCP 注册层。

实施状态：2026-08-03 已完成 `ConfigRepository` 文件生命周期第一阶段，并把聊天监听、Chat AI、Agent 核心配置与 self-guard 配置的类型、默认构造、运行时 Map、replace/delete 和持久化投影迁入各自 ConfigStore。Chat AI Store 显式保留热重载前的运行时 API key、历史、用户冷却表和请求状态对象；Agent Store 保留 planner API key、最近规划时间/摘要/结果和请求状态对象。Chat AI 与 planner 当前请求的 `AbortController`、请求代次和诊断回写门控也已迁入独立 `AiRequestLifecycle`，热重载后按 botId 写入当前 Store；Chat AI 与 self-guard 排队 tail、配置代次失效和动态 drain 已迁入各自 `InvalidatableTaskQueue`，self-guard 原生受伤 handler 已迁入独立订阅 registry 并按 botId 读取当前配置，主/持续反击 interval 与 watchdog 句柄已迁入独立 `SelfGuardLoopLifecycle`，反击 session 与命中衰减状态已迁入独立 `RetaliationStateStore`，告警冷却与上一轮观察状态已迁入独立 `SelfGuardRuntimeStateStore`，旧编排层共享的装备节流与反击命中序号已迁入独立 `CombatExecutionStateStore`，昼夜/下雨兼容读取与转场判定已迁入纯 `self-guard-environment` 边界，疑似攻击者选择、后续反击目标 Adapter 快照复核和持续反击 tick 决策已迁入纯 `self-guard-retaliation` 边界。Agent 的战略目标/记忆/任务历史/领地组合、planner 冷却/执行、self-guard 完整 tick/追击与攻击业务、真实伤害来源判定、Adapter 世界环境快照、四表同步 commit、其余 listener cleanup 与环境覆盖仍在 `action-tools.ts`，因此本项尚未完成。

2026-08-05 补充：self-guard 附近玩家的自身排除、距离校验、包含边界和首次进入转场，以及主 tick 的 Bot 引用变化与严格超过 `0.5` 的健康下降条件，已迁入纯 `self-guard-state` 决策。首次采样、vitals 不可用和非有限历史健康值均 fail-closed；重连短句、受伤处理、随机概率、场景聊天和上一轮状态写入顺序未迁移，不能据此宣称完整 tick 已脱离 `action-tools.ts`。

2026-08-06 补充：低生命/低饥饿 reactive 转场、事件优先级/payload 和下一组去重 flags 已迁入纯 `self-guard-state` 判别联合；原 Store 模块继续 re-export flags 类型以保持内部类型路径兼容。Agent 事件发布和 flags 写入仍由 `action-tools.ts` 按原顺序执行；发布函数继续内部隔离桥接异常，随后仍更新 flags 的旧行为保持不变。

2026-08-06 补充：`maybeAlertGuard` 的启用、严格冷却边界和无效时间 fail-closed 已迁入纯 `self-guard-state`；允许时仍由旧编排层先写 `lastAlertAt` 再尝试聊天，发送失败不回滚。完整 tick 快照会提前部分 Adapter 采集并改变异常路径，等待原子快照或分阶段 plan 后再做。

### P1（静态门禁已修复）：自动化测试没有覆盖真实执行边界

现有 42 个测试文件对纯策略、Fake Adapter、HTTP stub、连接代次和安全寻路提供了良好离线保护，但没有自动执行：

- Yggdrasil 真实认证；
- Minecraft 协议握手和 spawn；
- 服务器 kick 后的真实重连；
- Pathfinder 在真实地形中的“不挖路、不搭路、长绕行失败”；
- 容器窗口、单块采矿、决斗和游戏聊天回显。

此外，[tsconfig.json](../tsconfig.json#L15) 只包含 `src/**/*.ts`，测试通过 `tsx` 执行但不参与 `tsc` 类型检查；[package.json](../package.json#L13) 手工枚举全部测试文件，新增测试可能被漏出默认测试命令。

建议：增加 `tsconfig.test.json` 或等价的测试类型检查；让测试入口自动发现文件或增加“清单完整性”检查；建立 opt-in 的真实服务器 smoke suite，不把凭据放进 CI。

实施状态：2026-07-31 已新增独立 `tsconfig.test.json`，`npm run typecheck` 会分别检查生产源码与全部测试；`npm test` 已改为 `tsx --test` 自动发现，并由质量门禁测试固定命令和覆盖范围。真实认证、spawn、重连与游戏动作仍未自动化，继续按手测指南执行。

### P1：生产依赖链仍有 17 项审计告警

2026-07-31 的 `npm audit --omit=dev --audit-level=high` 报告 1 low、7 moderate、9 high，主要来自 MCP Web 依赖和 Mineflayer/Yggdrasil 认证链。

升级不能混成一次：

1. `@modelcontextprotocol/sdk` 单独试升到 1.30.0，并跑 84 工具注册与 Web/MCP 回归。（离线协议回归已完成）
2. `yggdrasil` 1.8.0 应单独升级并做真实认证回归。（离线契约已完成，真实认证待测）
3. 先把运行时基线统一为 Node 22+，精确固定当前 lockfile 已在使用的 Mineflayer 4.35.0；升级 4.37.x 前再做登录、寻路、背包和实体事件回归。（版本契约已完成，真实回归待测）
4. 不使用 `npm audit fix --force` 建议的破坏性降级。

实施状态：2026-07-31 已完成第 1、2 项的离线部分和第 3 项的版本契约部分。`@modelcontextprotocol/sdk` 已从 lockfile 中的 1.27.1 独立升级并精确固定为 1.30.0，SDK Client 内存传输测试证明项目注册工具可被发现和调用；Yggdrasil 已从 1.7.0 精确固定为 1.8.0，本地 HTTP 假服务覆盖实际认证请求、成功 session 映射、缺字段和服务端拒绝；项目现声明 Node 22+，CI 覆盖 Node 22/24，Mineflayer 精确固定为当前已安装并经过离线测试的 4.35.0。外部 stdio 客户端、真实 Yggdrasil 认证和真实游戏行为仍在手测清单中。

Node 24.16 本机的 lint、源码/测试 typecheck、217 项完整测试和 build 均通过；Node 22 干净安装与真实服务器行为仍需由 CI/手测确认。

生产审计仍是同一组 17 项。Yggdrasil 1.8.0 的嵌套 `uuid@10` 已停止支持且仍命中 `<11.1.1` advisory，因此这些版本调整不能声明安全收益。Node 20 已 EOL，Mineflayer 4.35.0 与 minecraft-protocol 1.64.0 均要求 Node 22+；现在 manifest、lockfile、`.nvmrc` 和 CI 已统一到该最低基线。Mineflayer 4.37.1 仍需单独处理，不能把 Node/离线认证验证外推为真实登录、session server 或游戏行为兼容。

上游参考：[MCP TypeScript SDK releases](https://github.com/modelcontextprotocol/typescript-sdk/releases)、[Yggdrasil npm](https://www.npmjs.com/package/yggdrasil)、[Mineflayer 4.35 package](https://github.com/PrismarineJS/mineflayer/blob/4.35.0/package.json)、[Mineflayer history](https://github.com/PrismarineJS/mineflayer/blob/master/docs/history.md)、[Node.js releases](https://nodejs.org/en/about/previous-releases)、[mineflayer-pathfinder](https://github.com/PrismarineJS/mineflayer-pathfinder)。

### P2：持久化与调试安全还有局部不一致

- 自动化测试读取工作区 `.env.local` 的污染已于 2026-08-03 收口：`local-env.ts` 改为无导入副作用的显式加载器，只有 `main` 的 bootstrap 模块执行加载；正式启动仍保留默认路径、`MCBOT_ENV_FILE` 和已有进程变量优先语义。完整测试会验证仓库 env 路径没有被读取。
- 自动化测试读取真实 AppData、`C:\xiaoli\memory` 和旧 prompt profile 的污染也已于 2026-08-03 收口：默认测试命令预加载进程级路径隔离 setup，每个测试子进程使用独立临时根目录并在退出时清理。生产路径解析保持不变；绕过 npm setup 的自定义测试命令仍需调用方自行负责隔离。
- 共享游戏记忆的临时写入缺口已于 2026-08-03 收口：[game-memory-store.ts](../src/memory/game-memory-store.ts) 的 `players.json` / `places.json` 写入复用 [writeJsonAtomic](../src/runtime/atomic-json-file.ts) 的文件同步、排他临时文件和失败清理；上层持久化队列继续负责快照顺序，文件 schema 保持 `version: 1`。
- Web Action History 的顶层脱敏缺口已于 2026-08-03 收口：Command/Action History 现在复用 [diagnostic-redaction.ts](../src/utils/diagnostic-redaction.ts)，在写入内存历史时递归复制并脱敏 payload、result 和 error；endpoint 原响应不变。普通字段中无标记的任意秘密仍无法自动识别，因此真实凭据继续禁止进入调试输入。
- `chat-configs.json` 仍没有顶层 schema version；当前已由 Zod 拦截已知字段中的非法类型、枚举和非有限数字，但未来格式迁移仍缺少显式版本分派。

这些不应和 P0 混在一个补丁里，但应在相应 repository / debug history 模块收口时修复。

### P2：文档和发布记录已接近失去检索能力

审计开始时项目有 183 份 Markdown 和 164 个未发布 changeset；README 主要承担逐条功能历史，TODO 也混合了完成记录、旧债务和当前任务。好处是历史完整，代价是“当前能做什么、下一步是什么”越来越难找。

建议：保留 changeset 作为事实源，但增加归档/发布批次流程；README 只保留当前能力、快速启动、限制和文档索引；完成任务定期从 TODO 移入 release/archive 文档。`CLAUDE.md` 继续保持索引文件，不扩成知识库。

实施状态：2026-08-03 已增加只读 TypeScript release entry 校验器、npm 命令和 GitHub CI 门禁，覆盖文件名 scope、固定 frontmatter、tests/artifacts 与三段正文；实现前盘点的 177 个条目均已有八个必填字段，过期的“22 个缺 breaking”记录已纠正，9 个旧式文件名已在无外部引用和无覆盖前提下规范化。校验器不会移动条目或生成发布声明，首次 release 批次与 TODO 归档仍保留为需确认决策。

## 5. 应保留的实现

以下模块方向正确，不建议重写：

- 安全 Pathfinder profile 和首轮/持续路径失败审计；
- 跟随失败时停止并只反馈一次“我跟不上你啦”；
- planner 字段白名单与去坐标投影；
- OpenAI-compatible endpoint 归一化、超时和 AbortController；
- 连接 generation guard 与旧连接事件隔离；
- `SIGINT` / `SIGTERM` 的分阶段退出和持久化 drain；
- `.env.local` 本地密钥边界及旧持久化密钥忽略策略；
- Web 默认仅绑定 loopback、远程访问 token 和请求限制；
- 已抽出的纯策略模块及 Fake Adapter 离线测试。

## 6. 推荐实施顺序

### 阶段 A：确定性修复

每项先写失败回归测试，再改实现：

1. 致命异常复用幂等 shutdown，禁止异常后继续动作。（已完成）
2. 聊天摘要按 bot 隔离，并兼容读取旧状态。（已完成）
3. 配置 reload 改为“解析、校验、提交”事务，错误不得返回成功。（已完成）
4. 测试文件进入类型检查，并防止默认测试清单漏文件。（已完成）

退出条件：离线测试能稳定复现旧错误并证明修复，不需要改 MCP 工具名。

### 阶段 B：运行时单一入口

1. 让 `BotRuntime` 完整委托 Adapter 连接和断开生命周期。（已完成，真实服务器回归待测）
2. 为 Factory 注入 Adapter 选择，但先保留 Mineflayer 为默认值。（内部构造注入已完成，公开配置等待 Bridge）
3. 建立统一 Command Invocation / Action Result，先接 Web 和一个 MCP 领域。（`move.stopFollow` 试点已完成，其余命令与权限仍待迁移）
4. 把 accepted、executed、confirmed、failed、cancelled 与证据写进同一事件流。

退出条件：同一动作从 Web、MCP、Agent 调用时经过同一 schema、权限和执行函数。

### 阶段 C：按状态所有权拆分旧编排层

1. `ConfigRepository`（文件 I/O、解析、串行写入与 flush 已抽出；chat listener、Chat AI、Agent 核心配置与 self-guard 状态已迁移，Agent 组合状态和四表 commit 待迁移）
2. `ChatRuntime`
3. `GuardRuntime`（配置 Store、任务队列、受伤订阅、timer、反击 session/命中衰减、告警/上一轮观察、战斗执行节流、告警冷却决策、reactive 阈值信号、Bot 重连/健康下降核心转场、昼夜/下雨兼容读取与转场判定，以及疑似攻击者选择/目标复核/持续反击 tick 决策已有独立边界；Agent 事件发布、完整 tick、真实伤害来源判定、Adapter 世界环境快照与追击/攻击业务待迁移）
4. `MovementRuntime`
5. `AgentCoordinator`

`GuardRuntime` 当前还额外抽出了聊天告警冷却、生命/饥饿、reactive 阈值信号与去重 flags、Bot 引用变化、健康下降容差、库存摘要和附近玩家首次进入的纯判断；这些函数不拥有随机数、聊天/受伤/事件发布副作用或 RuntimeStateStore。

每次只迁移一个状态集合、定时器集合、启动/停止方法和测试。`action-tools.ts` 在过渡期只保留工具注册和兼容映射。

### 阶段 D：真实服务器门槛

按 [手动测试指南](manual-testing-guide.md) 跑登录、聊天、跟随、不可达、采矿、战斗、容器、断线和退出持久化。把可稳定自动化的步骤升级为 opt-in integration suite。

### 阶段 E：Modded Client Bridge MVP

只有阶段 A-D 通过后，才实现 Companion Mod + Local Bridge：先做连接、快照、聊天、移动、停止和动作证据，不直接做 Farmer's Delight、Create GUI 或复杂容器自动化。

## 7. 决策门槛

开始实现前需要用户确认的公共契约：

已确认：Node 最低基线从 20 提升到 22，CI 验证 Node 22/24；Mineflayer 暂停在 4.35.0。

- `chat-summary-state.json` 的版本迁移形态；
- `chat-configs.json` 顶层 schema version；
- `BotConfig` 是否增加 `adapterKind`；
- 已确认：`BotRuntime.disconnect()` 改为异步 Promise；MCP `bot.disconnect` 保持兼容，直接 TypeScript 调用者必须等待结果。
- 未发布 changeset 的归档或首次 release 批次。

## 8. 审计限制

- 没有真实登录服务器，也没有观察游戏画面。
- 没有验证 Forge/Fabric/NeoForge Bridge，因为目前尚未实现。
- 依赖告警是 npm 依赖图结果，不等价于每个漏洞都可从当前本地入口利用；仍需逐链升级和回归。
- 当前工作区包含大量未提交改动，本轮只新增和同步审计文档，不整理或回退既有变更。
