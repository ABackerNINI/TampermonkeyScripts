# 45 —— PTAutoCheckIn FAB 静息 CPU=0 验收(D 批)

> 摘要: PTAutoCheckIn FAB 静息 CPU=0 验收(D 批)
> 基线时间: 2026-11-25 00:33

## 验收数字

- TOTAL: 45 · 通过: 45 · 失败: 0
- 汇总行(实测誊写): `✔ 全部 45 个测试通过。`
- 差值(vs 上一片 26-11-25-0003-ptac-fab-edge-fix2): +1 —— 新增 `sim-ptac-fab-cpu-idle.js`(D2 静息 CPU=0 验收)，既有 44/44 恒绿无回归。

## D2 静息实测(CDP 实录)

> 两态各录 5s 静息，全程不派发任何鼠标/键盘事件；ptacHlPulse 与 200ms 签到 tick 不计入。
> 环境证据: Edge `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe` + Node v22.14.0(内置 WebSocket)，
> CDP Tracing / Overlay.paintRect / Performance.getMetrics / Page.screencast 全链路实跑，**非 SKIP，数字均为实测**。

- **关动效态**(`ptac_motion=false`, edge=false, chameleon): computed animation-name 本体/::after/::before = `none/none/none`；Paint 事件 0；RecalcStyle 事件 0；RecalcStyleCountΔ 0；LayoutCountΔ 0；重绘矩形 0（FAB 几何归因 0）；录屏帧 2。
- **靠边态**(`ptac_edge=true`, 动效默认开, chameleon): computed = `none/baseGlow/none`（::after 辉光属状态色语义，只动 opacity 合成属性，计划 §02 明确保留）；Paint 事件 0；RecalcStyle 事件 2（`elementCount=1`×2，静息前后 FAB 类名/几何/三处 animation-name 均不变，非 FAB 归因）；RecalcStyleCountΔ 4；LayoutCountΔ 0；重绘矩形 0（FAB 几何归因 0）；录屏帧 3。
- **结论**: 两态零 FAB 归因 Recalculate Style/Paint；FAB computed animation-name=none 且全局 Paint=0，无 `button.fab.chameleon` 动画层根的生成条件。静息口径只管静止不动时，形变 transition 不计入（§06 D9）。

## 本改动面

- `src/PTAutoCheckIn.user.js`: @version 2026.11.24.6 → 2026.11.24.7（本批含测试脚本改动，按版本铁律递增）；签到逻辑与 ptacHlPulse 零改动。
- `tests/ptautocheckin/check-ptac-fab-motion.js`: 新增 D1 段（关动效三选择器统一 animation:none、靠边态本体 animation:none、无 <200ms 毫秒级定时器），版本断言跟到 .7；反向验证确认新断言会变红。
- `tests/ptautocheckin/check-ptac-fab-edge.js`: 补 D1 真靠边 `right:0` 与展开内移 `right:20px` 成对断言，版本断言跟到 .7；反向验证确认变红。
- `tests/ptautocheckin/sim-ptac-fab-cpu-idle.js`: 新增 D2 CDP 5s 静息用例（两态；computed + Tracing + Overlay.paintRect 几何归因 + 录屏帧三路交叉），实测数字见上。
- `memory-bank/`: fab-ui.md / overview.md / P17 / known-issues.md / 根 README 回写；本基线切片；kb.wrap 抬切片与档案；kb.index 重建。
