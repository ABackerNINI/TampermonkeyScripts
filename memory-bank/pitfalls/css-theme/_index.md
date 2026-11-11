# css-theme — HDHomeUI 换肤与 SVG 图标

> **本文件是生成物, 不要手改** —— 由 `commands run kb.index` 扫描本目录主题文件的三行头元数据生成; 新增 / 改名 / 改摘要后重跑即可, 冲突也只需重跑。
> 库内细路由见 [memory-bank/README.md](../../README.md)。
> **检索纪律**: 先读本索引定位, 再按需打开单个主题文件 —— **不要整读本目录**。
> **摘要**: HDHomeUI 换肤与 16px SVG 图标 —— CSS 静默失败与死规则、漏白/撞色/透明扫描判据、列结构契约、布局溢出、底色与主题扫描；换肤或改图标前先扫。
> **触发**: 换肤, 改图标, 改 CSS 规则, 排障漏白, 提交前扫描, 定图标前对照

## 主题

| 主题 | 一句话 | 触发词 |
|---|---|---|
| [p17-fab-skin-semantics.md](p17-fab-skin-semantics.md) | FAB 角标颜色语义随皮肤/状态变，读代码勿假定「角标=成功数」。 | 改 FAB 皮肤, 排查角标含义, 改辉光动画, 启用 disabled 站 |
| [p33-injected-columns-contract.md](p33-injected-columns-contract.md) | 把「别的脚本运行时注入的列」写进结构契约 → 首装必报「结构损坏」，点重试又好了。 | 接入可选列站点, 排查 E_COLUMN_UNKNOWN, 改列契约, 写仿真用例 |
| [p34-16px-icon-signals.md](p34-16px-icon-signals.md) | 16px 小图标设计：只有三类信号能幸存，细节一律消失。 | 设计小图标, 定稿前对照, 排查图标读不出, 改成对概念 |
| [p35-evenodd-fill-rule.md](p35-evenodd-fill-rule.md) | 同色图形叠画 = 完全看不见（SVG 镂空必须用 `fill-rule="evenodd"`）。 | 给图标加镂空, 排查点不显示, 排查截图哈希不变, 改 fill-rule |
| [p36-icon-layout-overflow.md](p36-icon-layout-overflow.md) | 图标「没显示」可能是被布局吃掉：列宽溢出 + `overflow:hidden`。 | 排查单列图标不显示, 改列宽, 排查 wiring |
| [p37-vertical-slot-hand.md](p37-vertical-slot-hand.md) | 「封闭主体 + 单一竖向凹槽/镂空」在 16px 下会被读成手。 | 设计枯萎叶图标, 排查图标误读, 改语义表达 |
| [p38-invert-not-semantic.md](p38-invert-not-semantic.md) | 「同一形状反过来看」辨识度不够 —— 倒置不等于语义反转。 | 设计成对图标, 排查语义读不出, 改语义表达 |
| [p39-evenodd-subpath-bounds.md](p39-evenodd-subpath-bounds.md) | `evenodd` 镂空子路径必须完全落在主体内，否则会越界填出杂形。 | 加 evenodd 镂空, 排查主体外杂色小块, 排查子路径重叠 |
| [p40-edge-notch-path.md](p40-edge-notch-path.md) | 「边缘缺角」≠「内部挖孔」：缺口必须直接拼进路径（de Casteljau）。 | 做边缘缺角, 排查被判内部缺, 改路径拼接, 用 notch 生成器 |
| [p42-svg-img-width-height.md](p42-svg-img-width-height.md) | `content:url(svg)` 换图标时 SVG 只写 `viewBox` 不带 `width`/`height` ⇒ 固有尺寸 0×0，外层 `<a>` 塌成零宽、点不到。 | 换图标, content url, SVG 固有尺寸, 零尺寸, 点不到 |
| [p45-color-3d-distance.md](p45-color-3d-distance.md) | 判定「两个颜色是否分得清」必须用 HSL 三维（色相/饱和/亮度）同时接近，只看色相会得出虚高的问题数。 | 配色撞色, 色相, 饱和度, 亮度, HSL 三维 |
| [p46-fixed-width-table-layout.md](p46-fixed-width-table-layout.md) | 站点外层固定宽 + `table-layout:auto` 时，主题有「撑宽整页」与「窄屏 flex 导航点不到」两个同源隐形陷阱。 | 固定宽布局, table-layout auto, max-content 撑宽, flex 导航, 窄屏可点性 |
| [p50-background-image-important.md](p50-background-image-important.md) | 换图标「只换 content」不够：站点 `background-image` 带 `!important` 时，`content:url(svg)` 只换 `<img>` 前景内容，普通声明 `background:rgba(...)` 隐含的 `background-imag… | 换图标, background-image, !important, 雪碧图, content |
| [p51-table-white-bg.md](p51-table-white-bg.md) | 非种子页的「大面积白底」来自站点通配 `table{background-color:#bccad6}` 命中每一张表，不是 `body`；只覆盖三处种子表的选择器会漏掉其余表格。 | 大面积白底, 通配 table, 非种子页, html 底色, bgcolor 属性 |
| [p52-flatten-inline-table.md](p52-flatten-inline-table.md) | 摊平内嵌表（`<tr>` 改 flex + 隐藏 `<br>`）会丢掉竖排结构，四个动作链接挤成一条 inline 流；竖排要显式用 `flex-direction:column` 重建。 | 摊平内嵌表, flex-direction column, br, 动作按钮, chip 矩形验收 |
| [p53-border-not-background.md](p53-border-not-background.md) | 「清 border 不清 background」= 白页签：站点 `ul.menu li a` 自带 1px 白边 + `#dedede` 底，只写 `border:0` 漏了 background，深色片基上极刺眼。 | 白页签, 清样式成对, background transparent, 漏白扫描 alpha, 大小两档 |
| [p54-logic-key-vs-dom-class.md](p54-logic-key-vs-dom-class.md) | 逻辑键 ≠ DOM class：`detectColumns()` 把站点 `time` 归一化成逻辑键 `alive`，但 `ICON_MET` 生成 `img.alive` 命中不了真站 `<img class='time'>`，两者要分开写。 | 逻辑键, DOM class, 列映射, ICON_MET, 残留装饰扫描, 作用域前缀 |
| [p55-font-color-dark-theme.md](p55-font-color-dark-theme.md) | 深色主题最容易漏的一类：站点 `<font color>` 老式着色是元素自身声明、优先级高于继承，深蓝/暗红压在深色底上等于看不见；用户只会说「那个数怎么没了」。 | font color, 老式着色, 对比度扫描, 按值枚举, 深蓝暗红, 一条一色 |
| [p56-ua-rendered-ui.md](p56-ua-rendered-ui.md) | UA 渲染的界面（滚动条 / 下拉弹层 / 自动填充 / 选中文字）不是 DOM 元素，走 `querySelectorAll` 的四档扫描永远测不出，只能靠「源码里有这几条」兜。 | UA 界面, color-scheme dark, autofill, ::selection, scrollbar 几何, 反断言 |
| [p57-css-silent-failure.md](p57-css-silent-failure.md) | CSS 的失败是静默的：规则写错会被浏览器直接丢弃（不报错也不渲染），HDHomeUI 是纯 CSS 层，渲染结果类扫描发现不了「这条规则根本没生效」。 | CSS 静默失败, 死规则, CSSOM cssRules, 语法错误, 括号, 反向验证 |
| [p58-column-grid-padding.md](p58-column-grid-padding.md) | 「同一条列网格」必须片头与数据行横向 padding 一致 —— 差 1px 就是整行错位；片头与数据行是各自独立的 flex 行，不是 table-layout 的问题。 | 列网格, 横向 padding, 逐列对齐, flex 行, 防回退断言 |
| [p59-promo-badge-colors.md](p59-promo-badge-colors.md) | 促销徽章分色：三种促销同色（全是金色 `#f5b342`）＝用户分不出哪个是 Free；「元素渲染了」≠「用户看得出」。 | 促销徽章, 撞色, pro_free, 按语义分色, 可见数探针 |
| [p60-progress-text-node.md](p60-progress-text-node.md) | 进度指示器的英文替换：CSS 换不了 text 节点里的一个词，只能动叶子 text 节点；且单词不是 `firstChild`，做种/下载两种底色不同要按 `td[bgcolor] b` 选。 | 进度指示器, 英文替换, 叶子 text 节点, firstChild, td[bgcolor] b |
| [p61-truncation-scan.md](p61-truncation-scan.md) | 「显示不全」要做成通用扫描：文本截断（scrollW/H > clientW/H）；`FILM_W` 列宽表片头与数据行共用同一套 flex-basis，列宽类问题只改这一处。 | 显示不全, 文本截断扫描, scrollWidth clientWidth, FILM_W, flex-basis |
| [p62-column-width-both-sides.md](p62-column-width-both-sides.md) | 列宽类规则必须片头 + 数据行两边都写 —— 只写一边会在窄屏错位（宽屏看不出来）；片头与数据行是两条独立的 flex 行。 | 列宽规则, 片头数据行两边, hSel, 窄屏错位, 多视口复验 |
| [p63-flatten-bg-loses-state.md](p63-flatten-bg-loses-state.md) | 压平站点底色会连状态线索一起压掉 —— 记得用文字/字色补回来；中等亮度语义色块不在漏白扫描范围内（门槛 > 200）。 | 压平底色, 状态线索, 中等亮度色块, data-hdui-prog, 认原词 |
| [p64-hover-hidden-scan.md](p64-hover-hidden-scan.md) | 「此刻可见」的扫描抓不到 hover 态 / 隐藏态的元素 —— 要主动按选择器查并读 computed 颜色；白名单要写清理由。 | hover 态, 隐藏态, 此刻可见, 主动 querySelector, 白名单理由 |
| [p65-sticky-top-two-layers.md](p65-sticky-top-two-layers.md) | 「同一条 tr.sticky_top」要分两层 —— 内层（标题格嵌套表）会漏底；真站 86 个里 43 个是内层 tr，直接子代选择器只命中外层。 | sticky_top, 内层外层两层, 直接子代选择器, 漏底白底, 元素数核对 |
| [p66-hidden-not-display-none.md](p66-hidden-not-display-none.md) | 「看不见」不等于「display:none」—— 四类隐蔽的屏蔽通道；只数 `display:none` 没用，判据要加 hit-test / 对比度 / 图标 content 三道。 | 不屏蔽未知元素, 四类屏蔽通道, hit-test, 对比度阈值 40, 反例逐个跑 |
| [p67-inline-style-enumerate.md](p67-inline-style-enumerate.md) | inline style 的兜底要按写法枚举，漏一种写法就漏一块；`[style*='background:#fff']` 没覆盖 6 位写法 `background:#ffffff`，公告条/跑马灯留一块白。 | inline style, 按写法枚举, background #ffffff, 漏白扫描, INLINE_OK 清单 |
| [p68-row-structure-per-row.md](p68-row-structure-per-row.md) | 行结构必须逐行校验 —— 只查 `rows[1]` 会放过「补列补到一半」；「抽样第一条」在逐行渐进式改动面前永远是错的，校验要覆盖全集。 | 行结构, 逐行校验, rows[1], hdhome-ui-laterow, 反例验证 |
| [p69-unknown-structure-unmakeup.md](p69-unknown-structure-unmakeup.md) | 未知结构一律卸妆（2026-09-20 用户裁决）：认不出来的列/行不猜、直接回退原站界面，也不进等结构窗口。 | 未知结构, 一律卸妆, E_COLUMN_UNEXPECTED, E_ROW_UNKNOWN, 不进等窗口 |
| [p75-transparent-not-white.md](p75-transparent-not-white.md) | 透明 ≠ 白 —— 漏规则会透出父级，渲染扫描对它是隐形的；内层 `tr` 漏规则时是 `transparent`，透出的是外层已上妆的深色 card，两档扫描只看元素自身声明的背景亮度、抓不到声明缺失。 | 透明不等于白, 声明缺失, 分层计数, 具体色值断言, 结构断言 |
| [p76-rule-not-matched-vs-overridden.md](p76-rule-not-matched-vs-overridden.md) | 规则写了却没生效 —— 先分清「没匹配上」还是「被压住」：`getComputedStyle` 取到 transparent/站点默认值 ⇒ 没匹配上（补选择器），取到某个具体颜色（既非默认也非主题色）⇒ 被压住（只能 `!important`），两种故障修法完全不同。 | 没匹配上, 被压住, !important, inline style, 按属性存在兜底 |
| [p77-flatten-bg-ask-first.md](p77-flatten-bg-ask-first.md) | 压平站点底色前，先问「这个底色在区分什么」—— P23 的第二次复发；站点本来用两个不同底色区分置顶区1/区2，.28 为让粉白不刺眼把它们一律压成片基色才抹掉界线，是「修 A 时制造 B」。 | 压平底色, 信息销毁, P23 复发, 色相补层级, hover 档 |
| [p78-valid-syntax-dead-rule.md](p78-valid-syntax-dead-rule.md) | 语法合法 ≠ 能匹配 —— 拼接后代选择器时用错「带根锚点的常量」会造出死规则；把 `TN`（`#torrenttable ...`）拼在后代组合器后面，要求置顶行内部再套一个 `#torrenttable`，永远匹配不上且不报任何错。 | 语法合法, 死规则, 带根锚点常量, 后代组合器, 运行时 hover 实测 |
| [p79-dont-redesign-site.md](p79-dont-redesign-site.md) | 别替站点重新设计它已经画好的东西 —— 促销徽章的三轮返工（图形徽章 → 文字徽章 → 站点原图）前两遍都被用户否掉；站点促销是 36×11 雪碧图尺寸刚好语义清楚，尺寸对、能看就别碰。 | 别替站点重画, 促销徽章, 三轮返工, 站点原图, 死代码删干净 |
