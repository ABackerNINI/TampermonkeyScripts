# HDHomeUI 架构定案与全面重构（.1–.3）
> 摘要: 入口内嵌与版式全面重画、安全复验四项改进、纯样式层与运行时列映射架构、closed shadow 与契约校验
> 触发: 查架构定案, 契约与版式排障
> 最后活动: 2026-09-19 00:00

**2026-09-19 全面重构（`.2` → `.3`，已提交 `bc2c0cd`）**：用户报两件事 ——
① 右下角浮动圆钮与 PTAutoCheckIn v2 等脚本的 FAB 抢同一个位置；② 5 套主题风格与原 UI 太接近，
12 个格子挤同一行 + 新 UI 按钮都堆到一起，与设计初衷背道而驰。
三件事：① **入口内嵌** —— 量 `ul#mainmenu` 最后一个 li 的右边空档，摆成导航栏末尾小文字钮
`界面 · <主题名> ▾`；面板改为锚在它下方的下拉浮层；`position:absolute` 文档坐标内嵌
（随页面滚动），量不到菜单才退到 `table.mainouter` 右上，再退 `position:fixed` 兜底；
**重摆只在改 left/top/position，不整体重写 cssText**（整体重写会清掉宿主上的 `--ui-*` 配色变量）。
**已提交 `bc2c0cd`**（分支 `dev`，**未 push**）。
② **版式全面重画**，每套独立骨架：片库索引 grid 卡片网格+6 轨 grid 行分三区+每指标「标签+值」独立块；
电传纸带是唯一保留 `display:table` 语义的一套（密排/等宽/反白表头/数字右对齐/细点竖线分栏）；
大开本 flex 三行（标题/署名/规格），零高伪元素 `::before/::after` 做版面换行点；
瑞士网格 grid 6×3 全留白，做种数 28px 钴蓝锚点；
播控台 grid 4 轨道 + 类别色点 + 做种电平条；
导航 `ul#mainmenu` 全部改成 `display:flex;flex-wrap:wrap` + `--hdui-navgap` 显式列间距。
③ **新测试 + 静态断言**：`sim-hdui-inline-dock.js`（内嵌入口 + 不压站内内容 + 换主题重摆
+ 右下角不被占用）+ 静态校验新增 §7「入口内嵌」+ §8「版式不再堆成一坨」；
5 套版式签名仍然两两不同；仿真测试 21 → 22。
视觉复核 `.workbuddy-ai/_shot-hdui.js`（不入库）截 5 套顶部+中部+面板图，**所有版式肉眼可辨**，
与原 NexusPHP 蓝色表格明显不同。**`.3` 已提交 `bc2c0cd`**（分支 `dev`，已推 gitee）。
**2026-09-19 安全复验后 4 项改进（`.1` → `.2`，已提交 `1b38510`）**：① `unload()` 补 `stopWatch()`，
回退后 MutationObserver 不再空转；② 铺底色挪到**真正的 document-start**（不再等 `DOMContentLoaded`）：`<head>` 未建时退到 `<html>`；
若连 `<html>` 都还没创建则 `paintBootBgWhenPossible()` 退化为「`<html>` 一出现就铺」；失败独立记 `E_BOOT_PAINT`。
实测注入时 `readyState` 仍为 `loading`（早于 `DOMContentLoaded`），旧实现是在 `DOMContentLoaded` 才铺；③ **首次安装默认 `default`（原站默认）**，
不再开机即上妆，老用户已存主题不受影响；④ 修文档漂移（「唯一允许的 DOM 写入」改为「对站内 DOM 的唯一改动」
并列出脚本自建节点、删掉代码里不存在的「告警橙 #ff9f45」）。静态校验新增第 6 组断言钉住启动时机与默认行为。
**2026-09-19 安全复验后 4 项改进（`.1` → `.2`，改完已提交已提交(6e61d34)）**：① `unload()` 补 `stopWatch()`，
回退后 MutationObserver 不再空转；② 铺底色挪到**真正的 document-start**（不再等 `DOMContentLoaded`）：`<head>` 未建时退到 `<html>`；
若连 `<html>` 都还没创建则 `paintBootBgWhenPossible()` 退化为「`<html>` 一出现就铺」；失败独立记 `E_BOOT_PAINT`。
实测注入时 `readyState` 仍为 `loading`（早于 `DOMContentLoaded`），旧实现是在 `DOMContentLoaded` 才铺；③ **首次安装默认 `default`（原站默认）**，
不再开机即上妆，老用户已存主题不受影响；④ 修文档漂移（「唯一允许的 DOM 写入」改为「对站内 DOM 的唯一改动」
并列出脚本自建节点、删掉代码里不存在的「告警橙 #ff9f45」）。静态校验新增第 6 组断言钉住启动时机与默认行为。
用户给的素材是 `resources-do-not-track/HDHome-Whole-Web/` 下**已脱敏**的 HDHome 整页（首页/种子页，
已登录未签到）。需求是「5 套**不同类型**的 UI（不能只换颜色）+ 保住原站全部功能 + 严格仿真测试 +
不许静默忽略错误 + 页面改版不许误触发危险操作 + 结构错误要提醒并回退默认 UI + 可切换可记忆」。
**架构定案：纯样式层 + 运行时列映射**——不重建/移动/克隆任何站内节点、不挂事件、不改 `href`，
列索引靠读表头动态生成 `nth-child` 规则；唯一 DOM 写入是 `<html>` 状态属性与行上的
`--hdui-cat` / `--hdui-ratio` 自定义属性。自持 UI（浮动开关 + 面板）放 **closed shadow root**，
事件 `stopPropagation`，不冒泡到站内监听。只申请 `GM_getValue` / `GM_setValue`。
5 套：`reel` 片库索引（卡片网格/衬线/暗金）、`tape` 电传纸带（保持 `display:table` 密排/全等宽/纸黄/单红）、
`sheet` 大开本（单列长条/17px 衬线标题/双细线）、`swiss` 瑞士网格（留白分隔/28px 数字锚点/钴蓝）、
`signal` 播控台（行 grid 4 轨道 + 电平条 + 类别色点/深石板+青）。
契约校验：A 级锚点（`table.mainouter`/`#nav_block`/`#info_block`/`ul#mainmenu`）+ B 级 12 列全识别
+ 行列数一致；失败即卸妆 + `console.error` + 顶部红色横幅（错误码 + 重新尝试/知道了）+ 写 `hdui.lastError`。
运行时 `MutationObserver` 观察 `#outer` childList（debounce 500ms），局部刷新后重新校验。
测试：`tests/hdhomeui/` 1 个静态 + 4 个真浏览器仿真（功能保持/切换记忆/结构守卫/危险防护），
配套仿真剧本 `tests/lib/sim/hdhome-ui-page.js`（**结构化复刻、零私有数据**，6 个变体）与
`tests/lib/hdui-help.js`；`harness.withSim(fn, { scriptPath })` 由此支持测任意脚本。
实施中由测试挖出**一处真实缺陷**：`validateContract` 只判 `map` 缺失，漏了「列齐全但行列数不符」——已修。
**`.1` 已提交 `13266e0`、`.2` 已提交 `1b38510`**（分支 `dev`，**gitee 与 GitHub 均已推**：GitHub 上是新建的同名分支 `dev`，公开 `master` 未动）。
另用**真实页面**（已脱敏整页）离线核验过契约判定：
12 列全部识别、数据行 12 格、4 个 A 级锚点齐全 ⇒ 仿真复刻与现实一致（脚本在 `.workbuddy-ai/`，不入库）。

