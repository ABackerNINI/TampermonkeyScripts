# 逻辑键 ≠ DOM class：列映射把 `time` 归到 `alive`，但图标选择器要写站点真实的 class
> 摘要: 逻辑键 ≠ DOM class：`detectColumns()` 把站点 `time` 归一化成逻辑键 `alive`，但 `ICON_MET` 生成 `img.alive` 命中不了真站 `<img class='time'>`，两者要分开写。
> 触发: 逻辑键, DOM class, 列映射, ICON_MET, 残留装饰扫描, 作用域前缀

- **触发**: 6 个指标图标里偏偏「存活」这一个还挂着站点雪碧图（`content:normal`），它的 5 个兄弟（comments / size / seeders / leechers / snatched）都换成了 SVG。
- **判别**: `detectColumns()` 里有一行把含 `time` 的 class 或含「存活」的 hint 归一化成逻辑键 `alive`（列映射要跨站点稳定，这是对的）；但 `ICON_MET` 生成的 CSS 是 `img.{键名}`，而真站列头的 DOM 是 `<img class='time'>`，只写 `img.alive` 这条规则一条都不命中。
- **处置**: `ICON_MET` 里 `alive` 与 `time` 都写（同一个 clock 图形、同一个色），代价是一行重复，收益是「逻辑键归逻辑键、DOM class 归 DOM class」不会再串台；可复用排查手法：真站整页跑「站点残留装饰」扫描，凡是 `background-image` 是 `url(http…)`（不是 `data:`）的 `<img>` 都是还没接管的族，本次一次性扫出 7 族 `sticky`(86) / `star` / `arrowup` / `arrowdown` / `inbox` / `sentbox` / `buddylist`（后经补扫又加 `time` / `rss` / `plus`），⚠️ 扫描白名单要留 `tr.sticky_top` 的 `box-shadow`（那是我们自己的置顶金边，不是站点残留）；另一条：这些族不在 `#torrenttable` 里（箭头与信箱在底栏 `td.bottom`），选择器加 `#torrenttable` 前缀就一条都不生效 —— 图标规则的作用域要按元素实际位置定，不能一律抄同一前缀。

## P54. 逻辑键 ≠ DOM class：列映射把 `time` 归到 `alive`，但图标选择器要写站点真实的 class

**症状**：6 个指标图标里偏偏「存活」这一个还挂着站点雪碧图（`content:normal`），
它的 5 个兄弟（comments / size / seeders / leechers / snatched）都换成了 SVG。

**根因**：`detectColumns()` 里有一行 `if (/\btime\b/.test(cls) || /存活/.test(hint)) return 'alive';`
—— 它把站点的 `time` **归一化成逻辑键 `alive`**，这是对的（列映射要跨站点稳定）。
但 `ICON_MET` 生成的 CSS 是 `img.{键名}`，而真站列头的 DOM 是 `<img class="time">`：
**只写 `img.alive`，这条规则一条都不命中**。

**修法**：`ICON_MET` 里 `alive` 与 `time` **都写**（同一个 clock 图形、同一个色）。
代价是一行重复，收益是"逻辑键归逻辑键、DOM class 归 DOM class"不会再串台。

**排查手法（可复用）**：真站整页跑「站点残留装饰」扫描 —— 凡是
`background-image` 是 `url(http…)`（不是 `data:`）的 `<img>`，都是还没接管的族。
本次一次性扫出 7 族：`sticky`(86) / `star` / `arrowup` / `arrowdown` / `inbox` / `sentbox` / `buddylist`
（后经补扫又加 `time` / `rss` / `plus`），全部是脚本**完全没碰**的站点图标。
⚠️ 扫描白名单要留 `tr.sticky_top` 的 `box-shadow`（那是我们自己的置顶金边，不是站点残留）。

**另一条**：这些族**不在 `#torrenttable` 里**（箭头与信箱在底栏 `td.bottom`），
选择器加 `#torrenttable` 前缀就一条都不生效 —— 图标规则的**作用域**要按元素实际位置定，不能一律抄同一前缀。


