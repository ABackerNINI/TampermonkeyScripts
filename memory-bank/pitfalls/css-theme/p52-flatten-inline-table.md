# 摊平内嵌表（`<tr>` 改 flex + 去掉 `<br>`）会把竖排的动作按钮挤成一条 inline 流
> 摘要: 摊平内嵌表（`<tr>` 改 flex + 隐藏 `<br>`）会丢掉竖排结构，四个动作链接挤成一条 inline 流；竖排要显式用 `flex-direction:column` 重建。
> 触发: 摊平内嵌表, flex-direction column, br, 动作按钮, chip 矩形验收

- **触发**: 标题格里「豆瓣 / IMDb / 下载 / 收藏」四个链接糊成一坨，彼此几乎贴在一起。
- **判别**: 真站第二格是 `<table><tr>[td(豆瓣<br>IMDb), td(下载<br>收藏)]</tr></table>`，靠 `<br>` 竖排；脚本为了「省一整行高度」把 `<tr>` 摊平成 `display:flex` 并隐藏所有 `<br>`，竖排结构没了，四组内容全被塞进同一条 flex/inline 流，只剩 6px 的 gap。
- **处置**: 竖排要显式用 `flex-direction:column` 重建（`tr{display:flex;align-items:flex-start;gap:10px;}`、`td{display:flex;flex-direction:column;align-items:flex-start;gap:3px;}`、`br{display:none;}` 竖排由 flex 负责、`<br>` 留着只会多撑出行距、`a{display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:6px;…}`）；每个动作再各自成一个 chip（圆角微底 + hover 转金），彼此就有明确的边界不会粘连；验收要量矩形：同列的两个 chip 左边缘对齐且上下排列、两列左右分开、四个两两不重叠。

## P52. 摊平内嵌表（`<tr>` 改 flex + 去掉 `<br>`）会把竖排的动作按钮挤成一条 inline 流

**症状**：标题格里「豆瓣 / IMDb / 下载 / 收藏」四个链接糊成一坨，彼此几乎贴在一起。

**原因**：真站第二格是 `<table><tr>[td(豆瓣<br>IMDb), td(下载<br>收藏)]</tr></table>`
—— 靠 `<br>` 竖排。脚本为了"省一整行高度"把 `<tr>` 摊平成 `display:flex` 并隐藏所有 `<br>`，
竖排结构没了，四组内容全被塞进同一条 flex/inline 流，只剩 6px 的 gap。

**正确做法**：竖排要**显式用 `flex-direction:column` 重建**，而不是靠隐藏 `<br>` 顺带摊平：

```css
/* 两列各自竖排: 评分列(豆瓣/IMDb) | 操作列(下载/收藏) */
tr{display:flex;align-items:flex-start;gap:10px;}
td{display:flex;flex-direction:column;align-items:flex-start;gap:3px;}
br{display:none;}          /* 竖排由 flex 负责, <br> 留着只会多撑出行距 */
a{display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:6px;…}
```

每个动作再各自成一个 chip（圆角微底 + hover 转金），彼此就有明确的边界，不会粘连。
**验收要量矩形**：同列的两个 chip 左边缘对齐且上下排列，两列左右分开，四个两两不重叠。


