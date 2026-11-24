# FAB 皮肤: 状态语义与角标含义要一致
> 摘要: FAB 角标颜色语义随皮肤/状态变，读代码勿假定「角标=成功数」；动效开关与皮肤正交、legacy 静默归一。
> 触发: 改 FAB 皮肤/动效, 排查角标含义, 改辉光动画, 启用 disabled 站

- **触发**: `ptac_skin`(chameleon/signal)存 GM 跨站共享, `applyFabSkin(c)` 只认 `countToday()`(遍历全部 UNITS 的今日 status); legacy 值(static/number/ring)在入口内存归一为变色。动效另由正交布尔开关 `ptac_motion` 控制, 不参与皮肤单选。
- **判别**: 「全部完成」= `success >= total`(total 含 disabled 站)；「有未签」= 剩余 `total - success`；角标颜色语义随皮肤/状态变(默认绿=成功数; chameleon 未完成红=剩余数; signal 红=失败数、琥珀=剩余数)——读代码勿假定「角标=成功数」。
- **处置**: **disabled 站**(`enabled:false`)不参与批量也永无 success, 若将来启用 `total` 应改为「参与站数」或跳过 disabled 计数, 否则 FAB 永不显示完成态；**关动效** = host 挂 `.motion-off`, shadow 内用 `:host(.motion-off) .fab`/`::after`/`.fab.chameleon` 禁三类 animation, 只停动画、**不改状态色与角标语义**, 勿以为「禁动画」等于改语义(`ptacHlPulse` 属签到逻辑不在停用范围)；legacy static/number/ring **内存归一为变色**(渲染与皮肤条高亮一致), GM 存储原样保留、**不回写**(静默回退, 不加迁移提示代码), 其中 legacy static 还把动效开关初始化为关；靠边竖线颜色**直接复用当前皮肤的状态色语义**, 不另立规则；辉光呼吸现走合成器友好写法(预渲染光晕伪元素只动 `opacity`), 勿再引入 infinite 非合成属性动画。

## P17. FAB 皮肤: 状态语义与角标含义要一致

**要点**：`ptac_skin`(chameleon/signal)存 GM 跨站共享, `applyFabSkin(c)` 只认 `countToday()`(遍历全部 UNITS 的今日 status)。「全部完成」= `success >= total`(total 含 disabled 站);「有未签」= 剩余 `total - success`。动效由正交布尔开关 `ptac_motion` 控制, 与皮肤单选、靠边开关互不相干。
**注意**：
- 角标颜色语义随皮肤/状态变(默认绿=成功数; chameleon 未完成红=剩余数; signal 红=失败数、琥珀=剩余数)——读代码勿假定「角标=成功数」。
- **disabled 站**(`enabled:false`)不参与批量也永无 success, 若将来启用, `total` 应改为「参与站数」或跳过 disabled 计数, 否则 FAB 永不显示完成态。
- **动效开关(2026.11.24.5 取代静态皮肤)**: 关动效 = host 挂 `.motion-off`, shadow 内用 `:host(.motion-off)` 选中宿主(宿主不在 shadow 树内, 普通后代选择器选不中), 停 `.fab`/`.fab::after`/`.fab.chameleon` 三类 animation; 只停动画、保留紫/绿状态色与角标语义; `ptacHlPulse`(签到按钮高亮)属签到逻辑, 不在停用范围。切皮肤/靠边不动动效, 切动效也不重置皮肤/靠边。
- **legacy static 静默迁移(D8, 2026.11.24.5)**: 旧 `ptac_skin='static'` 在入口**内存归一为变色**(皮肤条 active 高亮与渲染一致), 同时把动效开关初始化为关; GM 原值(`ptac_skin` 与 `ptac_motion`)一律原样保留、**不回写**, 下次用户手动切换才覆盖 —— 静默回退, 用户不会收到迁移提示, 文档与测试钉死该行为。`number`/`ring` 同样归一变色但动效保持默认开。
- **靠边竖线颜色复用状态色语义(2026.11.24.6, fix2 B/C 批几何变了但语义不变)**: 竖线(.edge)不自带配色规则, 颜色取当前皮肤的状态色; 真贴边锚点改 `right:0`、展开内移 `right:20px`、命中区并集与 `pointermove` 判定只改几何/指针判定, 不碰配色与角标逻辑(正交于皮肤/动效开关); 故关动效时竖线仍是纯状态色、不因禁动画而失色。
- **D 批静息验收确认语义不变(2026.11.24.7)**: 关动效态与靠边态经 CDP 5s 静息实测，两态均无 FAB 归因的 Recalculate Style/Paint；靠边态保留的 `::after` 辉光只动 `opacity`(合成属性)不产生重绘，动效开关只禁 animation、不改状态色与角标语义(复用上面 P17 主结论)，`ptacHlPulse` 与 200ms 签到 tick 属签到逻辑不计入 UI 负载。
- **已删皮肤的历史教训(光环 ring / 数字 number / 静态 static, 2026.11.24 移除)**: 曾以 conic `--ring-grad` 分段 + radial 紫罩蒙版做圆缘光环, `ringBreathe`/`rayPulse` 两条 infinite 动画驱动呼吸与 `.ring-rays` 日冕射线; 非合成属性逐帧重绘是静息 CPU 高占用的真凶。三套皮肤连同 `numPulse`/`ringBreathe`/`rayPulse`/`.ring-rays`/`--ring-grad`/`.fab.static` 已全部删除, 关动效改由正交的 `data-motion` 开关承载 —— 这些实现细节只作历史留痕, 勿从 git 历史照搬回来。
- 皮肤选择条在面板头部「外观」按钮展开(`.panel.skin-open .skin-bar`), 面板 `overflow:hidden` 故选择条用文档流内嵌行而非浮层。
