# 复杂站点步骤细节
> 摘要: 多步签到站(蜂巢/HDBao/慕雪阁等)的 function 步骤、整页跳转与落地页已签判定细节
> 触发: 改多步站点, 排查落地页跳回, 核对复杂步骤

### 复杂站点步骤细节

- **PTTime**(落地页无反馈型, 2026.09.08): 点击签到按钮整页跳到 `attendance.php`, 该落地页**不显示**「签到详情/签到已得」类按钮或文案(判定会卡 pending)→ 改用**落地页标记** `landingCheckedInContent: '总签到记录'`: 签到成功落地后页内出现「总签到记录」记录表头(`<p class="mt10 fwb">`, class 可能改版变化故**纯文本匹配不绑 class**)即判 success; 落地页判定**不写死 attendance.php**——由签到按钮 href 自动推导(`isLandingPageOf`: 解析 `checkInSelector` 的 href / `attendanceUrl` 优先), 同款语义站(NexusPHP 落地无反馈)照配 `landingCheckedInContent` 即可, 落地页叫 attendance.php/sign.php/... 都能识别(非落地页不检测防误报)。
- **HDBao / MuXueGe**(跳页式): `attendanceUrl` 直达 `attendance.php` → 点「立即签到」提交 → 页面刷新显示结果; `alreadyPageCheck:true` 用整页文本判定已签; 兜底 `click_checkin` 带 `ignoreError`。
- **蜂巢**(对话框式, 2026.09.07 站方改版为 shadcn/Radix 风格): 签到按钮固定 `data-slot="sidebar-user-check-in"`, 已签时文案为「已签到」→ 按钮级已签检测自动命中(步骤 2 前置 detect 与步骤内 `click_checkin` 双保险), 不再依赖旧「文本含签到不含已」函数选择器; 未签时点同一按钮; 等待 5s(站点限制, 3s 不够) → `click_checkin` → 对话框「签到/关闭」两步降级为**可选**(`ignoreError` + 2s 超时, 改版后是否仍弹对话框待实测, 无则自动跳过)。**2026.09.08 实测点击成功后按钮即时变「已签到」→ 弃 `confirmManual`(否则成功却卡 pending 待人工确认), 改 `successDetect:[{type:'text', selector: 同按钮, text:'已签到', timeout:5000}]`** → 点击后按钮变已签即 success, 5s 未变走通用回退(再等 2.5s)后记 failed(不再卡 pending; 若响应慢于 7.5s 会误报 failed, 实测暂稳)。
- **MTeam**(无按钮访问即签型, 2026.09.08 接入): 站方新站 `kp.m-team.cc` **没有签到按钮/页面**, 登录态访问主页 `/index` 即自动完成当日签到(隐式签到)。→ 建模: **显式 `match` 只认 kp 子域 `/index`**(详情页/其它子域不触发, 防把浏览页误当签到动作、详情页无卡片误报 failed 污染当日状态); 无 `checkInSelector`/`alreadyCheckedInContent`(无按钮可检可点); 步骤仅 `wait 3000` 等 SPA 渲染; 成功靠 `successDetect:[{type:'func', fn: 轮询 .ant-card-head-title 含「站点数据」或「站點數據」(16s)}]`(antd Card 标题, 简/繁双文本防 locale; 未登录被重定向登录页 → 无卡片 → failed, 需登录后脚本才会成功)。
- **DigitalCore / HD-Space / Kufirc / 凤凰PT / Sportz Bar**(无按钮访问即签型, 2026.09.08 接入, 同 MTeam 模板): 各站同样**无签到按钮/页面**, 登录态访问首页即自动完成签到。DigitalCore(SPA, iconify 导航)成功特征 = `a[href="/alltorrents"]` 文本含 All Torrents; HD-Space(传统站)成功特征 = 整页文本含「Last access:」; Kufirc(Luminance 传统站, 未登录显示 Login/Reactivate)成功特征 = `a[href="/torrents.php"]` 文本含 Torrents; 凤凰PT(NexusPHP 传统中文站)成功特征 = `a[href="torrents.php"][rel="sub-menu"]` 文本含「种子」(相对路径 + rel 属性, 无前导斜杠); Sportz Bar(xbtitFM 传统站)成功特征 = `a.level1-a.drop[href="#"]` 文本含 Torrent Menu。→ `match` 均限首页(根路径; DigitalCore 另容 `/index`, 凤凰PT/Sportz Bar 另容 `/index.php`); 无按钮字段; 步骤仅 `wait 3000`; `successDetect` 轮询特征(16s)。未登录 → 重定向/无特征 → failed。
- **HHCLUB**(菜单展开 + 动态落地页型, 2026.09.08 接入): 签到入口藏在头像下拉菜单: 先点 `img#user-avatar` 展开 → 再点菜单内 `a[href*="attendance.php"]`(`[签到得憨豆]`)→ 跳 `attendance.php`; 落地页渲染当月日历 `<p id="date-display">`(内容为**动态 `yyyy-mm`** 如 2026-09, 静态 `landingCheckedInContent` 字符串匹配不适用)→ 用 `alreadyCheck` 自定义 async 函数(非 attendance.php 落地页不判; 落地页上 `#date-display` 含**动态算出的当月前缀**才命中)→ 挂统一 `detectAlreadyCheckedIn` → 被动/批量/落地结算三路径自动共用。**2026.09.08 实测普通触发偶发「未检测到成功特征」+「整流程超时」, 强制重试即成功 → 点击后导航不稳定(SPA 路由/慢导航/首访点击无效)→ 修复双保险**: ① 头像改**点-验-重试函数步骤**: 点 avatar 后轮询签到链接**可见**(`getClientRects()>0`——菜单链接可能常驻 DOM 但 display:none, 隐藏元素程序化 `.click()` 不触发导航), 未现则再点(点击是 toggle), 最多 3 次; ② 补 `successDetect:[{type:'func', fn: 轮询 location.pathname 变 attendance.php 且 #date-display 含当月(8s)}]` → SPA 路由/800ms 后才跳转(无 pagehide)时同页也能确认, 不再秒判 failed; 整页跳转仍走落地结算(两通道并存)。已签当日菜单内容不变(无按钮级已签特征)。
- **NodeLoc**(no-text 图标按钮站, 2026.09.08 接入): Discourse 论坛, 首页有「每日签到」真实按钮 `button.checkin-button`(class 含 `btn no-text btn-icon icon btn-flat checkin-button`, **内部只有 svg 图标无可见文本**, title/aria-label=「每日签到」)。点击后同页变化(class 加 `checked-in`、title/aria-label 变「您今天已经签到过了」)→ **引擎按钮级文本通道(click_checkin 已签判定 / checkInContent 文案匹配)依赖 visibleText, 对 no-text 按钮不可用** → 建模: ① 已签判定 = `alreadyCheck` 自定义函数(detectAlreadyCheckedIn 第 1 通道): 按钮存在且 class 含 `checked-in` 或 title/aria-label 含「已经签到过」→ 未登录无按钮返回 false; ② 点击 = steps 里 function 步骤(`waitForElement` 找到按钮, 已签 class/title 守卫后才 `click()`); ③ 成功后 = `successDetect:[{type:'func', fn: 轮询按钮 class 含 checked-in / title 已签(16s)}]`。显式 `match` 限首页根路径(排除话题/节点页——非首页可能有其它按钮或无此按钮, 防误点/无按钮误报 failed)。**P25 重现检测(.26 通用化改造后已纳入)**: no-text 无文本 → 引擎原按钮级重现(纯 visibleText 翻转判定)结构上排除 → 补 `checkInSelector` + `stateSignals`(载体无关信号): checked=[class `checked-in`, attr title/aria-label 含「已经签到过」], checkable=[attr title/aria-label 含「每日签到」] → `readEntryState` 直接读 class/attr, 已签/可签两态互斥(已签 title 不含「每日签到」, 可签 title 不含「已经签到过」)不误判。引擎文本站行为不变(旧字段自动翻译)。
- **HDHome**(已签后入口变纯文本型, 2026.09.19 接入): NexusPHP 传统站, 顶部信息栏未签时是
  `<a href="attendance.php" class="faqlink">签到得魔力</a>`, 已签后**该链接整个消失**, 同一位置换成魔力值行内纯文本
  `<font class="color_bonus">魔力值 </font>[<a href="mybonus.php">使用</a>]: 10.4&nbsp;(签到已得10)`
  → 已签信息**不在按钮上**(按钮级文案翻转通道失效), 但**页面仍留有已签文本**。
  → 建模(2026.09.19.3 定稿): 常规 `checkInSelector`/`checkInContent`(点击照旧; 文案为**无方括号**的
  「签到得魔力」, 与其它站的「[签到得魔力]」不同) + `alreadyCheckedInContent:'签到已得'` +
  **`alreadyPageCheck:true`**(整页文本) + **`alreadyCheck`** 自定义判定(同步, `alreadyCheckBudgetMs:0`)。
  **为什么不用 `noButtonMeansCheckedIn`**(曾用 .2 版试过, 用户反馈"不够保险"后回退): 它只回答
  「入口没了?」却回答不了「你登录了吗?」—— 未登录(cookie 过期)/维护页同样没有签到入口,
  会被判成已签 → **把漏登录报成"今日已成功"**(最坏的一类误报: 面板绿着, 当天根本没签)。
  → 换成 `alreadyCheck` 把两件事一起问:
  ```js
  alreadyCheck: () => {                                   // 同步, 声明 alreadyCheckBudgetMs: 0
      if (document.querySelector('a[href*="attendance.php"]')) return false;  // 入口还在 → 未签
      return !!document.querySelector('a[href*="mybonus.php"], font.color_bonus'); // 入口消失 + 登录态证据
  }
  ```
  登录态证据 = 魔力值信息栏(`a[href*="mybonus.php"]` 或 `font.color_bonus`), 它只在**登录后**的
  顶部信息栏出现。两通道互补: `alreadyCheck` 覆盖「已签但文本没渲染/文案改版」,
  `alreadyPageCheck` 覆盖「登录态证据选择器改版」; 都不命中(未登录/无入口)→ 落 `unconfirmed`
  (可重试、不计失败), **不会假成功**。
  点击 `attendance.php` 链接即由站方记账(落地页短暂停留后跳回首页), 无需额外步骤。
  仿真回归 `tests/ptautocheckin/sim-hdhome-pagetext.js` 四条断言: 已签零点击 / 点击落地结算 /
  入口消失无文本仍判已签 / **未登录页不得判已签**(最后一条是 `noButtonMeansCheckedIn` 的盲区)。
  > 踩坑: `alreadyCheckBudgetMs` 必须写在 `alreadyCheck` **8 行以内**(静态校验器的扫描窗口),
  > 函数体写太长会被判"未声明成本"(`check-ptac-budget.js` C2)。
- **贴吧吧页**: 归属由 `url` 的 `kw` 参数推导(`matchUnit` 逐参比较, 同域多个吧互不误签); 已关注吧才有签到按钮(未关注按失败提示)。
