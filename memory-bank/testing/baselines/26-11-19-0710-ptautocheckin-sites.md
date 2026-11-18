# 37 —— PTAutoCheckIn 全量绿(Railgun 原子化修复)

> 摘要: PTAutoCheckIn 全量绿(Railgun 原子化修复)
> 基线时间: 2026-11-19 07:10

## 验收数字

- TOTAL: 37 · 通过: 37 · 失败: 0
- 汇总行(实测誊写): `✔ 全部 37 个测试通过。`
- 差值(vs 上一片 26-11-19-0558-ptautocheckin): 0 变化 —— 本轮仅动 Railgun steps 结构与引擎守卫抽取, 测试面无增删, 37/37 恒绿; 附带 `check-ptac-budget.js` 全绿(A1–A6/B1–B6/C1–C2/D1–D2, C1=3 个 function 步均声明 budgetMs)。

## 本改动面

- `src/PTAutoCheckIn.user.js`: Railgun 两步流程(function 展开步 + CLICK_CHECK_IN)合为**原子单 function 步**(修 issue 26-11-19-0618 跨步骤间隙): 展开(mouseenter + .is-open 兜底)→轮询横幅可见→`guardCheckInEntry` 三重守卫→立即点击, 无 300ms 动画 sleep/步骤间隙, 横幅未现重展开重试 3 轮; `budgetMs` 8400 → 7500(3×2500, 成功路径 sleep 移除后收紧)。引擎三件: ①click_checkin 三重守卫(已签文案/内容校验/站外 href)抽成共用函数 `guardCheckInEntry`(mismatch 分支返回 `{mismatch:true}`, click_checkin 内语义与旧口径一致); ②function 步骤签名 `func(unit)`(传 unit)且可返回 `{alreadyHit}`/`{refused}` 标记由 executeStep 向上传导(HHCLUB/NodeLoc 旧无参 func 向后兼容零改动); ③配置头 steps 字段注释同步 function 步新契约; `@version` 2026.11.19.2 → 2026.11.19.3。
- 知识库: `scripts/PTAutoCheckIn/config-model.md` steps 字段行补 function 步契约 + 预算表补 Railgun 行(0+7500+18000=25500/40000); `sites.md` Railgun 行改原子单步口径; `pitfalls/site-adapt/p32-hover-expand-card.md` 注意节改写(hover 展开型禁两步流程, 必须原子化)+ 处置④与注意节口径统一(评审发现); issue `26-11-19-0618` 状态 Open → Done(修复后补充小节写实际修法/验证数字, kb.status 翻转); `kb.index` 重跑。
- 评审 2 轮(轮1: 1 minor p32 处置④与注意节口径矛盾——已修; 轮2 零发现: 修复未回退、无新矛盾、其余文件与轮1逐行评审内容一致), 引文机检 1/1 过。
