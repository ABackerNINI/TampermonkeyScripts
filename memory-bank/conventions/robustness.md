# 代码健壮性与脚本内数据流
> 摘要: 防误触 / 延迟元素 / 解析兜底, 以及配置逻辑分离与结构化返回
> 触发: 写解析逻辑, 加站点, 排障空值

## 4. 代码健壮性约定

- 键盘快捷键必须防误触：先检查 `document.activeElement` 是否为 `input` / `textarea` / `select`，是则直接返回。
- 元素可能延迟出现：优先 `MutationObserver` + 超时（见 `waitForElement`），或 `setInterval` 有限重试（如 BilibiliEnterFullscreen 50 次 × 200ms、BTSchoolHelper 10 次 × 500ms）。
- 外部数据解析：文本一律先 `trim`；数字解析走 `parseCommaIntSafe / parseCommaNumberSafe`（千分位兼容 + 兜底值）；文件大小走 `parseFileSizeInBytes` 得到**数值字节**。
- DOM 查询在可预期失败的路径上做空值兜底（`el ? el.textContent : ''`），不抛错中断整行解析。
- 页面跳转/对话框等复杂交互：拆成步骤数组按序执行，允许单步 `ignoreError`（见 PTAutoCheckIn 的 HDBao/蜂巢案例）。

## 5. 脚本内数据流约定（以 PT/表格解析类为例）

- **配置与逻辑分离**：站点/规则配置集中为数据（如 `SITES` 数组——PTAutoCheckIn 为 group+unit 两级配置、`TorrentState` 映射），引擎只写一套（`executeStep`、`runUnit`、`parseTorrentTable`）。新增站点/单元时**只改配置不改引擎**。
- 解析函数返回结构化对象（宁可多带原始元素引用，如 `_row` / `titleElement`，便于后续滚动/样式操作与调试），不直接操作 UI。
- 所有解析出的「时间」尽量同时保留 `absolute`（`Date`/`title` 属性）与 `relativeStr`（页面显示文本），避免依赖站点格式化。
