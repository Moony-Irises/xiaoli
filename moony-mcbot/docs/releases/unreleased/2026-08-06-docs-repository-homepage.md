---
type: docs
scope: docs
audience: public
summary: 新增小狸仓库首页并集中说明能力、限制、架构与快速开始流程
breaking: false
demo_ready: false
tests:
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - ../README.md
  - CLAUDE.md
  - TODO.md
  - docs/releases/unreleased/2026-08-06-docs-repository-homepage.md
---

## What changed

在 Git 仓库根目录新增面向首次访问者的中文 README，加入 CI、Node.js、TypeScript 与阶段徽标，并集中说明小狸的项目定位、当前能力、明确限制、运行架构、快速开始、质量门禁、目录结构、文档入口、安全边界和后续路线。

## Why it matters

此前 GitHub 首页没有根 README，访客必须先猜测 `moony-mcbot/` 的用途并阅读很长的模块能力清单。新的首页提供最短理解和启动路径，同时把已实现能力与整合包长期规划明确分开，减少成熟度误判。

## Demo posture / limitations

本轮不是 install demo，不是产品发布，也不是 GA。README 只描述当前代码、测试和既有规划，不代表 Modded Client Bridge、复杂模组技能或全部真实服务器回归已经完成；详细配置与完整工具清单仍以 `moony-mcbot/README.md` 和测试文档为准。
