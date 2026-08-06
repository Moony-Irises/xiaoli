---
type: fix
scope: ci
audience: developer
summary: 默认测试为每个进程隔离 AppData、共享记忆和 prompt 持久化路径
breaking: false
demo_ready: false
tests:
  - npm test -- test/runtime-path-isolation.test.ts test/quality-gates.test.ts
  - npm test
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm run build
artifacts:
  - scripts/test-runtime-path-isolation.ts
  - scripts/test-setup.ts
  - scripts/README.md
  - test/runtime-path-isolation.test.ts
  - test/quality-gates.test.ts
  - test/README.md
  - package.json
  - README.md
  - docs/lint-ci-design.md
  - docs/manual-testing-guide.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
---

## What changed

默认 `npm test` 预加载可单测的运行时路径隔离 setup。每个测试进程都会覆盖 data、memory、chat config、prompt profile、chat log 和 env 文件路径到独立临时根目录，并在退出时幂等清理；质量门禁固定该命令，定向测试继续通过 npm 参数执行。

## Why it matters

导入 `action-tools` 或 `debug-server` 的离线测试不再读取开发者真实 AppData、共享小狸记忆或旧 prompt，也不会因为个人持久化状态产生不同结果或意外迁移文件。生产路径解析和正式启动行为没有变化。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA；它只保证默认 npm 测试入口的本地持久化路径隔离，不验证真实账号、Minecraft 服务器、游戏动作或跨平台文件权限。Node reporter 会额外显示两个预加载模块的文件级通过项，这不代表新增两个业务测试。
