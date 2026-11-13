# HDHomeUI 版本历程（三）
> 摘要: 版本历程加粗日期版本条目第三组: UNHANDLED_REJECTION 归因修正、A/A·GB 可选列、2026.09.19.3 重构要点
> 触发: 查版本历程, 查可选列时序, 查重构要点

- **2026.09.19.6：修正 `UNHANDLED_REJECTION` 的归因误导**（用户贴来
  `[HDHomeUI] WARN UNHANDLED_REJECTION TypeError: ... reading 'innerText'`）：
  本脚本**没有任何 `innerText`**，也**没有任何异步代码**（无 `async` / `await` / `new Promise` / `.then`），
  因此它**不可能自己抛出** Promise 拒绝 —— 它只是**观察方**。`unhandledrejection` 是**页面级**事件，
  别人的异常也会进来，而日志前缀写的是 `[HDHomeUI]` ⇒ 把外部故障伪装成了本脚本故障。
  现在监听里补上 **stack 首帧** + 显式结论「来自页面或其它脚本（本脚本无异步代码），非 HDHomeUI 故障」；
  并在 `check-hdui-static.js` 钉死「零异步」不变量 —— 将来引入异步时该断言变红，提醒同步改这段措辞
  （否则免责声明就成了谎言）。详见 `pitfalls/_index.md` **P43**。
  （该 `innerText` 真实位于 `PTAutoCheckIn.user.js` 的 `visibleText()`，且该函数有 `if (!el) return ''` 守卫。）
- **2026.09.19.4：A / A·GB 两列改为「可选列 + 等结构就绪」**（用户实测报错 `E_COLUMN_UNKNOWN: a,ave`）：
  那两列是**别的脚本**注入的（表头 `#calcTHeadA` / `#calcTHeadAve`，数据格带 `data-calc-a`），
  注入时机比本脚本晚 —— 旧版把 12 列当硬性契约，它还没跑完就判结构损坏 → 弹红横幅回退；
  用户点「重新尝试」时列已经在了，于是成功。**纯粹是时序问题**，不是结构坏了。
  现在的规则：
  · `OPTIONAL_COLUMNS = ['a','ave']`，`REQUIRED_COLUMNS` 由全集剔除得出（不两处各写一遍，免得漂移）；
  · 缺可选列 ⇒ 返回 **`OK_NO_CALC`（成功码）**，照常上妆，只是跳过这两列的排版；
  · 列集合变了（那个脚本补进来 / 撤走了）⇒ 结构守卫比对 `colMapSig`，**重摆一次**让 `nth-child` 重新对齐；
  · 补列补到一半（表头插了、数据行没插完 ⇒ `ROW_CELL_COUNT_MISMATCH`）⇒ **先进等待窗口**
    （`armPending` 首装 8s / 运行中 4s，每 700ms 主动试一次），窗口内恢复就静默上妆，
    超时才 `E_STRUCT_TIMEOUT` 回退；等待期间 `data-hdui-state="pending"`，**已上妆的不卸妆**（免闪一下）；
  · `E_COLUMN_UNKNOWN` / `E_ANCHOR_MISSING` **不进等待窗口** —— 那两个码在 A/A·GB 变可选之后
    只可能是「必需的东西真没了」，等也没用，直接回退。
- **导航项必须显式 `background:transparent`**（`.15` / pitfalls **P53**）：站点 `ul.menu li a`
  自带 **1px 白边 + `#dedede` 浅灰底**，只写 `border:0` 不清底 ⇒ 首页/论坛等就是一排白页签。
  原型 `film.html` 的导航项**默认无底**（只有 hover 的 5.5% 白），所以从原型派生的仿真页也没有这条底
  —— **仿真页已在 `.15` 补上 `ul.menu li a{border:1px solid #fff;background:#dedede}`（真站量出来的）**。
  共通教训：清样式要**成对清**（border / background / box-shadow / outline），漏一个就是一块原站色漏出来。
- 入口**内嵌**在导航栏末尾（`ul#mainmenu` 最后一个 li 的右侧空档），不再用右下角浮动圆钮 ———
  与 PTAutoCheckIn v2 等脚本的 FAB 抢同一个位置，2026-09-19 决定改。位置由 `dockRect()` 量取；
  菜单缺位时退到 `table.mainouter` 右上；都没有再退到 `position:fixed` 兜底。
  重摆只在改 left/top/position，**不整体重写 cssText** —— 整体重写会把宿主上的 `--ui-*` 配色变量一起清掉。
- **2026.09.19.3 重构要点**（⚠️ ② 里那 5 套已于 `.7` **全部移除**，改为单一「胶片墙」，此处留作历史）：
  ① FAB 改成内嵌文字钮 `界面 · <主题名> ▾`，面板改为锚在它下方的下拉浮层（不再贴视口右下）；
  ② 5 套版式全面重画，每套有**独立的版式骨架**（不再是「12 个格子挤一行 + 换个底色」）：
  · 片库索引：表体 grid 卡片网格，行内 6 轨 grid 分三区（主行/指标带/尾注），每指标 = 「标签 + 值」独立块；
  · 电传纸带：唯一保留 `display:table` 语义的一套，纸黄+全等宽+反白表头+数字右对齐+细点竖线分栏；
  · 大开本：flex 三行（标题 / 署名 / 规格），零高伪元素 `::before/::after` 做版面换行点；
  · 瑞士网格：grid 6 列×3 行，零线条全靠留白，做种数 28px 钴蓝锚点；
  · 播控台：grid 4 轨道，类别色点 + 做种电平条。
  导航 `ul#mainmenu` 全部改成 `display:flex;flex-wrap:wrap` + `--hdui-navgap` 显式列间距，
  不再让 16 个 `inline-block` 紧挨挤一坨。
- **真实标记已核验**：用 `resources-do-not-track/` 下已脱敏的整页离线跑过 `headerKey()` 与契约判定，
  12 列全部识别、数据行 12 格、4 个 A 级锚点齐全（脚本 `.workbuddy-ai/_verify-hdui-real-page.js`，不入库）。
- **视觉复核**（不入库）：`.workbuddy-ai/_shot-hdui.js` 在仿真服务器里对各主题截三张
  （顶部内嵌入口 / 中部版式 / 面板展开），`hdui-shots/{id,id-top,id-panel}.png`，仅结构化复刻页内容。
  `.workbuddy-ai/hdui-shots/index.html` 是胶片墙的对照表（含导航 16 色撞色分析）。
- 匹配：`*://*.hdhome.org/*`，`@run-at document-start`（**确实在 document-start 干活**：立刻铺主题底色防闪白。
  此时 `<head>` 通常还没建，`injectCss` 自动退到 `<html>`；若连 `<html>` 都尚未创建（注入点比 Tampermonkey
  更早时会出现，例如测试用的 `addScriptToEvaluateOnNewDocument`），退化为「`<html>` 一出现就铺」
  （`paintBootBgWhenPossible`），最迟由 `boot()` 在 DOM 就绪后再补一次。
  实测注入发生时 `document.readyState` 仍为 `loading`，**早于 `DOMContentLoaded`**）
- 权限：`GM_getValue` / `GM_setValue`（**不申请任何网络类权限**）
- 存储键：`hdui.theme`（当前主题 id）、`hdui.lastError`（上次结构错误）

---

