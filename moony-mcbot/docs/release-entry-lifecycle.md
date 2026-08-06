# Release Entry 生命周期

## 目标

`docs/releases/unreleased/` 是发布说明的事实源。每轮有意义改动新增一个条目，CI 只验证事实格式，不根据 commit message 补写内容，也不自动宣称项目已发布。

## 条目契约

文件名必须是 `YYYY-MM-DD-<scope>-<slug>.md`：日期必须真实，scope 必须等于 frontmatter 的 `scope`，其余 slug 只使用小写字母、数字和连字符。

frontmatter 只允许以下字段：

| 字段 | 契约 |
| --- | --- |
| `type` | `feature`、`fix`、`docs`、`refactor`、`test`、`chore` |
| `scope` | `demo`、`plugin`、`runtime`、`outbound`、`workspace`、`exec`、`docs`、`ci` |
| `audience` | `public`、`developer`、`internal` |
| `summary` | 非空单行摘要 |
| `breaking` | 不带引号的 `true` 或 `false` |
| `demo_ready` | 不带引号的 `true` 或 `false` |
| `tests` | 至少一条命令；兼容历史单行值和列表 |
| `artifacts` | 至少一个关键文件的列表 |

正文必须按顺序包含非空的 `What changed`、`Why it matters` 和 `Demo posture / limitations`。未知字段、重复字段和不受支持的缩进语法都会失败。该解析器只支持本项目固定 frontmatter 子集，不是通用 YAML 解析器。

## 本地与 CI

```powershell
npm run validate:releases
```

命令成功时输出已检查文件数；任何问题都会按文件和错误代码逐项输出并返回非零退出码。GitHub CI 在 lint、typecheck、test 和 build 之前执行该命令。脚本自身由 ESLint 与 `tsconfig.test.json` 严格检查，单元测试覆盖正常、边界、错误、CLI 失败码和真实目录。

## 归档流程

归档属于发布决策，不由校验器自动执行。首次归档前必须先确认：

1. release 版本、发布日期和目标受众。
2. 本批次包含哪些 unreleased 条目，以及是否仍为 demo、已发布或 GA。
3. 归档目录命名和 release note 文件位置。
4. 由条目生成的说明是否准确表达用户可见变化和限制。
5. 移动后链接、CI 和完整测试是否通过。

确认后才能建立 archive 目录、从条目生成 release note 并移动已纳入批次的文件。没有进入该批次的条目继续留在 `unreleased`。禁止脱离条目自由补写发布事实。

## TODO 归档边界

Release entry 记录改动事实，`TODO.md` 记录当前协作状态，两者不能互相替代。完成任务的归档周期和目标文件尚未确认；在此之前不批量删除 TODO 历史，也不把未完成项伪装成 release 内容。
