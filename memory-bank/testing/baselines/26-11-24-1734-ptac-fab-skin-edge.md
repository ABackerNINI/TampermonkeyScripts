# 42 passed + 0 failed —— PTAutoCheckIn FAB 皮肤精简与靠边模式改造 全量绿（四批落地）

> 摘要: PTAutoCheckIn FAB 皮肤精简与靠边模式改造 全量绿（四批落地）
> 基线时间: 2026-11-24 17:34

## 验收数字

- TOTAL: 42 · 通过: 42 · 失败: 0
- 汇总行(实测誊写): `✔ 全部 42 个测试通过。`
- 差值(vs 上一片 26-11-19-0710-ptautocheckin-sites): +5 —— 本专题四批新增 5 个静态/仿真用例（check-ptac-fab-anim / check-ptac-fab-skin / sim-ptac-fab-skin / check-ptac-fab-edge / sim-ptac-fab-edge），既有 37/37 恒绿无回归。

## 本改动面

- `src/PTAutoCheckIn.user.js`: 四批累计 —— A 批辉光呼吸/变色形变改合成属性写法（box-shadow→opacity 伪元素、去 border-radius 波动）；B 批皮肤条收敛为 chameleon/signal/static 三钮 + legacy number|ring 内存归一为变色（GM 原值保留、不回写）；C 批新增 GM 键 `ptac_edge` 跨站 + `.edge` 竖线四条件状态机（触屏两段式/批量不缩/失焦仍关闭）；`@version` 2026.11.19.3 → 2026.11.24.4。
- `tests/ptautocheckin/check-ptac-fab-anim.js`(新增): 静态断言无 infinite 动画改 box-shadow/border-radius/filter。
- `tests/ptautocheckin/check-ptac-fab-skin.js`(新增): 静态断言三钮 data-skin 集合 + static 禁动画 + legacy 归一。
- `tests/ptautocheckin/sim-ptac-fab-skin.js`(新增): 三态仿真（全完成绿 / 有未签紫+红角标 / 切换后无动画）+ legacy 注入渲染为变色。
- `tests/ptautocheckin/check-ptac-fab-edge.js`(新增): 静态断言竖线几何四值 + data-edge 开关正交 + C4 状态机接线。
- `tests/ptautocheckin/sim-ptac-fab-edge.js`(新增): 真浏览器六场景仿真（竖线 hover / 面板保持 / 失焦缩回 / 批量不缩 / 触屏两段式 / 键盘焦点）。
