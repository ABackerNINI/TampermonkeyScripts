# tests — 测试基建与断言判据

> **本文件是生成物, 不要手改** —— 由 `commands run kb.index` 扫描本目录主题文件的三行头元数据生成; 新增 / 改名 / 改摘要后重跑即可, 冲突也只需重跑。
> 库内细路由见 [memory-bank/README.md](../../README.md)。
> **检索纪律**: 先读本索引定位, 再按需打开单个主题文件 —— **不要整读本目录**。
> **摘要**: 测试基建与判据 —— 仿真站/原型派生、断言可证伪性、hit-test 可见性、完成信号轮询代替固定 sleep、CI 度量；写测试或排查假绿/误红前先读。
> **触发**: 写测试, 排查假绿误红, 改断言, 改仿真站, 提交前, 跑 CI 前

## 主题

| 主题 | 一句话 | 触发词 |
|---|---|---|
| [p14-test-discipline.md](p14-test-discipline.md) | 禁止给测试留生产通道、禁止为过测试弱化断言或改生产代码。 | 写测试, 测试失败排障, 改生产代码, 加测试钩子 |
| [p41-ispointinfill-ascii-map.md](p41-ispointinfill-ascii-map.md) | 图片读取不可用时，用 `isPointInFill()` + 栅格扫描 + ASCII 地图程序化校验图标轮廓，比肉眼更可靠。 | 图标校验, 看不了图片, isPointInFill, ASCII 地图, 栅格扫描 |
| [p48-prototype-vs-realsite.md](p48-prototype-vs-realsite.md) | 「原型」≠「真站」—— 照着理想化设计稿写选择器，真站上会大面积打空；原型只定「目标观感」，不用来定「页面长什么样」。 | 原型 vs 真站, 选择器打空, ground truth, 类名差集, 特异性碰撞 |
| [p49-sim-from-prototype.md](p49-sim-from-prototype.md) | 仿真剧本从「原型」派生 ⇒ 全绿但真站画错；「仿真全绿」只证明没有回归，不证明真站画得对。 | 仿真剧本, 原型派生, 全绿, 真站子集, 静态资源拦截 |
| [p70-local-green-ci-metrics.md](p70-local-green-ci-metrics.md) | 本地绿 ≠ 判据稳 —— Windows 与 CI(Linux)的字体度量/可滚动高度不同；自己注入的 `position:fixed` 居中弹窗会盖住被 `scrollIntoView` 量到视口正中的元素。 | 本地绿 CI 红, 字体度量, 可滚动高度, scrollIntoView, fixed 浮层 |
| [p71-ci-node-websocket.md](p71-ci-node-websocket.md) | CI 矩阵与 Node 内置能力：Node 20 没有全局 WebSocket，`tests/lib/sim/cdp.js` 靠 Node 22 内置全局 WebSocket 零依赖，CI 的 Node 20 job 表现为 FAIL 而非 SKIP；加第二道门禁同样 SKIP… | Node 20, 全局 WebSocket, CI 矩阵, SKIP 门禁, cdp.js |
| [p72-unfalsifiable-assertion.md](p72-unfalsifiable-assertion.md) | 不可证伪的断言比没有断言更危险 —— 反例要跑「删掉被测代码」才算数；删掉伪协议过滤后 S04 依然全绿（后面还有同站约束），红灯会骗人、一直不红也会骗人。 | 不可证伪断言, 反例删被测代码, 纵深防御, 固定 sleep 假绿, 完成信号轮询 |
| [p73-fixed-sleep-polling.md](p73-fixed-sleep-polling.md) | 顺带修掉的：S03/S04 用固定 sleep 代替轮询；慢机器上脚本还没执行到 `collectFavicon()` ⇒ S04 负向断言假绿、S03 正向断言误红，改成 `page.waitFor` 等完成信号再读。 | 固定 sleep, 轮询完成信号, page.waitFor, ptac-root-v2, 假绿误红 |
| [p74-hittest-covered-ancestor.md](p74-hittest-covered-ancestor.md) | hit-test 判据的坑：「命中祖先」必须算被盖住；`__hit` 里 `el.contains(e)`（放过祖先）会废掉整个可见性断言（BODY 包含一切），只有自身/后代算通过。 | hit-test, 命中祖先, covered, 毯式变异, 夹具属性 |
