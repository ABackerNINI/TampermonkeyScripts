# 45 passed + 0 failed —— PTAutoCheckIn FAB 触发点上方闪烁修复

> 摘要: PTAutoCheckIn FAB 触发点上方闪烁修复
> 基线时间: 2026-11-25 02:52

## 验收数字

- TOTAL: 45 · 通过: 45 · 失败: 0
- 汇总行(实测誊写): `✔ 全部 45 个测试通过。`
- 差值(vs 上一片 26-11-25-0033-ptac-fab-cpu-idle): 0 —— 总数恒 45, 无新增测试文件; `sim-ptac-fab-edge.js` 内新增 C4⑨ 场景(九场景真浏览器实测), 两静态护栏版本断言同步, 全绿无回归。

## 本批实测要点

- 复现(修复前): 新增 C4⑨ 在竖线顶端附近悬停, `assertFabWStable` 读到宽度在 4/52 间振荡 —— FAIL, 坐实用户报的"触发点上方闪烁"。
- 修复后: `sim-ptac-fab-edge.js` 九场景全过(含 C4⑨ 顶端 top-7/top/top+3 三点各采样 1s 不缩回); `check-ptac-fab-edge.js` / `check-ptac-fab-motion.js` 静态护栏全绿; `test.full` 45/45。
- 环境: Edge `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe` + Node v22.14.0; 仿真真浏览器非 SKIP。
- 静息 CPU=0 沿用上一片 26-11-25-0033 的 CDP 实测(本批只改命中区几何锚点, 不引入新动画/定时器, 无需重测)。

## 本改动面

- `src/PTAutoCheckIn.user.js`: @version 2026.11.24.7 → 2026.11.25.1(跨天重置); `.fab.edge::before` 垂直锚点 `top:-10px` → `bottom:-10px`(两态 fab bottom 恒 20px, 命中区垂直范围恒 `[视口底-150,-10]`); 签到逻辑/四条件状态机/ptacHlPulse 零改动。
- `tests/ptautocheckin/sim-ptac-fab-edge.js`: 新增 C4⑨ 三点 y 临界回归; 面板探测点 W-60 → W-200(命中区扩大后旧点落入区内的配套)。
- `tests/ptautocheckin/check-ptac-fab-edge.js`: 命中区断言改认 bottom 锚点 + 反查无 top 残留; 版本断言跟到 .25.1。
- `tests/ptautocheckin/check-ptac-fab-motion.js`: 版本断言跟到 .25.1。
- `memory-bank/`: fab-ui.md / overview.md / calibration-detail.md(校准项 23) / known-issues.md / P17 / 根 README 回写; 本基线切片; kb.wrap 收尾。
