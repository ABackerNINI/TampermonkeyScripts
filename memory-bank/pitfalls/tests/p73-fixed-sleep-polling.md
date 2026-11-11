# 顺带修掉的: S03/S04 用固定 sleep 代替轮询
> 摘要: 顺带修掉的：S03/S04 用固定 sleep 代替轮询；慢机器上脚本还没执行到 `collectFavicon()` ⇒ S04 负向断言假绿、S03 正向断言误红，改成 `page.waitFor` 等完成信号再读。
> 触发: 固定 sleep, 轮询完成信号, page.waitFor, ptac-root-v2, 假绿误红

- **触发**: `sim-security-s03/04` 原来是 `sim.open(url, { waitMs: 5000 })` + `sleep(2000)` 再读 GM 存储。
- **判别**: 慢机器上脚本还没执行到 `collectFavicon()` ⇒ S04 的负向断言假绿、S03 的正向断言误红。
- **处置**: 改成 `page.waitFor` 等 `#ptac-root-v2` 挂载这个完成信号（`return !!document.getElementById(...)`）再读。

## P73. 顺带修掉的: S03/S04 用固定 sleep 代替轮询

`sim-security-s03/04` 原来是 `sim.open(url, { waitMs: 5000 })` + `sleep(2000)` 再读 GM 存储。
慢机器上脚本还没执行到 `collectFavicon()` ⇒ S04 的负向断言**假绿**、S03 的正向断言**误红**。
改成 `page.waitFor("return !!document.getElementById('ptac-root-v2')")` 再读。


