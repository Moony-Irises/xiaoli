---
type: docs
scope: runtime
audience: developer
summary: 补充云端大模型、本地小模型与本地代码的职责分工
breaking: false
demo_ready: false
tests:
  - cmd /c npm run build
artifacts:
  - docs/modded-client-adapter-plan.md
  - TODO.md
---

## What changed

在整合包客户端适配规划中新增了一节 `Model Role Split`，明确：

- 云端大模型负责长期目标、复杂推理、repair 和复杂工序理解
- 本地小模型负责社交、轻量任务解释、整合包百科问答
- 本地代码和规则负责高频动作执行、reactive、自保、容器与 GUI 交互

同时把这条分工也同步进了 TODO，作为后续架构演进的显式任务项。

## Why it matters

如果未来整合包能力和任务复杂度继续上升，继续把所有语义任务都丢给云端 API，不管是成本还是稳定性都会越来越差。先把“什么该上云、什么该本地化、什么永远不该交给模型”写清楚，后续就能更理性地扩展，而不是边做边漂。

## Demo posture / limitations

这次仍然只是规划文档更新，不改变当前运行逻辑。现阶段项目仍以本地代码执行和少量云端规划为主，本地小模型体系还没有开始接入实现。
