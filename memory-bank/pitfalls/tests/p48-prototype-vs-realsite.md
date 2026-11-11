# 「原型」≠「真站」—— 照着设计稿写选择器，真站上会大面积打空
> 摘要: 「原型」≠「真站」—— 照着理想化设计稿写选择器，真站上会大面积打空；原型只定「目标观感」，不用来定「页面长什么样」。
> 触发: 原型 vs 真站, 选择器打空, ground truth, 类名差集, 特异性碰撞

- **触发**: HDHomeUI 胶片墙原型 `.workbuddy-ai/hdui-mock/film.html` 是手写的理想化页面，移植时把它的类名与结构当成真站的样子，结果真站上有一整批样式根本没生效，而仿真测试全绿（原因见 P49），用户报「没能完整复刻原型」才查出来。
- **判别**: 逐条对照（左=原型，右=真站）：类别图标 7 个简化家族 vs 真站 12 族（多 `c_cartoon_*`/`c_misc`/`c_4kuhd_remux`/`c_tvshows_*`/`c_tvmusics_*`）；促销标记 `span.tags.tfree` vs `<img class="pro_50pctdown|pro_free|pro_free2up">`（没有 `tfree` 类）；标签与促销混为一谈 vs `span.tags` 是另一套 23 种分类底色；列头「发布者」只有图标 vs 该格自带文字 `<td class="colhead"><a>发布者</a></td>`；站点默认 CSS 只有 `background` vs 还有 `td.colhead{color:#fff;font-weight:bold}` 等；内层 2 格 vs 3 格；行内样式无 vs 类别图带 `background-image`、RSS 带 `filter:grayscale(100%)`；通配规则无 vs `table{background-color:#bccad6}` 命中嵌套小表。
- **处置**: ① 有真站存档就用真站存档（`resources-do-not-track/` 脱敏整页 + 它的 `*.css`）当 ground truth，没有就先抓一份；② 做差集把真站 CSS 类名清单与脚本类名清单对齐，类别/标签这种前缀族按真站实际清单核对并留一条兜底规则；③ 盯住会继承/穿透的属性（`text-align`/`color`/`font-weight`/`filter`/`float`/`background`），格子自己的声明会压过从 `<tr>` 继承来的值，必须显式重置；④ 特异性碰撞不会报错（`a:hover{color}` 被 `ul#nav li a{color}` 压死），改完用 `getComputedStyle` 实测；⑤ `<img>` 是替换元素伪元素不渲染，「带文字的促销药丸」纯 CSS 做不到，只能给图形徽章。

## P48. 「原型」≠「真站」—— 照着设计稿写选择器，真站上会大面积打空

**背景**：HDHomeUI 的胶片墙原型是 `.workbuddy-ai/hdui-mock/film.html` —— 一个**手写的理想化页面**。
移植时把它的类名与结构当成了真站的样子，结果真站上有一整批样式**根本没生效**，
而仿真测试全绿（原因见 P49）。用户报「没能完整复刻原型」才查出来。

**逐条对照（左=原型，右=真站）**：

| 面 | 原型 | 真站（ground truth） | 后果 |
|---|---|---|---|
| 类别图标类名 | 7 个简化家族 | **12 族**：多 `c_cartoon_*` / `c_misc` / `c_4kuhd_remux` / `c_tvshows_*` / `c_tvmusics_*` | 未命中的那类**只被压尺寸、没被换图**，而 `catsprites.css` 是按 45×46 算的 `background-position` ⇒ 裁到 16×16 上是空白/碎片 |
| 促销标记 | `span.tags.tfree` | `<img class="pro_50pctdown\|pro_free\|pro_free2up">`（**没有 `tfree` 这个类**） | 样式一条也匹配不到 |
| 标签 | 与促销混为一谈 | `span.tags` 是**另一套东西**：`float:left;height:16px` + 23 种分类底色 | 完全没样式 |
| 列头单元格 | 「发布者」只有图标 | **该格自带文字** `<td class="colhead"><a>发布者</a></td>` | 脚本再补一遍 ⇒ 渲染成「发布者 发布者 ↓」 |
| 站点默认 CSS | 只有 `background` | 还有 `td.colhead{color:#fff;font-weight:bold}`、`table.torrents td.rowfollow{text-align:center}` | 列头是白粗字、标题被居中（脚本没重置） |
| 内层结构 | 2 格（标题 + RSS） | **3 格**（标题 / 豆瓣IMDb+下载收藏 / RSS） | 摊平成 `inline` 后变一条乱流 |
| 行内样式 | 无 | 类别图带 `style="background-image:…"`、RSS 带 `filter:grayscale(100%)` | 换上去的彩色 SVG 被去色 |
| 通配规则 | 无 | `table{background-color:#bccad6}` 会命中**标题格与 meta 格里嵌套的小表** | 深色片基上冒出浅蓝块 |

**通用对策**：
1. **有真站存档就用真站存档**（`resources-do-not-track/` 的脱敏整页 + 它的 `*.css`）当 ground truth；
   没有就先抓一份。原型只用来定"目标观感"，**不用来定"页面长什么样"**。
2. **做差集**：把「真站 CSS 里的类名清单」与「脚本里出现的类名清单」对齐，漏的那些就是没覆盖的样式。
   类别/标签这种"前缀族"要按真站实际清单核对，**并留一条兜底规则**。
3. **盯住会继承/穿透的属性**：`text-align` / `color` / `font-weight` / `filter` / `float` / `background`。
   站点给 `td.colhead` 这类**格子自己**的声明，会压过从 `<tr>` 继承来的值 —— 必须显式重置。
4. **特异性碰撞不会报错**：`a:hover{color}` 被 `ul#nav li a{color}` 压死，悬停就静默失效。
   改完用 `getComputedStyle` 实测，别只看源码里有这条规则。
5. **`<img>` 是替换元素**：伪元素不渲染 ⇒ "带文字的促销药丸"用纯 CSS 做不到，只能给图形徽章。


