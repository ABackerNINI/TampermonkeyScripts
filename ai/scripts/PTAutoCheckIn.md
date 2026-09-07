# PTAutoCheckIn-v2.user.js — PT 多站点自动签到 v2

> 源文件：`src/PTAutoCheckIn-v2.user.js` ｜ 版本 `2026.09.08.22`(升级时同步更新)
> ⚠️ 状态：**v2 重构版, 待实测校准后并入正式版**。原 `src/PTAutoCheckIn.user.js`（v2026.08.30.1）暂保留；并入时改回 `@name PTAutoCheckIn` 并递增版本号, 删除旧文件。

## 功能概述

覆盖 24 个 PT 站(含仅检测不自动签的 U2 与无按钮访问即签的 MTeam/DigitalCore/HD-Space/Kufirc)+ 百度贴吧(**多吧**, 每个吧为独立签到单元)。双模式：

1. **被动模式**：访问匹配站点自动签到(同 v1)。
2. **主动批量模式**：点击右下角悬浮按钮 → 面板「批量签到」→ **发起页常驻**, 由调度循环依次用 `GM_openInTab` 在**后台标签**打开各站执行签到, 发起页轮询 GM 状态逐个推进, 全部完成后停在发起页弹出完成面板。
3. **结果查看**：FAB 面板展示**当日全量结果**(成功/失败/待确认/跳过), GM 存储跨域共享 → 任意已匹配站点打开面板看到的都是同一份数据。
4. **签到按钮重现降级提醒**(2026.09.08 .18/.19/.20)：当日记录已签(success)但按钮又呈可签态(服务器重置/换账号/误报)→ **.20 状态降级**: 把当日状态改为 `suspect`, 面板该站 badge 显「**失败-待确认**」且不再计入今日成功(仍不自动重签、不进批量); 同时 **.19 页面级呈现**仍生效: 琥珀警示 toast 一次 + 按钮琥珀高亮描边+⚠ 徽标「已标失败-待确认(仅提醒)」+ 页面底部居中常驻横条(可 ✕ 圆钮关闭本页); FAB 琥珀角标/面板警示条/行标记(.18)保留。页面确认已签 → 状态自动恢复已成功 + 提醒消除; 次日自然作废(见 P25)。

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
| `url` / `attendanceUrl` | 批量导航目标(后者可选, 直达签到/结果页); url 同时是页面归属的唯一事实来源 |
| `match` | **可选**——`RegExp` 或函数(传 href)显式决定页面归属; 缺省由 `url` 推导: host 相等(忽略 `www.` 前缀), 且 url 带 query 时逐参数一致(页面可带额外参数, 如贴吧 `kw`) |
| `checkInSelector` / `checkInContent` | 签到按钮定位与文案校验 |
| `alreadyCheckedInContent` | 已签到特征文本; **检测主通道=按钮文案**——每次访问页面都检测, 不受 10 分钟冷却限制(冷却只限"是否点击", 不限"是否检测") |
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

## 存储与状态层(GM, key 前缀 `ptac_`)

| key | value | 用途 |
|-----|-------|------|
| `ptac_status_<unitId>` | `{date:'YYYY-MM-DD', status, msg, ts}` | 当日结果(面板展示), status ∈ success/failed/pending/skipped/suspect(suspect=签到按钮重现降级的「失败-待确认」, 见 P25) |
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
- FAB(右下角, 渐变圆钮)→ 点击展开面板：今日汇总 + 分组列表(多吧 group 有组头)+ 每行状态徽章/msg/时间 + 「批量签到(剩余 n)」按钮。**FAB 皮肤 4 套可切换**(面板头部「外观」展开选择条, 存 `ptac_skin` 跨站生效): ①变色 全完成→绿底✓(无角标)/ 有未签→紫底✓+红底剩余角标; ②数字 全完成→✓ / 有未签→主区大字剩余数(绿角标=成功数); ③信号灯 完成→绿✓ / 今日有失败→红底!+失败角标 / 其余→琥珀✓+剩余角标; ④光环 分段彩光贴圆缘柔和发散(成功淡绿 mint 段 / 失败淡粉 rose 段 / 待办灰段, 段弧长=该状态站数占比, 多段并存不整环变色; 如 20 成功+1 失败→绿环为主+尾段淡粉), **本体透明且显式 `animation:none` 关掉 baseGlow**(外圈紫晕又强又与呼吸脱节), 段 alpha 压低至 0.34/0.26 → 常亮辉光弱; ::before 整体 ringBreathe **弱呼吸**(brightness 0.96↔1.07 明暗 + drop-shadow 淡紫光晕沿圆缘外 2px↔9px 外扩收拢, blur 2px 在 keyframes 内重声明; 3.6s, 幅度收敛不抢戏); 光芒动感由 **真实 DOM 日冕射线承担**(**完全复刻 sample.html 太阳算法**——先前「埋段+mask 圆孔挖根」「渐变平台按露出段比例」等自定义均效果一般已弃): `.ring-rays` 容器(inset:-60px 仅定位, **z-index:-1 沉到 ::before 之下**(盖光层之下), 无 mask 无裁剪, 射线溢出可见), 内 22 条 `<i class="ray">`(主 18 + 日冕长细 4, sample 同款数量): 底边锚圆心(`bottom:50%;left:50%` + 负 margin 居中)、`transform-origin:bottom center`、**只 `rotate(var(--a))` 绕圆心**指向各角(勿加 translateY——rotate 绕 transform-origin=底边中心, 根会全叠圆正上一点呈折扇); **射线全长=圆心到尖端(主 70~124px/日冕 118~162px), 根部(0~26px)被 ::before 中心紫罩圆盖住(紫罩 radial 实盖至圆缘: accent-1 42% → transparent 67%, 兼 sample center-icon 的盖光作用), 露出=圆缘外渐变尾段——无需 mask 挖孔**; 渐变照 sample 金档 `0.9@0 → 0.6@30% → 0.2@70% → transparent`(根亮尖透, **无平台**)+ 顶部半圆帽 `border-radius:50% 50% 0 0 / 100% 100% 0 0` + `filter: blur(1px)` 羽化; 静态 `opacity:0`, 动画 `rayPulse` **三帧**(照 sample solarPulse): 0% `opacity 0.15/blur2px/scaleY 0.6` → 50% `0.9/blur0/1.1`(峰值锐利清晰成刺) → 100% `0.3/blur1.5/0.8`, `alternate` 往复 + **正** `animation-delay`(主 0~2.5s、日冕 0~3s)错相 → 各条低谷模糊柔化、峰值锐利的呼吸闪烁; **keyframes 内须重组 `rotate(var(--a)) scaleY(...)` 与 blur(动画覆盖行内值)**; 主束均分角+±7.5° 随机扰动、日冕束全随机角(更长更细更慢, sample 比例); 本体 `.fab.ring` 另以 `box-shadow` 柔和紫光晕取代硬黑投影(透明圆上黑投影破坏光感); JS 生成只一次(`!querySelector('.ring-rays')` 守卫, 每页图案不同), **切走 ring 皮肤时须移除 `.ring-rays` 元素**(样式挂 `.fab.ring` 下, 残留会裸显示); 中间圆(紫罩蒙版带图标+绿角标=成功数, 蒙版越边缘越透明, 实盖至圆缘)不上波纹动画(transform 留给 hover/active); 辉光带仅圆缘外 26~34px。核心诉求: **全部签到完毕与有站点未签到在 FAB 上有明显区别**。
- 批量进行中(发起页)：FAB 旁芯片与面板内进度条显示 `批量 i/n · 正在处理/倒计时`, 可随时停止; **后台任务标签不注入 FAB/UI**(避免后台闪烁); 中断恢复横幅在发起页以外任意匹配页显示(「检测到中断的批量任务」+「恢复批量」按钮)。
- **站点图标**: 每个站点名前显示其 favicon(14px 圆角, 透明底加灰底容错)。取用链 = 配置 `favicon` 字段 → GM 路过收集的真实 `<link rel="icon">` URL(存 `ptac_favicon_<unitId>`, 仅 http(s)) → 站点根 `/favicon.ico` → 无则不发图; URL 与站页面一致时命中浏览器 HTTP 缓存(零额外流量); 加载失败(无图标/路径非标/防外链)由**捕获阶段 error 事件委托**隐藏, 不占位不影响站名。
- **点击站点名** → `GM_openInTab` 新标签(前台)打开该站(行尾 ↗ 提示, 事件委托, 行内容重建不影响)。
- **失败且冷却中的站**(今日 `failed` + 10min 冷却未过): 整行降透明度 + 左侧琥珀竖条 + 副文案提示「冷却中, 默认不参与批量」; 批量候选**默认排除**此类站。常规「批量签到」按钮**右侧紧贴一个窄 chevron 图标钮**(拆分按钮组, 同色系+细分隔线) → 点击后琥珀色的 **「强制批量签到(n 站)」** 按钮从**按钮行上方浮出**(absolute 浮层不占文档流, 覆盖站点列表底部; 按钮与「批量签到」本体对齐), 浮出钮带详细 tooltip; 点击无视冷却强制重试(点击前仍重写冷却, 再失败进入新一轮冷却)。**全部签到完毕(无失败冷却站)或批量进行中隐藏图标钮**(此时「批量签到」恢复完整圆角); 图标钮 hover/展开态变琥珀色(图标不旋转); 强制按钮 tooltip 说明适用场景与风控风险。
- 面板数据读 GM 存储, 任何已匹配站打开均为同一份(满足「任意已添加网站查看完成面板」)。

## 已有站点一览(24 PT + 贴吧 2 吧)

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
| CrabPT | crabpt.vip | `a[href*="attendance.php"]` | `[签到得蟹币]` / `签到已得` | — |
| Cyanbug | cyanbug.net | `a.nav-btn[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| HDBao | hdbao.cc | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | 跳页; `attendanceUrl` 直达; `alreadyPageCheck:true` |
| MuXueGe | pt.muxuege.org | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | 同上 |
| 蜂巢 | pting.club | `button[data-slot="sidebar-user-check-in"]` | — / `已签到` | 对话框式(改版后已签检测启用, 对话框步骤可选); `successDetect` 按钮变已签 5s |
| MTeam | kp.m-team.cc | —(无按钮, 登录态访问主页 `/index` 即自动签到) | — / — | 显式 `match` 只认 kp 子域 `/index`; `successDetect` func 轮询 antd 卡片「站点数据/站點數據」(16s); 未登录被重定向无卡片 → failed |
| DigitalCore | digitalcore.club | —(无按钮, 登录态访问首页即自动签到) | — / 导航链接 `a[href="/alltorrents"]`「All Torrents」 | 同 MTeam 隐式签到型: 显式 `match` 限首页(根或 `/index`, 排除详情/种子列表误触发); `successDetect` func 轮询该链接(16s); 未登录重定向无导航 → failed |
| HD-Space | hd-space.org | —(无按钮, 登录态访问首页即自动签到) | — / 整页文本「Last access:」 | 同 MTeam 隐式签到型: 显式 `match` 限首页根路径; `successDetect` text 轮询「Last access:」(16s); 未登录重定向无该文本 → failed |
| Kufirc | kufirc.com | —(无按钮, 登录态访问首页即自动签到) | — / 导航链接 `a[href="/torrents.php"]`「Torrents」 | 同 DigitalCore/HD-Space 隐式签到型: 显式 `match` 限首页根路径; `successDetect` func 轮询该链接(16s); 未登录页显示 Login/Reactivate 无该链接 → failed |
| HHCLUB | hhanclub.net | 先点 `img#user-avatar` 展开菜单, 再点 `a[href*="attendance.php"]` | `[签到得憨豆]` / 落地页 `#date-display` 当月 `yyyy-mm` | `alreadyCheck` 自定义函数(动态算当月); **头像点-验-重试函数步骤**(点击后验签到链接可见, 最多3次) + `successDetect` 同页确认(轮询变 attendance.php 且当月日历 8s)双通道; 2026.09.08 修复普通触发偶发失败 |
| U2 | u2.dmhy.org | `a[href*="showup.php"]` | `立即签到` / `已签到` | **仅检测型** `detectOnly:true`(签到需人工输入验证码 → 不自动点击/不进批量); 未签面板提示「需人工签到」; 按钮文案变已签即判 success(2026.09.08 接入, 待实测) |
| pt吧 | tieba f?kw=pt | `.button-wrapper.operate-btn.follow-sign` | `签到` / `连签` | `batchDelayMs:3000` |
| hdsky吧 | tieba f?kw=hdsky | 同上 | 同上 | 同上 |

> 步骤引擎(click_checkin/click/wait/check/function)自 v1 沿用; 通用步骤见旧版代码注释。

### 复杂站点步骤细节

- **PTTime**(落地页无反馈型, 2026.09.08): 点击签到按钮整页跳到 `attendance.php`, 该落地页**不显示**「签到详情/签到已得」类按钮或文案(判定会卡 pending)→ 改用**落地页标记** `landingCheckedInContent: '总签到记录'`: 签到成功落地后页内出现「总签到记录」记录表头(`<p class="mt10 fwb">`, class 可能改版变化故**纯文本匹配不绑 class**)即判 success; 落地页判定**不写死 attendance.php**——由签到按钮 href 自动推导(`isLandingPageOf`: 解析 `checkInSelector` 的 href / `attendanceUrl` 优先), 同款语义站(NexusPHP 落地无反馈)照配 `landingCheckedInContent` 即可, 落地页叫 attendance.php/sign.php/... 都能识别(非落地页不检测防误报)。
- **HDBao / MuXueGe**(跳页式): `attendanceUrl` 直达 `attendance.php` → 点「立即签到」提交 → 页面刷新显示结果; `alreadyPageCheck:true` 用整页文本判定已签; 兜底 `click_checkin` 带 `ignoreError`。
- **蜂巢**(对话框式, 2026.09.07 站方改版为 shadcn/Radix 风格): 签到按钮固定 `data-slot="sidebar-user-check-in"`, 已签时文案为「已签到」→ 按钮级已签检测自动命中(步骤 2 前置 detect 与步骤内 `click_checkin` 双保险), 不再依赖旧「文本含签到不含已」函数选择器; 未签时点同一按钮; 等待 5s(站点限制, 3s 不够) → `click_checkin` → 对话框「签到/关闭」两步降级为**可选**(`ignoreError` + 2s 超时, 改版后是否仍弹对话框待实测, 无则自动跳过)。**2026.09.08 实测点击成功后按钮即时变「已签到」→ 弃 `confirmManual`(否则成功却卡 pending 待人工确认), 改 `successDetect:[{type:'text', selector: 同按钮, text:'已签到', timeout:5000}]`** → 点击后按钮变已签即 success, 5s 未变走通用回退(再等 2.5s)后记 failed(不再卡 pending; 若响应慢于 7.5s 会误报 failed, 实测暂稳)。
- **MTeam**(无按钮访问即签型, 2026.09.08 接入): 站方新站 `kp.m-team.cc` **没有签到按钮/页面**, 登录态访问主页 `/index` 即自动完成当日签到(隐式签到)。→ 建模: **显式 `match` 只认 kp 子域 `/index`**(详情页/其它子域不触发, 防把浏览页误当签到动作、详情页无卡片误报 failed 污染当日状态); 无 `checkInSelector`/`alreadyCheckedInContent`(无按钮可检可点); 步骤仅 `wait 3000` 等 SPA 渲染; 成功靠 `successDetect:[{type:'func', fn: 轮询 .ant-card-head-title 含「站点数据」或「站點數據」(16s)}]`(antd Card 标题, 简/繁双文本防 locale; 未登录被重定向登录页 → 无卡片 → failed, 需登录后脚本才会成功)。
- **DigitalCore / HD-Space / Kufirc**(无按钮访问即签型, 2026.09.08 接入, 同 MTeam 模板): 三站同样**无签到按钮/页面**, 登录态访问首页即自动完成签到。DigitalCore(SPA, iconify 导航)成功特征 = `a[href="/alltorrents"]` 文本含 All Torrents; HD-Space(传统站)成功特征 = 整页文本含「Last access:」; Kufirc(Luminance 传统站, 未登录显示 Login/Reactivate)成功特征 = `a[href="/torrents.php"]` 文本含 Torrents。→ `match` 均限首页(根路径; DigitalCore 另容 `/index`); 无按钮字段; 步骤仅 `wait 3000`; `successDetect` 轮询特征(16s)。未登录 → 重定向/无特征 → failed。
- **HHCLUB**(菜单展开 + 动态落地页型, 2026.09.08 接入): 签到入口藏在头像下拉菜单: 先点 `img#user-avatar` 展开 → 再点菜单内 `a[href*="attendance.php"]`(`[签到得憨豆]`)→ 跳 `attendance.php`; 落地页渲染当月日历 `<p id="date-display">`(内容为**动态 `yyyy-mm`** 如 2026-09, 静态 `landingCheckedInContent` 字符串匹配不适用)→ 用 `alreadyCheck` 自定义 async 函数(非 attendance.php 落地页不判; 落地页上 `#date-display` 含**动态算出的当月前缀**才命中)→ 挂统一 `detectAlreadyCheckedIn` → 被动/批量/落地结算三路径自动共用。**2026.09.08 实测普通触发偶发「未检测到成功特征」+「整流程超时」, 强制重试即成功 → 点击后导航不稳定(SPA 路由/慢导航/首访点击无效)→ 修复双保险**: ① 头像改**点-验-重试函数步骤**: 点 avatar 后轮询签到链接**可见**(`getClientRects()>0`——菜单链接可能常驻 DOM 但 display:none, 隐藏元素程序化 `.click()` 不触发导航), 未现则再点(点击是 toggle), 最多 3 次; ② 补 `successDetect:[{type:'func', fn: 轮询 location.pathname 变 attendance.php 且 #date-display 含当月(8s)}]` → SPA 路由/800ms 后才跳转(无 pagehide)时同页也能确认, 不再秒判 failed; 整页跳转仍走落地结算(两通道并存)。已签当日菜单内容不变(无按钮级已签特征)。
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
2. 蜂巢：已签检测已启用(改版后按钮 `data-slot="sidebar-user-check-in"` 文案「已签到」, 实测命中); **2026.09.08 已实测点击后按钮即时变「已签到」→ 已弃 confirmManual 改 `successDetect`(按钮文案 5s 轮询)** → 待实测: 点击后按钮变已签稳定可靠(数日观察无 "未检测到成功特征" failed); 未签时点击后是否仍弹对话框(步骤已做可选兼容)。
3. HDBao / MuXueGe：`attendanceUrl` 落地页的整页已签文案检测是否误报/漏报(**全部站点默认关闭整页检测, 仅这两站显式开启**; 注意站内其他区域是否含 `签到已得` 字样)。
4. 其余 15 个 PT 站(普通按钮级自动签站, 不含蜂巢/HDBao/MuXueGe/MTeam/HHCLUB/DigitalCore/HD-Space/Kufirc 八个特殊站与仅检测的 U2):按钮级已签检测为主(落地页/首页按钮文案变已签即可判定 success)——到站刷新两次验证: 首次触发签到, 10 分钟内第二次显示冷却跳过、但已签检测仍每次执行。若仍有站报"步骤失败: 等待元素...超时"且实际已签到, 按其页面 HTML 复查 `checkInSelector` 是否仍匹配(2026.09.07 已批量去掉 faqlink class 依赖)。BTSchool 特例(`noButtonMeansCheckedIn`): 未签页按钮在→能点; 已签页按钮消失→判 success, 需实测确认按钮确实随已签消失、且不会在无签到入口的其它页面误判。PTTime 落地页无反馈问题见上 `landingCheckedInContent`(已配 `总签到记录`, 待实测确认落地页文本稳定; 若其它站同问题参照配置)。
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

## 修改与扩展指南

1. **新增简单站**：`SITES` 加单站对象 + `@match` 域名; 参考同类型站复制字段。
2. **贴吧加吧**：`tieba` group 的 `units` 加一条(改 id/name/url 与 kw), `@match` 无需改。
3. **失效排查**：先看 console 日志(`未匹配`→match; `步骤失败`→选择器/文案; `未检测到成功特征`→successDetect/文案; `整流程超时`→步骤卡死)。
4. **改动后**：递增版本号, 更新本文档与站点表。
