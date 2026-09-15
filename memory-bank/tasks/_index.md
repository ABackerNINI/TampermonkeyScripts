# 任务索引（Tasks Index）

> 记忆库任务系统主清单：所有任务按状态分类。每条任务有独立文件 `TASK<ID>-<name>.md`。
> 任务来源：`roadmap.md` 路线图。任务状态与 `roadmap.md`、`progress.md` 保持同步。

## In Progress（进行中）

- [TASK001] PTAutoCheckIn v2 实测校准并入正式版 — 逐站实测校准中（核心主线）
- [TASK002] 修复 BTSchoolHelper 时魔数值恒为 0（P2）— 待实施
- [TASK003] 修复 BTSchoolHelper 命名不一致（P10）— 待实施，N 键前置

## Pending（待办）

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