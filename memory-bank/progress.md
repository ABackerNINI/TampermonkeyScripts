# 进度（Progress）

> 记忆库核心文件：已实现 / 待办 / 现状 / 已知问题。任务状态追踪见 [tasks/_index.md](./tasks/_index.md)。

## 已实现（Works）

- **PTAutoCheckIn**（`2026.09.19.4`）：被动签到 + 批量调度（发起页常驻 + 后台标签串行）+ 跨站 FAB 结果面板 + 贴吧多吧（unit 级独立冷却/状态）+ 28 站 + 贴吧 6 吧。含：FAB 四皮肤（变色/数字/信号灯/光环）、站点图标、跨天守卫、仅检测型（U2）、无按钮访问即签型（MTeam 系六站）、no-text 按钮站（NodeLoc）、签到按钮重现降级提醒（suspect）、行内单站强制重试。**v2 已并入正式版**, 生产脚本为单一 `PTAutoCheckIn.user.js`（`@name PTAutoCheckIn`）。
  **2026-09-18 慢站误判修复（P28）**：整流程超时定时器不再覆写已给出的结论（旧版 25s 后把 `skipped`/`detect_only`/`suspect` 一律改成 `failed`，是「经常失败」主因）；新增 `unconfirmed` 独立状态（未确认，不计入失败、可重试）；`writeStatus` 状态单向阶梯；点击后观察窗改事件驱动（`pagehide`/`beforeunload`/URL 变化/成功特征，上限 4s）+ 有界复检（+5s/+12s，只检测不重复点击）；`waitForElement` 可交互判定 + 慢页面超时自适应；**超时预算不变式**（`detectMs + stepsMs + 18000ms <= 40000ms`）与双校验（运行时 `auditUnitBudgets()` + `tests/ptautocheckin/check-ptac-budget.js`）；进度心跳 + 20s 零进度判死站；整流程 25s→40s、调度窗口 50s→60s。**已提交**（`ebb06bb`，分支 `dev`），待真实站点实测校准。
- **HDHomeUI**（`2026.09.19.11`，2026-09-19 新建，TASK018/TASK019）：HDHome 界面主题 —— **胶片墙**（一套，
  可在面板切回「原站默认」）。原 5 套（片库索引 / 电传纸带 / 大开本 / 瑞士网格 / 播控台）用户判定
  "已经没用"，`.7` 全部移除。**纯样式层**改造：不重建 DOM、不接管交互，
  列索引运行时探测后动态生成 CSS，原站功能（16 项导航、信息栏入口含签到、搜索箱与折叠、排序、
  RSS 增删、分页、页脚）由「功能基线快照 + hit-test」两道仿真断言守住。  结构契约（A 级锚点 + **必需**列齐全 + 行列数一致）任一不满足 ⇒ 卸妆 + 控制台 error + 顶部红色横幅 +
  写 `hdui.lastError`；运行时 MutationObserver 复查。诊断统一走 `Diag` 账本，禁止空 catch，
  挂载 window error/unhandledrejection 只记不吞。详见 `scripts/HDHomeUI.md` 与 `pitfalls.md` P33。
  **`.5`（已改码，**已提交 d56ffbb**）：新增 SVG 图标体系**（原型在 `.workbuddy-ai/hdui-mock/film.html`，
  96/48/24/16px 四档对照下经多轮用户选型定稿）。`ICONS`（31 个实心路径）+ `iconUri()` data URI 生成器；
  类别 7 类换图 + 本色 16% 淡底圆角色块、表头指标 8 个按语义各一色、导航 16 项每项一色。
  三条纪律：**图标层只写 `content` 不写死尺寸**（让主题用更高特异性覆盖，reel 16px / tape 12px 照旧）、
  `tape` 加 `navIcons:false`（它的 `[ ]` 方括号是设计语言，挂图标会顶掉）、
  导航 `href*=` 靠**顺序覆盖**（先 `torrents.php` 兜底，再 `mystat=keep`/`dead` 覆盖成保种/断种）。
  **移植踩坑 P42**：`iconUri()` 只写 `viewBox` 没写 `width/height` ⇒ `img{content:url(svg)}` 替换后
  固有尺寸 0×0，包它的 `<a>` 塌成零宽，站内 RSS 按钮点不到（两个仿真测试立刻抓到）。修：SVG 加 `width/height="16"`。
  **新测试 `sim-hdui-icons.js`（第 24 个）**：补上"图标真的画出来了"这一层断言 ——
  原有测试只能证明"没回归"，没有任何一条断言图标生效。5 套主题下逐项验 content 是 SVG 且宽度>0、
  保种≠断种、tape 导航挂 0 个、signal 色点设计保留、RSS 链接不被压塌。
  图标选型方法论固化在 `pitfalls.md` **P34–P42**（16px 幸存信号三类 / 同色叠画不可见 / 列宽吃掉图标 /
  "椭圆+竖槽≈手" / 倒置辨识度不足 / evenodd 越界 / **边缘缺 vs 内部缺** / 无图验证手段 / SVG 固有尺寸）。
  `scripts/HDHomeUI.md` 新增 §7「图标体系」。
  **`.6`（已改码，**已提交 d56ffbb**）：修正 `UNHANDLED_REJECTION` 的**归因误导**。**
  用户贴来 `[HDHomeUI] WARN UNHANDLED_REJECTION TypeError: ... reading 'innerText'`，但本脚本
  既无 `innerText` 也无任何异步代码 —— 它只是 `unhandledrejection` 的**观察方**，而这个事件是**页面级**的，
  别的脚本（本例是 `PTAutoCheckIn` 的 `visibleText()` 上层调用方）抛的异常同样会进来，
  日志前缀却写着 `[HDHomeUI]` ⇒ 把外部故障伪装成本脚本故障。
  修：日志补 **stack 首帧** + 显式「来自页面或其它脚本（本脚本无异步代码），非 HDHomeUI 故障」；
  `check-hdui-static.js` 新增 3 条断言 —— ① **脚本零异步**（无 `async`/`await`/`new Promise`/`.then`，
  这是免责的前提，将来引入异步即变红提醒同步改措辞）② 日志含免责措辞 ③ 日志取 stack。
  三断言均做过反向验证（注入 `async` / 删措辞 ⇒ 确实变红）。方法论见 `pitfalls.md` **P43**。
  **`.7`（已改码，**已提交 d56ffbb**）：移除旧 5 套, 改为单一主题「胶片墙」`film`。**
  原型 `.workbuddy-ai/hdui-mock/film.html` 早就存在（图标体系就是在它上面定稿的）, 但 `.5` 只移植了
  **图标层**、没落地主题本身 —— 用户一句"为什么还是之前的 5 套 UI, 新 UI 呢"才暴露这个疏漏。
  骨架: tbody 纵向 flex + 左右齿孔轨道(::before/::after 重复渐变) / 帧号 counter 打在片边 /
  表头 sticky 吸顶 + `a::after` 补中文栏名 / 行内嵌占比条 / 置顶 inset 金条 / 数值靠字号分层不靠色相。
  配套删除 `statStack` / `statInline` / `headStrip`（改由 `tdSel` / `tdRule`, 同样对缺列免疫）。
  **移植踩坑**: 原型导航 `navitem:7px 11px` 在真站放不下 —— 视口 1262px 时第 16 项被挤出屏
  （`elementFromPoint` 返回 null, `sim-hdui-inline-dock` 抓到）, 收到 `6px 9px` 才通过。
  **测试改造**: `sim-hdui-theme-switch` 的「签名两两不同」在只剩一套时失去意义, 改为**逐条钉死
  胶片墙骨架**（齿孔/帧号/吸顶/占比条, 少一条就不叫胶片墙）; 另有 4 处断言硬编码旧主题值
  （底色 `rgb(22,24,28)`、发布者 `text-align:right`、A 值 `::before` 标签）同步换成胶片墙的等价语义。
  全量 24/24 全绿。
  **`.8`（已改码，**已提交 d56ffbb**）：旧主题 id 自动迁移 —— 删主题的收尾。**
  用户实测 `[HDHomeUI] 页面结构与预期不符(E_UNKNOWN_THEME) ... 未知主题 tape`: 他以前选的就是 `tape`,
  `.7` 删了主题但 GM 存储里的旧值还在。两个错: ① **不该报错** —— 用户没做错事, 是我们删的,
  老用户本就"选过主题、想用主题", 应静默迁到胶片墙并写回存储; ② **错误码张冠李戴** ——
  `E_UNKNOWN_THEME` 被当结构类处理(「页面结构与预期不符」横幅 + 等结构就绪窗口),
  可这是**配置值失效**, 等也不会变好(与 P43 同类归因误导)。
  修: `LEGACY_THEMES`(旧 5 套) + `LEGACY_MIGRATE_TO='film'` 静默迁移并写回存储;
  `CONFIG_CODES=['E_BAD_THEME']` 与 `STRUCT_CODES` 分开; `showAlert` 按错误码分流措辞
  (配置类「主题设置无效」, 按钮「改用胶片墙」而非没用的「重新尝试」)。
  **新测试 `sim-hdui-legacy-theme.js`（第 25 个）**: 逐个旧 id 验「上妆成功 + 无横幅 + 存储已改写」,
  并验无效值走「主题设置无效」而非「结构不符」、不进等待窗口。静态新增 §11。
  全量 **25/25** 全绿。详见 `pitfalls.md` **P44**。
  **`.9`（已改码，**已提交 d56ffbb**）：① 首装直接上妆；② 导航配色去撞色（方案 B）。**
  ① `FIRST_ID = 'film'` —— 旧行为首装不上妆, 装完还得手动切一次才看得到界面, 与"全面改为新 UI"不符。
     ⚠️ 只在**存储无值**时生效; 用户选过(含选「原站默认」)一律以存储为准, 不会被强推回胶片墙。
     四处读取(`applyStored` / 等待窗口重试 / `tickPending` / `paintBootBg`)**必须全部**用 FIRST_ID,
     漏一处就会出现"首装读成 default"的矛盾(静态 §4 加了断言)。
  ② `ICON_NAV` 改 4 行: home→#eda23c(饱和 90→83)、upload→#e0762c(H39→25 推成橙)、
     shield→#a99e8b(降饱和变暖灰)、logdoc→#94a3b8(中性石板灰, 青绿让给种子独占)。真撞 **4→0**。
     ⚠️ 判据必须**三维**(Δh≤8 且 Δs≤20 且 Δl≤15), 只看色相会得到虚高问题数(7 vs 真实 4)。
     见 `pitfalls.md` **P45**。
  **`.10`（已改码，**已提交 d56ffbb**）：两个"宽屏测不出、窄屏才暴露"的布局陷阱。**
  ⚠️ 同源根因: 站点外层**固定宽 + table-layout:auto**, 会被内容的 max-content 撑开。
  ① **上妆把整页撑宽**: 文档宽 **1260 → 1503**。因为 `min-width:0` 只管**收缩**(min-content),
     **管不住 max-content** —— 长标题顶宽容器。修: 标题列
     `max-width:max(240px,calc(100vw - 900px))`(900 = 固定列宽和+间距+留白的约数, 改列宽要同步调)。
     实测回落 **1260, 与原站持平**, 窄屏还会自适应收缩。
  ② **窄屏导航点不到**: 脚本把 `ul#mainmenu` 改 flex 防挤, 但导航条拿到 1248px, `flex-wrap` 不触发
     ⇒ 单行排到 1218; 视口 1024 时最后 2–3 项 `elementFromPoint` 返回 null。
     **原站 inline 布局会自然换行, 换 flex 后必须显式给 `max-width:100vw` 才会 wrap。**
     修后 1024/900 均 **0/16 被挡**, 宽屏无影响。
  **新测试 `sim-hdui-layout-width.js`（第 26 个）**: 用 `Emulation.setDeviceMetricsOverride` 改视口,
  钉死「文档宽 ≤ 原站 / 窄屏导航 0 被挡 / 滚动后片头吸顶」。全量 **26/26** 全绿。
  `tests/README.md` 测试清单同步。详见 `pitfalls.md` **P46**。
  **`.4`（已提交 `4e01743`, 分支 `dev`, 已推 gitee, 10s）**：真站首装报 `E_COLUMN_UNKNOWN: a,ave`、点重试就好 ——
  A / A·GB 是**别的脚本运行时注入**的列（`#calcTHeadA` / `#calcTHeadAve`），比本脚本晚，**纯时序问题**。
  ① `a`/`ave` 改**可选列**（`REQUIRED_COLUMNS` 由全集剔除得出），缺了返回成功码 `OK_NO_CALC` 照常上妆，
  排版函数在列缺席时 `return ''`（绝不生成 `:nth-child(undefined)`）；
  ② 列集合变了用 `colMapSig` 比对并**重摆**，补进来的格子要吃到主题样式；
  ③ `ROW_CELL_COUNT_MISMATCH`（补列补到一半）进**等待窗口**（首装 8s / 运行中 4s，每 700ms 试一次），
  期间 `data-hdui-state="pending"`、**已上妆的不卸妆**；`E_COLUMN_UNKNOWN` / `E_ANCHOR_MISSING` **不等**
  （A/A·GB 变可选后这两个码只可能是真坏了）；
  ④ 新测试 `sim-hdui-optional-columns.js`（10 列照常上妆 / 补进来重摆 / 撤走不回退 / 半状态不弹横幅且自愈）
  + 剧本 `hdhome-ui-nocalc` + 静态校验 §9「可选列与等待窗口」12 条；仿真测试 22 → 23。
  **`.3`（已提交 `bc2c0cd`, 分支 `dev`, 已推 gitee, 10s）**：2026-09-19 用户报两件事 ——
  ① 右下角浮动圆钮与 PTAutoCheckIn v2 等脚本的 FAB 抢同一个位置;
  ② 5 套主题风格与原 UI 太接近, 12 个格子挤同一行 + 新 UI 按钮都堆到一起, 与设计初衷背道而驰。
  三件事: ① **入口内嵌** —— FAB 删, 量 `ul#mainmenu` 最后一个 li 的右边空档, 把入口摆成导航栏末尾的小文字钮
  `界面 · <主题名> ▾`; 面板改为锚在它下方的下拉浮层; `position:absolute` 文档坐标内嵌(随页面滚动);
  ② **版式全面重画**, 每套独立骨架（片库索引 grid 卡片+6 轨 grid 行; 电传纸带唯一保留 `display:table`;
  大开本 flex 三行+零高伪元素换行点; 瑞士网格 grid 6×3 全留白+28px 钴蓝锚点; 播控台 grid 4 轨道+电平条）,
  导航全部改成 `flex+wrap`+`--hdui-navgap` 显式列间距;
  ③ **新测试** `sim-hdui-inline-dock.js`(内嵌入口+不压站内内容+换主题重摆+右下角不被占用),
  静态校验新增 §7「入口内嵌」+ §8「版式不再堆成一坨」, 仿真测试 21 → 22; 视觉复核
  `.workbuddy-ai/_shot-hdui.js`(不入库)截 5 套顶部+中部+面板图.
  **`.2`(已提交 `1b38510`, 分支 `dev`, 已推 gitee)**: 安全性全面复验后的 4 项改进 ——
  `unload()` 补 `stopWatch()`、铺底色移到真正的 document-start、
  首次安装默认 `default`、修 `scripts/HDHomeUI.md` 的文档漂移; 静态校验同步新增第 6 组断言.
  另用**真实页面**(`resources-do-not-track/` 下已脱敏的整页)离线核验过契约判定: 12 列全部识别、
  数据行 12 格、4 个 A 级锚点齐全 ⇒ 仿真复刻与现实一致(核验脚本在 `.workbuddy-ai/`, 不入库)。
- **BTSchoolHelper**（`2026.08.09.1`）：高亮 2xFree、置顶低亮、空格跳转、完整表格解析器 `parseTorrentTable`。
- **BilibiliEnterFullscreen**（`2026.07.22.7`）：自动网页全屏 + Enter/Shift+Enter 切换，防误触输入框。
- **EnhanceVisitedLinks**（`2026.08.09.1`）：全局 `:visited` 紫色高亮 + 明暗适配 + SPA 软导航重注入。

## 现状（Current Status）

- **2026-09-19 HDHomeUI UA 渲染界面的深色化（`2026.09.19.24`，已改码，**已提交**）**：四档扫描只覆盖 DOM
  元素，滚动条/下拉弹层/自动填充/`::selection` 是浏览器画的（P56）。补 `color-scheme:dark`（主力，零几何
  改动）+ autofill 用 inset box-shadow 盖掉浅黄底 + `::selection`/`::placeholder`/`:focus-visible` +
  输入框选择器补 password/number/email/url/search/tel。踩坑：显式 `::-webkit-scrollbar{width:10px}` 会把
  文档宽 1247→1252（内容区宽 5px），已改为只着色不改几何并加反断言。
- **2026-09-19 HDHomeUI 站点 `<font>` 着色的对比度修复（`2026.09.19.17`，已改码，**已提交**）**：新增真站
  第四档扫描「对比度」，扫出 24 处看不见的字（P55）：底栏 `font.color_*` 统计值一律站点 `#1900d1`（差 9）、
  数据行暗红 `<font color>`（最暗 `#550000`，差 3）。修：`INFO_COLORS` 7 类各给可读色位 +
  `FONT_DARK_RED` 15 个暗红值枚举提亮。真站四档扫描（漏白 / 小件近白 / 残留装饰 / 对比度）**全部无 ✓**。
- **2026-09-19 HDHomeUI 补齐「站点自绘、脚本完全没接管」的图标族（`2026.09.19.16`，已改码，**已提交**）**：
  由 P53 教训①延伸出的主动排查（真站整页「残留装饰」扫描：凡 `background-image` 仍是 `url(http…)` 的
  `<img>` 都没接管），扫出 10 族。其中 **`img.time` 是真 bug**（P54）：列映射把 `time` 归一化成逻辑键
  `alive`，但 CSS 按**键名**生成 `img.alive`，真站 DOM 是 `<img class="time">` ⇒ 一条都不命中，
  6 个指标图标里偏偏「存活」还挂着站点雪碧图。修：`ICON_MET` 的 `alive`/`time` 都写。
  其余 9 族新增 `ICON_MISC`（新字形 pin/star/mail/people/plus），content + background-image 双写，
  且不加 `#torrenttable` 前缀（箭头与信箱在底栏 `td.bottom`）。真站：残留装饰**无 ✓**。
- **2026-09-19 HDHomeUI 导航页签白底修复（`2026.09.19.15`，已改码，**已提交**）**：用户第三张截图
  「首页/论坛等标签仍是白色」。真站整页小件扫描定位到 `ul#mainmenu > li > a` 共 **15 个 `rgb(222,222,222)`**。
  根因（新 P53）：站点 `ul.menu li a` 自带 1px 白边 + `#dedede` 底，脚本**只 `border:0` 没清 background**；
  而原型导航项默认无底 ⇒ 仿真页也没有这条底 ⇒ **仿真测不出来**。修：显式 `background:transparent`。
  仿真页补上这条（从真站量出来），`sim-hdui-film-fidelity` 加断言并**验证去掉修复会红（实际 15）**；
  真站「小件近白」清零。`.14` 补的是 inline style / toolbar / 分页一族兜底（同样只能靠用户截图驱动）。
- **2026-09-19 HDHomeUI 表单深色化 + 动作区改回标题后面（`2026.09.19.13`，已改码，**已提交**）**：
  用户第二张截图反馈两点：
  ① **搜索框 / 下拉框 / 单选 / 复选 / 「给我搜」按钮仍是白色**（原先对表单只设了 font-family/font-size，
     完全没管背景/边框/文字色 —— 站点白底在深色片基上刺眼）：input/select/textarea 深色底 + 金边
     + fg 字（focus 转金边），按钮深色底 + 金边 + hover 转金底深字；radio/checkbox 用 accent-color 跟主题金。
  ② **豆瓣/IMDb/下载/收藏应在标题后面**（`.12` 的 `flex:1 1 100%` 把动作按钮挤到第二行，**被用户否决**）：
     改 `flex:0 0 auto` 与标题**同行**，标题 `flex:1 1 0 + min-width:0` 让出空间（长标题缩成省略号），
     chip 内部仍是两列竖排。
  真站验收：表单 16 个、仍是近白底 **0**；4 chip 与标题**同行 ✓**；雪碧图 100/100 清 none；
  动作图标 100/100 双写；漏白扫描无；文档宽 1247 未撑宽。新断言「meta 与标题同行」+ 静态防回退。
- **2026-09-19 HDHomeUI 真站三处画错修复（`2026.09.19.12`，已改码，**已提交**）**：用户贴图报「未能完整复刻
  `film.html`」——大面积白底 / 图标未替换 / 豆瓣·IMDb·下载·收藏挤成一坨。三条**均非原型差异（原型里没有那四个
  按钮）**，是「原型派生的仿真测不到」的又一批实例（P48/P49）：
  ① **图标（新 P50）**：站点 `img[class*="c_"]{background-image:url(catsprites.png) !important}` 带 `!important`，
     脚本用 `background:rgba()` 简写清底（普通声明）压不过 ⇒ 45×46 的雪碧图透在 SVG 底下（裁到 22px 即碎片）。
     改为显式 `background-image:none !important` + 单独 `background-color`；下载/收藏（站点用 `background` 画）
     改成 content 与 background-image **双写同一张**。② **非种子页白底（新 P51）**：真凶不是 `body`（早盖住了），
     是站点通配 `table{background-color:#bccad6}` ⇒ 补通配 `table` / `td.rowfollow` / `td.colhead` / `[bgcolor]`
     + `<html>` 铺底。③ **动作按钮（新 P52）**：`<tr>` 摊平成 flex + 隐藏 `<br>` 毁掉了竖排
     ⇒ 改回 `flex-direction:column` 两列竖排（评分列 | 操作列）+ 每个动作独立 chip。
  新增真站独有的 4 个图标（豆瓣 / IMDb / 下载 / 收藏；豆瓣·IMDb **无 class**，按 `src*=` 选）。
  新测试 `sim-hdui-meta-actions.js` + 静态 §13 防回退。**待真站实测**（见 `activeContext.md` 下一步 ⑦⑧⑨）。
- **2026-09-19 主面板交互调整（`2026.09.19.4`，已改已提交(6e61d34)，待实测校准项 23）**：① **主面板失焦自动关闭** ——
  点面板外（`document` 捕获阶段 `mousedown`）或切标签页/窗口（`window` `blur`）即收起，监听随面板展开/收起挂摘；
  点在 UI 自身（`host.contains(e.target)`）与**带操作钮的横幅（中断恢复）**豁免。② **签到按钮重现不弹主面板** ——
  页面级呈现收敛为唯一入口 `presentReappearedOnPage()`（按钮描边 + ⚠ 徽标 + 底部横条 + 首次降级一条 toast），
  复核分支与入口内均无 `openPanel`。新增两层回归：静态 `check-ptac-panel.js`（钉接线）+ 真浏览器
  `sim-panel-autoclose.js`（面板在 closed shadow 下拿不到元素，用 `elementFromPoint` 的 shadow 重定向判开合；
  实测点外收起 / 点内不收起 / blur 收起 / 重现不弹且零点击 / 中断恢复横幅不误关）。
  `node tests/run-all.js` **16/16 全绿**；预算校验不变（`check-ptac-budget.js` 全通过）。**待真站实测**（校准项 23）。
- **2026-09-19 新增站点 HDHome（`2026.09.19.3`，已提交 `d63fe0c`，分支 `dev`，**已推 gitee**）**：`hdhome.org`，已签后签到入口由
  `<a href="attendance.php">签到得魔力</a>`（**无方括号**）变成魔力值行内纯文本「(签到已得N)」→ 已签判定
  走**双通道**：`alreadyPageCheck` 整页文本 + `alreadyCheck`「入口消失**且**有登录态证据(魔力值信息栏)」。
  **曾短暂用过 `noButtonMeansCheckedIn`（.2 版）后回退** —— 用户反馈"不够保险"：它只看到"入口没了"，
  看不到"人没登录"，未登录页同样无入口 → 会把漏登录报成"今日已成功"（见 P31）。
  同步新增仿真回归 `tests/ptautocheckin/sim-hdhome-pagetext.js`（四条断言：已签零点击 / 点击落地结算 /
  入口消失无文本仍判已签 / **未登录页不得判已签**，本机 Chrome 实测通过），`node tests/run-all.js`
  **14/14 全绿**；预算校验通过（C2 3 个 `alreadyCheck` 均已声明）。**待真站实测**（校准项 22）。
- PTAutoCheckIn v2 **已并入正式版**：生产脚本为单一 `src/PTAutoCheckIn.user.js`（`@name PTAutoCheckIn`，当前 `2026.09.19.4`），旧 v1 与 `-v2` 暂存文件均已删除。
- **2026-09-18 慢站误判修复（TASK015 / P28）已实施并提交**（`ebb06bb`）：`node --check` 通过；静态校验器 `tests/ptautocheckin/check-ptac-budget.js` 全部不变式通过（常量 A 6 项 / 阶梯 B 6 项 / 声明 C 2 项 / 自测 D 2 项）；运行时预算自检 32 站全通过，最紧 HHCLUB 34400/40000ms。**待真实站点实测校准（校准项 21）**，发现问题再迭代。
- **2026-09-18 测试基础设施（TASK016）已就位并提交**（`2b31377`）：测试工具从 `scripts/` 迁入 **`tests/`**；新增零依赖运行器 `tests/run-all.js`（`node tests/run-all.js` 一次跑完，约定「顶层 `tests/*.js` 每个文件 = 一个测试，以退出码表达结果」）与约定文档 `tests/README.md`。当前 1 个测试通过。
- **2026-09-18 本地仿真站与安全测试（TASK017）已实施**：`tests/lib/sim/`（零依赖服务器 + 站点剧本 + GM 垫片 + CDP 驱动）建成，
  `tests/ptautocheckin/sim-security-s*.js` 共 11 个用例，`node tests/run-all.js` **13/13 全绿**。
  实测复现 4 项 P0（favicon 跨站信标 / 面板可被宿主页面读穿 / `?ptacRetry` 强制动作 / 站外伪造签到入口）
  并**额外挖出 P0 崩溃 Bug**（P29：首次安装时主流程 100% 不执行）。
  **已修 5 处**（`@version` 2026.09.18.2 → **2026.09.18.4**，见 P30），残留 2 项（S09b / S13）需真站回归后定。
  **已提交**（`e2d5f52`，分支 `dev`）。
- **分支 `dev` 共 12 个功能提交，2026-09-19 已全部推送到 `gitee` 的新分支 `dev`**（`ebb06bb` / `2b31377` / `8036f44` / `e2d5f52` / `18e0824` / `0bac142` / `d63fe0c` / `ab9701a` / `80e0f37` / **`13266e0`（HDHomeUI）** / **`b091e16`（铁律 5）** / **`1b38510`（HDHomeUI 安全复验 4 项改进）**；推送时 `dev` HEAD = `1b38510`，`git rev-list --count dev --not gitee/dev` = 0）。
  - **GitHub（`origin`）已于 2026-09-19 推送**：按「推成同名新分支」的惯例新建 **`dev` 分支**（`97417cd`），
    **公开 `master` 未动**（仍 `322d257`）。`refs/remotes/origin/*` 由 push 自身更新，`_sync-refs.js` 因代理失效取不到值。
  - ⚠️ **全局那条 `http.https://github.com.proxy=http://127.0.0.1:10808` 当前是死的**：直连 `curl https://github.com`
    0.36s/200，走代理 `000`（无人监听）。凡是要连 GitHub 的命令都得临时禁用：
    `git -c "http.https://github.com.proxy=" ...`（值给空即禁用）。`_sync-refs.js` 没做这层处理，故对 origin 会失败。
  - 推 Gitee 时曾遇 `RPC failed; curl 55 Send failure: Connection was reset`（挂起约 5.5 分钟后被重置）；仓库仅 4.4M、最大对象 210KB，**非体积问题**，属链路抖动。加 `http.version=HTTP/1.1` + `http.postBuffer=524288000` + `http.lowSpeedLimit=0` 后一次成功。Gitee 的 SSH 通道**未配公钥**（`Permission denied (publickey)`），只能用 HTTPS。
  - 本地跟踪引用 `refs/remotes/gitee/*` 由 `.workbuddy-ai/_sync-refs.js` 直接写 loose ref 落盘（本环境 `git fetch` 对 `refs/remotes/**` 的写入会静默丢失）。
- **未 push 书账（2026-09-19 实测）**：`git rev-list --count dev --not gitee/dev` = **2**，
  即只有 **`d56ffbb`（HDHomeUI .5~.10 换胶片墙，19 文件 +1423/-440）** 与 **`57034cd`（文档登记）**
  未推送；`4e01743` / `66f48df` 已在远端（`git ls-remote gitee dev` = `66f48df`）。
  ⚠️ 书账必须**用命令复核**，别凭印象写 —— 这次凭记忆写成 5 个，实测才对上（前 3 个早推过了）。
  ⚠️ 推 gitee 用 HTTPS + `http.version=HTTP/1.1`；推 GitHub 记得先禁用那条失效代理（见上）。
- 其余脚本功能稳定，处于增量维护状态。

## 待办 / 待修（Known Bugs & Left to Build）

### 现存 Bug（优先）
- **P2 BTSchoolHelper 时魔数值恒为 0**：`calcA`/`calcAve` 误用 `parseCommaIntSafe` 解析浮点 `data-calc-a`/`data-calc-ave` → 需改 `parseCommaNumberSafe`。若排序/筛选依赖该值会导致结果失真。
- **P10 BTSchoolHelper 命名不一致**：`scrollToNext2xFreeTorrent` 内调 `getBottomTorrentId()`（小写 d）与 `arrayFindIndex`，实际定义是 `getBottomTorrentID()`（大写 D）与 `arrayFind`。当前未启用不报错；启用 N 键前必须先改名对齐。

### 待办方向（详见 tasks/_index.md）
- **近期**：**PTAutoCheckIn 慢站修复实测校准（TASK015 / 校准项 21，8 项）**——改动已提交（`ebb06bb`），须先在真实站点验证，有问题再迭代；**补测试用例（TASK016）**——`tests/` 约定与运行器已就位，待补场景矩阵/解析器回归/元数据一致性；PTAutoCheckIn 既有逐站实测校准（校准项 1–20）；签到站点覆盖扩展；BTSchoolHelper 快捷键增强（N/B 键 + 行高亮）；BilibiliEnterFullscreen MutationObserver 加固。
- **中期**：设置面板化；解析工具函数收敛；表格解析回归测试；发布自动化（版本号校验）。
- **远期**：多站点种子聚合/搜索辅助；签到结果推送（GM_notification/Server 酱）；规则热更新（远端 JSON + 缓存）；代码现代化评审。

## 已知问题（见 pitfalls.md 完整清单）

- P2、P10：上述现存 Bug。
- P16 起：PTAutoCheckIn v2 站点建模的各类已踩坑（落地页无反馈、confirmManual 卡 pending、跨天快照、验证码站、no-text 按钮、SPA 导航时序等）均已记录症状→原因→对策。

## 发布注意

- 任何代码/元数据改动必须同步递增 `@version` 并与代码同次提交；同步更新 `memory-bank/` 记忆库（见 conventions.md 第 0.4 / 1 节）。