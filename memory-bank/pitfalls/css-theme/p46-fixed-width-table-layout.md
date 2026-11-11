# 站点外层是固定宽 + `table-layout:auto` 时，主题的两个隐形陷阱（撑宽 / 窄屏点不到）
> 摘要: 站点外层固定宽 + `table-layout:auto` 时，主题有「撑宽整页」与「窄屏 flex 导航点不到」两个同源隐形陷阱。
> 触发: 固定宽布局, table-layout auto, max-content 撑宽, flex 导航, 窄屏可点性

- **触发**: 两个坑同源：HDHome 站点外层是固定宽布局（文档宽 ≈1260，不随视口变）且用 `table-layout:auto`，会被内容的 `max-content` 撑开；上妆后 `document.documentElement.scrollWidth` 从 1260 → 1503，窄屏要多横向滚 240px；视口 1024 时最后 2–3 个导航入口 `elementFromPoint` 返回 null。
- **判别**: 陷阱一：标题列 `flex:1 1 0` + 内容 `white-space:nowrap`，`min-width:0` 只管收缩（min-content）、管不住 max-content，auto 表格布局按 max-content 撑容器；陷阱二：把 `ul#mainmenu` 改成 `display:flex`（防 16 个 inline 挤一坨），但站点固定宽让导航条拿到 1248px，`flex-wrap:wrap` 不会触发，单行排到 1218 屏外 —— 原站 inline 布局会自然换行，换成 flex 后必须显式给上限才会 wrap。
- **处置**: 陷阱一给弹性列显式 `max-width: max(240px, calc(100vw - 900px))`（改列宽时同步调那个常数并写进注释），实测 1503 → 1260 与原站持平、窄屏自适应收缩；陷阱二 `ul#mainmenu{max-width:100vw;box-sizing:border-box;}`，宽屏无影响、窄屏收到视口宽并换行，实测 1024/900 下都是 0/16 点不到；判定口诀：上妆后量一次 `scrollWidth` 与原站对比，改了导航 display 就要在窄屏重测可点性；通用教训：`min-width:0` 只解决「能不能收缩」，不解决「会不会撑开」（前者靠 min-width，后者靠 max-width）；`sim-hdui-layout-width.js`（第 26 个）用 `Emulation.setDeviceMetricsOverride` 逐项钉死。

## P46. 站点外层是固定宽 + `table-layout:auto` 时，主题的两个隐形陷阱（撑宽 / 窄屏点不到）

两个坑**同源**：HDHome 站点外层是固定宽布局（文档宽 ≈1260，不随视口变），
外层用 `table-layout:auto` —— **会被内容的 `max-content` 撑开**，且不随视口收缩。

**陷阱一：上妆把整页撑宽。**
**症状**：上妆后 `document.documentElement.scrollWidth` 从 **1260 → 1503**，
窄屏用户要多横向滚 240px。
**为什么**：标题列是 `flex:1 1 0` + 内容 `white-space:nowrap`。
`min-width:0` 只管**收缩**（min-content），**管不住 max-content** ——
auto 表格布局按 max-content 撑容器，长标题于是把整页顶宽。
**对策**：给弹性列显式 `max-width`，且用 vw 自适应：
```css
max-width: max(240px, calc(100vw - 900px));  /* 900 = 固定列宽和+间距+留白的约数 */
```
改列宽时那个常数要同步调（写进注释）。改完实测：1503 → **1260**（与原站持平），
窄屏还会自适应收缩。
**判定口诀**：**上妆后量一次 `document.documentElement.scrollWidth`，与原站对比 ——
比原站宽就是主题把页面撑了。**

**陷阱二：flex 导航在窄屏单行排到屏幕外。**
**症状**：视口 1024 时最后 2–3 个导航入口 `elementFromPoint` 返回 null（中心点 x 超出视口）。
**为什么**：脚本把 `ul#mainmenu` 改成 `display:flex`（防 16 个 inline 挤一坨），
但站点固定宽让导航条拿到 1248px，`flex-wrap:wrap` **不会触发**（容器够宽），于是单行排到 1218。
**原站是 inline 布局会自然换行，换成 flex 后必须显式给上限才会 wrap。**
**对策**：`ul#mainmenu{max-width:100vw;box-sizing:border-box;}` —— 宽屏（1248<1262）无影响，
窄屏收到视口宽并换行，实测 1024/900 下都是 **0/16 点不到**。
**判定口诀**：**改了导航的 display，就要在窄屏下重测一次可点性 —— 宽屏通过不代表窄屏通过。**

**通用教训**：`min-width:0` 只解决"能不能收缩"，不解决"会不会撑开"；前者靠 min-width，后者靠 max-width。
**测试**：`sim-hdui-layout-width.js`（第 26 个）用 `Emulation.setDeviceMetricsOverride`
改视口，逐项钉死：文档宽度 ≤ 原站、窄屏导航 0 被挡、滚动后片头吸顶。
诊断脚本 `.workbuddy-ai/_diag-docwidth.js`（上妆/不上妆 × 三种视口对照）定位这两个问题最快。


