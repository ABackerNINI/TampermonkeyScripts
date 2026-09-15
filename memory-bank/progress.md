# 进度（Progress）

> 记忆库核心文件：已实现 / 待办 / 现状 / 已知问题。任务状态追踪见 [tasks/_index.md](./tasks/_index.md)。

## 已实现（Works）

- **PTAutoCheckIn-v2**（`2026.09.08.28`）：被动签到 + 批量调度（发起页常驻 + 后台标签串行）+ 跨站 FAB 结果面板 + 贴吧多吧（unit 级独立冷却/状态）+ 27 站 + 贴吧 6 吧。含：FAB 四皮肤（变色/数字/信号灯/光环）、站点图标、跨天守卫、仅检测型（U2）、无按钮访问即签型（MTeam 系六站）、no-text 按钮站（NodeLoc）、签到按钮重现降级提醒（suspect）、行内单站强制重试。
- **BTSchoolHelper**（`2026.08.09.1`）：高亮 2xFree、置顶低亮、空格跳转、完整表格解析器 `parseTorrentTable`。
- **BilibiliEnterFullscreen**（`2026.07.22.7`）：自动网页全屏 + Enter/Shift+Enter 切换，防误触输入框。
- **EnhanceVisitedLinks**（`2026.08.09.1`）：全局 `:visited` 紫色高亮 + 明暗适配 + SPA 软导航重注入。

## 现状（Current Status）

- PTAutoCheckIn v2 **尚未并入正式版**，处于「逐站实测校准」阶段；v1 旧版暂保留（`src/PTAutoCheckIn.user.js`）。
- 其余脚本功能稳定，处于增量维护状态。

## 待办 / 待修（Known Bugs & Left to Build）

### 现存 Bug（优先）
- **P2 BTSchoolHelper 时魔数值恒为 0**：`calcA`/`calcAve` 误用 `parseCommaIntSafe` 解析浮点 `data-calc-a`/`data-calc-ave` → 需改 `parseCommaNumberSafe`。若排序/筛选依赖该值会导致结果失真。
- **P10 BTSchoolHelper 命名不一致**：`scrollToNext2xFreeTorrent` 内调 `getBottomTorrentId()`（小写 d）与 `arrayFindIndex`，实际定义是 `getBottomTorrentID()`（大写 D）与 `arrayFind`。当前未启用不报错；启用 N 键前必须先改名对齐。

### 待办方向（详见 roadmap.md 与 tasks/_index.md）
- **近期**：PTAutoCheckIn v2 实测校准并入正式版；签到站点覆盖扩展；BTSchoolHelper 快捷键增强（N/B 键 + 行高亮）；BilibiliEnterFullscreen MutationObserver 加固。
- **中期**：设置面板化；解析工具函数收敛；表格解析回归测试；发布自动化（版本号校验）。
- **远期**：多站点种子聚合/搜索辅助；签到结果推送（GM_notification/Server 酱）；规则热更新（远端 JSON + 缓存）；代码现代化评审。

## 已知问题（见 pitfalls.md 完整清单）

- P2、P10：上述现存 Bug。
- P16 起：PTAutoCheckIn v2 站点建模的各类已踩坑（落地页无反馈、confirmManual 卡 pending、跨天快照、验证码站、no-text 按钮、SPA 导航时序等）均已记录症状→原因→对策。

## 发布注意

- 任何代码/元数据改动必须同步递增 `@version` 并与代码同次提交；同步更新 `memory-bank/` 记忆库（见 conventions.md 第 0.4 / 1 节）。