# 非种子页的「大面积白底」来自站点通配 `table{}` 底色，不是 `body`
> 摘要: 非种子页的「大面积白底」来自站点通配 `table{background-color:#bccad6}` 命中每一张表，不是 `body`；只覆盖三处种子表的选择器会漏掉其余表格。
> 触发: 大面积白底, 通配 table, 非种子页, html 底色, bgcolor 属性

- **触发**: 主题明明生效了（`data-hdui-theme=film`、种子表也画对了），但打开「我的」/ 论坛 / 详情页这类没有种子表的页面，整屏仍是浅色。
- **判别**: `table{background-color:#bccad6}` 是 (0,0,1) 通配，命中页面里每一张表；脚本原先只覆盖了 `table.mainouter` / `table.main` / `#torrenttable` 三处，种子表之外的表格（我的 / 论坛 / 搜索框）全在漏这块浅蓝灰；`body` 其实早就被盖住了，所以查 body 是查不出问题的。
- **处置**: 配一条通配 table 的覆盖并确认它不会伤到片基 —— `#torrenttable table{background:transparent}`(1,1,2) 特异性更高，种子表内的内嵌表不受影响；同理 `td.rowfollow`(#f4f4f9) / `td.colhead` 也要一并压深；站点用 `bgcolor` 属性画的亮色块（顶部通知条那种大黄条）得用 `[bgcolor]` 属性选择器 + `!important` 才盖得住；另外 `<html>` 也要铺底色（只给 body 上色时，短页面在 body 之下仍会露出 `<html>` 的白）。

## P51. 非种子页的「大面积白底」来自站点通配 `table{}` 底色，不是 `body`

**症状**：主题明明生效了（`data-hdui-theme=film`、种子表也画对了），但打开「我的」/ 论坛 /
详情页这类**没有种子表**的页面，整屏仍是浅色。

**原因**：`table{background-color:#bccad6}` 是 **(0,0,1) 通配**，命中页面里**每一张**表。
脚本原先只覆盖了 `table.mainouter` / `table.main` / `#torrenttable` 三处 ——
种子表之外的表格（我的 / 论坛 / 搜索框）全在漏这块浅蓝灰。
`body` 其实早就被盖住了，所以查 body 是查不出问题的。

**正确做法**：配一条**通配 table** 的覆盖，并且确认它不会伤到片基 ——
`#torrenttable table{background:transparent}`(1,1,2) 特异性更高，种子表内的内嵌表不受影响。
同理 `td.rowfollow`(#f4f4f9) / `td.colhead` 也要一并压深；站点用 `bgcolor` 属性画的亮色块
（顶部通知条那种大黄条）得用 `[bgcolor]` 属性选择器 + `!important` 才盖得住。
另外 `<html>` 也要铺底色：只给 body 上色时，短页面在 body 之下仍会露出 `<html>` 的白。


