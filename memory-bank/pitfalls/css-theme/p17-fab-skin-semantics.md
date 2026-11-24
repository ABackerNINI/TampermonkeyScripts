# FAB 皮肤: 状态语义与角标含义要一致
> 摘要: FAB 角标颜色语义随皮肤/状态变，读代码勿假定「角标=成功数」；静态皮肤与变色同语义、legacy 静默归一。
> 触发: 改 FAB 皮肤, 排查角标含义, 改辉光动画, 启用 disabled 站

- **触发**: `ptac_skin`(chameleon/signal/static)存 GM 跨站共享, `applyFabSkin(c)` 只认 `countToday()`(遍历全部 UNITS 的今日 status); legacy 值(number/ring)在入口内存归一为变色。
- **判别**: 「全部完成」= `success >= total`(total 含 disabled 站)；「有未签」= 剩余 `total - success`；角标颜色语义随皮肤/状态变(默认绿=成功数; chameleon 未完成红=剩余数; signal 红=失败数、琥珀=剩余数; **static 与 chameleon 逐态一致**)——读代码勿假定「角标=成功数」。
- **处置**: **disabled 站**(`enabled:false`)不参与批量也永无 success, 若将来启用 `total` 应改为「参与站数」或跳过 disabled 计数, 否则 FAB 永不显示完成态；**静态皮肤** = 变色静态版(保留紫/绿状态色与角标, `.fab.static` 禁全部 animation), 勿以为「禁动画」等于改语义；legacy number/ring **内存归一为变色**(渲染与皮肤条高亮一致), GM 存储原样保留、**不回写**(静默回退, 不加迁移提示代码)；靠边竖线颜色**直接复用当前皮肤的状态色语义**, 不另立规则；辉光呼吸现走合成器友好写法(预渲染光晕伪元素只动 `opacity`), 勿再引入 infinite 非合成属性动画。

## P17. FAB 皮肤: 状态语义与角标含义要一致

**要点**：`ptac_skin`(chameleon/signal/static)存 GM 跨站共享, `applyFabSkin(c)` 只认 `countToday()`(遍历全部 UNITS 的今日 status)。「全部完成」= `success >= total`(total 含 disabled 站);「有未签」= 剩余 `total - success`。
**注意**：
- 角标颜色语义随皮肤/状态变(默认绿=成功数; chameleon 未完成红=剩余数; signal 红=失败数、琥珀=剩余数; **static 与变色逐态一致**)——读代码勿假定「角标=成功数」。
- **disabled 站**(`enabled:false`)不参与批量也永无 success, 若将来启用, `total` 应改为「参与站数」或跳过 disabled 计数, 否则 FAB 永不显示完成态。
- **静态皮肤 = 变色静态版(2026.11.24.4 新增)**: 保留 chameleon 的紫/绿状态色与角标语义, 仅以 `.fab.static` 禁全部 animation(静息无辉光呼吸/形变)。legacy `number`/`ring` 值在入口**内存归一为变色**(皮肤条 active 高亮与渲染一致), GM 值原样保留不回写 —— 静默回退, 用户不会收到迁移提示, 文档与测试钉死该行为。
- **靠边竖线颜色复用状态色语义(2026.11.24.4)**: 竖线(.edge)不自带配色规则, 颜色取当前皮肤的状态色; 故静态皮肤下竖线仍是纯状态色、不因禁动画而失色。
- **已删皮肤的历史教训(光环 ring / 数字 number, 2026.11.24 移除)**: 曾以 conic `--ring-grad` 分段 + radial 紫罩蒙版做圆缘光环, `ringBreathe`/`rayPulse` 两条 infinite 动画驱动呼吸与 `.ring-rays` 日冕射线; 非合成属性逐帧重绘是静息 CPU 高占用的真凶。两套皮肤连同 `numPulse`/`ringBreathe`/`rayPulse`/`.ring-rays`/`--ring-grad` 已全部删除 —— 这些实现细节只作历史留痕, 勿从 git 历史照搬回来。
- 皮肤选择条在面板头部「外观」按钮展开(`.panel.skin-open .skin-bar`), 面板 `overflow:hidden` 故选择条用文档流内嵌行而非浮层。
