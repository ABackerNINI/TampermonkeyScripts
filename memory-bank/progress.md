# 进度（Progress）

> 记忆库核心文件：已实现 / 待办 / 现状 / 已知问题。任务状态追踪见 [tasks/_index.md](./tasks/_index.md)。

## 已实现（Works）

- **PTAutoCheckIn**（`2026.09.19.3`）：被动签到 + 批量调度（发起页常驻 + 后台标签串行）+ 跨站 FAB 结果面板 + 贴吧多吧（unit 级独立冷却/状态）+ 28 站 + 贴吧 6 吧。含：FAB 四皮肤（变色/数字/信号灯/光环）、站点图标、跨天守卫、仅检测型（U2）、无按钮访问即签型（MTeam 系六站）、no-text 按钮站（NodeLoc）、签到按钮重现降级提醒（suspect）、行内单站强制重试。**v2 已并入正式版**, 生产脚本为单一 `PTAutoCheckIn.user.js`（`@name PTAutoCheckIn`）。
  **2026-09-18 慢站误判修复（P28）**：整流程超时定时器不再覆写已给出的结论（旧版 25s 后把 `skipped`/`detect_only`/`suspect` 一律改成 `failed`，是「经常失败」主因）；新增 `unconfirmed` 独立状态（未确认，不计入失败、可重试）；`writeStatus` 状态单向阶梯；点击后观察窗改事件驱动（`pagehide`/`beforeunload`/URL 变化/成功特征，上限 4s）+ 有界复检（+5s/+12s，只检测不重复点击）；`waitForElement` 可交互判定 + 慢页面超时自适应；**超时预算不变式**（`detectMs + stepsMs + 18000ms <= 40000ms`）与双校验（运行时 `auditUnitBudgets()` + `tests/ptautocheckin/check-ptac-budget.js`）；进度心跳 + 20s 零进度判死站；整流程 25s→40s、调度窗口 50s→60s。**已提交**（`ebb06bb`，分支 `dev`），待真实站点实测校准。
- **BTSchoolHelper**（`2026.08.09.1`）：高亮 2xFree、置顶低亮、空格跳转、完整表格解析器 `parseTorrentTable`。
- **BilibiliEnterFullscreen**（`2026.07.22.7`）：自动网页全屏 + Enter/Shift+Enter 切换，防误触输入框。
- **EnhanceVisitedLinks**（`2026.08.09.1`）：全局 `:visited` 紫色高亮 + 明暗适配 + SPA 软导航重注入。

## 现状（Current Status）

- **2026-09-19 新增站点 HDHome（`2026.09.19.3`，已提交 `d63fe0c`，分支 `dev`，尚未 push）**：`hdhome.org`，已签后签到入口由
  `<a href="attendance.php">签到得魔力</a>`（**无方括号**）变成魔力值行内纯文本「(签到已得N)」→ 已签判定
  走**双通道**：`alreadyPageCheck` 整页文本 + `alreadyCheck`「入口消失**且**有登录态证据(魔力值信息栏)」。
  **曾短暂用过 `noButtonMeansCheckedIn`（.2 版）后回退** —— 用户反馈"不够保险"：它只看到"入口没了"，
  看不到"人没登录"，未登录页同样无入口 → 会把漏登录报成"今日已成功"（见 P31）。
  同步新增仿真回归 `tests/ptautocheckin/sim-hdhome-pagetext.js`（四条断言：已签零点击 / 点击落地结算 /
  入口消失无文本仍判已签 / **未登录页不得判已签**，本机 Chrome 实测通过），`node tests/run-all.js`
  **14/14 全绿**；预算校验通过（C2 3 个 `alreadyCheck` 均已声明）。**待真站实测**（校准项 22）。
- PTAutoCheckIn v2 **已并入正式版**：生产脚本为单一 `src/PTAutoCheckIn.user.js`（`@name PTAutoCheckIn`，`2026.09.19.2`），旧 v1 与 `-v2` 暂存文件均已删除。
- **2026-09-18 慢站误判修复（TASK015 / P28）已实施并提交**（`ebb06bb`）：`node --check` 通过；静态校验器 `tests/ptautocheckin/check-ptac-budget.js` 全部不变式通过（常量 A 6 项 / 阶梯 B 6 项 / 声明 C 2 项 / 自测 D 2 项）；运行时预算自检 32 站全通过，最紧 HHCLUB 34400/40000ms。**待真实站点实测校准（校准项 21）**，发现问题再迭代。
- **2026-09-18 测试基础设施（TASK016）已就位并提交**（`2b31377`）：测试工具从 `scripts/` 迁入 **`tests/`**；新增零依赖运行器 `tests/run-all.js`（`node tests/run-all.js` 一次跑完，约定「顶层 `tests/*.js` 每个文件 = 一个测试，以退出码表达结果」）与约定文档 `tests/README.md`。当前 1 个测试通过。
- **2026-09-18 本地仿真站与安全测试（TASK017）已实施**：`tests/lib/sim/`（零依赖服务器 + 站点剧本 + GM 垫片 + CDP 驱动）建成，
  `tests/ptautocheckin/sim-security-s*.js` 共 11 个用例，`node tests/run-all.js` **13/13 全绿**。
  实测复现 4 项 P0（favicon 跨站信标 / 面板可被宿主页面读穿 / `?ptacRetry` 强制动作 / 站外伪造签到入口）
  并**额外挖出 P0 崩溃 Bug**（P29：首次安装时主流程 100% 不执行）。
  **已修 5 处**（`@version` 2026.09.18.2 → **2026.09.18.4**，见 P30），残留 2 项（S09b / S13）需真站回归后定。
  **已提交**（`e2d5f52`，分支 `dev`）。
- **分支 `dev` 上共 7 个提交尚未 push**（`ebb06bb` / `2b31377` / `8036f44` / `e2d5f52` / `18e0824` / `0bac142` / `d63fe0c`，`dev` 无上游跟踪；数量为 `git rev-list --count dev --not origin/master`，2026-09-19 复核）。
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