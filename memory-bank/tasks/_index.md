# 任务索引（Tasks Index）

> 记忆库任务系统主清单：所有任务按状态分类。每条任务有独立文件 `TASK<ID>-<name>.md`。
> 任务来源：`progress.md` 待办方向与 `pitfalls.md` 现存 Bug。任务状态与 `progress.md` 保持同步。

## In Progress（进行中）

- [TASK018] HDHome 界面主题（胶片墙） — **已实施**（`.1` 提交 `13266e0`，
  `.2` 提交 `1b38510` 已推 gitee，`.3` 提交 `bc2c0cd` 已推 gitee，`.4` 提交 `4e01743` 已推 gitee；
  **`.5`~`.10` 已一次性提交 `d56ffbb`（未 push）**；`.7` **移除旧 5 套改为单一主题「胶片墙」**—— `.3` 全面重构: 入口内嵌+版式重画；`.4` A/A·GB 改可选列 + 等结构就绪窗口；
  **`.5` 新增 SVG 图标体系**（类别 7 + 指标 8 + 导航 16，原型在 `.workbuddy-ai/hdui-mock/film.html`
  经 96/48/24/16px 四档选型定稿；移植踩坑 P42「SVG 固有尺寸为 0 压塌 `<a>`」已修）；
  **`.6` 修 `UNHANDLED_REJECTION` 归因误导**（页面级事件会把别的脚本的异常打成 `[HDHomeUI]` 前缀，
  现补 stack 首帧 + 显式免责，并把「零异步」钉成静态不变量 —— P43）。
  **`.7` 移除旧 5 套(片库索引/电传纸带/大开本/瑞士网格/播控台), 改为单一主题「胶片墙」`film`** ——
  原型即 `.workbuddy-ai/hdui-mock/film.html`(`.5` 只移植了图标层, 主题本身没落地, `.7` 补上);
  骨架: 齿孔轨道 / 帧号 counter / 表头 sticky / 内嵌占比条 / 置顶 inset 金条, 每条都钉进测试;
  配套删 `statStack`/`statInline`/`headStrip`, 改 `tdSel`/`tdRule`;
  踩坑: 原型导航 `navitem:7px 11px` 真站放不下(第 16 项被挤出 1262px 视口), 收到 `6px 9px`。
  `.9` 首装直接上妆（`FIRST_ID='film'`，只在存储无值时生效）+ 导航配色去撞色（方案 B，真撞 4→0）。
  `.10` 两个布局陷阱（页面被 max-content 撑宽 1260→1503；flex 导航窄屏不换行导致入口点不到，
  见 P46）；新测试 `sim-hdui-layout-width.js`。
  `src/HDHomeUI.user.js` `2026.09.19.10`，分支 `dev`；设计 + 脚本 + 仿真剧本 + 10 个测试
  （含 `sim-hdui-inline-dock`、`sim-hdui-optional-columns`、**`sim-hdui-icons`**）全就位，
  `.8` 旧主题 id 自动迁移（`LEGACY_THEMES` → film，配置类错误 `E_BAD_THEME` 与结构类分开，
  横幅措辞按错误码分流；新测试 `sim-hdui-legacy-theme.js`，见 P44）；
  `node tests/run-all.js` **26/26 全绿**；真实页面离线核验契约通过(含「外部脚本未注入」的
  10 列场景)。
  见 `TASK018-hdhome-ui-themes.md`、`scripts/HDHomeUI.md` §7 与 `pitfalls.md` P33–P43。

- [TASK019] HDHomeUI 胶片墙保真度对齐（对齐原型 `.workbuddy-ai/hdui-mock/film.html`） — **已完成实施（`2026.09.19.11`，待审核）**。
  用户报「脚本未能完整复刻原型」。查出 **A 类 11 条真站适配缺失**（类别图标漏 `c_cartoon/c_misc/c_4kuhd_remux`
  且无兜底、促销 `.tags.tfree` 在真站一条也匹配不到、真站标签 `span.tags` 无样式、上传者列头「发布者」重复、
  `td.colhead` 白粗字未重置、`table.torrents td.rowfollow{text-align:center}` 把标题居中、
  `torrentname` 内层行其实是**三格**而脚本摊平成 inline 乱流、`tdSel(title) img` 通杀压掉图钉/促销/下载图标、
  RSS 被站点 `filter:grayscale` 去色、通配 `table{background}` 冒浅蓝块…）、
  **B 类 13 条原型细节未搬运**（列头 6 个 `::before` 图标全缺、灰阶少一层 `--hdui-dim #7a7267`、
  导航整块样式缺失、入口不是胶囊、面板不是卡片、入口落位压住信息栏…）、
  **C 类 5 条测试保真度不足**（仿真页是"原型的简化副本"而非"真站的子集" ⇒ 26/26 全绿但真站画错）。
  **根因：「原型」被当成了「真站」**（P48/P49）。
  实施：仿真页按真站脱敏页重写 + `/static` 图片路由 + `contain:inline-size` 根治撑宽 +
  新用例 `sim-hdui-film-fidelity.js`（14 条运行时断言，**13 项逐条反向验证**）+ 静态 §12；
  全量 **27/27**。用户裁决 6 个决策点（标签保留 23 分类色 / 促销 3 金徽章 / 置顶图钉保留 /
  豆瓣 IMDb 行内样式覆盖 / 导航恢复 7px 11px / 标题格三格 flex）。
  见 `TASK019-hdhomeui-film-fidelity.md`。

- [TASK020] HDHomeUI 真站截图驱动的补漏 + 真站扫描基建 — **已完成实施（`2026.09.19.12`–`2026.09.19.25`，待审核）**。
  TASK019 结束时仿真 27/27 全绿，用户却连发三张真站截图、张张有画错 ⇒ 印证 P49
  「仿真全绿只证明没回归，不证明真站画得对」。
  ① **三轮用户反馈**：`.12` 白底/图标没换/动作按钮挤一坨（P50/P51/P52）；`.13` 表单仍是白 +
     动作按钮被否决第二行方案；`.15` 首页/论坛标签仍是白（**只 `border:0` 没清 background**，P53）。
  ② **四轮主动排查**（把"靠人眼看"换成自动扫描）：`.16` 站点自绘图标族 + `img.time` 逻辑键≠DOM class
     （P54）；`.17` 站点 `<font>` 老式着色对比度差 3~9（P55）；`.18` UA 渲染界面（P56）；
     外加 CSS 静默失败检查（P57）。
  ③ **基建**：真站脱敏整页离线渲染 + 五档扫描（漏白 / 小件近白 / 站点残留装饰 / 对比度 / UA 界面）；
     新用例 `sim-hdui-meta-actions`（第 28 个）、`sim-hdui-css-validity`（第 29 个）；
     静态新增约 25 条防回退（含 3 条反断言）。全量 **29/29**，真站五档扫描全无。
  **遗留**：非种子页无自动化覆盖（需用户提供整页样本）；真站 86/100 行置顶 ⇒ 金边过满待拍板。
  见 `TASK020-hdhomeui-real-site-fixes.md`。

- [TASK001] PTAutoCheckIn v2 实测校准并入正式版 — **已并入正式版**（1.10 完成），其余逐站实测校准继续（核心主线）
- [TASK002] 修复 BTSchoolHelper 时魔数值恒为 0（P2）— 待实施
- [TASK003] 修复 BTSchoolHelper 命名不一致（P10）— 待实施，N 键前置
- [TASK015] PTAutoCheckIn 慢站误判与结果反馈延迟优化 — **已实施（P0/P1 全部 + P2 大部分，`2026.09.18.1`）**，校验器全绿；待用户实测校准 + 审核后提交（T12 跨域名并发未做；其 T13/T14 已转入 TASK016）
- [TASK016] 测试基础设施与全面测试 — **`tests/` 目录 + 零依赖运行器 + 测试约定已就位**；具体用例（场景矩阵/解析器回归/元数据一致性）待补

## Pending（待办）

- [TASK017] PTAutoCheckIn 本地仿真站与安全测试矩阵 — **`tests/lib/sim/` 已建成，11 个用例随 `node tests/run-all.js` 全绿（13/13）**；已修 P29 面板空值崩溃 + S03 favicon 跨站信标 + S05 面板可被打穿 + S07 `?ptacRetry` 强制动作 + S09a 站外伪造入口（`@version` 2026.09.18.4，**已提交 `e2d5f52`**）；残留 S09b / S13 需真站回归。见 `TASK017-ptac-sim-site-security.md` 与 `pitfalls.md` P29/P30
- [TASK004] 签到站点覆盖扩展 — 待办（新增/校准站点）
- [TASK005] BTSchoolHelper 快捷键增强（N/B 键 + 行高亮）— 待办（依赖 TASK003）
- [TASK006] BilibiliEnterFullscreen 适配加固（MutationObserver）— 待办
- [TASK007] 设置面板化（GM 存储驱动）— 待办（中期）
- [TASK008] 解析工具函数收敛 — 待办（中期）
- [TASK009] 表格解析回归测试 — 待办（中期）
- [TASK010] 发布自动化（版本号校验）— 待办（中期）

## Pending（远期构想）

- [TASK011] 多站点种子聚合/搜索辅助 — 远期
- [TASK012] 签到结果推送（GM_notification / Server 酱）— 远期
- [TASK013] 规则热更新（远端 JSON + 缓存）— 远期
- [TASK014] 代码现代化评审 — 远期

## Abandoned（放弃）

- （当前无）

---

## 任务文件命名规范

- 每个任务独立文件：`TASK<ID>-<短横线名>.md`，例如 `TASK001-ptauto-checkin-v2-calibration.md`。
- 状态：`Pending / In Progress / Completed / Abandoned`。
- 任务更新时：更新任务文件的 subtask 表 + 进度日志，并同步本 `_index.md`。