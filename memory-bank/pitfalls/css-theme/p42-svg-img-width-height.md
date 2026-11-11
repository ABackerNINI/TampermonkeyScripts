# `img{content:url(svg)}` 换图标时 SVG 必须带 width/height，否则 img 宽高算成 0
> 摘要: `content:url(svg)` 换图标时 SVG 只写 `viewBox` 不带 `width`/`height` ⇒ 固有尺寸 0×0，外层 `<a>` 塌成零宽、点不到。
> 触发: 换图标, content url, SVG 固有尺寸, 零尺寸, 点不到

- **触发**: 给站内图标换上内联 SVG 后，`sim-hdui-function-parity` / `sim-hdui-danger-guard` 报「站内元素尺寸为 0(主题把它遮没了): #torrenttable [data-toggle-rss] {"w":0,"h":21}」—— 图标所在的 `<a>` 被压成零宽，hit-test 失败、点不到。
- **判别**: `content: url(...)` 替换的是 `<img>` 的替换内容，新的固有尺寸由替换内容决定；SVG 只写 `viewBox="0 0 24 24"` 而没写 `width`/`height`（靠 CSS 撑开）时固有尺寸就是 0×0，包它的 `<a>` 随之塌成零宽；站点原本的 `rss.png` 有位图固有尺寸，所以换之前一切正常。
- **处置**: 生成 data URI 时同时给出 `width` 和 `height`（`<svg viewBox="0 0 24 24" width="16" height="16" fill="...">`，viewBox 负责缩放路径、宽高负责固有尺寸），主题再用自己的规则缩到 12/16px；图标层只写 `content`、不写死尺寸，让各主题用更高特异性选择器自己定宽高；判定口诀：换完图标后站内元素「点不到」/「零尺寸」，先查替换内容的固有尺寸，而不是查选择器。

## P42. `img{content:url(svg)}` 换图标时 SVG 必须带 width/height，否则 img 宽高算成 0

**症状**：给站内图标换上内联 SVG 后，`sim-hdui-function-parity` / `sim-hdui-danger-guard` 报
`站内元素尺寸为 0(主题把它遮没了): #torrenttable [data-toggle-rss] {"w":0,"h":21}` ——
图标所在的 `<a>` 被压成零宽，hit-test 失败、点不到，站内交互"死了"。
**为什么会发生**：`content: url(...)` 替换的是 `<img>` 的**替换内容**，
新的固有尺寸（intrinsic size）由替换内容决定。若 SVG 只写了 `viewBox="0 0 24 24"` 而**没有 `width`/`height`**
（矢量图常见写法，靠 CSS 撑开），固有尺寸就是 **0×0** —— 外面包它的 `<a>` 随之塌成零宽。
站点原本的 `rss.png` 有位图固有尺寸，所以换之前一切正常；一换成纯 viewBox 的 SVG 就塌了。
**对策**：生成 data URI 时**同时给出 `width` 和 `height`**：
`<svg viewBox="0 0 24 24" width="16" height="16" fill="...">`
viewBox 负责缩放路径，width/height 负责给出固有尺寸。主题再用自己的规则缩到 12 / 16px。
**判定口诀**：**换完图标后站内元素"点不到"/"零尺寸"，先查替换内容的固有尺寸，而不是查选择器。**
**附带纪律**：图标层**只写 `content`，不写死尺寸** —— 让各主题用更高特异性的选择器自己定宽高；
否则图标层会压掉主题的排版（例如纸带主题的 12px）。


