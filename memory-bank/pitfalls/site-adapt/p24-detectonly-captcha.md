# 签到需人工验证(验证码)的站(如 U2): 勿配可点击 steps / 勿让引擎默认点击——用 detectOnly 仅检测型
> 摘要: 验证码/人工站勿配可点击 steps、勿让引擎默认点击——用 `detectOnly` 仅检测型。
> 触发: 接入验证码站, 排查误点, 配 steps, 配 detectOnly

- **触发**: U2 的签到(`showup.php`)要求**人工输入内容验证**, 无法自动化; 用户要的是「只检测状态, 不执行自动签到」。
- **判别**: ① `steps` **缺省为 `[CLICK_CHECK_IN]`**——只要配了 `checkInSelector` 而未显式 `steps`, 引擎会自动「等按钮 → 点击」, 必然触发不可自动化的流程; ② 已签检测主通道(按钮文案)命中即 success 不点击, 但**未命中**时会继续走「写冷却 → 点击 → 点击后确认」, 无导航无特征会记 failed; ③ 用 `steps: []` + `confirmManual: true` 硬凑 → 未签时写 pending + 白写冷却, 语义全错; ④ `enabled: false` 只挡批量不挡被动访问(被动仍跑 runUnit)。
- **处置**: unit 配 `detectOnly: true` → `runUnit` 在已签检测(步骤2)未命中后直接返回 `skipped`(reason `detect_only`), **不点击/不写冷却/不记失败**; 命中已签照常写 success → 手动签完后任意访问自动转绿; `remainingCandidates` 排除 `detectOnly` 站(不进普通/强制批量); 面板行对 `detectOnly && 今日无状态` 显示「需人工签到(验证码), 不自动签」；该型站仍需 `checkInSelector` + `alreadyCheckedInContent`(按钮文案「立即签到→已签到」走标准按钮通道即可); 选择器仍**不依赖 class**(U2 按钮带 `faqlink` class, 但 2026.09.07 已证实该 class 会随改版消失) → 用 `a[href*="showup.php"]`。判定「未检测到已签」时不可点 `立即签到`(会把人带到验证码页且可能消耗一次机会/触发风控)。

## P24. 签到需人工验证(验证码)的站(如 U2): 勿配可点击 steps / 勿让引擎默认点击——用 detectOnly 仅检测型

**背景**(U2 2026-09-08 接入): U2 的签到(`showup.php`)要求**人工输入内容验证**, 无法自动化; 用户要的是「只检测状态, 不执行自动签到」——脚本负责跟踪今日是否已签, 实际签到由人工在站内完成。
**引擎约束**(据此设计新站型): ① `steps` **缺省为 `[CLICK_CHECK_IN]`**——只要配了 `checkInSelector` 而未显式 `steps`, 引擎会自动「等按钮 → 点击」, 必然触发不可自动化的流程; ② 已签检测主通道(按钮文案)命中即 success 不点击, 但**未命中**时会继续走「写冷却 → 点击 → 点击后确认」, 无导航无特征会记 failed; ③ 用 `steps: []` + `confirmManual: true` 硬凑 → 未签时写 pending + 白写冷却, 语义全错; ④ `enabled: false` 只挡批量不挡被动访问(被动仍跑 runUnit)。
**修复**(2026-09-08 .17, 引擎级小扩展 `detectOnly`): 
- unit 配 `detectOnly: true` → `runUnit` 在已签检测(步骤2)未命中后直接返回 `skipped`(reason `detect_only`), **不点击/不写冷却/不记失败**; 命中已签照常写 success → 手动签完后任意访问自动转绿;
- `remainingCandidates` 排除 `detectOnly` 站(不进普通/强制批量——开标签也只能 skipped, 无意义还拖慢批量);
- 面板行对 `detectOnly && 今日无状态` 显示「需人工签到(验证码), 不自动签」, 避免用户误以为脚本漏检/坏了。
**建模要点**: 该型站仍需 `checkInSelector` + `alreadyCheckedInContent`(按钮文案「立即签到→已签到」走标准按钮通道即可, 不必写 `alreadyCheck` 自定义函数); 选择器仍**不依赖 class**(U2 按钮带 `faqlink` class, 但 2026.09.07 已证实该 class 会随改版消失) → 用 `a[href*="showup.php"]`。以后再有验证码/人工站照此办理, 勿再往 `steps` 里塞点击。
**注意**: 若某天 U2 移除验证码可自动签, 去掉 `detectOnly: true` + 确认 steps(默认即可)即恢复自动; 判定「未检测到已签」时不可点 `立即签到`(会把人带到验证码页且可能消耗一次机会/触发风控)。

