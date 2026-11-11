# 「清 border 不清 background」= 白页签：站点 `ul.menu li a` 自带 1px 白边 + `#dedede` 底
> 摘要: 「清 border 不清 background」= 白页签：站点 `ul.menu li a` 自带 1px 白边 + `#dedede` 底，只写 `border:0` 漏了 background，深色片基上极刺眼。
> 触发: 白页签, 清样式成对, background transparent, 漏白扫描 alpha, 大小两档

- **触发**: 上妆后顶部导航（首页 / 论坛 / 种子 …）是一排浅灰白页签，深色片基上极刺眼，用户原话「首页/论坛等标签仍是白色」。
- **判别**: 脚本里早有注释写明「站点给 `ul.menu li a` 画了 1px 白边 + `#dedede` 底」，但只写了 `border:0`、漏了 background；而原型 `film.html` 里导航项默认无底色（只有 `:hover` 的 `rgba(255,255,255,.055)`），所以从原型派生的仿真页也没有这条底，仿真永远测不出来 —— 又一次 P49 形状的盲区。
- **处置**: `html[data-hdui-theme] ul#mainmenu li a{…;border:0;background:transparent;…}` —— `background:transparent` 必须显式写（不能指望继承，站点的 `#dedede` 是实实在在的一条声明），特异性够（本规则 (1,1,4) > 站点 `ul.menu li a` 的 (0,1,3)），不需要 `!important`；两条延展教训：①「清样式」要成对清，看到 `border:0` 就问一句同一条站点规则里还有没有别的视觉属性没清（background / box-shadow / outline / background-image），漏一个就是一块原站色漏出来；② 漏白扫描必须补 alpha，按 rgb 三个分量算亮度会把 `rgba(255,255,255,0.043)` 这种刻意的 4% 白底 chip 全报成漏白（一次性 400 条误报），必须 `alpha < 0.5 则跳过`，同时大面积阈值 `area > 20000` 会漏掉页签/按钮只有几十 px² 的小件，扫描要分大小两档跑（本次 15 个白页签全靠真站验收脚本加的「小件近白」抓出来）。

## P53. 「清 border 不清 background」= 白页签：站点 `ul.menu li a` 自带 1px 白边 + `#dedede` 底

**症状**：上妆后顶部导航（首页 / 论坛 / 种子 …）是一排浅灰白页签，深色片基上极刺眼。
用户原话「首页/论坛等标签仍是白色」。

**根因**：脚本里早有注释写明「站点给 `ul.menu li a` 画了 1px 白边 + `#dedede` 底」，
但只写了 `border:0`，**漏了 background**。而原型 `film.html` 里导航项**默认无底色**
（只有 `:hover` 的 `rgba(255,255,255,.055)`）—— 所以从原型派生的仿真页也**没有这条底**，
仿真永远测不出来。又一次 P49 形状的盲区。

**修法**：
```css
html[data-hdui-theme] ul#mainmenu li a{…;border:0;background:transparent;…}
```
`background:transparent` 必须**显式写**（不能指望继承：站点的 `#dedede` 是实实在在的一条声明）。
特异性够（本规则 (1,1,4) > 站点 `ul.menu li a` 的 (0,1,3)），不需要 `!important`。

**两条延展教训**：
1. **「清样式」要成对清**。看到 `border:0` 就问一句"同一条站点规则里还有没有别的视觉属性没清"
   （background / box-shadow / outline / background-image），漏一个就是一块原站色漏出来。
2. **漏白扫描必须补 alpha**。按 `rgb` 三个分量算亮度会把 `rgba(255,255,255,0.043)` 这种
   **刻意的 4% 白底 chip** 全报成漏白（一次性 400 条误报），必须 `alpha < 0.5 则跳过`。
   同时**大面积阈值会漏掉小件**：页签/按钮只有几十 px²，
   `area > 20000` 的过滤条件会让它们全部隐身 —— 所以扫描要**分大小两档**跑。
   真站验收脚本里的「小件近白」就是为这个加的，本次 15 个白页签全靠它抓出来。


