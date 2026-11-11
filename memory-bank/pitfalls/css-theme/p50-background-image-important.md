# 换图标「只换 content」不够：站点的 `background-image` 带 `!important`，雪碧图透在新图标底下
> 摘要: 换图标「只换 content」不够：站点 `background-image` 带 `!important` 时，`content:url(svg)` 只换 `<img>` 前景内容，普通声明 `background:rgba(...)` 隐含的 `background-image:none` 压不过，雪碧图透在 SVG 底下。
> 触发: 换图标, background-image, !important, 雪碧图, content

- **触发**: `<img>` 的 `content:url(svg)` 明明生效了（computed `content` 是 SVG），但界面上看起来「图标没换」，或者换上去的图形底下压着一块莫名的碎片/空白。
- **判别**: 真站是拿背景图画图标的且带了 `!important`（`catsprites.css`：`img[class*='c_']{width:45px;height:46px;background-image:url(catsprites.png) !important;background-position:-385px -8px}`、`img.download{width:16px;height:16px;background:url(png.png) -80px 0}`）；`content` 只换 `<img>` 的前景内容、背景层完全没动，而清背景用的 `background:rgba(...)` 简写隐含的 `background-image:none` 是普通声明，压不过 `!important`，于是 45×46 的雪碧图照旧画在 SVG 底下，background-position 又是按 45×46 算的，裁到 22px 的图标上就是一块碎片。
- **处置**: 背景层必须显式清/换且带上 `!important`：清掉类别图标这类「站点用雪碧图」的 `img[class*='c_xxx']{content:url(svg);background-image:none !important;background-color:rgba(类别色,.16);}`；换掉站点用 background 画的（下载/收藏）用 `img.download{content:url(svg);background-image:url(svg) !important;background-size:contain;}`（content 与 background-image 双写同一张）；判定口诀：图标「换了但看起来没换」，先量 `background-image`，别去改 content 或图标设计（与 P36「单列图标缺失先量列宽」、P42「点不到先查固有尺寸」是同一族的排查顺序）。

## P50. 换图标「只换 content」不够：站点的 `background-image` 带 `!important`，雪碧图透在新图标底下

**症状**：`<img>` 的 `content:url(svg)` 明明生效了（computed `content` 是 SVG），但界面上看起来
"图标没换" —— 或者换上去的图形底下压着一块莫名的碎片/空白。

**原因**：真站是拿**背景图**画图标的，而且带了 `!important`：

```css
/* catsprites.css */
img[class*="c_"]{width:45px;height:46px;background-image:url(catsprites.png) !important;
                 background-position:-385px -8px}
img.download{width:16px;height:16px;background:url(png.png) -80px 0}
```

`content` 只换了 `<img>` 的**前景内容**，背景层完全没动。而清背景用的是
`background:rgba(...)` **简写** —— 它隐含的 `background-image:none` 是**普通声明**，
**压不过 `!important`**。于是 45×46 的雪碧图照旧画在 SVG 底下，background-position 又是
按 45×46 算的，裁到 22px 的图标上就是一块碎片。

**正确做法**：背景层必须**显式**清/换，且带上 `!important`：

```css
/* 清掉: 类别图标这类"站点用雪碧图"的 */
img[class*="c_xxx"]{content:url(svg);background-image:none !important;
                    background-color:rgba(类别色,.16);}
/* 换掉: 站点用 background 画的(下载/收藏), content 与 background-image 双写同一张 */
img.download{content:url(svg);background-image:url(svg) !important;background-size:contain;}
```

**判定口诀**：**图标"换了但看起来没换"，先量 `background-image`，别去改 content 或图标设计。**
（与 P36「单列图标缺失先量列宽」、P42「点不到先查固有尺寸」是同一族的排查顺序。）


