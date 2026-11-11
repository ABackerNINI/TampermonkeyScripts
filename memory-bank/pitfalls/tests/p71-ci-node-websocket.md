# CI 矩阵与 Node 内置能力: Node 20 没有全局 WebSocket
> 摘要: CI 矩阵与 Node 内置能力：Node 20 没有全局 WebSocket，`tests/lib/sim/cdp.js` 靠 Node 22 内置全局 WebSocket 零依赖，CI 的 Node 20 job 表现为 FAIL 而非 SKIP；加第二道门禁同样 SKIP 退 0。
> 触发: Node 20, 全局 WebSocket, CI 矩阵, SKIP 门禁, cdp.js

- **触发**: `tests/lib/sim/cdp.js` 靠 Node 22 内置的全局 `WebSocket` 做到零依赖，CI 矩阵含 Node 20，而 Node 20 没有全局 WebSocket ⇒ `new WebSocket` 直接 ReferenceError。
- **判别**: 原本 `tcase.runCase` 只有「找不到浏览器就 SKIP」一道门禁，ubuntu 镜像自带 Chrome，于是用例继续跑并崩溃 —— 表现为 FAIL 而不是 SKIP，CI 的 Node 20 job 长期红（且只红 Node 20、Node 22 绿，容易被误判成「某个用例不稳定」）。
- **处置**: 加第二道门禁，没有全局 WebSocket 时同样 `SKIP` 退 0（与浏览器门禁同一口径）；⚠️ 静态用例（`check-*`）不用 `runCase`，在 Node 20 上照跑 —— CI 覆盖不减。

## P71. CI 矩阵与 Node 内置能力: Node 20 没有全局 WebSocket

`tests/lib/sim/cdp.js` 靠 **Node 22 内置的全局 `WebSocket`** 做到零依赖。CI 矩阵含 Node 20,
而 Node 20 没有全局 WebSocket ⇒ `new WebSocket` 直接 ReferenceError。
原本 `tcase.runCase` 只有"找不到浏览器就 SKIP"一道门禁, ubuntu 镜像自带 Chrome,
于是用例继续跑并崩溃 —— 表现为 **FAIL 而不是 SKIP**, CI 的 Node 20 job 长期红
(且只红 Node 20、Node 22 绿, 容易被误判成"某个用例不稳定")。

修法: 加第二道门禁, 没有全局 WebSocket 时同样 `SKIP` 退 0(与浏览器门禁同一口径)。
⚠️ 静态用例(`check-*`)不用 `runCase`, 在 Node 20 上照跑 —— CI 覆盖不减。


