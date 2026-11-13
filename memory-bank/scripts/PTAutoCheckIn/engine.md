# 批量任务引擎与主流程(v2)
> 摘要: 常驻发起页 + 后台标签串行调度、批量中断恢复与 v2 主流程时序
> 触发: 改批量调度, 排查串行失败, 查主流程时序

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
