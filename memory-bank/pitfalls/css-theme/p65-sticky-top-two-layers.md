# 「同一条 tr.sticky_top」要分两层 — 内层(标题格嵌套表)会漏底
> 摘要: 「同一条 tr.sticky_top」要分两层 —— 内层（标题格嵌套表）会漏底；真站 86 个里 43 个是内层 tr，直接子代选择器只命中外层。
> 触发: sticky_top, 内层外层两层, 直接子代选择器, 漏底白底, 元素数核对

- **触发**: .25 用户实拍「第二段置顶种子背景为白色」：真站 100 行里 86 行是 `tr.sticky_top`，但其中 43 行是嵌套在 `<table class='torrentname'>` 里的内层 tr（标题格里那条），还有 43 行是外层 `tr`（种子行本体）；`R + '.sticky_top{box-shadow:...}'` 用 `R = #torrenttable > tbody > tr:not(.colhead)` 直接子代选择器，只命中外层那 43 行 —— 内层那 43 行完全没有背景规则，露出站点默认白底。
- **判别**: 真站探测证实：86 个 `tr.sticky_top` 父级全在 `<tbody>` 下（没有更深的嵌套），但 86 个里有 43 个 `background: rgb(32,28,24)`（深色 themed）、43 个 `rgba(0,0,0,0)`（透明），比例正好 1:1 —— 内外两层各一半。
- **处置**: 加一条 `TN + '.sticky_top{background:var(--hdui-card);}'`（`TN = #torrenttable table.torrentname > tbody > tr`），只给内层加背景不加金边（避免内外双金边），修后 86 个全部 `rgb(32,28,24)`；教训：① 嵌套表/嵌套行很常见，任何「同 class」规则都不能只看外层，有两种防御（用更宽的选择器 `#torrenttable tr.sticky_top` 不限子代，或给每个实际可能存在的层级都写一条 —— 后者更稳但啰嗦、前者容易误伤）；② 检测「漏规则」时按元素数 vs 父级分布，发现「同 DOM 选择器匹配数 ≠ 应该有的元素数」就追（这条 86 个 tr.sticky_top 但只有 43 个 themed ⇒ 立刻知道还有 43 个没拿到规则）。

## P65. 「同一条 tr.sticky_top」要分两层 — 内层(标题格嵌套表)会漏底

**症状**(.25 用户实拍"第二段置顶种子背景为白色"):
真站 100 行里 86 行是 `tr.sticky_top`, 但其中 **43 行是嵌套在 `<table class="torrentname">` 里的内层 tr**(标题格里那条),
还有 43 行是**外层** `tr`(种子行本体)。我的 `R + '.sticky_top{box-shadow:...}'`
用 `R = #torrenttable > tbody > tr:not(.colhead)`, **直接子代选择器**,
只命中外层那 43 行 —— 内层那 43 行**完全没有背景规则**, 露出站点默认**白底**。

**真站探测证实**: 86 个 tr.sticky_top, 父级全在 `<tbody>` 下(没有更深的嵌套),
但 86 个里有 43 个 `background: rgb(32,28,24)`(深色, themed)、43 个 `rgba(0,0,0,0)`(透明)。
比例正好 1:1 —— 内外两层各一半。

**修法**: 加一条 `TN + '.sticky_top{background:var(--hdui-card);}'`
(`TN = #torrenttable table.torrentname > tbody > tr`), **只**给内层加背景不加金边
(避免内外双金边)。修后: 86 个全部 `rgb(32,28,24)`。

**教训**:
1. **嵌套表/嵌套行很常见** —— 任何「同 class」规则都不能只看外层。
   有两种防御: ① 用更宽的选择器(`#torrenttable tr.sticky_top`, 不限子代),
   ② 给每个**实际可能存在的层级**都写一条。② 更稳但啰嗦, ① 容易误伤。
2. **检测"漏规则"**: 探测时**按元素数 vs 父级分布**, 发现「同 DOM 选择器匹配数 ≠ 应该有的元素数」就追。
   这条: 86 个 tr.sticky_top 但只有 43 个 themed ⇒ 立刻知道"还有 43 个没拿到规则"。


