# 44 —— PTAutoCheckIn FAB 真靠边与闪烁根治(B/C 批)

> 摘要: PTAutoCheckIn FAB 真靠边与闪烁根治(B/C 批)
> 基线时间: 2026-11-25 00:03

## 验收数字

- TOTAL: 44 · 通过: 44 · 失败: 0
- 汇总行(实测誊写): `✔ 全部 44 个测试通过。`
- 差值(vs 上一片 26-11-24-2315-ptac-fab-motion): +0 —— 本批未新增用例文件，改写既有靠边静态/仿真断言（新增真贴边、展开内移、右锚点并集、20 次临界点不翻转、并集区外不遮挡、无时间锁），既有 44/44 恒绿无回归。

## 本改动面

- `src/PTAutoCheckIn.user.js`: B1 靠边竖线 `right:0/bottom:20` 真贴右边缘；B2 展开态（hover/focus-within/edge-open）内移 `right:20px` 回完整 FAB 位置，`right` 纳入同一条 transition；C1 命中区 `::before` 改右锚点 `right:-20px/width:72px`（实测校准：竖线态覆盖距右 0-52px、展开态 0-72px，避免 left 锚点过渡中命中区从指针下跳走致 `:hover` 振荡）；C2 指针判定改 document 捕获阶段 `pointermove` + `elementFromPoint` + `host.contains`（沿用面板自动关闭同款 closed shadow 重定向），移除 `edgeHover` 标志，保留 panel/batch/touchStage/focus 四条件；C3 靠边状态机无 setTimeout 时间锁；`@version` 2026.11.24.5 → 2026.11.24.6。
- `tests/ptautocheckin/check-ptac-fab-edge.js`: 断言真贴边锚点、展开内移、transition 纳入 right、右锚点并集命中区、pointermove/elementFromPoint/host.contains 判定、无 edgeHover 标志与 setTimeout 时间锁。
- `tests/ptautocheckin/sim-ptac-fab-edge.js`: 真贴边几何断言、并集区外不遮挡页面按钮、临界点连续 20 次左右移动不翻转；等待函数加过渡收敛余量（宽/高/right 同条 transition，避开中途态取样）。
- `tests/ptautocheckin/check-ptac-fab-motion.js`: 版本断言跟到 .6（动效开关本身零改动）。
- `memory-bank/`: fab-ui.md / overview.md / P17 / known-issues.md / calibration-detail.md 校准项 23 / 根 README 回写；新建本基线切片；kb.index 重建。
