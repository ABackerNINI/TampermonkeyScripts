# 活跃上下文（Active Context）

> 记忆库核心文件：**当前工作焦点**、最近改动、下一步、活跃决策与考量。此文件是所有核心文件中更新最频繁的。

## 当前工作焦点

**HDHomeUI（`src/HDHomeUI.user.js`，`2026.09.19.3`，2026-09-19 新建，TASK018）——HDHome 界面主题套件。**
**2026-09-19 全面重构（`.2` → `.3`，改完待审核未提交）**：用户报两件事 ——
① 右下角浮动圆钮与 PTAutoCheckIn v2 等脚本的 FAB 抢同一个位置；② 5 套主题风格与原 UI 太接近，
12 个格子挤同一行 + 新 UI 按钮都堆到一起，与设计初衷背道而驰。
三件事：① **入口内嵌** —— 量 `ul#mainmenu` 最后一个 li 的右边空档，摆成导航栏末尾小文字钮
`界面 · <主题名> ▾`；面板改为锚在它下方的下拉浮层；`position:absolute` 文档坐标内嵌
（随页面滚动），量不到菜单才退到 `table.mainouter` 右上，再退 `position:fixed` 兜底；
**重摆只在改 left/top/position，不整体重写 cssText**（整体重写会清掉宿主上的 `--ui-*` 配色变量）。
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
与原 NexusPHP 蓝色表格明显不同。**`.3` 改完待审核未提交**。
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