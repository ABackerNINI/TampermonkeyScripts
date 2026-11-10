# BTSchool 表格解析：行/列定位（已修复过两次，勿回退）
> 摘要: BTSchool 种子表行/列定位错位导致解析 0 行或字段整体错位，已修复过两次勿回退。
> 触发: 解析种子表, 改表格选择器, 排查行列错位, 排障

- **触发**: 用 `tr.rowfollow` 选行、或裸 `querySelectorAll('td')` 深度搜索取单元格。
- **判别**: BTSchool 种子表中 `<tr>` **没有** `rowfollow` 类，类在 `<td>` 上 → `tr.rowfollow` 选不中任何行；标题列内部嵌套 `<table class="torrentname">`（3 个内层 `<td>`）→ 裸 `querySelectorAll('td')` 深度搜索返回 14 个而非 11 个单元格，索引整体偏移。
- **处置**: `table.querySelectorAll('tbody > tr:has(> td.rowfollow)')` 取行、`row.querySelectorAll(':scope > td')` 只取直接子单元格；`:has()` / `:scope` 为现代浏览器特性（Chrome 105+ / Safari 15.4+），若支持老旧浏览器需退回「遍历 `tbody > tr` + 首子元素含 `rowfollow` 判断」。

## P1. BTSchool 表格解析：行/列定位（已修复过两次，勿回退）

**症状**：`parseTorrentTable` 返回 0 行，或字段值整体错位（评论数/大小/种子数取错）。
**原因**：
- BTSchool 种子表中 `<tr>` **没有** `rowfollow` 类，类在 `<td>` 上 → `tr.rowfollow` 选不中任何行；
- 标题列内部嵌套 `<table class="torrentname">`（3 个内层 `<td>`）→ 裸 `querySelectorAll('td')` 深度搜索返回 14 个而非 11 个单元格，索引整体偏移。
**正确做法**：
```js
const rows = table.querySelectorAll('tbody > tr:has(> td.rowfollow)');
const cells = row.querySelectorAll(':scope > td');   // 只取直接子单元格
```
**注意**：`:has()` / `:scope` 为现代浏览器特性（Chrome 105+ / Safari 15.4+）；若支持老旧浏览器需退回「遍历 `tbody > tr` + 首子元素含 `rowfollow` 判断」。

