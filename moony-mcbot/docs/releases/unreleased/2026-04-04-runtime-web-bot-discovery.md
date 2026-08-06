---
type: fix
scope: runtime
audience: developer
summary: 修复调试面板在 bot 晚于页面启动时不显示状态的问题
breaking: false
demo_ready: true
tests:
  - npm run build
artifacts:
  - src/debug/debug-server.ts
  - README.md
---

## What changed

调试面板的前端刷新逻辑改成了每次轮询都先重新拉取 bot 列表，而不是只在页面首次加载时读取一次。现在如果页面先打开、默认 bot 稍后才创建或连上，面板会自动发现并切换到可用 bot。

同时补了更明确的空状态展示：在没有可选 bot 时，页面会显示 `waiting for bot runtime...`，并把各个详情区统一切到等待态，而不是只在顶部留一个模糊的 `no bot`。

## Why it matters

之前最容易踩到的情况是：MCP 进程先把调试面板起起来，默认 bot 随后才完成创建或自动连接。此时页面因为 bot 下拉框为空，会一直保持空白，看起来像“面板坏了”。这次修复后，调试面板终于能跟上真实运行时序，打开后等待几秒就能看到状态。

## Demo posture / limitations

这次修复的是调试体验，不改变 agent/runtime 的业务行为。面板仍然是本地开发用的轻量调试入口，不代表已经具备完整后台管理能力；但它已经足够稳定地承担日常状态查看和轻量调试动作。
