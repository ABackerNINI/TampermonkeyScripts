# HDHomeUI 胶片墙：2026-09-20 最近五轮（.26–.30）
> 摘要: 促销徽章改回站点原图、置顶两区分色、inline 粉白被压住、白底实测与未知元素卸妆专项
> 触发: 查 HDHomeUI 最近改动, 促销与置顶区排障
> 最后活动: 2026-09-20 00:00

**HDHomeUI（`src/HDHomeUI.user.js`，`2026.09.20.2`，2026-09-19 新建，TASK018/TASK019）——HDHome 界面主题：胶片墙。**
**2026-09-20 `.30`（已改码，**待审核**）——促销改回站点原图（.29 的文字徽章被否决）。**
用户明确要求「促销标签改为原图 img 显示」。
**认知**：站点 `<img class="pro_*">` 的 src 是**透明占位图**(trans.gif)，图标全靠
`background:url(icons.gif) -Xpx 0` 画 ⇒ 任何 `content:` 或 `background-image:none` 都会干掉原图。
**修**：`iconCss` 不再为 pro_* 生成任何规则；`filmCss` 只留 `min-width:16px;min-height:11px`
（兜底防新家族塌成 1×1）+ 排版微调，**不写精确 width/height**（sprites 按 36×11 定位，改了露相邻图标）、
**不写 background**。删除死代码 `promoBadgeUri`/`PRO_BADGES`/`PRO_FALLBACK_LABEL`/`PRO_FALLBACK_COLOR`。
**配套**：`hdui-scan.js` 的 scanDeco 给 `img[class*="pro_"]` 加白名单例外，否则保留的雪碧图
会被报成「站点残留装饰 bg-img」（实测 69 个）。两个金丝雀用例（unknown-canary / unknown-tags）
对 `icon-unknown-pro` 的契约随之改：不再要求换主题 SVG，只要求没被压没；**类别**图标仍必须换 SVG。
真站实测 70/70 content 未被替换、70/70 雪碧图还在。
**历程（别再绕）**：.20 图形徽章 → .29 文字徽章 → **.30 站点原图**（用户最终选择）。
⇒ 促销这种"站点自己画得挺好、尺寸也刚好"的东西，**不要替它重新设计**。
**2026-09-20 `.29`（已提交 `8776b4e` 并推送）——新需求：置顶两区分色 + 促销改文字徽章。**
① **三区分色**：用户报「无法分辨置顶区1/区2/普通区」。发探针量真站 101 行 =
  表头(0) / 置顶区1(1-41，无 inline) / 置顶区2(42-50，带 inline `background-color: rgb(250,238,244);`)
  / 普通区(51-100) ⇒ **站点本来就用两个不同底色区分两区**，是 .28 一律压成片基色才分不出来。
  修：新增 `--hdui-zone1 #2e2718`(金调)/`zone1h #3a3120`/`--hdui-zone2 #182e28`(青绿调)/`zone2h #1f3a33`，
  区2 用 `[style*="background"]` 子串选择器（不能按精确值 —— 站点写法带空格带分号）。
  亮度 片基28 < 区1 39 ≈ 区2 41 < 区1h 50 ≈ 区2h 52 ⇒ 层级保住、两区靠色相分。
  ⚠️ hover 不能用 --hdui-rule(37，比区色还暗，悬停会变暗)；内层(TN)要跟随外层 hover 否则标题格留补丁。
② **促销改文字徽章**：用户报「Free 等促销标签不具辨识度」。`<img>` 伪元素不渲染 ⇒ 只能把文字画进 SVG
  （`promoBadgeUri`）。文案取站点原文 Free / 50% / 2X Free；未登记家族兜底「促销」文字
  （用户提醒不止 3 个）。尺寸改 `width:auto;height:14px`，宽度按字数算（CJK 按 1.7 西文宽）。
新/改用例：`sim-hdui-sticky-nested`(分区) + `sim-hdui-promo-badge`(文字徽章+兜底)，
均反向验证过（区2 改回区1 ⇒ 红；徽章换回 iconUri ⇒ 红）。
**2026-09-20 `.28`（已提交 `4c53e69` 并推送）——真凶锁定：站点给部分置顶行加了 inline 粉白 `#FAEEF4`。**
用户手动重装 `.27` 后**白底仍在**，日志 `THEME_ON ... [OK]; 列映射完整` ⇒ 排除旧版本与结构误判。
发控制台探针（`.workbuddy-ai/_diag-sticky-console.js`）实测：104 个 `tr.sticky_top`
**全在 `#torrenttable` 内、R=52 / TN=52 / neither=0**（结构完全覆盖），
但 **16 个（外层 8 + 内层 8）是 `rgb(250,238,244)`（lum 241 粉白）** ⇒ 不是漏规则，是**被压住**。
锁定 **inline `style="background:#FAEEF4"`**：inline (1,0,0,0) 压过所有选择器；
既有 `tr[bgcolor]` 本来就带 `!important`（所以不是 bgcolor）；inline 白底兜底只枚举白色系（粉白漏网）。
**修**：置顶行底色 `!important`（外层 + 内层），**并补 `.sticky_top:hover{...!important}`**
（否则底色那条会把悬停反馈吃掉）。
**反向验证**：去掉 `!important` ⇒ 仿真背景回落 `rgb(250, 238, 244)`，与真站探针**完全一致**；
两条都去掉 ⇒ 异常 4 个，证明两条都必需。新增仿真断言④（直接给置顶行写 inline 粉白复现真站）。
新教训 `pitfalls/_index.md` **P76**：先分清「没匹配上」还是「被压住」，修法完全不同。
**2026-09-20 `.27`（已提交 `b4edd94` 并推送）——用户再报「第二段置顶种子仍是白色背景」：先实测再动手。**
结论：**代码侧不用改** —— 真站样本上 `tr.sticky_top` 86 个（外 43 + 内 43）**全部 `self=29` 深色**，
置顶验收 86/86、漏白 / 小件近白**双双干净**，全页 `lum>120` 的只有 `span.tags` 的 23 种分类色
（TASK019 用户拍板刻意保留）与一个金色 `a`。⇒ `.25` 的 `TN + '.sticky_top{background:var(--hdui-card)}'`
**已生效**，用户所见**高度疑似跑在 `.25` 之前的旧版本**（已请其确认已安装版本 / 强制检查更新）。
本轮只补防线，不动行为：
- 新增用例 **`tests/hdhomeui/sim-hdui-sticky-nested.js`**：分层计数（外层 `R` / 内层 `TN`），
  三断言 —— 两层背景都 = `rgb(32,28,24)`、内层**不得**有金色 inset、外层**必须**保留。
  （`theme-switch` 只验了 `sticky[0]`，内层零断言 —— 这就是它漏了一整版的原因。）
- **修 `check-hdui-static.js` 的假断言**：`.25` 那条带 `[\s\S]*` 恒真兜底，删掉修复它也不红。
  改三条严断言（背景存在 / 内层不带 inset / 未退化成 `#torrenttable .sticky_top` 通用后代）。
- **两次反向验证均已跑**：删 `background` ⇒ sim 红（内层 `rgba(0,0,0,0)`）+ 静态红（1 项）；
  恢复后 **36/36 全绿**。
新教训 `pitfalls/_index.md` **P75**：**透明 ≠ 白** —— 内层漏规则时透出的是**外层已上妆的深色**，
所以漏白 / 近白扫描**都抓不到**；这类「声明缺失」只能靠分层计数 + 具体色值断言。
**2026-09-20 `.26`（已改码，**待审核**）——「未知元素不默认屏蔽」专项（用户诉求）+ T6 基建入库：**
诉求：加测试保证**站点改版冒出来的东西（消息弹窗 / 公告 / 新种子标签）不被主题屏蔽**。
先摸底：**全脚本只有 3 条对外 `display:none`**（两个 `<br>` + 搜索箱折叠小图标），
`visibility/opacity/clip-path/content-visibility/text-indent/font-size:0` **零使用** ⇒ 立白名单成本最低。
真正的风险是 4 条隐蔽通道（**此前一条测试都没有**，P66），实测抓到 **2 个真 Bug**：
① **站点 `table.torrents{...color:#000}` 从未被重置** —— 主题只写了 background/border/padding。
   已上色的元素（标题链接/数值列/`td[data-hdui-prog]`/`font.color_*`）都是**自己的声明**所以一直没暴露，
   但站点将来在种子表里加的任何新徽章都会**继承纯黑** ⇒ 深色片基上隐形。修：`#torrenttable{...color:var(--hdui-fg)}`。
② **促销徽章没有兜底** —— `PRO_BADGES` 按名枚举，而 filmCss 的通配
   `#torrenttable img[class*="pro_"]{background:none}` 只清底不换图 ⇒ 站点新增 `pro_xxx` = 16×16 空白。
   修：枚举**之前**补一条兜底（与类别图标同一纪律：兜底必须排在具体家族之前）。
③ 顺带补上 inline 白底兜底漏掉的 **6 位写法 `#ffffff`**（公告/跑马灯最常这么写；
   漏白与对比度两条扫描**都抓不到它**，因为白底+黑字对比度是满分 —— P67）。
**结构裁决（用户）：未知结构一律卸妆** —— 新增 `E_COLUMN_UNEXPECTED`（认不出的列）/
`E_ROW_UNKNOWN`（带 colspan 的分组行），**不进等结构窗口**（不是时序问题）。
顺带修 `detectColumns` 只查 `rows[1]` 的盲区 ⇒ 改**逐行**校验（P68）。
新增 5 个用例 + 1 个共享基建，共 **34/34 全绿**：
`check/sim-hdui-hide-allowlist`（静态/运行时双层白名单）、`sim-hdui-unknown-canary`（金丝雀 8 道断言）、
`sim-hdui-overlay-safety`（浮层专项）、`sim-hdui-unknown-tags`（卸妆 + 标签前向兼容）；
`tests/lib/hdui-scan.js`（五档扫描 + 金丝雀探针，从 gitignore 的 `_verify-hdui-real-render.js` 提升入库）。
**实测结论：`contain:inline-size` 不改变 fixed 后代的定位基准（改成 strict 才会）——
T4 的位置断言把它钉死了。**
**判据纪律**：只看"元素存在/矩形非零"抓不到屏蔽，必须叠 hit-test + 对比度 Δ≥40 + 图标至少一层内联 SVG；
本轮 8 条反例里有 2 条一开始是绿的（判据太松），靠反例才发现。
