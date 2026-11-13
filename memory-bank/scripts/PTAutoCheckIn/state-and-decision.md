# 存储状态层与单 unit 判定优先级
> 摘要: GM ptac_ 键前缀的存储布局与「防封号核心」单 unit 判定优先级，改判定顺序前必读
> 触发: 改 GM 键, 排查误判, 调判定优先级

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
