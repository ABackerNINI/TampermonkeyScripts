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
> ⚠️ 若排序/筛选逻辑依赖时魔数值，此 Bug 会导致结果失真。修复同时更新 `memory-bank/scripts/BTSchoolHelper.md` 与 `@version`。

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

## P10. 命名不一致（现存待修，见 tasks）

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
- 该纪律为最高优先级约定，详见 `memory-bank/conventions.md` 第 0 节「核心铁律」。

## P14. 测试纪律违规：给测试留通道 / 为过测试改生产代码

**症状**：
- 生产脚本中出现仅测试用的分支/钩子（`window.__TEST__`、URL 参数开启测试模式、把内部函数挂到 `window` 等）；
- 测试失败后，通过弱化断言、跳过逻辑、写死返回或让生产代码迎合测试来「变绿」。
**原因**：把测试便利混入生产路径；对测试失败归因错误（先怀疑生产，未排查测试自身）。
**正确做法**：
- 可测性通过**纯函数化 / 参数注入 / 配置与逻辑分离**实现，而不是在生产代码中留测试专用通道；
- 测试失败先查测试自身（断言/样本/环境），再查生产代码的真实缺陷；
- 生产代码只修真实问题；测试与真实行为冲突时以真实行为为准并修正测试。
- 详见 `memory-bank/conventions.md` 第 8 节「测试与可测性约定」。

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
**注意**: 违例发生后**不必回改历史提交**的版本号(已推送), 但当前头部版本按"当日已用最大序号 + 跨天重置"重新对齐; 例: 09-08 已错写 `.12/.13`, 当日后续提交仍从 `.14` 续(同日规则), 但次日(09-09)首提必须是 `2026.09.09.1`。规则详见 `memory-bank/conventions.md` 第 1 节。

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

## P23. 跨天 bug: 页面 DOM 是「加载时刻」服务器状态的快照——23 点页面没关/后台标签跨天, 旧 DOM 的"已签到"通用文案会把昨日已签误判为今日成功

**症状**(用户报告 2026-09-08): 当日 23 点的页面没关, 过了 24 点后脚本检测到「已签到元素」直接显示今日成功; 实际新的一天**尚未签到**。
**根因**: 引擎的当日判定链(runUnit 第 2 步 `detectAlreadyCheckedIn` / 落地结算 `settleUnitOnLandingPage`)读**当前页 DOM** 文案——「今日已签到/已签到」等通用措辞**无日期锚**, 而 `writeStatus` 的 `date` 取实时 `todayStr()`。页面 23:xx 加载后跨天仍存活(常驻浏览页/批量调度后台标签/落地页), 00:00 后某次执行碰到它时 `todayStr()` 已是新一天, 但 DOM 还是昨天的 → 昨日已签被写入**今日** success → 误报。`isSuccessToday` 按 `date === todayStr()` 比较本身没错, 错在**用过期 DOM 喂当日判定**。
**涉及场景**: ① 批量后台标签恰在跨天窗口内加载并执行(23:59 打开 00:00 后 runUnit); ② 常驻旧页在 00:00 后被触发(恢复批量横幅/手动动作/落地结算); ③ 大页面加载期间跨天(DOMContentLoaded 完成前已到新一天)。
**修复**(2026-09-08 .16, 引擎级低侵入, 策略=仅执行前守卫):
- 脚本注入(document-start)瞬间记录 `PAGE_BORN_DATE = todayStr()`——DOM 状态所属日的近似;
- 守卫 `isDayRolled()` = 出生日 ≠ 今日; `dayRollReload()` 跨天即 `location.reload()`(布尔防多入口同刻重入), 返回 true 时调用方**立即终止且不得再读写当日状态**;
- 挂接点: `runUnit` 开头(返回 reason `day_roll`, 不写状态)/ `settleUnitOnLandingPage` 开头 / `startBatch` 开头(旧发起页先刷新再发起)/ `main` 顶部(加载期间跨天兜底);
- **批量后台标签特判**: `runBatchTabPage` 收到 `day_roll` 结果**不得补写 skipped**——否则调度页会当作结算结果推进任务, 该站今日实际未签; 直接 return, 由 reload 后重载的标签重新执行写真实结果(调度窗口 50s 内可等到)。
**边界**(如实记录): 服务器 23:59:59 生成响应、客户端 00:00:01 判定 + reload 后服务器已按新日返回 → 收敛正确; 服务器返回滞后于客户端跨天(响应昨日状态但客户端已新一天)的极小窗口无法从 JS 层根除(引擎按客户端日期语义); 系统手动改时间不在防护范围; 纯挂机常驻页跨天不主动刷新(用户决策: 不做自动刷新定时器, 只在执行入口拦截)。
**教训**: 引擎任何"读到 DOM 上的"已签"就写当日成功"的判定都隐含"DOM 属于今天"的前提——DOM 出生日期与今日不一致时该前提不成立; 凡是快照式 UI 状态(非实时 API)都应在跨时间边界时失效重取。

## P24. 签到需人工验证(验证码)的站(如 U2): 勿配可点击 steps / 勿让引擎默认点击——用 detectOnly 仅检测型

**背景**(U2 2026-09-08 接入): U2 的签到(`showup.php`)要求**人工输入内容验证**, 无法自动化; 用户要的是「只检测状态, 不执行自动签到」——脚本负责跟踪今日是否已签, 实际签到由人工在站内完成。
**引擎约束**(据此设计新站型): ① `steps` **缺省为 `[CLICK_CHECK_IN]`**——只要配了 `checkInSelector` 而未显式 `steps`, 引擎会自动「等按钮 → 点击」, 必然触发不可自动化的流程; ② 已签检测主通道(按钮文案)命中即 success 不点击, 但**未命中**时会继续走「写冷却 → 点击 → 点击后确认」, 无导航无特征会记 failed; ③ 用 `steps: []` + `confirmManual: true` 硬凑 → 未签时写 pending + 白写冷却, 语义全错; ④ `enabled: false` 只挡批量不挡被动访问(被动仍跑 runUnit)。
**修复**(2026-09-08 .17, 引擎级小扩展 `detectOnly`): 
- unit 配 `detectOnly: true` → `runUnit` 在已签检测(步骤2)未命中后直接返回 `skipped`(reason `detect_only`), **不点击/不写冷却/不记失败**; 命中已签照常写 success → 手动签完后任意访问自动转绿;
- `remainingCandidates` 排除 `detectOnly` 站(不进普通/强制批量——开标签也只能 skipped, 无意义还拖慢批量);
- 面板行对 `detectOnly && 今日无状态` 显示「需人工签到(验证码), 不自动签」, 避免用户误以为脚本漏检/坏了。
**建模要点**: 该型站仍需 `checkInSelector` + `alreadyCheckedInContent`(按钮文案「立即签到→已签到」走标准按钮通道即可, 不必写 `alreadyCheck` 自定义函数); 选择器仍**不依赖 class**(U2 按钮带 `faqlink` class, 但 2026.09.07 已证实该 class 会随改版消失) → 用 `a[href*="showup.php"]`。以后再有验证码/人工站照此办理, 勿再往 `steps` 里塞点击。
**注意**: 若某天 U2 移除验证码可自动签, 去掉 `detectOnly: true` + 确认 steps(默认即可)即恢复自动; 判定「未检测到已签」时不可点 `立即签到`(会把人带到验证码页且可能消耗一次机会/触发风控)。

## P25. 今日已签记录 vs 页面按钮重现(状态不一致): 独立 alert 提醒 + 当日状态降级 suspect(失败-待确认), 不自动重签

**背景**(2026-09-08 .18 需求): 用户要「重新检测到签到按钮时发出提示, 如躺平出现『签到得魔力』」——即引擎已把某站判为今日 success, 之后按钮又变回可签文案(服务器状态重置 / 换账号 / 上次 success 是误报)。用户明确: 要**常驻**提醒(toast 2.6s 一闪而过不保险), 且 U2(人工验证站)、蜂巢、HDBao/MuXueGe 一并纳入。
**约束**: ① 已签检测每次访问都执行、冷却只挡点击, 但 `isSuccessToday` 命中后 runUnit 直接 return——页面按钮后续变化脚本无感知; ② 若自动重签 → 真已签时误点有「重复签到/风控」风险 → **只提醒不动作**; ③ 常驻 = 跨站可见(GM 存储) + 不依赖 toast 存活; ④ 触发点必须是「按钮确实呈现可签态」而非每次访问(防噪音)。
**建模**(.18 引擎级纯旁路 + UI 呈现; **.26 通用化改造**):
- **载体无关入口状态信号**(.26): 判定从「纯按钮可见文本翻转」重构为 `stateSignals`/`readEntryState` 信号模型——站点用两种方式描述签到入口的已签/可签态: A) 显式 `stateSignals`(推荐, 载体无关): `{checked:[信号...], checkable:[信号...]}`, 信号 kind = text(visibleText contains)/attr(属性值 contains)/attrEq(属性精确)/class(classList 含)/fn(自定义)/exists(元素存在); B) 旧文本字段自动翻译(文本站**零改动、行为逐位一致**): `checked=[text alreadyCheckedInContent]`、`checkable=[text checkInContent]`(无 checkInContent → 反向常驻站); 翻译层在 `deriveStateSignals`(不产风味词——精确信号), 风味词否定守卫作为**调用方 flavor 选项**由 `readEntryState(unit, flavor)` 另行叠加。
- `readEntryState(unit, flavor)` 返回 `{state:'checked'|'checkable', evidence}` 或 null: checked 信号任一命中 → checked; `flavor=true` 且 checked 含 text 类信号时, 文本命中已签风味词(`已签|已成功|连签|已得|已领|已完成`)→ checked(防已签变体文案误判重现; **仅文本载体站生效**, attr/class 信号站自动跳过——`sig.checked.some(kind==='text')` 门控); 无 checkable(反向常驻站)且入口存在 → checkable; checkable 信号任一命中 → checkable; 否则 null(未知文案不判)。入口缺失: noButtonMeansCheckedIn 站 → checked, 否则 null。
- 两个消费函数(薄封装): `checkInButtonReappeared(unit)` = `readEntryState(unit, true)` state==='checkable' ? evidence : null(flavor=true: 保留旧已签风味词否定守卫语义); `signedByButton(unit)` = `readEntryState(unit, false)` state==='checked'(flavor=false: 纯精确, 保持旧 signedByButton 只做精确 already 匹配)。
- 结构排除(与旧 P25 一致): 前提 `checkInSelector` + 已签基准 必有 → `deriveStateSignals` 返回 null → 自动排除无按钮型(MTeam 等六隐式站)、菜单链接文案不翻转型(HHCLUB 无已签文案)。显式 stateSignals 无 checked 同样排除。
- 判定覆盖(旧语义不变): **正向**(有 checkInContent, 标准 NexusPHP 签到得魔力↔签到已得、贴吧 签到↔连签、U2 立即签到↔已签到)= 入口呈可签态(可签信号命中且非已签)即重现; **反向**(无 checkInContent/无 checkable, 蜂巢按钮常驻仅文案翻转)= 入口存在且非已签即可; **noButtonMeansCheckedIn**(BTSchool)= 无按钮=已签, 有按钮且可签=重现; HDBao/MuXueGe 等跳页站首页链接若随签到翻转即自然覆盖, 不翻转则已签态下按钮要么无、要么文案含已签 → 不误报; **stateSignals 属性/class 站(NodeLoc, .26 起)**: 按钮 class 含 checked-in / title·aria-label 含「已经签到过」→ checked(不重现), title·aria-label 含「每日签到」→ checkable(重现证据=该词)两态互斥;
- 挂 `runUnit` 步骤 1(今日 success 或 suspect 分支)内作复核(.20 起): 页面确认已签(`signedByButton` / `noButtonMeansCheckedIn` 站无按钮 / 按钮通道不覆盖时回退页面级 `detectAlreadyCheckedIn`)→ 状态恢复 success + clear 提醒(收掉高亮/横条); 按钮重现 → write alert(当天首次)+ **当日 status success 降级为 `suspect`**。**不点击 / 不写冷却 / 不进批量**;
- 存储 `ptac_alert_<uid>` `{date, btnText, ts, state:'on'|'off'}`: 每站每天至多提醒一次(state on 不重写; 清除置 off 后**当天也不再复写**——同一站不同页面可能交替呈现可签/已签, 无此节流会刷屏); 跨天读取时自然作废并顺带清理;
- UI(.18 初版): FAB 琥珀角标显提醒站数(今日无失败时优先于常规角标; 失败红标语义更紧急保持不动)/ 面板警示条(不自动消失)/ 该站行琥珀标记 + 副文案前置 ⚠。badge 口径随 .20 变「失败-待确认」(suspect, 不再显已成功)。
- **.19 呈现升级**(用户实测反馈「检测到重现后没有明显提示, 按钮无变化」): 根因 = alert 全在 Shadow 面板/FAB 内, **不打开面板零感知**, 且今日有 failed 站时 FAB 角标被失败红标吞掉 → 增加**页面 light DOM 级反馈**(用户盯的是页面上那个签到按钮): ① 按钮琥珀描边 + 呼吸光晕 + 旁插 ⚠ 徽标「已记录已签, 按钮重现(仅提醒)」(常驻至已签清除/次日作废); ② 页面底部居中**常驻横条**列当日全部 alert 站(圆角卡片; ✕ 圆钮关闭仅隐藏本页会话, 刷新后若仍 on 会重新显示); ③ 检测当下即时 `UI.toast(msg, 4000, 'warn')` 一次(琥珀渐变底白字警示变体, 与普通玻璃态区分); 三者生命周期与 `ptac_alert_*` 同源(clearAlert → 同步移除高亮/横条; 跨天读取作废 → 不显示); 后台任务标签(无 UI)不处理。
- **.20 状态降级**(用户需求「检测到重现后改变其状态『已成功』为『失败-待确认』」): 触发重现不再只旁路提醒——`runUnit` 步骤 1 统一处理当日 success/suspect 两态, 把当日 status **降级为 `suspect`**(面板 badge「失败-待确认」, 不计入今日成功; FAB/汇总不再显示该站已成功), 且**保持不自动重签**(suspect 非 success 却由步骤 1 拦截返回, 不会落入步骤 2+ 的自动点击; `remainingCandidates` 排除 suspect → 不进普通/强制批量); 用户补签后任意访问 → 页面确认已签 → suspect **自动转回 success** + 清提醒; 次日 date 不匹配自然作废恢复常态。徽标/横条/toast 文案同步改为「已标失败-待确认(仅提醒)」。
  **修复(.20 实测「状态仍为已成功」)**: 初版把降级绑在 `writeAlert` 返回值 `firstWrite` 上——凡当天已有 on/off 记录(如 .18/.19 时代已提醒过的站, 或曾确认已签置 off 的站)即永不降级, 状态永远停在 success。已解耦: **降级闸门 = 当日状态仍 success 且按钮重现** → 无条件降级, 与 alert 当天是否已写/off 无关; 每天至多一次由状态转换幂等天然保证(success→suspect 后不再满足条件), 跨页/刷新不重复; off 仅代表「曾确认已签」不再复写提醒, **不冻结状态轴**。
**教训**: 引擎以「DOM 呈现的已签」写死当日 success 后, 该状态是**单向快照**——若要感知「状态又回退了」, 需在 success 分支内做**与已签检测同源的反向复核**(同选择器同文案源), 而不是再开一套异步观察; 任何「提醒类」旁路都应(独立存储, 不污染状态轴 / 按天节流防刷 / 有正向确认即清除), 否则会与失败/冷却/批量等既有 UI 语义纠缠; 当用户说「别显示已成功」时, 快照状态需**可逆**: 反证成立(按钮重现)则把已成功降级为独立中间态(`suspect`, 不并入 failed 的冷却/重试语义), 反证撤销(确认已签)则恢复——中间态必须被 runUnit 顶部拦截且被批量排除, 否则会落入自动点击。**提醒必须落在用户注视处(页面元素 / 页面级横幅)**——只藏在自绘 Shadow 面板/FAB 里的提醒, 对不常开面板的用户约等于不存在; 页面级呈现用 light DOM + 独立注入 `<style>`(id 前缀防重)实现, 勿塞进 Shadow; 自绘角标注意被失败红标等「更紧急语义」吞掉的场景, 主可见性不能押在角标上。

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

## P27. 引擎判定通道通用化: 「文本专用」判定重构为「载体无关信号」时, 用翻译层保旧站零改动、用 flavor 参数保调用方语义差异

**背景**(2026-09-08 .26): P25 按钮重现检测与 signedByButton 判定原本只认按钮可见文本——NodeLoc 等 no-text 站(状态在 class/title/aria-label 上)结构上被排除(无文本翻转语义)。需求: 不破坏任何旧文本站行为的前提下让属性/class 态站也纳入重现提醒。
**做法**(重构而非扩展): ① 站点配置可显式描述**载体无关入口状态信号** `stateSignals: {checked:[], checkable:[]}`(kind: text/attr/attrEq/class/fn/exists), 引擎 `readEntryState` 统一消费; ② 旧文本字段不新开判定代码, 而是**自动翻译成等价信号**(deriveStateSignals: checked=[text alreadyCheckedInContent], checkable=[text checkInContent])→ 文本站配置零改动、行为逐位一致(等价性以 OLD/NEW 副本差分场景矩阵验证); ③ 两消费函数原本语义不同(signedByButton 只做精确 already 匹配, checkInButtonReappeared 额外带已签风味词否定守卫)→ 若把风味词直接塞进 checked 信号会让 signedByButton 变宽松误判 → 改为 `readEntryState(unit, flavor)` 布尔参数, 调用方各传各的(true/false), 语义差异显式化。
**关键决策**: ① 已签风味词守卫必须**仅在 checkInButtonReappeared 侧**(flavor=true)且**仅对含 text 信号的站生效**(sig.checked.some(kind==='text') 门控)——attr/class 信号站(如 NodeLoc)状态互斥精确, 不受文本风味词干扰; ② 无 checkable 数组 = 反向常驻按钮站(入口存在且非已签即可签, 蜂巢); ③ 入口缺失语义随 noButtonMeansCheckedIn 走(有→checked, 无→无法判定 null, 不判重现); ④ 结构排除(无 checkInSelector / 无已签基准)→ deriveStateSignals null, 与旧一致(MTeam 六站、HHCLUB)。
**教训**: 引擎判定要加新载体时, 优先把「站点的状态表达」抽象为**载体无关信号**再统一读取, 而不是在旧判定函数里为每类站堆 if——堆 if 会让旧站路径与新增路径互相污染(风味词这种「防误判启发式」一旦进了共享精确通道就是 bug)。语义有分歧的消费方要显式传参区分, 不要试图让共享函数猜意图。验证时**差分 OLD/NEW 副本跑场景矩阵**(同环境同输入对比输出), 比目测推演可靠——文本站逐位一致是重构的硬验收标准。

## P28. 慢站被误判为「失败」的三重结构性来源: 可覆写的整流程超时 + 缺失的预算不变式 + 混用的结果语义

**症状**(用户报告 2026-09-18): 「PT 自动签到脚本用起来不太顺畅, 经常失败, 特别是网页加载慢一点就可能失败, 结果反馈慢」。典型日志组合: `步骤失败: 等待元素…超时` / `未检测到成功特征` / `整流程超时`。

**根因**(四条互相放大, 前两条是主因):

1. **整流程超时定时器会覆写任何非 success 结果**(旧 `runUnitWithTimeout`, 25s)。`Promise.race([runUnit, sleep(25s).then(...)])` 的失败方**既不 `clearTimeout` 也不检查 `runUnit` 是否已结算**, 超时分支只守 `!isSuccessToday` → 于是 **冷却 `skipped` / 仅检测 `detect_only` / 失败-待确认 `suspect`** 这些「本已给出结论」的结果, 都会在 25 秒后被改写成 `failed('整流程超时')`。
   次级后果(安全): `suspect` 被翻成 `failed` 后, `remainingCandidates` 的 suspect 排除失效 → 「强制批量」会把它重新纳入并**再次点击一个可能已签到的站**(风控风险, 破坏 P5/P19/P25 语义)。
2. **引擎没有预算不变式**。单站内部等待是**串行累加**的(已签检测 → 步骤 → 点击后观察窗 → 复检), 各站配置的超时可自由叠加, 引擎从不校验它们装不装得进整流程预算。旧 25s 上限下 NodeLoc 已**天生越界**(`waitForElement 10000` + `successDetect func 16000` + …≈ 26.8s), 不需要任何额外延迟就会撞超时。
3. **「慢」与「坏」共用同一个终态 `failed`**。「等元素超时」「未检测到成功特征」「调度窗口耗尽」与「选择器不匹配」「未登录」都写 `failed`, 而 `failed` + 冷却会被普通批量默认排除 → 用户只能手动重试, 感知就是「经常失败」。
4. **点击后观察窗固定 800ms 且只认 `pagehide`**(P22 的通用形态): 服务端 POST→302 首包 > 800ms 的慢站被当成「同页 AJAX」, 同页又零特征 → 秒判 failed。

**修复**(2026-09-18 .1; 用户三项决策: `unconfirmed` 作为独立状态 / 自动重试**不允许**在冷却期内再点一次 / 整流程 25s→40s 接受):

- **T1 超时不再覆写**: `runUnitWithTimeout` 加 `settled` 标志 + `clearTimeout`; 主流程一旦给出结论, 超时分支不写任何状态。真超时与未捕获异常一律归 `unconfirmed`(未确认, 可重试)。
- **T2 状态单向阶梯 `STATUS_TRANSITIONS`**: 白名单式合法迁移, `writeStatus` 拒绝非法迁移并 `console.warn`。核心安全性质: `success` 只能转 `suspect`(P25 降级), `suspect` 只能转 `success`(页面确认); 任何「有结论」的状态(`success`/`suspect`/`failed`/`unconfirmed`)都不得转回 `pending`。**注意 `skipped` 与初始态 `''` 必须能转 `pending`**——`skipped` 不是结论(它=本次没动作: 冷却中/今日已完成), 否则「上次无动作 → 这次真点击」的路径会被阶梯拒掉。**阶梯不是越严越好**。
- **T3 预算不变式 + 双校验**: 见下「预算不变式」。
- **T4 结果分类**: 新增独立状态 `unconfirmed`(面板「未确认」青色徽章 `.badge.unc`; 计入未完成、**不计入失败数**); 只有「确定失败」才写 `failed`(选择器失效/文案不符/函数步骤抛错)。步骤抛错的分类口径 = **错误消息含 `超时|timeout` → `unconfirmed`, 否则 `failed`**。
- **T5 有界复检(只检测不重点)**: 观察窗内无结论 → 按 `UNCONFIRMED_RECHECK_DELAYS = [5000, 12000]` 各复检一轮(`detectAlreadyCheckedIn` + 限时 `detectSuccess(maxMs 4000)`), 把「响应慢于单次检测超时」的站从 failed 拉回 success。**冷却期内绝不重复点击**(用户决策); 每轮前先查剩余预算, 不够就放弃复检直接落 `unconfirmed`。
- **T6 点击后观察改事件驱动 + 有界窗口**: `watchNavigation(ms)` 并发竞速 `pagehide` / `beforeunload` / **URL 变化(SPA 软导航, 无 pagehide)** 与超时; `confirmAfterClick` 只被**有结论**的信号结束(命中成功特征 / 确认跳转), 窗口到时才进复检。窗口上限 `POST_CLICK_WATCH_MS = 4000`。旧实现固定 `sleep(800)` + 只认 `pagehide`, 慢站必然走错分支。
- **T7 `waitForElement` 判可交互 + 超时自适应**: 除存在性外判 `disabled` / `getClientRects().length`; 页面 `readyState !== 'complete'` 时基础超时 `+ SLOW_PAGE_WAIT_BONUS_MS(10s)`; 所有等待再经 `budgetedTimeout()` 收敛到本次执行剩余预算(`setRunDeadline` = 入口设 `now + UNIT_TOTAL_TIMEOUT - 余量`)。
- **T8/T9 进度心跳 + 零进度提前跳过**: 后台标签每阶段写 `ptac_progress_<uid>`(阶段 + 时间戳; 每次必写, 因调度页按 `ts > openedAt` 判新鲜), 调度页据此显示实时阶段与耗时, 并在 `NO_PROGRESS_SKIP_MS(20s)` 内零进度时**提前判定死站**(不再死等 50s 调度窗口)。
- **T10 待确认宽限跟随心跳**: 有新鲜心跳时延后结算, 避免把「正在确认中」误判为死站。

### 预算不变式(本项目新增的硬约束)

单站执行的**固定预留**:
```
AUDIT_RESERVE_MS = UNIT_TIMEOUT_MARGIN_MS(余量 5000)
                 + POST_CLICK_WATCH_MS(观察窗 4000)
                 + UNCONFIRMED_RECHECK_DELAYS[0] + RECHECK_DETECT_CAP_MS(首轮复检 9000)
                 = 18000ms
```
对每个 unit 要求(全部 ms):
```
detectMs(自定义 alreadyCheck 最坏成本) + stepsMs(各步骤声明超时之和) + AUDIT_RESERVE_MS <= UNIT_TOTAL_TIMEOUT(40000)
```
并保证 `UNIT_TOTAL_TIMEOUT + 结算余量 < PER_UNIT_TIMEOUT_MS`(整流程之后仍要留落盘 + 落地结算的时间)、`UNIT_TIMEOUT_MARGIN_MS >= POST_CLICK_WATCH_MS`(观察窗在内部 deadline 之外仍有硬等待, 余量要盖得住)、首轮复检必须留有预算(否则「慢站复检」这个救场机制根本不会执行)。

**不透明成本必须声明**: `click`/`click_checkin`/`check`/`wait` 的超时可静态求和, 但 `function` 步骤与自定义 `alreadyCheck` 内部是任意代码 → 必须显式写 `budgetMs`(步骤) / `alreadyCheckBudgetMs`(unit), **同步 DOM 判定写 `0`**。未声明即报 UNKNOWN 并判为不通过 —— 让「未知成本」这种无效状态无法悄悄存在。

**双校验入口(缺一不可)**:
- **运行时**: `auditUnitBudgets()` 在脚本启动时逐站求和(放在 `boot` 之外, 后台任务标签也会跑到)。全通过 → 打**一行摘要**(`预算自检: n/n 通过; 最紧 <站> <合计>/<上限>ms(余量 …)`), 便于察觉配置逐渐逼近上限; 有越界/未声明 → 打全量表格 + `console.error` 逐条报出。
- **提交前**: `node tests/ptautocheckin/check-ptac-budget.js`(零依赖)。校验 A 常量不变式 / B 阶梯结构(目标状态已知、无自环、`success` 出边 ⊆ `[suspect]`、`suspect` 出边 ⊆ `[success]`、无结论态不得转 `pending`、初始态可达 success) / C 配置区不透明步骤是否都声明了成本 / D 把源文件里的 `computeUnitBudget` 抽出来喂合成 unit 自测(防「自检本身写错于是永远显示通过」)。退出码 0/1。

**注意 / 边界**:
- **不给 `window` 挂调试入口**(`conventions.md` §8.2 禁止为诊断/测试把内部函数挂到 `window`)。需要逐站明细时: 跑静态校验脚本, 或让自检在违规时自动打全量表格。
- 服务器端响应慢于整个预算的极端情况仍会落 `unconfirmed`(不误报 success), 这是设计取舍。
- 复检**只复检不重点**: 用户明确要求「自动重试不允许在冷却期内再点一次」——重复点击是有风控风险的写操作(见 P5/P19), 复检只读状态、无副作用。
- `detectSuccess` 的 `func` 检测器自带内部轮询(最长 16s), 复检时必须用 `maxMs` 限时(`Promise.race([fn(), sleep(cap)])`), 否则单次复检就能把整流程预算吃光。

**教训**:
- **超时保护必须是「可取消的」**。`Promise.race` 的失败方若不 `clearTimeout` 且不检查对方是否已结算, 它就不是「保护」而是「延迟覆写器」。任何 `race` 都要问: **败方赢了会写什么?**
- **「加个超时」不等于健壮性**。超时值分散在几十处配置里自由叠加时, 必须有**预算不变式 + 自动校验**, 否则越界只会在生产环境以「偶发失败」的形式出现(NodeLoc 26.8s 越界 25s 却长期无人察觉)。让不透明成本**必须声明**, 是把「未知」从沉默变成报错的最小代价。
- **错误状态要按「用户下一步该做什么」分类**, 而不是按「代码在哪抛的」。`failed`(要人工排查) 与 `unconfirmed`(等一会儿重试就好) 混用会把「慢」永久呈现为「坏」。新增状态时必须同时定义**面板文案、统计口径(是否计入失败)、它在批量候选里的角色**——三者不一致就会出现「面板显示未确认、批量却当它失败排除」这类撕裂。
- **`Math.min`/`Math.max` 用错方向会静默吃掉等待**: 给 `wait` 步骤收敛预算时写成 `Math.min(step.ms, budgetedTimeout(step.ms))` 会把 3000ms 等待压到 `budgetedTimeout` 的 1000ms 下限; 正确是 `Math.max(0, Math.min(step.ms, remainingBudgetMs()))`。
- **改判定/写入逻辑时, 调用方的返回口径也要一起看**: 阶梯拒绝了 `writeStatus` 时, 调度页若仍按函数返回值结算, 就会出现「存储是 failed、面板显示未确认」的不一致 → 写入后**回读状态**再结算。


## P29. 面板渲染的空值地雷: 一行 `st.status` 未守卫 → 首次安装/新接入站点时脚本 100% 不工作

**发现方式**: 2026-09-18 用本地仿真站(`tests/lib/sim/`, 见 P30)跑 `S00 环境自检冒烟` 时,
页面 console 直接报 `[PTAutoCheckIn] 主流程异常: TypeError: Cannot read properties of null`。

**症状 → 原因 → 对策**

- 症状: 装好脚本后访问任何匹配站点, 没有任何签到动作、FAB 不显示、console 一行
  `主流程异常: TypeError: Cannot read properties of null (reading 'status')`。
- 原因: `buildRowHtml()` 里 `const retryTitle = st.status === 'unconfirmed' ? … : …`
  **无条件读取** `st.status`, 而 `st = readStatus(unit.id)` 在该站**从未有过状态记录**时是 `null`
  (GM 存储里根本没有 `ptac_status_<uid>` 这个键)。同函数里其它读取都有 `todayHit &&` 守卫,
  只有这一处漏了 —— 于是 `render() → UI.init() → main()` 一路冒泡, `boot()` 的 catch 把它吞掉,
  **整条主流程(含签到)全部不执行**。
- 触发条件: 全新安装(所有 unit 都无记录)、或新接入一个站点(该 unit 无记录)。
  老用户天天用反而不会遇到(每个 unit 都有昨日记录, `todayHit` 为 false 但 `st` 非 null),
  所以它能长期潜伏。
- 对策: 改成 `todayHit && st.status === 'unconfirmed'`(与同函数的 `retryable` 一致)。
- **教训**: `main()` 里 `UI.init()` 在**业务流程之前**执行 —— 渲染层的任何异常都会连带掐掉签到。
  面板渲染应视为"纯展示", 对 `readStatus/readAlert` 的返回值一律按可空处理;
  新增行内字段时先问「这个 unit 从没写过状态时它是什么」。

## P30. 安全审计(本地仿真站)结论: 站点可控数据进入「跨站共享存储 + 宿主 DOM」的三条通道

**背景**: 2026-09-18 搭了 `tests/lib/sim/` 仿真站做安全向测试(详见 `memory-bank/tasks/TASK017-*.md`),
用 `--host-resolver-rules="MAP * 127.0.0.1:<port>"` 让真实域名 URL 落到本地服务器,
**生产脚本零改动**即可命中 `@match`。共 11 个用例(`tests/ptautocheckin/sim-security-s*.js`)。

**根因结构**: 脚本同时做了三件"把控制权交给站点"的事 ——
① 把**页面内容**当事实来源(按钮文案/href/favicon);
② 把结论写进**脚本级、跨所有 @match 域共享**的 GM 存储;
③ 把面板 UI 注入**宿主页面的 DOM**。
这三条各对应一条可利用通道。

### 已修复(2026.09.18.4)

| 编号 | 问题 | 机制 | 修复 |
|------|------|------|------|
| S03 | **favicon 跨站信标** | `collectFavicon` 只滤伪协议(`^https?:`)不滤来源 → 站 A 挂一个外链 `<link rel=icon>`, 该 URL 以 `ptac_favicon_<uid>` 长期驻留; 此后用户在**任意其它 PT 站**开面板都会把它当 `<img src>` 发出 → 站 A 拿到跨站跟踪信标 | 采集前校验 `isSameSiteHost`(本站主域或其子域, 兼容 CDN 图标), 跨站丢弃并回落 `/favicon.ico` |
| S05 | **宿主页面读穿面板** | UI 用 `attachShadow({mode:'open'})` → 宿主页面脚本可 `getElementById('ptac-root-v2').shadowRoot` 读出**全部 33 个站点的清单与今日状态**(实测可读) | 改 `mode:'closed'`; 脚本自身全程持有 `shadow` 引用, 不需要 `shadowRoot`, 功能无影响 |
| S07 | **`?ptacRetry` 强制动作** | 任何人诱导用户打开 `<站点>/?ptacRetry=<uid>` 即触发 `forceCooldown:true`, **无视 10 分钟冷却**直接点击(实测冷却窗内两次 = 2 次点击) | 强制重试改为必须出示脚本自签的**一次性票据** `ptacToken`(存 `ptac_retryticket_<uid>`, 校验后立即作废, TTL 10 分钟); 无票据退化成普通访问 |
| S09a | **站外伪造签到入口** | 选择器只约束 href 的**子串**(`a[href*="attendance.php"]`), 故 `https://evil.test/attendance.php` 同样命中 → 脚本带着用户会话点去站外 | 点击前 `hrefIsOffSite()` 校验 host 与协议; 被拒时返回 `{refused:true}`, 主流程记 `failed`(**不能**继续走"点击后确认", 否则会写成 pending 谎称"已点击") |

### 残留风险(已评估, 暂不修, 需真站回归后再定)

- **S09b 同站任意参数入口**: 站点仍可放一个文案合规、href 为 `attendance.php?action=…` 的链接,
  脚本会点并记为 success。不修的理由: 攻击者在**自己站内**本就能以用户身份发起任意请求,
  脚本只是省掉了用户那一次点击; 而"禁止 href 带配置外的 query"会误伤真实站点
  (配置里确有 `index.php?action=addbonus` 这类带参入口), 属于会破坏功能的改动。
  真要做, 建议做成**按 unit 声明 href 白名单**(配置驱动), 而不是全局一刀切。
- **S13 `@match` 过宽**: 29 条 `@match` 全是 `*://*.域名/*` —— 含**明文 http**(可被 MITM 注入)
  且覆盖**任意子域**(实测脚本会在 `cdn.tangpt.top` 上运行并注入 UI)。
  收紧到 `https://` 的前提是确认每个站都支持 https, **必须真站回归**, 故本轮不动;
  `matchUnit` 按 host 全等比较, 子域不会误匹配到 unit(不点击), 这点是对的。

### 已验证为"没问题"的正向基线(防回归)

`esc()` 全量转义 → 跨站存储型 **XSS 不成立**(S02); favicon 伪协议过滤有效(S04);
无 `window.__*` 后门、无 `unsafeWindow`(S01); 无 `eval`/`GM_xmlhttpRequest`/`@connect`,
`@grant` 恰为 4 个最小集(S17/S18); 冷却期内不重复点击且**不把 unconfirmed 改写成 failed**(S11);
无签到入口时在预算内收敛为 unconfirmed 不挂死(S16); 1MB 按钮文案不进存储、面板不崩(S15)。

**通用教训**: 「站点提供的数据」一律属于**不可信输入** —— 包括按钮文案、href、favicon URL、
URL 参数。凡是"这个值会被存下来 / 会被点 / 会被当 URL 用"的地方, 都要有明确的来源约束
(同站? 同协议? 有票据?), 而不是只校验"长得像不像"。

## P31. 「已签后签到入口消失」别一律套 `noButtonMeansCheckedIn`: 先找页面上留下的已签文本

**症状**：新站已签后签到按钮不见了（用户反馈「不再是按钮，变成 `魔力值 …(签到已得10)`」）→
照抄 BTSchool 配 `noButtonMeansCheckedIn: true` → 在**本来就没有签到入口**的页面（种子详情、
设置、登录页、论坛）上「找不到按钮」被判成已签 → 当日写 success → **批量不再签、当天漏签**，
且面板显示"已成功"，用户毫无察觉（比误报失败严重得多）。
**原因**：`noButtonMeansCheckedIn` 的语义是「找不到按钮 = 已签」，它成立的**前提**是该站签到入口
**全站常驻**（每个页面都有、且只因已签而消失）。未实测这个前提就启用，等于把"页面类型不对"
当成了"已签"。
**正确做法**：先区分两种形态，再选通道——
- **入口消失但页面留有已签文本**（HDHome「(签到已得N)」、HDBao/MuXueGe 落地页）→ 配
  `alreadyCheckedInContent` + **`alreadyPageCheck: true`**（整页文本通道），**不开** `noButtonMeansCheckedIn`。
- **入口消失且无任何文本痕迹**（BTSchool）→ 才用 `noButtonMeansCheckedIn: true`，且必须先确认
  入口在该站**所有会被访问到的页面**上都存在。
### 更进一步：`noButtonMeansCheckedIn` 即便前提成立也"不够保险"（HDHome 2026.09.19 的最终形态）

即便「入口全站常驻」已实测确认（HDHome 由用户确认），`noButtonMeansCheckedIn` 仍有**结构性盲区**：
它只回答了「入口没了？」，回答不了「**你登录了吗？**」。未登录（cookie 过期）/维护页/被封页面
同样没有签到入口 → 被判成已签 → **把漏登录报成"今日已成功"** —— 面板绿着、当天根本没签，
是所有误报里最坏的一类（用户完全无感知，且当天不会再重试）。用户据此要求换更严的判定。
**定稿方案：用 `alreadyCheck` 把两件事一起问**（同步判定，声明 `alreadyCheckBudgetMs: 0`）：
```js
alreadyCheck: () => {                                              // 同步, 无需等待
    if (document.querySelector('a[href*="attendance.php"]')) return false;        // 入口还在 → 未签
    return !!document.querySelector('a[href*="mybonus.php"], font.color_bonus');  // 入口消失 + 登录态证据
}
```
登录态证据取**只在登录后出现**的元素（HDHome = 顶部魔力值信息栏），于是「未登录页」→ 两个条件
都不满足 → 落到 `unconfirmed`（可重试、**不计入失败**），不会假成功。
**与 `alreadyPageCheck` 互补**：`alreadyCheck` 覆盖「已签但文本没渲染/文案改版」，
整页文本覆盖「登录态证据选择器改版」；任一命中即已签，两者都不命中的极端情况最多是 `unconfirmed`。
**通用化**：任何"入口消失型"站点都可以套这个形状 —— 找**一个登录态专属元素**作为证据，
把「入口消失」升级为「入口消失 **且** 已登录」。BTSchool 若将来出现同类误报，同样可改此形状。
**坑**：`alreadyCheckBudgetMs` 必须写在 `alreadyCheck` **8 行以内**（`check-ptac-budget.js` C2 的
扫描窗口），函数体写太长会被判"未声明成本"（HDHome 初次提交就踩了）。
该取舍由仿真用例 `tests/ptautocheckin/sim-hdhome-pagetext.js` 锁定：第 3 条「入口消失+登录态 → 已签」
与第 4 条「未登录页（同样无入口）→ **不得**判已签」是一对，共同锁住口径。

## P32. 「另存为」的整页网页里带着**你自己的** passkey：别把它拷进仓库任何受追踪的地方

**症状**：为了分析页面结构，把 PT 站「另存为」的整页 HTML（含 `*_files/`）放进仓库，
或直接把其中一段 `<a href="download.php?id=123&passkey=xxxxxxxx...">` 复制到 `src/*.html` 样本、
`tests/lib/sim/` 剧本、`memory-bank/` 文档里 → 提交推送后，**个人下载密钥进入公开仓库历史**。
**为什么严重**：本仓库远端是公开的 GitHub / Gitee，凭据一旦推送即向全网可见；
`git rm` / 删文件 / 改历史都**不能**保证已被抓取、fork、镜像站与搜索引擎缓存的内容消失，
唯一正确的处置是**推之前别让它进来**。NexusPHP 系站点的下载链接、`usercp`/RSS 链接、
`rsstoken`、`authkey`、隐藏表单里的 CSRF token 都在这一列。
**注意「未被 Git 追踪」不等于安全**：AI 助手读取本地文件后，内容会进入会话上下文，
可能被原样贴进回复 / 日志 / 提交信息 —— 泄露面不止 Git 一条。
**对策（即 `conventions.md` 0.5，铁律 5）**：
1. `resources-do-not-track/` 保持被 `.gitignore` 忽略，永不 `git add -f`；
2. 需要结构时**只描述结构**（选择器、类名、DOM 层级、URL 形状），值写 `***`；
3. 需要样本入库时**先复制到受控位置、手工清凭据再提交**；仿真剧本一律手写脱敏 HTML；
4. 提交前自查：`git ls-files resources-do-not-track` 必须为空，且 diff 中无真实 token。
**顺带**：拿这类页面给 AI 分析时，先自己确认已脱敏再粘贴；AI 侧同样不得输出其中的真实值。

## P33. 把「别的脚本运行时注入的列」写进结构契约：首装必报"结构损坏"，点重试又好了

**症状**：`[HDHomeUI] 页面结构与预期不符(E_COLUMN_UNKNOWN), 已恢复站点默认界面。
种子表缺少可识别的列: a,ave` —— 但用户点一下「重新尝试」就成功上妆。
**为什么会发生**：那两列（`#calcTHeadA` / `#calcTHeadAve`，数据格带 `data-calc-a`）**不是站点 HTML 自带的**，
是另一个脚本在运行时插进去的。本脚本 `@run-at document-start`、在 DOM 就绪就校验契约，
而那个脚本可能还没跑、或正跑到一半 —— 于是把"别人的加载时序"误判成"页面结构坏了"。
判定口诀：**「点重试就好了」= 时序问题，不是结构问题**；凡是间歇性出现、重试即消失的失败，
先怀疑外部脚本/懒加载/延迟渲染，而不是改契约去"认"它。
**对策**：
1. **分清必需列与可选列**：`REQUIRED_COLUMNS` 由全集剔除 `OPTIONAL_COLUMNS` 得出（不要两处各写一遍）；
   缺可选列返回**成功码**（`OK_NO_CALC`），照常上妆，只跳过那几列的排版。
2. **排版函数必须在列缺席时返回空串**：`if (!m[key]) return '';`
   —— 否则会生成 `:nth-child(undefined)`，整条 CSS 规则失效（连带同组的其它规则一起挂掉，很难查）。
3. **列集合变化要重摆**：`colMapSig` 比对，变了就 `applyTheme(currentId)` 重算 `nth-child`；
   补进来的格子必须吃到主题样式（测试里用 `::before` 内容断言，而不是"看起来像"）。
4. **给"补到一半"留等待窗口**：`ROW_CELL_COUNT_MISMATCH` 是典型的一半状态（表头插了、数据行没插完），
   这类码进 `armPending` 窗口（首装 8s / 运行中 4s，每 700ms 主动试一次），窗口内恢复即静默上妆，
   超时才回退。**等待期间已上妆的不卸妆**，否则会闪一下原站界面。
5. **只给"半状态"码等窗口**：`E_COLUMN_UNKNOWN` / `E_ANCHOR_MISSING` 是"必需的东西真没了"，
   等也没用 —— 让它们等只会把一次快速失败拖成 8 秒的疑似卡死。
6. **窗口要有可观测状态**：`data-hdui-state="pending"`，否则测试和用户都分不清"没上妆"和"正在等"。
**测试怎么钉**：`tests/hdhomeui/sim-hdui-optional-columns.js` 四段 ——
① 只有 10 列仍上妆且不弹横幅；② 两列补进来自动重摆且新格吃到样式；③ 撤走两列同样不回退；
④ 只补表头（半状态）不立刻弹横幅、补齐后自行恢复。
⚠️ 写第 ④ 段时别把表头注入两次（先 `INJECT_HEAD_ONLY` 再 `INJECT` ⇒ 表头 14 / 行 12，永远好不了），
   要用"只补行"的脚本收尾；另外结构守卫有 500ms 去抖，断言 `pending` 前要等够 900ms。

## P34. 16px 小图标设计: 只有三类信号能幸存, 细节一律消失

**症状**：图标在 96px 设计稿上语义清晰，塞进 16px 导航/表头后完全读不出。
**为什么会发生**：16px 下可用的像素太少，任何"细节"级差异（叶脉、茎的弯折、卷边、渐变）都会被抹平。
**16px 下真正能幸存的只有三类信号**：
1. **闭合主体的明显缺口 / 孔洞**（`evenodd` 镂空或直接拼进路径的咬口）
2. **方向显著变化**（倒置、倾斜、掉落）
3. **配件显著**（碎屑、掉落物、附加形状）
**推论 —— 成对概念（活/死、整/缺、开/关）的正确做法**：
**保留同一轮廓 + 只改强信号**，不要发明新形状。"完整 vs 残缺" 是世界上最直白的对照，
远比"换个隐喻但形状完全不同"好认。
**流程铁律**：任何新图标 **先做 4 尺寸对照 sheet（96 / 48 / 24 / 16 同屏）再定稿**，
绝不要在单一尺寸上反复微调 —— 看不到全局就会陷入一轮轮返工。

## P35. 同色图形叠画 = 完全看不见（SVG 镂空必须用 `fill-rule="evenodd"`）

**症状**：给气泡图标加了三个 `<circle>` 当"评论点"，渲染出来一个点都没有；
连续 5 次截图 MD5 完全一致，误判为"浏览器缓存"。
**为什么会发生**：整个 `<svg>` 用了同一个 `fill` 色，后画的 `<circle>` 和前面的气泡路径颜色完全一样，
SVG 默认 `fill-rule="nonzero"` 直接把同色图形合并 —— **视觉上不存在**。
**判定口诀**：**"改了但截图哈希不变"先怀疑改动本身没产生像素差，再怀疑缓存**。
**对策**：镂空必须写进**同一个 `<path>`** 里作为子路径，并加 `fill-rule="evenodd"`：
```
<path fill-rule="evenodd" d="M...气泡...z M4.2 10.4a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0-4.8 0z ..."/>
```
用独立 `<circle>` 子元素 + 同色 `fill` **无效**。
**验证手段**：临时把页面底色改成 `#FF00FF`，截图应立刻看到镂空处透出粉色 —— 一眼确认镂空生效。

## P36. 图标"没显示"可能是被布局吃掉：列宽溢出 + `overflow:hidden`

**症状**：某一列的图标死活不出现，但 CSS 选择器、data URI 全都正确；其它列都正常。
**为什么会发生**：该列宽 44px，而 `img(16) + gap(5) + 文字(~28) ≈ 49px` → **溢出 5px**，
单元格 `overflow:hidden` 把左侧的图标整个裁掉，文字仍在（所以看起来"只有文字"）。
**判定口诀**：**单列图标缺失，先量列宽，别改图标设计。**
**验证手段**：把该列的 `content` 临时换成一个 22×22 实心方块再截图 —— 如果哈希仍无变化，
证明 wiring 没问题，是布局把图标吃了。这比反复改图标设计高效得多。
**对策**：给该列加 10px 余量（44 → 54）。其它列若宽度 < 60px 也应复查。

## P37. 「封闭主体 + 单一竖向凹槽/镂空」在 16px 下会被读成手

**症状**：枯萎叶图标被用户读作"一只竖着的手"。
**为什么会发生**：**椭圆 + 竖向缝隙 ≈ 手掌 + 手指** —— 竖向封闭主体配中央竖槽，
在小尺寸下触发的是"身体部件"的联想，而不是"植物"。
**对策**：做小图标时**避免"双对称封闭主体 + 中央竖向凹槽/镂空"** 的组合。
需要"枯萎"语义时，改用**方向 + 边缘破损**表达，不要靠中央的竖线。

## P38. 「同一形状反过来看」辨识度不够 —— 倒置不等于语义反转

**症状**：把"保种"的叶子旋转 180° 当"断种"，用户反馈"感觉不一样，但读不出枯萎"。
**为什么会发生**：倒置后原本尖锐的 apex 朝下变成圆钝的"头"，**视觉重心变了**，
叶形本身的可辨识特征被破坏 —— 用户感觉到"不同"，但读不出"为什么不同"。
**对策**：**不要靠倒置/旋转表达语义反转**。同朝向保留轮廓（保证可辨识），
靠 **缺口 / 配色 / 附加件** 表达差异。"完整绿叶" vs "残缺枯叶" 远比 "正着的叶" vs "倒着的叶" 好认。

## P39. `evenodd` 镂空子路径必须完全落在主体内，否则会越界填出杂形

**症状**：加了镂空后，主体**外面**冒出奇怪的小色块。
**为什么会发生**：`evenodd` 的规则是"射线穿过路径段数为奇数则填充"。子路径若有一部分在主体外，
那部分就会被当作独立区域**填实**，而不是挖空。多个子路径互相重叠时，重叠区会变回填充（3 次穿越 = 奇数）。
**对策**：
1. 镂空子路径的**所有点**都必须落在主体内部（保守做法：放在主体最宽最厚处）
2. 多个镂空子路径**不能互相重叠**
**排查**：渲染后如果主体外出现杂色小块，第一怀疑就是子路径越界。

## P40. 「边缘缺角」≠「内部挖孔」：缺口必须直接拼进路径

**症状**：用户要"边缘缺角"，做了 `evenodd` 镂空后仍被判定为"内部缺"。
**为什么会发生**：两种做法视觉语义完全不同：
- **`evenodd` 挖孔**：主体 path + 子 path 镂空 → 读作"主体上有个洞"（**内部缺**）
- **拼进路径**：在主体 path 上**切断一段边界**，插入一段"向内再向外"的新边界 → 读作"轮廓被咬了一口"（**边缘缺**）
即使镂空位置紧贴边缘，只要它是 `evenodd`，视觉上仍是"洞"。
**正确做法**（de Casteljau）：
1. 在边界贝塞尔上按参数 `t1` / `t2` 切两刀，抽出中间段
2. 计算该处**指向内部的单位法向**（切线旋转 90°，用"点-在-多边形"判定正负方向）
3. 在 `A(t1)` 与 `B(t2)` 之间插入新的边界点：按形状沿 AB 插值并沿法向偏移
   - `V` 三角尖缺 / `U` 圆弧勺缺 / `STEP` 阶梯矩形 / `JAG` 锯齿多齿
4. 把 `[左段] + [缺口] + [右段]` 拼回完整 path
可复用生成器：`.workbuddy-ai/hdui-mock/_gen-notch.js`（`bite(segIdx, t1, t2, shape, depth)`）。
⚠️ 该脚本输出时把坐标舍入到 2 位，**未被改动的段也会被重新舍入**，与原路径产生 0.01 级偏差。
16px 下看不出，但会干扰程序化度量（见 P41）—— 需要精确度量时多留小数位。

## P41. 看不了图片时，用 `isPointInFill()` + ASCII 地图程序化校验图标

**症状**：会话中图片读取不可用（`current model does not support images`），无法用截图肉眼校验图形。
**对策**（纯程序化，且可复现，比肉眼更可靠）：
1. **`SVGGeometryElement.isPointInFill()`** —— headless Chrome 里直接判定点是否在图形内：
   建一个含 `<svg>` + 两个 `<path>`（原图 / 新图）的探针页，`--dump-dom` 取结果。
2. **栅格扫描对比**（`step=0.25` 扫 0..24 × 0..24），得到：
   - 被咬掉的面积 及 占原图百分比
   - 缺口包围盒 / 中心（确认位置对）
   - **"新图多出的面积"必须为 0** —— 这一项专门抓 `evenodd` 越界杂形（P39）和坐标舍入伪影
3. **ASCII 地图**（`step=0.4` 逐行输出）最有用，`#`=两图都有 / `.`=只原图有（被咬掉）/ `X`=只新图有（异常）
   —— **不用图片也能"看见"轮廓**。

## P42. `img{content:url(svg)}` 换图标时 SVG 必须带 width/height，否则 img 宽高算成 0

**症状**：给站内图标换上内联 SVG 后，`sim-hdui-function-parity` / `sim-hdui-danger-guard` 报
`站内元素尺寸为 0(主题把它遮没了): #torrenttable [data-toggle-rss] {"w":0,"h":21}` ——
图标所在的 `<a>` 被压成零宽，hit-test 失败、点不到，站内交互"死了"。
**为什么会发生**：`content: url(...)` 替换的是 `<img>` 的**替换内容**，
新的固有尺寸（intrinsic size）由替换内容决定。若 SVG 只写了 `viewBox="0 0 24 24"` 而**没有 `width`/`height`**
（矢量图常见写法，靠 CSS 撑开），固有尺寸就是 **0×0** —— 外面包它的 `<a>` 随之塌成零宽。
站点原本的 `rss.png` 有位图固有尺寸，所以换之前一切正常；一换成纯 viewBox 的 SVG 就塌了。
**对策**：生成 data URI 时**同时给出 `width` 和 `height`**：
`<svg viewBox="0 0 24 24" width="16" height="16" fill="...">`
viewBox 负责缩放路径，width/height 负责给出固有尺寸。主题再用自己的规则缩到 12 / 16px。
**判定口诀**：**换完图标后站内元素"点不到"/"零尺寸"，先查替换内容的固有尺寸，而不是查选择器。**
**附带纪律**：图标层**只写 `content`，不写死尺寸** —— 让各主题用更高特异性的选择器自己定宽高；
否则图标层会压掉主题的排版（例如纸带主题的 12px）。

## P43. 全局 `unhandledrejection` 监听会把**别人的**异常打成自己的前缀，造成归因误导

**症状**：控制台出现
`[HDHomeUI] WARN UNHANDLED_REJECTION TypeError: Cannot read properties of undefined (reading 'innerText')`
—— 但在 HDHomeUI 里搜 `innerText` **一个都搜不到**，于是越查越乱。
**为什么会发生**：脚本为了「不吞异常」注册了全局 `unhandledrejection` 监听（好意：把页面里没人接的
Promise 拒绝记录下来）。但 `unhandledrejection` 是**页面级**事件 —— **任何脚本、任何页面代码**
抛出的未处理拒绝都会进这个回调。日志前缀写的是 `[HDHomeUI]`，于是把一个**外部**异常伪装成了本脚本故障。
**判定方法**（两步，缺一不可）：
1. 在本脚本里 grep `innerText`（或报错里提到的那个属性）—— 搜不到 ⇒ 不是本脚本抛的。
2. 在本脚本里 grep `\basync\s+function|\bawait\s|new\s+Promise\b|\.then\s*\(` —— **命中数为 0**
   ⇒ 本脚本不可能自己产生 Promise 拒绝，**只能是观察方**。
（本例中 `innerText` 真实位于 `src/PTAutoCheckIn.user.js:1139` 的 `visibleText(el)`，且该函数有
`if (!el) return ''` 守卫 ⇒ 抛出点在更上层的调用方。）
**对策**：监听里必须做三件事，否则日志就是误导：
```js
let frame = '';                       // ① 带 stack 首帧，指明真正的抛出方
if (r && r.stack) { const m = /^\s*at\s+(.+)$/m.exec(String(r.stack)); if (m) frame = ' @ ' + m[1].trim().slice(0, 160); }
Diag.warn('UNHANDLED_REJECTION', msg + frame + ' —— 来自页面或其它脚本(本脚本无异步代码), 非 HDHomeUI 故障');
                                      // ② 显式写明「非本脚本故障」 ③ 说明依据(零异步)
```
**不变量要钉进测试**：`check-hdui-static.js` 里加一条「脚本零异步（无 Promise/async/await/.then）」断言 ——
一旦将来有人引入异步代码，这条立刻变红，提醒同时去改这段措辞（否则免责声明就成了谎言）。
**通用口诀**：**共享的全局监听（error / unhandledrejection）打日志时，前缀 ≠ 来源；必须先证明"不是我的"再免责。**

## P44. 删掉一个可选项后，**老用户存储里的旧值**会变成"未知"，必须用迁移兜住

**症状**（2026-09-19 实测）：移除旧 5 套主题后，用户打开页面立刻弹红横幅
`[HDHomeUI] 页面结构与预期不符(E_UNKNOWN_THEME), 已恢复站点默认界面。未知主题 tape`
—— 他以前选的是 `tape`，主题删了，GM 存储里的值却还在。
**两处错误**（都不只是"改个提示"就完事）：
1. **不该报错**：用户没做错任何事，是我们把选项删了。老用户本就是"选过主题、想用主题"的人，
   **静默迁到新主题并写回存储**才对，而不是退回无样式。
2. **错误码/措辞张冠李戴**：`E_UNKNOWN_THEME` 被当成**结构类**错误 → 用了「页面结构与预期不符」
   的横幅文案 + 走「等结构就绪」窗口。可这是**配置值失效**，等一万年也不会变好，
   报错文案还把人往"页面坏了/站点改版了"上引（与 P43 同类的**归因误导**）。
**对策**（三件事一起做）：
```js
const LEGACY_THEMES = Object.freeze(['reel','tape','sheet','swiss','signal']); // 删主题时同步登记
const LEGACY_MIGRATE_TO = 'film';
const CONFIG_CODES = Object.freeze(['E_BAD_THEME']);   // 与 STRUCT_CODES 分开
// applyTheme(): 先查 LEGACY → 命中就 storeSet 回写 + 继续上妆(不弹横幅);
//               真未知才 fallbackToDefault('E_BAD_THEME')
```
```js
// showAlert(): 按错误码分流措辞 —— 配置类说「主题设置无效」, 结构类才说「页面结构与预期不符」
const isCfg = CONFIG_CODES.indexOf(code) >= 0;
// 且配置类的按钮给「改用胶片墙」而不是「重新尝试」—— 重试对无效值没用
```
**不变量钉进测试**：`check-hdui-static.js` §11 断言旧 id 已登记在 `LEGACY_THEMES`、
`E_UNKNOWN_THEME` 不再出现、措辞按错误码分流；`sim-hdui-legacy-theme.js` 逐个旧 id 验证
「上妆成功 + 无横幅 + 存储已改写」，并验证无效值走的是「主题设置无效」不是「结构不符」。
**通用口诀**：**删选项 ≠ 删数据。凡是写过用户存储的可选项，删的时候都要留迁移路径；
且"配置失效"绝不能复用"结构损坏"的错误码与话术。**

## P45. 判定「两个颜色是否分得清」必须用三维，只看色相会得出错误结论

**场景**：给导航 16 项各配一色，想找出哪些颜色会混淆。
**错的做法**：只比色相（比如"色相差 ≤5° 就算撞色"）。
**为什么错**：色相相同但**饱和度**差很多的两个颜色，肉眼一眼就分得开 ——
低饱和的灰 `#94a3b8`(H215 S20) 与高饱和的金 `#f5b342`(H38 S83) 即便"接近"也不会混淆；
反过来，色相差 3° 但饱和/亮度都接近的两个色（`#d99b2b` vs `#b8933a`）才是真分不出。
只按色相算，会把前者误判成撞色，得到**虚高的问题数**（本次实测：7 对 → 真实 4 对），
于是按错误结论去改色，白白动了一堆本来没问题的颜色。
**正确判据**（三维同时接近才算真分不出）：
```
Δh <= 8 && Δs <= 20 && Δl <= 15   （色相 / 饱和 / 亮度，HSL）
```
**配套经验**：
- 某个色"往同区挪色相"往往挪不开（橙黄区挤了 4 个时，把 shield 往黄推 `#c9b06a` H44 会撞上
  wilt H42）—— 此时**降饱和变灰**比挪色相有效得多：灰色不属于任何彩区，自然不打架。
- 改完用脚本把**实际生效的色表**重算一遍（从源码里正则抽出 `ICON_NAV` 的色值再算），
  不要凭改前的设计稿下结论 —— 设计稿和落地值会漂移。
- 留一条注释写明判据与已避开的坑，否则下次调整配色又会撞回同一个位置。

## P46. 站点外层是固定宽 + `table-layout:auto` 时，主题的两个隐形陷阱（撑宽 / 窄屏点不到）

两个坑**同源**：HDHome 站点外层是固定宽布局（文档宽 ≈1260，不随视口变），
外层用 `table-layout:auto` —— **会被内容的 `max-content` 撑开**，且不随视口收缩。

**陷阱一：上妆把整页撑宽。**
**症状**：上妆后 `document.documentElement.scrollWidth` 从 **1260 → 1503**，
窄屏用户要多横向滚 240px。
**为什么**：标题列是 `flex:1 1 0` + 内容 `white-space:nowrap`。
`min-width:0` 只管**收缩**（min-content），**管不住 max-content** ——
auto 表格布局按 max-content 撑容器，长标题于是把整页顶宽。
**对策**：给弹性列显式 `max-width`，且用 vw 自适应：
```css
max-width: max(240px, calc(100vw - 900px));  /* 900 = 固定列宽和+间距+留白的约数 */
```
改列宽时那个常数要同步调（写进注释）。改完实测：1503 → **1260**（与原站持平），
窄屏还会自适应收缩。
**判定口诀**：**上妆后量一次 `document.documentElement.scrollWidth`，与原站对比 ——
比原站宽就是主题把页面撑了。**

**陷阱二：flex 导航在窄屏单行排到屏幕外。**
**症状**：视口 1024 时最后 2–3 个导航入口 `elementFromPoint` 返回 null（中心点 x 超出视口）。
**为什么**：脚本把 `ul#mainmenu` 改成 `display:flex`（防 16 个 inline 挤一坨），
但站点固定宽让导航条拿到 1248px，`flex-wrap:wrap` **不会触发**（容器够宽），于是单行排到 1218。
**原站是 inline 布局会自然换行，换成 flex 后必须显式给上限才会 wrap。**
**对策**：`ul#mainmenu{max-width:100vw;box-sizing:border-box;}` —— 宽屏（1248<1262）无影响，
窄屏收到视口宽并换行，实测 1024/900 下都是 **0/16 点不到**。
**判定口诀**：**改了导航的 display，就要在窄屏下重测一次可点性 —— 宽屏通过不代表窄屏通过。**

**通用教训**：`min-width:0` 只解决"能不能收缩"，不解决"会不会撑开"；前者靠 min-width，后者靠 max-width。
**测试**：`sim-hdui-layout-width.js`（第 26 个）用 `Emulation.setDeviceMetricsOverride`
改视口，逐项钉死：文档宽度 ≤ 原站、窄屏导航 0 被挡、滚动后片头吸顶。
诊断脚本 `.workbuddy-ai/_diag-docwidth.js`（上妆/不上妆 × 三种视口对照）定位这两个问题最快。

## P47. 批量替换用 `while (s.indexOf(from) >= 0)` 会死循环 —— 当 `to` 包含 `from` 时

**症状**（2026-09-19 实测）：一条 `node -e` 批量改原型的命令挂死，
跑了 **4 小时 47 分**，内存涨到 **354 MB**（同机其它 node 进程只有 60–80 MB），
任务面板一直显示 "background task running"。
**代码**：
```js
const from = "…column-gap:' + gap + ';width:100%";
const to   = "…column-gap:' + gap + ';width:100%'";   // 只比 from 多一个单引号
let n = 0;
while (s.indexOf(from) >= 0) { s = s.replace(from, to); n++; }
fs.writeFileSync('index-v2.html', s);
```
**为什么死循环**：`to = from + "'"`，替换后字符串里**仍然能匹配到 `from`**
（`width:100%'` 中包含 `width:100%`）；而 `replace()` 不带 `g` 只换第一处 ——
于是每轮让字符串变长一点，`indexOf` 永远 >= 0。
**判定线索**（不用看代码也能猜到）：进程存活数小时 + 内存持续增长 ⇒ 字符串在循环里变长。
**好在这次的损伤是 0**：`writeFileSync` 在循环**之后**，从未执行，文件 mtime 停在命令启动前；
若它在循环**内**，文件会被反复覆盖、且越写越大。
**规避**（按优先级）：
1. **别用 while**：全量替换用 `s.split(from).join(to)`，或 `replaceAll` / 正则 `/…/g` —— 一次性完成，无循环。
2. 只需替换第一处就**直接 `replace` 一次**，不要包循环。
3. 必须循环时**加次数上限**：`while (n < 100 && s.indexOf(from) >= 0)`。
4. **确保 `to` 不包含 `from`** —— 这是死循环的充要条件，写之前先想清楚。
**连带教训 —— 内联 `node -e` 的两个坑**：
- **引号会被 shell 动**：`node -e "…\``…"` 里的反引号 / `$` 会被 Git Bash 展开。
  本次会话就吃过：一条 `node -e` 里的反引号被解释，把 `tasks/_index.md` 写坏了。
  **带引号 / 中文 / 正则的复杂替换，写成 `.js` 文件再跑**（可读、可复用、便于中断），
  `node -e` 只适合一次性小改。
- **挂起后要主动查**：`tasklist | grep node`（哪个进程内存异常大）→
  `Get-CimInstance Win32_Process -Filter "ProcessId=<pid>"` 看完整命令行 →
  确认是自己的失控脚本就 `Stop-Process -Id <pid> -Force`。
  注意 IDE 自身也有多个 node（mcp 服务），别误杀 —— **认命令行，不认进程名**。
