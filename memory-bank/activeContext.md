# 活跃上下文（Active Context）

> 记忆库核心文件：**当前工作焦点**、最近改动、下一步、活跃决策与考量。此文件是所有核心文件中更新最频繁的。

## 当前工作焦点

**HDHomeUI（`src/HDHomeUI.user.js`，`2026.09.19.10`，2026-09-19 新建，TASK018）——HDHome 界面主题：胶片墙。**
**2026-09-19 `.10`（已改码，**待用户审核后提交**）——两个"宽屏测不出、窄屏才暴露"的布局陷阱：**
主动去测了之前没验证的两个真实场景（长列表滚动 + 窄屏），一次抓出两个问题，**同源根因**：
站点外层是**固定宽 + `table-layout:auto`**，会被内容的 `max-content` 撑开。
① **上妆把整页撑宽 1260 → 1503**。`min-width:0` 只管收缩（min-content），**管不住 max-content**——
   长标题把容器顶宽，窄屏用户得多横向滚 240px。修：标题列
   `max-width:max(240px,calc(100vw - 900px))`，实测回落到 1260，与原站持平。
② **窄屏导航点不到**。脚本把导航改 flex 防挤，但导航条拿到 1248px，`flex-wrap` 不触发 →
   单行排到 1218，视口 1024 时最后 2–3 项 `elementFromPoint` 返回 null。
   **原站 inline 布局会自然换行，换 flex 后必须显式给 `max-width:100vw` 才会 wrap。** 修后 0/16 被挡。
新测试 `sim-hdui-layout-width.js`（第 26 个）+ `tests/README.md` 清单同步。全量 26/26。见 P46。
**教训：改了布局就得到窄屏重测一遍 —— 宽屏通过不代表窄屏通过；`min-width` 治不了 `max-content`。**
**2026-09-19 `.9`（已改码，**待用户审核后提交**）——① 首装直接上妆；② 导航配色去撞色**：
前两轮问用户"撞色选哪个方案 / 首装要不要上妆"未获回答，按最合理判断自行决定：
① `FIRST_ID = 'film'` —— 装了脚本却看不到效果不合"全面改为新 UI"的意图。
   ⚠️ 只在**存储无值**时生效，用户选过（含选「原站默认」）一律以存储为准，不会被强推回胶片墙。
   四处读取必须全部用 `FIRST_ID`，漏一处就会出现"首装读成 default"的矛盾（静态加了断言）。
② 撞色选**方案 B**（改动最小、真撞 4→0，且保留金色作强调色）：
   `home→#eda23c`(饱和 90→83)、`upload→#e0762c`(H39→25 推成橙)、
   `shield→#a99e8b`(降饱和变暖灰)、`logdoc→#94a3b8`(中性石板灰，青绿让给种子独占)。
   判据是**三维**（Δh≤8 且 Δs≤20 且 Δl≤15），只看色相会虚高（7 vs 真实 4）—— 见 P45。
   若不满意，回退就是改 `ICON_NAV` 这 4 行。全量 25/25 全绿。
**2026-09-19 `.8`（已改码，**待用户审核后提交**）——旧主题 id 自动迁移，删主题的收尾**：
用户实测 `[HDHomeUI] 页面结构与预期不符(E_UNKNOWN_THEME) ... 未知主题 tape` —— 他以前选的就是 `tape`，
`.7` 把主题删了但 GM 存储里的旧值还在。两个错：① **不该报错**，用户没做错事，是我们删的，
老用户本就"选过主题、想用主题"，应静默迁到胶片墙并写回存储；② **错误码张冠李戴**，
`E_UNKNOWN_THEME` 被当结构类处理（「页面结构与预期不符」横幅 + 等结构就绪窗口），
可这是**配置值失效**，等也不会变好 —— 与 P43 同类的归因误导。
修：`LEGACY_THEMES` 静默迁移 + 写回存储；`CONFIG_CODES=['E_BAD_THEME']` 与 `STRUCT_CODES` 分开；
`showAlert` 按错误码分流措辞，配置类按钮给「改用胶片墙」而非没用的「重新尝试」。
新测试 `sim-hdui-legacy-theme.js`（第 25 个）+ 静态 §11。全量 **25/25** 全绿。见 `pitfalls.md` **P44**。
⚠️ **今后删任何主题都要把 id 登记进 `LEGACY_THEMES`** —— 静态会提醒，但登记是人的责任。
**2026-09-19 `.7`（已改码，**待用户审核后提交**）——移除旧 5 套，改为单一主题「胶片墙」`film`**：
用户判定那 5 套"已经没用了"。⚠️ 关键教训：**这套新 UI 的原型 `.workbuddy-ai/hdui-mock/film.html`
早就做好了**（图标体系就是在它上面定稿的），但 `.5` 只移植了**图标层**、没落地主题本身 ——
生产脚本里 `film` 只出现在一行「图标来源」注释里。**做原型时就要想清楚最终交付的是什么，
原型里的主题本身就是 deliverable，不是"顺带用来定稿图标的画板"。**
骨架（每条都钉进测试）：片基 = tbody 纵向 flex + 左右齿孔轨道；帧号 counter 打在片边；
片头 sticky 吸顶 + `a::after` 补中文栏名；帧 = 横向 flex 行；做种 20px 金 + 内嵌占比条；
数值靠字号分层不靠色相；置顶 inset 金条。配色 = 5 层语义灰 + 唯一强调金 `#f5b342` + 7 类别色。
配套删掉 `statStack`/`statInline`/`headStrip`（胶片墙不用「标签+值」成块，栏名在表头），
由 `tdSel`/`tdRule` 取代。**踩坑**：原型导航 `navitem:7px 11px` 真站放不下（视口 1262px 时
第 16 项被挤出屏），收到 `6px 9px` 才过。**测试改造**：「版式签名两两不同」在只剩一套时无意义，
改为逐条钉死胶片墙骨架；另有 4 处硬编码旧主题值的断言同步改。全量 24/24 全绿。
**2026-09-19 `.6`（已改码，**待用户审核后提交**）——修正 `UNHANDLED_REJECTION` 的归因误导**：
用户贴来 `[HDHomeUI] WARN UNHANDLED_REJECTION TypeError: ... reading 'innerText'`，但本脚本
**既无 `innerText` 也无任何异步代码**（`async`/`await`/`new Promise`/`.then` 命中数 0）
⇒ 它不可能自己抛出 Promise 拒绝，只能是**观察方**；而 `unhandledrejection` 是**页面级**事件，
别的脚本的异常同样会进来，日志前缀却写着 `[HDHomeUI]` ⇒ 把外部故障伪装成本脚本故障，
害用户去 HDHomeUI 里找一个不存在的 `innerText`（真身在 `PTAutoCheckIn.user.js` 的 `visibleText()`）。
修：日志带 **stack 首帧** + 显式「来自页面或其它脚本（本脚本无异步代码），非 HDHomeUI 故障」；
并把「零异步」钉成静态不变量（将来引入异步即变红，提醒同步改措辞，否则免责声明成了谎言）。
三断言均做过反向验证。见 `pitfalls.md` **P43**。全量 24 个测试通过。
**2026-09-19 `.5`（已改码，**待用户审核后提交**）——新增 SVG 图标体系**（原型在 `.workbuddy-ai/hdui-mock/film.html`，
已在 96/48/24/16px 四档对照下经多轮用户选型定稿）：
① 新增 `ICONS` 实心路径表（31 个）+ `iconUri(name,color)` data URI 生成器 + `rgba()` 辅助；
② **类别图标**（7 类，`img[class*="c_xxx"]` → `content:` 换图 + 本色 16% 淡底圆角色块），
**表头指标图标**（8 个：评论/存活/大小/做种/下载/完成/发布者/RSS，按语义各自一色），
**导航图标**（16 项 `ul#mainmenu a[href*=...]::before`，每项一色）；
③ `iconCss()` 放在**主题 CSS 之前**且只写 `content` 不写死尺寸 —— 让主题用更高特异性的选择器自己定宽高
（`reel` 16px / `tape` 12px 等照旧生效）；
④ `tape` 主题加 `navIcons: false` —— 它用 `::before`/`::after` 画 `[ ]` 方括号，那正是这套的设计语言，
挂导航图标会顶掉；类别/指标图标照常；
⑤ 导航 `href` 匹配用 `href*=` 子串并按**顺序覆盖**：先 `torrents.php`（种子）兜底，再用
`mystat=keep`/`mystat=dead` 覆盖成保种/断种。
**选型要点（详见 pitfalls P34–P41）**：16px 下只有「缺口/方向/配件」三类信号能幸存；
成对概念（保种/断种）**保留同一轮廓 + 只改强信号**（完整绿叶 vs 残缺枯叶 `#b8933a` 右下锯齿缺）；
「断种」的缺口**直接拼进路径**（de Casteljau 切边界），不是 `evenodd` 内部挖孔 —— 后者读作"洞"不是"缺"。
**2026-09-19 `.4`（已提交 `4e01743`，分支 `dev`，已推 gitee，10s）**：真站首装报
`E_COLUMN_UNKNOWN: a,ave`，点「重新尝试」就好了 —— 那两列是**别的脚本运行时注入**的
（`#calcTHeadA` / `#calcTHeadAve`），比本脚本晚。纯时序问题（P33）：
① `a`/`ave` 改**可选列**，缺了返回成功码 `OK_NO_CALC` 照常上妆，排版函数缺席时 `return ''`；
② 列集合变了用 `colMapSig` 比对并**重摆**（补进来的格子要吃到主题样式）；
③ `ROW_CELL_COUNT_MISMATCH`（补列补到一半）进**等待窗口**（首装 8s / 运行中 4s，每 700ms 试一次），
期间 `data-hdui-state="pending"`、已上妆的不卸妆；`E_COLUMN_UNKNOWN`/`E_ANCHOR_MISSING` **不等**
（那两个码只可能是真坏了）；④ 新测试 `sim-hdui-optional-columns.js` + 静态 §9。
**2026-09-19 全面重构（`.2` → `.3`，已提交 `bc2c0cd`）**：用户报两件事 ——
① 右下角浮动圆钮与 PTAutoCheckIn v2 等脚本的 FAB 抢同一个位置；② 5 套主题风格与原 UI 太接近，
12 个格子挤同一行 + 新 UI 按钮都堆到一起，与设计初衷背道而驰。
三件事：① **入口内嵌** —— 量 `ul#mainmenu` 最后一个 li 的右边空档，摆成导航栏末尾小文字钮
`界面 · <主题名> ▾`；面板改为锚在它下方的下拉浮层；`position:absolute` 文档坐标内嵌
（随页面滚动），量不到菜单才退到 `table.mainouter` 右上，再退 `position:fixed` 兜底；
**重摆只在改 left/top/position，不整体重写 cssText**（整体重写会清掉宿主上的 `--ui-*` 配色变量）。
**已提交 `bc2c0cd`**（分支 `dev`，**未 push**）。
② **版式全面重画**，每套独立骨架：片库索引 grid 卡片网格+6 轨 grid 行分三区+每指标「标签+值」独立块；
电传纸带是唯一保留 `display:table` 语义的一套（密排/等宽/反白表头/数字右对齐/细点竖线分栏）；
大开本 flex 三行（标题/署名/规格），零高伪元素 `::before/::after` 做版面换行点；
瑞士网格 grid 6×3 全留白，做种数 28px 钴蓝锚点；
播控台 grid 4 轨道 + 类别色点 + 做种电平条；
导航 `ul#mainmenu` 全部改成 `display:flex;flex-wrap:wrap` + `--hdui-navgap` 显式列间距。
③ **新测试 + 静态断言**：`sim-hdui-inline-dock.js`（内嵌入口 + 不压站内内容 + 换主题重摆
+ 右下角不被占用）+ 静态校验新增 §7「入口内嵌」+ §8「版式不再堆成一坨」；
5 套版式签名仍然两两不同；仿真测试 21 → 22。
视觉复核 `.workbuddy-ai/_shot-hdui.js`（不入库）截 5 套顶部+中部+面板图，**所有版式肉眼可辨**，
与原 NexusPHP 蓝色表格明显不同。**`.3` 已提交 `bc2c0cd`**（分支 `dev`，已推 gitee）。
**2026-09-19 安全复验后 4 项改进（`.1` → `.2`，已提交 `1b38510`）**：① `unload()` 补 `stopWatch()`，
回退后 MutationObserver 不再空转；② 铺底色挪到**真正的 document-start**（不再等 `DOMContentLoaded`）：`<head>` 未建时退到 `<html>`；
若连 `<html>` 都还没创建则 `paintBootBgWhenPossible()` 退化为「`<html>` 一出现就铺」；失败独立记 `E_BOOT_PAINT`。
实测注入时 `readyState` 仍为 `loading`（早于 `DOMContentLoaded`），旧实现是在 `DOMContentLoaded` 才铺；③ **首次安装默认 `default`（原站默认）**，
不再开机即上妆，老用户已存主题不受影响；④ 修文档漂移（「唯一允许的 DOM 写入」改为「对站内 DOM 的唯一改动」
并列出脚本自建节点、删掉代码里不存在的「告警橙 #ff9f45」）。静态校验新增第 6 组断言钉住启动时机与默认行为。
**2026-09-19 安全复验后 4 项改进（`.1` → `.2`，改完待审核未提交）**：① `unload()` 补 `stopWatch()`，
回退后 MutationObserver 不再空转；② 铺底色挪到**真正的 document-start**（不再等 `DOMContentLoaded`）：`<head>` 未建时退到 `<html>`；
若连 `<html>` 都还没创建则 `paintBootBgWhenPossible()` 退化为「`<html>` 一出现就铺」；失败独立记 `E_BOOT_PAINT`。
实测注入时 `readyState` 仍为 `loading`（早于 `DOMContentLoaded`），旧实现是在 `DOMContentLoaded` 才铺；③ **首次安装默认 `default`（原站默认）**，
不再开机即上妆，老用户已存主题不受影响；④ 修文档漂移（「唯一允许的 DOM 写入」改为「对站内 DOM 的唯一改动」
并列出脚本自建节点、删掉代码里不存在的「告警橙 #ff9f45」）。静态校验新增第 6 组断言钉住启动时机与默认行为。
用户给的素材是 `resources-do-not-track/HDHome-Whole-Web/` 下**已脱敏**的 HDHome 整页（首页/种子页，
已登录未签到）。需求是「5 套**不同类型**的 UI（不能只换颜色）+ 保住原站全部功能 + 严格仿真测试 +
不许静默忽略错误 + 页面改版不许误触发危险操作 + 结构错误要提醒并回退默认 UI + 可切换可记忆」。
**架构定案：纯样式层 + 运行时列映射**——不重建/移动/克隆任何站内节点、不挂事件、不改 `href`，
列索引靠读表头动态生成 `nth-child` 规则；唯一 DOM 写入是 `<html>` 状态属性与行上的
`--hdui-cat` / `--hdui-ratio` 自定义属性。自持 UI（浮动开关 + 面板）放 **closed shadow root**，
事件 `stopPropagation`，不冒泡到站内监听。只申请 `GM_getValue` / `GM_setValue`。
5 套：`reel` 片库索引（卡片网格/衬线/暗金）、`tape` 电传纸带（保持 `display:table` 密排/全等宽/纸黄/单红）、
`sheet` 大开本（单列长条/17px 衬线标题/双细线）、`swiss` 瑞士网格（留白分隔/28px 数字锚点/钴蓝）、
`signal` 播控台（行 grid 4 轨道 + 电平条 + 类别色点/深石板+青）。
契约校验：A 级锚点（`table.mainouter`/`#nav_block`/`#info_block`/`ul#mainmenu`）+ B 级 12 列全识别
+ 行列数一致；失败即卸妆 + `console.error` + 顶部红色横幅（错误码 + 重新尝试/知道了）+ 写 `hdui.lastError`。
运行时 `MutationObserver` 观察 `#outer` childList（debounce 500ms），局部刷新后重新校验。
测试：`tests/hdhomeui/` 1 个静态 + 4 个真浏览器仿真（功能保持/切换记忆/结构守卫/危险防护），
配套仿真剧本 `tests/lib/sim/hdhome-ui-page.js`（**结构化复刻、零私有数据**，6 个变体）与
`tests/lib/hdui-help.js`；`harness.withSim(fn, { scriptPath })` 由此支持测任意脚本。
实施中由测试挖出**一处真实缺陷**：`validateContract` 只判 `map` 缺失，漏了「列齐全但行列数不符」——已修。
**`.1` 已提交 `13266e0`、`.2` 已提交 `1b38510`**（分支 `dev`，**gitee 与 GitHub 均已推**：GitHub 上是新建的同名分支 `dev`，公开 `master` 未动）。
另用**真实页面**（已脱敏整页）离线核验过契约判定：
12 列全部识别、数据行 12 格、4 个 A 级锚点齐全 ⇒ 仿真复刻与现实一致（脚本在 `.workbuddy-ai/`，不入库）。

**PTAutoCheckIn（`src/PTAutoCheckIn.user.js`，当前 `2026.09.19.4`）——2026-09-19 主面板交互调整（失焦自动关闭 + 签到按钮重现不弹主面板，用户当日需求，**已提交 `80e0f37`（分支 `dev`，尚未 push）**）；2026-09-19 新增 HDHome 站（已签后入口变纯文本 → 整页文本 + 「入口消失且已登录」自定义判定双通道），**已提交 `d63fe0c`（分支 `dev`，尚未 push）**；此前的慢站误判修复已实施，待实测校准**；同日又完成 TASK017（本地仿真站 + 安全审计），修了首装崩溃等 5 处（见 P29/P30）。v2 引擎与站点建模此前已完成（批量+FAB+贴吧多吧合并为单一生产脚本）。**2026-09-18** 针对用户报告「经常失败 / 网页加载慢一点就可能失败 / 结果反馈慢」，完成 TASK015 的实施：整流程超时定时器不再覆写已给出的结论、状态写入加单向阶梯、新增 `unconfirmed` 独立状态、点击后观察改事件驱动 + 有界复检、建立超时预算不变式与双校验（运行时自检 + 静态校验器）、进度心跳 + 死站提前跳过（见 P28）。同日把测试工具收进 **`tests/`** 并定下零依赖测试约定（TASK016，见 `tests/README.md`）。**三批改动已提交**（`ebb06bb`、`2b31377`、`e2d5f52`，分支 `dev`，未 push），待真实站点实测校准。

## 最近改动时间线（2026.09.07–09.18）

- **v2 重构**：被动 + 批量调度 + FAB 面板 + 贴吧多吧；unit 级独立冷却/状态；`match` 字段删除、页面归属由 `url` 推导。
- **.16 跨天守卫**：DOM 是加载时刻快照，跨天旧 DOM 会把昨日已签误写为今日 success → 引擎记 `PAGE_BORN_DATE`，执行前查跨天刷新（见 P23）。
- **.17 仅检测型 `detectOnly`**：U2 需人工验证码，只检测状态不自动点击（见 P24）。
- **.18/.19/.20 签到按钮重现降级提醒**：状态从单向成功快照改可逆，按钮重现 → 状态降级 `suspect`（失败-待确认）+ 页面级警示（toast/按钮描边/常驻横条）（见 P25）。
- **.21–.25 无按钮站批量接入**：MTeam / DigitalCore / HD-Space / Kufirc / 凤凰PT / Sportz Bar（访问即签）+ NodeLoc（Discourse no-text 图标按钮）（见 P21/P22/P26）。
- **.26 载体无关信号通用化**：`stateSignals`/`readEntryState` 重构，文本站自动翻译零回归，NodeLoc 纳入重现通道（见 P25/P27）。
- **.27 贴吧加四吧**：饥荒 / 战舰世界 / 深海迷航 / 缺氧（kw 为中文）。
- **.28 行内单站强制重试**：面板今日失败站 badge 悬停变「↻ 重试」，前台新标签无视冷却强制签到，完成不关标签。
- **2026-09-18 .1 慢站误判修复（TASK015 / P28）**：`unconfirmed` 独立状态；状态单向阶梯 `STATUS_TRANSITIONS`；超时预算不变式 + 双校验；点击后事件驱动观察窗（4s）+ 有界复检（5s/12s，只检测不重点）；`waitForElement` 可交互判定 + 慢页面超时自适应；进度心跳 + 20s 零进度判死站；整流程 25s→40s、调度窗口 50s→60s。
- **2026-09-18 测试基础设施（TASK016）**：`scripts/` → **`tests/`**（静态校验器迁入）；新增零依赖运行器 `tests/run-all.js` 与约定文档 `tests/README.md`；约定 = 顶层 `tests/*.js` 每个文件一个测试、**以退出码表达结果**、不加框架不引依赖；`conventions.md` §8.1 明确「测试统一放 `tests/`」。
- **2026-09-19 新增站点 HDHome（.1 → .2 → .3）**：`SITES` 加 `hdhome`（url `https://hdhome.org/index.php`）+ `@match *://*.hdhome.org/*`。该站**已签后签到入口消失、原地变成魔力值行内纯文本「(签到已得N)」**，按钮文案通道无按钮可查。三轮演进:
  - **.1** 只开 `alreadyPageCheck`（整页文本），刻意不开 `noButtonMeansCheckedIn`（"入口全站常驻"前提未实测）。
  - **.2** 用户实测确认「入口在所有页面常驻 + 文案为无方括号的『签到得魔力』」→ 放开 `noButtonMeansCheckedIn` 做兜底。
  - **.3（当前）** 用户反馈".2 不够保险" → **回退该开关**，改 `alreadyCheck` 自定义判定:
    「入口消失 **且** 有登录态证据(`a[href*="mybonus.php"], font.color_bonus` 魔力值信息栏)」才算已签。
    理由: `noButtonMeansCheckedIn` 只回答"入口没了?"不回答"登录了吗?"，未登录页同样无入口 →
    **把漏登录报成"今日已成功"**(面板绿着、当天没签，最坏的误报)。现两通道互补，都不命中时落
    `unconfirmed`(可重试、不计失败)。
  配套给 `tests/lib/sim/sites.js` 加 HDHome 型剧本（`hdhome-index/already/gone/guest/attended` + 按 host 默认路由）
  与用例 `sim-hdhome-pagetext.js`（四条断言: 已签零点击 / 点击→落地→跳回→成功 / 入口消失无文本仍判已签 /
  **未登录页不得判已签**），本机 Chrome 实测通过；`tests/run-all.js` 14/14 全绿。
  **已提交 `d63fe0c`**（分支 `dev`），尚未 push。
- **2026-09-19 新增项目铁律 5「私有资源与凭据」（文档级改动，未动代码）**：用户把 HDHome 整页网页
  （`HDHome __ 种子 高清家园 - Powered by NexusPHP.html` + `*_files/`）放进 `resources-do-not-track/HDHome-Whole-Web/`，
  该类页面内嵌个人 passkey / token / cookie，而本仓库远端公开。据此立规矩：
  ① `resources-do-not-track/` **永不被 Git 追踪**（`.gitignore` 已含，禁止 `git add -f` / 改忽略规则 / 复制到受追踪位置，
  注释已升级为带理由的安全边界说明）；② 其中的密钥/passkey/token/cookie/uid **禁止任何形式外泄**
  （不进对话回复、日志、截图、提交与 diff、issue/PR/Gist、云端笔记、`tests/` 夹具、`src/*.html` 样本）；
  ③ 引用只描述结构（选择器/类名/URL 形状），值一律 `***`；需要样本入库先复制并手工清凭据。
  落点：`AGENTS.md` 铁律 5、`conventions.md` §0.5 + §1 提交前自查第 5 条、`pitfalls.md` **P32**、
  `README.md` 索引与快速提醒 9。**待用户审核后提交**（与今日其他改动同一批）。

## 活跃决策与考量

- **PTAutoCheckIn 已并入正式版**：v2 实测校准已通过，合入 `PTAutoCheckIn.user.js`（改回 `@name PTAutoCheckIn`，递增版本号），删除旧 v1 与 `-v2` 暂存文件。当前单一生产脚本为 `PTAutoCheckIn.user.js`（`2026.09.19.4`）。
- **P28 慢站误判修复（2026-09-18）**：用户三项决策 —— ① `unconfirmed` 作为**独立状态**（不复用 `pending`）；② 自动重试**不允许**在冷却期内再点一次（复检只读状态、不重复点击，风控优先）；③ 整流程超时 25s → 40s 接受。新增硬约束：**超时预算不变式**（`detectMs + stepsMs + 18000ms <= 40000ms`）+ **状态单向阶梯** + **不透明步骤必须声明成本**（`budgetMs` / `alreadyCheckBudgetMs`）。
- **P25 重现检测**：suspect（失败-待确认）不自动重签、不进批量，人工补签后任意访问自动转回 success。
- **「强制批量签到」「行内重试」有风控风险**：无视冷却重试站点，仅今日 failed/unconfirmed 站提供，谨慎使用（见 P5/P19）。
- **「已签后签到入口消失」的建模（`noButtonMeansCheckedIn` 要慎用，2026-09-19，见 P31）**：入口消失后**页面仍留有已签文本** → 用 `alreadyPageCheck`；需要"入口消失"这条通道时 → 用 `alreadyCheck` 把它升级成「入口消失 **且** 有登录态证据」；只有入口消失且**无任何痕迹**（BTSchool）才直接用 `noButtonMeansCheckedIn`。核心理由：后者只回答"入口没了?"，不回答"登录了吗?"，未登录/cookie 过期页同样无入口 → **把漏登录报成"今日已成功"**（最坏误报，用户完全无感知）。HDHome 三轮演进（.1 只文本 → .2 放开开关 → .3 因用户"不够保险"回退改自定义判定）即该结论的由来。

- **2026-09-19 主面板交互（.4，已提交 `80e0f37`）**：用户需求「主弹出 UI 改为失焦自动关闭，同时检测到签到按钮重现时不弹出主 UI」。
  - 面板改为用完即走：`openPanel` 挂 `document` 捕获阶段 `mousedown` + `window` `blur`，`closePanel` 摘除（不留常驻监听）；
    `host.contains(e.target)` 豁免"点在 UI 自身"；`bannerHasAction()` 让**带操作钮的横幅（中断恢复）不自动收起**
    （一次性入口，被误关就找不回来了）。
  - 重现提醒的页面级呈现收敛为唯一入口 `presentReappearedOnPage()`，复核分支与入口内**均无 `openPanel`**。
  - 新增静态校验 `tests/ptautocheckin/check-ptac-panel.js`（A1–A5 失焦接线 / B1–B3 重现不弹面板）；
    面板在 closed shadow 下外部（含 CDP）读不到显隐，只能静态钉死约定。
  - 新增**真浏览器回归** `tests/ptautocheckin/sim-panel-autoclose.js`：面板元素拿不到，改用
    `document.elementFromPoint` 的 **shadow 重定向**（命中面板 → 返回宿主 `#ptac-root-v2`）判定开合；
    实测 ①点面板外收起 ②点 UI 自身不收起 ③window 失焦收起 ④重现时不弹面板且零点击
    ⑤中断恢复横幅（带操作钮）点页面别处不被误关。`node tests/run-all.js` **16/16 全绿**。
    headless 下切标签页不派发 window blur（无窗口焦点）→ 用例自动退化为同源 blur 事件。

## 下一步（按优先级）

0. **HDHomeUI `.5`+`.6` 待用户审核后提交**（分支 `dev`，未 commit）：`.5` 图标体系 + `.6` 归因修正。
   同时等用户对 18 张仿真截图（`.workbuddy-ai/hdui-shots/`）的视觉结论 —— 重点三条：
   ① 导航 16 项每项一色会不会太花；② 枯黄 `#b8933a` 够不够"枯"；③ 图标 16px 尺寸在真站是否偏小。
1. **PTAutoCheckIn 慢站修复实测校准（最高优先）**：改动**已提交**（`ebb06bb`），需按 `scripts/PTAutoCheckIn.md` **校准项 21**（8 项）实测：① 冷却站/U2/suspect 访问后 40s 状态不被改写（P28 前的核心 Bug）；② 元素 8s 后出现仍能记成功；③ 面板「未确认」徽章与统计口径；④ console 预算自检摘要行；⑤ 批量死站 ~20s 内被判跳过；⑥ 批量阶段/耗时显示；⑦ P23/P25/P27 回归抽查。发现问题再迭代修复（已提交，无需再等审核）。
2. **PTAutoCheckIn 既有逐站实测校准**：按 `scripts/PTAutoCheckIn.md` 校准项 1–20 继续（贴吧四吧、蜂巢 `successDetect`、MTeam 系六站、NodeLoc、HHCLUB、U2、批量调度、FAB 四皮肤、跨天守卫、行内重试）。
3. **补测试用例（TASK016）**：约定与运行器已就位，按价值排序补 —— ① PTAutoCheckIn 场景矩阵（慢加载/冷却不改写/双标签并发/慢跳转/预算/既有行为基线）；② 纯函数抽取（阶梯、预算、`deriveStateSignals`/`readEntryState`、超时分类）；③ BTSchoolHelper `parseTorrentTable` 回归（可先为 P2/P10 写失败断言）；④ 仓库元数据一致性检查（TASK010 前置）。候选清单见 `tests/README.md`「待铺的路」。
4. **BTSchoolHelper 待修 Bug**：时魔数值恒为 0（P2，`parseCommaIntSafe`→`parseCommaNumberSafe`）；命名不一致（P10）。
5. **BilibiliEnterFullscreen**：评估 `window.onload + 轮询` 升级 `MutationObserver`。
6. **新增/校准站点**：按 `conventions.md` 第 7 节清单继续补站（新增 `function` 步骤时记得写 `budgetMs`）。
7. **BTSchool 的同类盲区评估（待用户决定，未改）**：全脚本目前只有 `btschool` 仍在用
   `noButtonMeansCheckedIn: true`，它与 HDHome .2 版是同款建模 → **未登录(cookie 过期)页同样没有
   签到入口，会被判成"今日已成功"**（漏登录被静默报成成功）。暂未改动的原因：需要真站确认
   BTSchool 的"登录态专属元素"（HDHome 用的是魔力值信息栏），不能猜；且该站已长期运行、用户未报误报。
   若用户愿意提供未登录页 HTML（或确认一个登录态专属选择器），按 P31 的 `alreadyCheck` 形状改即可，
   并可复用 `sim-hdhome-pagetext.js` 的四态矩阵给 BTSchool 补一套剧本。

## 待办追踪

- 完整任务清单见 [tasks/_index.md](./tasks/_index.md)；现存 Bug 清单见 [pitfalls.md](./pitfalls.md)。
- 现存 Bug 清单见 [pitfalls.md](./pitfalls.md)（P2、P10 为未修复的现存 Bug）。