# Debug 模块

该目录提供与 MCP server 同进程运行的本地 Web 调试面板。默认只监听 `127.0.0.1:4637`；非 loopback 绑定必须配置 token，并继续接受 origin 与请求体大小检查。

## 历史区分

- `Command History`：跨 MCP、Web、Agent 的统一命令终态，当前只覆盖 `move.stopFollow`。
- `Action History`：Web `/api/action/*` 请求历史；payload、result 和 error 在写入历史时统一递归脱敏并复制，endpoint 返回不变。
- `Client Adapter.recentActions`：实际经过 `BotRuntime -> ClientAdapter` 的底层动作记录。

三者不能互相替代。`Command History.status=executed` 只表示命令 handler 已完成，不代表服务器或游戏事件已经确认最终行为。

Command/Action History 共用 `src/utils/diagnostic-redaction.ts`。它会处理嵌套对象、数组、常见敏感键、赋值形式的秘密和 Bearer 凭据，并把循环引用投影为 `[circular]`；它不能识别放在无语义普通字段里的任意秘密，因此调试输入仍禁止使用真实凭据。

## 验证

```powershell
npx tsx --test test/diagnostic-redaction.test.ts test/debug-web-goal-dialog.test.ts test/debug-web-security.test.ts test/stop-follow-command-integration.test.ts
```
