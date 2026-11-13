# HDHomeUI 版本历程（二）
> 摘要: 版本历程加粗日期版本条目第二组: 原型保真度对齐、宽窄屏布局陷阱、首装上妆与导航配色、旧主题 id 迁移、旧五套主题移除
> 触发: 查版本历程, 查布局陷阱, 查主题迁移

- **2026.09.19.11：与原型 `film.html` 的保真度对齐（TASK019）** —— 用户报「未能完整复刻原型」。
  查出三类差异，共 29 条，根因是**「原型」被当成了「真站」**（详见 `pitfalls/_index.md` P48/P49）：
  · **A 类 真站适配缺失（11 条，真站上真的画错）**：类别家族只覆盖 7 族（真站 12 族，
    漏 `c_cartoon`/`c_misc`/`c_4kuhd_remux`/`c_tvshows`/`c_tvmusics`）且**无兜底** ⇒
    未命中时只压尺寸不换图，而 `catsprites.css` 是按 45×46 算的 `background-position` ⇒ 碎片；
    促销 `.tags.tfree` 在真站**一条也匹配不到**（真站是 `img.pro_*`）；真站标签 `span.tags`
    （`float:left` + 23 分类底色）完全没样式；列头「发布者」**重复**（真站该格自带文字）；
    `td.colhead{color:#fff;font-weight:bold}` 与 `table.torrents td.rowfollow{text-align:center}`
    未重置 ⇒ 列头白粗、标题居中；`torrentname` 内层行其实是**三格**却被摊平成 inline 乱流；
    `tdSel(title) img` 通杀压掉图钉/促销/下载图标；RSS 被站点 `filter:grayscale` 去色；
    `table{background:#bccad6}` 通配命中嵌套小表 ⇒ 深色底上冒浅蓝块。
  · **B 类 原型细节未搬运（13 条，观感差异）**：列头 **6 个 `::before` 图标**（类型/标题/进度/A/A·GB/发布者）
    全缺；灰阶**少一层**（补 `--hdui-dim:#7a7267`）；类别色块 16+3 → 22+6(34px)；列头图标尺寸；
    列头 hover 药丸底；数据行/列头对齐；上传者与标题的 hover 链（全局 `a:hover` 被更高特异性**压死**）；
    `#nav_block`/`#info_block` 整块缺失；导航末 6 项弱化；**入口 chip 胶囊化 + 面板卡片化**；
    入口落位（改为锚在导航右端的**预留槽位**，不再掉到第二行压住信息栏）。
  · **C 类 测试保真度不足（5 条）**：仿真页是「原型的简化副本」而非「真站的子集」⇒ 26/26 全绿但真站画错。
  **根治手段**：① 仿真页按真站脱敏页重写（类别 12 族 + 未知家族探针、真站标签类名、
  三格标题格 + 图钉 + 促销图 + 别名、站点 CSS 补齐）；② `#torrenttable{contain:inline-size}`
  切断 min-content 传播（表格不再被内容撑宽，标题列自动拿到剩余宽度，不再依赖 `calc(100vw-900px)` 魔数）；
  ③ 新增第 27 个用例 `sim-hdui-film-fidelity.js`（14 条运行时断言）+ 静态 §12，并**逐条反向验证**
  （13 项改坏→变红→改回，`.workbuddy-ai/_verify-fidelity-assertions.js`）。
  **已知取舍**：行高 ~110px（原型 ~50px）—— 真站标题格含图钉/促销/6~8 标签/别名/豆瓣IMDb/下载收藏，
  内容量本就远多于原型；标签 23 分类色保留、促销改用 3 个金徽章（`<img>` 是替换元素，伪元素不渲染，
  带文字的"药丸"纯 CSS 做不到）。全量 **27/27**。
- **2026.09.19.10：两个布局陷阱（都是"宽屏测不出、窄屏才暴露"）。**
  ⚠️ 根因同源：站点外层是**固定宽 + `table-layout:auto`**，会被内容的 `max-content` 撑开。
  ① **上妆把整页撑宽**：文档宽 **1260 → 1503**，窄屏得多横向滚 240px。
     因为 `min-width:0` 只管**收缩**（min-content），**管不住 max-content** —— 长标题把容器顶宽。
     修：标题列 `max-width:max(240px,calc(100vw - 900px))`（900 = 固定列宽和+间距+留白的约数，
     改列宽时要同步调）。实测回落 **1260，与原站持平**。
  ② **窄屏导航点不到**：脚本把 `ul#mainmenu` 改 flex 防挤，但导航条拿到 1248px，
     `flex-wrap` 不触发 → 单行排到 1218，视口 1024 时最后 2–3 项 `elementFromPoint` 返回 null。
     **原站 inline 布局会自然换行，换 flex 后必须显式给 `max-width:100vw` 才会 wrap。**
     修后 1024/900 下均 **0/16 被挡**，宽屏无影响。
  新测试 `sim-hdui-layout-width.js`（第 26 个）：文档宽 ≤ 原站、窄屏导航 0 被挡、滚动后片头吸顶
  （`Emulation.setDeviceMetricsOverride` 改视口）。详见 `pitfalls/_index.md` **P46**。
- **2026.09.19.9：① 首装直接上妆；② 导航 16 色去撞色。**
  · **首装默认改为 `FIRST_ID = 'film'`** —— 旧行为是首装不上妆（`DEFAULT_ID`），
    装完还得手动切一次才看得到界面，与"全面改为新 UI"的意图不符。
    ⚠️ `FIRST_ID` 只在**存储里没有值**时生效；用户一旦选过（含选「原站默认」）一律以存储为准，
    不会被强推回胶片墙。四处读取（`applyStored` / 等待窗口重试 / `tickPending` / `paintBootBg`）
    必须**全部**用 `FIRST_ID`，漏一处就会出现"首装读成 default"的矛盾。
  · **导航配色去撞色**（方案 B，改 `ICON_NAV` 4 行）：
    `home #f5b342→#eda23c`（饱和 90→83，收跳脱感）、`upload #d99b2b→#e0762c`（H39→25 推成橙）、
    `shield #c9a86a→#a99e8b`（降饱和变暖灰）、`logdoc #57c9a8→#94a3b8`（中性石板灰，
    让青绿独占给种子）。真撞对数 **4 → 0**。
    ⚠️ 判据必须是**三维**（`Δh≤8 且 Δs≤20 且 Δl≤15`）—— 只看色相会得到虚高的问题数
    （7 对 vs 真实 4 对），据此改色会白动一堆没问题的颜色。详见 `pitfalls/_index.md` **P45**。
- **2026.09.19.8：旧主题 id 自动迁移 —— 删主题的收尾**（用户实测
  `[HDHomeUI] 页面结构与预期不符(E_UNKNOWN_THEME) ... 未知主题 tape`）：
  他以前选的就是 `tape`，`.7` 把主题删了但 GM 存储里的值还在。两个错：
  ① **不该报错** —— 用户没做错事，是我们删的；老用户本就"选过主题、想用主题"，应静默迁到胶片墙
  并写回存储；② **错误码张冠李戴** —— `E_UNKNOWN_THEME` 被当结构类处理，用了
  「页面结构与预期不符」的横幅 + 走「等结构就绪」窗口；可这是**配置值失效**，等也不会变好
  （与 P43 同类的归因误导）。
  现在：`LEGACY_THEMES`（旧 5 套）+ `LEGACY_MIGRATE_TO = 'film'` 静默迁移；
  `CONFIG_CODES = ['E_BAD_THEME']` 与 `STRUCT_CODES` 分开；`showAlert` 按错误码分流措辞
  （配置类说「主题设置无效」，按钮给「改用胶片墙」而不是没用的「重新尝试」）。
  新增第 25 个测试 `sim-hdui-legacy-theme.js` + 静态 §11。详见 `pitfalls/_index.md` **P44**。
  ⚠️ **今后删任何主题，都要把它的 id 登记进 `LEGACY_THEMES`** —— 静态断言会提醒，但登记是人的责任。
- **2026.09.19.7：旧的 5 套主题（片库索引 / 电传纸带 / 大开本 / 瑞士网格 / 播控台）全部移除，
  改为单一主题「胶片墙」`（id: film）`** —— 用户判定那 5 套"已经没用了"。
  ⚠️ **这套新 UI 的原型早就有了**：`.workbuddy-ai/hdui-mock/film.html`（标题即「胶片墙(配色/结构/图标/按钮 重做)」），
  `.5` 的图标体系正是在它上面定稿的 —— 但当时**只移植了图标层，没把主题本身落地**，
  生产脚本里 `film` 只出现在一行「图标来源」注释里。这是 `.5` 的疏漏，`.7` 补上。
  骨架特征（每条都由 `check-hdui-static.js` §4 + `sim-hdui-theme-switch.js` 钉死）：
  · **片基**：`#torrenttable > tbody` 是纵向 `flex`，左右各一条 `::before/::after` 齿孔轨道
    （`repeating-linear-gradient`，宽 11px，9px 亮 / 13px 透），`padding-left:34px;padding-right:26px`；
  · **帧号**：行 `::before` 用 `counter(frame, decimal-leading-zero)` 打在左侧片边（`left:-24px`），
    纯 CSS 不写 DOM；
  · **片头**：表头 `position:sticky;top:0` 吸顶，`z-index:6`，每列一个可点排序目标；
    原本只有图标没有栏名的列，用 `a::after` 补中文栏名（评论/存活/大小/做种/下载/完成/发布者）；
  · **帧**：行是横向 `flex`，`min-height:50px`，`--hdui-card` 底，`border-bottom:1px solid --hdui-bg` 分隔；
  · **做种数是唯一锚点**：20px 金色 + `::after` 内嵌占比条 `width:calc(var(--hdui-ratio,0) * 100%)`；
  · **数值靠字号分层，不靠色相**（11.5 / 12 / 13 / 20px），等宽数字右对齐成列 —— 配色才不打架；
  · **置顶**用 `box-shadow:inset 3px 0 0` 金色内阴影（不占流，不把列推开）；
  · 配色 = 5 层语义灰（`ink0..ink3` + `line`）+ **唯一强调金 `#f5b342`** + 7 类别色（避开金色系，
    让金色只属于"做种/强调"）。
  **移植踩坑**：原型导航 `navitem` 是 `7px 11px`，真站放不下 —— 视口 1262px 时第 16 项「管理组」
  被挤出屏幕（`elementFromPoint` 返回 null，`sim-hdui-inline-dock` 抓到）。收到 `6px 9px` 才通过
  （最后一项中心 1218 < 1262）。**原型是理想宽度，真站要实测收窄。**
  配套删除：随旧主题一起失效的 `statStack` / `statInline` / `headStrip` 三个排版工具
  （胶片墙不用「标签+值」成块，栏名在表头），由 `tdSel` / `tdRule` 取代（同样对缺列免疫）。
