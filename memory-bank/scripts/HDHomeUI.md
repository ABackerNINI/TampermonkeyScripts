# HDHomeUI（`src/HDHomeUI.user.js`）

> HDHome 界面主题：**胶片墙**（一套，可在面板里切回「原站默认」）。纯样式层改造，
> **不重建 DOM、不接管交互**，原站功能全部保留；页面结构一旦与预期不符，**提示并回退站点默认界面**。
> 设计依据与实施计划见 `tasks/TASK018-hdhome-ui-themes.md`。

- 当前版本：`2026.09.19.10`（`.4` 已提交 `4e01743`、`.3` 已提交 `bc2c0cd`、`.2` 已提交 `1b38510`，
  分支 `dev`，均已推 gitee；`.5`–`.10` **均待用户审核后提交**）
- **2026.09.19.10：两个布局陷阱（都是"宽屏测不出、窄屏才暴露"）。**
  ⚠️ 根因同源：站点外层是**固定宽 + `table-layout:auto`**，会被内容的 `max-content` 撑开。
  ① **上妆把整页撑宽**：文档宽 **1260 → 1503**，窄屏得多横向滚 240px。
     因为 `min-width:0` 只管**收缩**（min-content），**管不住 max-content** —— 长标题把容器顶宽。
     修：标题列 `max-width:max(240px,calc(100vw - 900px))`（900 = 固定列宽和+间距+留白的约数，
     改列宽时要同步调）。实测回落 **1260，与原站持平**。
  ② **窄屏导航点不到**：脚本把 `ul#mainmenu` 改 flex 防挤，但导航条拿到 1248px，
     `flex-wrap` 不触发 → 单行排到 1218，视口 1024 时最后 2–3 项 `elementFromPoint` 返回 null。
     **原站 inline 布局会自然换行，换 flex 后必须显式给 `max-width:100vw` 才会 wrap。**
     修后 1024/900 下均 **0/16 被挡**，宽屏无影响。
  新测试 `sim-hdui-layout-width.js`（第 26 个）：文档宽 ≤ 原站、窄屏导航 0 被挡、滚动后片头吸顶
  （`Emulation.setDeviceMetricsOverride` 改视口）。详见 `pitfalls.md` **P46**。
- **2026.09.19.9：① 首装直接上妆；② 导航 16 色去撞色。**
  · **首装默认改为 `FIRST_ID = 'film'`** —— 旧行为是首装不上妆（`DEFAULT_ID`），
    装完还得手动切一次才看得到界面，与"全面改为新 UI"的意图不符。
    ⚠️ `FIRST_ID` 只在**存储里没有值**时生效；用户一旦选过（含选「原站默认」）一律以存储为准，
    不会被强推回胶片墙。四处读取（`applyStored` / 等待窗口重试 / `tickPending` / `paintBootBg`）
    必须**全部**用 `FIRST_ID`，漏一处就会出现"首装读成 default"的矛盾。
  · **导航配色去撞色**（方案 B，改 `ICON_NAV` 4 行）：
    `home #f5b342→#eda23c`（饱和 90→83，收跳脱感）、`upload #d99b2b→#e0762c`（H39→25 推成橙）、
    `shield #c9a86a→#a99e8b`（降饱和变暖灰）、`logdoc #57c9a8→#94a3b8`（中性石板灰，
    让青绿独占给种子）。真撞对数 **4 → 0**。
    ⚠️ 判据必须是**三维**（`Δh≤8 且 Δs≤20 且 Δl≤15`）—— 只看色相会得到虚高的问题数
    （7 对 vs 真实 4 对），据此改色会白动一堆没问题的颜色。详见 `pitfalls.md` **P45**。
- **2026.09.19.8：旧主题 id 自动迁移 —— 删主题的收尾**（用户实测
  `[HDHomeUI] 页面结构与预期不符(E_UNKNOWN_THEME) ... 未知主题 tape`）：
  他以前选的就是 `tape`，`.7` 把主题删了但 GM 存储里的值还在。两个错：
  ① **不该报错** —— 用户没做错事，是我们删的；老用户本就"选过主题、想用主题"，应静默迁到胶片墙
  并写回存储；② **错误码张冠李戴** —— `E_UNKNOWN_THEME` 被当结构类处理，用了
  「页面结构与预期不符」的横幅 + 走「等结构就绪」窗口；可这是**配置值失效**，等也不会变好
  （与 P43 同类的归因误导）。
  现在：`LEGACY_THEMES`（旧 5 套）+ `LEGACY_MIGRATE_TO = 'film'` 静默迁移；
  `CONFIG_CODES = ['E_BAD_THEME']` 与 `STRUCT_CODES` 分开；`showAlert` 按错误码分流措辞
  （配置类说「主题设置无效」，按钮给「改用胶片墙」而不是没用的「重新尝试」）。
  新增第 25 个测试 `sim-hdui-legacy-theme.js` + 静态 §11。详见 `pitfalls.md` **P44**。
  ⚠️ **今后删任何主题，都要把它的 id 登记进 `LEGACY_THEMES`** —— 静态断言会提醒，但登记是人的责任。
- **2026.09.19.7：旧的 5 套主题（片库索引 / 电传纸带 / 大开本 / 瑞士网格 / 播控台）全部移除，
  改为单一主题「胶片墙」`（id: film）`** —— 用户判定那 5 套"已经没用了"。
  ⚠️ **这套新 UI 的原型早就有了**：`.workbuddy-ai/hdui-mock/film.html`（标题即「胶片墙(配色/结构/图标/按钮 重做)」），
  `.5` 的图标体系正是在它上面定稿的 —— 但当时**只移植了图标层，没把主题本身落地**，
  生产脚本里 `film` 只出现在一行「图标来源」注释里。这是 `.5` 的疏漏，`.7` 补上。
  骨架特征（每条都由 `check-hdui-static.js` §4 + `sim-hdui-theme-switch.js` 钉死）：
  · **片基**：`#torrenttable > tbody` 是纵向 `flex`，左右各一条 `::before/::after` 齿孔轨道
    （`repeating-linear-gradient`，宽 11px，9px 亮 / 13px 透），`padding-left:34px;padding-right:26px`；
  · **帧号**：行 `::before` 用 `counter(frame, decimal-leading-zero)` 打在左侧片边（`left:-24px`），
    纯 CSS 不写 DOM；
  · **片头**：表头 `position:sticky;top:0` 吸顶，`z-index:6`，每列一个可点排序目标；
    原本只有图标没有栏名的列，用 `a::after` 补中文栏名（评论/存活/大小/做种/下载/完成/发布者）；
  · **帧**：行是横向 `flex`，`min-height:50px`，`--hdui-card` 底，`border-bottom:1px solid --hdui-bg` 分隔；
  · **做种数是唯一锚点**：20px 金色 + `::after` 内嵌占比条 `width:calc(var(--hdui-ratio,0) * 100%)`；
  · **数值靠字号分层，不靠色相**（11.5 / 12 / 13 / 20px），等宽数字右对齐成列 —— 配色才不打架；
  · **置顶**用 `box-shadow:inset 3px 0 0` 金色内阴影（不占流，不把列推开）；
  · 配色 = 5 层语义灰（`ink0..ink3` + `line`）+ **唯一强调金 `#f5b342`** + 7 类别色（避开金色系，
    让金色只属于"做种/强调"）。
  **移植踩坑**：原型导航 `navitem` 是 `7px 11px`，真站放不下 —— 视口 1262px 时第 16 项「管理组」
  被挤出屏幕（`elementFromPoint` 返回 null，`sim-hdui-inline-dock` 抓到）。收到 `6px 9px` 才通过
  （最后一项中心 1218 < 1262）。**原型是理想宽度，真站要实测收窄。**
  配套删除：随旧主题一起失效的 `statStack` / `statInline` / `headStrip` 三个排版工具
  （胶片墙不用「标签+值」成块，栏名在表头），由 `tdSel` / `tdRule` 取代（同样对缺列免疫）。
- **2026.09.19.6：修正 `UNHANDLED_REJECTION` 的归因误导**（用户贴来
  `[HDHomeUI] WARN UNHANDLED_REJECTION TypeError: ... reading 'innerText'`）：
  本脚本**没有任何 `innerText`**，也**没有任何异步代码**（无 `async` / `await` / `new Promise` / `.then`），
  因此它**不可能自己抛出** Promise 拒绝 —— 它只是**观察方**。`unhandledrejection` 是**页面级**事件，
  别人的异常也会进来，而日志前缀写的是 `[HDHomeUI]` ⇒ 把外部故障伪装成了本脚本故障。
  现在监听里补上 **stack 首帧** + 显式结论「来自页面或其它脚本（本脚本无异步代码），非 HDHomeUI 故障」；
  并在 `check-hdui-static.js` 钉死「零异步」不变量 —— 将来引入异步时该断言变红，提醒同步改这段措辞
  （否则免责声明就成了谎言）。详见 `pitfalls.md` **P43**。
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

## 1. 架构决策：纯样式层 + 运行时列映射

这是「换肤不能换掉功能」的核心保障。

| 方案 | 功能保持 | 误触风险 | 结论 |
|------|----------|----------|------|
| **A. 纯 CSS + 运行时生成的 `nth-child` 规则** | DOM 与站内事件处理器原封不动 | 脚本永不 click / submit / dispatch | **采用** |
| B. 解析表格后重建卡片 DOM | 需重绑 7 类交互，漏绑即功能缺失 | 重建节点可能挂错 href（RSS/登出/签到） | 否决 |

要点：

1. **列索引运行时探测**：读 `#torrenttable` 表头（文本 / `img` class / `#calcTHeadA*`），
   产出 `colMap`（类型→1、标题→2 …），再**据此动态生成 CSS**，而不是写死 1..12。
   站点加列 ⇒ 映射自动跟随；少列或改名 ⇒ 判为结构错误，走回退。
2. **对站内 DOM 的唯一改动**：`<html>` 上的 `data-hdui-theme` / `data-hdui-state` 状态属性、
   已校验行上的 `--hdui-cat`（类别色）与 `--hdui-ratio`（做种占比）自定义属性，卸载时全部清理。
   **绝不**：增删/移动/克隆**站内**节点、给站内元素挂事件、改 `href`、改文本。
   > 脚本**自建**的节点不算违反上条，它们是自持 UI 的一部分，同样在 `unload()` / `dismissAlert()` 中清理：
   > `<style id="hdui-css">`（主题样式）、`<style id="hdui-boot">`（document-start 铺的底色）、
   > `#hdui-alert`（结构错误横幅，挂在 `document.body` 上，故需可见）、`#hdui-root`（浮动开关宿主）。
3. **自持 UI 隔离**：浮动开关 + 面板放进 **closed shadow root**，事件 `stopPropagation`，
   不冒泡到站内 document 级监听（用例 `sim-hdui-danger-guard` 钉死）。

---

## 2. 种子表十二列契约（改版检测抓手）

| # | 列 | 表头识别 |
|---|---|---|
| 1 | 类型 | 文本「类型」 |
| 2 | 标题 | 文本「标题」 |
| 3 | 评论 | `img.comments` / title=评论数 |
| 4 | 存活 | `img.time` / title=存活时间 |
| 5 | 大小 | `img.size` / title=大小 |
| 6 | 种子数 | `img.seeders` |
| 7 | 下载数 | `img.leechers` |
| 8 | 完成数 | `img.snatched` |
| 9 | 进度 | 文本「进度」（`td[align=center]`，无 class） |
| 10 | A | `#calcTHeadA` |
| 11 | A/GB | `#calcTHeadAve` |
| 12 | 发布者 | 文本「发布者」 |

另有 **A 级锚点**：`table.mainouter`、`#nav_block`、`#info_block`、`ul#mainmenu`。

错误码：

| 码 | 触发 |
|---|---|
| `E_ANCHOR_MISSING` | A 级锚点缺失（横幅点名缺了哪个） |
| `E_COLUMN_UNKNOWN` | 12 列里有识别不出来的（横幅点名缺哪列） |
| `ROW_CELL_COUNT_MISMATCH` | 列都在，但数据行单元格数与表头不符 |
| `E_STRUCTURE_CHANGED` | 运行中（MutationObserver）发现结构被改坏 |
| `E_APPLY_FAILED` / `E_UNKNOWN_THEME` / `E_BOOT_FAILED` | 自身异常，一律落到 `Diag` |

回退动作：卸掉全部 `hdui-*` 样式与自定义属性 → 写 `hdui.lastError` → `console.error` →
页面顶部**红色横幅**（含错误码 + 「重新尝试」「知道了」）→ 主题显示回落 `default`。

---

## 3. 五套主题

| id | 名称 | 布局骨架 | 字体 | 配色要点 | 行 display |
|---|---|---|---|---|---|
| `reel` | 片库索引 | 表体 `grid` 卡片网格（auto-fill 320px） | 衬线 + 等宽数字 | 深炭底 `#16181c` / 暗金 `#c8a35a` 色条 | flex |
| `tape` | 电传纸带 | **保持 `display:table`**，行高 22px 密排 + 斑马纹 | 全站等宽 | 纸黄 `#f4efe3` / 单红 `#a12a20` | table-row |
| `sheet` | 大开本 | 单列长条，标题 17px 独占一行 + 双细线 | 衬线 | 纸白 `#fbfaf7` / 暗朱红 `#8f2b21` | flex |
| `swiss` | 瑞士网格 | 多列弹性排布，标题 60% 宽，**零线条靠留白** | 无衬线 | 纯白 / 黑 / 钴蓝 `#1a35d8`，做种数 28px | flex |
| `signal` | 播控台 | 行 `grid` 4 轨道 + 电平条 + 类别色点 | 无衬线 + 等宽数字 | 深石板 `#0f1620` / 青 `#5fd4e4` | grid |
| `default` | 原站默认 | 不注入任何样式 | — | — | — |

> 区别不只颜色：表格/表体/行的 `display`、网格轨道数、做种数字号（22/12/12/28/18px）、
> 行分隔手段（3px 色条 / 0 / 2px 双线 / 0 / 1px）、字体族均不同 —— 由
> `sim-hdui-theme-switch.js` 的「版式签名两两不同」断言钉死。
>
> 例外：`tape` 的 `navIcons: false` —— 它的导航用 `::before`/`::after` 画 `[ ]` 方括号，
> 不挂导航图标（详见 §7）。其余 4 套都挂。

---

## 4. 交互

- 内嵌开关（UI）→ 面板列出 2 项（原站默认 + 胶片墙），当前项 `aria-pressed=true`，
  面板底部是**诊断区**（当前主题、上次错误码、最近 5 条诊断）。
- 快捷键 `Alt+Shift+T` 循环切换（`input/textarea/select` 聚焦或 `contentEditable` 时直接返回）。
- 选择即写入 `GM_setValue('hdui.theme')`，下次进站自动恢复。
- **首次安装默认 `default`（原站默认）**：装完不擅自改用户看到的界面，主题由用户自己在面板里选；
  已存过主题的老用户不受影响（`applyStored` 的兜底值从 `reel` 改成 `DEFAULT_ID`）。

---

## 5. 安全与错误处理

- **危险 API 静态禁令**（`tests/hdhomeui/check-hdui-static.js` 逐条扫描）：
  无 `.click()`、`dispatchEvent`、`.submit()`、`eval`、`new Function`、`innerHTML`、
  `cloneNode`、`fetch` / `XMLHttpRequest` / `GM_xmlhttpRequest`、不得改站内 `href` / 挂 `onclick`。
- **不静默**：统一 `Diag` 账本（info/warn/error + `Diag.fail(code, err)`），
  `window` 的 `error` 与 `unhandledrejection` 只记录不吞（不 `preventDefault`）；
  禁止空 catch（静态扫描）；fatal 必弹可见横幅。
  ⚠️ **`unhandledrejection` 是页面级事件，前缀 ≠ 来源**：日志必须带 stack 首帧并显式声明
  「来自页面或其它脚本，非 HDHomeUI 故障」，否则会把别的脚本的异常记在本脚本头上（P43）。
  该免责的前置条件是「本脚本零异步」，由 `check-hdui-static.js` 断言守护。
- **运行时守卫**：`MutationObserver` 观察 `#outer`（取不到则退到 `document.body`）的 `childList`
  （debounce 500ms），局部刷新后重新校验；坏了就回退，没坏就重画 `--hdui-cat` / `--hdui-ratio`。
  ⚠️ **`unload()` 必须先 `stopWatch()`**：否则回退到默认界面后 MutationObserver 仍在空转（白占资源）。
- **启动时序**：`document-start` 调 `paintBootBgWhenPossible()` 铺底色 → `DOMContentLoaded` 才 `stopBootWatch()`
  + `mountUi()` + `applyStored()`。铺底色失败独立记 `E_BOOT_PAINT`，不影响后续上妆；
  上妆成功时 `unload()` 会先把底色样式撤掉，由主题 CSS 接管。
- **防误触清单**（本页特有）：不碰签到 `attendance.php`、RSS 增删 `myrss.php`、
  登出 `logout.php`、魔力 `mybonus.php` —— 脚本从不主动访问，测试断言这些端点零请求。

---

## 6. 测试

| 用例 | 覆盖 |
|---|---|
| `tests/hdhomeui/check-hdui-static.js` | 元数据 / 最小权限 / 危险 API 禁令 / 无空 catch / 无 window 钩子 / 5 主题齐备且结构声明互异 / 契约定义完整 / **启动时机与默认行为**（`unload()` 停守卫、首次安装默认 `default`、铺底色早于 readyState 分支） |
| `tests/hdhomeui/sim-hdui-function-parity.js` | 胶片墙上妆后功能基线快照逐字段不变、关键元素 hit-test 可点、RSS 点击恰好 1 次请求、搜索箱折叠与表单提交仍工作、局部重排不误判 |
| `tests/hdhomeui/sim-hdui-theme-switch.js` | 版式签名两两不同、各套骨架特征、切回默认卸干净、记忆、面板点击、快捷键 |
| `tests/hdhomeui/sim-hdui-structure-guard.js` | 缺列 / 行列数不符 / 缺锚点 ⇒ 回退 + 横幅 + 记录 + 零危险访问；空表体与无表页不算错；运行中改坏自动回退 |
| `tests/hdhomeui/sim-hdui-danger-guard.js` | 自持 UI 点击不冒泡到站内监听、切换零站内请求、站内监听与 RSS 仍存活、危险入口未被挂 onclick |
| `tests/hdhomeui/sim-hdui-icons.js` | **图标真的画出来了**（不只是"没回归"）：类别/指标图标 `content` 是内联 SVG 且**宽度 > 0**（P42 固有尺寸）；导航 16 项挂上 SVG 且**保种 ≠ 断种**；站内 RSS 链接不被压成零宽 |

仿真剧本：`tests/lib/sim/hdhome-ui-page.js`（**结构化复刻、零私有数据**，
变体 `hdhome-ui` / `-broken` / `-shape` / `-empty` / `-notable` / `-nonav`）；
共享工具 `tests/lib/hdui-help.js`；`harness.withSim(fn, { scriptPath })` 支持测任意脚本。

---

## 7. 图标体系（`ICONS` / `iconCss` / `navIconCss`）

**站内所有图片位一律换成内联 SVG（data URI），实心 + 语义色。** 仍然只改 CSS 的
`content` / `background-image`，**不增删站点 DOM** —— 纯样式层铁律不变。

| 组 | 数量 | 选择器 | 说明 |
|---|---|---|---|
| 类别 | 7（含别名共 11 条匹配） | `#torrenttable img[class*="c_xxx"]` | 换图 + 本色 16% 淡底圆角色块 |
| 表头指标 | 8 | `#torrenttable img.{comments,time,size,seeders,leechers,snatched,user}` + `.torrentname img` | 评论/存活/大小/做种/下载/完成/发布者/RSS，各一色 |
| 导航 | 16 | `ul#mainmenu li a[href*="..."]::before` | 每项一色 |

**三条实现纪律**（改图标时别破坏）：
1. **`iconCss()` 必须放在 `theme.css(colMap)` 之前，且只写 `content` 不写死尺寸。**
   主题用更高特异性的选择器（含 `td:nth-child()`）自己定 `width/height`，
   `reel` 16px / `tape` 12px 等照旧生效。在图标层写死尺寸会压掉主题的排版。
2. **`tape` 主题 `navIcons: false`。** 电传纸带用 `::before`/`::after` 画 `[ ]` 方括号，
   那就是它的设计语言；挂导航图标会顶掉方括号。类别/指标图标照常（它们走 `img` 的 `content`，不冲突）。
3. **导航 `href` 用 `href*=` 子串匹配，且靠顺序覆盖**：先 `torrents.php`（种子）兜底，
   再用 `mystat=keep` / `mystat=dead` 覆盖成保种 / 断种 —— 后写的规则同特异性胜出。

**图标选型的方法论**（踩坑总结在 `pitfalls.md` P34–P41，改图标前必读）：
- 16px 下只有三类信号能幸存：**缺口 / 方向 / 配件**；叶脉、茎弯折、卷边这类细节一律消失。
- 成对概念（保种 vs 断种）**保留同一轮廓 + 只改强信号**，不要发明新形状。
  → 断种 = 保种同一片叶形 + 枯黄 `#b8933a` + 右下锯齿缺角。
- 「边缘缺角」必须**把缺口直接拼进路径**（de Casteljau 切两段边界再插入向内凹的新边界），
  不能用 `evenodd` 挖孔 —— 后者读作「主体上有个洞」（内部缺），不是「轮廓被咬一口」（边缘缺）。
  生成器：`.workbuddy-ai/hdui-mock/_gen-notch.js`。
- 同色图形叠画 = 完全看不见 → 镂空必须是同一 `<path>` 内的 `fill-rule="evenodd"` 子路径。
- 新图标**先做 96 / 48 / 24 / 16 四档对照 sheet 再定稿**，别在单一尺寸上反复微调。
- ⚠️ **`iconUri()` 生成的 SVG 必须带 `width`/`height`**（现为 16×16）。
  只写 `viewBox` 的话 SVG 没有固有尺寸，`img{content:url(...)}` 替换后 img 宽高算成 **0**，
  会把包它的 `<a>` 一起压成零宽 —— 站内 RSS 按钮就点不到了（P42）。

---

## 8. 改动须知

- 改任何代码/元数据 ⇒ **同步递增 `@version`**（`conventions.md` §0.3）。
- 改图标 ⇒ 同步更新本节 + `pitfalls.md` 的 P34–P41，并重新出四档对照图确认 16px 仍可辨。
- 改主题：改 `filmCss` 后若动了骨架（齿孔 / 帧号 / 吸顶 / 占比条 / 置顶），
  `check-hdui-static.js` §4 与 `sim-hdui-theme-switch.js` 会立刻变红 —— 那是故意的，说明骨架被改掉了。
- 真站可用性：导航 16 项 + 内嵌入口必须能放进 ~1262px 视口（原型给的间距偏宽，照抄会把第 16 项挤出屏）。
- 站点改版：先跑结构守卫用例定位是哪一级契约失效，再更新 `COLUMNS` / `ANCHORS` / `headerKey()`。
- 所有 catch 必须落到 `Diag`，禁止空 catch。
