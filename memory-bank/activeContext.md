# 活跃上下文（Active Context）

> 记忆库核心文件：**当前工作焦点**、最近改动、下一步、活跃决策与考量。此文件是所有核心文件中更新最频繁的。

## 当前工作焦点

**PTAutoCheckIn（`src/PTAutoCheckIn.user.js`，当前 `2026.09.19.3`）——2026-09-19 新增 HDHome 站（已签后入口变纯文本 → 整页文本 + 「入口消失且已登录」自定义判定双通道），改动未提交待审核；此前的慢站误判修复已实施，待实测校准**；同日又完成 TASK017（本地仿真站 + 安全审计），修了首装崩溃等 5 处（见 P29/P30）。v2 引擎与站点建模此前已完成（批量+FAB+贴吧多吧合并为单一生产脚本）。**2026-09-18** 针对用户报告「经常失败 / 网页加载慢一点就可能失败 / 结果反馈慢」，完成 TASK015 的实施：整流程超时定时器不再覆写已给出的结论、状态写入加单向阶梯、新增 `unconfirmed` 独立状态、点击后观察改事件驱动 + 有界复检、建立超时预算不变式与双校验（运行时自检 + 静态校验器）、进度心跳 + 死站提前跳过（见 P28）。同日把测试工具收进 **`tests/`** 并定下零依赖测试约定（TASK016，见 `tests/README.md`）。**三批改动已提交**（`ebb06bb`、`2b31377`、`e2d5f52`，分支 `dev`，未 push），待真实站点实测校准。

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
  **未登录页不得判已签**），本机 Chrome 实测通过；`tests/run-all.js` 14/14 全绿。**未提交，待审核**。

## 活跃决策与考量

- **PTAutoCheckIn 已并入正式版**：v2 实测校准已通过，合入 `PTAutoCheckIn.user.js`（改回 `@name PTAutoCheckIn`，递增版本号），删除旧 v1 与 `-v2` 暂存文件。当前单一生产脚本为 `PTAutoCheckIn.user.js`（`2026.09.19.3`）。
- **P28 慢站误判修复（2026-09-18）**：用户三项决策 —— ① `unconfirmed` 作为**独立状态**（不复用 `pending`）；② 自动重试**不允许**在冷却期内再点一次（复检只读状态、不重复点击，风控优先）；③ 整流程超时 25s → 40s 接受。新增硬约束：**超时预算不变式**（`detectMs + stepsMs + 18000ms <= 40000ms`）+ **状态单向阶梯** + **不透明步骤必须声明成本**（`budgetMs` / `alreadyCheckBudgetMs`）。
- **P25 重现检测**：suspect（失败-待确认）不自动重签、不进批量，人工补签后任意访问自动转回 success。
- **「强制批量签到」「行内重试」有风控风险**：无视冷却重试站点，仅今日 failed/unconfirmed 站提供，谨慎使用（见 P5/P19）。
- **「已签后签到入口消失」的建模（`noButtonMeansCheckedIn` 要慎用，2026-09-19，见 P31）**：入口消失后**页面仍留有已签文本** → 用 `alreadyPageCheck`；需要"入口消失"这条通道时 → 用 `alreadyCheck` 把它升级成「入口消失 **且** 有登录态证据」；只有入口消失且**无任何痕迹**（BTSchool）才直接用 `noButtonMeansCheckedIn`。核心理由：后者只回答"入口没了?"，不回答"登录了吗?"，未登录/cookie 过期页同样无入口 → **把漏登录报成"今日已成功"**（最坏误报，用户完全无感知）。HDHome 三轮演进（.1 只文本 → .2 放开开关 → .3 因用户"不够保险"回退改自定义判定）即该结论的由来。

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