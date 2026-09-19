# TASK019 · HDHomeUI「胶片墙」保真度对齐（对齐原型 `.workbuddy-ai/hdui-mock/film.html`）

> 状态：**已完成实施（`2026.09.19.11`，待用户审核；未提交）**
> 触发：用户报「目前的 HDHomeUI 脚本未能完整复刻 `.workbuddy-ai/hdui-mock/film.html` 的样式」。
> 目标：把 `src/HDHomeUI.user.js` 的胶片墙做到**与原型一致**，且**在真站（不是仿真页）上一致**。
> 关联：TASK018（HDHomeUI 主题本体）、`pitfalls.md` P33–P49、`scripts/HDHomeUI.md`。

---

## 0. 实施结果（2026-09-19.11）

**用户裁决的 6 个决策点**：① `span.tags` **保留站点 23 种分类色**，只改形状；
② 促销用 **3 个金色徽章 SVG**（`prodown` / `proFree` / `pro2up`）；
③ 置顶图钉**保留**（以后再说）；④ 豆瓣/IMDb 的行内样式**覆盖**（全脚本唯一用 `!important` 处）；
⑤⑥ 其余按推荐（导航用 `word-spacing` 收掉 NBSP 后恢复原型 `7px 11px`；标题格改三格 flex）。

**阶段 0（取证）跳过**：没有单独做离线截图取证 —— 直接按阶段 1 把仿真页改成真站子集，
差异当场以"测试变红"的形式暴露（比截图更可验证），其中 `sim-hdui-layout-width` 立刻报出
文档宽 1247 → 1250、`sim-hdui-danger-guard` 报出 RSS 点不到，正是 A 类问题的实锤。

**实际落地**（详见 §4 各阶段）：
- 仿真基建：`tests/lib/sim/hdhome-ui-page.js` 按真站脱敏页重写（12 族类别 + **未知家族探针** `c_newfam_2160p`、
  真站标签类名、三格标题格 + 图钉 + 促销图 + 别名、站点 CSS 补齐、导航标签补 NBSP）；
  `tests/lib/sim/server.js` 新增 `/static/*` 静态图路由（必须在渲染剧本**之前**拦，见 P49 末尾）。
- 脚本：A1–A11 全部实施；B1–B12 全部实施。
- **根治手段（超出原计划）**：`#torrenttable{contain:inline-size}` —— 切断表格的 min-content 传播，
  表格不再被内容撑宽（1250 → 1247），标题列自动拿到剩余宽度（262px），
  `calc(100vw - 900px)` 魔数退居"老浏览器兜底"。
- 测试：新增第 27 个用例 `sim-hdui-film-fidelity.js`（14 条运行时断言）+ 静态 §12；
  **13 项逐条反向验证**（改坏→变红→改回，脚本 `.workbuddy-ai/_verify-fidelity-assertions.js`，不入库）。
- 全量 **27/27 全绿**。

**与原计划的偏差**：① 阶段 0 合并进阶段 1（见上）；② 新增了 `contain:inline-size` 这一根治手段；
③ 行高未能压到原型的 50px（实测 ~110px）—— 真站标题格含图钉/促销/6~8 标签/别名/豆瓣IMDb/下载收藏，
**内容量本就远多于原型**，这是"原型是简化理想"的固有差距，已记入 §6 风险。

---

## 0. 结论速览

差异不是"几个像素没对齐"，而是**三类问题叠加**：

| 类 | 性质 | 条数 | 后果 |
|---|---|---|---|
| **A** | **真站适配缺失** —— 原型是"理想化页面"，真站的类名/结构/站点 CSS 与原型不同，移植时没做适配 | 11 | **真站上真的画错**：图标漏、促销/标签样式打空、列头文字重复、标题居中、标题格被摊平后乱流 |
| **B** | **原型细节未搬运** —— 原型里的东西没写进生产 CSS | 13 | 观感明显不同：表头少 6 个图标、灰阶少一层、导航没有 hover、入口不是胶囊 |
| **C** | **测试/仿真保真度不足** —— 仿真页是"原型的简化副本"而非"真站的子集"，所以 A/B 全部漏检 | 5 | 26/26 全绿 ≠ 真站正确 |

**根因一句话**：`.7` 把 `film.html` 当成"配色/结构参考"移植，但**没有把 `resources-do-not-track/` 里那份真实整页当作 ground truth 逐条核对**；而仿真剧本又是照着原型写的，于是"原型→脚本→仿真"三者自洽，**唯独与真站脱节**。

**最重要的两个发现**（会直接改变做法）：

1. **标题格不是"标题 + RSS"两格，而是三格**（真站）：
   `td.embedded`(标题 + sticky 图钉 ×2 + `img.pro_*` 促销图 + `<br>` + 6~8 个 `span.tags` + 别名 span)
   → `td.embedded[width=20]`(豆瓣/IMDb 评分 + 下载/收藏)
   → `td.embedded.rss`(RSS)。
   现在生产脚本把整张 `torrentname` 摊平成 `block/inline`，真站上会变成**一长串乱流**，且标题格上的 `white-space:nowrap;overflow:hidden;text-overflow:ellipsis` 会把标签行裁掉。
2. **促销 ≠ `span.tags`**。真站促销是 `<img class="pro_50pctdown|pro_free|pro_free2up">`（3 种，共 70 处）；`span.tags` 是**标签**（`tgf/tyc/tzz/tgz/tdiy/tdb/thdr10/…` 23 种分类色）。生产脚本的 `.tags.tfree` **真站上一条也匹配不到**（`tfree` 只存在于原型/仿真页）。

---

## 1. 差异清单（逐条：现象 → 证据 → 根因 → 修法）

### A 类：真站适配缺失（会真的画错）

#### A1 类别图标在真站大面积失效 ★
- **现象**：真站 200+ 行里有若干类别的图标**完全没被换**，仍显示站点雪碧图。
- **证据**：真站实际类别 class 前缀（用脱敏整页统计）：
  `c_movies*`(61)、`c_tvseries*`(40)、`c_tvshows*`(16)、`c_anime*`(12)、`c_doc*`(11)、`c_sports*`(4)、
  `c_musics_*`(3)、`c_tvmusics*`(2)、**`c_cartoon*`(3)**、**`c_misc`(1)**、**`c_4kuhd_remux`(3)**。
  生产 `ICON_CAT` 的 11 条前缀里，`c_cartoon` / `c_misc` / `c_4kuhd` 全无匹配 ⇒ 无 `content` 覆盖。
- **为什么后果严重**：`catsprites.css` 给 `img.c_xxx{width:45px;height:46px;background-position:-433px -8px;background-image:url(...) !important}`，
  而类型格里的 img 有**行内** `style="background-image:url(pic/category/chd/scenetorrents/catsprites4.png)"`。
  未命中时 `filmCss` 只把尺寸压到 16×16，于是**按 45×46 算好的 background-position 裁到 16×16 上** ⇒ 看起来是空白/碎片。
- **根因**：`ICON_CAT` 是照原型的 7 类抄的，从未与真站类别清单对照；且**没有兜底规则**（原型用的 `c_other` 在真站是 `c_misc`）。
- **修法**：
  1. `ICON_CAT` 按真站清单补齐：`c_cartoon→anime`、`c_misc→other`、`c_4kuhd→movie`、`c_tvshows→tv`、`c_tvmusics→music`、`c_musics→music`、`c_sports→sport`。
  2. **加兜底**：`#torrenttable img[class*="c_"]` 用 `other` 图标 + 灰块，**必须排在所有具体家族规则之前**（同特异性下后者胜出）。
  3. 把"真站类别前缀清单"做成测试里的常量表，静态断言 `ICON_CAT` 必须覆盖它（见 C5）。

#### A2 促销标记样式完全打空 ★
- **现象**：真站促销标记没有任何胶片墙样式，仍是站点原样的雪碧图。
- **证据**：真站促销是 `<img class="pro_50pctdown">`(33) / `pro_free`(28) / `pro_free2up`(9)；生产脚本写的是 `.tags.tfree`（原型/仿真页专用）。
- **根因**：原型把"促销"简化成了一个 `span.tags.tfree`，移植时照抄。
- **修法**：改成对 `#torrenttable img[class*="pro_"]` 生效。
  ⚠️ **`<img>` 是替换元素，伪元素不渲染，所以"带「促销」二字的药丸"用纯 CSS 做不到**。
  推荐：给 3 个已知类各配一个 16px **金色徽章 SVG**（形状区分：↓50% / 礼物 / 双箭头），与既有图标体系一致、信息量不丢。
  备选：只做一个通用"促销"形状徽章（严格照原型的"统一药丸"意图，但丢类型信息）。**此项需用户拍板。**

#### A3 `span.tags`（真站标签）完全没有样式 ★
- **现象**：标题下方的标签仍是站点原样：`float:left`、`height:16px`、`color:#fff`、`padding:2px 3px`，23 种高饱和底色的白字小方块。
- **证据**：真站行内 `<style>`：`span.tags{color:#fff;text-align:center;float:left;margin:2px;padding:2px 3px;height:16px}` + `span.tgf{background:#06c}` … 共 23 条。
- **根因**：原型只考虑了"一个促销标签"，没有标签组。
- **修法**：`#torrenttable span.tags{float:none;display:inline-block;height:auto;margin:0 4px 2px 0;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:600;line-height:1.5;}`。
  ⚠️ 站点 23 种底色是否保留 = **决策点**：(a) 严格照原型统一金色药丸（信息量丢失）；(b) 保留分类色、只把形状改成药丸（推荐，信息量保留、观感仍统一）。**需用户拍板。**

#### A4 上传者列头「发布者」重复 ★（已用截图证实）
- **现象**：真站列头显示 `发布者 发布者 ↓`。
- **证据**：真站 `<td class="colhead"><a href="...sort=9&type=desc">发布者</a></td>` —— **该格本来就有文字**；
  原型/仿真页把这一格写成"只有图标"，所以移植时加了 `a::after{content:"发布者"}`。
- **根因**：`detectColumns()` 已经读了每个表头格的 `textContent`，但**没有把这个信息传给排版函数**，于是无法区分"有文字的格"和"只有图标的格"。
- **修法**：`detectColumns` 额外返回 `headText: {key: true/false}`（该列表头是否已有文字）。
  `filmCss` 里：`headText[k]` 为真 ⇒ **只生成 ` ↓ / ↑` 变体**；为假 ⇒ 生成"栏名"与"栏名 + ↓/↑"。
  （配合 B1 给发布者列补 `::before` 用户图标，真站上就是 `👤 发布者 ↓`，与原型一致。）

#### A5 `td.colhead` 的 `color:#fff / font-weight:bold` 未被重置 ★
- **证据**：`theme.css:202 td.colhead{white-space:nowrap;font-weight:bold;color:#ffffff;background-color:#2f4879}`。
  生产只重置了 `border/padding/background`，**没重置 `color` 与 `font-weight`**。
  列头的 `color` 是**格自己的**声明，压过从 `<tr>` 继承来的 `--hdui-headfg`。
- **后果**：列头是**纯白 + 粗体**，而原型是 `#a79e93` + 常规字重（原型 `base()` 里专门写了 `td.colhead{color:inherit;font-weight:inherit;font-family:inherit;font-size:inherit;letter-spacing:inherit;text-transform:inherit}`）。
- **修法**：把原型这段重置搬进 `filmCss`（`#torrenttable td.colhead` 的 (1,1,1) 压得住 `td.colhead` 的 (0,1,1)），并补 `#torrenttable td.colhead a{color:inherit}`。

#### A6 数据行被真站规则居中（标题居中）★
- **证据**：`theme.css:238 table.torrents td.rowfollow{text-align:center}`（(0,2,2)），真站表就是 `<table class="torrents" id="torrenttable">`。
  生产对 `type/title/uploader` **没有** `text-align` ⇒ 落到站点规则的 `center`。
- **后果**：标题居中（原型是左对齐）。
- **修法**：`tdRule`/`tdSel` 给 `type/title/uploader` 补 `text-align:left`（(1,2,2) 压得住 (0,2,2)）；列头同理补 `H > td:nth-child(type|title|progress){text-align:left}`（站点 `table.torrents td.colhead{text-align:center}` 会把列头也居中）。

#### A7 标题格（`torrentname`）结构被错误摊平 ★★ 最高风险
- **真站结构**（3 格，见 §0 结论）：
  ```
  td.rowfollow[width=100%][align=left]
    └ table.torrentname > tbody > tr.sticky_top
        ├ td.embedded              ← 图钉×2 + 标题<a><b> + img.pro_* + <br> + span.tags×N + 别名span
        ├ td.embedded[width=20]    ← 豆瓣/IMDb 评分 div + 下载/收藏 图标
        └ td.embedded.rss          ← RSS 图标
  ```
- **现状问题**：`filmCss` 把 `torrentname/tbody/tr` 全设成 `display:block`、`td` 设成 `display:inline` ⇒
  三格被拉成一条 inline 流，**豆瓣/IMDb/下载/收藏会跟在标题后面**（原型里没有这些元素，所以原型看不出问题）。
  另外 `tdSel(title)+' .embedded{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'` 作用在**整个标题格**上，
  真站的 `<br>` + 6~8 个标签 + 别名会被 `nowrap/overflow:hidden` **裁掉**。
- **修法**（照原型的观感 + 真站的结构）：
  ```css
  #torrenttable table.torrentname{display:block;width:100%;border-collapse:collapse;}
  #torrenttable table.torrentname > tbody{display:block;}
  #torrenttable table.torrentname > tbody > tr{display:flex;align-items:center;gap:8px;width:100%;background:transparent;}
  /* ① 标题格: 占满剩余宽度 */
  <titleTd>{flex:1 1 auto;min-width:0;}
  <titleTd> > a{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}  /* 省略号只加在标题链接上 */
  /* ② 豆瓣/IMDb + 下载/收藏格: 不压缩, 内部表格摊平 */
  <titleTd> ~ td.embedded:not(.rss){flex:0 0 auto;}
  <titleTd> ~ td.embedded:not(.rss) table, ... tbody, ... tr, ... td{display:inline;border:0;padding:0;background:transparent;}
  /* ③ RSS 格 */
  #torrenttable table.torrentname td.rss{flex:0 0 auto;padding-left:8px;width:auto;}
  /* ④ 内层 tr 带 sticky_top, 站点给它 #bad6f4 底色 —— 摊平成 flex 后必须重置 */
  #torrenttable table.torrentname tr{background:transparent;}
  ```
  ⚠️ 豆瓣/IMDb 那个 `div` 是**行内样式** `text-align:right;margin-right:3px;width:50px`，行内样式压过任何选择器 ⇒
  要么接受，要么对该 div 用 `!important`（**决策点**，见 §6 风险）。
  ⚠️ 动手前必须先取证（阶段 0）。

#### A8 `tdSel(title) img` 是"通杀"选择器
- **现象**：标题格里**所有** img 被压成 12px + `opacity:.55`。
- **真站标题格的 img 清单**：`img.sticky`(14px, 置顶图钉 ×2)、标题链接、`img.pro_*`(促销)、`span.tags`、别名；第二格里还有 `img.download`/`img.delbookmark`(16px)、豆瓣/IMDb 图标。
- **修法**：收窄到只作用于 RSS：`<titleTd> .rss img{width:12px;height:12px;opacity:.55;filter:none;}`；
  图钉单独处理（建议 `display:none` —— 置顶已有金色 inset 条标记，且原型里没有图钉）；促销/下载/收藏图标各自单独定尺寸。

#### A9 RSS 图标被站点去色
- **证据**：真站 `<style>a[data-toggle-rss] img{width:32px;-webkit-filter:grayscale(100%);filter:grayscale(100%)}</style>`（(0,1,2)）。
  生产把 RSS 换成彩色 SVG（`#c9a86a`）后**没有重置 `filter`** ⇒ 渲染出来是灰的。
- **修法**：`<titleTd> .rss img{filter:none;-webkit-filter:none;}`（(1,2,2) 压得住）。

#### A10 `td.rss{width:32px}` 未重置
- 真站 `td.rss{width:32px}`（(0,1,1)）；生产只加了 `padding-left:8px`。修：补 `width:auto`。

#### A11 内层 `tr.sticky_top` 的站点底色
- 真站 `theme.css:721 .sticky_top{background-color:#bad6f4}`。外层 tr 被 `R{background:var(--hdui-card)}`(1,2,1) 压住没问题，
  **内层 tr 没有任何规则覆盖** ⇒ 一旦 A7 把它变成 flex 行，就会露出浅蓝底。修：见 A7 ④。

---

### B 类：原型细节未搬运（观感差异）

| # | 项 | 原型 (`film.html`) | 生产现状 | 修法 |
|---|---|---|---|---|
| **B1** | 列头补充图标 ★ | 类型/标题/进度/A/A·GB 用 `::before` 补 `hcat/htitle/hprog/hcalc/hratio`（HCOL 配色，13px，`margin-right:6px`，`vertical-align:-2px`） | **完全没有**，`ICONS` 表里也没有这 5 个图形（截图已证实列头左半是纯文字） | 把 5 个实心路径加进 `ICONS`；发布者列复用 `user` 图标；在 **`filmCss`** 里生成 `::before` 规则（⚠️ 不能放 `iconCss()` —— 静态 §10 断言 `iconCss` 不得出现 `width:Npx`） |
| **B2** | 类别色块 | `22px` 内容 + `padding:6px` = **34px** 块、`radius:10px`、`display:block`、`ROW:hover` 底色 16%→26% | `16px` + `padding:3px` = 22px 块、`radius:8px`、`inline-block`、**无 hover** | `filmCss` 的 `type img` 规则补 `width/height/padding/border-radius/display`；hover 加亮放 `iconCss`（需把 `const R`/`const H` 上移到 `iconCss` 之前） |
| **B3** | 列头图标尺寸 | `H>td a img{width:16px;height:16px;flex:0 0 16px;opacity:.95}` | **无**（真站 `img.comments` 等**没有任何 CSS**，靠 SVG 固有尺寸兜着；flex 下可被压缩） | 照抄原型这条 |
| **B4** | 列头链接 hover | `color:gold;background:rgba(gold,.12)` + `transition:background .14s,color .14s` | 只有 `color:accent`，**无底色、无过渡** | 补 |
| **B5** | 列头对齐 | `type/title/progress` 显式 `text-align:left` | 无（真站 `table.torrents td.colhead{text-align:center}` 生效 ⇒ 居中） | 补（同 A6） |
| **B6** | 灰阶层次 ★ | **三层**：`fg #f2ede5` / `fg2 #a79e93` / `fg3 #7a7267` | **两层**：`--hdui-fg` / `--hdui-muted`(= 原型的 fg2)；**缺 fg3** | 新增 `--hdui-dim:'#7a7267'`（并保留 `--hdui-muted` 作 fg2）。逐列对齐：`comments/alive/a/ave/进度/上传者/帧号/#info_block` → **dim**；`size/leechers/snatched` → **muted**；`title` → **fg** |
| **B7** | 上传者链接 | `a{color:fg3}` + `a:hover{color:gold}` | 无 ⇒ 走全局 `a{color:#f2ede5}`（亮两档） | 补两条 |
| **B8** | 标题链接 hover | `a:hover{color:gold}` | 无；且全局 `a:hover`(0,2,2) 被 `tdSel(title)+' a'`(1,2,1) 压死 ⇒ **悬停零反馈** | 补 `tdSel(title)+' a:hover'` |
| **B9** | 全局 `a:hover` 失效面 | — | `html[data-hdui-theme] a:hover`(0,2,2) 被 `ul#mainmenu li a`(1,1,4)、`#info_block a`(1,1,3) 压死 ⇒ 导航/信息栏悬停无反馈 | 给导航、信息栏各自补 hover 规则；并复核所有 `a` 的悬停链 |
| **B10** | 导航整体 ★ | `#nav_block{position:relative;background:ink1;padding:10px 0 8px;border-bottom:1px solid line}`；`#info_block{padding:6px 20px 10px;font-size:11.5px;color:fg3}` + `b{color:fg2;font-weight:600}`；`#mainmenu{row-gap:2px;column-gap:2px;padding:0 20px}`；`li a{display:flex;gap:6px;padding:7px 11px;border-radius:9px;color:fg2;font-size:12.5px;font-weight:500;transition}` + `a:hover{background:rgba(255,255,255,.055);color:fg}`；`li:nth-child(n+11) a{font-size:11.5px;color:fg3}` + 图标 `12px/opacity:.6`；图标 15px/.85 | `#nav_block`/`#info_block b` **整块缺失**；item 无 hover 底/字号/字重/过渡；末 6 项无弱化；图标 14px/.88；`navitem` 被压到 `6px 9px`（`.7` 为塞下第 16 项） | 逐条补齐。**宽度问题的真正原因不是原型 padding 大，而是真站标签自带 NBSP**（`&nbsp;首&nbsp;&nbsp;页&nbsp;`）⇒ 建议用 `ul#mainmenu{word-spacing:-.35em}` 吃掉 NBSP，从而**恢复原型的 `7px 11px`**。⚠️ `word-spacing` 对 U+00A0 生效需实测确认（阶段 4 第一件事）；不成立则保留 `6px 9px` 并在文档里登记为"已知偏差" |
| **B11** | 入口 chip / 面板 ★ | chip：空心胶囊 `height:27px;padding:0 11px;border-radius:999px;font-size:11.5px` + `border:1px solid rgba(gold,.32)` + 6px 金点 + 三角 caret + hover(金底 13% + 金边 + fg)；面板：`340px / grid 2 列 / radius 16 / padding 12 / box-shadow:0 20px 50px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.03)`，条目 `30×30` 图标方块 + 选中金边金底 + `small` 副标题 | 纯文字钮（`background:transparent;border:0;font:11px/1`，只显示 `界面 · 胶片墙 ▾`）；面板 `268px / flex 单列 / radius 8 / shadow 0 8px 28px`，条目无图标 | 重写 `panelCss()` 对齐原型（closed shadow，CSS 独立于主题 CSS）；`syncUiVars()` 补 `--ui-panel/--ui-fg2/--ui-dim/--ui-accent`；`renderPanel()` 改造成 `<i>` + `<span><b>名</b><small>说明</small></span>`（用 `createElement`，**不得用 innerHTML**）；`DOCK_W 132→150`、`DOCK_H 22→27`（`HOST_BASE` 引用这两个常量，会自动跟随）；诊断区保留、`grid-column:1/-1` 跨列 |
| **B12** | 入口落位 ★ | chip 是 `#nav_block` 内的 absolute 元素，天然在导航同行右侧 | `film-top.png` 显示：16 项导航铺满一行 ⇒ 走 `lr.bottom+6` 兜底 ⇒ **掉到第二行、正好压在 `#info_block` 上** | ① 先用 B10 的 `word-spacing` 腾出空档，回到"导航同行右侧"（原型效果）；② 仍不行则改落点为 `#nav_block` 右端 / 与 `#info_block` 垂直错开；③ 新增断言"入口矩形不得与 `#info_block` 内任何元素相交" |
| **B13** | 杂项 | `#torrenttable td{vertical-align:middle}`；`#torrenttable img{width:auto;height:auto;background-image:none;background-position:0 0}`；`table.torrentname{width:100%;border-collapse:collapse}`；`sel(type){align-self:center}`；`sel(title) img:hover{opacity:1}`；`.tags` 药丸用 `rgba(gold,.14)` | 均缺 | 逐条补（`#torrenttable img` 那条是 (1,0,1)，**能压住 `catsprites.css` 的 `img.c_xxx`(0,1,1)**，正是 A1 的兜底之一） |

---

### C 类：测试/仿真保真度（A/B 全漏检的原因）

#### C1 仿真页 `SITE_CSS` 缺真站规则
`tests/lib/sim/hdhome-ui-page.js` 现有：`table.torrents td{border:1px solid #b0c4de;padding:5px}`、`td.colhead{background:#000080;color:#fff;font-weight:bold}`、`td.rowfollow{background:#f4f4f9}`。
**缺**：`table.torrents td.rowfollow{text-align:center}`、`table.torrents td.colhead{text-align:center}`、
`td.colhead{white-space:nowrap}`、`span.tags{float:left;color:#fff;height:16px;padding:2px 3px}` + 分类底色、
`a[data-toggle-rss] img{width:32px;filter:grayscale(100%)}`、`td.rss{width:32px}`、`img.c_*{width:45px;height:46px;background-position:...}`。
⇒ **A5/A6/A8/A9/A10 在生产里存在，但仿真里根本复现不出来。**

#### C2 仿真页类别类名用了原型的简化清单
`CATS = ['c_tvseries_2160p','c_movies_4kuhd','c_movies_bluray','c_music_lossless','c_document_1080p','c_tvseries_1080p','c_movies_remux','c_music_video']`
⇒ 全部命中 `ICON_CAT`，**`c_cartoon_*` / `c_misc` / `c_4kuhd_remux` / `c_tvshows_*` / `c_tvmusics_*` 一个都没有** ⇒ A1 无法被发现。

#### C3 仿真页标签用了 `tfree`
`<span class="tags tfree" …>促销</span>` —— 真站**没有 `tfree`**。⇒ A2 无法被发现。

#### C4 仿真页标题格是 2 格且无图钉/促销图
仿真只有 `td.embedded`(标题+促销 span) + `td.embedded.rss`；真站是 3 格 + `img.sticky`×2 + `img.pro_*` + 别名 span。⇒ A7/A8 无法被发现。

#### C5 静态校验不校验类别前缀覆盖率
`check-hdui-static.js` §10 只校验"引用的图标名都在 `ICONS` 里"，**不校验 `ICON_CAT` 的前缀是否覆盖真站类别清单**。⇒ A1 即使被"修一半"也照样绿。

---

## 2. 为什么现有 26 个测试全绿却没抓到

```
原型 film.html  ──(移植)──▶  src/HDHomeUI.user.js
      │                            ▲
      └──(照抄简化版)──▶ tests/lib/sim/hdhome-ui-page.js ──(断言)──┘
                              ✗ 没有一条线连到真站
```
`resources-do-not-track/HDHome-Whole-Web/` 里有**已脱敏的真实整页 + 它的全部 CSS**，
但只在 `.1` 时用它离线核验过**契约判定**（12 列识别 / 4 个锚点），**从未用它核验过样式**。
→ 结论：**"仿真全绿"只证明"没有回归"，不证明"真站画得对"。** 这条要写进 `pitfalls.md`。

---

## 3. 实施阶段（建议按此顺序；每阶段结束跑一次全量测试）

### 阶段 0 · 取证（不改代码）
- 扩展 `.workbuddy-ai/_verify-hdui-real-page.js`（不入库）或新写 `_diag-film-real.js`：
  把脱敏整页喂进无头浏览器，**不上妆 / 上妆**各截一张图 + 导出
  `torrentname` 内层行的 `getBoundingClientRect` / `display` / `text-align` / 列头 `color`·`font-weight` 实测值。
- **目的**：A7（三格标题行）必须**眼见为实**再动手 —— 这是全表最高风险项。
- 产出：一张"现状 vs 原型"对照图 + 一份实测值清单（存 `.workbuddy-ai/`，不入库）。

### 阶段 1 · 先把仿真页改成"真站的子集"（C1–C4）
- 按 C1 补 `SITE_CSS`；按 C2 换类别清单；按 C3 换标签类名；按 C4 补第 3 格 + 图钉 + 促销图 + 别名 span。
- ⚠️ **本阶段结束时测试应当大面积变红** —— 那是预期结果，说明仿真终于能"看见"真站差异。
- 逐条确认变红项与 §1 的 A/B 清单**对得上**（对不上的说明还有没发现的差异）。

### 阶段 2 · 真站适配（A1–A11）
- A1 类别前缀 + 兜底；A2 促销；A3 标签；A4 列头去重（`headText`）；A5 `colhead` 重置；A6 对齐；
  A7 标题格三格 flex 化；A8 收窄 img 选择器；A9 去 filter；A10 宽度；A11 内层底色。
- 每改一条，确认阶段 1 里对应的红项转绿。

### 阶段 3 · 原型细节（B1–B9）
- B1 列头 6 个 `::before` 图标；B2 类别色块 34px + hover；B3 列头图标尺寸；B4 列头 hover；B5 列头对齐；
  B6 补 `--hdui-dim` 并按原型逐列对齐灰阶；B7 上传者链接；B8 标题链接 hover；B9 悬停链补齐。

### 阶段 4 · 导航与外壳（B10–B12）
1. **先测 `word-spacing` 对 NBSP 是否生效**（决定导航能否恢复原型的 `7px 11px`）。
2. 补 `#nav_block` / `#info_block` / 导航 item / 末 6 项弱化 / 图标尺寸。
3. 重写 `panelCss()` + `renderPanel()` + `syncUiVars()`；调 `DOCK_W/DOCK_H`。
4. 修入口落位（B12）。
5. ⚠️ **必跑 `sim-hdui-layout-width.js`**：改导航/入口尺寸会动整页高度与文档宽（P46 的教训：`min-width` 治不了 `max-content`），窄屏 + 滚动都要重测。

### 阶段 5 · 测试与文档
- 新增用例 + 静态断言 + 反向验证 + 文档/版本号（见 §4/§5）。

---

## 4. 测试改造清单

### 新增 `tests/hdhomeui/sim-hdui-film-fidelity.js`（第 27 个用例）
逐条比对"原型设计值"（**都是运行时实测，不是源码字符串匹配**）：

| # | 断言 |
|---|---|
| 1 | 列头 6 列（类型/标题/进度/A/A·GB/发布者）的 `::before` 存在且 `background-image` 非 `none`、宽 > 0 |
| 2 | 列头文字**不是** `rgb(255,255,255)`、`font-weight` 非 700 |
| 3 | 数据行 `type/title/uploader` 是 `text-align:left`；`progress` 是 `center` |
| 4 | 标题与 RSS **同一行**：`rss.top` 与 `title.top` 差 < 4px 且 `rss.left > title.left` |
| 5 | 类别色块外框 ≈ 34px（22 内容 + 6 padding ×2）、`border-radius:10px` |
| 6 | 上传者色 = `rgb(122,114,103)`；`size/leechers/snatched` = `rgb(167,158,147)` |
| 7 | 上传者列头**不重复**：该列 `a::after` 内容不含"发布者" |
| 8 | 促销：`img.pro_50pctdown` 的 `content` 非 `none` 且是内联 SVG |
| 9 | 标签：`span.tags` 的 `float` 是 `none`、`border-radius` 是 `999px` |
| 10 | 导航：真实鼠标 hover 第 1 项后 `background-color` 非透明；第 11 项起 `font-size:11.5px`；图标 15px / 末 6 项 12px |
| 11 | 入口 chip：`border-radius:999px`、`border-color` 非透明、高度 27px、存在 6px 圆点元素 |
| 12 | 面板：`border-radius:16px`、宽 340px、条目有 30×30 图标块 |
| 13 | 类别兜底：`c_cartoon_8k4320p` / `c_misc` / `c_4kuhd_remux` 也有内联 SVG `content`（不是站点雪碧图） |
| 14 | 入口矩形**不与 `#info_block` 内任何元素相交**（B12） |

### `check-hdui-static.js` 增补
- **§12 类别前缀覆盖率**：内置"真站类别前缀清单"常量（`c_movies/c_movie/c_tvseries/c_tvshows/c_anime/c_cartoon/c_doc/c_musics/c_tvmusics/c_sports/c_misc/c_4kuhd`），断言 `ICON_CAT` 全覆盖 + 存在 `img[class*="c_"]` 兜底规则。
- `src` 里**不得再出现 `.tags.tfree`**。
- 列头栏名生成必须带"仅当该列无文字"的条件（断言源码含 `headText`）。
- `ICONS` 至少 31 个（新增 5 个列头图标）。
- 保留现有 §4/§8 的字面量断言（`ul#mainmenu{display:flex;flex-wrap:wrap`、`--hdui-navgap`、`--hdui-navitem`、`basis.push(H + ` / `basis.push(R + `）—— 改导航 CSS 时别改这几处的写法。

### 纪律
- **每条新断言都要反向验证一次**（改错 → 确认变红 → 改回），写进 `tests/README.md` 的经验里。
- 文本类断言用**完全匹配**（`getComputedStyle().content` 返回带双引号的字符串）。
- `node tests/run-all.js` 收尾须 **27/27 全绿**。

---

## 5. 文档与版本（与代码同次提交）

- `src/HDHomeUI.user.js`：`@version` `2026.09.19.10` → **`2026.09.19.11`**（后续每轮递增）。
- `memory-bank/scripts/HDHomeUI.md`：新增「§9 与原型 `film.html` 的对齐清单」（A/B/C 三类差异 + 决策点），
  更新 §3 主题表、§4 交互（chip/面板新外观）、§7 图标体系（列头 5+1 个新图标、促销徽章）。
- `memory-bank/pitfalls.md`（P47 已被占用，本条从 **P48** 起编号）：
  - **P48**「原型 ≠ 真站」：类别前缀 / `tags` 类名 / `colhead` 覆盖 / `rowfollow` 居中 / `colhead` 白粗字 /
    促销是 `img.pro_*` 不是 `span.tags` / `torrentname` 三格结构 / `filter:grayscale` —— 逐条给"症状→真站规则→对策"。
  - **P49**「仿真页是理想化副本 ⇒ 26/26 全绿但真站画错」：方法论 —— **仿真剧本必须从真站脱敏页派生，不能从原型派生**；
    「全绿只证明没回归，不证明真站对」。
- `memory-bank/tasks/TASK019-hdhomeui-film-fidelity.md`（本文件）+ `tasks/_index.md` 登记 + `activeContext.md` / `progress.md` 同步。
- `tests/README.md` 用例清单加 `sim-hdui-film-fidelity.js`。
- ⚠️ **不自动 `git commit` / `push`**，等用户审核。

---

## 6. 风险与决策点（需用户拍板）

| # | 决策点 | 选项 |
|---|---|---|
| D1 | **`span.tags` 配色** | (a) 统一金色药丸（严格照原型，丢 23 种分类信息） / **(b) 保留分类色 + 只改形状（推荐）** |
| D2 | **促销标记呈现** | (a) 3 个金色徽章 SVG（↓50% / 礼物 / 双箭头，保信息量，**推荐**） / (b) 一个通用"促销"形状徽章（严格照原型意图） |
| D3 | **置顶图钉 `img.sticky`** | (a) 隐藏（置顶已有金条，原型无图钉，**推荐**） / (b) 保留并单独定尺寸 |
| D4 | **豆瓣/IMDb 那个行内 `div`** | (a) 接受其行内样式（`text-align:right;width:50px`） / (b) 用 `!important` 覆盖（能更贴近原型，但引入 `!important`） |
| D5 | **导航间距** | (a) `word-spacing` 吃掉 NBSP 后恢复原型 `7px 11px` / (b) 保留 `6px 9px` 并登记为已知偏差 |
| D6 | **A7 标题格布局** | 三格 flex 化（推荐） vs 其他方案 —— 建议**阶段 0 取证后再定** |

**其他风险**：
- **A7 是全表最高风险项**：改的是站内真实结构的呈现方式，且真站三格里有两格原型里不存在。**必须取证 + 截图复核**，仿真通过不算数。
- 改导航 padding / 入口尺寸会动**文档宽**，必须重跑 `sim-hdui-layout-width.js`（P46）。
- 恢复类别色块到 34px：`FILM_W.type = 44px` 仍放得下（34 ≤ 44），**列宽表不用改**；
  但 `tdSel(title)` 里 `calc(100vw - 900px)` 的 `900` 是"固定列宽和 + 间距 + 留白"的约数，
  **若最终改了任何 `FILM_W` 值，必须同步重算这个常数**（注释里已写明）。
- 恢复导航 hover 底色等会新增若干 `rgba()` 字面量；建议引入 `FILM_ACCENT` 常量 + `rgba()` 辅助生成，避免金色散落在多处。

---

## 7. 验收标准

1. `node tests/run-all.js` → **27/27 全绿**。
2. `sim-hdui-film-fidelity.js` 的 14 条断言全过，且**每条都做过反向验证**。
3. **真站脱敏页离线复核**：上妆后截图与 `.workbuddy-ai/hdui-mock/shot-film.png` 并排比对，
   列头 6 图标 / 类别色块 / 灰阶层次 / 导航 hover / 入口胶囊 / 面板卡片 **逐项肉眼可辨为一致**。
4. `sim-hdui-layout-width.js` 仍绿（文档宽 ≤ 原站、窄屏导航 0 被挡、滚动后片头吸顶）。
5. `sim-hdui-function-parity.js` / `sim-hdui-danger-guard.js` / `sim-hdui-icons.js` 仍绿（功能与安全零回归）。
6. 文档四件套（脚本页 / pitfalls / task / activeContext）已同步，`@version` 已递增，**未自动提交**。

## 8. 明确不做的事

- 不改任何站内 DOM 结构 / 事件 / `href`（纯样式层铁律不变）。
- 不删任何站内元素（`display:none` 仅用于 D3 的置顶图钉，且需用户确认）。
- 不为"通过测试"改生产代码，也不给测试留后门。
- 不引入依赖、不引入异步代码（静态 §10 的"零异步"不变量必须保持）。
