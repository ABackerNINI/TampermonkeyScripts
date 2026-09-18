# PTAutoCheckIn.user.js — PT 多站点自动签到

> 源文件：`src/PTAutoCheckIn.user.js` ｜ 版本 `2026.09.19.4`(升级时同步更新)
> ⚠️ 状态：**v2 已并入正式版**。原 `src/PTAutoCheckIn-v2.user.js`（v2026.09.15.1）内容已并入 `PTAutoCheckIn.user.js` 并改回 `@name PTAutoCheckIn`（递增版本号）；`-v2` 暂存文件与旧 v1（v2026.08.30.1）均已删除, 生产脚本合并为单一 `PTAutoCheckIn.user.js`。

## 功能概述

覆盖 28 个站点(含仅检测不自动签的 U2、无按钮访问即签的 MTeam/DigitalCore/HD-Space/Kufirc/凤凰PT/Sportz Bar、Discourse 论坛按钮签到站 NodeLoc、已签后入口变纯文本的 HDHome)+ 百度贴吧(**多吧**, 每个吧为独立签到单元)。双模式：

1. **被动模式**：访问匹配站点自动签到(同 v1)。
2. **主动批量模式**：点击右下角悬浮按钮 → 面板「批量签到」→ **发起页常驻**, 由调度循环依次用 `GM_openInTab` 在**后台标签**打开各站执行签到, 发起页轮询 GM 状态逐个推进, 全部完成后停在发起页弹出完成面板。
3. **结果查看**：FAB 面板展示**当日全量结果**(成功/失败/未确认/待确认/跳过), GM 存储跨域共享 → 任意已匹配站点打开面板看到的都是同一份数据。`unconfirmed`(未确认, P28)= 超时/无信号等**没有结论**的情况, 面板显青色「未确认」徽章, **不计入失败数**、可重试; 与「失败」(确定失败, 需人工排查)严格区分。
4. **签到按钮重现降级提醒**(2026.09.08 .18/.19/.20；**2026.09.19.4 起只在页面级呈现, 不弹主面板**)：当日记录已签(success)但按钮又呈可签态(服务器重置/换账号/误报)→ **.20 状态降级**: 把当日状态改为 `suspect`, 面板该站 badge 显「**失败-待确认**」且不再计入今日成功(仍不自动重签、不进批量); 同时 **.19 页面级呈现**仍生效: 琥珀警示 toast 一次 + 按钮琥珀高亮描边+⚠ 徽标「已标失败-待确认(仅提醒)」+ 页面底部居中常驻横条(可 ✕ 圆钮关闭本页); FAB 琥珀角标/面板警示条/行标记(.18)保留。页面确认已签 → 状态自动恢复已成功 + 提醒消除; 次日自然作废(见 P25)。**2026.09.08 .26 通用化改造**: 判定从「纯按钮可见文本翻转」重构为**载体无关入口状态信号**(`stateSignals`/`readEntryState`, 文本/attr/class/fn/exists), 旧文本站自动翻译**行为逐位一致**, no-text 属性/class 态站(NodeLoc)由此纳入重现通道(显式 `checkInSelector`+`stateSignals`); MTeam 系六无按钮站与 HHCLUB(无已签基准)仍结构排除(见校准项 19)。
5. **行内单站强制重试(2026.09.08 .28)**：面板中今日「失败」的站点, badge「失败」悬停变琥珀「↻ 重试」→ 点击在**新标签页(前台)**打开 `?ptacRetry=<unitId>` 对该站执行一次**无视冷却**的强制签到(`forceCooldown`, 语义同批量「强制重试」), **执行完毕不关闭标签**(用户留在页面观察, 状态写回后即呈现成功/仍失败)。与批量任务完全隔离(不建任务/不参与调度/不关标签/不轮询)。一次性语义: 重试页执行前 `history.replaceState` 剥掉 `ptacRetry`(F5/刷新不重复强点); 跨标签 30s 互斥锁(`ptac_retry_<uid>`)防同站并发双点; 批量调度活跃且正处理该站时入口/执行页均拒绝; 点击前仍重写冷却, 再失败进入新一轮冷却(不连环); 今日 `failed` 与 `unconfirmed` 均提供(suspect「失败-待确认」疑似已签不提供, 防误重签)。
6. **慢站误判修复 + 预算不变式 + 结果分类(2026.09.18 .1, 见 P28)**：① 整流程超时定时器不再覆写已给出的结论(旧版会在 25s 后把 `skipped`/`detect_only`/`suspect` 一律改成 `failed('整流程超时')`, 这是「经常失败」的主因); ② `writeStatus` 加**状态单向阶梯**白名单; ③ 新增 `unconfirmed` 独立状态区分「慢」与「坏」; ④ 点击后观察窗由固定 800ms + 只认 `pagehide` 改为**事件驱动**(`pagehide`/`beforeunload`/URL 变化/成功特征任一命中即提前结束, 上限 4s) + **有界复检**(+5s/+12s 各一轮, **只检测不重复点击**); ⑤ 建立**超时预算不变式**并附双校验(运行时 `auditUnitBudgets()` 启动自检 + 提交前 `node tests/ptautocheckin/check-ptac-budget.js`); ⑥ `waitForElement` 增加可交互判定与慢页面超时自适应; ⑦ 后台标签写**进度心跳** `ptac_progress_<uid>`(调度页显示实时阶段/耗时), 20s 零进度即判死站(死站从 60s 降到 ~20s); ⑧ 整流程超时 25s→40s、调度窗口 50s→60s。

核心设计不变：站点配置数据 + 通用执行引擎。**签到原子单位从「域名」细化为「页面入口 unit」**（解决贴吧多吧）。

## 脚本元数据要点

- `@run-at document-start`；`@grant GM_getValue / GM_setValue / GM_log / GM_openInTab`（GM 存储**按脚本共享、跨域可读**——跨站状态/任务依赖此特性; `GM_openInTab` 用于批量在后台标签打开各站, 不受弹窗拦截）。
- `@name PTAutoCheckIn`：v2 已并入正式版, 改回正式脚本名（原 `-v2` 后缀为暂存共存期避免同名冲突, 现已移除）。
- `@match` 覆盖全部目标域名；批量打开的后台标签 URL 全部来自配置白名单。
- iframe 内直接退出(`window.top !== window.self`)。

## 配置模型(group + unit 两级)

```js
// 单站: 顶层字段即 unit 字段(运行时包成单 unit group)
{ id:'tangpt', name:'躺平', url:'https://tangpt.top/', match:/^https?:\/\/[^/]*\.tangpt\.top\//, ... }
// 多吧 group(百度贴吧): 每个吧一个独立 unit
{ id:'tieba', name:'百度贴吧', units:[
    { id:'tieba_pt', name:'pt吧', url:'https://tieba.baidu.com/f?kw=pt',
      match:(href)=>{try{return new URL(href).searchParams.get('kw')==='pt'}catch(e){return false}}, ... },
    { id:'tieba_hdsky', ... kw=hdsky ... } ] }
```

运行时拍平为 `UNITS[]`(每 unit 带 `groupId/groupName`)。**每个 unit 拥有独立的状态与冷却 key**——每个吧分别防高频、分别记当日成功。

| unit 字段 | 说明 |
|------|------|
| `id` | 稳定唯一标识(存储 key 与批量任务列表均用) |
| `url` / `attendanceUrl` | 批量导航目标(后者可选, 直达签到/结果页); url 同时是页面归属的唯一事实来源 |
| `match` | **可选**——`RegExp` 或函数(传 href)显式决定页面归属; 缺省由 `url` 推导: host 相等(忽略 `www.` 前缀), 且 url 带 query 时逐参数一致(页面可带额外参数, 如贴吧 `kw`) |
| `checkInSelector` / `checkInContent` | 签到按钮定位与文案校验 |
| `alreadyCheckedInContent` | 已签到特征文本; **检测主通道=按钮文案**——每次访问页面都检测, 不受 10 分钟冷却限制(冷却只限"是否点击", 不限"是否检测") |
| `stateSignals` | **可选(P25 重现检测载体无关信号, .26 通用化)**: 显式描述签到入口的已签/可签信号, 不再假设状态只存在按钮可见文本——文本/元素属性(attr)/class/自定义函数(fn)/存在性(exists) 均可。结构: `{ checked:[信号...], checkable:[信号...] }`, 任一 checked 命中=入口呈已签, 任一 checkable 命中=入口呈可签(重现判定); checkable 不配 = 反向常驻按钮站(入口存在且非已签即可签, 如蜂巢)。信号项: `{kind:'text', contains}`(visibleText 含) / `{kind:'attr', name, contains}`(属性值含) / `{kind:'attrEq', name, eq}`(属性值精确) / `{kind:'class', name}`(classList 含) / `{kind:'fn', fn}`(自定义谓词) / `{kind:'exists'}`(元素存在即命中)。**旧字段自动翻译, 文本站零改动**: 不配 stateSignals 时 checked=[text alreadyCheckedInContent]、checkable=[text checkInContent](无 checkInContent → 反向常驻站); 结构排除同旧: 无 `checkInSelector`(无按钮隐式站)或无已签基准(HHCLUB 等)→ 无重现语义(见 P25/.26) |
| `alreadyCheck` | 可选函数, 自定义已签到判定 |
| `noButtonMeansCheckedIn` | true: **找不到签到按钮即视为已签**(已签后签到按钮消失的站, 如 BTSchool); 仅当按钮确实会因已签而消失时启用 |
| `alreadyPageCheck` | **默认 false(全部站点默认关闭整页文本检测**, 防页面其它区域误报); 仅特殊站显式 true(如跳页型落地页无签到按钮的 HDBao/MuXueGe) |
| `landingCheckedInContent` | **落地页确认标记文本(可选)**: 签到动作导向的落地页上签到后才出现的唯一文本(如 PTT「总签到记录」表头)即判已签; 落地页路径由签到按钮 href 推导(`isLandingPageOf`: `attendanceUrl` 优先, 否则解析 `checkInSelector` 的 href 属性选择器——**不写死 attendance.php**, 落地页叫 attendance/signin/任意 php 都自动识别); 整页文本匹配、纯文本不绑 class(class 会随改版变化), 非落地页不检测防误报 |
| `successDetect` | 点击后成功检测(同页 AJAX 场景) `[{type:'url'\|'text'\|'func',...}]`, 任一命中即成功 |
| `confirmManual` | true: 无可靠成功特征, 点击后记 pending 待人工确认 |
| `batchDelayMs` | 批量模式本站处理完后、跳下一站前的缓冲(贴吧吧间 3s 防风控) |
| `enabled` | 是否参与批量 |
| `favicon` | 可选, 显式指定站点图标 URL(默认自动取用: 路过收集真实 icon → 站点根 /favicon.ico 兜底) |
| `steps` | 步骤数组, 缺省 `[CLICK_CHECK_IN]` |
| `budgetMs` | **`function` 步骤必填(P28)**: 该步骤内部的最坏耗时(ms)。`function` 步骤内部是任意代码, 引擎无法静态求和 → 必须声明; 未声明则运行时预算自检报 UNKNOWN 判为不通过 |
| `alreadyCheckBudgetMs` | **配了 `alreadyCheck` 时必填(P28)**: 自定义已签判定的最坏耗时(ms); **纯同步 DOM 判定写 `0`**(如 NodeLoc), 含 `waitForTrue` 的按实际写(如 HHCLUB `3000`) |

### 超时预算与状态阶梯(P28, 2026.09.18)

**为什么**: 单站内部等待是**串行累加**的(已签检测 → 步骤 → 点击后观察窗 → 复检), 若声明的最坏成本之和超过整流程硬超时, 该站必然在等结果途中被硬超时打断 → 永远拿不到 success。旧 25s 上限下 NodeLoc(≈26.8s)已天生越界。

**常量**:

| 常量 | 值 | 作用 |
|------|-----|------|
| `UNIT_TOTAL_TIMEOUT` | 40000ms | 单站整流程硬超时(原 25s, 2026.09.18 提高) |
| `UNIT_TIMEOUT_MARGIN_MS` | 5000ms | 预算余量; 必须 `>= POST_CLICK_WATCH_MS`(观察窗在内部 deadline 外仍有硬等待) |
| `POST_CLICK_WATCH_MS` | 4000ms | 点击后观察窗上限(事件驱动, 命中即提前结束) |
| `POST_CLICK_SETTLE` | 800ms | 最小观察时长(仅 `confirmManual` 分支用) |
| `UNCONFIRMED_RECHECK_DELAYS` | `[5000, 12000]` | 未确认后的同页复检延迟(只复检不重点) |
| `RECHECK_DETECT_CAP_MS` | 4000ms | 复检时单次成功检测上限(防复检吃光预算) |
| `PER_UNIT_TIMEOUT_MS` | 60000ms | 调度窗口上限(原 50s); 须 `> UNIT_TOTAL_TIMEOUT + 结算余量` |
| `NO_PROGRESS_SKIP_MS` | 20000ms | 零进度心跳提前跳过窗口(死站不再死等调度窗口) |
| `SLOW_PAGE_WAIT_BONUS_MS` | 10000ms | 页面未 `complete` 时的元素等待放宽量 |

**不变式**: `detectMs + stepsMs + AUDIT_RESERVE_MS <= UNIT_TOTAL_TIMEOUT`, 其中 `AUDIT_RESERVE_MS = 5000 + 4000 + (5000 + 4000) = 18000ms`(余量 + 观察窗 + 首轮复检)。即**留给站点自身的预算上限 = 22000ms**。

**各 unit 实测预算**(`computeUnitBudget` 求和, 2026.09.18 自检全通过):

| unit | 检测 | 步骤 | 预留 | 合计 / 40000 |
|------|------|------|------|--------------|
| HHCLUB | 3000 | 13400(头像 3×(2500+300)=8400 + click_checkin 5000) | 18000 | **34400** |
| 蜂巢 pting | 0 | 15800(5000+5000+1000+2000+800+2000) | 18000 | **33800** |
| HDBao / MuXueGe | 0 | 11500(5000+1500+5000) | 18000 | 29500 |
| NodeLoc | 0(同步判定) | 10000(`waitForElement` 10s) | 18000 | 28000 |
| 默认按钮站 / 贴吧 | 0 | 5000 | 18000 | 23000 |
| 隐式签到站(MTeam 系六站) | 0 | 3000(仅 wait) | 18000 | 21000 |

> 最紧的是 HHCLUB(余量 5600ms)。新增站点或调大某站超时后, 若自检摘要里的余量变红/变小, 需重新分配。

**状态单向阶梯 `STATUS_TRANSITIONS`**(`writeStatus` 白名单, 非法迁移被拒 + `console.warn`):

```text
(初始 '')     -> success, failed, pending, skipped, suspect, unconfirmed
skipped      -> success, failed, pending, suspect, unconfirmed
failed       -> success, suspect, unconfirmed
unconfirmed  -> success, suspect, failed, skipped
pending      -> success, failed, suspect, unconfirmed
suspect      -> success
success      -> suspect
```

安全性质: ① `success` 只能转 `suspect`(P25 降级), 任何不确定结果都不得覆盖「已确认成功」; ② `suspect` 只能转 `success`(页面确认); ③ 任何「有结论」的状态都不得转回 `pending`(在途标记不可复活); ④ `skipped` 与初始态必须能转 `pending`(它们不是结论, 否则「上次无动作 → 这次真点击」会被拒)。

**双校验**: 运行时 `auditUnitBudgets()`(启动时逐站求和, 通过则打一行摘要, 违规打全量表格 + `console.error`); 提交前 `node tests/ptautocheckin/check-ptac-budget.js`(零依赖, 校验常量不变式 + 阶梯结构 + 不透明成本声明 + 自测 `computeUnitBudget`)。**不提供 `window` 调试入口**(`conventions.md` §8.2)。

## 存储与状态层(GM, key 前缀 `ptac_`)

| key | value | 用途 |
|-----|-------|------|
| `ptac_status_<unitId>` | `{date:'YYYY-MM-DD', status, msg, ts}` | 当日结果(面板展示), status ∈ success/failed/pending/skipped/suspect/**unconfirmed**。`suspect`=签到按钮重现降级的「失败-待确认」(见 P25); `unconfirmed`=未确认(超时/无信号, 可复检可重试, 不计入失败, 见 P28)。**写入受单向阶梯 `STATUS_TRANSITIONS` 约束**(见下「超时预算与状态阶梯」) |
| `ptac_cooldown_<unitId>` | 上次触发时间戳 | 10 分钟间隔 |
| `ptac_alert_<unitId>` | `{date, btnText, ts, state:'on'\|'off'}` | **签到按钮重现提醒**(P25): 记录已签但按钮再现可签文案; state on=提醒中(每站每天至多一次, 清除置 off 当天不复写, 跨天读取时清理) |
| `ptac_favicon_<unitId>` | 站点真实 icon URL | 路过收集(脚本跑在该站时读 `<link rel="icon">`), 面板列表图标用 |
| `ptac_task` | `{taskId, list:[unitId...], index, startedAt, hb}` | 批量任务(调度心跳 `hb` 由发起页定时刷新, 其它页面据此区分"调度中/已中断") |

## 单 unit 判定优先级(防封号核心)

```
1. 当日 success 或 suspect(失败-待确认) → skipped(今日已完成/已标待确认; 两者都进入「按钮重现复核」分支: 确认已签→suspect 转回 success+清提醒, 按钮再现→success 降级 suspect+写提醒; 不自动重签、不进批量)
2. 已签到检测 —— 每次访问都执行, 不受冷却限制(检测≠点击, 无封号风险):
   按钮文案命中 / (noButtonMeansCheckedIn 站)找不到签到按钮 / (仅显式 alreadyPageCheck 的站)整页文案命中
   / (设了 landingCheckedInContent 的站)签到落地页(按钮 href 推导路径, isLandingPageOf)出现标记文本 → success
2.5 仅检测型站(detectOnly, 如 U2)      → skipped(需人工签到; 不点击/不写冷却/不记失败)
3. 上次 pending 未确认且未过冷却、且第 2 步仍无已签证据 → unconfirmed(未确认, 可重试; P28 前写 failed)
4. 冷却中(<10min)                  → skipped(冷却只防重复点击, 不阻止检测)
5. 执行 steps                      → 点击前先写 cooldown(即使跳页丢页面, 冷却也已落盘)
   · 步骤抛错: 消息含「超时|timeout」→ unconfirmed(慢/无信号, 可复检可重试)
              其余(选择器失效/文案不符/函数步骤抛错)→ failed(需人工排查)
   · **此处不做重试点击** —— 冷却已写入, 冷却期内绝不重复点击(用户决策)
6. 点击后落盘 pending → confirmAfterClick(事件驱动观察 + 有界复检, 见 P28):
   a) 观察窗 POST_CLICK_WATCH_MS(4000ms)内并发竞速「成功特征命中」/「确认发生跳转」
      (跳转信号 = pagehide / beforeunload / **URL 变化**——SPA 软导航无 pagehide, 即 P22 的形态)
      · 命中成功特征            → success
      · 确认发生跳转            → 保持 pending 返回; 落地页结算判定(已签→success)
   b) 观察窗内无结论 → 有界复检 UNCONFIRMED_RECHECK_DELAYS=[5s, 12s](**只检测, 绝不重复点击**):
      每轮 detectAlreadyCheckedIn + detectSuccess(限时 4000ms); 命中 → success
      预算不够或仍无结论        → unconfirmed(未确认, 可重试)
   · confirmManual 站走旧路径: 只判「有没有跳转」(POST_CLICK_SETTLE 800ms), 其余 pending
```

> 与 v1 关键差异：间隔 key 从「origin+pathname」改为**按 unitId**; 冷却命中时**跳过**而非 sleep 等待(批量场景需要); 「当日成功」由显式状态保证(需求: 须检测到特定成功条件才算成功)。
> P28 差异(2026.09.18): 新增 `unconfirmed` 独立状态与单向阶梯; 步骤 3 与「点击后无结论」不再写 `failed`; 点击后观察窗由固定 800ms + 只认 pagehide 改为事件驱动 + 有界复检。

## 批量任务引擎(常驻发起页 + 后台标签串行调度)

> 背景：v2026.09.07.2 的"接力导航"(单标签串行 `location.replace`)在下一站**网络层失败**(浏览器错误页无脚本运行)时会断链, 只能等 30min stale 清理。v2026.09.07.3 改为**发起页常驻 + 后台标签串行调度**, 断链被单站超时自动跳过吸收。

1. 面板「批量签到」→ 候选 = enabled 且非今日成功且非未过期 pending → 建 `ptac_task`(含心跳 `hb`)。**发起页不再跳转**, 直接进入调度循环 `runBatchScheduler`。
2. 调度循环逐个站：`GM_openInTab(unit.url + '?ptacTask=taskId', { active:false, insert:true })` 在**后台标签**打开目标站(记录打开前该站状态 `ts` 与 `openedAt`)。后台标签页 `runBatchTabPage` 校验任务与页面归属后执行单站签到, **只写 GM 状态与进度心跳, 不推进任务、不渲染 UI**。
3. 发起页轮询(1s)：读到该站"今日且比打开前新"的状态即结算 —— pending 先观察 **10s**(`PENDING_GRACE_MS`)等落地页改写; success/failed/skipped/**unconfirmed** 直接结算。**进度心跳 `ptac_progress_<uid>`(P28)**: 后台标签每阶段写一次(阶段 + 时间戳), 调度页据此显示实时阶段(`等待签到按钮`/`已点击签到按钮`/`确认签到结果`…)与已用秒数; 若有新鲜心跳(3s 内)则**延后 pending 结算**, 避免把「正在确认中」误判为死站。
4. **落地页结算**: 后台标签点击签到触发整页跳转(如 NexusPHP attendance.php, URL 无 ptacTask)后, 落地页以"普通访问"加载: 若任务在调度中(心跳新鲜)且当前页命中任务当前 unit → `settleUnitOnLandingPage` **只检测已签并写 success(不推进任务)**, 由调度页轮询读到后推进; 未命中已签不改写(保留 pending 观察)。
5. **超时自动跳过(断链兜底)**: 单站调度窗口 60s(`PER_UNIT_TIMEOUT_MS`)内始终无回写(站点无法访问/页面加载失败/脚本未运行)→ 写 `unconfirmed('站点暂时无法访问或超时, 已跳过')` 并自动推进下一站 —— 被跳过的站记未确认, 下次批量天然重试。**P28 提前失败检测**: 若 `openedAt` 起 `NO_PROGRESS_SKIP_MS(20s)` 内**零进度心跳**(死站/错误页/脚本没跑起来), 直接判定死站并推进 —— 死站耗时从 60s 降到 ~20s。打开后台标签失败(`GM_openInTab` 抛错)同样写 `unconfirmed`。
6. 每站处理完按 `unit.batchDelayMs` 倒计时(芯片显示, 可点停止取消); 后台标签结算后即 `tab.close()` 关闭。
7. 全部处理完：清任务 → **停在发起页弹出完成面板**; 可随时取消(单站窗口内亦可)。
8. **中断恢复**: 调度页被关/崩溃后, 心跳 `hb` 15s(`HEARTBEAT_FRESH_MS`)内不再刷新; 30min(`TASK_STALE_MS`)内任意匹配页检测到过期心跳 → 横幅「检测到中断的批量任务(第 n/N 站)」+「恢复批量」按钮一键续跑(不自动重签, 防误触发)。30min 后视为 stale 自动清理。
9. 安全与兜底: 任务只含 unitId 列表(不含任何凭据); 打开的后台标签 URL 均来自配置白名单; 单 unit 执行有 **40s 整流程超时保护**(`UNIT_TOTAL_TIMEOUT`, 2026.09.18 由 25s 提高; 超时归 `unconfirmed` 而非 `failed`)与**内部预算 deadline**(`setRunDeadline`, 使内部等待在硬超时前自行收敛落盘); 调度中其它页面命中任务当前站点时只结算/跳过被动点击, 防并行重复触发。
10. 实现要点: `GM_openInTab` 需 `@grant`(更新脚本时 Tampermonkey 会弹新增权限确认, 须接受); 后台标签为后续打开, 无用户手势, `window.open` 会被弹窗拦截故必须用 `GM_openInTab`。

## FAB / 面板 UI

- Shadow DOM 注入, 样式完全隔离; CSS 变量 + `@media (prefers-color-scheme: dark)` **跟随系统深浅色**。
- **主面板「失焦自动关闭」(2026.09.19.4, 用户需求)**: 面板是用完即走的浮层 —— 焦点离开即收起:
  ① 点面板外任一处(`document` **捕获阶段** `mousedown`, 抢在站点 `stopPropagation` 之前);
  ② 切标签页/切窗口/点地址栏(`window` 的 `blur`)。三条配套约束:
  · **监听只在面板展开期间挂**(`openPanel` → `armAutoClose`, `closePanel` → `disarmAutoClose`), 不给宿主页面留常驻全局监听;
  · **点在 UI 自身不算失焦** —— shadow(closed) 内部事件传播到外部时 `target` 被重定向成 `host`, 故用 `host.contains(e.target)` 判定(否则点面板里的「批量签到/外观」会把自己关掉);
  · **面板内有待决横幅时不自动收起**(`bannerHasAction()` 查横幅里有没有操作钮)—— 「中断恢复」是一次性入口, 用户点了页面别处就再也找不回来。
  ⚠️ 因此**程序性弹出的面板要意识到它会被收起**: 目前 `showBatchDone`(批量完成, 横幅无操作钮 → 可被收起)与 `offerBatchResume`(中断恢复, 带「恢复批量」钮 → **豁免**)两处; 新增自动弹面板的场景先想清楚"被误关了用户还能不能找回入口"。
- **重现提醒不弹主面板(2026.09.19.4)**: 「签到按钮重现」的页面级呈现**唯一入口** = `presentReappearedOnPage(unit, toastMsg)`(按钮琥珀描边 + ⚠ 徽标 + 底部横条 + 首次降级一条琥珀 toast; `toastMsg` 空串 = 只重建装饰不打扰)。**该入口与复核分支内均不得出现 `openPanel`** —— 用户正在看页面上的签到按钮时把面板弹出来 = 抢焦点 + 挡住要看的东西; 面板内本就有常驻警示条与行标记, 想看随时点 FAB。两条不变式由 `tests/ptautocheckin/check-ptac-panel.js` 静态钉死, 并由 `tests/ptautocheckin/sim-panel-autoclose.js` 在真浏览器里实测 —— 面板挂在 closed shadow 下, 页面脚本/CDP 都拿不到 `panel` 元素, 故用 `document.elementFromPoint` 的 **shadow 重定向**(命中面板 → 返回宿主 `#ptac-root-v2`)判定开合(详见校准项 23)。已实测通过: 点面板外收起 / 点 UI 自身不收起 / window blur 收起 / 重现不弹面板且零点击 / 中断恢复横幅不被误关。
- FAB(右下角, 渐变圆钮)→ 点击展开面板：今日汇总 + 分组列表(多吧 group 有组头)+ 每行状态徽章/msg/时间 + 「批量签到(剩余 n)」按钮。**FAB 皮肤 4 套可切换**(面板头部「外观」展开选择条, 存 `ptac_skin` 跨站生效): ①变色 全完成→绿底✓(无角标)/ 有未签→紫底✓+红底剩余角标; ②数字 全完成→✓ / 有未签→主区大字剩余数(绿角标=成功数); ③信号灯 完成→绿✓ / 今日有失败→红底!+失败角标 / 其余→琥珀✓+剩余角标; ④光环 分段彩光贴圆缘柔和发散(成功淡绿 mint 段 / 失败淡粉 rose 段 / 待办灰段, 段弧长=该状态站数占比, 多段并存不整环变色; 如 20 成功+1 失败→绿环为主+尾段淡粉), **本体透明且显式 `animation:none` 关掉 baseGlow**(外圈紫晕又强又与呼吸脱节), 段 alpha 压低至 0.34/0.26 → 常亮辉光弱; ::before 整体 ringBreathe **弱呼吸**(brightness 0.96↔1.07 明暗 + drop-shadow 淡紫光晕沿圆缘外 2px↔9px 外扩收拢, blur 2px 在 keyframes 内重声明; 3.6s, 幅度收敛不抢戏); 光芒动感由 **真实 DOM 日冕射线承担**(**完全复刻 sample.html 太阳算法**——先前「埋段+mask 圆孔挖根」「渐变平台按露出段比例」等自定义均效果一般已弃): `.ring-rays` 容器(inset:-60px 仅定位, **z-index:-1 沉到 ::before 之下**(盖光层之下), 无 mask 无裁剪, 射线溢出可见), 内 22 条 `<i class="ray">`(主 18 + 日冕长细 4, sample 同款数量): 底边锚圆心(`bottom:50%;left:50%` + 负 margin 居中)、`transform-origin:bottom center`、**只 `rotate(var(--a))` 绕圆心**指向各角(勿加 translateY——rotate 绕 transform-origin=底边中心, 根会全叠圆正上一点呈折扇); **射线全长=圆心到尖端(主 70~124px/日冕 118~162px), 根部(0~26px)被 ::before 中心紫罩圆盖住(紫罩 radial 实盖至圆缘: accent-1 42% → transparent 67%, 兼 sample center-icon 的盖光作用), 露出=圆缘外渐变尾段——无需 mask 挖孔**; 渐变照 sample 金档 `0.9@0 → 0.6@30% → 0.2@70% → transparent`(根亮尖透, **无平台**)+ 顶部半圆帽 `border-radius:50% 50% 0 0 / 100% 100% 0 0` + `filter: blur(1px)` 羽化; 静态 `opacity:0`, 动画 `rayPulse` **三帧**(照 sample solarPulse): 0% `opacity 0.15/blur2px/scaleY 0.6` → 50% `0.9/blur0/1.1`(峰值锐利清晰成刺) → 100% `0.3/blur1.5/0.8`, `alternate` 往复 + **正** `animation-delay`(主 0~2.5s、日冕 0~3s)错相 → 各条低谷模糊柔化、峰值锐利的呼吸闪烁; **keyframes 内须重组 `rotate(var(--a)) scaleY(...)` 与 blur(动画覆盖行内值)**; 主束均分角+±7.5° 随机扰动、日冕束全随机角(更长更细更慢, sample 比例); 本体 `.fab.ring` 另以 `box-shadow` 柔和紫光晕取代硬黑投影(透明圆上黑投影破坏光感); JS 生成只一次(`!querySelector('.ring-rays')` 守卫, 每页图案不同), **切走 ring 皮肤时须移除 `.ring-rays` 元素**(样式挂 `.fab.ring` 下, 残留会裸显示); 中间圆(紫罩蒙版带图标+绿角标=成功数, 蒙版越边缘越透明, 实盖至圆缘)不上波纹动画(transform 留给 hover/active); 辉光带仅圆缘外 26~34px。核心诉求: **全部签到完毕与有站点未签到在 FAB 上有明显区别**。
- 批量进行中(发起页)：FAB 旁芯片与面板内进度条显示 `批量 i/n · 正在处理/倒计时`, 可随时停止; **后台任务标签不注入 FAB/UI**(避免后台闪烁); 中断恢复横幅在发起页以外任意匹配页显示(「检测到中断的批量任务」+「恢复批量」按钮)。
- **站点图标**: 每个站点名前显示其 favicon(14px 圆角, 透明底加灰底容错)。取用链 = 配置 `favicon` 字段 → GM 路过收集的真实 `<link rel="icon">` URL(存 `ptac_favicon_<unitId>`, 仅 http(s)) → 站点根 `/favicon.ico` → 无则不发图; URL 与站页面一致时命中浏览器 HTTP 缓存(零额外流量); 加载失败(无图标/路径非标/防外链)由**捕获阶段 error 事件委托**隐藏, 不占位不影响站名。
- **点击站点名** → `GM_openInTab` 新标签(前台)打开该站(行尾 ↗ 提示, 事件委托, 行内容重建不影响)。
- **失败且冷却中的站**(今日 `failed` + 10min 冷却未过): 整行降透明度 + 左侧琥珀竖条 + 副文案提示「冷却中, 默认不参与批量」; 批量候选**默认排除**此类站。常规「批量签到」按钮**右侧紧贴一个窄 chevron 图标钮**(拆分按钮组, 同色系+细分隔线) → 点击后琥珀色的 **「强制批量签到(n 站)」** 按钮从**按钮行上方浮出**(absolute 浮层不占文档流, 覆盖站点列表底部; 按钮与「批量签到」本体对齐), 浮出钮带详细 tooltip; 点击无视冷却强制重试(点击前仍重写冷却, 再失败进入新一轮冷却)。**全部签到完毕(无失败冷却站)或批量进行中隐藏图标钮**(此时「批量签到」恢复完整圆角); 图标钮 hover/展开态变琥珀色(图标不旋转); 强制按钮 tooltip 说明适用场景与风控风险。**行内重试入口(.28)**: 今日失败站的 badge 悬停变琥珀「↻ 重试」(cursor pointer + 风控 title 提示), 点击 → 前台新标签 `?ptacRetry=<uid>` 单站强制重试(无视冷却、完成不关标签; 一次性剥参 + 30s 跨标签互斥锁防并发; 与批量调度互斥)。
- 面板数据读 GM 存储, 任何已匹配站打开均为同一份(满足「任意已添加网站查看完成面板」)。

## 已有站点一览(28 站 + 贴吧 6 吧)

> 2026.09.07 实测各站签到链接普遍不再带 `faqlink` class, 故所有 PT 站 `checkInSelector` 一律去掉 class 依赖(仅按 `href*="attendance.php"` 定位); PTTime 保留 `a.fcb`、Cyanbug 保留 `a.nav-btn`(非 faqlink, 实测仍有效)。站点 `url` 同步更新为当前有效入口(大多去掉 `www.` 前缀, 与 `match` 保持一致)。蜂巢为 shadcn/Radix 改版站(签到是按钮不是 attendance 链接), 例外按 `data-slot` 定位, 见下表。

| unit | 域名/kw | 入口选择器 | 签到文案 / 已签特征 | 备注 |
|------|---------|-----------|-------------------|------|
| 躺平 | tangpt.top | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| PTTime | pttime.org | `a.fcb[href*="attendance.php"]` | `签到领魔力` / `签到详情` | 落地页标记 `总签到记录`(见下) |
| Railgun | bilibili.download | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| PTZone | ptzone.xyz | `a[href*="attendance.php"]` | `[簽到得魔力]`(繁) / `簽到已得` | — |
| PTSBao | ptsbao.club | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| HDClone | pt.hdclone.top | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| BTSchool | pt.btschool.club | `a[href*="index.php?action=addbonus"] > font` | `每日签到` / `签到已得` | 已签后按钮消失; `noButtonMeansCheckedIn:true` |
| 大香蕉 | pt.daxiangjiao.org | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| NovaHD | pt.novahd.top | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| PTFans | ptfans.cc | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| CarPT | carpt.net | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| HDTime | hdtime.org | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| HDFans | hdfans.org | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| HDHome | hdhome.org | `a[href*="attendance.php"]` | `签到得魔力`(**无方括号**) / `签到已得`(已签后入口消失, 原地变纯文本) | `alreadyCheck`(入口消失**且**登录态证据) + `alreadyPageCheck:true`; **不用** `noButtonMeansCheckedIn`(见 P31) |
| CrabPT | crabpt.vip | `a[href*="attendance.php"]` | `[签到得蟹币]` / `签到已得` | — |
| Cyanbug | cyanbug.net | `a.nav-btn[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| HDBao | hdbao.cc | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | 跳页; `attendanceUrl` 直达; `alreadyPageCheck:true` |
| MuXueGe | pt.muxuege.org | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | 同上 |
| 蜂巢 | pting.club | `button[data-slot="sidebar-user-check-in"]` | — / `已签到` | 对话框式(改版后已签检测启用, 对话框步骤可选); `successDetect` 按钮变已签 5s |
| MTeam | kp.m-team.cc | —(无按钮, 登录态访问主页 `/index` 即自动签到) | — / — | 显式 `match` 只认 kp 子域 `/index`; `successDetect` func 轮询 antd 卡片「站点数据/站點數據」(16s); 未登录被重定向无卡片 → failed |
| DigitalCore | digitalcore.club | —(无按钮, 登录态访问首页即自动签到) | — / 导航链接 `a[href="/alltorrents"]`「All Torrents」 | 同 MTeam 隐式签到型: 显式 `match` 限首页(根或 `/index`, 排除详情/种子列表误触发); `successDetect` func 轮询该链接(16s); 未登录重定向无导航 → failed |
| HD-Space | hd-space.org | —(无按钮, 登录态访问首页即自动签到) | — / 整页文本「Last access:」 | 同 MTeam 隐式签到型: 显式 `match` 限首页根路径; `successDetect` text 轮询「Last access:」(16s); 未登录重定向无该文本 → failed |
| Kufirc | kufirc.com | —(无按钮, 登录态访问首页即自动签到) | — / 导航链接 `a[href="/torrents.php"]`「Torrents」 | 同 DigitalCore/HD-Space 隐式签到型: 显式 `match` 限首页根路径; `successDetect` func 轮询该链接(16s); 未登录页显示 Login/Reactivate 无该链接 → failed |
| 凤凰PT | pt.521.best | —(无按钮, 登录态访问首页即自动签到) | — / 导航链接 `a[href="torrents.php"][rel="sub-menu"]`「种子」 | 同 MTeam 隐式签到型(NexusPHP 传统中文站): 显式 `match` 限首页(根或 `/index.php`); `successDetect` func 轮询该链接(16s, 相对路径无前导斜杠 + rel 属性); 未登录登录页无该链接 → failed |
| Sportz Bar | sportz247.bar | —(无按钮, 登录态访问首页即自动签到) | — / 导航链接 `a.level1-a.drop[href="#"]`「Torrent Menu」 | 同 MTeam 隐式签到型(xbtitFM 传统站): 显式 `match` 限首页(根或 `/index.php`); `successDetect` func 轮询该链接(16s, href 为 `#` 锚点 + level1-a drop class); 未登录无导航菜单 → failed |
| NodeLoc | nodeloc.com | `button.checkin-button`(no-text 图标钮, 点它签到) | —(按钮无可见文本) / class 含 `checked-in` + title/aria-label「您今天已经签到过了」 | Discourse 论坛: **no-text 按钮无文本 → 引擎文本通道不可用**, 已签判定走 `alreadyCheck` 自定义(class/title 属性), 点击走 function 步骤, 成功走 func `successDetect`(轮询 checked-in 16s); 显式 `match` 限首页根路径; 无 `checkInContent`/`alreadyCheckedInContent`, 但配 `checkInSelector` + `stateSignals`(class/attr 载体: checked=checked-in/含「已经签到过」, checkable=含「每日签到」)→ **P25 重现检测已纳入**(.26 通用化改造, 待实测) |
| HHCLUB | hhanclub.net | 先点 `img#user-avatar` 展开菜单, 再点 `a[href*="attendance.php"]` | `[签到得憨豆]` / 落地页 `#date-display` 当月 `yyyy-mm` | `alreadyCheck` 自定义函数(动态算当月); **头像点-验-重试函数步骤**(点击后验签到链接可见, 最多3次) + `successDetect` 同页确认(轮询变 attendance.php 且当月日历 8s)双通道; 2026.09.08 修复普通触发偶发失败 |
| U2 | u2.dmhy.org | `a[href*="showup.php"]` | `立即签到` / `已签到` | **仅检测型** `detectOnly:true`(签到需人工输入验证码 → 不自动点击/不进批量); 未签面板提示「需人工签到」; 按钮文案变已签即判 success(2026.09.08 接入, 待实测) |
| pt吧 | tieba f?kw=pt | `.button-wrapper.operate-btn.follow-sign` | `签到` / `连签` | `batchDelayMs:3000` |
| hdsky吧 | tieba f?kw=hdsky | 同上 | 同上 | 同上 |
| 饥荒吧 | tieba f?kw=饥荒 | 同上 | 同上 | 同上(2026.09.08 .27 接入, 待实测) |
| 战舰世界吧 | tieba f?kw=战舰世界 | 同上 | 同上 | 同上(2026.09.08 .27 接入, 待实测) |
| 深海迷航吧 | tieba f?kw=深海迷航 | 同上 | 同上 | 同上(2026.09.08 .27 接入, 待实测) |
| 缺氧吧 | tieba f?kw=缺氧 | 同上 | 同上 | 同上(2026.09.08 .27 接入, 待实测) |

> 步骤引擎(click_checkin/click/wait/check/function)自 v1 沿用; 通用步骤见旧版代码注释。

### 复杂站点步骤细节

- **PTTime**(落地页无反馈型, 2026.09.08): 点击签到按钮整页跳到 `attendance.php`, 该落地页**不显示**「签到详情/签到已得」类按钮或文案(判定会卡 pending)→ 改用**落地页标记** `landingCheckedInContent: '总签到记录'`: 签到成功落地后页内出现「总签到记录」记录表头(`<p class="mt10 fwb">`, class 可能改版变化故**纯文本匹配不绑 class**)即判 success; 落地页判定**不写死 attendance.php**——由签到按钮 href 自动推导(`isLandingPageOf`: 解析 `checkInSelector` 的 href / `attendanceUrl` 优先), 同款语义站(NexusPHP 落地无反馈)照配 `landingCheckedInContent` 即可, 落地页叫 attendance.php/sign.php/... 都能识别(非落地页不检测防误报)。
- **HDBao / MuXueGe**(跳页式): `attendanceUrl` 直达 `attendance.php` → 点「立即签到」提交 → 页面刷新显示结果; `alreadyPageCheck:true` 用整页文本判定已签; 兜底 `click_checkin` 带 `ignoreError`。
- **蜂巢**(对话框式, 2026.09.07 站方改版为 shadcn/Radix 风格): 签到按钮固定 `data-slot="sidebar-user-check-in"`, 已签时文案为「已签到」→ 按钮级已签检测自动命中(步骤 2 前置 detect 与步骤内 `click_checkin` 双保险), 不再依赖旧「文本含签到不含已」函数选择器; 未签时点同一按钮; 等待 5s(站点限制, 3s 不够) → `click_checkin` → 对话框「签到/关闭」两步降级为**可选**(`ignoreError` + 2s 超时, 改版后是否仍弹对话框待实测, 无则自动跳过)。**2026.09.08 实测点击成功后按钮即时变「已签到」→ 弃 `confirmManual`(否则成功却卡 pending 待人工确认), 改 `successDetect:[{type:'text', selector: 同按钮, text:'已签到', timeout:5000}]`** → 点击后按钮变已签即 success, 5s 未变走通用回退(再等 2.5s)后记 failed(不再卡 pending; 若响应慢于 7.5s 会误报 failed, 实测暂稳)。
- **MTeam**(无按钮访问即签型, 2026.09.08 接入): 站方新站 `kp.m-team.cc` **没有签到按钮/页面**, 登录态访问主页 `/index` 即自动完成当日签到(隐式签到)。→ 建模: **显式 `match` 只认 kp 子域 `/index`**(详情页/其它子域不触发, 防把浏览页误当签到动作、详情页无卡片误报 failed 污染当日状态); 无 `checkInSelector`/`alreadyCheckedInContent`(无按钮可检可点); 步骤仅 `wait 3000` 等 SPA 渲染; 成功靠 `successDetect:[{type:'func', fn: 轮询 .ant-card-head-title 含「站点数据」或「站點數據」(16s)}]`(antd Card 标题, 简/繁双文本防 locale; 未登录被重定向登录页 → 无卡片 → failed, 需登录后脚本才会成功)。
- **DigitalCore / HD-Space / Kufirc / 凤凰PT / Sportz Bar**(无按钮访问即签型, 2026.09.08 接入, 同 MTeam 模板): 各站同样**无签到按钮/页面**, 登录态访问首页即自动完成签到。DigitalCore(SPA, iconify 导航)成功特征 = `a[href="/alltorrents"]` 文本含 All Torrents; HD-Space(传统站)成功特征 = 整页文本含「Last access:」; Kufirc(Luminance 传统站, 未登录显示 Login/Reactivate)成功特征 = `a[href="/torrents.php"]` 文本含 Torrents; 凤凰PT(NexusPHP 传统中文站)成功特征 = `a[href="torrents.php"][rel="sub-menu"]` 文本含「种子」(相对路径 + rel 属性, 无前导斜杠); Sportz Bar(xbtitFM 传统站)成功特征 = `a.level1-a.drop[href="#"]` 文本含 Torrent Menu。→ `match` 均限首页(根路径; DigitalCore 另容 `/index`, 凤凰PT/Sportz Bar 另容 `/index.php`); 无按钮字段; 步骤仅 `wait 3000`; `successDetect` 轮询特征(16s)。未登录 → 重定向/无特征 → failed。
- **HHCLUB**(菜单展开 + 动态落地页型, 2026.09.08 接入): 签到入口藏在头像下拉菜单: 先点 `img#user-avatar` 展开 → 再点菜单内 `a[href*="attendance.php"]`(`[签到得憨豆]`)→ 跳 `attendance.php`; 落地页渲染当月日历 `<p id="date-display">`(内容为**动态 `yyyy-mm`** 如 2026-09, 静态 `landingCheckedInContent` 字符串匹配不适用)→ 用 `alreadyCheck` 自定义 async 函数(非 attendance.php 落地页不判; 落地页上 `#date-display` 含**动态算出的当月前缀**才命中)→ 挂统一 `detectAlreadyCheckedIn` → 被动/批量/落地结算三路径自动共用。**2026.09.08 实测普通触发偶发「未检测到成功特征」+「整流程超时」, 强制重试即成功 → 点击后导航不稳定(SPA 路由/慢导航/首访点击无效)→ 修复双保险**: ① 头像改**点-验-重试函数步骤**: 点 avatar 后轮询签到链接**可见**(`getClientRects()>0`——菜单链接可能常驻 DOM 但 display:none, 隐藏元素程序化 `.click()` 不触发导航), 未现则再点(点击是 toggle), 最多 3 次; ② 补 `successDetect:[{type:'func', fn: 轮询 location.pathname 变 attendance.php 且 #date-display 含当月(8s)}]` → SPA 路由/800ms 后才跳转(无 pagehide)时同页也能确认, 不再秒判 failed; 整页跳转仍走落地结算(两通道并存)。已签当日菜单内容不变(无按钮级已签特征)。
- **NodeLoc**(no-text 图标按钮站, 2026.09.08 接入): Discourse 论坛, 首页有「每日签到」真实按钮 `button.checkin-button`(class 含 `btn no-text btn-icon icon btn-flat checkin-button`, **内部只有 svg 图标无可见文本**, title/aria-label=「每日签到」)。点击后同页变化(class 加 `checked-in`、title/aria-label 变「您今天已经签到过了」)→ **引擎按钮级文本通道(click_checkin 已签判定 / checkInContent 文案匹配)依赖 visibleText, 对 no-text 按钮不可用** → 建模: ① 已签判定 = `alreadyCheck` 自定义函数(detectAlreadyCheckedIn 第 1 通道): 按钮存在且 class 含 `checked-in` 或 title/aria-label 含「已经签到过」→ 未登录无按钮返回 false; ② 点击 = steps 里 function 步骤(`waitForElement` 找到按钮, 已签 class/title 守卫后才 `click()`); ③ 成功后 = `successDetect:[{type:'func', fn: 轮询按钮 class 含 checked-in / title 已签(16s)}]`。显式 `match` 限首页根路径(排除话题/节点页——非首页可能有其它按钮或无此按钮, 防误点/无按钮误报 failed)。**P25 重现检测(.26 通用化改造后已纳入)**: no-text 无文本 → 引擎原按钮级重现(纯 visibleText 翻转判定)结构上排除 → 补 `checkInSelector` + `stateSignals`(载体无关信号): checked=[class `checked-in`, attr title/aria-label 含「已经签到过」], checkable=[attr title/aria-label 含「每日签到」] → `readEntryState` 直接读 class/attr, 已签/可签两态互斥(已签 title 不含「每日签到」, 可签 title 不含「已经签到过」)不误判。引擎文本站行为不变(旧字段自动翻译)。
- **HDHome**(已签后入口变纯文本型, 2026.09.19 接入): NexusPHP 传统站, 顶部信息栏未签时是
  `<a href="attendance.php" class="faqlink">签到得魔力</a>`, 已签后**该链接整个消失**, 同一位置换成魔力值行内纯文本
  `<font class="color_bonus">魔力值 </font>[<a href="mybonus.php">使用</a>]: 10.4&nbsp;(签到已得10)`
  → 已签信息**不在按钮上**(按钮级文案翻转通道失效), 但**页面仍留有已签文本**。
  → 建模(2026.09.19.3 定稿): 常规 `checkInSelector`/`checkInContent`(点击照旧; 文案为**无方括号**的
  「签到得魔力」, 与其它站的「[签到得魔力]」不同) + `alreadyCheckedInContent:'签到已得'` +
  **`alreadyPageCheck:true`**(整页文本) + **`alreadyCheck`** 自定义判定(同步, `alreadyCheckBudgetMs:0`)。
  **为什么不用 `noButtonMeansCheckedIn`**(曾用 .2 版试过, 用户反馈"不够保险"后回退): 它只回答
  「入口没了?」却回答不了「你登录了吗?」—— 未登录(cookie 过期)/维护页同样没有签到入口,
  会被判成已签 → **把漏登录报成"今日已成功"**(最坏的一类误报: 面板绿着, 当天根本没签)。
  → 换成 `alreadyCheck` 把两件事一起问:
  ```js
  alreadyCheck: () => {                                   // 同步, 声明 alreadyCheckBudgetMs: 0
      if (document.querySelector('a[href*="attendance.php"]')) return false;  // 入口还在 → 未签
      return !!document.querySelector('a[href*="mybonus.php"], font.color_bonus'); // 入口消失 + 登录态证据
  }
  ```
  登录态证据 = 魔力值信息栏(`a[href*="mybonus.php"]` 或 `font.color_bonus`), 它只在**登录后**的
  顶部信息栏出现。两通道互补: `alreadyCheck` 覆盖「已签但文本没渲染/文案改版」,
  `alreadyPageCheck` 覆盖「登录态证据选择器改版」; 都不命中(未登录/无入口)→ 落 `unconfirmed`
  (可重试、不计失败), **不会假成功**。
  点击 `attendance.php` 链接即由站方记账(落地页短暂停留后跳回首页), 无需额外步骤。
  仿真回归 `tests/ptautocheckin/sim-hdhome-pagetext.js` 四条断言: 已签零点击 / 点击落地结算 /
  入口消失无文本仍判已签 / **未登录页不得判已签**(最后一条是 `noButtonMeansCheckedIn` 的盲区)。
  > 踩坑: `alreadyCheckBudgetMs` 必须写在 `alreadyCheck` **8 行以内**(静态校验器的扫描窗口),
  > 函数体写太长会被判"未声明成本"(`check-ptac-budget.js` C2)。
- **贴吧吧页**: 归属由 `url` 的 `kw` 参数推导(`matchUnit` 逐参比较, 同域多个吧互不误签); 已关注吧才有签到按钮(未关注按失败提示)。

## 主流程(v2)

```text
boot()
├─ 非 iframe 且 DOM ready
├─ main()
│   ├─ 清理 stale 批量任务(调度页离开超 30min)
│   ├─ URL 带 ptacTask(后台任务标签): 校验任务存在且当前页命中任务当前 unit
│   │   → runBatchTabPage: 单站签到→写 GM 状态; 不推进任务、不渲染 UI; 直接 return
│   └─ 普通访问(含后台标签点击后跳转的落地页):
│       ├─ 有任务且心跳新鲜(调度中):
│       │   ├─ 当前页命中任务当前 unit(跳页落地页)→ settleUnitOnLandingPage 只检测写 success, 不推进
│       │   └─ 否则 → 被动模式(跳过任务当前位置站点, 防并行)
│       ├─ 有任务但心跳过期(调度者已离开)→ offerBatchResume: 横幅提示+恢复按钮(可选点); 当前页被动签到(跳过当前位置站)
│       └─ 无任务 → 被动模式: 命中 unit 逐个 runUnit(40s 整流程超时保护 + 内部预算 deadline)
└─ 发起页调度循环 runBatchScheduler: 逐个 GM_openInTab 后台标签 → 轮询 GM 状态(1s) + 读进度心跳
    → pending 观察 10s(有新鲜心跳则延后) / success·failed·skipped·unconfirmed 即结算
    → 20s 零进度提前判死站 / 60s 无回写写 unconfirmed 自动跳过 → 站间缓冲
    → 全部完成停在发起页弹完成面板; 心跳 hb 节流(4s)刷新
```

## 实测校准清单(并入正式版前逐项验证)

1. 贴吧：已签特征文案(现配 `连签`)、点击后成功文案(现配 body 含 `签到成功`)、未关注吧时按钮缺失的行为。**2026.09.08 .27 新增四吧(饥荒/战舰世界/深海迷航/缺氧, kw 为中文)** → 待实测: 各吧已关注态访问正常签到、吧间互不误签(`kw` 中文参数匹配、逐参比较正确)、未关注/未登录吧不误报。
2. 蜂巢：已签检测已启用(改版后按钮 `data-slot="sidebar-user-check-in"` 文案「已签到」, 实测命中); **2026.09.08 已实测点击后按钮即时变「已签到」→ 已弃 confirmManual 改 `successDetect`(按钮文案 5s 轮询)** → 待实测: 点击后按钮变已签稳定可靠(数日观察无 "未检测到成功特征" failed); 未签时点击后是否仍弹对话框(步骤已做可选兼容)。
3. HDBao / MuXueGe：`attendanceUrl` 落地页的整页已签文案检测是否误报/漏报(**全部站点默认关闭整页检测, 仅这两站显式开启**; 注意站内其他区域是否含 `签到已得` 字样)。
4. 其余 15 个 PT 站(普通按钮级自动签站, 不含蜂巢/HDBao/MuXueGe/MTeam/HHCLUB/DigitalCore/HD-Space/Kufirc/凤凰PT/Sportz Bar/NodeLoc 十一个特殊站与仅检测的 U2):按钮级已签检测为主(落地页/首页按钮文案变已签即可判定 success)——到站刷新两次验证: 首次触发签到, 10 分钟内第二次显示冷却跳过、但已签检测仍每次执行。若仍有站报"步骤失败: 等待元素...超时"且实际已签到, 按其页面 HTML 复查 `checkInSelector` 是否仍匹配(2026.09.07 已批量去掉 faqlink class 依赖)。BTSchool 特例(`noButtonMeansCheckedIn`): 未签页按钮在→能点; 已签页按钮消失→判 success, 需实测确认按钮确实随已签消失、且不会在无签到入口的其它页面误判。PTTime 落地页无反馈问题见上 `landingCheckedInContent`(已配 `总签到记录`, 待实测确认落地页文本稳定; 若其它站同问题参照配置)。
5. 批量调度(重点)：发起页停留不动, 后台标签逐个打开签到并自动关闭; 模拟单站断网/无法访问 → 50s 窗口后写 failed 自动跳过继续下一站(不再死链); 点击跳转型站落地页结算写 success; 调度中途关闭发起页 → 其它站横幅提示「恢复批量」一键续跑。
6. 深浅色主题切换、批量完成面板在任意站打开的一致性(完成后面板停留发起页, 其它站打开面板数据一致)。
7. 新增 UI 交互: 点击站点名 → 新标签打开该站; 失败且冷却中的站被排除且行有特殊样式(琥珀竖条+降透明度); 常规批量按钮右侧紧贴的 chevron 图标钮 → 点击从按钮行上方浮出琥珀色「强制批量签到」按钮(带 tooltip, 不占文档流), 点它把失败冷却站纳入并强制点击(注意反爬风险, 谨慎使用); 全部完成/批量中图标钮隐藏、批量按钮恢复完整圆角; 站点图标: 各站名前显示 favicon(路过收集 → 根路径兜底 → 加载失败隐藏, 不影响布局)。
8. match 字段删除回归: 全部站已删显式 `match`, 页面归属改由 `url` 推导(host 忽略 www 前缀 + url 带 query 时逐参一致); 验证各站被动命中、批量后台标签/落地页结算仍正确, 贴吧两吧靠 `kw` 参数区分正常。
9. 新增两站(2026.09.08 接入, 待实测):
   - MTeam: 登录态打开 `kp.m-team.cc/index` 实际 path 是否 `/index`(是否重定向到 `/`?若重定向需改 `match`); 页面渲染后「站点数据/站點數據」卡片是否 16s 内出现(SPA 慢则调大 func 轮询超时); 未登录时行为(应 failed 而非 success)。
   - HHCLUB: 头像点击后菜单是否即时展开(hover 则需改 mouseover); 点击签到链接后是否整页跳转 `attendance.php`; `#date-display` 文本是否为当月 `yyyy-mm` 且秒现; **当天已签后**再访问落地页的表现(若仍显示当月日历, 引擎每日只结算一次 success 无碍; 若菜单/入口随已签变化需补按钮级特征)。**2026.09.08 已加修复**(头像点-验-重试 + `successDetect` 同页确认 8s) → 待实测: 普通触发不再偶发「未检测到成功特征/整流程超时」(多触发几次批量/被动验证稳定), 若仍有零星失败看日志区分是 SPA 路径确认慢(调大 8s)还是点击无效(查头像菜单结构)。
10. FAB 皮肤: 头部「外观」展开四皮肤(变色/数字/信号灯/光环)切换即时生效并跨站记忆; 两态验证: 全部签到完毕 vs 有站未签(FAB 应一眼可辨), 面板汇总与角标数字一致; 深浅色下皮肤均清晰。
11. **跨天守卫(2026.09.08 .16 引擎行为)**: 页面 DOM 是加载时刻服务器状态的快照, 跨天后旧 DOM 的「今日已签到」等通用文案会把昨日已签误写为今日 success → 引擎在脚本注入时记录页面出生日期 `PAGE_BORN_DATE`, 凡基于本页 DOM 的当日判定/执行(runUnit / 落地结算 / startBatch / main)前查跨天, 跨天即整页刷新(仅一次防重入)重走主流程; 策略=仅执行前守卫, 纯挂机常驻页跨天不主动刷新。待实测: ① 23 点页面留到跨天后手动触发(被动/批量/恢复)→ 应刷新后按新一天状态检测/签到, 不误报昨日已签为今日; ② 批量后台标签恰在跨天窗口加载执行 → 刷新后重新执行该站, 调度窗口(50s)内正常结算; ③ 落地结算页跨天 → 刷新后重结算不采信旧 DOM。
12. **U2 仅检测型(2026.09.08 .17 接入, 待实测)**: 打开 u2.dmhy.org 首页: 未签时面板该站应显示「— / 需人工签到(验证码), 不自动签」且**无点击无冷却日志**(确认 `detectOnly` 生效); 手动在站内完成签到后再刷新/访问 → 检测到按钮文案「已签到」→ 转绿 success; 确认 U2 **不出现**在普通/强制批量列表; 检查 `a[href*="showup.php"]` 在首页真实存在且文案为「立即签到/已签到」(若按钮位置/文案不同需校正配置); FAB 剩余数应把未签的 U2 计入。
13. **签到按钮重现降级提醒(2026.09.08 .18/.19/.20, 待实测)**: ① 正常日零打扰——已签站反复刷新不应出现提醒(按钮为已签文案/消失), 状态保持已成功; ② 模拟「记录已签但按钮可签」(重置服务器态/另一账号未签)→ 触发一次提醒且**状态降级**: 面板该站 badge 变「失败-待确认」、今日成功数减一; 页面反馈= 琥珀警示 toast(渐变底白字)4s + 页面按钮琥珀描边呼吸+旁插「⚠ 按钮重现, 已标失败-待确认(仅提醒)」徽标 + 页面底部居中常驻横条列站名+按钮文案; FAB 琥珀角标 + 面板警示条/行标记亦应同步; ③ 同一站不同页面/多次访问不重复提醒也不重复降级(每天至多一次——降级后状态即 suspect, 不再满足降级条件, 幂等); **升级当天 .18/.19 已提醒过(on/off 残留)的站再触发重现也应降级**(降级闸门与 alert 写入解耦, 不依赖当天首写——修复实测「状态仍为已成功」); ④ 用户站内人工补签后再访问 → 页面确认已签 → 状态恢复「已成功」, 高亮/横条/角标全部消除; ⑤ 跨天后再访问 → 降级自然作废, 恢复正常未签流程(不再是 suspect); ⑥ 横条 ✕ 关闭仅隐藏本页会话, 刷新后若 alert 仍 on 应重新显示; ⑦ suspect 站**不出现**在普通/强制批量列表, 也不被自动点击(确认无点击/冷却日志); ⑧ 蜂巢(反向判定)、HDBao/MuXueGe(若首页链接随签到翻转即覆盖)实测按钮态; ⑨ 今日有 failed 站时 FAB 角标被失败红标占据属预期(页面级高亮/横条仍可见); ⑩ 后台标签/批量场景不误写提醒(批量本就只开未签站)。
14. **DigitalCore / HD-Space(2026.09.08 .21 接入, 待实测)**: ① 登录态打开 https://digitalcore.club/(确认实际首页 path 是根还是 `/index`, 若非两者需改 `match`)→ 面板该站应转绿 success(16s 内), 无点击/冷却日志(无按钮站, 访问即签); ② HD-Space 打开 https://hd-space.org/ → 整页「Last access:」出现即 success; ③ 未登录访问 → 应 failed(重定向登录页无特征), 登录后再试 success; ④ 详情页/种子列表/论坛等非首页不应触发(不写状态); ⑤ 次日刷新重复访问 → 各自再判 success(访问即签语义); ⑥ 两站不出现「按钮重现提醒」(无按钮站, P25 结构上排除, 无需测)。
15. **Kufirc(2026.09.08 .22 接入, 待实测)**: ① 登录态打开 https://kufirc.com/ → 面板该站转绿 success(16s 内): 导航链接 `a[href="/torrents.php"]` 文本含 Torrents 出现(确认实际首页 path 是根路径; Luminance 站登录态导航栏才有此链接, 若已登录首页无则需改特征/放宽 match); ② 未登录访问(显示 Login/Reactivate)→ 应 failed(无 Torrents 链接), 登录后再试 success; ③ 种子详情/浏览等非首页不触发(不写状态); ④ 次日刷新重复访问 → 再判 success(访问即签语义); ⑤ 不出现「按钮重现提醒」(无按钮站, P25 结构上排除)。
16. **凤凰PT(2026.09.08 .23 接入, 待实测)**: ① 登录态打开 https://pt.521.best/(确认实际首页 path 是根还是 `/index.php`, 若非两者需改 `match`)→ 面板该站转绿 success(16s 内): 导航链接 `a[href="torrents.php"][rel="sub-menu"]` 文本含「种子」出现(若 href 实际带前导斜杠或属性不同需校正 selector); ② 未登录访问(登录页)→ 应 failed(无该链接), 登录后再试 success; ③ 种子详情/浏览等非首页不触发(不写状态); ④ 次日刷新重复访问 → 再判 success(访问即签语义); ⑤ 不出现「按钮重现提醒」(无按钮站, P25 结构上排除)。
17. **Sportz Bar(2026.09.08 .24 接入, 待实测)**: ① 登录态打开 https://sportz247.bar/(确认实际首页 path 是根还是 `/index.php`, 若非两者需改 `match`)→ 面板该站转绿 success(16s 内): 导航链接 `a.level1-a.drop[href="#"]` 文本含 Torrent Menu 出现(若 class/结构不同需校正 selector); ② 未登录访问(Please Login)→ 应 failed(无该链接), 登录后再试 success; ③ 种子详情/浏览等非首页不触发(不写状态); ④ 次日刷新重复访问 → 再判 success(访问即签语义); ⑤ 不出现「按钮重现提醒」(无按钮站, P25 结构上排除)。
18. **NodeLoc(2026.09.08 .25 接入, 待实测)**: ① 登录态打开 https://www.nodeloc.com/ 首页 → 面板该站未签时应**点击**签到按钮(console 有「点击每日签到按钮」日志), 点击后 class 变 checked-in → 16s 内转绿 success; ② 已签当日再刷新/访问 → 应直接 success(alreadyCheck 命中 checked-in/标题已签), **无第二次点击**; ③ 未登录首页 → 无按钮 → failed(需登录); ④ 话题/节点详情等**非首页路径不触发**(match 限定根路径); ⑤ 已签态下按钮 title/class 如与假设不符 → 校正 `stateSignals` 信号与 `alreadyCheck`(两者判定同源: class `checked-in` / title·aria-label 含「已经签到过」); ⑥ 次日再访问 → 重新点击签到(新一天按钮复位); ⑦ 若按钮实际出现在非首页/全站 → 改 match 放宽并确认不会在无按钮页误报; ⑧ 若点击后按钮不是立即变 checked-in(有弹窗/跳转)→ 按实际反馈形态改成功检测。
19. **重现检测通用化(.26 引擎重构, 待实测)**: 引擎按钮重现检测从「纯按钮可见文本翻转」(P25)重构为**载体无关入口状态信号** `deriveStateSignals`/`readEntryState`——文本站由旧字段自动翻译(**行为应逐位一致, 零回归**), NodeLoc 等 no-text 属性/class 态站由显式 `stateSignals` 纳入。待实测: ① 文本站回归抽查(任意 2-3 个: 已签态反复刷新不误报重现; 模拟按钮重现 → 降级 suspect + 提醒; 补签后恢复)——旧行为不变; ② NodeLoc 首次获得重现通道: 已签当日若按钮**又呈可签态**(title=每日签到)→ 应降级 suspect + toast/高亮/横条; 若按钮仍呈已签(checked-in/title 已签到)→ 保持已成功零打扰; ③ NodeLoc 补签恢复: 人工补签后再访问 → 状态从 suspect 恢复 success + 提醒消除; ④ MTeam 系六站/HHCLUB 仍无重现语义(无入口/无已签基准), 不应出现提醒; ⑤ 蜂巢(反向常驻)、BTSchool(noButton)不受影响(回归抽查)。
20. **行内单站强制重试(.28, 待实测)**: ① 某站今日 failed(冷却中)→ 面板该站 badge「失败」hover 变「↻ 重试」; 点击 → 前台新标签打开且**不自动关闭**, 该站执行一次强制签到; ② 重试成功 → 状态变已成功, 原面板/新标签面板均转绿, badge 重试入口消失; 重试仍失败 → 保持失败 + 进入新一轮冷却, 可再次重试; ③ 同页连点(8s 防抖)与同站双标签并发(30s 锁)→ 仅执行一次, 后者 toast「已在进行中」; ④ 重试页停留后按 F5/刷新 → 不再重复强点(URL 参数已剥, 走普通访问, 冷却中则跳过); ⑤ 跳转型站点(点击签到跳落地页)→ 落地页自动结算, 不产生第二个重试页; ⑥ 批量调度进行中 → 该站行内重试被拒(批量优先); ⑦ suspect(失败-待确认)/已成功/待确认站 → 无重试入口; ⑧ detectOnly 站(U2)与 MTeam 系无按钮站 → 不出现重试入口。

21. **慢站误判修复 + 预算不变式 + 结果分类(P28, 2026.09.18 .1, 待实测)**: ① **冷却站不再被改写**——被动访问一个冷却中的站, 记录 `skipped(冷却中…)`, 40 秒后该站当日状态应**保持不变**(P28 前会在 25s 后被改成 `failed(整流程超时)`); ② 同理 U2(`detect_only`)、suspect(失败-待确认)访问后 40s 状态不被改写, suspect **不**被翻成 failed(否则会被「强制批量」重新纳入并重复点击); ③ **慢加载不再误判**——人为让某站元素 8s 后才出现(或 DevTools 网络限速), 签到应记 success 或至少 `unconfirmed`, 不再秒判 failed; ④ **面板新状态**: `unconfirmed` 显示青色「未确认」徽章, 汇总行出现「· N 未确认」, **不计入失败数**; 今日 failed 或 unconfirmed 的站 badge 悬停均可「↻ 重试」; ⑤ **预算自检**: 打开任意匹配站 console 应有一行 `预算自检: n/n 通过; 最紧 <站> …/40000ms(余量 …ms)`; 若某站越界或有 `function` 步骤没写 `budgetMs`, 应打出全量表格 + 红色 error(可用 `node tests/ptautocheckin/check-ptac-budget.js` 复核); ⑥ **死站加速**: 批量中模拟某站断网 → 应在 ~20s(`NO_PROGRESS_SKIP_MS`)内被判定并跳到下一站(不再是 60s); ⑦ **进度可见**: 批量进行中面板应显示当前站阶段(`等待签到按钮`/`已点击签到按钮`/`确认签到结果`)与已用秒数; ⑧ **回归抽查**: 跨天守卫(P23)、P25 重现降级/恢复、P27 文本站信号等价性行为不变。

22. **HDHome(2026.09.19 接入, 待实测)**: ① 登录态打开 https://hdhome.org/index.php 未签时 → 面板该站应
    自动点击签到链接并转绿 success(落地页跳回后确认已签); ② 当日已签再访问 → 直判 success 且**无点击**
    (console 日志 `检测到已签到(自定义判定)` 或 `(页面文案)`); ③ 批量模式该站正常参与并在 ~20s 内结算;
    ④ **已确认事实**(用户 2026.09.19 实测): 顶部签到链接文案是**无方括号**的「签到得魔力」; 签到入口
    **在所有页面都常驻**; ⑤ **待真站复核的关键一条**: 退出登录(或清 cookie)后访问该站, 页面应**没有**
    「魔力值 [使用]」信息栏 → 此时脚本**不得**判 success(应收敛为 unconfirmed/未确认, 面板不显示已成功)。
    这条正是 `noButtonMeansCheckedIn` 的盲区(见 P31), 仿真已覆盖(`?sim=hdhome-guest`), 真站需验证
    「登录态证据选择器(`a[href*="mybonus.php"]` / `font.color_bonus`)在未登录页确实不存在」;
    ⑥ 仿真回归: `node tests/ptautocheckin/sim-hdhome-pagetext.js`(四条断言, 需本机 Chrome/Edge)。

23. **主面板失焦自动关闭 + 重现不弹面板(2026.09.19.4, 待实测)**: ① 点 FAB 展开面板 → 点页面任意空白处 / 点站点自身元素
    → 面板应立即收起(不是"点第二下才关"); ② 面板内点「外观」切皮肤、点站点名开新标签 → 面板**不得**自己关掉
    (点在 UI 自身的豁免); ③ 展开面板后切到别的标签页再切回 → 面板已收起; ④ 批量进行中面板被收起后,
    FAB 旁的芯片仍在且「停止」可用; ⑤ 中断恢复横幅出现时(横幅带「恢复批量」钮)点页面别处 → 面板**不收起**,
    入口仍在; ⑥ 模拟「签到按钮重现」(已签记录 + 可签按钮)→ 只有琥珀 toast + 按钮描边 + 底部横条,
    **面板不弹出**(保持关闭态), 手动点 FAB 才看到警示条与「失败-待确认」; ⑦ 后台任务标签无 UI → 不呈现也不弹面板;
    ⑧ 静态回归: `node tests/ptautocheckin/check-ptac-panel.js`(失焦接线 A1–A5 / 重现不弹面板 B1–B3);
    ⑨ 浏览器回归: `node tests/ptautocheckin/sim-panel-autoclose.js`(真 Chrome 实测 ①②③④⑤ 五种情形)。
    **观测手法**(面板在 closed shadow 下拿不到元素): 用 `document.elementFromPoint` —— 它会进入 shadow
    树并把命中结果**重定向**成宿主 `#ptac-root-v2`, 于是"该坐标最上层是不是宿主" = 面板开合;
    探测点取 `innerWidth-60, innerHeight-104`(面板右下角内侧, 避开 FAB/芯片, toast 是 `pointer-events:none`)。
    headless 下切标签页**不一定**派发 window blur(无窗口焦点), 用例会自动退化为同源的 `window` blur 事件。

## 修改与扩展指南

1. **新增简单站**：`SITES` 加单站对象 + `@match` 域名; 参考同类型站复制字段。
2. **贴吧加吧**：`tieba` group 的 `units` 加一条(改 id/name/url 与 kw), `@match` 无需改。
3. **新增/修改 `function` 步骤或 `alreadyCheck`**：**必须**同时声明 `budgetMs` / `alreadyCheckBudgetMs`(同步判定写 `0`), 否则预算自检报 UNKNOWN(P28)。
4. **失效排查**：先看 console 日志(`未匹配`→match; `步骤失败`→选择器/文案; `未检测到成功特征`→successDetect/文案; `整流程超时`→步骤卡死; `状态写入被拒(单向阶梯)`→P28 阶梯拦截, 检查是否有代码在写不合法的状态迁移; `预算自检未通过`→该站超时预算越界)。
5. **改动后**：① 递增版本号; ② 跑 `node tests/ptautocheckin/check-ptac-budget.js`(必须全绿); ③ **动了面板/弹出 UI 或重现提醒的呈现时**, 再跑 `node tests/ptautocheckin/check-ptac-panel.js`(钉住「失焦自动关闭」与「重现不弹主面板」两条不变式); ④ 更新本文档与站点表(含上面「各 unit 实测预算」表)。
