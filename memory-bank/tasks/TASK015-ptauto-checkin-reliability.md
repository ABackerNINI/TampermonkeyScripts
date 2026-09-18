# [TASK015] - PTAutoCheckIn 慢站误判与结果反馈延迟优化

**Status:** In Progress
**Added:** 2026-09-18
**Updated:** 2026-09-18

## Original Request

> 目前 PT 自动签到脚本使用起来不太顺畅, 经常失败, 特别是网页加载慢一点就可能失败, 结果反馈慢, 请列一个优化计划, 注意使用相关 skills。

用户只要求**列计划**。本任务文件是方案记录，**未改动任何 `src/*.user.js` 代码**（遵守 `conventions.md` 第 0.1 节「计划不改码」）。

## 症状 → 诊断

三个症状对应 8 项发现，按「影响面 × 触发概率」排序。行号锚定 `src/PTAutoCheckIn.user.js`（**诊断时**版本 `2026.09.16.1`；实施后行号已整体位移，最新行号请以当前源文件为准）。

| ID | 级别 | 发现 | 锚点 |
|----|------|------|------|
| F1 | P0 | **25s 整流程超时定时器不可取消，会把任何非 success 结果覆写成 failed** | `:1584-1601` |
| F2 | P0 | **单站内部超时预算之和 ≥ 外层 25s 预算，慢站必然撞超时** | `:50`、`:74-78`、`:316`、`:327`、`:399`、`:452`、`:593`、`:692`、`:711` |
| F3 | P1 | **「慢」与「坏」共用同一个终态 `failed`，没有可重试语义** | `:1551-1555`、`:1578`、`:2721` |
| F4 | P1 | 点击后观察窗固定 800ms，且 `pagehide` 是唯一跳转信号 | `:47`、`:1559-1572` |
| F5 | P1 | `waitForElement` 只判「存在」，不判「可见/可点」 | `:873-897` |
| F6 | P2 | 状态写入无单向守卫，多标签可互相覆盖 | `:951-953`、`:1558`、`:1578` |
| F7 | P2 | 反馈链路慢：串行 + 固定宽限 + 无早期失败检测 | `:53`、`:54`、`:2645`、`:2693-2722` |
| F8 | P2 | 观测不足，无法定位「哪一步慢」 | 全文件离散 `console.log` |

### F1（最可能的主因，可稳定复现）

`runUnitWithTimeout` 用 `Promise.race` 包住 `runUnit`，但**失败方（`sleep(25s)`）不取消、也不检查 `runUnit` 是否已结算**：

```js
// :1584-1601
return await Promise.race([
    runUnit(unit, ctx),
    sleep(UNIT_TOTAL_TIMEOUT).then(() => {
        if (!isSuccessToday(unit.id)) {                    // 只挡住 success
            writeStatus(unit.id, 'failed', '整流程超时');   // 其余一律覆写
        }
        ...
    })
]);
```

后果链条：

1. 被动访问一个**冷却中**的站 → `runUnit` 在 `:1530-1533` 立即返回 `skipped('冷却中')` → **25 秒后**该站状态被写成 `failed('整流程超时')`。
2. 同理命中 `detect_only`（U2，`:1511-1514`）→ 25 秒后被翻成 failed，面板不再显示「需人工签到」。
3. 同理命中 `suspect`（P25 降级态，`:1488-1492`）→ 25 秒后被翻成 failed，**P25 的「失败-待确认」语义被摧毁**。
4. 次级后果（安全相关）：`suspect` 变 `failed` 后，`remainingCandidates` 的 suspect 排除（`:2617`）失效，「强制批量」会把它重新纳入并**再次点击一个可能已签到的站** → 风控风险，破坏 P5/P19 语义。

> 即：**任何一次慢、冷却或待确认的访问，都会在 25 秒后污染当日结果。**这是「经常失败」的最优解释。

### F2（为什么「网页加载慢一点就可能失败」）

外层预算 `UNIT_TOTAL_TIMEOUT = 25s`（`:50`），但内层超时是**逐站配置的、可叠加的**，引擎没有任何预算校验：

| 站型 | 内层构成 | 最坏合计 |
|------|----------|----------|
| 默认按钮站 | `waitForElement 5000`(`:74-78`) + `POST_CLICK_SETTLE 800` + 回退按钮文案 `2500`(`:1392`) | 8.3s |
| 蜂巢 | `wait 5000`(`:327`) + 对话框可选 `2000`×2(`:337`,`:357`) + `800` + `successDetect text 5000`(`:316`) + 回退 `2500` | 17.3s |
| HHCLUB | 头像点-验-重试 3×(2500+300)(`:620-621`) + `800` + `successDetect func 8000`(`:593`) | 17.2s |
| MTeam 系六站 | `wait 3000` + `800` + `successDetect func 16000`(`:399`,`:431`,`:478`,`:510`,`:541`,`:452`) | 19.8s |
| NodeLoc | `waitForElement 10000`(`:692`) + `800` + `successDetect func 16000`(`:711`) | **26.8s（已越界）** |

结论：**引擎没有「预算不变式」**。站点配置可以（且已经）把内层超时之和顶到接近甚至超过外层 25s；页面上任何一次额外延迟（PT 站常见的 CF 挑战、首包慢）就触发 25s → 落入 F1 的覆写。NodeLoc 甚至不需要额外延迟，天生就可能被自己的超时判死。

### F3（为什么修了超时还是会「经常失败」）

三个不同的原因都写同一个终态 `failed`：

- `executeStep` 等元素超时抛错 → `failed('步骤失败: ...')`（`:1551-1555`）
- `detectSuccess` 全通道未命中 → `failed('点击后未检测到成功特征')`（`:1578`）
- 调度窗口耗尽 → `failed('站点暂时无法访问或超时, 已跳过')`（`:2721`）

用户无法区分「稍后重试会好」与「要人工排查」，而且 `failed` + 冷却会**被普通批量默认排除**（`:2620`、`:1027-1030`），只能手动重试 → 感知就是「经常失败」。

> poka-yoke 视角：这是「错误状态可表达」——`failed` 同时承载瞬时与确定两类语义，任何一次误判都静默变成终态。

### F4 / F5（P22 的通用版本）

- `POST_CLICK_SETTLE = 800`（`:47`）：服务端 POST → 302 首包 > 800ms 的慢站会走错分支（当作同页 AJAX），同页零特征 → 秒判 `failed`（`:1578`）。P22 记录的 HHCLUB「普通触发失败、强制重试成功」就是此现象，当前缓解方式只是逐站打补丁（补 `successDetect` func 8s），**引擎层没有通用防御**。
- `waitForElement`（`:873-897`）只 `querySelector` 判存在。P22 已记录隐藏元素 `.click()` 无效，当前靠 HHCLUB 配置层的 `getClientRects()` 兜底（`:605`、`:620`）。慢页面/懒渲染下「在 DOM 但不可交互」会被当作就绪。

### F7（为什么「结果反馈慢」）

- 每站最坏 `PER_UNIT_TIMEOUT_MS = 50s`（`:53`、`:2693`）；pending 还要额外等 `PENDING_GRACE_MS = 10s`（`:54`、`:2706`）。
- 死站（DNS 失败 / 浏览器错误页）只能靠 50s 窗口兜底——后台标签页脚本没跑起来时**没有任何早期信号**（未使用 `GM_openInTab` 返回对象的 `onload`，`:2645`）。
- 27 站串行，最坏 ≈ 27 × 50s ≈ 22 分钟。
- 单站反馈粒度只有 `UI.showBatch({index,total,unitName})`（`:2675`），没有阶段（等元素/已点击/确认中）与耗时，用户看不到「卡在哪一步」。

## 实施结果（2026-09-18，用户三项决策后授权实施）

用户决策：① `unconfirmed` 作为**独立状态**（不复用 `pending`）；② 自动重试**不允许**在冷却期内再点一次；③ `UNIT_TOTAL_TIMEOUT` 25s → 40s **接受**。据此实施 P0/P1 全部 + P2 大部分（T12 跨域名并发未做，默认不做）。

**改动文件**：

| 文件 | 改动 |
|------|------|
| `src/PTAutoCheckIn.user.js` | 引擎改动（见下表），`@version` → `2026.09.18.1` |
| `tests/ptautocheckin/check-ptac-budget.js` | **新增**（零依赖 Node 静态校验器，见 T3/T14 说明） |
| `memory-bank/pitfalls.md` | 新增 **P28** |
| `memory-bank/scripts/PTAutoCheckIn.md` | 新增「超时预算与状态阶梯」章节 + 各 unit 预算表 + 校准项 21 |
| `memory-bank/systemPatterns.md` / `conventions.md` / `tasks/_index.md` / `activeContext.md` / `progress.md` | 同步 |

**引擎改动明细**：

| 项 | 实现 |
|----|------|
| T1 | `runUnitWithTimeout` 加 `settled` + `clearTimeout`；超时/异常一律归 `unconfirmed`，主流程已结算则超时分支不写状态 |
| T2 | 新增 `STATUS_TRANSITIONS` 白名单；`writeStatus` 拒绝非法迁移并 `console.warn`，返回布尔 |
| T3 | 常量：`UNIT_TOTAL_TIMEOUT=40s`、`UNIT_TIMEOUT_MARGIN_MS=5s`、`POST_CLICK_WATCH_MS=4s`、`UNCONFIRMED_RECHECK_DELAYS=[5s,12s]`、`RECHECK_DETECT_CAP_MS=4s`、`PER_UNIT_TIMEOUT_MS=60s`、`NO_PROGRESS_SKIP_MS=20s`、`SLOW_PAGE_WAIT_BONUS_MS=10s`；运行时 `auditUnitBudgets()` 启动自检 + `tests/ptautocheckin/check-ptac-budget.js` |
| T4 | `unconfirmed` 全链路：`writeStatus` 允许值、`countToday()` 增 `unconfirmed`、`statusMeta` 青色「未确认」徽章(`.badge.unc` / `--unc`)、面板汇总 `· N 未确认`、行内重试入口覆盖 failed+unconfirmed |
| T5 | `confirmAfterClick` 有界复检（只检测不重点），每轮前查剩余预算 |
| T6 | `watchNavigation(ms)` 竞速 pagehide/beforeunload/URL 变化；`confirmAfterClick` 只被有结论信号结束 |
| T7 | `waitForElement` 加 `needReady` 可交互判定 + 区分「存在但不可交互」的超时消息；`adaptiveElementTimeout` / `budgetedTimeout` / `setRunDeadline` 预算收敛 |
| T8 | 进度心跳 `ptac_progress_<uid>`（`setProgress`/`readProgress`/`clearProgress` + 阶段标签），`runBatchTabPage` / `executeStep` / `runUnitInner` 各阶段写入 |
| T9 | 调度循环读心跳：`openedAt` 起 20s 零进度 → 提前判死站（`noProgress`）；打开标签失败写 `unconfirmed` |
| T10 | pending 宽限跟随心跳（有 3s 内心跳则延后结算） |
| T11 | 面板批量进度显示阶段 + 已用秒数 |
| T13/T14 | `tests/ptautocheckin/check-ptac-budget.js` 校验 A 常量不变式 / B 阶梯结构 / C 不透明成本声明 / **D 抽出 `computeUnitBudget` 喂合成 unit 自测**（防自检本身写错） |

**T3 实施说明（计划与实现的偏差，已记录）**：原计划是「零依赖 Node 校验脚本（读配置算最坏预算）」。实施时判断**从 JS 源里解析 `SITES` 数组**（含箭头函数、正则、模板串）过于脆弱，改为**职责拆分**：
- **运行时 `auditUnitBudgets()`** 直接拿真实 `UNITS` 逐站求和 —— 零解析风险、永远与配置同步；
- **静态脚本**只做正则可安全提取的部分（常量、阶梯、声明检查）+ 自测运行时函数。

**新增约定**：不透明步骤（`function` 步骤 / 自定义 `alreadyCheck`）**必须**声明 `budgetMs` / `alreadyCheckBudgetMs`（同步判定写 `0`），未声明即判不通过 —— 让「未知成本」无法悄悄存在。已为 HHCLUB（`8400` / `3000`）与 NodeLoc（`10000` / `0`）补齐。

**各 unit 预算自检结果**（全部通过，上限 40000ms）：HHCLUB 34400（最紧）> 蜂巢 33800 > HDBao/MuXueGe 29500 > NodeLoc 28000 > 默认站/贴吧 23000 > 隐式签到站 21000。

**未做**：T12（跨域名有限并发 2 路）—— 计划默认不启用，需用户确认风控口径后再议。
T13/T14（纯函数抽取 + 场景矩阵回归）**已转入 [TASK016](./TASK016-test-infrastructure.md)**（测试基础设施），
静态校验器已迁入 `tests/`（原 `scripts/`，见 TASK016）。

---

## 原始优化计划（实施前记录，保留供对照）

分阶段，每阶段可独立发版；阶段内按编号顺序实施。

### P0 — 先封死误判（收益最大、改动最小）

| 编号 | 内容 | 关掉 |
|------|------|------|
| T1 | `runUnitWithTimeout` 增加 `settled` 标志 + `clearTimeout`；超时分支仅在「本次执行未结算」时生效，且**不得覆盖** success / suspect / skipped | F1 |
| T2 | `writeStatus` 加**单向阶梯守卫**：当日 `success` 不可被 `failed`/`pending` 覆盖（除非显式 `force`）；`suspect` 只能被 `success` 覆盖；`failed` 可被 `success`/`suspect` 覆盖 | F1、F6（含跨标签覆盖、P25 被翻） |
| T3 | 建立**预算不变式**：每 unit「内层超时之和 + 余量(≥5s) ≤ `UNIT_TOTAL_TIMEOUT`」；外层提到 40s（或按 unit 覆盖 `unitTotalTimeoutMs`），并保证 `UNIT_TOTAL_TIMEOUT + 结算余量 < PER_UNIT_TIMEOUT_MS(50s)`；附零依赖 Node 校验脚本（读配置算最坏预算，越界即报错） | F2 |

> T1 + T2 建议放同一次提交，因为它们共同封死同一类问题。T2 是 poka-yoke 的 rung 1（让非法状态迁移**不可表达**），一次修掉一类，而非只修这一个 case。

### P1 — 把「慢」从「坏」里拆出来

| 编号 | 内容 | 关掉 |
|------|------|------|
| T4 | 结果分类：终态拆为 `success` / `failed(确定)` / `unconfirmed(未确认, 可自动重试)` / `skipped`。「等元素超时」「未检测到成功特征」「调度窗口耗尽」归 `unconfirmed`（保留原 msg 供排查）；「选择器不匹配」「未登录」「无按钮」才归 `failed`。面板对 `unconfirmed` 显示「未确认 · 可重试」，不计入失败数、计入未完成 | F3 |
| T5 | 同页有界自动重试：`unconfirmed` 时先在**同页内**重试确认环节（如 +5s / +15s 各一次），仍不成才落终态。默认**不重复点击**（风控优先），仅重试「等待/确认」 | F3、F4 |
| T6 | 点击后观察改为**事件驱动 + 有界窗口**：同时监听 `pagehide` / `beforeunload` / URL 变化 / 配置的 `successDetect` 轮询，命中任一即提前结束；窗口上限 3–5s（可配 `postClickSettleMs`） | F4 |
| T7 | `waitForElement` 增加 `ready` 判定（`getClientRects().length > 0` + 非 disabled），「存在但不可交互」给明确日志；点击后校验是否产生变化，无变化重试一次 | F5 |

> ⚠️ T4/T5 与 P19 的既有结论有张力（蜂巢：宁 failed 可重试/可查，不卡 pending）。本方案**不改点击语义、不回到「等人工确认」的 pending**，只改终态命名 + 加自动复检。口径需用户确认（见下）。

### P2 — 反馈加速

| 编号 | 内容 | 关掉 |
|------|------|------|
| T8 | 后台标签进度心跳 `ptac_progress_<uid>`（阶段 + 时间戳），调度页据此显示实时阶段与耗时 | F7、F8 |
| T9 | 早期失败检测：`GM_openInTab` 返回对象的 `onload` + 「15s 内无进度心跳」双信号 → 死站耗时从 50s 降到 ~15s | F7 |
| T10 | `PENDING_GRACE_MS` 从固定 10s 改为「跟随进度心跳/落地页信号」，有信号即提前结算；轮询在有心跳时保持 1s、无心跳时退避，减少 GM 写入 | F7 |
| T11 | 面板呈现：批量中每行显示阶段 + 已用时长；FAB 角标显示 `i/n`；单站结算即时 toast | F7 |
| T12（可选） | **不同域名**有限并发 2 路（同域名严格串行 + 冷却）。默认**不启用**，需用户确认风控口径 | F7 |

### P3 — 可测性与回归防护（应用 `test-gap-audit`）

| 编号 | 内容 |
|------|------|
| T13 | 抽纯函数：状态机守卫(T2)、预算计算(T3)、`deriveStateSignals`/`readEntryState`(`:1262-1339`)、超时分类(T4) → 无 DOM 依赖，可被本地 Node 脚本直接断言（符合 `conventions.md` §8.1 纯函数化；**不留测试后门**，见 §8.2） |
| T14 | 场景矩阵回归脚本（零依赖 Node + 极简 DOM stub / fixture） |
| T15 | 观测日志规范：统一 `[站点] 阶段=<...> 耗时=<ms>` 行，便于按站点回报「哪一步慢」，也为后续调参提供依据 |

T14 场景矩阵（每项都对应一个已发现缺陷，防止重构回归）：

1. **慢加载**：元素 8s 才出现 → 断言终态**不是** `failed`（F2/T4）
2. **冷却 / 仅检测 / suspect 访问** → 断言 25s 后状态**未被改写**（F1 回归，T1/T2）
3. **双标签并发**：A 页写 `failed`、B 页写 `success` → 断言 success 不被覆盖（F6，T2）
4. **慢跳转**：点击后 1.5s 才 `pagehide` → 断言不误判 failed（F4，T6）
5. **预算不变式**：遍历所有 unit，最坏内层预算 ≤ 外层（F2，T3）
6. **既有行为基线**：跨天守卫、P25 重现/恢复、`deriveStateSignals` 文本站等价性（防重构回归，对应 P23/P25/P27 的验收标准）

### 收尾（每次改动都要做）

- `@version` 递增为 `2026.09.18.N`（跨天重置 N，见 P20）
- `memory-bank/scripts/PTAutoCheckIn.md`：站点表 + 新增「超时预算表」章节
- `memory-bank/pitfalls.md`：新增 **P28（慢站误判 / 25s 定时器覆写 / 结果分类）**
- `memory-bank/tasks/_index.md`、`activeContext.md`、`progress.md` 同步
- 全部与代码**同次提交**；提交信息按 `conventions.md` §1 格式（首行概括 + 正文分条）

## 验收标准

1. 被动访问一个冷却中的站，25 秒后其当日状态**保持不变**（不再是「整流程超时」）。
2. 人为把某站 `checkInSelector` 延时到 8 秒才出现，签到仍记成功（不再误判 failed）。
3. 所有 unit 的最坏内层预算 ≤ 外层预算（校验脚本通过）。
4. 双标签并发场景下 `success` 不被 `failed` 覆盖。
5. 死站从「50 秒后判失败」缩短到「≤15 秒判失败」。
6. 上述 T14 场景矩阵全部通过，且 P23/P25/P27 既有行为无回归。

## 需要用户决策（已于 2026-09-18 全部答复）

1. **T4**：`unconfirmed` 是否新增为独立状态？ → **独立状态**（不复用 `pending`）。已实施。
2. **T5**：自动重试是否允许在冷却期内再点一次？ → **不允许**（只复检确认环节，风控优先）。已实施。
3. **T3**：`UNIT_TOTAL_TIMEOUT` 25s → 40s 是否接受？ → **接受**。已实施。
4. **T12**：跨域名有限并发是否要做？ → **暂不做**（保留为待议）。

## 风险与边界（明确不做的事）

- **不引入「到达落地页即成功」的宽判定**——P18 已否决，会误报。
- **不降低点击频次保护**：冷却、单站单次点击、同域名串行、`forceCooldown` 语义全部保留。
- **服务器端响应慢于预算的极端情况**仍会落 `unconfirmed`（不会误报 success），这是设计取舍。
- **T14 只覆盖引擎逻辑**：站点选择器与文案仍需按 `scripts/PTAutoCheckIn.md` 的 20 项校准清单在真实页面验证，测试环境无法替代。
- 本计划不包含站点覆盖扩展（见 TASK004）与 UI 皮肤相关改动。

## Skills 应用说明

- **`poka-yoke`**（防错设计）：用「错误发生时会发生什么（Axis 1）+ 装置如何察觉（Axis 2）」给每条发现定级，并要求每条给**具名装置**而非「加个校验」。产出：T2 的**单向状态阶梯**（rung 1，让非法迁移不可表达）、T3 的**预算校验脚本**（rung 2/3，越界即报错而非靠人记）。
- **`test-gap-audit`**（测试缺口审计）：本项目无测试框架，故按其原则产出「行为覆盖而非行覆盖率」的场景矩阵（T14），并明确区分**已确认缺口**（F1 有稳定复现路径）与**推断缺口**（F5 需实测确认）。
- **`docs-sync-audit`**（文档同步审计）：用于「收尾」小节，确保改动后 `memory-bank/` 与代码同次提交（对应 `conventions.md` §0.4）。

## Progress Tracking

**Overall Status:** In Progress - 90%（P0/P1 全部 + P2 大部分已实施并自检通过；**待用户实测校准 + 审核后提交**；T12 与 P3 的纯函数抽取未做）

### Subtasks

| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 15.1 | T1 修整流程超时定时器覆写 | Completed | 2026-09-18 | `settled` + `clearTimeout`；超时归 `unconfirmed` |
| 15.2 | T2 `writeStatus` 单向阶梯守卫 | Completed | 2026-09-18 | `STATUS_TRANSITIONS` 白名单 + 拒绝时 `console.warn` |
| 15.3 | T3 预算不变式 + 双校验 | Completed | 2026-09-18 | 常量提升 + 运行时 `auditUnitBudgets()` + `tests/ptautocheckin/check-ptac-budget.js`（含自测 D 段） |
| 15.4 | T4 结果分类（`unconfirmed`） | Completed | 2026-09-18 | 独立状态（用户决策）；徽章/汇总/重试入口全链路 |
| 15.5 | T5 同页有界复检（不重点） | Completed | 2026-09-18 | `[5s, 12s]` 只检测不点击；每轮前查预算 |
| 15.6 | T6 点击后事件驱动观察窗 | Completed | 2026-09-18 | `watchNavigation` 竞速 pagehide/beforeunload/URL 变化 |
| 15.7 | T7 `waitForElement` 可交互判定 | Completed | 2026-09-18 | `needReady` + 慢页面超时自适应 + 预算收敛 |
| 15.8 | T8-T11 进度心跳 / 早期失败 / 面板呈现 | Completed | 2026-09-18 | 心跳 + 20s 零进度判死站 + 阶段/耗时显示 |
| 15.9 | T13-T14 纯函数抽取 + 场景矩阵回归 | Partial | 2026-09-18 | 已做校验器 D 段（`computeUnitBudget` 合成用例自测）；**完整场景矩阵与纯函数抽取已转入 TASK016**（测试基础设施） |
| 15.10 | 版本号 + 知识库同步（含新 P28） | Completed | 2026-09-18 | `2026.09.18.1`；P28 + 脚本文档 + 各核心文件；**待用户审核后提交** |
| 15.11 | 真实站点实测校准 | Pending | - | 见 `scripts/PTAutoCheckIn.md` 校准项 21（8 项） |
| 15.12 | T12 跨域名有限并发 | Pending | - | 计划默认不启用，待用户定风控口径 |

## Progress Log

### 2026-09-18

- 用户报告：脚本经常失败、网页加载慢一点就可能失败、结果反馈慢，要求列优化计划。
- 完成诊断：读 `memory-bank/` 全部核心文件 + `src/PTAutoCheckIn.user.js` 引擎关键路径，产出 8 项发现（F1–F8），其中 F1（25s 定时器覆写非 success 结果）与 F2（内层预算 ≥ 外层 25s，NodeLoc 26.8s 已越界）为 P0。
- 应用项目内 skills（`poka-yoke` / `test-gap-audit` / `docs-sync-audit`）形成分阶段计划（P0–P3）与场景矩阵验收标准。
- **未改动任何代码**；本文件为方案记录，待用户审核并授权后再实施。
- 用户答复三项决策（`unconfirmed` 独立状态 / 冷却期内不重复点击 / 40s 接受）并授权实施。
- 实施 P0/P1 全部 + P2 大部分：引擎改动 11 处（T1–T11），新增 `tests/ptautocheckin/check-ptac-budget.js`，为 HHCLUB/NodeLoc 补 `budgetMs`/`alreadyCheckBudgetMs`。
- `node --check` 语法通过；静态校验器全部不变式通过（A 6 项 / B 6 项 / C 2 项 / D 2 项）；预算自检 32 站全通过，最紧 HHCLUB 34400/40000ms。
- 实施中发现并自纠 5 处设计缺陷：`setProgress` 同阶段不写导致心跳 `ts` 陈旧（改为每次必写）、`wait` 步骤 `Math.min` 方向错把 3000ms 压到 1000ms 下限、`func` 检测器复检需 `maxMs` 限时否则吃光预算、阶梯拒绝写入后调度页结算与存储不一致（改为写入后回读）、`window.__ptacAuditBudgets` 调试入口违反 `conventions.md` §8.2（已移除，改为启动打一行摘要 + 违规打全量表格）。
- 知识库同步：新增 P28；`scripts/PTAutoCheckIn.md` 新增「超时预算与状态阶梯」章节 + 各 unit 预算表 + 校准项 21；`systemPatterns.md`/`conventions.md`/`tasks/_index.md`/`activeContext.md`/`progress.md` 同步。
- **已提交**（用户授权「提交」）：`ebb06bb`（分支 `dev`，未 push）。提交前 `@version` 已为 `2026.09.18.1`。
- **待真实站点实测校准（校准项 21，8 项）**——静态自检已全绿，但引擎行为仍需在浏览器验证；发现问题再迭代提交。
