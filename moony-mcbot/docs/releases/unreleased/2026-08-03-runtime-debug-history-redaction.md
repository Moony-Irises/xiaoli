---
type: fix
scope: runtime
audience: developer
summary: Command 与 Web Action 调试历史统一递归脱敏 payload、result 和 error
breaking: false
demo_ready: false
tests:
  - npx tsx --test test/diagnostic-redaction.test.ts test/command-dispatcher.test.ts test/debug-web-security.test.ts test/stop-follow-command-integration.test.ts
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/utils/diagnostic-redaction.ts
  - src/commands/command-dispatcher.ts
  - src/debug/debug-server.ts
  - test/diagnostic-redaction.test.ts
  - test/debug-web-security.test.ts
---

## What changed

新增共享 diagnostics 投影，递归复制嵌套对象和数组，按常见 password、token、API key、secret 等字段名脱敏，并清理赋值文本与 Bearer 凭据。Command History 与 Web Action History 共同使用该投影；Action History 现在同时处理 payload、result 和 error，循环引用显示为 `[circular]`。

## Why it matters

Raw Action 或领域错误中的嵌套凭据不再因只检查顶层 payload 而直接出现在可复制、下载的历史中。脱敏集中在历史写入边界，新增 action 调用点不需要记住单独调用浅层 helper，历史也不会继续持有调用方可变对象。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。改动只影响进程内调试历史副本，不改变 Web endpoint、HTTP 状态、CommandDispatcher 调用方结果或持久化格式。规则只能识别敏感键和带语义标记的文本，无法发现普通字段里的任意秘密；真实凭据仍不得作为测试输入。
