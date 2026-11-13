# HDHomeUI 图标体系
> 摘要: ## 7 图标体系(ICONS / iconCss / navIconCss)
> 触发: 查图标体系, 改 SVG 图标

## 7. 图标体系（`ICONS` / `iconCss` / `navIconCss`）

**站内所有图片位一律换成内联 SVG（data URI），实心 + 语义色。** 仍然只改 CSS 的
`content` / `background-image`，**不增删站点 DOM** —— 纯样式层铁律不变。

| 组 | 数量 | 选择器 | 说明 |
|---|---|---|---|
| 类别 | 7（含别名共 11 条匹配） | `#torrenttable img[class*="c_xxx"]` | 换图 + 本色 16% 淡底圆角色块 |
| 表头指标 | 8 | `#torrenttable img.{comments,time,size,seeders,leechers,snatched,user}` + `.torrentname td.rss img` | 评论/存活/大小/做种/下载/完成/发布者/RSS，各一色 |
| 导航 | 16 | `ul#mainmenu li a[href*="..."]::before` | 每项一色 |
| 标题格动作 | 4 | `img[src*="icon-douban"]` / `img[src*="icon-imdb"]` / `img.download` / `img.delbookmark` | **真站独有（原型 `film.html` 里没有）**：豆瓣 / IMDb / 下载 / 收藏 |

> ⚠️ 豆瓣与 IMDb 的 `<img>` **没有 class**，只能按 `src` 里的文件名选；
> 下载 / 收藏虽然有 class，但站点是拿 `background:url(png.png)` 画的 —— 详见纪律 4。

**四条实现纪律**（改图标时别破坏）：
1. **`iconCss()` 必须放在 `theme.css(colMap)` 之前，且只写 `content` 不写死尺寸。**
   主题用更高特异性的选择器（含 `td:nth-child()`）自己定 `width/height`。
   在图标层写死尺寸会压掉主题的排版。
2. **导航 `href` 用 `href*=` 子串匹配，且靠顺序覆盖**：先 `torrents.php`（种子）兜底，
   再用 `mystat=keep` / `mystat=dead` 覆盖成保种 / 断种 —— 后写的规则同特异性胜出。
3. **换图前先确认该图标在真站是"前景"还是"背景"画的**（P50）。
   真站 `catsprites.css` 给类别图标的是 `background-image:url(catsprites.png) !important` ——
   **带 `!important`**，而 `background:rgba(...)` 简写隐含的 `background-image:none` 是普通声明，
   根本清不掉 ⇒ 换上去的 SVG 底下仍透着 45×46 的雪碧图（裁到 22px 就是一块碎片）。
   所以类别 / 指标图标一律显式写 `background-image:none !important` + `background-color:`（色块单独给）。
4. **站点用 `background` 画的图标（下载 / 收藏）要 content 与 background-image 双写同一张。**
   只换 `content` 换不干净；两个都换成同一个 SVG，`content` 万一失效背景层还能兜住。
   颜色避开金色（金只属于做种数与交互态），全部复用已有色板，不新增色相。

**图标选型的方法论**（踩坑总结在 `pitfalls/_index.md` P34–P41，改图标前必读）：
- 16px 下只有三类信号能幸存：**缺口 / 方向 / 配件**；叶脉、茎弯折、卷边这类细节一律消失。
- 成对概念（保种 vs 断种）**保留同一轮廓 + 只改强信号**，不要发明新形状。
  → 断种 = 保种同一片叶形 + 枯黄 `#b8933a` + 右下锯齿缺角。
- 「边缘缺角」必须**把缺口直接拼进路径**（de Casteljau 切两段边界再插入向内凹的新边界），
  不能用 `evenodd` 挖孔 —— 后者读作「主体上有个洞」（内部缺），不是「轮廓被咬一口」（边缘缺）。
  生成器：`.workbuddy-ai/hdui-mock/_gen-notch.js`。
- 同色图形叠画 = 完全看不见 → 镂空必须是同一 `<path>` 内的 `fill-rule="evenodd"` 子路径。
- 新图标**先做 96 / 48 / 24 / 16 四档对照 sheet 再定稿**，别在单一尺寸上反复微调。
- ⚠️ **`iconUri()` 生成的 SVG 必须带 `width`/`height`**（现为 16×16）。
  只写 `viewBox` 的话 SVG 没有固有尺寸，`img{content:url(...)}` 替换后 img 宽高算成 **0**，
  会把包它的 `<a>` 一起压成零宽 —— 站内 RSS 按钮就点不到了（P42）。

---

