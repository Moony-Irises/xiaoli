# 文档索引

本目录按用途导航，不按创建时间导航。遇到内容冲突时，按以下优先级判断：当前代码与测试 > 根目录 `TODO.md` > 当前路线图 > 详细设计 > 历史审计和 release entry。

## 先使用项目

- [手动测试指南](manual-testing-guide.md)：唯一测试主入口，从本地配置、启动、Web 健康检查开始，再进入游戏和专项回归。
- [项目 README](../README.md)：当前能力、安装、环境变量、MCP 和 Web 使用说明。
- [TODO](../TODO.md)：当前任务、未解决问题、待确认契约和手测积压的事实源。

首次测试不要从 MCP Inspector、单个动作设计文档或 release entry 开始。

## 当前架构与路线

- [架构收敛与后续路线图](architecture-convergence-roadmap.md)：当前系统判断、分阶段迁移顺序和明确暂缓项。
- [AI 接管架构](ai-control-architecture.md)：固定行为、Agent 编排和聊天层的职责边界。
- [分层 Agent 框架](hierarchical-agent-framework.md)：Event、Blackboard、Reactive、Executive、Strategic 和 Skill 分层。
- [Agent Runtime State Schema](agent-runtime-state-schema.md)：状态快照、事件、任务、Planner 输入输出和执行器契约。
- [2026-07-31 项目审计](project-audit-2026-07-31.md)：历史基线和问题来源，不作为最新状态清单；最新进度看路线图和 TODO。

## 运行时与接口契约

- [Command Invocation / Action Result](command-invocation-design.md)：跨 MCP、Web、Agent 的统一命令试点。
- [ClientAdapter 构造注入](client-adapter-injection-design.md)：Adapter Factory 与 Runtime 注入边界。
- [ClientAdapter 生命周期](client-adapter-lifecycle-design.md)：连接、断开、监听器和 shutdown 契约。
- [移动事件契约](movement-event-contract-design.md)：安全移动失败、`movementId` 和事件关联规则。
- [采矿 Adapter 迁移](mining-adapter-migration-design.md)：单块采矿安全边界和批量迁移前置条件。
- [持久化与退出生命周期](persistence-lifecycle-design.md)：原子写入、配置重载、请求/队列和 shutdown 顺序。
- [Planner 上下文投影](planner-context-projection-design.md)：云端字段白名单和本地隐私边界。
- [Strategic Layer 生产注入设计](strategic-planner-injection-design.md)：已完成第一阶段生产接线，记录策略、轮次协调、失效复核和后续兼容边界。
- [Tool / Skill Catalog](tool-skill-catalog-design.md)：工具元数据与注册迁移设计。
- [Skill 权限策略](skill-permission-policy.md)：默认 Agent allowlist 与四项已知权限缺口。

## 工程维护

- [Lint 与 CI](lint-ci-design.md)：Node、ESLint、类型检查、测试、构建和依赖审计边界。
- [Release Entry 生命周期](release-entry-lifecycle.md)：`docs/releases/unreleased/` 的格式、验证和未来归档流程。
- `docs/releases/unreleased/`：每轮改动的事实记录，不是测试入口，也不代表功能已经发布或 GA。

## 共享小狸与未来规划

- [共享记忆规划](shared-memory-plan.md)：McBot、Voice 和其它模块共享玩家/地点记忆的边界。
- [共享提示词与上下文规划](shared-prompt-context-plan.md)：各模块 prompt、共享上下文和 source-scoped 状态。
- [整合包客户端适配规划](modded-client-adapter-plan.md)：Companion Mod + Local Bridge 路线，当前尚未实现。
- [灵感收集箱](idea-inbox.md)：尚未进入正式计划的想法与评注。

## 兼容入口

以下旧路径保留为短跳转页，正文已经合并或被当前文档取代：

- [旧 Agent 验收场景](agent-acceptance-scenarios.md) -> 手动测试指南第 0.6 节和 Agent 专项章节。
- [旧 Agent 核心链清单](agent-core-chain-checklist.md) -> 手动测试指南第 0.5、0.6、6、9 节。
- [早期登录与技术栈方案](tech-stack-architecture.md) -> 项目 README、手动测试指南和当前路线图。
