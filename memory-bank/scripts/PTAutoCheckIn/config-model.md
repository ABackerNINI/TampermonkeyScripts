# 配置模型(group + unit 两级)与修改扩展指南
> 摘要: SITES/UNITS 字段语义、超时预算与状态阶梯、各 unit 实测预算表，以及新增站点/步骤/改动的扩展与回归固定动作
> 触发: 改配置字段, 加站点, 查超时预算, 递增版本号, 改动后回归

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

**双校验**: 运行时 `auditUnitBudgets()`(启动时逐站求和, 通过则打一行摘要, 违规打全量表格 + `console.error`); 提交前 `node tests/ptautocheckin/check-ptac-budget.js`(零依赖, 校验常量不变式 + 阶梯结构 + 不透明成本声明 + 自测 `computeUnitBudget`)。**不提供 `window` 调试入口**(`conventions/` §8.2)。

## 修改与扩展指南

1. **新增简单站**：`SITES` 加单站对象 + `@match` 域名; 参考同类型站复制字段。
2. **贴吧加吧**：`tieba` group 的 `units` 加一条(改 id/name/url 与 kw), `@match` 无需改。
3. **新增/修改 `function` 步骤或 `alreadyCheck`**：**必须**同时声明 `budgetMs` / `alreadyCheckBudgetMs`(同步判定写 `0`), 否则预算自检报 UNKNOWN(P28)。
4. **失效排查**：先看 console 日志(`未匹配`→match; `步骤失败`→选择器/文案; `未检测到成功特征`→successDetect/文案; `整流程超时`→步骤卡死; `状态写入被拒(单向阶梯)`→P28 阶梯拦截, 检查是否有代码在写不合法的状态迁移; `预算自检未通过`→该站超时预算越界)。
5. **改动后**：① 递增版本号; ② 跑 `node tests/ptautocheckin/check-ptac-budget.js`(必须全绿); ③ **动了面板/弹出 UI 或重现提醒的呈现时**, 再跑 `node tests/ptautocheckin/check-ptac-panel.js`(钉住「失焦自动关闭」与「重现不弹主面板」两条不变式); ④ 更新本文档与站点表(含上面「各 unit 实测预算」表)。
