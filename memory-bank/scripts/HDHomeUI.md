# HDHomeUI（`src/HDHomeUI.user.js`）

> HDHome 界面主题套件：5 套**可切换、可记忆**的 UI。纯样式层改造，**不重建 DOM、不接管交互**，
> 原站功能全部保留；页面结构一旦与预期不符，**提示并回退站点默认界面**。
> 设计依据与实施计划见 `tasks/TASK018-hdhome-ui-themes.md`。

- 当前版本：`2026.09.19.4`（`.4` 已提交 `4e01743`、`.3` 已提交 `bc2c0cd`、`.2` 已提交 `1b38510`，
  分支 `dev`，均已推 gitee）
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
- **2026.09.19.3 重构要点**：
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
- **视觉复核**（不入库）：`.workbuddy-ai/_shot-hdui.js` 在仿真服务器里对 5 套主题各截三张
  （顶部内嵌入口 / 中部版式 / 面板展开），`hdui-shots/{id,id-top,id-panel}.png`，仅结构化复刻页内容。
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

---

## 4. 交互

- 右下角浮动开关（UI）→ 面板列出 6 项（原站默认 + 5 套），当前项 `aria-pressed=true`，
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
| `tests/hdhomeui/sim-hdui-function-parity.js` | 5 套主题上妆后功能基线快照逐字段不变、关键元素 hit-test 可点、RSS 点击恰好 1 次请求、搜索箱折叠与表单提交仍工作、局部重排不误判 |
| `tests/hdhomeui/sim-hdui-theme-switch.js` | 版式签名两两不同、各套骨架特征、切回默认卸干净、记忆、面板点击、快捷键 |
| `tests/hdhomeui/sim-hdui-structure-guard.js` | 缺列 / 行列数不符 / 缺锚点 ⇒ 回退 + 横幅 + 记录 + 零危险访问；空表体与无表页不算错；运行中改坏自动回退 |
| `tests/hdhomeui/sim-hdui-danger-guard.js` | 自持 UI 点击不冒泡到站内监听、切换零站内请求、站内监听与 RSS 仍存活、危险入口未被挂 onclick |

仿真剧本：`tests/lib/sim/hdhome-ui-page.js`（**结构化复刻、零私有数据**，
变体 `hdhome-ui` / `-broken` / `-shape` / `-empty` / `-notable` / `-nonav`）；
共享工具 `tests/lib/hdui-help.js`；`harness.withSim(fn, { scriptPath })` 支持测任意脚本。

---

## 7. 改动须知

- 改任何代码/元数据 ⇒ **同步递增 `@version`**（`conventions.md` §0.3）。
- 新增主题：在 `THEMES` 加一项（必须同时给出 `vars` 与 `css(colMap)`），
  并确保**布局骨架**与已有 5 套不同（否则 `sim-hdhomeui-theme-switch` 会报「只是换颜色」）。
- 站点改版：先跑结构守卫用例定位是哪一级契约失效，再更新 `COLUMNS` / `ANCHORS` / `headerKey()`。
- 所有 catch 必须落到 `Diag`，禁止空 catch。
