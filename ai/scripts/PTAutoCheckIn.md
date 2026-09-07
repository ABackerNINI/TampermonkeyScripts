# PTAutoCheckIn-v2.user.js — PT 多站点自动签到 v2

> 源文件：`src/PTAutoCheckIn-v2.user.js` ｜ 版本 `2026.09.07.2`（升级时同步更新）
> ⚠️ 状态：**v2 重构版, 待实测校准后并入正式版**。原 `src/PTAutoCheckIn.user.js`（v2026.08.30.1）暂保留；并入时改回 `@name PTAutoCheckIn` 并递增版本号, 删除旧文件。

## 功能概述

覆盖 18 个 PT 站 + 百度贴吧(**多吧**, 每个吧为独立签到单元)。双模式：

1. **被动模式**：访问匹配站点自动签到(同 v1)。
2. **主动批量模式**：点击右下角悬浮按钮 → 面板「批量签到」→ 当前标签页**接力导航**串行完成各站签到, 最后一站弹出完成面板。
3. **结果查看**：FAB 面板展示**当日全量结果**(成功/失败/待确认/跳过), GM 存储跨域共享 → 任意已匹配站点打开面板看到的都是同一份数据。

核心设计不变：站点配置数据 + 通用执行引擎。**签到原子单位从「域名」细化为「页面入口 unit」**（解决贴吧多吧）。

## 脚本元数据要点

- `@run-at document-start`；`@grant GM_getValue / GM_setValue / GM_log`（GM 存储**按脚本共享、跨域可读**——跨站状态/任务依赖此特性）。
- `@name PTAutoCheckIn-v2`：与旧版共存, 避免 Tampermonkey 同名冲突(存储/更新互不干扰)。
- `@match` 覆盖全部目标域名；批量导航仅在同域白名单内跳转(目标 URL 全部来自配置)。
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
| `ptac_task` | `{taskId, list:[unitId...], index, startedAt}` | 批量接力任务 |

## 单 unit 判定优先级(防封号核心)

```
1. 当日 success                    → skipped(今日已完成)
2. 已签到检测 —— 每次访问都执行, 不受冷却限制(检测≠点击, 无封号风险):
   按钮文案命中 / (仅显式 alreadyPageCheck 的站)整页文案命中 → success
3. 上次 pending 未确认且未过冷却、且第 2 步仍无已签证据 → failed(上次点击确实未生效)
4. 冷却中(<10min)                  → skipped(冷却只防重复点击, 不阻止检测)
5. 执行 steps                      → 点击前先写 cooldown(即使跳页丢页面, 冷却也已落盘)
   → 点击后落盘 pending → POST_CLICK_SETTLE(0.8s) 观察:
      · 发生 pagehide(整页跳转) → 保持 pending 返回; 落地页自动续链判定(已签→success)
      · 同页存活 → successDetect 命中→success; confirmManual→pending; 否则→failed
```

> 与 v1 关键差异：间隔 key 从「origin+pathname」改为**按 unitId**; 冷却命中时**跳过**而非 sleep 等待(批量场景需要); 「当日成功」由显式状态保证(需求: 须检测到特定成功条件才算成功)。

## 批量任务引擎(接力导航 + 自动续链)

1. 面板「批量签到」→ 候选 = enabled 且非今日成功且非未过期 pending → 建 `ptac_task` → `location.replace(首个 unit + '?ptacTask=taskId')`。
2. 接力页读 URL 参数 → 校验任务存在且**当前页命中 task.list[index] 的 unit** → 单站签到 → 更新 index → 循环。
3. **自动续链**: 签到点击触发的整页跳转(如 NexusPHP attendance.php 落地页)不带 URL 参数 —— 落地页加载时若检测到进行中的任务且当前页命中任务当前 unit, 自动在该页完成本站结算(已签检测成功→success)并推进下一站; 点击页检测到跳转时不推进任务, 由落地页接管。
4. 每站处理完按 `unit.batchDelayMs` 倒计时(芯片显示, 可点停止取消)→ `location.replace(下一站)`。
5. 最后一站处理完：清任务 → **停在当前页弹出完成面板**(不再跳回发起页)。
6. 安全与兜底：任务只含 unitId 列表(不含任何凭据); 跳转目标均来自配置白名单; 单 unit 总超时 25s; 链条中断 30min 视为 stale 自动清理; 其它页面若命中任务当前位置站点会续链/跳过被动点击, 防并行。

## FAB / 面板 UI

- Shadow DOM 注入, 样式完全隔离; CSS 变量 + `@media (prefers-color-scheme: dark)` **跟随系统深浅色**。
- FAB(右下角, 渐变圆钮, 带今日成功数角标)→ 点击展开面板：今日汇总 + 分组列表(多吧 group 有组头)+ 每行状态徽章/msg/时间 + 「批量签到(剩余 n)」按钮。
- 批量进行中：FAB 旁芯片与面板内进度条显示 `批量 i/n · 正在处理/倒计时`, 可随时停止。
- 面板数据读 GM 存储, 任何已匹配站打开均为同一份(满足「任意已添加网站查看完成面板」)。

## 已有站点一览(18 PT + 贴吧 2 吧)

| unit | 域名/kw | 入口选择器 | 签到文案 / 已签特征 | 备注 |
|------|---------|-----------|-------------------|------|
| 躺平 | tangpt.top | `a.faqlink[href="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| PTTime | pttime.org | `a.fcb[href*="attendance.php"]` | `签到领魔力` / `签到详情` | — |
| Railgun | bilibili.download | `a.faqlink[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| PTZone | ptzone.xyz | `a.faqlink[href*="attendance.php"]` | `[簽到得魔力]`(繁) / `簽到已得` | — |
| PTSBao | ptsbao.club | `a.faqlink[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| HDClone | pt.hdclone.top | `a.faqlink[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| BTSchool | pt.btschool.club | `a[href*="index.php?action=addbonus"] > font` | `每日签到` / `签到已得` | — |
| 大香蕉 | pt.daxiangjiao.org | `a.faqlink[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| NovaHD | pt.novahd.top | `a.faqlink[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| PTFans | ptfans.cc | `a.faqlink[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| CarPT | carpt.net | `a.faqlink[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| HDTime | hdtime.org | `a.faqlink[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| HDFans | hdfans.org | `a.faqlink[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| CrabPT | crabpt.vip | `a.faqlink[href*="attendance.php"]` | `[签到得蟹币]` / `签到已得` | — |
| Cyanbug | cyanbug.net | `a.nav-btn[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| HDBao | hdbao.cc | `a.faqlink[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | 跳页; `attendanceUrl` 直达; `alreadyPageCheck:true` |
| MuXueGe | pt.muxuege.org | `a.faqlink[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | 同上 |
| 蜂巢 | pting.club | 无(函数选择器) | — / — | 对话框式; `confirmManual:true` |
| pt吧 | tieba f?kw=pt | `.button-wrapper.operate-btn.follow-sign` | `签到` / `连签` | `batchDelayMs:3000` |
| hdsky吧 | tieba f?kw=hdsky | 同上 | 同上 | 同上 |

> 步骤引擎(click_checkin/click/wait/check/function)自 v1 沿用; 通用步骤见旧版代码注释。

### 复杂站点步骤细节

- **HDBao / MuXueGe**(跳页式): `attendanceUrl` 直达 `attendance.php` → 点「立即签到」提交 → 页面刷新显示结果; `alreadyPageCheck:true` 用整页文本判定已签; 兜底 `click_checkin` 带 `ignoreError`。
- **蜂巢**(对话框式): 等待 5s(站点限制, 3s 不够) → 外层「签到」按钮(函数选择器: `button:has(> svg):not([title])` 文本含「签到」不含「已」且 < 4 字) → 对话框「签到」按钮 → 「关闭」按钮; 无可靠成功特征, `confirmManual:true` 记 pending。
- **贴吧吧页**: `match` 用函数解析 `?kw=` 精确归属(同域多个吧互不误签); 已关注吧才有签到按钮(未关注按失败提示)。

## 主流程(v2)

```text
boot()
├─ 非 iframe 且 DOM ready
├─ main()
│   ├─ 清理 stale 批量任务(链条中断 >30min)
│   ├─ URL 带 ptacTask → 任务接力模式: 校验当前位置 → 单站签到 → 下一站/完成面板
│   └─ 普通访问:
│       ├─ 有进行中任务且当前页命中任务当前 unit(跳页落地页) → 自动续链结算本站
│       └─ 否则 → 被动模式: 命中 unit 逐个 runUnit(批量中跳过任务当前位置站点)
│           └─ runUnitWithTimeout(25s 整流程超时保护)
│               └─ runUnit: 当日成功/已签检测(不受冷却)/pending 未确认/冷却 → 执行 steps(先写冷却) → 点击后确认
└─ UI(FAB/面板/芯片)全程可用: 查看结果、发起/停止批量、倒计时展示
```

## 实测校准清单(并入正式版前逐项验证)

1. 贴吧：已签特征文案(现配 `连签`)、点击后成功文案(现配 body 含 `签到成功`)、未关注吧时按钮缺失的行为。
2. 蜂巢：无可靠成功特征(confirmManual 记 pending)——若有可靠特征(按钮文案/对话框消失)可改为 successDetect。
3. HDBao / MuXueGe：`attendanceUrl` 落地页的整页已签文案检测是否误报/漏报(**全部站点默认关闭整页检测, 仅这两站显式开启**; 注意站内其他区域是否含 `签到已得` 字样)。
4. 其余 15 个 PT 站：按钮级已签检测为主(落地页/首页按钮文案变已签即可判定 success)——到站刷新两次验证: 首次触发签到, 10 分钟内第二次显示冷却跳过、但已签检测仍每次执行。
5. 深浅色主题切换、批量完成面板在任意站打开的一致性。

## 修改与扩展指南

1. **新增简单站**：`SITES` 加单站对象 + `@match` 域名; 参考同类型站复制字段。
2. **贴吧加吧**：`tieba` group 的 `units` 加一条(改 id/name/url 与 kw), `@match` 无需改。
3. **失效排查**：先看 console 日志(`未匹配`→match; `步骤失败`→选择器/文案; `未检测到成功特征`→successDetect/文案; `整流程超时`→步骤卡死)。
4. **改动后**：递增版本号, 更新本文档与站点表。
