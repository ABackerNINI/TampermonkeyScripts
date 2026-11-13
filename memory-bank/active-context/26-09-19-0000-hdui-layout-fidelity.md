# HDHomeUI 布局保真与仿真盲区（.11–.12，TASK019）
> 摘要: 真站截图三处「仿真测不到」的画错与原型 film.html 逐列保真度对齐
> 触发: 查布局保真, 仿真盲区排障
> 最后活动: 2026-09-19 00:00

**2026-09-19 `.12`（已改码，**已提交**）——真站截图反馈的三处「仿真测不到」的画错：**
用户贴图报「未能完整复刻原型」：大面积白色背景 / 图标未成功替换 / 豆瓣·IMDB·下载·收藏挤到一起。
三条**都不是原型差异**（原型 `film.html` 里根本没有那四个按钮），是 P48/P49 的又一批实例 ——
仿真剧本从原型派生 ⇒ 原型没有的东西仿真里也没有 ⇒ 全绿但真站画错。逐条：
- ① **图标"换了但看起来没换"**（新 **P50**）：真站是拿**背景图**画图标的，且
  `img[class*="c_"]{background-image:url(catsprites.png) !important}` **带 `!important`**；
  脚本用 `background:rgba(...)` 简写清底 —— 它隐含的 `background-image:none` 是**普通声明**，
  **压不过 `!important`** ⇒ 45×46 的雪碧图照旧透在 SVG 底下（position 按 45×46 算，裁到 22px 就是碎片）。
  修：类别/指标图标一律显式 `background-image:none !important` + 单独的 `background-color:`；
  下载/收藏（站点用 `background:url(png.png)` 画）改成 **content 与 background-image 双写同一张 SVG**。
- ② **非种子页大面积白底**（新 **P51**）：真凶不是 `body`（早盖住了），是站点
  `table{background-color:#bccad6}` 这条 **(0,0,1) 通配** —— 原先只覆盖 `.mainouter`/`.main`/`#torrenttable`，
  种子表之外的任何表格（我的 / 论坛 / 搜索框）都在漏这块浅蓝灰。修：补通配 `table` +
  `td.rowfollow`/`td.colhead` + `[bgcolor]`（属性选择器 + `!important`，压顶部那种亮黄通知条）；
  `<html>` 也铺底色（短页面在 body 之下会露白）。⚠️ 通配 table 不伤片基：
  `#torrenttable table{background:transparent}`(1,1,2) 特异性更高。
- ③ **四个动作按钮挤成一坨**（新 **P52**）：真站第二格靠 `<br>` 竖排，脚本为"省一行高度"把
  `<tr>` 摊平成 flex 并隐藏所有 `<br>` ⇒ 竖排结构没了，四组内容全进同一条流，只剩 6px gap。
  修：显式 `flex-direction:column` 重建竖排（左列评分 豆瓣/IMDb、右列操作 下载/收藏，两列 gap 10px），
  每个动作各自成 chip（圆角微底 + hover 转金）。
**新增标题格 4 个图标**（真站独有，原型没有）：豆瓣=条目卡 / IMDb=屏幕+播放键 / 下载=下箭头进托盘 /
收藏=书签。豆瓣·IMDb **没有 class**，只能按 `src*="icon-douban"` / `src*="icon-imdb"` 选；
配色复用已有色板、避开金色（金只属于做种数与交互态），不新增色相。
新测试 `sim-hdui-meta-actions.js`（量矩形断言四个 chip 竖排两列、两两不重叠）+ 静态 §13（防回退）。
**真站离线验收（脱敏整页 + 真浏览器，`.workbuddy-ai/_verify-hdui-real-render.js`，只输出计数与几何值）：**
类别 100/100 换成 SVG、站点雪碧图 **100/100 清成 `none`**；促销 70/70；标签 358 药丸；列头 6 图标；
四个动作各 100 个，**content 与 background-image 双双 100/100 换成 SVG**；动作区 4 个 chip **重叠 0 对**、
竖排两列全部成立（sameCol / stacked / colSplit 全 true）；**漏白扫描（>2 万 px² 且亮度 > 200 的容器）无**；
文档宽 1247 未被撑宽。**⇒ 三项修复在真站上均已生效。**
**教训：这三处的共同点 —— 原型里没有的东西，从原型派生的仿真里也不会有，
光加仿真断言补不出来，必须靠"真站截图 + 逐条对账"（而**验收**要以真站离线渲染为准）。**
**2026-09-19 `.11`（已改码，**已提交**）——与原型 `film.html` 的保真度对齐（TASK019）：**
用户报「未能完整复刻原型」。查出 **29 条差异**，根因是**「原型」被当成了「真站」**（P48/P49）：
- **A 类 11 条真站适配缺失**（真站上真的画错）：类别家族只覆盖 7/12 且**无兜底** ⇒ 未命中只压尺寸不换图、
  而 `catsprites.css` 是按 45×46 算的 `background-position` ⇒ 碎片；促销 `.tags.tfree` 在真站**一条也匹配不到**
  （真站是 `img.pro_50pctdown/pro_free/pro_free2up`）；真站标签 `span.tags`（`float:left` + 23 分类底色）没样式；
  列头「发布者」**重复**（真站该格自带文字 ⇒ 渲染成「发布者 发布者 ↓」）；
  `td.colhead{color:#fff;font-weight:bold}` 与 `table.torrents td.rowfollow{text-align:center}` 未重置
  ⇒ 列头白粗、标题居中；`torrentname` 内层行其实是**三格**（标题 / 豆瓣IMDb+下载收藏 / RSS）却被摊平成
  inline 乱流；`tdSel(title) img` 通杀把图钉/促销/下载图标全压成 12px；RSS 被站点 `filter:grayscale` 去色；
  通配 `table{background:#bccad6}` 命中嵌套小表 ⇒ 深色底上冒浅蓝块。
- **B 类 13 条原型细节未搬运**：列头 **6 个 `::before` 图标**（类型/标题/进度/A/A·GB/发布者）全缺；
  灰阶**少一层**（补 `--hdui-dim:#7a7267`）；类别色块 16+3 → 22+6(34px)；列头 hover 药丸底；
  **全局 `a:hover` 被更高特异性压死**（导航/信息栏悬停零反馈）；`#nav_block`/`#info_block` 整块缺失；
  导航末 6 项弱化；**入口 chip 胶囊化 + 面板卡片化**；入口改为锚在导航右端**预留槽位**（不再压住信息栏）。
- **C 类 5 条测试保真度不足**：仿真页是「原型的简化副本」而非「真站的子集」⇒ **26/26 全绿但真站画错**。
**根治手段**：① 仿真页按真站脱敏页重写（12 族 + **未知家族探针** `c_newfam_2160p`、真站标签类名、
三格标题格 + 图钉 + 促销图 + 别名、站点 CSS 补齐、导航标签补 NBSP）；
② **`#torrenttable{contain:inline-size}`** 切断 min-content 传播 ⇒ 表格不再被内容撑宽（1250→1247）、
标题列自动拿到剩余宽度，`calc(100vw-900px)` 退居老浏览器兜底；
③ 新用例 `sim-hdui-film-fidelity.js`（14 条运行时断言）+ 静态 §12，**13 项逐条反向验证**
（`.workbuddy-ai/_verify-fidelity-assertions.js`，改坏→变红→改回）。
**用户裁决 6 个决策点**：标签保留 23 分类色 / 促销 3 个金徽章 / 置顶图钉保留 /
豆瓣 IMDb 行内样式覆盖（全脚本唯一 `!important`）/ 导航 `word-spacing` 收掉 NBSP 后恢复 `7px 11px` /
标题格三格 flex。**已知取舍**：行高 ~110px（原型 ~50px），因真站标题格内容量远多于原型。
另修仿真基建：`server.js` 的 `/static/*` 必须**在渲染剧本之前**拦（否则返回 HTML 当图片 ⇒ `<img>` 变 alt 文字，
16px 图标撑成 83px）。全量 **27/27**。
