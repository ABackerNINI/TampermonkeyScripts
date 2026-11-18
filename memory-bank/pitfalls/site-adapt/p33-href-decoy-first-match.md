# href 子串选择器的「整页唯一」只在入口页成立: 落地页可能有占位 href 的装饰元素(通知铃)在文档序上抢先命中, 按钮文案通道在该页静默失效
> 摘要: `a[href*="xxx.php"]` 首中元素随页面而变 — 落地页上占位 href(如通知铃 `href="attendance.php#"`)可排在真入口之前, querySelector 读到诱饵 → 按钮文案检测恒失败; 已签检测必须给落地页另配 landingCheckedInContent, 已签文案不能沿用旧口径猜。
> 触发: 签到成功但面板不确认, 已签检测失效, 落地页检测失败, 排查 querySelector 读错元素

- **触发**: Railgun(bilibili.download)2026.11.19: 脚本点击签到成功(真站落地页出现「签到成功」), 但面板行停「未确认」— 已签检测两条通道全空: ①`alreadyCheckedInContent` 沿用旧口径「签到已得」猜的, 真站已签横幅是 `<b>今日已签到</b>` → 首页按钮文案通道匹配不中; ②未配 `landingCheckedInContent`, 落地结算无通道可用。
- **判别**: 对着真站已签样本逐通道核: 首页 `a[href*="attendance.php"]` 唯一命中=横幅(未签 `<b>签到得魔力</b>`/已签 `<b>今日已签到</b>`)→ 首页通道文案校准即通; **attendance.php 落地页同选择器文档序首中是顶栏通知铃**(装饰元素占位 `href="attendance.php#"`, 可见可交互; 锚内 `<span>提醒</span>` 被 topbar.css `.nx-icon span{display:none}` 隐藏 → `visibleText`(innerText)读到**空文本**)→ 按钮文案通道在落地页读到铃铛, 配什么文案都恒失败 — 这类失效是**静默的**: 元素存在、可交互、只是文本对不上, 不报错。
- **处置**: ①`alreadyCheckedInContent` 按真站已签横幅实文校准(「今日已签到」), 不得沿用旧口径/相近词猜; ②落地确认另配 `landingCheckedInContent`(落地页签到后才出现的唯一文本, Railgun 为 `<h2>签到成功</h2>`, 机制同 P18/PTT); ②的必要性来自诱饵元素: 凡用 href 子串选择器定位入口的站, 落地页通道**必须**独立配置, 不能指望按钮文案通道跨页复用。
- **注意**: 「整页唯一 attendance 链接」的旧断言只对首页样本成立 — 换页(落地页/设置页等)可能新增带占位 href 的装饰元素且排在前面; 校准已签检测一律以**目标页面自己的** `querySelector` 首中元素为准, 不要拿首页结论跨页套。文案样本务必取「已签态」(未签态保存的页面看不出已签横幅长啥样, 见 P32 同款教训)。
