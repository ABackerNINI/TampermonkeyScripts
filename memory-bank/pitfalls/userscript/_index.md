# userscript — 用户脚本引擎与元数据

> **本文件是生成物, 不要手改** —— 由 `commands run kb.index` 扫描本目录主题文件的三行头元数据生成; 新增 / 改名 / 改摘要后重跑即可, 冲突也只需重跑。
> 库内细路由见 [memory-bank/README.md](../../README.md)。
> **检索纪律**: 先读本索引定位, 再按需打开单个主题文件 —— **不要整读本目录**。
> **摘要**: Tampermonkey 实现层的通用 JS 坑 —— GM 存储迁移、事件与生命周期、快捷键输入保护、等待元素、命名、状态机与慢站预算，改码前先扫这一类。
> **触发**: 改码前, 排障, 写快捷键, 改 GM 存储, 重构轮询, 配预算, 对命名

## 主题

| 主题 | 一句话 | 触发词 |
|---|---|---|
| [p04-foreach-return-noop.md](p04-foreach-return-noop.md) | `forEach` 回调里 `return []` / `return {}` 不中断迭代，看似跳过实则无效。 | 写行校验, 重构 forEach, 排查跳过逻辑 |
| [p07-waitforelement-resolve.md](p07-waitforelement-resolve.md) | 覆盖 `resolve` 只为命中时清超时定时器，重构勿删 `clearTimeout`。 | 重构 waitForElement, 改轮询选择器, 排查 Promise reject |
| [p08-shortcut-input-guard.md](p08-shortcut-input-guard.md) | 未检查 `document.activeElement` 会让打字误触全屏/跳转快捷键。 | 新增快捷键, 排查打字误触, 改 keydown |
| [p09-event-lifecycle.md](p09-event-lifecycle.md) | `window.onload` 后 SPA 动态渲染的按钮仍可能未出现，监听注册要防重复。 | 新增页面监听, 排查按钮不出现, 改 onload, 改 GM 持久化 |
| [p10-naming-mismatch.md](p10-naming-mismatch.md) | `getBottomTorrentId()` 与 `getBottomTorrentID()` 大小写不一致，启用 N 键功能前须改名对齐。 | 启用 N 键功能, 排查 ReferenceError, 统一命名 |
| [p28-slow-site-budget-invariant.md](p28-slow-site-budget-invariant.md) | 慢站「经常失败/反馈慢」的三重结构性来源 + 缺失的预算不变式 + 混用的结果语义，2026-09-18 .1 修复。 | 排查经常失败, 改整流程超时, 配预算, 加新状态, 跑 check-ptac-budget |
| [p29-panel-null-status.md](p29-panel-null-status.md) | `buildRowHtml()` 无条件读 `st.status`，首次安装/新接入站点时整条主流程不执行。 | 首次安装, 新接入站点, 排查脚本不工作, 改面板渲染 |
| [p43-unhandledrejection-prefix.md](p43-unhandledrejection-prefix.md) | 全局 `unhandledrejection` 是页面级事件，日志前缀 `[HDHomeUI]` 会把外部异常伪装成本脚本故障，造成归因误导。 | 全局监听, unhandledrejection, 日志前缀, 归因误导, 零异步 |
| [p44-storage-option-migration.md](p44-storage-option-migration.md) | 删掉一个可选项后，老用户 GM 存储里的旧值会变成「未知」，必须静默迁移并写回；配置失效绝不能复用结构损坏的错误码与话术。 | 删选项, 老用户存储, 主题迁移, E_UNKNOWN_THEME, 配置失效 |
| [p47-replace-while-loop.md](p47-replace-while-loop.md) | 批量替换用 `while (s.indexOf(from) >= 0)` 会死循环 —— 当 `to` 包含 `from` 时；全量替换应改用 `split/join` 或 `replaceAll`。 | 批量替换, while 死循环, replace, node -e, 进程挂起 |
