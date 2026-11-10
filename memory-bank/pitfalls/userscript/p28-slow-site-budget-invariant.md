# 慢站被误判为「失败」的三重结构性来源: 可覆写的整流程超时 + 缺失的预算不变式 + 混用的结果语义
> 摘要: 慢站「经常失败/反馈慢」的三重结构性来源 + 缺失的预算不变式 + 混用的结果语义，2026-09-18 .1 修复。
> 触发: 排查经常失败, 改整流程超时, 配预算, 加新状态, 跑 check-ptac-budget

- **触发**: 用户报告 2026-09-18「PT 自动签到脚本用起来不太顺畅, 经常失败, 特别是网页加载慢一点就可能失败, 结果反馈慢」；典型日志组合: `步骤失败: 等待元素…超时` / `未检测到成功特征` / `整流程超时`。
- **判别**: 四条互相放大(前两条主因): ① **整流程超时定时器会覆写任何非 success 结果**(旧 `runUnitWithTimeout`, 25s): `Promise.race([runUnit, sleep(25s).then(...)])` 的失败方**既不 `clearTimeout` 也不检查 `runUnit` 是否已结算**, 超时分支只守 `!isSuccessToday` → 于是冷却 `skipped` / 仅检测 `detect_only` / 失败-待确认 `suspect` 都会在 25 秒后被改写成 `failed('整流程超时')`；次级后果(安全): `suspect` 被翻成 `failed` 后, `remainingCandidates` 的 suspect 排除失效 → 「强制批量」会把它重新纳入并**再次点击一个可能已签到的站**(风控风险)。② **引擎没有预算不变式**: 单站内部等待是**串行累加**的, 各站配置的超时可自由叠加, 旧 25s 上限下 NodeLoc 已**天生越界**(`waitForElement 10000` + `successDetect func 16000` + …≈ 26.8s)。③ **「慢」与「坏」共用同一个终态 `failed`**。④ **点击后观察窗固定 800ms 且只认 `pagehide`**(P22 的通用形态): 服务端 POST→302 首包 > 800ms 的慢站被当成「同页 AJAX」, 同页又零特征 → 秒判 failed。
- **处置**: T1 超时不再覆写: `runUnitWithTimeout` 加 `settled` 标志 + `clearTimeout`, 真超时与未捕获异常一律归 `unconfirmed`(未确认, 可重试)；T2 状态单向阶梯 `STATUS_TRANSITIONS`: 白名单式合法迁移, 核心安全性质 `success` 只能转 `suspect`、`suspect` 只能转 `success`、任何「有结论」的状态不得转回 `pending`(**注意 `skipped` 与初始态 `''` 必须能转 `pending`**)；T3 预算不变式 + 双校验(运行时 `auditUnitBudgets()` / 提交前 `node tests/ptautocheckin/check-ptac-budget.js`)；T4 结果分类: 新增独立状态 `unconfirmed`(面板「未确认」青色徽章 `.badge.unc`, 计入未完成、**不计入失败数**), 步骤抛错分类 = **错误消息含 `超时|timeout` → `unconfirmed`, 否则 `failed`**；T5 有界复检 `UNCONFIRMED_RECHECK_DELAYS = [5000, 12000]`(只检测不重点, 冷却期内绝不重复点击)；T6 点击后观察改事件驱动 + 有界窗口 `watchNavigation(ms)` 并发竞速 `pagehide` / `beforeunload` / **URL 变化(SPA 软导航)**, 窗口上限 `POST_CLICK_WATCH_MS = 4000`；T7 `waitForElement` 判可交互 + 超时自适应(`SLOW_PAGE_WAIT_BONUS_MS(10s)`, 全部等待经 `budgetedTimeout()` 收敛到剩余预算)；T8/T9 进度心跳 + `NO_PROGRESS_SKIP_MS(20s)` 零进度提前跳过；整流程 25s→40s。教训: **超时保护必须是「可取消的」**(任何 `race` 都要问: **败方赢了会写什么?**)；**「加个超时」不等于健壮性**, 必须有**预算不变式 + 自动校验**, 让不透明成本**必须声明**；错误状态要按「用户下一步该做什么」分类；**`Math.min`/`Math.max` 用错方向会静默吃掉等待**(正确 `Math.max(0, Math.min(step.ms, remainingBudgetMs()))`)；改判定/写入逻辑时**调用方的返回口径也要一起看**(写入后**回读状态**再结算)。

## P28. 慢站被误判为「失败」的三重结构性来源: 可覆写的整流程超时 + 缺失的预算不变式 + 混用的结果语义

**症状**(用户报告 2026-09-18): 「PT 自动签到脚本用起来不太顺畅, 经常失败, 特别是网页加载慢一点就可能失败, 结果反馈慢」。典型日志组合: `步骤失败: 等待元素…超时` / `未检测到成功特征` / `整流程超时`。

**根因**(四条互相放大, 前两条是主因):

1. **整流程超时定时器会覆写任何非 success 结果**(旧 `runUnitWithTimeout`, 25s)。`Promise.race([runUnit, sleep(25s).then(...)])` 的失败方**既不 `clearTimeout` 也不检查 `runUnit` 是否已结算**, 超时分支只守 `!isSuccessToday` → 于是 **冷却 `skipped` / 仅检测 `detect_only` / 失败-待确认 `suspect`** 这些「本已给出结论」的结果, 都会在 25 秒后被改写成 `failed('整流程超时')`。
   次级后果(安全): `suspect` 被翻成 `failed` 后, `remainingCandidates` 的 suspect 排除失效 → 「强制批量」会把它重新纳入并**再次点击一个可能已签到的站**(风控风险, 破坏 P5/P19/P25 语义)。
2. **引擎没有预算不变式**。单站内部等待是**串行累加**的(已签检测 → 步骤 → 点击后观察窗 → 复检), 各站配置的超时可自由叠加, 引擎从不校验它们装不装得进整流程预算。旧 25s 上限下 NodeLoc 已**天生越界**(`waitForElement 10000` + `successDetect func 16000` + …≈ 26.8s), 不需要任何额外延迟就会撞超时。
3. **「慢」与「坏」共用同一个终态 `failed`**。「等元素超时」「未检测到成功特征」「调度窗口耗尽」与「选择器不匹配」「未登录」都写 `failed`, 而 `failed` + 冷却会被普通批量默认排除 → 用户只能手动重试, 感知就是「经常失败」。
4. **点击后观察窗固定 800ms 且只认 `pagehide`**(P22 的通用形态): 服务端 POST→302 首包 > 800ms 的慢站被当成「同页 AJAX」, 同页又零特征 → 秒判 failed。

**修复**(2026-09-18 .1; 用户三项决策: `unconfirmed` 作为独立状态 / 自动重试**不允许**在冷却期内再点一次 / 整流程 25s→40s 接受):

- **T1 超时不再覆写**: `runUnitWithTimeout` 加 `settled` 标志 + `clearTimeout`; 主流程一旦给出结论, 超时分支不写任何状态。真超时与未捕获异常一律归 `unconfirmed`(未确认, 可重试)。
- **T2 状态单向阶梯 `STATUS_TRANSITIONS`**: 白名单式合法迁移, `writeStatus` 拒绝非法迁移并 `console.warn`。核心安全性质: `success` 只能转 `suspect`(P25 降级), `suspect` 只能转 `success`(页面确认); 任何「有结论」的状态(`success`/`suspect`/`failed`/`unconfirmed`)都不得转回 `pending`。**注意 `skipped` 与初始态 `''` 必须能转 `pending`**——`skipped` 不是结论(它=本次没动作: 冷却中/今日已完成), 否则「上次无动作 → 这次真点击」的路径会被阶梯拒掉。**阶梯不是越严越好**。
- **T3 预算不变式 + 双校验**: 见下「预算不变式」。
- **T4 结果分类**: 新增独立状态 `unconfirmed`(面板「未确认」青色徽章 `.badge.unc`; 计入未完成、**不计入失败数**); 只有「确定失败」才写 `failed`(选择器失效/文案不符/函数步骤抛错)。步骤抛错的分类口径 = **错误消息含 `超时|timeout` → `unconfirmed`, 否则 `failed`**。
- **T5 有界复检(只检测不重点)**: 观察窗内无结论 → 按 `UNCONFIRMED_RECHECK_DELAYS = [5000, 12000]` 各复检一轮(`detectAlreadyCheckedIn` + 限时 `detectSuccess(maxMs 4000)`), 把「响应慢于单次检测超时」的站从 failed 拉回 success。**冷却期内绝不重复点击**(用户决策); 每轮前先查剩余预算, 不够就放弃复检直接落 `unconfirmed`。
- **T6 点击后观察改事件驱动 + 有界窗口**: `watchNavigation(ms)` 并发竞速 `pagehide` / `beforeunload` / **URL 变化(SPA 软导航, 无 pagehide)** 与超时; `confirmAfterClick` 只被**有结论**的信号结束(命中成功特征 / 确认跳转), 窗口到时才进复检。窗口上限 `POST_CLICK_WATCH_MS = 4000`。旧实现固定 `sleep(800)` + 只认 `pagehide`, 慢站必然走错分支。
- **T7 `waitForElement` 判可交互 + 超时自适应**: 除存在性外判 `disabled` / `getClientRects().length`; 页面 `readyState !== 'complete'` 时基础超时 `+ SLOW_PAGE_WAIT_BONUS_MS(10s)`; 所有等待再经 `budgetedTimeout()` 收敛到本次执行剩余预算(`setRunDeadline` = 入口设 `now + UNIT_TOTAL_TIMEOUT - 余量`)。
- **T8/T9 进度心跳 + 零进度提前跳过**: 后台标签每阶段写 `ptac_progress_<uid>`(阶段 + 时间戳; 每次必写, 因调度页按 `ts > openedAt` 判新鲜), 调度页据此显示实时阶段与耗时, 并在 `NO_PROGRESS_SKIP_MS(20s)` 内零进度时**提前判定死站**(不再死等 50s 调度窗口)。
- **T10 待确认宽限跟随心跳**: 有新鲜心跳时延后结算, 避免把「正在确认中」误判为死站。

### 预算不变式(本项目新增的硬约束)

单站执行的**固定预留**:
```
AUDIT_RESERVE_MS = UNIT_TIMEOUT_MARGIN_MS(余量 5000)
                 + POST_CLICK_WATCH_MS(观察窗 4000)
                 + UNCONFIRMED_RECHECK_DELAYS[0] + RECHECK_DETECT_CAP_MS(首轮复检 9000)
                 = 18000ms
```
对每个 unit 要求(全部 ms):
```
detectMs(自定义 alreadyCheck 最坏成本) + stepsMs(各步骤声明超时之和) + AUDIT_RESERVE_MS <= UNIT_TOTAL_TIMEOUT(40000)
```
并保证 `UNIT_TOTAL_TIMEOUT + 结算余量 < PER_UNIT_TIMEOUT_MS`(整流程之后仍要留落盘 + 落地结算的时间)、`UNIT_TIMEOUT_MARGIN_MS >= POST_CLICK_WATCH_MS`(观察窗在内部 deadline 之外仍有硬等待, 余量要盖得住)、首轮复检必须留有预算(否则「慢站复检」这个救场机制根本不会执行)。

**不透明成本必须声明**: `click`/`click_checkin`/`check`/`wait` 的超时可静态求和, 但 `function` 步骤与自定义 `alreadyCheck` 内部是任意代码 → 必须显式写 `budgetMs`(步骤) / `alreadyCheckBudgetMs`(unit), **同步 DOM 判定写 `0`**。未声明即报 UNKNOWN 并判为不通过 —— 让「未知成本」这种无效状态无法悄悄存在。

**双校验入口(缺一不可)**:
- **运行时**: `auditUnitBudgets()` 在脚本启动时逐站求和(放在 `boot` 之外, 后台任务标签也会跑到)。全通过 → 打**一行摘要**(`预算自检: n/n 通过; 最紧 <站> <合计>/<上限>ms(余量 …)`), 便于察觉配置逐渐逼近上限; 有越界/未声明 → 打全量表格 + `console.error` 逐条报出。
- **提交前**: `node tests/ptautocheckin/check-ptac-budget.js`(零依赖)。校验 A 常量不变式 / B 阶梯结构(目标状态已知、无自环、`success` 出边 ⊆ `[suspect]`、`suspect` 出边 ⊆ `[success]`、无结论态不得转 `pending`、初始态可达 success) / C 配置区不透明步骤是否都声明了成本 / D 把源文件里的 `computeUnitBudget` 抽出来喂合成 unit 自测(防「自检本身写错于是永远显示通过」)。退出码 0/1。

**注意 / 边界**:
- **不给 `window` 挂调试入口**(`conventions.md` §8.2 禁止为诊断/测试把内部函数挂到 `window`)。需要逐站明细时: 跑静态校验脚本, 或让自检在违规时自动打全量表格。
- 服务器端响应慢于整个预算的极端情况仍会落 `unconfirmed`(不误报 success), 这是设计取舍。
- 复检**只复检不重点**: 用户明确要求「自动重试不允许在冷却期内再点一次」——重复点击是有风控风险的写操作(见 P5/P19), 复检只读状态、无副作用。
- `detectSuccess` 的 `func` 检测器自带内部轮询(最长 16s), 复检时必须用 `maxMs` 限时(`Promise.race([fn(), sleep(cap)])`), 否则单次复检就能把整流程预算吃光。

**教训**:
- **超时保护必须是「可取消的」**。`Promise.race` 的失败方若不 `clearTimeout` 且不检查对方是否已结算, 它就不是「保护」而是「延迟覆写器」。任何 `race` 都要问: **败方赢了会写什么?**
- **「加个超时」不等于健壮性**。超时值分散在几十处配置里自由叠加时, 必须有**预算不变式 + 自动校验**, 否则越界只会在生产环境以「偶发失败」的形式出现(NodeLoc 26.8s 越界 25s 却长期无人察觉)。让不透明成本**必须声明**, 是把「未知」从沉默变成报错的最小代价。
- **错误状态要按「用户下一步该做什么」分类**, 而不是按「代码在哪抛的」。`failed`(要人工排查) 与 `unconfirmed`(等一会儿重试就好) 混用会把「慢」永久呈现为「坏」。新增状态时必须同时定义**面板文案、统计口径(是否计入失败)、它在批量候选里的角色**——三者不一致就会出现「面板显示未确认、批量却当它失败排除」这类撕裂。
- **`Math.min`/`Math.max` 用错方向会静默吃掉等待**: 给 `wait` 步骤收敛预算时写成 `Math.min(step.ms, budgetedTimeout(step.ms))` 会把 3000ms 等待压到 `budgetedTimeout` 的 1000ms 下限; 正确是 `Math.max(0, Math.min(step.ms, remainingBudgetMs()))`。
- **改判定/写入逻辑时, 调用方的返回口径也要一起看**: 阶梯拒绝了 `writeStatus` 时, 调度页若仍按函数返回值结算, 就会出现「存储是 failed、面板显示未确认」的不一致 → 写入后**回读状态**再结算。


