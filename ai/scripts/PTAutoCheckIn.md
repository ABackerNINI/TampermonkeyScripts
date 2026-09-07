# PTAutoCheckIn-v2.user.js — PT 多站点自动签到 v2

> 源文件：`src/PTAutoCheckIn-v2.user.js` ｜ 版本 `2026.09.07.6`(升级时同步更新)
> ⚠️ 状态：**v2 重构版, 待实测校准后并入正式版**。原 `src/PTAutoCheckIn.user.js`（v2026.08.30.1）暂保留；并入时改回 `@name PTAutoCheckIn` 并递增版本号, 删除旧文件。

## 功能概述

覆盖 18 个 PT 站 + 百度贴吧(**多吧**, 每个吧为独立签到单元)。双模式：

1. **被动模式**：访问匹配站点自动签到(同 v1)。
2. **主动批量模式**：点击右下角悬浮按钮 → 面板「批量签到」→ **发起页常驻**, 由调度循环依次用 `GM_openInTab` 在**后台标签**打开各站执行签到, 发起页轮询 GM 状态逐个推进, 全部完成后停在发起页弹出完成面板。
3. **结果查看**：FAB 面板展示**当日全量结果**(成功/失败/待确认/跳过), GM 存储跨域共享 → 任意已匹配站点打开面板看到的都是同一份数据。

核心设计不变：站点配置数据 + 通用执行引擎。**签到原子单位从「域名」细化为「页面入口 unit」**（解决贴吧多吧）。

## 脚本元数据要点

- `@run-at document-start`；`@grant GM_getValue / GM_setValue / GM_log / GM_openInTab`（GM 存储**按脚本共享、跨域可读**——跨站状态/任务依赖此特性; `GM_openInTab` 用于批量在后台标签打开各站, 不受弹窗拦截）。
- `@name PTAutoCheckIn-v2`：与旧版共存, 避免 Tampermonkey 同名冲突(存储/更新互不干扰)。
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
| `url` / `attendanceUrl` | 批量导航目标(后者可选, 直达签到/结果页) |
| `match` | `RegExp` 或**函数**(传 href), 决定页面归属 |
| `checkInSelector` / `checkInContent` | 签到按钮定位与文案校验 |
| `alreadyCheckedInContent` | 已签到特征文本; **检测主通道=按钮文案**——每次访问页面都检测, 不受 10 分钟冷却限制(冷却只限"是否点击", 不限"是否检测") |
| `alreadyCheck` | 可选函数, 自定义已签到判定 |
| `noButtonMeansCheckedIn` | true: **找不到签到按钮即视为已签**(已签后签到按钮消失的站, 如 BTSchool); 仅当按钮确实会因已签而消失时启用 |
| `alreadyPageCheck` | **默认 false(全部站点默认关闭整页文本检测**, 防页面其它区域误报); 仅特殊站显式 true(如跳页型落地页无签到按钮的 HDBao/MuXueGe) |
| `successDetect` | 点击后成功检测(同页 AJAX 场景) `[{type:'url'\|'text'\|'func',...}]`, 任一命中即成功 |
| `confirmManual` | true: 无可靠成功特征, 点击后记 pending 待人工确认 |
| `batchDelayMs` | 批量模式本站处理完后、跳下一站前的缓冲(贴吧吧间 3s 防风控) |
| `enabled` | 是否参与批量 |
| `steps` | 步骤数组, 缺省 `[CLICK_CHECK_IN]` |

## 存储与状态层(GM, key 前缀 `ptac_`)

| key | value | 用途 |
|-----|-------|------|
| `ptac_status_<unitId>` | `{date:'YYYY-MM-DD', status, msg, ts}` | 当日结果(面板展示), status ∈ success/failed/pending/skipped |
| `ptac_cooldown_<unitId>` | 上次触发时间戳 | 10 分钟间隔 |
| `ptac_task` | `{taskId, list:[unitId...], index, startedAt, hb}` | 批量任务(调度心跳 `hb` 由发起页定时刷新, 其它页面据此区分"调度中/已中断") |

## 单 unit 判定优先级(防封号核心)

```
1. 当日 success                    → skipped(今日已完成)
2. 已签到检测 —— 每次访问都执行, 不受冷却限制(检测≠点击, 无封号风险):
   按钮文案命中 / (noButtonMeansCheckedIn 站)找不到签到按钮 / (仅显式 alreadyPageCheck 的站)整页文案命中 → success
3. 上次 pending 未确认且未过冷却、且第 2 步仍无已签证据 → failed(上次点击确实未生效)
4. 冷却中(<10min)                  → skipped(冷却只防重复点击, 不阻止检测)
5. 执行 steps                      → 点击前先写 cooldown(即使跳页丢页面, 冷却也已落盘)
   → 点击后落盘 pending → POST_CLICK_SETTLE(0.8s) 观察:
      · 发生 pagehide(整页跳转) → 保持 pending 返回; 落地页结算判定(已签→success)
      · 同页存活 → successDetect 命中→success; confirmManual→pending; 否则→failed
```

> 与 v1 关键差异：间隔 key 从「origin+pathname」改为**按 unitId**; 冷却命中时**跳过**而非 sleep 等待(批量场景需要); 「当日成功」由显式状态保证(需求: 须检测到特定成功条件才算成功)。

## 批量任务引擎(常驻发起页 + 后台标签串行调度)

> 背景：v2026.09.07.2 的"接力导航"(单标签串行 `location.replace`)在下一站**网络层失败**(浏览器错误页无脚本运行)时会断链, 只能等 30min stale 清理。v2026.09.07.3 改为**发起页常驻 + 后台标签串行调度**, 断链被单站超时自动跳过吸收。

1. 面板「批量签到」→ 候选 = enabled 且非今日成功且非未过期 pending → 建 `ptac_task`(含心跳 `hb`)。**发起页不再跳转**, 直接进入调度循环 `runBatchScheduler`。
2. 调度循环逐个站：`GM_openInTab(unit.url + '?ptacTask=taskId', { active:false, insert:true })` 在**后台标签**打开目标站(记录打开前该站状态 `ts`)。后台标签页 `runBatchTabPage` 校验任务与页面归属后执行单站签到, **只写 GM 状态, 不推进任务、不渲染 UI**。
3. 发起页轮询(1s)：读到该站"今日且比打开前新"的状态即结算 —— pending 先观察 **10s**(`PENDING_GRACE_MS`)等落地页改写; success/failed/skipped 直接结算。
4. **落地页结算**: 后台标签点击签到触发整页跳转(如 NexusPHP attendance.php, URL 无 ptacTask)后, 落地页以"普通访问"加载: 若任务在调度中(心跳新鲜)且当前页命中任务当前 unit → `settleUnitOnLandingPage` **只检测已签并写 success(不推进任务)**, 由调度页轮询读到后推进; 未命中已签不改写(保留 pending 观察)。
5. **超时自动跳过(断链兜底)**: 单站调度窗口 50s(`PER_UNIT_TIMEOUT_MS`)内始终无回写(站点无法访问/页面加载失败/脚本未运行)→ 写 `failed('站点暂时无法访问或超时, 已跳过')` 并自动推进下一站 —— 被跳过的站记 failed, 下次批量天然重试。
6. 每站处理完按 `unit.batchDelayMs` 倒计时(芯片显示, 可点停止取消); 后台标签结算后即 `tab.close()` 关闭。
7. 全部处理完：清任务 → **停在发起页弹出完成面板**; 可随时取消(单站窗口内亦可)。
8. **中断恢复**: 调度页被关/崩溃后, 心跳 `hb` 15s(`HEARTBEAT_FRESH_MS`)内不再刷新; 30min(`TASK_STALE_MS`)内任意匹配页检测到过期心跳 → 横幅「检测到中断的批量任务(第 n/N 站)」+「恢复批量」按钮一键续跑(不自动重签, 防误触发)。30min 后视为 stale 自动清理。
9. 安全与兜底: 任务只含 unitId 列表(不含任何凭据); 打开的后台标签 URL 均来自配置白名单; 单 unit 执行有 25s 整流程超时保护; 调度中其它页面命中任务当前站点时只结算/跳过被动点击, 防并行重复触发。
10. 实现要点: `GM_openInTab` 需 `@grant`(更新脚本时 Tampermonkey 会弹新增权限确认, 须接受); 后台标签为后续打开, 无用户手势, `window.open` 会被弹窗拦截故必须用 `GM_openInTab`。

## FAB / 面板 UI

- Shadow DOM 注入, 样式完全隔离; CSS 变量 + `@media (prefers-color-scheme: dark)` **跟随系统深浅色**。
- FAB(右下角, 渐变圆钮, 带今日成功数角标)→ 点击展开面板：今日汇总 + 分组列表(多吧 group 有组头)+ 每行状态徽章/msg/时间 + 「批量签到(剩余 n)」按钮。
- 批量进行中(发起页)：FAB 旁芯片与面板内进度条显示 `批量 i/n · 正在处理/倒计时`, 可随时停止; **后台任务标签不注入 FAB/UI**(避免后台闪烁); 中断恢复横幅在发起页以外任意匹配页显示(「检测到中断的批量任务」+「恢复批量」按钮)。
- 面板数据读 GM 存储, 任何已匹配站打开均为同一份(满足「任意已添加网站查看完成面板」)。

## 已有站点一览(18 PT + 贴吧 2 吧)

> 2026.09.07 实测各站签到链接普遍不再带 `faqlink` class, 故所有 PT 站 `checkInSelector` 一律去掉 class 依赖(仅按 `href*="attendance.php"` 定位); PTTime 保留 `a.fcb`、Cyanbug 保留 `a.nav-btn`(非 faqlink, 实测仍有效)。站点 `url` 同步更新为当前有效入口(大多去掉 `www.` 前缀, 与 `match` 保持一致)。蜂巢为 shadcn/Radix 改版站(签到是按钮不是 attendance 链接), 例外按 `data-slot` 定位, 见下表。

| unit | 域名/kw | 入口选择器 | 签到文案 / 已签特征 | 备注 |
|------|---------|-----------|-------------------|------|
| 躺平 | tangpt.top | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| PTTime | pttime.org | `a.fcb[href*="attendance.php"]` | `签到领魔力` / `签到详情` | — |
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
| CrabPT | crabpt.vip | `a[href*="attendance.php"]` | `[签到得蟹币]` / `签到已得` | — |
| Cyanbug | cyanbug.net | `a.nav-btn[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| HDBao | hdbao.cc | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | 跳页; `attendanceUrl` 直达; `alreadyPageCheck:true` |
| MuXueGe | pt.muxuege.org | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | 同上 |
| 蜂巢 | pting.club | `button[data-slot="sidebar-user-check-in"]` | — / `已签到` | 对话框式(改版后已签检测启用, 对话框步骤可选); `confirmManual:true` |
| pt吧 | tieba f?kw=pt | `.button-wrapper.operate-btn.follow-sign` | `签到` / `连签` | `batchDelayMs:3000` |
| hdsky吧 | tieba f?kw=hdsky | 同上 | 同上 | 同上 |

> 步骤引擎(click_checkin/click/wait/check/function)自 v1 沿用; 通用步骤见旧版代码注释。

### 复杂站点步骤细节

- **HDBao / MuXueGe**(跳页式): `attendanceUrl` 直达 `attendance.php` → 点「立即签到」提交 → 页面刷新显示结果; `alreadyPageCheck:true` 用整页文本判定已签; 兜底 `click_checkin` 带 `ignoreError`。
- **蜂巢**(对话框式, 2026.09.07 站方改版为 shadcn/Radix 风格): 签到按钮固定 `data-slot="sidebar-user-check-in"`, 已签时文案为「已签到」→ 按钮级已签检测自动命中(步骤 2 前置 detect 与步骤内 `click_checkin` 双保险), 不再依赖旧「文本含签到不含已」函数选择器; 未签时点同一按钮; 等待 5s(站点限制, 3s 不够) → `click_checkin` → 对话框「签到/关闭」两步降级为**可选**(`ignoreError` + 2s 超时, 改版后是否仍弹对话框待实测, 无则自动跳过); 无可靠成功特征, `confirmManual:true` 记 pending。
- **贴吧吧页**: `match` 用函数解析 `?kw=` 精确归属(同域多个吧互不误签); 已关注吧才有签到按钮(未关注按失败提示)。

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
│       └─ 无任务 → 被动模式: 命中 unit 逐个 runUnit(25s 整流程超时保护)
└─ 发起页调度循环 runBatchScheduler: 逐个 GM_openInTab 后台标签 → 轮询 GM 状态(1s)
    → pending 观察 10s / success·failed·skipped 即结算 → 50s 无回写写 failed 自动跳过 → 站间缓冲
    → 全部完成停在发起页弹完成面板; 心跳 hb 节流(4s)刷新
```

## 实测校准清单(并入正式版前逐项验证)

1. 贴吧：已签特征文案(现配 `连签`)、点击后成功文案(现配 body 含 `签到成功`)、未关注吧时按钮缺失的行为。
2. 蜂巢：已签检测已启用(改版后按钮 `data-slot="sidebar-user-check-in"` 文案「已签到」, 实测命中)→ 待实测: 未签时点击同一按钮后是否仍弹对话框(步骤已做可选兼容)、点击后按钮是否即时变「已签到」(若稳定可改 successDetect, 摆脱 confirmManual)。
3. HDBao / MuXueGe：`attendanceUrl` 落地页的整页已签文案检测是否误报/漏报(**全部站点默认关闭整页检测, 仅这两站显式开启**; 注意站内其他区域是否含 `签到已得` 字样)。
4. 其余 15 个 PT 站：按钮级已签检测为主(落地页/首页按钮文案变已签即可判定 success)——到站刷新两次验证: 首次触发签到, 10 分钟内第二次显示冷却跳过、但已签检测仍每次执行。若仍有站报"步骤失败: 等待元素...超时"且实际已签到, 按其页面 HTML 复查 `checkInSelector` 是否仍匹配(2026.09.07 已批量去掉 faqlink class 依赖)。BTSchool 特例(`noButtonMeansCheckedIn`): 未签页按钮在→能点; 已签页按钮消失→判 success, 需实测确认按钮确实随已签消失、且不会在无签到入口的其它页面误判。
5. 批量调度(重点)：发起页停留不动, 后台标签逐个打开签到并自动关闭; 模拟单站断网/无法访问 → 50s 窗口后写 failed 自动跳过继续下一站(不再死链); 点击跳转型站落地页结算写 success; 调度中途关闭发起页 → 其它站横幅提示「恢复批量」一键续跑。
6. 深浅色主题切换、批量完成面板在任意站打开的一致性(完成后面板停留发起页, 其它站打开面板数据一致)。

## 修改与扩展指南

1. **新增简单站**：`SITES` 加单站对象 + `@match` 域名; 参考同类型站复制字段。
2. **贴吧加吧**：`tieba` group 的 `units` 加一条(改 id/name/url 与 kw), `@match` 无需改。
3. **失效排查**：先看 console 日志(`未匹配`→match; `步骤失败`→选择器/文案; `未检测到成功特征`→successDetect/文案; `整流程超时`→步骤卡死)。
4. **改动后**：递增版本号, 更新本文档与站点表。
