---
type: fix
scope: runtime
audience: developer
summary: 本地环境文件改为仅由进程入口显式加载，自动化测试不再读取工作区配置
breaking: false
demo_ready: false
tests:
  - npx tsx --test test/local-env.test.ts test/chat-config-reload.test.ts test/stop-follow-command-integration.test.ts test/agent-tool-executors.test.ts
  - npm test
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm run build
artifacts:
  - src/utils/local-env.ts
  - src/bootstrap/local-env.ts
  - src/bootstrap/default-bot.ts
  - src/bootstrap/README.md
  - src/tools/action-tools.ts
  - src/main.ts
  - test/local-env.test.ts
  - README.md
  - docs/manual-testing-guide.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
---

## What changed

移除 `local-env.ts` 的模块导入副作用，新增只由程序入口引用的 bootstrap 模块，并删除 `action-tools` 与默认 Bot 配置模块的隐式加载依赖。回归测试覆盖纯导入、显式加载、已有变量保护、业务模块导入、正式 bootstrap 和缺失文件。

## Why it matters

离线测试不再因为开发者机器上的账号、API key、模型地址或个人 Bot 配置而改变结果，同时直接执行 `npm run dev`、`npm start` 或 `dist/main.js` 仍保留原有本地配置体验和覆盖顺序。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA；它只隔离工作区 `.env.local`，不代表所有测试都已与 AppData 持久化配置或共享记忆目录隔离。正式账号登录和 Minecraft 游戏行为未在本轮自动化验证。
