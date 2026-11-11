# hit-test 判据的坑: "命中祖先"必须算**被盖住**
> 摘要: hit-test 判据的坑：「命中祖先」必须算被盖住；`__hit` 里 `el.contains(e)`（放过祖先）会废掉整个可见性断言（BODY 包含一切），只有自身/后代算通过。
> 触发: hit-test, 命中祖先, covered, 毯式变异, 夹具属性

- **触发**: 把 P72 的纪律回过头用到自己新写的用例上 —— 加一条「毯式变异」（`html[data-hdui-theme] body::after{...position:fixed;inset:0;z-index:2147483000;}`，即「上妆后整页被遮住」），看那些「仍然可见 / 仍然点得到」的断言会不会红；结果 `sim-hdui-overlay-safety` 红了，但 `sim-hdui-unknown-canary` 全绿。
- **判别**: `hdui-scan.js` 的 `__hit` 当初写成 `const ok = (el === e) || e.contains(el) || el.contains(e);`（第三个是错的），本意是「中心点可能落在子元素上，所以允许双向 contains」，但祖先那一向是灾难：`BODY` 包含一切，于是任何祖先级遮罩都会被判成「命中自身」⇒ 这类断言永远不可能变红 —— 主题把整页盖住也测不出来；第二条同源问题（夹具侧）：`sim-hdui-unknown-tags` 断言「未知标签保留站点分类底色」，对比的是上妆前后 `background-color`，而夹具里的 `span.tags` 压根没有底色，于是变成 `transparent === transparent` 的空断言。
- **处置**: 只有 `el === e` 或 `e.contains(el)`（自身 / 后代）算通过，祖先命中一律算 `covered`；⚠️ 配套补丁：多行 inline 元素的 bounding box 中心可能落在行盒之间的空隙里而命中父级块，所以补测一次 `getClientRects()[0]` 的中心再判定，避免把行内元素误判成被盖住；夹具给 canary 标签补上站点分类色（`style='background:#5b9fd4'`）之后，变异 `background:transparent !important` 才能把它打红；教训：① hit-test 的「放过祖先」等于废掉整个断言 —— 判据里凡是「宽容」的部分都要单独问一句「这样写之后，有没有一种真实的故障是我永远测不出来的?」；② 夹具必须带上真站才有的属性（分类色、bgcolor、内联样式 …），否则「保留原样」这类对比型断言会退化成「两边都为空」的空比较；③ 毯式变异很好用（一条「整页遮罩」就能一次性验证所有可见性断言是否还活着，比逐条想反例快得多），建议每次新增可见性断言后跑一次。

## P74. hit-test 判据的坑: "命中祖先"必须算**被盖住**

**怎么发现的**: 把 P72 的纪律回过头用到自己新写的用例上 —— 加一条"毯式变异"
(`html[data-hdui-theme] body::after{...position:fixed;inset:0;z-index:2147483000;}`,
即"上妆后整页被遮住"), 看那些"仍然可见 / 仍然点得到"的断言会不会红。
结果: `sim-hdui-overlay-safety` 红了, 但 `sim-hdui-unknown-canary` **全绿**。

**根因**: `hdui-scan.js` 的 `__hit` 当初写成
```js
const ok = (el === e) || e.contains(el) || el.contains(e);   // ← 第三个是错的
```
本意是"中心点可能落在子元素上, 所以允许双向 contains", 但**祖先那一向是灾难**:
`BODY` 包含一切, 于是任何**祖先级遮罩**都会被判成"命中自身" ⇒
**这类断言永远不可能变红** —— 主题把整页盖住也测不出来。

**修法**: 只有 `el === e` 或 `e.contains(el)`(自身 / 后代)算通过, 祖先命中一律算 `covered`。
⚠️ 配套补丁: 多行 inline 元素的 bounding box 中心可能落在**行盒之间的空隙**里而命中父级块,
所以补测一次 `getClientRects()[0]` 的中心再判定, 避免把行内元素误判成被盖住。

**第二条同源问题(夹具侧)**: `sim-hdui-unknown-tags` 断言"未知标签保留站点分类底色",
对比的是上妆前后 `background-color` —— 而**夹具里的 `span.tags` 压根没有底色**,
于是变成 `transparent === transparent` 的空断言。给夹具的 canary 标签补上站点分类色
(`style="background:#5b9fd4"`) 之后, 变异 `background:transparent !important` 才能把它打红。

**教训**:
1. **hit-test 的"放过祖先"等于废掉整个断言** —— 判据里凡是"宽容"的部分都要单独问一句:
   "这样写之后, 有没有一种真实的故障是我永远测不出来的?"
2. **夹具必须带上真站才有的属性**(分类色、bgcolor、内联样式 …),
   否则"保留原样"这类对比型断言会退化成"两边都为空"的空比较。
3. **毯式变异很好用**: 一条"整页遮罩"就能一次性验证所有可见性断言是否还活着,
   比逐条想反例快得多, 建议每次新增可见性断言后跑一次。


