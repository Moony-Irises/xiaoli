---
type: chore
scope: ci
audience: developer
summary: 为 TypeScript 源码和测试建立 ESLint 9 基线，并新增按 moony-mcbot 路径触发的 GitHub CI
breaking: false
demo_ready: false
tests: npm run lint; npm run typecheck; npm test; npm run build; npm ls --depth=0; git diff --check
artifacts:
  - ../.github/workflows/moony-mcbot-ci.yml
  - eslint.config.js
  - package.json
  - package-lock.json
  - docs/lint-ci-design.md
  - README.md
  - TODO.md
  - CLAUDE.md
---

## What changed

新增 ESLint 9 flat config、TypeScript recommended 规则、Node globals 和 `npm run lint`。对两个历史兼容边界使用最小文件级豁免，同时修复其余明确诊断。仓库根新增路径限定的 GitHub Actions workflow，在 Node 20 上执行干净安装、lint、typecheck、完整测试与 build，并以 commit SHA 固定第三方 action。

## Why it matters

此前本地和未来远端提交都缺少统一的静态质量门槛，未使用符号、危险类型退化及测试或构建回归只能依赖人工发现。现在开发者和 CI 使用同一组命令，且不会静默收紧现有 `node >=20` 契约。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA，也不改变 MCP、Adapter、配置及游戏行为契约。当前仓库尚未配置 Git remote，因此 workflow 尚未在 GitHub runner 上实际运行。生产依赖审计仍有 17 个既有问题；CI 暂不以 audit 阻断，破坏性 `npm audit fix --force` 未执行，后续需结合真实登录、认证、寻路和 MCP 回归单独升级依赖。
