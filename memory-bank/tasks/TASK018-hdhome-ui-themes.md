# TASK018 · HDHome 界面主题套件（5 套可切换 UI）

> 状态：**设计中 → 待实施**
> 提出日期：2026-09-19
> 素材：`resources-do-not-track/HDHome-Whole-Web/`（HDHome 整页另存，**已脱敏**，永不被 Git 追踪）
> 产物脚本：`src/HDHomeUI.user.js`

---

## 一、需求原文拆解

用户要求（逐条对应到下面的设计）：

| # | 要求 | 本方案的落点 |
|---|------|--------------|
| R1 | 5 套**不同类型**的 UI，不能只换颜色 | 5 套在**布局骨架 / 字体体系 / 信息层级**上互相区分，不只是配色（见 §4，每套给出「结构签名」） |
| R2 | 脚本不能只替换 UI 不改变逻辑，**要支持原 UI 全部功能** | 采用**纯样式层**架构：不重建、不移动、不克隆任何站内节点，站内事件处理器 100% 保留（见 §3） |
| R3 | 严格仿真测试 | 真浏览器（CDP）+ 结构化复刻剧本，功能保持/切换记忆/结构守卫/危险防护四类断言（见 §8） |
| R4 | 不能静默忽略错误 | 统一诊断账本 `Diag` + 全局 error/unhandledrejection 捕获 + 控制台与面板双出口（见 §6） |
| R5 | 防止页面改变后误触发危险操作 | 结构契约校验 + 危险 API 静态禁令（见 §5、§6） |
| R6 | 遇到结构错误时**提醒并返回默认 UI** | 契约校验失败 ⇒ 卸载全部样式 + 弹出可见横幅 + 记错误码，绝不带错上妆（见 §5） |
| R7 | UI 之间可切换、可记忆 | 浮动面板 + `GM_setValue` 持久化 + 开机恢复（见 §7） |

---

## 二、页面结构勘察结论（来自脱敏整页）

### 2.1 全局骨架

```
table.head                — logo + 广告位 + 捐赠
table.mainouter[width=982]
  td#nav_block
     table.main > div#nav > ul#mainmenu.menu    — 15 项主导航（首页/论坛/种子/LIVE/保种/断种/候选/求种/发布/字幕/控制面板/排行榜/日志/规则/常见问题/管理组）
     table#info_block                            — 用户信息栏（登录态证据）
  td#outer.outer
     p + table（新人考核提示块）
     form[name=searchbox] > table.searchbox      — 搜索箱（可折叠）
     p[align=center]                             — 上分页
     table#torrenttable.torrents                 — 种子表
     script（RSS 切换）
     p[align=center]                             — 下分页
div#footer                — 版权 + #lightbox + #curtain
```

### 2.2 `#info_block` 关键锚点（登录态 / 签到）

- `欢迎回来, a.User_Name[href*="userdetails.php"] > b` — 网名
- `a[href*="logout.php"]` — 登出
- `font.color_bonus` + `a[href*="mybonus.php"]` — **登录态证据**（魔力值）
- `a[href*="attendance.php"].faqlink` — **签到入口**（未签时存在，已签后消失）
- `font.color_ratio / color_uploaded / color_downloaded` — 分享率 / 上传 / 下载
- `img.arrowup / arrowdown` — 当前做种 / 下载数
- `td.bottom[align=right]` — 当前时间 + 收件箱 / 发件箱 / 社交名单 / RSS 图标

> 与 `pitfalls.md` P31 一致：`attendance.php` 入口消失 **且** 有登录态证据 = 已签。
> 本主题脚本**不参与签到判定**（那是 PTAutoCheckIn 的职责），但**绝不能动这个入口**。

### 2.3 `#torrenttable` 十二列契约（改版检测的抓手）

| # | 列 | 表头识别特征 |
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
| 10 | A 值 | `#calcTHeadA` |
| 11 | A/GB | `#calcTHeadAve` |
| 12 | 发布者 | 文本「发布者」 |

行内结构：`tr` → 12 个 `td`（首列 `td.rowfollow.nowrap` 内 `a[href*="torrents.php?cat="]` + 类别 sprite 图；
第 2 列内嵌 `table.torrentname` 含置顶图标、`a[href*="details.php?id="]` 标题、促销图标、`td.embedded.rss > a[data-toggle-rss]`）。

### 2.4 必须保住的交互（功能保持清单）

1. `ul#mainmenu` 15 个导航链接
2. `#info_block` 全部链接（userdetails / logout / 收藏 / myrss / mybonus / **attendance 签到** / invite / donate / peerlist / messages / friends / getrss）
3. `form[name=searchbox]`：类型复选框（cat*）、制作组复选框（team*）、标准复选框（standard*）、
   `select[name=search_mode|search_area|tag|spstate|incldead|inclbookmarked]`、`input#searchinput`（`suggest` 联想）、
   标签 `span.tags`（`onclick` 跳 `?tag=`）、`input[type=submit][value=给我搜]`
4. 搜索箱折叠：`a[href="javascript: klappe_news('searchboxmain')"]` + `#ksearchboxmain`
5. `table#torrenttable` 表头排序链接（`?sort=N&type=`）、`#calcTHeadA/#calcTHeadAve` 点击排序
6. 每行：详情链接、评论链接、`viewsnatches`、做种/下载 `dllist` 链接、`data-toggle-rss` **RSS 切换（会发请求）**
7. 促销图标的 `domTT_activate` 悬浮提示（促销剩余时间）
8. 上下分页链接（含 `Alt+PageUp/PageDown` 快捷键语义）
9. `#footer` 链接、`#lightbox`/`#curtain`（curtain_imageresizer 图片缩放）

---

## 三、架构决策：**纯样式层 + 运行时列映射**（不重建 DOM）

这是满足 R2 / R5 的关键决策，理由如下：

| 方案 | 功能保持 | 危险操作风险 | 结论 |
|------|----------|--------------|------|
| **A. 纯 CSS + 运行时生成的 nth-child 规则** | ✅ DOM/事件原封不动，站内处理器全部存活 | ✅ 脚本永不 click / submit / dispatch | **采用** |
| B. 解析表格后重建卡片 DOM | ❌ 需重新绑定 7 类交互，任一漏绑即功能缺失 | ❌ 重建节点可能挂错 href（RSS/登出/签到） | 否决 |

实现要点：

1. **列索引在运行时探测**：读表头文本/img 类名，产出 `colMap`（类型→1, 标题→2, ...），
   再**据此动态生成 CSS**（`td:nth-child(N)` 绑定 `grid-area` 或宽度），而不是写死 1..12。
   站点加列/改序 ⇒ 映射自动跟随；映射不全 ⇒ 判为结构错误，走 R6 回退。
2. **唯一允许的 DOM 写入**：`<html>` 上的 `data-hdui-theme` 状态属性、已校验行上的
   `--hdui-seed/--hdui-leech` 自定义属性（仅用于 T5 数据条），且卸载时全部清理。
   **绝不**：增删节点、移动节点、复制站内节点、挂事件、改 `href`、改文本。
3. **注入物全部自持**：浮动开关 + 面板放进 **closed shadow root**，事件 `stopPropagation`，
   不向站内元素冒泡，避免触发站内的 document 级监听。
4. 只申请 `@grant GM_getValue` / `GM_setValue` 两个权限，不碰 `GM_xmlhttpRequest` 等。

---

## 四、5 套 UI 设计

> 共同约束：都只作用于 HDHome（`@match *://*.hdhome.org/*`），都要覆盖
> 主导航 / 信息栏 / 搜索箱 / 种子表 / 分页 / 页脚六处，都保留 §2.4 全部交互。
> 「结构签名」一列是**彼此区分的硬证据**（测试会断言它们的 computed 值不同）。

### T1 · 片库索引（Reel Index）

- **灵感**：电影资料库的胶片盒标签、Criterion 收藏册的烫金脊背。
- **布局**：种子表 → **卡片网格**（`display:grid`，`auto-fill minmax(320px,1fr)`），每张卡 = 一只片盒。
  卡内：顶部 2px 类别色条 → 类别图标 + 标题（2 行截断）→ 元数据行（体积 · 存活 · 发布者）→ 右下大号做种数。
- **字体**：标题衬线（`"Songti SC","Noto Serif SC",Georgia,serif`）；数字 `tabular-nums` 等宽对齐。
- **配色**：底 `#16181c`；卡面 `#1e2126`；纸白字 `#ece7de`；强调**暗金** `#c8a35a`（烫金标签）；描边 `#2c3037`。
- **结构签名**：`#torrenttable{display:block}` + `tbody{display:grid}` + `tr{display:grid}`。
- **导航**：横向胶囊，`li.selected` 用暗金下划线（不用背景块）。

### T2 · 电传纸带（Teleprinter）

- **灵感**：电传打字机吐出的连续纸带 / 打孔卡报表 —— 横向信息密度拉到最大。
- **布局**：**保持表格语义**（`display:table`），但行高压到 22px、字号 12px/1.35、取消所有边框，
  改 **斑马纹**（`#f6f3ec`/`#efeae0`）分隔；列头做成反白深墨条。
- **字体**：**全站等宽**（`ui-monospace,Consolas,"Courier New",monospace`），含标题列。
- **配色**：纸黄底 `#f4efe3`；墨黑 `#1b1a17`；单红强调 `#a12a20`（打印机红墨，只用于做种数与当前页）。
- **数字**：全部右对齐 `tabular-nums`；做种数红色加粗。
- **结构签名**：`#torrenttable{display:table}` + `tr:nth-child(even){background:...}` + `td{border:0}`。
- **导航**：单行方括号 `[首页][论坛][种子]...`，等宽、无圆角、无背景。

### T3 · 大开本（Broadsheet）

- **灵感**：报纸影视版 / Criterion 目录册 —— **标题主导**的纵向长条。
- **布局**：表格 → **单列长条**（`tr{display:grid;grid-template-columns:1fr}`），
  标题独占上半区（16–17px），元数据压缩成下方一行小字「体积 140.99 GB · 存活 1天5时 · 做种 42 · 下载 6 · 发布者 xxx」；
  行间用**双细线**（上 2px 下 1px，报纸分栏线）。
- **字体**：衬线为主（宋体系），行距略松（1.6）；类别图标做成方形小图章。
- **配色**：纸白 `#fbfaf7`；近黑 `#14120f`；类别色条**暗朱红** `#8f2b21`；几乎无块面颜色。
- **结构签名**：`tr{display:grid;grid-template-columns:1fr}`（单列） + 行分隔 `border-top:2px`。
- **导航**：居中的衬线字，当前项用小型大写 + 上划线。

### T4 · 瑞士网格（Swiss Grid）

- **灵感**：国际主义排版（Müller-Brockmann）—— 靠**留白与字号层级**分隔，不用一根线。
- **布局**：**严格多列网格**，左对齐，标题列占 60% 宽；整表**零边框零斑马纹**，行距 3xl 留白。
- **数字即图形**：做种数 28px 无衬线粗体，成为每行视觉锚点；下载/完成数退为小号灰字（层级压制）。
- **字体**：无衬线 `Inter,"Helvetica Neue","PingFang SC","Microsoft YaHei"`；字重对比 400/700。
- **配色**：纯白 `#ffffff`；黑 `#111111`；**单一强调钴蓝 `#1a35d8`**（只给做种数与当前导航项）。
- **表头**：唯一一条 1px 黑线 + 字距拉开的 11px 大写标签。
- **结构签名**：`tr{display:grid;grid-template-columns:0.6fr 6rem 5rem ...}` + `td{border:0}` + 标题字号 28px。

### T5 · 播控台（Signal Console）

- **灵感**：电视台播出机房的监视墙 / 信号电平表 —— 带**数据条**的暗色控制台。
- **布局**：保持行结构（`tr{display:grid}`，行高 34px，1px 分隔线），
  每行右侧新增一条**水平电平条**（按 做种/下载 比例，用 `linear-gradient` + `--hdui-seed/--hdui-leech` 渲染）。
- **配色**：深石板 `#0f1620`；面板 `#16202c`；发光青 `#5fd4e4`；低做种告警橙 `#ff9f45`；字 `#dce6ef`。
- **字体**：无衬线 + 等宽数字；类别用**色点圆点**替代 sprite 方块。
- **结构签名**：`tr{display:grid}` + `td[data-hdui-col=seeders]::after{width:calc(var(--hdui-seed)*...)}` 电平条。
- **导航**：分段控件（segmented control），选中项青色发光底。

### 4.6 五套的区别矩阵（证明「不是只换颜色」）

| | 表格 display | 行结构 | 字体族 | 信息密度 | 分隔手段 | 独有结构 |
|---|---|---|---|---|---|---|
| T1 片库索引 | block | grid 卡片（2–4 列） | 衬线 | 低（留白大） | 卡片边框 | 类别色条 + 大号做种数 |
| T2 电传纸带 | **table** | 表格行（22px） | **等宽** | **极高** | 斑马纹 | 方括号导航 |
| T3 大开本 | block | grid **单列** | 衬线 | 低（纵向） | **双细线** | 标题主导 17px |
| T4 瑞士网格 | block | grid 多列（标题 60%） | 无衬线 | 中 | **留白（无线条）** | 28px 数字锚点 |
| T5 播控台 | block | grid（34px） | 无衬线+等宽数字 | 中 | 1px 线 | **电平条 + 类别色点** |

---

## 五、结构契约与「带错不上妆」（R5 / R6）

`validateContract()` 在**每次应用主题前**执行，返回 `{ok, code, missing, colMap}`：

- **A 级（必需）**：`table.mainouter`、`#nav_block`、`#info_block`、`ul#mainmenu` —— 缺任一 ⇒ 直接回退。
- **B 级（种子表）**：`#torrenttable` 存在时，必须解析出**全部 12 列**的 `colMap`；
  缺列 / 表头文案改版无法识别 ⇒ **整页回退**（不是只跳过表格，避免「半套皮肤」的错乱）。
- **C 级（运行时）**：`MutationObserver` 观察 `#torrenttable` 子树的 `childList`（debounce 500ms），
  页面局部刷新后重新校验；失效 ⇒ 回退 + 横幅。

回退动作 `fallbackToDefault(reason)`：
1. 移除所有 `hdui-*` 样式节点与 `<html>` 状态属性、清理 `--hdui-*` 自定义属性；
2. 写入 `GM_setValue('hdui.lastError', {...})`；
3. `console.error('[HDHomeUI] ...')` + 页面顶部**可见横幅**（含错误码 + 「恢复默认 UI」「知道了」两个按钮）；
4. 主题选择**回落到 `default`**，避免下次打开继续撞墙。

---

## 六、不静默忽略错误 & 危险操作防护（R4 / R5）

### 6.1 诊断账本

- `Diag.push(level, code, detail)` —— 唯一出口：`console` 分级输出 + 面板「诊断」区 + 横幅（fatal 时）。
- **全局兜底**：`window.addEventListener('error')` 与 `unhandledrejection` 只**记录不吞掉**
  （不 `preventDefault`、不改返回值），记录为 `uncaught`。
- **禁止空 catch**：静态校验器扫描 `catch {}` / `catch (e) {}`；每个 catch 必须落到 `Diag`。

### 6.2 危险操作禁令（静态校验器逐条钉死）

1. 源码中**不得出现** `.click()`、`dispatchEvent(`、`.submit()`、`eval(`、`new Function(`、`.innerHTML =`（面板文案一律 `textContent`）。
2. **不得**把站内节点 `cloneNode` 进自持 UI。
3. **不得**改写任何站内元素的 `href` / `onclick` / 文本。
4. 自持 UI 的事件处理器一律 `stopPropagation()`（+ 必要时 `preventDefault()`），不冒泡到站内监听。
5. 主题切换**不得**产生任何站内请求（测试断言请求日志为空）。
6. 只 `@grant GM_getValue`/`GM_setValue`，不申请网络类权限。

### 6.3 防误触发的具体风险点（本页特有）

| 风险 | 触发条件 | 防护 |
|------|----------|------|
| 误点签到 `attendance.php` | 重建 DOM 时把签到 href 挂到卡片热区 | 不重建 DOM（§3） |
| 误触 RSS 增删 `myrss.php` | 把 `data-toggle-rss` 复制到面板/卡片 | 不克隆节点；面板只显示文本 |
| 误点登出 `logout.php` | 新增「用户信息卡」时拼错 href | 面板不渲染任何站内链接 |
| 列错位导致「下载」被当成「做种」 | 站点加/删列后 nth-child 写死 | 运行时 colMap + 校验失败即回退 |
| 主题叠加导致布局错乱误点 | 切主题时旧样式未清 | 切换前先 `unload()` 再 `apply()` |

---

## 七、切换与记忆（R7）

- 右下角浮动开关（自持、closed shadow），点开面板：5 个主题 + 「原站默认」共 6 项，
  当前项高亮；面板含**诊断区**（最近 N 条事件、上次错误码、契约校验结果）。
- 选择即写入 `GM_setValue('hdui.theme', id)`；下次进站自动恢复。
- `GM_setValue('hdui.lastError', {code, at, detail})` 用于横幅「查看详情」。
- 快捷键：`Alt+Shift+T` 循环切换（在 `input/textarea/select` 聚焦时**直接返回**，见 `conventions.md` §4）。

---

## 八、测试计划

### 8.1 静态校验（`tests/hdhomeui/check-hdui-*.js`，零依赖，无浏览器也跑）

1. 元数据完整：`@name`/`@name:zh-CN`/`@namespace`/`@version`/`@description`/`@author`/`@license`/`@match`/`@grant`。
2. 危险 API 禁令（§6.2 第 1 条）逐项扫描。
3. 无空 catch、无 `window.__*` 钩子（`conventions.md` §8.2）。
4. 5 个主题全部定义、id 唯一、每套都声明了完整 token（颜色/字体/布局变量）。
5. **结构签名互不相同**：断言 5 套对 `#torrenttable` 的 `display` 与行布局声明**至少 3 种取值**，
   且颜色 token 与结构 token 不是唯一差异。
6. 契约定义完整：12 列字典齐全 + A/B 级锚点齐全。

### 8.2 仿真测试（`tests/hdhomeui/sim-*.js`，真浏览器 + CDP）

剧本：`tests/lib/sim/hdhome-ui-page.js` —— **结构化复刻、零私有数据**（标题/发布者全用虚构名）。
变体：`hdhome-ui`（正常）/ `hdhome-ui-broken-cols`（缺列）/ `hdhome-ui-no-table`（无种子表）/ `hdhome-ui-empty`（空表体）。

| 用例 | 断言要点 |
|------|----------|
| `sim-hdui-function-parity` | 5 套主题逐个应用后：导航 15 链接 href 不变、种子行数与每行 `details.php` href 不变、排序/分页/签到/登出链接不变；**RSS 按钮点击仍产生恰好 1 次 `myrss.php?ajax=1&torrentid=`**；搜索表单提交仍导航到 `torrents.php?search=`；搜索箱折叠 `klappe_news` 仍生效 |
| `sim-hdui-theme-switch` | 依次切 5 套，断言 `<html>` 状态属性跟随；断言 `#torrenttable` 的 **computed display / 行 grid 列数**在不同主题间确实不同（证明非仅换色）；切回默认后无任何 `hdui-*` 残留 |
| `sim-hdui-remember` | 选 T3 → 重新打开页面 → 主题仍为 T3 |
| `sim-hdui-structure-guard` | 打开缺列剧本 ⇒ 不应用主题 + 横幅可见 + `console.error` 有记录 + **请求日志为空**（未误触任何站内动作）；随后打开正常页仍能正常上妆 |
| `sim-hdui-no-silent-error` | 空表体剧本 ⇒ 必须有 `[HDHomeUI]` 级别日志与可见提示，不得静默 |
| `sim-hdui-danger-guard` | 点面板按钮 ⇒ 站内 document 级 click 计数**不变**（不冒泡）；切换主题全程零站内请求 |

---

## 九、交付物清单

1. `memory-bank/tasks/TASK018-hdhome-ui-themes.md`（本文件）
2. `src/HDHomeUI.user.js`（`@version 2026.09.19.1`）
3. `tests/lib/sim/hdhome-ui-page.js`（仿真剧本）+ `tests/lib/sim/harness.js` 支持多脚本
4. `tests/hdhomeui/check-hdui-*.js`（静态）+ `tests/hdhomeui/sim-hdui-*.js`（仿真）
5. `memory-bank/scripts/HDHomeUI.md` + `README.md`/`activeContext.md`/`progress.md`/`tasks/_index.md` 同步

---

## 十、进度日志

- **2026-09-19（设计）**：完成整页勘察（§2）、架构决策（§3）、5 套设计（§4）、安全与测试设计（§5–§8）。
- **2026-09-19（实施）**：`src/HDHomeUI.user.js` `2026.09.19.1` 落地，含 5 套主题 + 契约校验 +
  危险防护 + 诊断账本 + 面板与记忆；`tests/lib/sim/hdhome-ui-page.js`（6 个变体）、
  `tests/lib/hdui-help.js`、`harness.withSim(fn, {scriptPath})`；
  `tests/hdhomeui/` 1 静态 + 4 仿真（`check-hdui-static` / `sim-hdui-function-parity` /
  `sim-hdui-theme-switch` / `sim-hdui-structure-guard` / `sim-hdui-danger-guard`）。
  实施中被测试挖出**一处真实缺陷并修复**：`validateContract()` 原先只在 `d.map` 缺失时判失败，
  漏掉「12 列都识别出来、但数据行单元格数与表头不符」这一改版信号 —— 已补 `if (d.reason)` 分支
  （对应新增剧本变体 `hdhome-ui-shape` 与 `ROW_CELL_COUNT_MISMATCH` 断言）。
  另修正两处**测试自身**的问题：搜索箱默认折叠时提交按钮本就 0 尺寸（移出 hit-test，
  改由「表单提交仍带关键词」断言覆盖）；危险端点断言按增量判定（上一轮用户主动点的
  `/myrss.php` 不应被下一轮计入）。
- **2026-09-19（核验 + 提交）**：用 `resources-do-not-track/` 下**已脱敏的真实整页**离线跑了一遍
  `headerKey()` + 契约判定：表头 12 列全部识别、数据行 12 格、4 个 A 级锚点齐全 ⇒
  **仿真剧本与真实标记一致**（核验脚本 `.workbuddy-ai/_verify-hdui-real-page.js`，只输出结构键，不入库）。
  两个待定项按依据定了：**默认主题保持 `reel`**；**`@match` 不加裸域那一条**——仓库内
  `PTAutoCheckIn` 用同一个 `*://*.hdhome.org/*` 且在真站逐页实测过，证明该 pattern 在 Tampermonkey
  下匹配裸域。
  **已提交 `13266e0`**（分支 `dev`，17 文件），**未 push**。
- **2026-09-19（安全复验）**：`.1 → .2` 修 4 项（`unload()` 补 `stopWatch()`、铺底色挪到真正
  document-start、首次安装默认 `default`、修文档漂移），静态校验新增第 6 组断言钉死启动时机与默认行为。
  **已提交 `1b38510`（分支 `dev`，已推 gitee）**。
- **2026-09-19（全面重构 → `.3`，改完待审核未提交）**：用户报两件事:
  ① 右下角浮动圆钮与 PTAutoCheckIn v2 等脚本的 FAB 抢同一个位置;
  ② 5 套主题风格与原 UI 太接近 —— 12 个格子挤在同一行里飘、新 UI 的按钮都堆到一起,
  与设计初衷背道而驰。
  改完三件事:
  ① **入口内嵌**：FAB 删, 改为量 `ul#mainmenu` 最后一个 li 的右边空档, 把入口摆成导航栏末尾的小文字钮
  `界面 · <主题名> ▾`; 面板改为锚在它下方的下拉浮层; `position:absolute` 文档坐标内嵌(随页面滚动),
  `dockRect()` 量不到菜单才退到 `table.mainouter` 右上, 都没有再退 `position:fixed` 兜底.
  **重摆只在改 left/top/position, 不整体重写 cssText —— 整体重写会清掉宿主上的 `--ui-*` 配色变量**.
  ② **版式全面重画**: 每套独立的版式骨架, 不再「12 格子挤一行」:
  · 片库索引 grid 卡片网格 + 6 轨 grid 行分三区 + 每指标「标签+值」独立块;
  · 电传纸带是**唯一保留 `display:table` 语义**的一套(密排/等宽/反白表头/数字右对齐/细点竖线分栏);
  · 大开本 flex 三行(标题/署名/规格), 零高伪元素 `::before/::after` 做版面换行点;
  · 瑞士网格 grid 6 列×3 行, 零线条全靠留白, 做种数 28px 钴蓝锚点;
  · 播控台 grid 4 轨道, 类别色点 + 做种电平条.
  导航 `ul#mainmenu` 全部改成 `display:flex;flex-wrap:wrap` + `--hdui-navgap` 显式列间距.
  ③ **新测试 + 静态断言**: `tests/hdhomeui/sim-hdui-inline-dock.js`(内嵌入口 + 不压站内内容 +
  换主题重摆 + 右下角不被占用); 静态校验新增 §7「入口内嵌」+ §8「版式不再堆成一坨」;
  5 套版式签名仍然两两不同(同行同 bgs 但 colMap/字号/行分隔互异);
  仿真测试总数 21 → 22.
  视觉复核 `.workbuddy-ai/_shot-hdui.js`(不入库)截 5 套顶部+中部+面板图, **所有版式肉眼可辨**,
  与原 NexusPHP 蓝色表格明显不同. 22 个测试**全绿**. 入口在导航栏末尾像一枚自带标签的栏目项 ——
  不抢眼、不悬浮、不与 FAB 撞位.
