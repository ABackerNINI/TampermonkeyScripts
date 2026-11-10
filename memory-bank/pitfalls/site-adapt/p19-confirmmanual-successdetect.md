# confirmManual 站若实测有"点击后按钮变已签"反馈 → 应弃 confirmManual 改 successDetect, 否则成功却卡 pending
> 摘要: 站点实测有「点击后按钮变已签」反馈时应弃 `confirmManual` 改 `successDetect`，否则成功却卡 pending。
> 触发: 接入有按钮反馈站, 排查卡 pending, 改 confirmManual

- **触发**: 蜂巢 2026.09.08 实测: 已签到、页面按钮显示绿 ✓「已签到」, 但脚本日志 `无自动确认特征(confirmManual), 记为 pending` → 状态卡 pending。
- **判别**: 蜂巢早期站方无按钮文案反馈时设了 `confirmManual:true`(点击后一律 pending 待人工确认); 该分支在 `runUnit` 第 6 步**先于 `detectSuccess`(含"按钮文案变已签"回退检测)return** → 即使点击后按钮已变「已签到」也不检测, 前提"无可靠成功特征"已随站点改版失效却未同步。
- **处置**: 弃 `confirmManual`, 配 `successDetect:[{type:'text', selector: 签到按钮, text: 已签文案, timeout:5000}]` → 点击后按钮变已签即 success；超时走通用回退(按钮文案 2.5s)后记 failed(语义: 宁 failed 可重试/可查, 不卡 pending)。`successDetect` 的 text 检测须把 `selector` 限定到签到按钮本身(勿用 body——页面其它区域残留「已签到」会误报)；确认按钮确实随签到成功变文案(数日观察无 failed 误报); 检查顺序: 前置 `detectAlreadyCheckedIn`(每次访问)与步骤内 `click_checkin` 的"已含已签文案则不点击"双保险不变, 防重复点击。

## P19. confirmManual 站若实测有"点击后按钮变已签"反馈 → 应弃 confirmManual 改 successDetect, 否则成功却卡 pending

**症状**(蜂巢 2026.09.08 实测): 已签到、页面按钮显示绿 ✓「已签到」, 但脚本日志 `无自动确认特征(confirmManual), 记为 pending` → 状态卡 pending。面板一直显示 pending; 需**再次访问该站**由 `detectAlreadyCheckedIn` 命中「已签到」才改写 success; 批量调度中则以 pending 结算、且该站在 10 分钟冷却/待确认期内被排除重试。
**原因**: 蜂巢早期站方无按钮文案反馈时设了 `confirmManual:true`(点击后一律 pending 待人工确认); 该分支在 `runUnit` 第 6 步**先于 `detectSuccess`(含"按钮文案变已签"回退检测)return** → 即使点击后按钮已变「已签到」也不检测, 前提"无可靠成功特征"已随站点改版失效却未同步。
**正确做法**(方案 B, 2026-09-08): 弃 `confirmManual`, 配 `successDetect:[{type:'text', selector: 签到按钮, text: 已签文案, timeout:5000}]` → 点击后按钮变已签即 success; 超时走通用回退(按钮文案 2.5s)后记 failed(语义: 宁 failed 可重试/可查, 不卡 pending)。**要点**:
- `successDetect` 的 text 检测须把 `selector` 限定到签到按钮本身(勿用 body——页面其它区域(如历史对话框)残留「已签到」会误报);
- 确认按钮确实随签到成功变文案(数日观察无 failed 误报); 若站点响应慢于 successDetect+回退总超时(~7.5s)会误报 failed → 调大 timeout 或退回 pending 方案;
- 检查顺序: 前置 `detectAlreadyCheckedIn`(每次访问)与步骤内 `click_checkin` 的"已含已签文案则不点击"双保险不变, 防重复点击。

