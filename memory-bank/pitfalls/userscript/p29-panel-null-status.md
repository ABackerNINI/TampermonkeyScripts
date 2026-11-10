# 面板渲染的空值地雷: 一行 `st.status` 未守卫 → 首次安装/新接入站点时脚本 100% 不工作
> 摘要: `buildRowHtml()` 无条件读 `st.status`，首次安装/新接入站点时整条主流程不执行。
> 触发: 首次安装, 新接入站点, 排查脚本不工作, 改面板渲染

- **触发**: 全新安装(所有 unit 都无记录)、或新接入一个站点(该 unit 无记录)。
- **判别**: `buildRowHtml()` 里 `const retryTitle = st.status === 'unconfirmed' ? … : …` **无条件读取** `st.status`, 而 `st = readStatus(unit.id)` 在该站**从未有过状态记录**时是 `null`(GM 存储里根本没有 `ptac_status_<uid>` 这个键); 同函数里其它读取都有 `todayHit &&` 守卫, 只有这一处漏了 → `render() → UI.init() → main()` 一路冒泡, `boot()` 的 catch 把它吞掉, **整条主流程(含签到)全部不执行**；老用户天天用反而不会遇到(每个 unit 都有昨日记录, `todayHit` 为 false 但 `st` 非 null), 所以能长期潜伏。
- **处置**: 改成 `todayHit && st.status === 'unconfirmed'`(与同函数的 `retryable` 一致)。教训: `main()` 里 `UI.init()` 在**业务流程之前**执行 —— 渲染层的任何异常都会连带掐掉签到；面板渲染应视为"纯展示", 对 `readStatus/readAlert` 的返回值一律按可空处理; 新增行内字段时先问「这个 unit 从没写过状态时它是什么」。

## P29. 面板渲染的空值地雷: 一行 `st.status` 未守卫 → 首次安装/新接入站点时脚本 100% 不工作

**发现方式**: 2026-09-18 用本地仿真站(`tests/lib/sim/`, 见 P30)跑 `S00 环境自检冒烟` 时,
页面 console 直接报 `[PTAutoCheckIn] 主流程异常: TypeError: Cannot read properties of null`。

**症状 → 原因 → 对策**

- 症状: 装好脚本后访问任何匹配站点, 没有任何签到动作、FAB 不显示、console 一行
  `主流程异常: TypeError: Cannot read properties of null (reading 'status')`。
- 原因: `buildRowHtml()` 里 `const retryTitle = st.status === 'unconfirmed' ? … : …`
  **无条件读取** `st.status`, 而 `st = readStatus(unit.id)` 在该站**从未有过状态记录**时是 `null`
  (GM 存储里根本没有 `ptac_status_<uid>` 这个键)。同函数里其它读取都有 `todayHit &&` 守卫,
  只有这一处漏了 —— 于是 `render() → UI.init() → main()` 一路冒泡, `boot()` 的 catch 把它吞掉,
  **整条主流程(含签到)全部不执行**。
- 触发条件: 全新安装(所有 unit 都无记录)、或新接入一个站点(该 unit 无记录)。
  老用户天天用反而不会遇到(每个 unit 都有昨日记录, `todayHit` 为 false 但 `st` 非 null),
  所以它能长期潜伏。
- 对策: 改成 `todayHit && st.status === 'unconfirmed'`(与同函数的 `retryable` 一致)。
- **教训**: `main()` 里 `UI.init()` 在**业务流程之前**执行 —— 渲染层的任何异常都会连带掐掉签到。
  面板渲染应视为"纯展示", 对 `readStatus/readAlert` 的返回值一律按可空处理;
  新增行内字段时先问「这个 unit 从没写过状态时它是什么」。

