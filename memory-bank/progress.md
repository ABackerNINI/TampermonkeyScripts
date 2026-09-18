# 进度（Progress）

> 记忆库核心文件：已实现 / 待办 / 现状 / 已知问题。任务状态追踪见 [tasks/_index.md](./tasks/_index.md)。

## 已实现（Works）

- **PTAutoCheckIn**（`2026.09.18.1`）：被动签到 + 批量调度（发起页常驻 + 后台标签串行）+ 跨站 FAB 结果面板 + 贴吧多吧（unit 级独立冷却/状态）+ 27 站 + 贴吧 6 吧。含：FAB 四皮肤（变色/数字/信号灯/光环）、站点图标、跨天守卫、仅检测型（U2）、无按钮访问即签型（MTeam 系六站）、no-text 按钮站（NodeLoc）、签到按钮重现降级提醒（suspect）、行内单站强制重试。**v2 已并入正式版**, 生产脚本为单一 `PTAutoCheckIn.user.js`（`@name PTAutoCheckIn`）。
  **2026-09-18 慢站误判修复（P28）**：整流程超时定时器不再覆写已给出的结论（旧版 25s 后把 `skipped`/`detect_only`/`suspect` 一律改成 `failed`，是「经常失败」主因）；新增 `unconfirmed` 独立状态（未确认，不计入失败、可重试）；`writeStatus` 状态单向阶梯；点击后观察窗改事件驱动（`pagehide`/`beforeunload`/URL 变化/成功特征，上限 4s）+ 有界复检（+5s/+12s，只检测不重复点击）；`waitForElement` 可交互判定 + 慢页面超时自适应；**超时预算不变式**（`detectMs + stepsMs + 18000ms <= 40000ms`）与双校验（运行时 `auditUnitBudgets()` + `tests/check-ptac-budget.js`）；进度心跳 + 20s 零进度判死站；整流程 25s→40s、调度窗口 50s→60s。**未提交**，待实测校准 + 用户审核。
- **BTSchoolHelper**（`2026.08.09.1`）：高亮 2xFree、置顶低亮、空格跳转、完整表格解析器 `parseTorrentTable`。
- **BilibiliEnterFullscreen**（`2026.07.22.7`）：自动网页全屏 + Enter/Shift+Enter 切换，防误触输入框。
- **EnhanceVisitedLinks**（`2026.08.09.1`）：全局 `:visited` 紫色高亮 + 明暗适配 + SPA 软导航重注入。

## 现状（Current Status）

- PTAutoCheckIn v2 **已并入正式版**：生产脚本为单一 `src/PTAutoCheckIn.user.js`（`@name PTAutoCheckIn`，`2026.09.18.1`），旧 v1 与 `-v2` 暂存文件均已删除。
- **2026-09-18 慢站误判修复（TASK015 / P28）已实施但未提交**：`node --check` 通过；静态校验器 `tests/check-ptac-budget.js` 全部不变式通过（常量 A 6 项 / 阶梯 B 6 项 / 声明 C 2 项 / 自测 D 2 项）；运行时预算自检 32 站全通过，最紧 HHCLUB 34400/40000ms。**待真实站点实测校准（校准项 21）后由用户决定提交**。
- **2026-09-18 测试基础设施（TASK016）已就位但未提交**：测试工具从 `scripts/` 迁入 **`tests/`**；新增零依赖运行器 `tests/run-all.js`（`node tests/run-all.js` 一次跑完，约定「顶层 `tests/*.js` 每个文件 = 一个测试，以退出码表达结果」）与约定文档 `tests/README.md`。当前 1 个测试通过。
- 其余脚本功能稳定，处于增量维护状态。

## 待办 / 待修（Known Bugs & Left to Build）

### 现存 Bug（优先）
- **P2 BTSchoolHelper 时魔数值恒为 0**：`calcA`/`calcAve` 误用 `parseCommaIntSafe` 解析浮点 `data-calc-a`/`data-calc-ave` → 需改 `parseCommaNumberSafe`。若排序/筛选依赖该值会导致结果失真。
- **P10 BTSchoolHelper 命名不一致**：`scrollToNext2xFreeTorrent` 内调 `getBottomTorrentId()`（小写 d）与 `arrayFindIndex`，实际定义是 `getBottomTorrentID()`（大写 D）与 `arrayFind`。当前未启用不报错；启用 N 键前必须先改名对齐。

### 待办方向（详见 tasks/_index.md）
- **近期**：**PTAutoCheckIn 慢站修复实测校准（TASK015 / 校准项 21，8 项）**——改动已实施未提交，须先在真实站点验证再决定提交；**补测试用例（TASK016）**——`tests/` 约定与运行器已就位，待补场景矩阵/解析器回归/元数据一致性；PTAutoCheckIn 既有逐站实测校准（校准项 1–20）；签到站点覆盖扩展；BTSchoolHelper 快捷键增强（N/B 键 + 行高亮）；BilibiliEnterFullscreen MutationObserver 加固。
- **中期**：设置面板化；解析工具函数收敛；表格解析回归测试；发布自动化（版本号校验）。
- **远期**：多站点种子聚合/搜索辅助；签到结果推送（GM_notification/Server 酱）；规则热更新（远端 JSON + 缓存）；代码现代化评审。

## 已知问题（见 pitfalls.md 完整清单）

- P2、P10：上述现存 Bug。
- P16 起：PTAutoCheckIn v2 站点建模的各类已踩坑（落地页无反馈、confirmManual 卡 pending、跨天快照、验证码站、no-text 按钮、SPA 导航时序等）均已记录症状→原因→对策。

## 发布注意

- 任何代码/元数据改动必须同步递增 `@version` 并与代码同次提交；同步更新 `memory-bank/` 记忆库（见 conventions.md 第 0.4 / 1 节）。