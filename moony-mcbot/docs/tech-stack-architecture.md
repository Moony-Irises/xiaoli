# Minecraft Bot MCP 技术栈与系统架构（阶段一：先跑通登录）

## 1. 目标与范围

当前阶段目标：
- 以 `bot 实例` 为单位，支持登录指定的 Yggdrasil API + Minecraft Java 服务器（1.20.1）。
- 服务器地址支持 SRV（示例：`main.newnan.city`）。
- 先完成“认证 + 入服 + 保活 + 状态可观测”闭环，不做复杂行为自动化。

测试参数（来自需求）：
- Yggdrasil API: `https://authmc.newnan.city`
- MC Server Host: `main.newnan.city`（SRV）
- Minecraft 版本: `1.20.1`

## 2. 网络调研结论（仅列与架构强相关）

1. Minecraft 客户端框架选择
- `mineflayer` 是 Node.js 生态最成熟的 Java 版 bot 框架，内部基于 `minecraft-protocol`。
- `mineflayer` README 明确以 bot 自动化为核心，且可指定 `version`，适合固定到 `1.20.1`。

2. SRV 支持
- `minecraft-protocol` 的客户端配置明确包含 `hostSRV` 选项，可由库解析 SRV 记录（`_minecraft._tcp.<host>`）。
- 因此 bot 连接层可直接支持“域名输入 + SRV 自动解析”的接入模式。

3. Yggdrasil 认证接入
- Node 侧可用 `yggdrasil` 库对接第三方 Yggdrasil 服务端（自定义 `host`）。
- Yggdrasil/外置登录系统常见协议基于 `authserver` 路径前缀（如 `/authserver/authenticate`）。
- 认证后要把 `accessToken / clientToken / selectedProfile` 作为会话传给 MC 客户端层。

4. 外置登录兼容性约束
- authlib-injector 文档强调 Java 客户端侧与 API 服务端需要元数据与端点约定匹配。
- 实务上应把 `apiBaseUrl` 配置为实例级参数，禁止硬编码到某个固定服务。

5. MCP 封装
- 官方 TypeScript MCP SDK 可用于把 bot 能力暴露为工具；登录和会话生命周期应先内聚成独立模块，再由 MCP 工具层调用。

## 3. 推荐技术栈

运行时与语言：
- Node.js 22+（`.nvmrc` 默认 22；CI 验证 22/24 LTS）
- TypeScript 5.x

核心依赖：
- `mineflayer` 4.35.0（精确锁定）：bot 高层能力（事件、世界状态、行为接口）
- `minecraft-protocol`：底层连接与协议能力（版本、SRV 等）
- `yggdrasil` 1.8.0（精确锁定）：第三方 Yggdrasil 登录（用户名/密码 -> token/profile）
- `@modelcontextprotocol/sdk`：MCP server 与 tool 暴露
- `zod`（建议）：配置与入参校验
- `pino`（建议）：结构化日志

当前认证边界：`AuthService` 负责把可配置 API 根路径规范化为 `/authserver`，再映射 `accessToken`、`clientToken` 和 `selectedProfile`；本地 HTTP 契约测试已覆盖请求编码、profile UUID 规范化、缺字段和认证拒绝。真实外置认证、session server 与 Minecraft spawn 仍属于手动验收。

工程与质量：
- `vitest`：单元测试
- `tsx`：本地开发运行
- `eslint + @typescript-eslint`：静态检查

## 4. 系统架构（按 bot 实例隔离）

```text
+---------------- MCP Server Process ----------------+
|                                                     |
|  Tool Layer (MCP)                                  |
|   - bot.create / bot.connect / bot.status / ...    |
|   - chat.send / observe.snapshot / ...             |
|                                                     |
|  Bot Registry (multi-instance)                     |
|   Map<botId, BotRuntime>                           |
|                                                     |
|  BotRuntime (per bot)                              |
|   + AuthService (Yggdrasil)                        |
|   + SessionService (token/profile lifecycle)       |
|   + McClientService (mineflayer/mc-protocol)       |
|   + StateStore (conn state, player info, errors)   |
|   + EventBus (spawn/chat/kick/end/error)           |
|                                                     |
+-----------------------------------------------------+
```

### 4.1 Bot 实例模型

每个 `botId` 绑定一份独立配置与状态：
- `auth`: `apiBaseUrl`, `username`, `password`
- `server`: `host`, `port?`, `useSrv`, `version=1.20.1`
- `runtime`: `state`, `lastError`, `connectedAt`, `profile`

状态机建议：
- `idle -> authenticating -> authenticated -> connecting -> spawned -> disconnected`
- 任意阶段失败进入 `error(disconnected)` 并附错误码、原始原因、重试计数。

### 4.2 登录流程（阶段一主流程）

1. 读取 bot 配置并校验。
2. Yggdrasil `authenticate` 获取 `accessToken/clientToken/selectedProfile`。
3. 对 `selectedProfile.id` 做 UUID 规范化（32 位无横线 -> 8-4-4-4-12）。
4. 创建 mineflayer bot：
   - `host=main.newnan.city`
   - `hostSRV=true`（或启用 SRV 解析策略）
   - `version=1.20.1`
   - 注入 `session`（认证结果）
5. 监听 `login/spawn/error/kicked/end` 事件并更新状态。
6. MCP `bot.status` 可查询当前实例状态与最近错误。

### 4.3 可观测性与诊断

必须输出结构化日志字段：
- `botId`, `phase`, `serverHost`, `resolvedHost`, `resolvedPort`, `version`
- `authApiBase`, `profileName`, `profileId`
- `event`, `errorCode`, `errorMessage`

敏感信息处理：
- 日志中禁止输出明文密码、完整 token。
- token 仅允许前后截断显示（如前 6 + 后 4）。

## 5. 对 reference 实现的谨慎参考结论

可参考点：
- 已有 MCP 工具分层雏形（`tool-factory.ts` + 各工具模块）。
- 已有连接状态维护、事件监听、重连框架。

高风险/需修正点：
1. `bot-connection.ts` 中 Yggdrasil `host` 被硬编码到 `https://littleskin.cn/api/yggdrasil/authserver`，与目标环境不符。
2. `config.ts` 出现明文默认账号密码，不可用于生产。
3. 登录阶段诊断日志不够规范，缺少统一错误分类（认证失败/握手失败/加密失败/被踢）。
4. SRV 策略未显式建模（应由配置决定是否启用、失败是否回退 A 记录）。

## 6. 阶段一落地建议（先跑通登录）

最小可交付（MVP）按以下里程碑推进：
1. `BotRuntime` + `AuthService` + `McClientService` 三层拆分。
2. 完成 `bot.create` / `bot.connect` / `bot.status` / `bot.disconnect` 四个 MCP 工具。
3. 在测试参数下跑通：
   - Yggdrasil 认证成功
   - 通过 SRV 连接 `main.newnan.city`
   - 收到 `spawn` 事件
4. 补 3 类关键测试：
   - 认证失败（本地假服务错误传播已覆盖；真实错误凭据待手测）
   - SRV 解析失败
   - 服务端踢出

## 7. 关键来源

- Mineflayer 仓库与文档: https://github.com/PrismarineJS/mineflayer
- minecraft-protocol README（含 `hostSRV` 选项）: https://github.com/PrismarineJS/node-minecraft-protocol
- yggdrasil npm（Node 第三方 Yggdrasil 认证库）: https://www.npmjs.com/package/yggdrasil
- authlib-injector 文档（Yggdrasil 端点与元数据约定）: https://authlibinjector.apifox.cn/205812902e0
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk

