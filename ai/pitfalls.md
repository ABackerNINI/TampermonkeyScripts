# 易错点与坑（Pitfalls）

> 按「后果严重度」排序。每条尽量给出**症状 → 原因 → 正确做法**，方便排障时快速定位。
> 排障入口：目标页面 F12 → Console，观察 `[ScriptName]` 前缀日志。

## P1. BTSchool 表格解析：行/列定位（已修复过两次，勿回退）

**症状**：`parseTorrentTable` 返回 0 行，或字段值整体错位（评论数/大小/种子数取错）。
**原因**：
- BTSchool 种子表中 `<tr>` **没有** `rowfollow` 类，类在 `<td>` 上 → `tr.rowfollow` 选不中任何行；
- 标题列内部嵌套 `<table class="torrentname">`（3 个内层 `<td>`）→ 裸 `querySelectorAll('td')` 深度搜索返回 14 个而非 11 个单元格，索引整体偏移。
**正确做法**：
```js
const rows = table.querySelectorAll('tbody > tr:has(> td.rowfollow)');
const cells = row.querySelectorAll(':scope > td');   // 只取直接子单元格
```
**注意**：`:has()` / `:scope` 为现代浏览器特性（Chrome 105+ / Safari 15.4+）；若支持老旧浏览器需退回「遍历 `tbody > tr` + 首子元素含 `rowfollow` 判断」。

## P2. BTSchoolHelper 时魔字段：整数字符串解析吞掉浮点属性值（现存 Bug）

**症状**：`t.calcA`、`t.calcAve` 恒为 `0`，但单元格 `data-calc-a="0.0005235113302643479"` 明明有值。
**原因**：第 246/251 行用 `parseCommaIntSafe(attr, 0)` 解析**浮点**属性。`parseCommaInt` 内部用 `/^-?\d+$/` 校验，含小数点 → NaN → 兜底 0。
**正确做法**：改用 `parseCommaNumberSafe(attr, 0)`（浮点解析）。
> ⚠️ 若排序/筛选逻辑依赖时魔数值，此 Bug 会导致结果失真。修复同时更新 `ai/scripts/BTSchoolHelper.md` 与 `@version`。

## P3. 千分位数字解析的两种函数不可混用

- `parseCommaInt`：只接受**纯整数**（`/^-?\d+$/`），带小数点/单位返回 NaN；
- `parseCommaNumber`：浮点可解析（去逗号后 `Number()`），带单位仍 NaN。
- 数据库列（评论/做种/下载/完成数）用 Int 版；`data-calc-a` 等浮点属性、`data-calc-ave` 用 Number 版。
- 规则：**拿不准就用 Number 版 + Safe 兜底**。

## P4. `forEach` 回调中 `return []` / `return {}` 无意义

**症状**：看似"跳过"了某行，实则只是返回了个被忽略的值，行仍继续往下执行（或产生困惑）。
**原因**：`forEach` 忽略回调返回值；早期版本在行校验失败时写 `return [];`。
**正确做法**：需要中断当次迭代用 `return;`；需要中断整个循环改用 `for...of` + `break`。

## P5. 站点签到「已签到」误判导致重复点击或漏签

**症状**：已签到仍反复点按钮 / 未签到却认为已签。
**原因**：`click_checkin` 依赖 `checkInContent`（应含文案）与 `alreadyCheckedInContent`（已签到特征）做判断，站点文案一旦变化（繁简、改版）即失效。
**正确做法**：
- 新增/失效站点排查顺序：`未匹配到任何站点规则` → `match` 正则；`未找到签到按钮…(已签到?)` → `checkInSelector`；`签到按钮内容不匹配` → `checkInContent`。
- 若站配置了 `noButtonMeansCheckedIn`(如 BTSchool)：**找不到签到按钮=已签属预期**。排查时注意该站按钮是否确实随已签消失, 避免在按钮本就缺失的页面(无签到入口的栏目页)误判已签。
- 蜂巢（pting.club）2026.09.07 改版为 shadcn 风格后改按 `button[data-slot="sidebar-user-check-in"]` 精确定位：文案含「已签到」用于已签检测（不再排除「已」）；对话框按钮（若仍有）继续用文本 <4 且含「签到」过滤，其结构若再有变需按 HTML 复查。
- **强制批量签到（面板底部批量按钮右侧图标钮浮出的琥珀色按钮）**：会无视 10 分钟冷却再次点击「今日失败」的站, 属**有风控风险操作**——若该站连续失败(网络/站点故障), 强制重试会连环触发点击, 可能触发站点反爬。实现上每次点击前仍重写冷却（再失败进入新一轮 10min 冷却），不会同一秒内连环点，但仍应谨慎使用。

## P6. 签到防重复机制的坑（10 分钟间隔）

- 记录 key = `lastActivation_` + `origin + pathname`：**含路径**，同一站点不同页面各自计时；若期望"全站一次签到"需改为仅 `origin`。
- 脚本在 iframe 中直接 return（`window.top !== window.self`），iframe 页面不会签到。
- 等待逻辑先 `loadLastActivationTime` 再 `saveLastActivationTime`：首次运行会立即执行（lastTime=0）。
- **注意**：`waitForFromLastActivation` 在激活记录存在且未满 10 分钟时会在前台 sleep（可能长达数分钟），期间页面看似无反应——属预期行为。

## P7. `waitForElement` 的写法陷阱（PTAutoCheckIn）

```js
const origResolve = resolve;
resolve = (value) => { clearTimeout(timer); origResolve(value); };
```
- 覆盖 `resolve` 仅为**在命中时清除超时定时器**，属合法但易被误读；重构时勿删掉 `clearTimeout`，否则元素在超时前命中后定时器仍会触发 `reject`（Promise 已定型，无副作用但浪费）。
- 函数选择器每次轮询都会执行，需保证**无副作用、可重复调用**（蜂巢对话框查找函数即为此模式）。

## P8. 键盘快捷键误触输入框

**症状**：在弹幕框/搜索框打字触发全屏/跳转。
**原因**：未检查 `document.activeElement`。
**正确做法**：所有 `keydown` 处理先判 `input` / `textarea` / `select` 直接 `return`（BilibiliEnterFullscreen 与 BTSchoolHelper 均已实现，新增快捷键照抄）。

## P9. 事件与页面生命周期

- BilibiliEnterFullscreen 依赖 `window.onload`：若 B 站播放器改版为 SPA 动态渲染，`onload` 后按钮仍可能未出现 → 靠轮询（50 次 × 200ms）兜底；若仍失效需评估改 `MutationObserver`。
- 监听注册要防重复：`document.addEventListener` 每次脚本执行注册一次（Tampermonkey 刷新页面即全新执行，一般无碍；但 `GM_` 持久化内容要幂等）。

## P10. 命名不一致（现存待修，见 roadmap）

`scrollToNext2xFreeTorrent` 内调用 `getBottomTorrentId()`（小写 d）与 `arrayFindIndex`，而实际定义是 `getBottomTorrentID()`（大写 D）与 `arrayFind`。**当前未启用所以不报错**；启用 N 键功能前必须先改名对齐，否则直接 ReferenceError。

## P11. `:has()` 等选择器在站点端页面可能被 CSP/沙箱影响

若站点开启严格 CSP 或 Tampermonkey 在 `document-start` 注入受限，`querySelectorAll` 一般不受影响；真正风险是**页面结构改版**（类名/嵌套层级变化）。以 `src/BTSchoolTorrentsTableSample.html` 为回归样本，站点改版后先对照该样本更新选择器再发版。

## P12. 文件/编码与仓库卫生

- 保持 UTF-8（无 BOM），避免中文注释乱码。
- `.vscode/settings.json` 的 `cSpell.words` 用于站点域名等专有名词拼写检查白名单，新增站点域名时同步补充。
- 新增测试 HTML 样本（如 BTSchoolTorrentsTableSample.html）命名清晰，勿提交含真实账号/会话信息的页面（脱敏后提交）。

## P13. AI 协作纪律：计划阶段改码 / 未审核即提交

**症状**：让 AI「做个方案/分析」，结果它直接改了代码；或让 AI 改完代码，它顺手 `git commit` / `git push` 了。
**原因**：AI 未区分「计划」与「实施」的任务边界，或把「完成修改」误当「可以提交」。
**正确做法**：
- 计划/分析类任务：只输出方案，**不改任何代码文件**；确需改码才能得出结论时先停下征询用户。
- 实施类任务：修改完成后**汇报改动并等待用户审核**，`git commit` / `git push` 一律由用户执行或明确指示。
- 该纪律为最高优先级约定，详见 `ai/conventions.md` 第 0 节「核心铁律」。

## P14. 测试纪律违规：给测试留通道 / 为过测试改生产代码

**症状**：
- 生产脚本中出现仅测试用的分支/钩子（`window.__TEST__`、URL 参数开启测试模式、把内部函数挂到 `window` 等）；
- 测试失败后，通过弱化断言、跳过逻辑、写死返回或让生产代码迎合测试来「变绿」。
**原因**：把测试便利混入生产路径；对测试失败归因错误（先怀疑生产，未排查测试自身）。
**正确做法**：
- 可测性通过**纯函数化 / 参数注入 / 配置与逻辑分离**实现，而不是在生产代码中留测试专用通道；
- 测试失败先查测试自身（断言/样本/环境），再查生产代码的真实缺陷；
- 生产代码只修真实问题；测试与真实行为冲突时以真实行为为准并修正测试。
- 详见 `ai/conventions.md` 第 8 节「测试与可测性约定」。

## P15. 站点图标(favicon)的取用与失败兜底

**要点**：面板站点图标取用链 = 配置 `favicon` → GM 路过收集的真实 `<link rel="icon">` URL(`ptac_favicon_<unitId>`, 仅收 http(s), 脚本跑在该站时写入) → 站点根 `/favicon.ico` → 无则不发图。
**注意**：
- 图标 URL 与站页面一致时命中浏览器 HTTP 缓存(零额外流量)；不同源/冷启动时是普通图片加载, 失败(无图标/路径非标/防外链/站点不可达)会自动隐藏——`img` 的 `error` 事件**不冒泡**, 必须用捕获阶段(`addEventListener(..., true)`)委托到列表容器, 且行每次 render 重建, 不能绑在行元素上。
- 收集只写当前匹配站(同 host 多吧共享同一 icon, 各 unit 各存一份, 量级可忽略)；没逛过的站靠根路径推导, 个别非标准路径站会显示不出(隐藏兜底, 可用 `favicon` 字段指定)。
- 不要引入第三方图标聚合服务(国内不可达 + 泄露浏览站点的隐私面)。

## P16. 页面归属判定: match 已删, url 推导语义要记牢

**现状**：所有 unit 不再写 `match`, `matchUnit` 显式 `match`(正则/函数)优先、缺省由 `url` 推导。推导规则：host 相等(**忽略 `www.` 前缀差异**), 且 url 带 query 时**逐参数一致(页面可带额外参数)**。
**注意**：
- url 是归属唯一事实来源——新增/改站入口时只改 `url`, **不要**再手写 `match`(除非特例: 多入口 host/跨域归属页); 写错 url(如漏 `www.` 或画蛇添足加 `www.`)会直接导致页面不归属或错归属。
- url 带 query 的站(如贴吧 `f?kw=pt`)判定会检查 query, 页面换参数(如 `kw=pt&pn=1`)仍命中; 无 query 的站忽略页面一切参数——后台任务 URL 追加的 `ptacTask` 不会影响归属。
- `match` 保留为可选项, 特例站仍可用函数细控(如按页面内容归属)。

## P17. FAB 皮肤: 状态语义与角标含义要一致

**要点**：`ptac_skin`(chameleon/number/signal/ring)存 GM 跨站共享, `applyFabSkin(c)` 只认 `countToday()`(遍历全部 UNITS 的今日 status)。「全部完成」= `success >= total`(total 含 disabled 站);「有未签」= 剩余 `total - success`。
**注意**：
- 角标颜色语义随皮肤/状态变(默认绿=成功数; chameleon 未完成红=剩余数; signal 红=失败数、琥珀=剩余数)——读代码勿假定「角标=成功数」。
- **disabled 站**(`enabled:false`)不参与批量也永无 success, 若将来启用, `total` 应改为「参与站数」或跳过 disabled 计数, 否则 FAB 永不显示完成态。
- 光环皮肤辉光在 ::before(紫罩蒙版 radial `circle closest-side` + `--ring-grad` conic 分段), 分段段长=各状态站数占比; mask 径向须 `farthest-side`(方盒 78px 半径 39px, #000 至 calc(100%-13px)=26px 圆缘实、calc(100%-5px)=34px 透明 → 辉光带仅圆缘外 26~34px); **本体(背景透明)勿叠加 baseGlow 等外圈 box-shadow 辉光**——与 ::before 呼吸节奏脱节且显强, `.fab.ring` 要显式 `animation:none` 关掉 `.fab` 默认 baseGlow, box-shadow 若保留用柔和紫光晕(0 0 14px/42px rgba(139,92,246,~))勿硬黑投影; **辉光呼吸不能只加在 ::before 上再配静态 `filter: blur`**——动画会整段覆盖 filter, keyframes 内须重声明 `blur(2px) brightness(...) drop-shadow(...)`, 否则呼吸时辉光丢失模糊; 呼吸幅度小(brightness 0.96↔1.07 级)配合 drop-shadow 光晕外扩收拢即可, 辉光勿过强(动感交给光芒); 光芒演进(2026-09-07 终版 = **完全复刻 sample.html 原算法**; 此前 repeating-conic 均匀纹呆板 / SVG data-uri 整图无逐条动效 / translateY 锚圆缘(rotate 绕 transform-origin=底边中心 → 折扇) / 埋段+容器 mask 圆孔挖根(露段只是渐变暗尾/平台段=圆头短棒) / 渐变平台按露出段比例衰减 等自定义全部效果一般已弃): **射线=全长圆心到尖, 根部被 ::before 中心紫罩圆盖住** → `.ring-rays` 容器仅定位(z-index:-1 沉 ::before 之下, 无 mask 无裁剪, 溢出可见), 每条 `.ray` 底边锚圆心、`transform-origin:bottom center`、只 `rotate(var(--a))` 绕圆心; 渐变 sample 金档 0.9@0→0.6@30→0.2@70→transparent(无平台)+半圆帽+blur(1px); 动画 sample solarPulse 三帧(0.15/blur2/scaleY0.6 → 0.9/blur0/1.1 → 0.3/blur1.5/0.8)alternate + 正 delay 错相(负 delay=立即从中途相位起, 正=sample 原版静止等待, 均可用); **中心紫罩须实盖至圆缘**(如 accent-1 42% → transparent 67%, 39px 盒 42%≈16px 起淡、67%≈26px 圆缘透明完)才能盖住射线根不外穿, 否则需 mask; **教训: 动画覆盖行内 transform/filter → keyframes 内重组 `rotate(var(--a)) scaleY(...)` 与 blur**; 角度取均匀基准+扰动勿全随机(扎堆/空洞), sample 主 18 束 ±7.5° + 日冕长细 4 束全随机(更长更细更慢更久延迟); **切走 ring 皮肤须移除 `.ring-rays` 元素**(样式挂 `.fab.ring` 下, 残留会裸显示); JS 生成用 `!fab.querySelector('.ring-rays')` 守卫只建一次(每页图案不同); 伪元素盖图标问题: fab 本体背景 transparent、::before/::after 是 absolute(绘制在普通流内容之上)→ 需给 `.fab-core`/`.fab-badge` 提 `z-index` 否则中心图标被紫罩遮住; 勿对含分段的层整体旋转(段位会错位), 只旋转光芒层。
- 皮肤选择条在面板头部「外观」按钮展开(`.panel.skin-open .skin-bar`), 面板 `overflow:hidden` 故选择条用文档流内嵌行而非浮层。

## P18. 落地页无反馈型签到站(如 PTT): 勿用"点击到达落地页即成功"的宽判定, 要用落地页独有文本标记且不绑 class

**症状**(PTTime/PTT 实测): 点击签到按钮 → 整页跳转 `attendance.php`, 但该落地页**不显示**「签到详情/签到已得」类按钮或文案 → 落地结算 `settleUnitOnLandingPage`/被动模式 `detectAlreadyCheckedIn` 均查无已签特征 → 状态卡 pending(批量 10s 观察后以 pending 结算; 被动模式甚至可能被"上次 pending 未确认"逻辑翻成 failed)——实际已签到却被记为未确认/失败。
**原因**: 已签检测主通道是**按钮/页面文案**; 该类站落地页没有任何已签反馈文案, 引擎无特征可确认。
**曾考虑又否决的做法**: 给"点击后正确到达 attendance.php 落地页"一律判 success——**不保险**: 无法区分"真签到成功"与"未登录被重定向/登录页/错误页/落地页本身也渲染了记录表"等情况, 宽泛到达即成功会误报。
**正确做法**(2026-09-08 PTT 落地): 新可选配置 `landingCheckedInContent` = 落地页上**签到成功后才出现**的唯一文本(PTT 为「总签到记录」表头):
- 实现上作为 `detectAlreadyCheckedIn` 的第 4 通道: 仅当设了该字段 **且** 当前页为签到动作导向的落地页时做**整页文本匹配**; 落地页判定 `isLandingPageOf` = pathname 与签到按钮 href 解析路径一致(容 query; host 由调用方 matchUnit 保证)。**勿写死 attendance.php**——落地页命名各站不同(attendance/signin/任意 php), 一律由按钮 href 推导(`landingPathOf`: 显式 `attendanceUrl` 优先, 否则正则解析 `checkInSelector` 的 `[href=...]` 属性选择器取值, 相对 `unit.url` 解析), 扩展性更强; 非落地页不检测 → 天然防首页/其它区域同文本误报。
- **勿绑 class/结构选择器**(用户实测 `<p class="mt10 fwb">总签到记录</p>` 的 class 会随改版变)→ 纯 `visibleText(body).includes(标记文本)`; 若站方把文本也改掉, 症状会回到"卡 pending", 按新页面 HTML 更新标记文本即可(此时宁可 pending/failed 也不误报 success——签到状态可人工核对)。
- 该通道挂在统一 `detectAlreadyCheckedIn` 上 → 被动/批量后台标签/调度落地结算三种路径自动共用, 无需在各处另加分支。
**注意**: 曾把落地页写死为 `attendance.php`(2026-09-08 初版), 已改为按钮 href 推导(见上 bullet)——落地页命名任意都能识别; 若签到按钮不是 href 型(如纯按钮)则 `landingPathOf` 解析失败 → 此通道自动失效, 退回落回原检测(勿再发明"到达即成功")。

## P19. confirmManual 站若实测有"点击后按钮变已签"反馈 → 应弃 confirmManual 改 successDetect, 否则成功却卡 pending

**症状**(蜂巢 2026.09.08 实测): 已签到、页面按钮显示绿 ✓「已签到」, 但脚本日志 `无自动确认特征(confirmManual), 记为 pending` → 状态卡 pending。面板一直显示 pending; 需**再次访问该站**由 `detectAlreadyCheckedIn` 命中「已签到」才改写 success; 批量调度中则以 pending 结算、且该站在 10 分钟冷却/待确认期内被排除重试。
**原因**: 蜂巢早期站方无按钮文案反馈时设了 `confirmManual:true`(点击后一律 pending 待人工确认); 该分支在 `runUnit` 第 6 步**先于 `detectSuccess`(含"按钮文案变已签"回退检测)return** → 即使点击后按钮已变「已签到」也不检测, 前提"无可靠成功特征"已随站点改版失效却未同步。
**正确做法**(方案 B, 2026-09-08): 弃 `confirmManual`, 配 `successDetect:[{type:'text', selector: 签到按钮, text: 已签文案, timeout:5000}]` → 点击后按钮变已签即 success; 超时走通用回退(按钮文案 2.5s)后记 failed(语义: 宁 failed 可重试/可查, 不卡 pending)。**要点**:
- `successDetect` 的 text 检测须把 `selector` 限定到签到按钮本身(勿用 body——页面其它区域(如历史对话框)残留「已签到」会误报);
- 确认按钮确实随签到成功变文案(数日观察无 failed 误报); 若站点响应慢于 successDetect+回退总超时(~7.5s)会误报 failed → 调大 timeout 或退回 pending 方案;
- 检查顺序: 前置 `detectAlreadyCheckedIn`(每次访问)与步骤内 `click_checkin` 的"已含已签文案则不点击"双保险不变, 防重复点击。

## P20. 版本号跨天必须重置: 日期后的小版本号 N 跟随日期回 1, 不得沿用前一天计数续号

**症状**(2026-09-08 实测): 09-07 末次提交版本 `2026.09.07.11`(23:59 前), 跨到 09-08 的两次提交写成 `2026.09.08.12`、`2026.09.08.13`——同一天序号跨天虚高, 看似 09-08 当天已改 13 次, 实际才第 1、2 次。
**原因**: 提交时只记得"版本号要比上次大", 直接沿用上一次的 `N` 值递增, 未意识到日期段已变化; `YYYY.MM.DD.N` 的 `N` 是**当日流水号**(当日第几次修改), 不是全局序号。
**正确做法**: 每次提交前看**日期段**: 与上次提交的 `YYYY.MM.DD` 相同 → `N` 继续 +1; 不同(跨天) → `N` 从 `.1` 重计(即使昨天已到 `.11`, 今天首次修改就是 `YYYY.MM.DD.1`)。提交信息末尾的 `(.N)` 标注与头部 `@version` 保持一致。
**注意**: 违例发生后**不必回改历史提交**的版本号(已推送), 但当前头部版本按"当日已用最大序号 + 跨天重置"重新对齐; 例: 09-08 已错写 `.12/.13`, 当日后续提交仍从 `.14` 续(同日规则), 但次日(09-09)首提必须是 `2026.09.09.1`。规则详见 `ai/conventions.md` 第 1 节。

## P21. "访问即签到"型站与"动态落地页特征"站的建模: 勿套用按钮/静态文本通道

**症状/背景**(MTeam 与 HHCLUB, 2026-09-08 接入): 两类非常规签到形态直接套用标准配置会误判或无法确认:
- **MTeam 型(访问即签、无按钮)**: 登录态访问主页 `/index` 即自动完成当日签到, 页面无任何签到按钮可点可检; 若按常规站配 `checkInSelector`, 或把 match 放宽到全站, 会出问题。
- **HHCLUB 型(菜单展开 + 动态落地页)**: 签到入口藏在头像下拉菜单(先点 `img#user-avatar` 展开再点 `a[href*="attendance.php"]`); 落地页确认特征是**动态文本**(`#date-display` 内容为当月 `yyyy-mm`, 随日期变)——`landingCheckedInContent`(静态字符串 `includes`)配死某个年月会过期失效。
**曾考虑又否决的做法**: MTeam 型配假的签到按钮、或用"到达任意页即成功"; HHCLUB 型把 `landingCheckedInContent` 写成 `date-display` 或固定年月。
**正确做法**:
- **MTeam 型(无按钮)**: 显式 `match` 函数**只认签到主页路径**(host 精确 `kp.m-team.cc` + pathname `/index`)→ 详情页/其它子域不触发(否则浏览页会被当成签到动作、页面无卡片误报 failed 并污染当日状态); **不配** `checkInSelector`/`alreadyCheckedInContent`(无按钮可检可点); steps 仅 `wait` 等 SPA 渲染; 成功靠 `successDetect:[{type:'func', fn: async 轮询成功特征}]`(MTeam = antd 卡片标题「站点数据/站點數據」双文本防 locale, 16s 超时); 未登录被重定向登录页 → 无特征 → 自然 failed, 符合语义(需登录)。
- **HHCLUB 型(动态落地页特征)**: 用 `alreadyCheck` **自定义 async 函数**作为已签检测通道(它在 `detectAlreadyCheckedIn` 第 1 通道, 被动/批量/落地结算三路径共用): 函数内先限定**仅落地页路径**才判(`/attendance\.php/i.test(location.pathname)`, 防首页其它区域误报), 再轮询 `#date-display` 含**动态算出的当月前缀**(`${y}-${m}` 与当前日期比对, 不写死年月), 超时返回 false。
**注意**:
- `alreadyCheck` 是 async 判定成功与否的"落地已签确认"与 `landingCheckedInContent` 静态标记是两套思路——动态文本(日期/用户名/随机 token)一律走 `alreadyCheck` 函数, 静态稳定文本才用 `landingCheckedInContent`; 不要把动态内容硬编码进静态字段。
- 菜单展开型签到, `click` 步骤的 selector 须指向**展开触发器**(avatar), 点完留出菜单动画时间(`wait 500ms`)再 `click_checkin`; 若菜单是 hover 展开(非 click), 需改 mouseover 触发方式(待实测校准)。

## P22. 跳转型站报"未检测到成功特征": 先分清"点击后到底跳没跳"再修——无 pagehide 且同页零特征必失败

**症状**(HHCLUB 2026.09.08 实测): 普通触发显示「未检测到成功特征」→ 后续一次「整流程超时」, 但**强制重试即成功**。站配置只有一条确认通道 = 整页跳转到 `attendance.php` 落地页(落地结算命中 `alreadyCheck`), 首页上没有任何同页确认特征。
**原因**: 引擎 `runUnit` 点击后确认只有两条路: ① 800ms 内发生 **pagehide(整页跳转)** → 返回 pending 交给落地页结算; ② 未跳转 → 走 `detectSuccess`(同页) → **零特征 → 秒判 failed**。HHCLUB 的菜单链接点击后导航不稳定(SPA 路由页面不卸载、或慢导航/首访程序化 click 无效)→ 没触发 pagehide → 首页又无任何成功特征 → 必失败。强制重试恰好落在时序正确的窗口 → 整页跳转 → 落地结算 success, 证明**链路与选择器本身正确, 败在自动化时序/SPA 导航窗口**。
**诊断要点**(凡"未检测到成功特征"先自查):
1. 该站**同页是否有确认特征**?只有落地结算一条通道的站, 一旦点击后不整页跳转(SPA/慢导航)就必失败——不能只靠落地结算。
2. 查日志: 有无「点击后发生页面跳转, 状态待落地页确认」(有=跳转了, 问题在落地结算) vs 直接「点击后未检测到成功特征」(无=压根没跳)。
3. **强制重试成功 ≈ 链路配置正确, 问题在时序/导航形态**(非机制错误); 若重试仍失败才是选择器/特征问题。
**正确修复**(2026-09-08 HHCLUB 双保险):
- **补同页 `successDetect`** `[{type:'func', fn: 轮询直到 location.pathname 变为目标落地页且出现落地成功特征(如 #date-display 当月), 超时 8s}]` → SPA 路由/慢导航(URL 变但无 pagehide)下同页也能确认 success, 不再秒判 failed;
- **菜单展开改"点-验-重试"函数步骤**: 点击触发器(avatar)后轮询目标链接**可见**——用 `getClientRects().length > 0` 而非仅 DOM 存在(菜单内链接常**常驻 DOM 但 display:none**, 隐藏元素程序化 `.click()` 不触发导航; `waitForElement` 只查存在会误以为已就绪)→ 未现则再点触发器(toggle), 最多 3 次, 消除首访/页面未就绪的程序化点击无效;
- 保留整页跳转落地结算通道不动(两通道并存互不冲突)。
**注意**: 引擎对"隐藏元素 click 无效"无通用防御(正常站按钮在视口内), 此类菜单型站需在配置层用可见性校验兜底; 点击类步骤若发现目标"查得到但点不动", 优先怀疑可见性而非选择器。
