# FAB 皮肤: 状态语义与角标含义要一致
> 摘要: FAB 角标颜色语义随皮肤/状态变，读代码勿假定「角标=成功数」。
> 触发: 改 FAB 皮肤, 排查角标含义, 改辉光动画, 启用 disabled 站

- **触发**: `ptac_skin`(chameleon/number/signal/ring)存 GM 跨站共享, `applyFabSkin(c)` 只认 `countToday()`(遍历全部 UNITS 的今日 status)。
- **判别**: 「全部完成」= `success >= total`(total 含 disabled 站)；「有未签」= 剩余 `total - success`；角标颜色语义随皮肤/状态变(默认绿=成功数; chameleon 未完成红=剩余数; signal 红=失败数、琥珀=剩余数)——读代码勿假定「角标=成功数」。
- **处置**: **disabled 站**(`enabled:false`)不参与批量也永无 success, 若将来启用 `total` 应改为「参与站数」或跳过 disabled 计数, 否则 FAB 永不显示完成态；光环皮肤辉光在 ::before(紫罩蒙版 radial `circle closest-side` + `--ring-grad` conic 分段), mask 径向须 `farthest-side`(方盒 78px 半径 39px); **本体(背景透明)勿叠加 baseGlow 等外圈 box-shadow 辉光**, `.fab.ring` 要显式 `animation:none`；**辉光呼吸不能只加在 ::before 上再配静态 `filter: blur`**——动画会整段覆盖 filter, keyframes 内须重声明 `blur(2px) brightness(...) drop-shadow(...)`；射线=全长圆心到尖, 根部被 ::before 中心紫罩圆盖住；**切走 ring 皮肤须移除 `.ring-rays` 元素**；JS 生成用 `!fab.querySelector('.ring-rays')` 守卫只建一次；伪元素盖图标问题: 需给 `.fab-core`/`.fab-badge` 提 `z-index`；勿对含分段的层整体旋转(段位会错位), 只旋转光芒层。

## P17. FAB 皮肤: 状态语义与角标含义要一致

**要点**：`ptac_skin`(chameleon/number/signal/ring)存 GM 跨站共享, `applyFabSkin(c)` 只认 `countToday()`(遍历全部 UNITS 的今日 status)。「全部完成」= `success >= total`(total 含 disabled 站);「有未签」= 剩余 `total - success`。
**注意**：
- 角标颜色语义随皮肤/状态变(默认绿=成功数; chameleon 未完成红=剩余数; signal 红=失败数、琥珀=剩余数)——读代码勿假定「角标=成功数」。
- **disabled 站**(`enabled:false`)不参与批量也永无 success, 若将来启用, `total` 应改为「参与站数」或跳过 disabled 计数, 否则 FAB 永不显示完成态。
- 光环皮肤辉光在 ::before(紫罩蒙版 radial `circle closest-side` + `--ring-grad` conic 分段), 分段段长=各状态站数占比; mask 径向须 `farthest-side`(方盒 78px 半径 39px, #000 至 calc(100%-13px)=26px 圆缘实、calc(100%-5px)=34px 透明 → 辉光带仅圆缘外 26~34px); **本体(背景透明)勿叠加 baseGlow 等外圈 box-shadow 辉光**——与 ::before 呼吸节奏脱节且显强, `.fab.ring` 要显式 `animation:none` 关掉 `.fab` 默认 baseGlow, box-shadow 若保留用柔和紫光晕(0 0 14px/42px rgba(139,92,246,~))勿硬黑投影; **辉光呼吸不能只加在 ::before 上再配静态 `filter: blur`**——动画会整段覆盖 filter, keyframes 内须重声明 `blur(2px) brightness(...) drop-shadow(...)`, 否则呼吸时辉光丢失模糊; 呼吸幅度小(brightness 0.96↔1.07 级)配合 drop-shadow 光晕外扩收拢即可, 辉光勿过强(动感交给光芒); 光芒演进(2026-09-07 终版 = **完全复刻 sample.html 原算法**; 此前 repeating-conic 均匀纹呆板 / SVG data-uri 整图无逐条动效 / translateY 锚圆缘(rotate 绕 transform-origin=底边中心 → 折扇) / 埋段+容器 mask 圆孔挖根(露段只是渐变暗尾/平台段=圆头短棒) / 渐变平台按露出段比例衰减 等自定义全部效果一般已弃): **射线=全长圆心到尖, 根部被 ::before 中心紫罩圆盖住** → `.ring-rays` 容器仅定位(z-index:-1 沉 ::before 之下, 无 mask 无裁剪, 溢出可见), 每条 `.ray` 底边锚圆心、`transform-origin:bottom center`、只 `rotate(var(--a))` 绕圆心; 渐变 sample 金档 0.9@0→0.6@30→0.2@70→transparent(无平台)+半圆帽+blur(1px); 动画 sample solarPulse 三帧(0.15/blur2/scaleY0.6 → 0.9/blur0/1.1 → 0.3/blur1.5/0.8)alternate + 正 delay 错相(负 delay=立即从中途相位起, 正=sample 原版静止等待, 均可用); **中心紫罩须实盖至圆缘**(如 accent-1 42% → transparent 67%, 39px 盒 42%≈16px 起淡、67%≈26px 圆缘透明完)才能盖住射线根不外穿, 否则需 mask; **教训: 动画覆盖行内 transform/filter → keyframes 内重组 `rotate(var(--a)) scaleY(...)` 与 blur**; 角度取均匀基准+扰动勿全随机(扎堆/空洞), sample 主 18 束 ±7.5° + 日冕长细 4 束全随机(更长更细更慢更久延迟); **切走 ring 皮肤须移除 `.ring-rays` 元素**(样式挂 `.fab.ring` 下, 残留会裸显示); JS 生成用 `!fab.querySelector('.ring-rays')` 守卫只建一次(每页图案不同); 伪元素盖图标问题: fab 本体背景 transparent、::before/::after 是 absolute(绘制在普通流内容之上)→ 需给 `.fab-core`/`.fab-badge` 提 `z-index` 否则中心图标被紫罩遮住; 勿对含分段的层整体旋转(段位会错位), 只旋转光芒层。
- 皮肤选择条在面板头部「外观」按钮展开(`.panel.skin-open .skin-bar`), 面板 `overflow:hidden` 故选择条用文档流内嵌行而非浮层。

