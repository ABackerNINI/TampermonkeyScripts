# 落地页无反馈型签到站(如 PTT): 勿用"点击到达落地页即成功"的宽判定, 要用落地页独有文本标记且不绑 class
> 摘要: 落地页无已签反馈文案时勿用「到达即成功」宽判定，要用落地页独有文本标记且不绑 class。
> 触发: 接入落地页签到站, 排查卡 pending, 配 landingCheckedInContent

- **触发**: 点击签到按钮 → 整页跳转 `attendance.php`, 但该落地页**不显示**「签到详情/签到已得」类按钮或文案。
- **判别**: 落地结算 `settleUnitOnLandingPage`/被动模式 `detectAlreadyCheckedIn` 均查无已签特征 → 状态卡 pending(批量 10s 观察后以 pending 结算; 被动模式甚至可能被"上次 pending 未确认"逻辑翻成 failed)——实际已签到却被记为未确认/失败；根因: 已签检测主通道是**按钮/页面文案**, 该类站落地页没有任何已签反馈文案, 引擎无特征可确认。曾否决给"点击后正确到达 attendance.php 落地页"一律判 success——**不保险**: 无法区分"真签到成功"与"未登录被重定向/登录页/错误页/落地页本身也渲染了记录表"等。
- **处置**: 新可选配置 `landingCheckedInContent` = 落地页上**签到成功后才出现**的唯一文本(PTT 为「总签到记录」表头)；作 `detectAlreadyCheckedIn` 的第 4 通道做**整页文本匹配**, 落地页判定 `isLandingPageOf` 由按钮 href 推导(`landingPathOf`, **勿写死 attendance.php**)；**勿绑 class/结构选择器** → 纯 `visibleText(body).includes(标记文本)`；该通道挂在统一 `detectAlreadyCheckedIn` 上 → 被动/批量后台标签/调度落地结算三种路径自动共用；若签到按钮不是 href 型则 `landingPathOf` 解析失败 → 此通道自动失效, 退回落回原检测(勿再发明"到达即成功")。

## P18. 落地页无反馈型签到站(如 PTT): 勿用"点击到达落地页即成功"的宽判定, 要用落地页独有文本标记且不绑 class

**症状**(PTTime/PTT 实测): 点击签到按钮 → 整页跳转 `attendance.php`, 但该落地页**不显示**「签到详情/签到已得」类按钮或文案 → 落地结算 `settleUnitOnLandingPage`/被动模式 `detectAlreadyCheckedIn` 均查无已签特征 → 状态卡 pending(批量 10s 观察后以 pending 结算; 被动模式甚至可能被"上次 pending 未确认"逻辑翻成 failed)——实际已签到却被记为未确认/失败。
**原因**: 已签检测主通道是**按钮/页面文案**; 该类站落地页没有任何已签反馈文案, 引擎无特征可确认。
**曾考虑又否决的做法**: 给"点击后正确到达 attendance.php 落地页"一律判 success——**不保险**: 无法区分"真签到成功"与"未登录被重定向/登录页/错误页/落地页本身也渲染了记录表"等情况, 宽泛到达即成功会误报。
**正确做法**(2026-09-08 PTT 落地): 新可选配置 `landingCheckedInContent` = 落地页上**签到成功后才出现**的唯一文本(PTT 为「总签到记录」表头):
- 实现上作为 `detectAlreadyCheckedIn` 的第 4 通道: 仅当设了该字段 **且** 当前页为签到动作导向的落地页时做**整页文本匹配**; 落地页判定 `isLandingPageOf` = pathname 与签到按钮 href 解析路径一致(容 query; host 由调用方 matchUnit 保证)。**勿写死 attendance.php**——落地页命名各站不同(attendance/signin/任意 php), 一律由按钮 href 推导(`landingPathOf`: 显式 `attendanceUrl` 优先, 否则正则解析 `checkInSelector` 的 `[href=...]` 属性选择器取值, 相对 `unit.url` 解析), 扩展性更强; 非落地页不检测 → 天然防首页/其它区域同文本误报。
- **勿绑 class/结构选择器**(用户实测 `<p class="mt10 fwb">总签到记录</p>` 的 class 会随改版变)→ 纯 `visibleText(body).includes(标记文本)`; 若站方把文本也改掉, 症状会回到"卡 pending", 按新页面 HTML 更新标记文本即可(此时宁可 pending/failed 也不误报 success——签到状态可人工核对)。
- 该通道挂在统一 `detectAlreadyCheckedIn` 上 → 被动/批量后台标签/调度落地结算三种路径自动共用, 无需在各处另加分支。
**注意**: 曾把落地页写死为 `attendance.php`(2026-09-08 初版), 已改为按钮 href 推导(见上 bullet)——落地页命名任意都能识别; 若签到按钮不是 href 型(如纯按钮)则 `landingPathOf` 解析失败 → 此通道自动失效, 退回落回原检测(勿再发明"到达即成功")。

