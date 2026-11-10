# no-text 图标按钮站(如 Discourse 论坛签到): 按钮无可见文本 → 引擎文本通道全不可用, 走 alreadyCheck 属性判定 + 自定义点击步骤
> 摘要: 按钮无可见文本时引擎文本通道全不可用，走 `alreadyCheck` 属性判定 + 自定义点击步骤。
> 触发: 接入 no-text 按钮站, 排查点击不执行, 配 alreadyCheck

- **触发**: NodeLoc 的「每日签到」按钮是**纯图标按钮**: `<button class="btn no-text btn-icon icon btn-flat checkin-button" title="每日签到" aria-label="每日签到">` 内部只有 `<svg>` + 零宽空格 `<span>`, **没有可见文本**; 点击后**同页**变化(class 加 `checked-in`、title/aria-label 变「您今天已经签到过了」)。
- **判别**: 若按常规站建模配 `checkInSelector` + `checkInContent`/`alreadyCheckedInContent`, 引擎的 `visibleText(el)` 会取到空串 → 点击前文案匹配、点击后已签判定全部失效(CLICK_CHECK_IN 步骤的 `checkInContent` 匹配不中直接 return 不点; detectAlreadyCheckedIn 按钮通道永远不中)；曾否决给 no-text 按钮硬塞 `checkInContent: '每日签到'`(那是 title/aria-label 属性, 不在 innerText, visibleText 取不到)或用 `alreadyPageCheck` 整页文本。
- **处置**: 已签判定用 `alreadyCheck` 自定义 async 函数(挂 `detectAlreadyCheckedIn` 第 1 通道, 三路径共用)——直接查 **class 与属性**: 按钮存在且 `classList.contains('checked-in')` 或 `getAttribute('title')`/`aria-label` 含已签词 → 已签; 未登录页无按钮 → false；点击走自定义 steps `{type:'function'}`: `waitForElement('button.checkin-button', 10s)` 找到 → 同样 class/属性守卫(已签不点) → `el.click()`(不配 CLICK_CHECK_IN)；成功确认 `successDetect:[{type:'func', fn: 轮询同一 class/属性已签态(16s)}]`(同页 AJAX, 无 pagehide → 走同页确认通道)；P25 重现检测补 `checkInSelector: 'button.checkin-button'` + `stateSignals`(载体无关, checked 用 class/attr, checkable 用 attr, 两态互斥)；判断按钮「有无文本」要看 innerText 而非肉眼(图标按钮 title/aria-label 是辅助技术文本, 不进 visibleText)。

## P26. no-text 图标按钮站(如 Discourse 论坛签到): 按钮无可见文本 → 引擎文本通道全不可用, 走 alreadyCheck 属性判定 + 自定义点击步骤

**症状/背景**(NodeLoc, 2026-09-08 接入): Discourse 论坛的「每日签到」按钮是**纯图标按钮**: `<button class="btn no-text btn-icon icon btn-flat checkin-button" title="每日签到" aria-label="每日签到">` 内部只有 `<svg>` + 零宽空格 `<span>`, **没有可见文本**; 点击后**同页**变化(class 加 `checked-in`、title/aria-label 变「您今天已经签到过了」)。若按常规站建模配 `checkInSelector` + `checkInContent`/`alreadyCheckedInContent`, 引擎的 `visibleText(el)` 会取到空串 → 点击前文案匹配、点击后已签判定全部失效(CLICK_CHECK_IN 步骤的 `checkInContent` 匹配不中直接 return 不点; detectAlreadyCheckedIn 按钮通道永远不中)。
**曾考虑又否决的做法**: 给 no-text 按钮硬塞 `checkInContent: '每日签到'`(那是 title/aria-label 属性, 不在 innerText, visibleText 取不到); 用 `alreadyPageCheck` 整页文本(标题在属性里同样取不到)。
**正确做法**:
- **已签判定**: `alreadyCheck` 自定义 async 函数(挂 `detectAlreadyCheckedIn` 第 1 通道, 被动/批量/落地结算三路径共用)——直接查 **class 与属性**: 按钮存在且 `classList.contains('checked-in')` 或 `getAttribute('title')`/`aria-label` 含已签词(如「已经签到过」) → 已签; 未登录页无按钮 → false。
- **点击**: 点击走自定义 steps `{type:'function'}`: `waitForElement('button.checkin-button', 10s)` 找到 → 同样 class/属性守卫(已签不点) → `el.click()`(不配 CLICK_CHECK_IN——其文案匹配通道对 no-text 不可用)。
- **成功确认**: `successDetect:[{type:'func', fn: 轮询同一 class/属性已签态(16s)}]`(点击是同页 AJAX, 无 pagehide → 走同页确认通道)。
- **P25 重现检测(.26 起已纳入)**: 该站无 `checkInContent`/`alreadyCheckedInContent` 文本字段, 但 .26 引擎重构后重现判定不再依赖 visibleText——补 `checkInSelector: 'button.checkin-button'` + `stateSignals`(载体无关): `checked=[{kind:'class',name:'checked-in'}, {kind:'attr',name:'title',contains:'已经签到过'}, {kind:'attr',name:'aria-label',contains:'已经签到过'}]`, `checkable=[{kind:'attr',name:'title',contains:'每日签到'}, {kind:'attr',name:'aria-label',contains:'每日签到'}]` → 已签/可签两态互斥(已签 title 含「已经签到过」不含「每日签到」, 反之亦然)不误判; flavor 风味词守卫被文本信号门控自动跳过(class/attr 信号站不受影响)。**加了 checkInSelector 的连带影响**: runUnit 复核日志会尝试读该按钮 visibleText(空串, 仅日志观感); highlightReappearedBtn 不再被 `!checkInSelector` 挡掉 → 重现时能高亮 NodeLoc 按钮(行为增强, 无副作用)。
- 若无此 class/attr 已签特征可用(按钮状态完全不带载体变化)→ 重现检测对该站无意义, 保持结构排除(deriveStateSignals null), 不做文本通道硬塞。
**注意**: no-text 图标按钮常见于 Discourse 等现代论坛/SPA; 判断按钮「有无文本」要看 innerText 而非肉眼(图标按钮 title/aria-label 是辅助技术文本, 不进 visibleText)。带属性的状态翻转(SVG 按钮 class/属性切换)一律走 alreadyCheck 属性判定 + **重现检测用 stateSignals 的 class/attr 信号**(.26), 不带文本翻转语义的站不要配按钮级文本字段。

