# 进度指示器的英文替换：CSS 换不了文字，只能动叶子 text 节点
> 摘要: 进度指示器的英文替换：CSS 换不了 text 节点里的一个词，只能动叶子 text 节点；且单词不是 `firstChild`，做种/下载两种底色不同要按 `td[bgcolor] b` 选。
> 触发: 进度指示器, 英文替换, 叶子 text 节点, firstChild, td[bgcolor] b

- **触发**: .19 用户实拍「下载进度显示不全（将 Leeching 改为中文）」：`<td bgcolor='#CC0066'><font color='#fff'><b>0% <br> Leeching </b></font></td>` —— 「Leeching」在窄格里截断，且是英文。
- **判别**: CSS 只能换样式、换不了 text 节点里的一个词；若要纯 CSS 只能整段 `<b>` 隐藏再 `::before` 补，但那会把百分比一起吞掉（数据丢失），所以这是脚本里唯一一处直接改站内文本的逻辑（只动叶子 text 节点里的单词，不改 DOM 结构、不挂事件、不动样式属性，只在 theme-on 时调一次）；两个坑：① 单词不是 `firstChild`（结构是 `<b>{pct}% <br> {word} </b>`，`firstChild` 是 `{pct}% `，单词在第二个 text 节点，必须遍历所有子节点否则一个都换不掉，刚踩过）；② 进度指示器有两种、颜色也不同（做种 `td bgcolor='#44cef6'` / `font color='#FF0066'` 的 Seeding，下载 `td bgcolor='#CC0066'` / `font color='#fff'` 的 Leeching），只按 `font[color='#fff']` 选会漏掉做种那种。
- **处置**: 只动叶子 text 节点里的单词、遍历所有子节点（不认 firstChild）；按 `td[bgcolor] b` 选，两种都覆盖（真站实测 4 个单元：3 做种 + 1 下载，全部替换）。

## P60. 进度指示器的英文替换：CSS 换不了文字，只能动叶子 text 节点

**症状**（.19 用户实拍「下载进度显示不全（将 Leeching 改为中文）」）：
`<td bgcolor="#CC0066"><font color="#fff"><b>0% <br> Leeching </b></font></td>`
—— "Leeching" 在窄格里截断，且是英文。

**为什么不能纯 CSS**：CSS 只能换样式，**换不了 text 节点里的一个词**。
若要纯 CSS 只能整段 `<b>` 隐藏再 `::before` 补，但那会把百分比一起吞掉（数据丢失）。
所以这是脚本里**唯一一处直接改站内文本**的逻辑 —— 只动叶子 text 节点里的单词，
不改 DOM 结构、不挂事件、不动样式属性；只在 theme-on 时调一次。

**⚠️ 两个坑**：
1. **单词不是 `firstChild`**！结构是 `<b>{pct}% <br> {word} </b>`，`firstChild` 是 `"{pct}% "`，
   单词在**第二个** text 节点 —— 必须遍历所有子节点，否则一个都换不掉（刚踩过）。
2. **进度指示器有两种、颜色也不同**：
   - 做种：`<td bgcolor="#44cef6"><font color="#FF0066"><b>100% <br> Seeding </b></font></td>`
   - 下载：`<td bgcolor="#CC0066"><font color="#fff"><b>0%   <br> Leeching </b></font></td>`
   只按 `font[color="#fff"]` 选会漏掉做种那种 —— 按 **`td[bgcolor] b`** 选，两种都覆盖
   （真站实测 4 个单元：3 做种 + 1 下载，全部替换）。


