# 进度（Progress）

> 记忆库核心文件：已实现 / 待办 / 现状 / 已知问题。任务状态追踪见 [tasks/_index.md](./tasks/_index.md)。

## 已实现（Works）

- **PTAutoCheckIn**（`2026.09.19.4`）：被动签到 + 批量调度（发起页常驻 + 后台标签串行）+ 跨站 FAB 结果面板 + 贴吧多吧（unit 级独立冷却/状态）+ 28 站 + 贴吧 6 吧。含：FAB 四皮肤（变色/数字/信号灯/光环）、站点图标、跨天守卫、仅检测型（U2）、无按钮访问即签型（MTeam 系六站）、no-text 按钮站（NodeLoc）、签到按钮重现降级提醒（suspect）、行内单站强制重试。**v2 已并入正式版**, 生产脚本为单一 `PTAutoCheckIn.user.js`（`@name PTAutoCheckIn`）。
  **2026-09-18 慢站误判修复（P28）**：整流程超时定时器不再覆写已给出的结论（旧版 25s 后把 `skipped`/`detect_only`/`suspect` 一律改成 `failed`，是「经常失败」主因）；新增 `unconfirmed` 独立状态（未确认，不计入失败、可重试）；`writeStatus` 状态单向阶梯；点击后观察窗改事件驱动（`pagehide`/`beforeunload`/URL 变化/成功特征，上限 4s）+ 有界复检（+5s/+12s，只检测不重复点击）；`waitForElement` 可交互判定 + 慢页面超时自适应；**超时预算不变式**（`detectMs + stepsMs + 18000ms <= 40000ms`）与双校验（运行时 `auditUnitBudgets()` + `tests/ptautocheckin/check-ptac-budget.js`）；进度心跳 + 20s 零进度判死站；整流程 25s→40s、调度窗口 50s→60s。**已提交**（`ebb06bb`，分支 `dev`），待真实站点实测校准。
- **HDHomeUI**（`2026.09.19.4`，2026-09-19 新建，TASK018）：HDHome 界面主题套件，5 套可切换可记忆的 UI
  （片库索引 / 电传纸带 / 大开本 / 瑞士网格 / 播控台）。**纯样式层**改造：不重建 DOM、不接管交互，
  列索引运行时探测后动态生成 CSS，原站功能（16 项导航、信息栏入口含签到、搜索箱与折叠、排序、
  RSS 增删、分页、页脚）由「功能基线快照 + hit-test」两道仿真断言守住。  结构契约（A 级锚点 + **必需**列齐全 + 行列数一致）任一不满足 ⇒ 卸妆 + 控制台 error + 顶部红色横幅 +
  写 `hdui.lastError`；运行时 MutationObserver 复查。诊断统一走 `Diag` 账本，禁止空 catch，
  挂载 window error/unhandledrejection 只记不吞。详见 `scripts/HDHomeUI.md` 与 `pitfalls.md` P33。
  **`.4`（改完待审核未提交）**：真站首装报 `E_COLUMN_UNKNOWN: a,ave`、点重试就好 ——
  A / A·GB 是**别的脚本运行时注入**的列（`#calcTHeadA` / `#calcTHeadAve`），比本脚本晚，**纯时序问题**。
  ① `a`/`ave` 改**可选列**（`REQUIRED_COLUMNS` 由全集剔除得出），缺了返回成功码 `OK_NO_CALC` 照常上妆，
  排版函数在列缺席时 `return ''`（绝不生成 `:nth-child(undefined)`）；
  ② 列集合变了用 `colMapSig` 比对并**重摆**，补进来的格子要吃到主题样式；
  ③ `ROW_CELL_COUNT_MISMATCH`（补列补到一半）进**等待窗口**（首装 8s / 运行中 4s，每 700ms 试一次），
  期间 `data-hdui-state="pending"`、**已上妆的不卸妆**；`E_COLUMN_UNKNOWN` / `E_ANCHOR_MISSING` **不等**
  （A/A·GB 变可选后这两个码只可能是真坏了）；
  ④ 新测试 `sim-hdui-optional-columns.js`（10 列照常上妆 / 补进来重摆 / 撤走不回退 / 半状态不弹横幅且自愈）
  + 剧本 `hdhome-ui-nocalc` + 静态校验 §9「可选列与等待窗口」12 条；仿真测试 22 → 23。
  **`.3`（已提交 `bc2c0cd`，分支 `dev`，**未 push**）**：2026-09-19 用户报两件事 ——
  ① 右下角浮动圆钮与 PTAutoCheckIn v2 等脚本的 FAB 抢同一个位置;
  ② 5 套主题风格与原 UI 太接近, 12 个格子挤同一行 + 新 UI 按钮都堆到一起, 与设计初衷背道而驰。
  三件事: ① **入口内嵌** —— FAB 删, 量 `ul#mainmenu` 最后一个 li 的右边空档, 把入口摆成导航栏末尾的小文字钮
  `界面 · <主题名> ▾`; 面板改为锚在它下方的下拉浮层; `position:absolute` 文档坐标内嵌(随页面滚动);
  ② **版式全面重画**, 每套独立骨架（片库索引 grid 卡片+6 轨 grid 行; 电传纸带唯一保留 `display:table`;
  大开本 flex 三行+零高伪元素换行点; 瑞士网格 grid 6×3 全留白+28px 钴蓝锚点; 播控台 grid 4 轨道+电平条）,
  导航全部改成 `flex+wrap`+`--hdui-navgap` 显式列间距;
  ③ **新测试** `sim-hdui-inline-dock.js`(内嵌入口+不压站内内容+换主题重摆+右下角不被占用),
  静态校验新增 §7「入口内嵌」+ §8「版式不再堆成一坨」, 仿真测试 21 → 22; 视觉复核
  `.workbuddy-ai/_shot-hdui.js`(不入库)截 5 套顶部+中部+面板图. **`.2`(已提交 `1b38510`, 分支 `dev`, 已推 gitee)**:
  安全性全面复验后的 4 项改进 —— `unload()` 补 `stopWatch()`、铺底色移到真正的 document-start、
  首次安装默认 `default`、修 `scripts/HDHomeUI.md` 的文档漂移; 静态校验同步新增第 6 组断言.
  另用**真实页面**(`resources-do-not-track/` 下已脱敏的整页)离线核验过契约判定: 12 列全部识别、
  数据行 12 格、4 个 A 级锚点齐全 ⇒ 仿真复刻与现实一致(核验脚本在 `.workbuddy-ai/`, 不入库)。
- **BTSchoolHelper**（`2026.08.09.1`）：高亮 2xFree、置顶低亮、空格跳转、完整表格解析器 `parseTorrentTable`。
- **BilibiliEnterFullscreen**（`2026.07.22.7`）：自动网页全屏 + Enter/Shift+Enter 切换，防误触输入框。
- **EnhanceVisitedLinks**（`2026.08.09.1`）：全局 `:visited` 紫色高亮 + 明暗适配 + SPA 软导航重注入。

## 现状（Current Status）

- **2026-09-19 主面板交互调整（`2026.09.19.4`，已改未提交，待实测校准项 23）**：① **主面板失焦自动关闭** ——
  点面板外（`document` 捕获阶段 `mousedown`）或切标签页/窗口（`window` `blur`）即收起，监听随面板展开/收起挂摘；
  点在 UI 自身（`host.contains(e.target)`）与**带操作钮的横幅（中断恢复）**豁免。② **签到按钮重现不弹主面板** ——
  页面级呈现收敛为唯一入口 `presentReappearedOnPage()`（按钮描边 + ⚠ 徽标 + 底部横条 + 首次降级一条 toast），
  复核分支与入口内均无 `openPanel`。新增两层回归：静态 `check-ptac-panel.js`（钉接线）+ 真浏览器
  `sim-panel-autoclose.js`（面板在 closed shadow 下拿不到元素，用 `elementFromPoint` 的 shadow 重定向判开合；
  实测点外收起 / 点内不收起 / blur 收起 / 重现不弹且零点击 / 中断恢复横幅不误关）。
  `node tests/run-all.js` **16/16 全绿**；预算校验不变（`check-ptac-budget.js` 全通过）。**待真站实测**（校准项 23）。
- **2026-09-19 新增站点 HDHome（`2026.09.19.3`，已提交 `d63fe0c`，分支 `dev`，**已推 gitee**）**：`hdhome.org`，已签后签到入口由
  `<a href="attendance.php">签到得魔力</a>`（**无方括号**）变成魔力值行内纯文本「(签到已得N)」→ 已签判定
  走**双通道**：`alreadyPageCheck` 整页文本 + `alreadyCheck`「入口消失**且**有登录态证据(魔力值信息栏)」。
  **曾短暂用过 `noButtonMeansCheckedIn`（.2 版）后回退** —— 用户反馈"不够保险"：它只看到"入口没了"，
  看不到"人没登录"，未登录页同样无入口 → 会把漏登录报成"今日已成功"（见 P31）。
  同步新增仿真回归 `tests/ptautocheckin/sim-hdhome-pagetext.js`（四条断言：已签零点击 / 点击落地结算 /
  入口消失无文本仍判已签 / **未登录页不得判已签**，本机 Chrome 实测通过），`node tests/run-all.js`
  **14/14 全绿**；预算校验通过（C2 3 个 `alreadyCheck` 均已声明）。**待真站实测**（校准项 22）。
- PTAutoCheckIn v2 **已并入正式版**：生产脚本为单一 `src/PTAutoCheckIn.user.js`（`@name PTAutoCheckIn`，当前 `2026.09.19.4`），旧 v1 与 `-v2` 暂存文件均已删除。
- **2026-09-18 慢站误判修复（TASK015 / P28）已实施并提交**（`ebb06bb`）：`node --check` 通过；静态校验器 `tests/ptautocheckin/check-ptac-budget.js` 全部不变式通过（常量 A 6 项 / 阶梯 B 6 项 / 声明 C 2 项 / 自测 D 2 项）；运行时预算自检 32 站全通过，最紧 HHCLUB 34400/40000ms。**待真实站点实测校准（校准项 21）**，发现问题再迭代。
- **2026-09-18 测试基础设施（TASK016）已就位并提交**（`2b31377`）：测试工具从 `scripts/` 迁入 **`tests/`**；新增零依赖运行器 `tests/run-all.js`（`node tests/run-all.js` 一次跑完，约定「顶层 `tests/*.js` 每个文件 = 一个测试，以退出码表达结果」）与约定文档 `tests/README.md`。当前 1 个测试通过。
- **2026-09-18 本地仿真站与安全测试（TASK017）已实施**：`tests/lib/sim/`（零依赖服务器 + 站点剧本 + GM 垫片 + CDP 驱动）建成，
  `tests/ptautocheckin/sim-security-s*.js` 共 11 个用例，`node tests/run-all.js` **13/13 全绿**。
  实测复现 4 项 P0（favicon 跨站信标 / 面板可被宿主页面读穿 / `?ptacRetry` 强制动作 / 站外伪造签到入口）
  并**额外挖出 P0 崩溃 Bug**（P29：首次安装时主流程 100% 不执行）。
  **已修 5 处**（`@version` 2026.09.18.2 → **2026.09.18.4**，见 P30），残留 2 项（S09b / S13）需真站回归后定。
  **已提交**（`e2d5f52`，分支 `dev`）。
- **分支 `dev` 共 12 个功能提交，2026-09-19 已全部推送到 `gitee` 的新分支 `dev`**（`ebb06bb` / `2b31377` / `8036f44` / `e2d5f52` / `18e0824` / `0bac142` / `d63fe0c` / `ab9701a` / `80e0f37` / **`13266e0`（HDHomeUI）** / **`b091e16`（铁律 5）** / **`1b38510`（HDHomeUI 安全复验 4 项改进）**；推送时 `dev` HEAD = `1b38510`，`git rev-list --count dev --not gitee/dev` = 0）。
  - **GitHub（`origin`）已于 2026-09-19 推送**：按「推成同名新分支」的惯例新建 **`dev` 分支**（`97417cd`），
    **公开 `master` 未动**（仍 `322d257`）。`refs/remotes/origin/*` 由 push 自身更新，`_sync-refs.js` 因代理失效取不到值。
  - ⚠️ **全局那条 `http.https://github.com.proxy=http://127.0.0.1:10808` 当前是死的**：直连 `curl https://github.com`
    0.36s/200，走代理 `000`（无人监听）。凡是要连 GitHub 的命令都得临时禁用：
    `git -c "http.https://github.com.proxy=" ...`（值给空即禁用）。`_sync-refs.js` 没做这层处理，故对 origin 会失败。
  - 推 Gitee 时曾遇 `RPC failed; curl 55 Send failure: Connection was reset`（挂起约 5.5 分钟后被重置）；仓库仅 4.4M、最大对象 210KB，**非体积问题**，属链路抖动。加 `http.version=HTTP/1.1` + `http.postBuffer=524288000` + `http.lowSpeedLimit=0` 后一次成功。Gitee 的 SSH 通道**未配公钥**（`Permission denied (publickey)`），只能用 HTTPS。
  - 本地跟踪引用 `refs/remotes/gitee/*` 由 `.workbuddy-ai/_sync-refs.js` 直接写 loose ref 落盘（本环境 `git fetch` 对 `refs/remotes/**` 的写入会静默丢失）。
- 其余脚本功能稳定，处于增量维护状态。

## 待办 / 待修（Known Bugs & Left to Build）

### 现存 Bug（优先）
- **P2 BTSchoolHelper 时魔数值恒为 0**：`calcA`/`calcAve` 误用 `parseCommaIntSafe` 解析浮点 `data-calc-a`/`data-calc-ave` → 需改 `parseCommaNumberSafe`。若排序/筛选依赖该值会导致结果失真。
- **P10 BTSchoolHelper 命名不一致**：`scrollToNext2xFreeTorrent` 内调 `getBottomTorrentId()`（小写 d）与 `arrayFindIndex`，实际定义是 `getBottomTorrentID()`（大写 D）与 `arrayFind`。当前未启用不报错；启用 N 键前必须先改名对齐。

### 待办方向（详见 tasks/_index.md）
- **近期**：**PTAutoCheckIn 慢站修复实测校准（TASK015 / 校准项 21，8 项）**——改动已提交（`ebb06bb`），须先在真实站点验证，有问题再迭代；**补测试用例（TASK016）**——`tests/` 约定与运行器已就位，待补场景矩阵/解析器回归/元数据一致性；PTAutoCheckIn 既有逐站实测校准（校准项 1–20）；签到站点覆盖扩展；BTSchoolHelper 快捷键增强（N/B 键 + 行高亮）；BilibiliEnterFullscreen MutationObserver 加固。
- **中期**：设置面板化；解析工具函数收敛；表格解析回归测试；发布自动化（版本号校验）。
- **远期**：多站点种子聚合/搜索辅助；签到结果推送（GM_notification/Server 酱）；规则热更新（远端 JSON + 缓存）；代码现代化评审。

## 已知问题（见 pitfalls.md 完整清单）

- P2、P10：上述现存 Bug。
- P16 起：PTAutoCheckIn v2 站点建模的各类已踩坑（落地页无反馈、confirmManual 卡 pending、跨天快照、验证码站、no-text 按钮、SPA 导航时序等）均已记录症状→原因→对策。

## 发布注意

- 任何代码/元数据改动必须同步递增 `@version` 并与代码同次提交；同步更新 `memory-bank/` 记忆库（见 conventions.md 第 0.4 / 1 节）。