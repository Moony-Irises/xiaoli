---
type: refactor
scope: runtime
audience: developer
summary: planner、AI 闲聊和聊天记忆总结共用 OpenAI-compatible 请求传输层
breaking: false
demo_ready: false
tests: npx tsx --test test/ai-request.test.ts test/openai-compatible-client.test.ts test/agent-tool-executors.test.ts test/mcp-tool-registration.test.ts test/dynamic-ai-state.test.ts; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/runtime/openai-compatible-client.ts
  - src/tools/action-tools.ts
  - src/memory/chat-memory.ts
  - test/openai-compatible-client.test.ts
  - package.json
  - README.md
  - docs/architecture-convergence-roadmap.md
  - TODO.md
  - CLAUDE.md
---

## What changed

新增 OpenAI-compatible 请求传输层，统一处理 Chat Completions endpoint 归一化、Bearer 鉴权、JSON POST、超时和取消信号。Agent planner、AI 闲聊及聊天记忆总结已改用该公共层，并删除两份重复的 endpoint helper。

## Why it matters

此前三条 AI 链分别拼接 endpoint 和构造 HTTP 请求，修复 base URL 或超时问题时容易产生行为漂移。公共层现在只管理稳定的传输职责，非 2xx 响应仍原样交还调用方，因此各链既能共享修复，也能保留自己的错误前缀、响应兼容逻辑和模型 fallback。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA 功能，也不新增用户可见能力。没有修改 MCP schema、环境变量、配置结构、模型选择或 prompt；真实提供商兼容性仍需后续运行验证，响应 JSON 解析暂未统一，以避免抹平不同 OpenAI-compatible 服务的差异。
