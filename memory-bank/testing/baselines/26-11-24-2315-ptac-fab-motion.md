# 44 —— PTAutoCheckIn FAB 动效开关化(A 批)

> 摘要: PTAutoCheckIn FAB 动效开关化(A 批)
> 基线时间: 2026-11-24 23:15

## 验收数字

- TOTAL: 44 · 通过: 44 · 失败: 0
- 汇总行(实测誊写): `✔ 全部 44 个测试通过。`
- 差值(vs 上一片 26-11-24-1734-ptac-fab-skin-edge): +2 —— 本批新增 2 个用例（check-ptac-fab-motion.js / sim-ptac-fab-motion.js），既有 42/42 恒绿无回归。

## 本改动面

- `src/PTAutoCheckIn.user.js`: A 批动效开关化 —— 删 static 皮肤三处残留（data-skin 按钮 / .fab.static 两规则 / case 'static' 分支），皮肤条回 2 钮；新增 GM 键 `ptac_motion` 与 data-motion 布尔开关（文案「动效」/「静态」，与靠边并列、细分隔线隔开），初始化读 GM 默认开、点击持久化；关动效 = host 挂 `.motion-off`，shadow 内用 `:host(.motion-off) .fab` / `::after` / `.fab.chameleon` 三条 `animation:none!important`（`ptacHlPulse` 保留，属签到逻辑）；legacy static 归一变色 + 动效初始化为关、GM 原值不回写；`@version` 2026.11.24.4 → 2026.11.24.5。
- `tests/ptautocheckin/check-ptac-fab-skin.js`(改写): 断言皮肤条 2 钮、无 static 残留、legacy static|number|ring 归一且不回写。
- `tests/ptautocheckin/check-ptac-fab-motion.js`(新增): 断言 ptac_motion 读写、data-motion 独立接线、:host(.motion-off) 三类动画关停、ptacHlPulse 保留。
- `tests/ptautocheckin/sim-ptac-fab-skin.js`(改写): legacy static 归一变色 + 动效默认关 + GM 不回写仿真。
- `tests/ptautocheckin/sim-ptac-fab-motion.js`(新增): 真浏览器验证三类 animation=none、两开关正交、点击持久化与跨站同值。
- `tests/ptautocheckin/check-ptac-fab-edge.js`(适配): 皮肤钮数与 @version 断言跟到 2 钮/.5。
- `memory-bank/`: fab-ui.md / overview.md / P17 / known-issues.md / 根 README 回写；kb.index 重建。
