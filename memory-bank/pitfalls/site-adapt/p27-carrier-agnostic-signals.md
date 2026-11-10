# 引擎判定通道通用化: 「文本专用」判定重构为「载体无关信号」时, 用翻译层保旧站零改动、用 flavor 参数保调用方语义差异
> 摘要: 「文本专用」判定重构为「载体无关信号」时，用翻译层保旧站零改动、用 flavor 参数保调用方语义差异。
> 触发: 重构判定通道, 接入属性态站, 改 readEntryState, 跑场景矩阵

- **触发**: P25 按钮重现检测与 signedByButton 判定原本只认按钮可见文本——NodeLoc 等 no-text 站(状态在 class/title/aria-label 上)结构上被排除(无文本翻转语义)。
- **判别**: 需求: 不破坏任何旧文本站行为的前提下让属性/class 态站也纳入重现提醒；两消费函数原本语义不同(signedByButton 只做精确 already 匹配, checkInButtonReappeared 额外带已签风味词否定守卫)→ 若把风味词直接塞进 checked 信号会让 signedByButton 变宽松误判。
- **处置**: ① 站点配置可显式描述**载体无关入口状态信号** `stateSignals: {checked:[], checkable:[]}`(kind: text/attr/attrEq/class/fn/exists), 引擎 `readEntryState` 统一消费; ② 旧文本字段不新开判定代码, 而是**自动翻译成等价信号**(deriveStateSignals: checked=[text alreadyCheckedInContent], checkable=[text checkInContent])→ 文本站配置零改动、行为逐位一致(等价性以 OLD/NEW 副本差分场景矩阵验证); ③ 改为 `readEntryState(unit, flavor)` 布尔参数, 调用方各传各的(true/false), 语义差异显式化。关键决策: 已签风味词守卫必须**仅在 checkInButtonReappeared 侧**(flavor=true)且**仅对含 text 信号的站生效**(`sig.checked.some(kind==='text')` 门控); 无 checkable 数组 = 反向常驻按钮站(蜂巢); 入口缺失语义随 noButtonMeansCheckedIn 走; 结构排除(无 checkInSelector / 无已签基准)→ deriveStateSignals null。教训: 引擎判定要加新载体时, 优先把「站点的状态表达」抽象为**载体无关信号**再统一读取, 而不是在旧判定函数里为每类站堆 if；验证时**差分 OLD/NEW 副本跑场景矩阵**比目测推演可靠。

## P27. 引擎判定通道通用化: 「文本专用」判定重构为「载体无关信号」时, 用翻译层保旧站零改动、用 flavor 参数保调用方语义差异

**背景**(2026-09-08 .26): P25 按钮重现检测与 signedByButton 判定原本只认按钮可见文本——NodeLoc 等 no-text 站(状态在 class/title/aria-label 上)结构上被排除(无文本翻转语义)。需求: 不破坏任何旧文本站行为的前提下让属性/class 态站也纳入重现提醒。
**做法**(重构而非扩展): ① 站点配置可显式描述**载体无关入口状态信号** `stateSignals: {checked:[], checkable:[]}`(kind: text/attr/attrEq/class/fn/exists), 引擎 `readEntryState` 统一消费; ② 旧文本字段不新开判定代码, 而是**自动翻译成等价信号**(deriveStateSignals: checked=[text alreadyCheckedInContent], checkable=[text checkInContent])→ 文本站配置零改动、行为逐位一致(等价性以 OLD/NEW 副本差分场景矩阵验证); ③ 两消费函数原本语义不同(signedByButton 只做精确 already 匹配, checkInButtonReappeared 额外带已签风味词否定守卫)→ 若把风味词直接塞进 checked 信号会让 signedByButton 变宽松误判 → 改为 `readEntryState(unit, flavor)` 布尔参数, 调用方各传各的(true/false), 语义差异显式化。
**关键决策**: ① 已签风味词守卫必须**仅在 checkInButtonReappeared 侧**(flavor=true)且**仅对含 text 信号的站生效**(sig.checked.some(kind==='text') 门控)——attr/class 信号站(如 NodeLoc)状态互斥精确, 不受文本风味词干扰; ② 无 checkable 数组 = 反向常驻按钮站(入口存在且非已签即可签, 蜂巢); ③ 入口缺失语义随 noButtonMeansCheckedIn 走(有→checked, 无→无法判定 null, 不判重现); ④ 结构排除(无 checkInSelector / 无已签基准)→ deriveStateSignals null, 与旧一致(MTeam 六站、HHCLUB)。
**教训**: 引擎判定要加新载体时, 优先把「站点的状态表达」抽象为**载体无关信号**再统一读取, 而不是在旧判定函数里为每类站堆 if——堆 if 会让旧站路径与新增路径互相污染(风味词这种「防误判启发式」一旦进了共享精确通道就是 bug)。语义有分歧的消费方要显式传参区分, 不要试图让共享函数猜意图。验证时**差分 OLD/NEW 副本跑场景矩阵**(同环境同输入对比输出), 比目测推演可靠——文本站逐位一致是重构的硬验收标准。

