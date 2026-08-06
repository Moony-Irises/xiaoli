---
type: feature
scope: ci
audience: developer
summary: 未发布条目新增固定契约校验、npm 命令和 GitHub CI 门禁
breaking: false
demo_ready: false
tests:
  - npm run validate:releases
  - npx tsx --test test/release-entry-validator.test.ts test/quality-gates.test.ts
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - scripts/release-entry-validator.ts
  - scripts/README.md
  - test/release-entry-validator.test.ts
  - test/quality-gates.test.ts
  - package.json
  - eslint.config.js
  - tsconfig.test.json
  - ../.github/workflows/moony-mcbot-ci.yml
  - docs/release-entry-lifecycle.md
---

## What changed

新增只读 TypeScript 校验器，检查未发布条目的真实日期、文件名 scope、固定 frontmatter 枚举与布尔、非空 tests/artifacts，以及三段有序正文。提供 `npm run validate:releases`，脚本进入 ESLint 与严格 TypeScript 检查，并在 GitHub CI 的 lint 前执行。9 个不符合当前 scope 命名契约的旧条目已在确认无外部引用和目标冲突后规范化；同主题 feature/test 条目继续分别保留。

## Why it matters

发布说明现在可以继续作为事实源，而不会依赖人工逐个检查 177 个以上文件。新增或修改条目一旦缺字段、使用错误枚举、写错日期/scope、留下空验证命令或缺正文，会在本地和 CI 直接失败；历史单行 `tests` 仍保持兼容。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。校验器不会改写、移动或聚合条目，不会从 commit message 猜测发布事实，也不代表已经形成首次 release。release 版本、日期、受众、归档目录和 TODO 历史迁移仍需另行确认。
