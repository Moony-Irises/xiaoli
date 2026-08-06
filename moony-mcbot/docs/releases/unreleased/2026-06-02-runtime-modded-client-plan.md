---
type: docs
scope: runtime
audience: developer
summary: 补充整合包客户端支持的 adapter 化改造方案
breaking: false
demo_ready: false
tests:
  - npm run build
artifacts:
  - docs/modded-client-adapter-plan.md
  - README.md
  - TODO.md
---

## What changed

新增了一份整合包客户端适配规划文档，明确当前项目为什么只能稳定覆盖原版/协议兼容路线，以及未来如果要支持“本地双开整合包客户端”应该如何演进。

文档把迁移方向收敛到一条主线：保留现有高层 agent/runtime/memory/territory/logistics 架构，把底层 `mineflayer` 执行层抽象成 `ClientAdapter`，再为真实整合包客户端增加 `ModdedClientAdapter + companion mod bridge`。

同时把“整合包百科层”和“模组能力索引层”也补进了规划：

- 第一次进入某个整合包时读取 mod 列表，建立 `PackProfile`
- 通过 CurseForge / Modrinth / MCMOD 等来源建立 mod 百科缓存
- 建立 `ModCapabilityIndex`，为后续容器、工作站、recipe 交互做统一抽象
- 最终再落到具体的 `ModSkillPack`

同时补了 README 索引和 TODO 任务追踪，方便后续按阶段推进。

## Why it matters

这个项目现在最容易误判的地方，是把“整合包支持”当成给 mineflayer 多打几个补丁的问题。实际上瓶颈不在高层 agent，而在底层客户端执行载体。

把这个判断写清楚之后，后续开发就不会继续在错误层面堆复杂度，而是会先做 adapter 抽象、再做 bridge MVP，同时把 mod 知识层和 capability 索引层前置规划好，从而保住现有原版路线的稳定性，并为后面“真正会玩 mod”留出清晰落点。

## Demo posture / limitations

这次是纯设计文档和任务追踪更新，没有改变当前 bot 的运行能力。小狸现在仍然主要适用于原版/协议兼容环境；整合包支持还没有开始实现，只是把技术路线和迁移边界定义清楚了。
