# Bootstrap

本目录只负责进程级启动边界，不承载 Bot 行为或配置持久化逻辑。

## 本地环境文件

- `local-env.ts` 是 `.env.local` 的唯一自动加载入口，只由 `src/main.ts` 在其它运行模块之前导入。
- `src/utils/local-env.ts` 提供无导入副作用的 `loadLocalEnvOnce()`；测试或业务模块导入它不会读取磁盘。
- 默认文件是仓库根目录 `.env.local`，可用 `MCBOT_ENV_FILE` 指向其它文件。
- 文件值不会覆盖进程中已经存在的环境变量。

## 默认 Bot

`default-bot.ts` 在调用 `readDefaultBotBootstrapFromEnv()` 时读取当前进程环境。调用方必须先完成所需的环境加载；正式进程由 `local-env.ts` 保证该顺序。

## 验证

```powershell
npx tsx --test test/local-env.test.ts
```
