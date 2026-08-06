# Developer Scripts

`scripts/` 存放不进入生产构建、但必须通过 ESLint 和严格 TypeScript 检查的仓库维护工具。

## Release Entry Validator

```powershell
npm run validate:releases
```

`release-entry-validator.ts` 只读检查 `docs/releases/unreleased/*.md`，验证文件名、固定 frontmatter、tests/artifacts 和三段正文。历史 `tests` 可使用单行命令或列表；校验器不会修改、移动或发布条目。完整契约和归档边界见 [Release Entry 生命周期](../docs/release-entry-lifecycle.md)。

## Test Runtime Isolation

`test-setup.ts` 由默认 `npm test` 命令预加载。它调用 `test-runtime-path-isolation.ts`，为每个 Node 测试进程建立独立临时 data、memory、chat config、prompt profile、chat log 和 env 文件路径，并在进程退出时递归清理。

生产代码不识别测试模式，正式路径解析没有变化。定向测试也应通过 npm 入口运行：

```powershell
npm test -- test/runtime-path-isolation.test.ts
```
