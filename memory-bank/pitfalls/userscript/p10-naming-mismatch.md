# 命名不一致（现存待修，见 tasks）
> 摘要: `getBottomTorrentId()` 与 `getBottomTorrentID()` 大小写不一致，启用 N 键功能前须改名对齐。
> 触发: 启用 N 键功能, 排查 ReferenceError, 统一命名

- **触发**: `scrollToNext2xFreeTorrent` 内调用 `getBottomTorrentId()`（小写 d）与 `arrayFindIndex`。
- **判别**: 实际定义是 `getBottomTorrentID()`（大写 D）与 `arrayFind`；**当前未启用所以不报错**。
- **处置**: 启用 N 键功能前必须先改名对齐，否则直接 ReferenceError。

## P10. 命名不一致（现存待修，见 tasks）

`scrollToNext2xFreeTorrent` 内调用 `getBottomTorrentId()`（小写 d）与 `arrayFindIndex`，而实际定义是 `getBottomTorrentID()`（大写 D）与 `arrayFind`。**当前未启用所以不报错**；启用 N 键功能前必须先改名对齐，否则直接 ReferenceError。

