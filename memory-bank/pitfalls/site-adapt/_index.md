# site-adapt — PT 站点适配

> **本文件是生成物, 不要手改** —— 由 `commands run kb.index` 扫描本目录主题文件的三行头元数据生成; 新增 / 改名 / 改摘要后重跑即可, 冲突也只需重跑。
> 库内细路由见 [memory-bank/README.md](../../README.md)。
> **检索纪律**: 先读本索引定位, 再按需打开单个主题文件 —— **不要整读本目录**。
> **摘要**: PT 站点签到建模与解析 —— 表格/字段取值、状态判定通道、页面归属与 favicon、落地页标记、选择器随站点改版；新增站点或站点改版后按此排障。
> **触发**: 新增站点, 站点改版, 排障, 改签到建模, 改选择器, 发版前回归

## 主题

| 主题 | 一句话 | 触发词 |
|---|---|---|
| [p01-btschool-table-parsing.md](p01-btschool-table-parsing.md) | BTSchool 种子表行/列定位错位导致解析 0 行或字段整体错位，已修复过两次勿回退。 | 解析种子表, 改表格选择器, 排查行列错位, 排障 |
| [p02-calc-a-float-parse.md](p02-calc-a-float-parse.md) | 整数字符串解析函数吞掉浮点属性值，导致时魔字段恒为 0（现存 Bug）。 | 解析时魔字段, 改 BTSchoolHelper, 排查 calcA 恒 0 |
| [p03-comma-number-functions.md](p03-comma-number-functions.md) | `parseCommaInt` 与 `parseCommaNumber` 适用列不同，混用会解析出 NaN。 | 选千分位解析函数, 改数据库列, 排查 NaN |
| [p05-checkin-already-misjudge.md](p05-checkin-already-misjudge.md) | 站点文案变化会让「已签到」判定失效，导致重复点击或漏签。 | 新增签到站, 排查重复点击, 排查漏签, 强制批量 |
| [p06-checkin-cooldown.md](p06-checkin-cooldown.md) | 10 分钟冷却按 `origin+pathname` 分页面计时、iframe 直接 return、前台 sleep 看似无反应。 | 排查冷却, 改签到调度, 排查 iframe 不签, 排查页面无反应 |
| [p11-has-selector-csp.md](p11-has-selector-csp.md) | `:has()` 等选择器真正风险是站点页面结构改版，不是 CSP/沙箱。 | 站点改版, 更新选择器, 发版前回归 |
| [p15-favicon-fallback.md](p15-favicon-fallback.md) | 站点图标取用链与失败兜底，采集只收同站 http(s) 图标避免跨站信标与隐私泄露。 | 新增站点, 排查图标不显示, 改 favicon 收集, 面板渲染 |
| [p16-url-ownership.md](p16-url-ownership.md) | `match` 已删、归属由 `url` 推导，url 是唯一事实来源。 | 新增改站入口, 排查不归属, 写 match, 改 url |
| [p18-landing-page-text-marker.md](p18-landing-page-text-marker.md) | 落地页无已签反馈文案时勿用「到达即成功」宽判定，要用落地页独有文本标记且不绑 class。 | 接入落地页签到站, 排查卡 pending, 配 landingCheckedInContent |
| [p19-confirmmanual-successdetect.md](p19-confirmmanual-successdetect.md) | 站点实测有「点击后按钮变已签」反馈时应弃 `confirmManual` 改 `successDetect`，否则成功却卡 pending。 | 接入有按钮反馈站, 排查卡 pending, 改 confirmManual |
| [p21-visit-checkin-modeling.md](p21-visit-checkin-modeling.md) | MTeam 型(访问即签)与 HHCLUB 型(动态落地页特征)勿套按钮/静态文本通道。 | 接入非常规签到站, 配 successDetect, 配 alreadyCheck, 菜单展开型签到 |
| [p22-redirect-no-pagehide.md](p22-redirect-no-pagehide.md) | 报「未检测到成功特征」先分清点击后到底跳没跳——无 pagehide 且同页零特征必失败。 | 排查未检测到成功特征, 接入跳转型站, 排查隐藏元素点不动 |
| [p23-crossday-dom-snapshot.md](p23-crossday-dom-snapshot.md) | 旧 DOM 的「已签到」通用文案无日期锚，会把昨日已签误判为今日成功。 | 排查今日成功误报, 改今日判定, 批量后台标签 |
| [p24-detectonly-captcha.md](p24-detectonly-captcha.md) | 验证码/人工站勿配可点击 steps、勿让引擎默认点击——用 `detectOnly` 仅检测型。 | 接入验证码站, 排查误点, 配 steps, 配 detectOnly |
| [p25-button-reappear-suspect.md](p25-button-reappear-suspect.md) | 今日已签后按钮重现要常驻提醒并把 success 降级 `suspect`，不自动重签。 | 排查状态不一致, 配 stateSignals, 改提醒 UI, 改已签复核 |
| [p26-notext-icon-button.md](p26-notext-icon-button.md) | 按钮无可见文本时引擎文本通道全不可用，走 `alreadyCheck` 属性判定 + 自定义点击步骤。 | 接入 no-text 按钮站, 排查点击不执行, 配 alreadyCheck |
| [p27-carrier-agnostic-signals.md](p27-carrier-agnostic-signals.md) | 「文本专用」判定重构为「载体无关信号」时，用翻译层保旧站零改动、用 flavor 参数保调用方语义差异。 | 重构判定通道, 接入属性态站, 改 readEntryState, 跑场景矩阵 |
| [p31-nobutton-means-checkedin.md](p31-nobutton-means-checkedin.md) | 「已签后入口消失」别一律套 `noButtonMeansCheckedIn`，先用 `alreadyCheck` 把「入口消失」升级为「入口消失且已登录」。 | 接入入口消失型站, 排查批量漏签, 配 alreadyPageCheck |
