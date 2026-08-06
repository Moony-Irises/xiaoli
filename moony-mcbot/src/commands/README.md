# Commands 模块

该目录提供 MCP、Web 和 Agent 可共享的命令调用边界，不直接注册协议入口，也不持有 Mineflayer 或 Agent 黑板状态。

## 当前内容

- `command-dispatcher.ts`：命令注册、Zod 输入校验、统一终态结果和有界内存历史。

命令历史通过 `src/utils/diagnostic-redaction.ts` 保存递归脱敏副本；handler 调用方仍拿到原始成功输出或错误，不能把历史投影反向当作业务结果。

第一版只建模同步等待执行后的 `executed` / `failed`。`accepted`、`confirmed` 和 `cancelled` 必须等动作队列、取消令牌及游戏事件证据存在后再加入，不能把函数正常返回当作游戏确认。

完整试点边界见 [Command Invocation / Action Result 设计](../../docs/command-invocation-design.md)。

## 验证

```powershell
npx tsx --test test/diagnostic-redaction.test.ts test/command-dispatcher.test.ts
```
