# TampermonkeyScripts
Self-using Tampermonkey scripts.

## 用户可见行为（近期）

- PTAutoCheckIn FAB：皮肤由 4 套收敛为 2 套（变色 / 信号灯），legacy 静态/数字/光环值静默归一为变色；新增两个与皮肤正交的布尔开关——动效开关（`ptac_motion` 跨站，关闭后 FAB 本体/辉光/形变三类动画全停、状态色与角标不变，签到按钮脉冲保留；legacy 静态用户升级后动效默认关）与靠边模式（`ptac_edge` 跨站，右下角真贴边静态竖线，移入/聚焦内移 20px 展开为原圆钮、命中区并集 + `pointermove` 判定根治临界闪烁，面板打开与批量进行中不缩回、触屏两段式）。详见 `memory-bank/scripts/PTAutoCheckIn/fab-ui.md`。
