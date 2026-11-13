# HDHomeUI 版本历程（一）
> 摘要: 版本历程加粗日期版本条目第一组: 脚本定位引言、当前版本与已提交 hash, 及促销/置顶/布局各版改动
> 触发: 查版本历程, 核对提交 hash, 查促销与置顶改动

# HDHomeUI（`src/HDHomeUI.user.js`）

> HDHome 界面主题：**胶片墙**（一套，可在面板里切回「原站默认」）。纯样式层改造，
> **不重建 DOM、不接管交互**，原站功能全部保留；页面结构一旦与预期不符，**提示并回退站点默认界面**。
> 设计依据与实施计划见 `tasks/TASK018-hdhome-ui-themes.md`。

- 当前版本：`2026.09.20.5`（分支 `develop`；`.5`–`.10` 均已提交 `d56ffbb`；`.25` 已提交 `cfbeb86`；
  `.26` 已提交 `eb46823`；`.27` 已提交 `b4edd94`；`.28` 已提交 `4c53e69`；`.29` 已提交 `8776b4e`；
  **.30 已改码、待审核**）
- **2026.09.20.5：促销改回**站点原图**（.30）—— .29 的文字徽章被否决。**
  用户明确要求「促销标签改为原图 img 显示」。
  **根因认知**：站点促销 `<img class="pro_*">` 的 `src` 是**透明占位图**(`trans.gif`)，
  真正看得见的图标全靠 `background:url(icons.gif) -Xpx 0` 画 ⇒
  任何 `content:` 替换或 `background-image:none` 都会**把原图干掉**。
  **修**：`iconCss` 里**不再为 pro_* 生成任何规则**（一条都不加）；
  `filmCss` 里只留排版微调 `vertical-align:-2px;margin-left:6px`，**不写 width/height/background**
  —— sprites 按 36×11 定位，改尺寸会露出**相邻图标**。
  **清理死代码**：删除 `promoBadgeUri` / `PRO_BADGES` / `PRO_FALLBACK_LABEL` / `PRO_FALLBACK_COLOR`。
  **配套**：`hdui-scan.js` 的 `scanDeco` 要给 `img[class*="pro_"]` 加**白名单例外** ——
  否则保留的站点雪碧图会被报成「站点残留装饰 bg-img」（实测 33+27+9=69 个）。
  与 `tr.sticky_top` 的 inset 金边同一类：都是"刻意保留，不是没清干净"。
  **历程（别再绕）**：.20 图形徽章（用户嫌不具辨识度）→ .29 文字徽章（用户仍不满意）
  → **.30 站点原图**（用户最终选择）。
  ⇒ **结论：促销这种"站点自己画得挺好、尺寸也刚好"的东西，不要替它重新设计。**
  用例全部**反转**为反断言：`content === 'normal'` + 背景仍是 icons.gif + 尺寸仍是 36×11；
  真站实测 70/70 content 未被替换、70/70 雪碧图还在。
- **2026.09.20.4：置顶两区分色 + 促销改文字徽章（.29，用户诉求）** —— 两件事：
  **① 三个区域用不同底色区分。** 用户报「无法分辨置顶区1/置顶区2/普通区」。
  先发控制台探针（`.workbuddy-ai/_diag-zones-console.js`）量真站 101 行，结论：
  `表头(0) / 置顶区1(1-41，无 inline，站点底色 #bad6f4 浅蓝) / 置顶区2(42-50，
  带 inline `background-color: rgb(250, 238, 244);` 粉白) / 普通区(51-100)`。
  ⇒ **站点本来就用两个不同底色区分两区**，是 .28 把它们一律压成片基色才分不出来。
  修：新增 `--hdui-zone1 #2e2718`(金调) / `--hdui-zone1h #3a3120` / `--hdui-zone2 #182e28`(青绿调)
  / `--hdui-zone2h #1f3a33`。区2 用 `[style*="background"]` **子串**选择器区分（⚠️ 不能按精确值：
  站点写法带空格带分号）。亮度刻意做成 片基28 < 区1 39 ≈ 区2 41 < 区1h 50 ≈ 区2h 52
  ⇒ 保住「置顶比普通亮一档」，两区靠**色相**区分（单看亮度分不出）。
  ⚠️ hover 不能用 `--hdui-rule`(亮度 37) —— 比区1/区2 还暗，悬停会**变暗**像按下去，故各配亮档。
  ⚠️ 内层(TN)必须跟随外层 hover，否则标题格那块(真站约 315px 宽)留一块「没跟着亮」的补丁。
  ⚠️⚠️ 拼"外层 hover 的后代选择器"时**不能**用 `TN`(它以 `#torrenttable` 开头) ——
     拼出 `tr.sticky_top:hover #torrenttable table.torrentname ...` 要求行内再套一个
     `#torrenttable`，**语法合法但永远匹配不上** = 死规则。必须写相对路径
     `table.torrentname > tbody > tr`。这条是**仿真 hover 实测**抓到的(静态断言只验字符串
     存在，抓不到死规则)，详见 `pitfalls/_index.md` **P78**。
  ⚠️ 内层不能写 transparent —— 它背后是外层行的 `<td>`(站点 `td.rowfollow` 有浅底)，
     透明会直接露出浅底，那正是 .25 之前「内层白底」的来源。
  **② 促销徽章从图形改文字。** 用户报「Free 等促销标签图标不具辨识度」。
  `<img>` 是替换元素、伪元素不渲染 ⇒ `content:attr(alt)` / `::after{content:"字"}` 都出不来，
  只能**把文字画进 SVG**（`promoBadgeUri(label,color)`，仍是纯样式层）。
  文案取**站点原文**(真站 img 的 alt)：`Free` / `50%` / `2X Free`；未登记家族兜底「促销」文字。
  ⚠️ 尺寸：原来是 16×16 图形，文字更占地方 ⇒ 改 `width:auto;height:14px`，
     宽度由 SVG 固有尺寸按字数算（CJK 按 1.7 个西文宽），并**必须带 width/height**(P42)。
  ⚠️ 用户提醒「不止这 3 个促销标签」⇒ 兜底必须是可读文字，不能是空白/瞎猜的图形(P66)。
  两个新/改用例：`sim-hdui-sticky-nested`(分区)、`sim-hdui-promo-badge`(文字徽章 + 兜底)，
  均做过反向验证（区2 规则改回区1 ⇒ 红；徽章换回 iconUri ⇒ 红）。
- **2026.09.20.3：置顶行底色必须 `!important`（.28）—— 站点给部分置顶行加了 inline 粉白。**
  用户手动重装最新版后**白底仍在**，且日志 `THEME_ON ... [OK]; 列映射完整` ⇒ 排除了旧版本与结构误判。
  给用户发了控制台探针（`.workbuddy-ai/_diag-sticky-console.js`），实测：
  **104 个 `tr.sticky_top` 全在 `#torrenttable` 内、R=52 / TN=52 / neither=0**（结构完全被覆盖），
  但其中 **16 个（外层 8 + 内层 8）是 `rgb(250,238,244)`（lum 241 粉白）**。
  ⇒ 不是漏规则，是**被更强的声明盖住**。三处佐证锁定为 **inline `style="background:#FAEEF4"`**：
  ① inline 特异性 (1,0,0,0) 压得过本主题所有选择器；② 既有 `tr[bgcolor]` 那条**本来就带 `!important`**，
  若是 bgcolor 属性早被压成深色了；③ inline **白**底兜底只枚举 `rgb(255,255,255)/white/#fff/#ffffff`，
  **粉白一条都不命中**（与 P67 同型：靠值枚举迟早漏）。
  **修**：置顶行底色显式 `!important` —— 外层 `R + '.sticky_top{box-shadow:inset...;background:var(--hdui-card) !important}'`、
  内层 `TN + '.sticky_top{background:var(--hdui-card) !important}'`。
  ⚠️ **必须同时补 `R + '.sticky_top:hover{...!important}'`** —— 底色那条的 `!important`
  会把 `R + ':hover'` 的悬停反馈一起吃掉（(1,3,2) 才压得住 (1,2,2)）。
  **反向验证（本题最强证据）**：去掉 `!important` ⇒ 仿真里背景回落成 **`rgb(250, 238, 244)`**，
  与用户探针报的值**一模一样**；外内两条都去掉 ⇒ 异常 4 个（外 2 + 内 2），证明**两条都必需**。
  新增仿真断言④：直接给所有置顶行 `setAttribute("style","background:#FAEEF4")` 复现真站 inline。
  ⚠️ 静态断言踩坑：那条规则在源码里**跨行拼接**，正则必须容忍 `'\s*\+\s*'`，否则误报。
  教训（新 **P76**）：**`!important` 不是"兜底"，是 inline 声明的唯一对手** ——
  遇到"规则写了却没生效"，先分清是「没匹配上」还是「被 inline / 更高特异性与 !important 压住」，
  两者的修法完全不同（前者补选择器，后者必须 `!important`）。
- **2026.09.20.2：给「嵌套置顶」补回归网（P65 收尾）** —— 用户再报「第二段置顶种子仍是白色背景」。
  **先实测再动手**：真站样本上 `tr.sticky_top` 共 86 个（外 43 + 内 43）**全部 `self=29` 深色**，
  置顶验收 86/86、漏白 / 小件近白**双双干净** ⇒ **代码侧修复（`.25` 的 `TN + '.sticky_top{background:var(--hdui-card)}'`）
  已生效**，用户所见更可能是**跑在 `.25` 之前的旧版本**。本轮因此只补防线，不动行为：
  · **新增用例 `tests/hdhomeui/sim-hdui-sticky-nested.js`**：分层计数（外层 `R` / 内层 `TN`），
    三断言 —— 两层背景都 = `rgb(32,28,24)`（片基色，**验到色值不验"非透明"**）、
    内层**不得**有金色 inset（防内外双金条）、外层**必须**保留金色 inset（置顶视觉锚点）。
    `theme-switch` 只验了 `sticky[0]`（外层），内层一个断言都没有 —— 所以这条漏了整整一个版本。
  · **修 `check-hdui-static.js` 的假断言**：`.25` 那条带 `table\.searchbox[\s\S]*TN \+ '\.sticky_top'`
    兜底，`[\s\S]*` 跨行通配几乎恒真 —— **把修复整条删掉它也不红**（实测证实）。
    改为三条严断言（背景存在 / 内层不带 inset / 未退化成 `#torrenttable .sticky_top` 通用后代选择器）。
  · **两次反向验证**：删掉 `background` 声明 ⇒ sim 用例红（内层 `rgba(0,0,0,0)`）、静态红（1 项）；
    恢复后 36/36 全绿。
  ⚠️ 两条教训（详见 `pitfalls/_index.md` **P70 / P71**）：① **`||` 兜底 + `[\s\S]*` 通配 = 假断言**，
  写完必须反向验证一次；② **透明 ≠ 白** —— 内层漏规则时是 `transparent`，透出**外层已经上妆的深色**，
  于是**漏白 / 近白扫描都报干净**，渲染扫描根本看不见这类漏规则，只能靠"分层计数 + 具体色值"。
