---
type: chore
scope: workspace
audience: developer
summary: 完成 GitHub 上传前隐私审计并记录历史清理阻塞项
breaking: false
demo_ready: false
tests:
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - .gitignore
  - TODO.md
  - docs/releases/unreleased/2026-08-06-workspace-pre-push-privacy-audit.md
---

## What changed

复核根目录忽略边界、待提交文件、暂存区、现有 Git 历史和 `.env.local.example`。真实环境文件、共享记忆、Voice、图片、本地 MCP 配置与计划表继续保留在上传范围之外，并在 TODO 中记录历史邮箱、remote 和 GitHub 认证阻塞项。

## Why it matters

在首次推送前先区分当前工作树秘密与已提交历史隐私，避免只删除工作树内容却继续把旧登录邮箱或个人提交邮箱上传到远端。审计过程不回显已知凭据值。

## Demo posture / limitations

本轮不是 install demo，不是产品发布，也不是 GA。审计未发现上传快照中的真实 API key、私钥或密码，但这不代表覆盖所有未知凭据格式或替代 GitHub 服务端扫描。唯一旧提交已重建为 noreply 身份的新根提交，`main` 已首次推送至目标仓库。
