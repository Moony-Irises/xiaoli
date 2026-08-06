# Automated Tests

默认入口：

```powershell
npm test
```

该命令自动发现 TypeScript 测试，并通过 `scripts/test-setup.ts` 把持久化路径隔离到每个测试进程自己的系统临时目录。不要在测试中读取正式账号、AppData 配置或 `C:\xiaoli\memory`。

定向执行时继续使用 npm 入口，以保留相同 setup：

```powershell
npm test -- test/local-env.test.ts
```

Node reporter 会把预加载的 setup 及其 helper 各显示为一个文件级通过项；它们没有注册业务测试，这是预加载模块的报告口径。
