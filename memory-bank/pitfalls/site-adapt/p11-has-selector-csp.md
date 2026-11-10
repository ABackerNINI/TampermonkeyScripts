# `:has()` 等选择器在站点端页面可能被 CSP/沙箱影响
> 摘要: `:has()` 等选择器真正风险是站点页面结构改版，不是 CSP/沙箱。
> 触发: 站点改版, 更新选择器, 发版前回归

- **触发**: 用 `:has()` 等选择器，或站点开启严格 CSP / Tampermonkey 在 `document-start` 注入受限。
- **判别**: `querySelectorAll` 一般不受影响；真正风险是**页面结构改版**（类名/嵌套层级变化）。
- **处置**: 以 `src/BTSchoolTorrentsTableSample.html` 为回归样本，站点改版后先对照该样本更新选择器再发版。

## P11. `:has()` 等选择器在站点端页面可能被 CSP/沙箱影响

若站点开启严格 CSP 或 Tampermonkey 在 `document-start` 注入受限，`querySelectorAll` 一般不受影响；真正风险是**页面结构改版**（类名/嵌套层级变化）。以 `src/BTSchoolTorrentsTableSample.html` 为回归样本，站点改版后先对照该样本更新选择器再发版。

