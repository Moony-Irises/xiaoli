# Lint 与 CI 设计

## 目标

为当前 TypeScript runtime 建立可重复的静态检查和 GitHub 持续集成守门，不修改 MCP、Adapter、配置或游戏行为契约。

## 工具选择

- 使用 ESLint 9 flat config、`@eslint/js`、`typescript-eslint` 和 `globals`。
- 当前保留已经验证的 ESLint 9；后续升级 ESLint 需作为独立依赖变更评估，不与运行时基线调整混在一起。
- 首轮使用稳定的 recommended 配置，不启用 strict/stylistic 或 typed linting，避免把基础设施改动扩大为全仓风格重写。
- 依赖在 `package.json` 和 lockfile 中锁定具体版本。

## Lint 边界

- 检查 `src/**/*.ts`、`scripts/**/*.ts` 与 `test/**/*.ts`。
- 忽略 `dist/`、`node_modules/`、覆盖率和本地配置文件。
- 使用 Node globals；ES module 继续由现有 `type: module` 和 `NodeNext` 管理。
- 发现历史问题时优先修复明确 bug；若规则与现有兼容边界冲突，只做最小、带说明的规则覆盖，并记录技术债。

## TypeScript 与测试边界

- `tsconfig.json` 继续只包含 `src/**/*.ts`，供生产 typecheck 和 build 使用。
- `tsconfig.test.json` 继承生产编译选项，额外包含项目声明文件、仓库维护脚本和全部 `test/**/*.ts`，只检查、不输出文件。
- `npm run typecheck` 固定串行执行 `typecheck:src` 与 `typecheck:test`，避免测试夹具只经 `tsx` 转译而跳过严格类型检查。
- `npm test` 使用 `tsx --test` 的 TypeScript 自动发现规则，不维护测试文件清单；命令预加载 `scripts/test-setup.ts`，让默认进程隔离下的每个测试子进程使用独立临时持久化路径。Node 会把命令行选项传给隔离子进程，见 [Node.js test runner execution model](https://nodejs.org/docs/latest-v22.x/api/test.html#test-runner-execution-model)。`test/quality-gates.test.ts` 会防止命令、setup、测试覆盖范围以及 Node/Mineflayer 版本契约被静默改回旧行为。

## CI 边界

- workflow 位于仓库根 `C:\xiaoli\.github\workflows\`，因为 `moony-mcbot` 是单仓库子目录。
- 仅在 `moony-mcbot/**` 或 workflow 自身变化时触发 push / pull_request。
- 使用 Node 22.x / 24.x LTS 矩阵和 npm cache；22 是最低支持版本，24 用于提前发现当前 LTS 差异。
- 顺序固定为 `npm ci`、`npm run validate:releases`、`npm run lint`、`npm run typecheck`、`npm test`、`npm run build`。
- GitHub Actions 使用 commit SHA 固定第三方 action，注释保留对应主版本。

## 验证

- 本地 `npm run validate:releases` 必须确认全部 unreleased 条目的文件名、scope、frontmatter 和正文契约，任何错误以非零状态退出。
- 本地 `npm run lint` 必须零错误退出。
- 本地 `npm run typecheck` 必须同时通过源码与测试项目检查。
- 本地 `npm test` 必须自动执行新建的 `*.test.ts`，不得在 `package.json` 中重新枚举测试文件；输出不得引用真实 AppData、`C:\xiaoli\memory` 或旧 prompt profile，退出后不得残留本轮创建的 `mcbot-test-runtime-*` 目录。
- 版本门禁必须确认 manifest、lockfile、`.nvmrc` 与 CI 对 Node 22+ 和 Mineflayer 4.35.0 的声明一致。
- release entry 门禁允许历史 `tests` 使用单行命令或列表，不负责归档、生成 release note 或宣布发布；详见 [Release Entry 生命周期](release-entry-lifecycle.md)。
- `npm ci` 不在当前脏工作区直接执行，避免删除现有 `node_modules` 影响开发状态；lockfile 完整性由 `npm install` 和 `npm test` 验证，CI 在干净 runner 上执行 `npm ci`。
- 完成后运行 typecheck、完整测试、build 和 `git diff --check`。

## 已知限制与安全审计

- `action-tools.ts` 已恢复未使用符号检查；在完成领域拆分和原生类型收窄前，仅暂时豁免 `no-explicit-any`。`mineflayer-adapter.ts` 同样只豁免原生兼容对象的 `no-explicit-any`。新文件不得继承这些豁免。
- 2026-07-31 已将 `@modelcontextprotocol/sdk` 从 lockfile 中的 1.27.1 独立升级并精确固定到 1.30.0。升级前后的定向注册测试均通过，升级后另增加了 Client -> 内存 Transport -> McpServer 的工具发现与调用测试；没有修改 MCP 工具名、schema、stdio 入口或 Node engine。
- 2026-07-31 已将 Yggdrasil 从 1.7.0 独立升级并精确固定到 1.8.0。上游包 diff 没有运行时代码变化，主要依赖变化是 `uuid` 8 -> 10；本地 HTTP 契约测试覆盖实际请求编码、成功会话、缺字段和认证拒绝，没有使用正式凭据。
- 2026-07-31 的审计快照曾报告 17 个问题（1 low、7 moderate、9 high）；2026-08-14 重新运行 `npm audit --omit=dev` 返回 0 项。历史快照仍保留用于解释当时的升级决策；MCP Web 传递链、Microsoft 认证链和 Yggdrasil/UUID 仍需通过真实认证与运行回归验证，不能把当前审计结果等同于登录或游戏行为已验证。
- 2026-07-31 已将公共运行时基线从 Node 20 提升为 Node 22+，新增 `.nvmrc`，并让 CI 同时验证 Node 22/24。Node 20 已 EOL，且 Mineflayer 4.33/4.35 与 minecraft-protocol 1.64 均要求 Node 22+。
- Mineflayer 已按当前 lockfile 的既有版本精确固定为 4.35.0；package/lockfile 比较确认没有传递依赖变化。该调整不等于升级到 4.37.x，也不能替代真实登录、寻路、背包和实体事件回归。
- `npm audit fix --force` 会提出破坏性 Mineflayer 降级，不能作为自动修复方案。依赖升级需在真实登录、寻路、认证和 MCP 回归后单独实施。
- 当前 CI 不以 `npm audit` 作为阻断项，避免审计数据库变化掩盖新的 lint、类型、测试或构建回归；当前审计结果与仍需进行的真实认证回归由 `TODO.md` 显式跟踪。
- 当前仓库未配置 Git remote，因此 workflow 只完成了本地静态检查，尚未在 GitHub runner 上实际执行。
