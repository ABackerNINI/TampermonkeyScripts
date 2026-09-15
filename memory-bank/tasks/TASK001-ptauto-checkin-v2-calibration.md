# [TASK001] - PTAutoCheckIn v2 实测校准并入正式版

**Status:** In Progress
**Added:** 2026-09-07
**Updated:** 2026-09-16

## Original Request

将 PTAutoCheckIn v2（`src/PTAutoCheckIn-v2.user.js`）逐站实测校准通过后，并入正式版 `src/PTAutoCheckIn.user.js`（改回 `@name PTAutoCheckIn`，递增版本号），并删除 v1 旧文件。

## Thought Process

- v2 的核心设计（配置数据 + 通用引擎、unit 级独立冷却、批量调度、FAB 面板）已实现，但涉及大量站点与复杂交互，未逐站实测前不宜直接替换 v1。
- 站点签到形态多样：普通按钮型、跳页型（HDBao/MuXueGe）、对话框型（蜂巢）、无按钮访问即签型（MTeam 系）、no-text 图标按钮型（NodeLoc）、仅检测型（U2）、落地页无反馈型（PTTime）、菜单展开型（HHCLUB）、贴吧多吧。
- 每类站需要不同的建模与确认通道，需逐站验证「未签能点、已签不重复、10 分钟冷却、跨天不误判」。
- 校准通过后再合入 v1，保证用户端无缝升级。

## Implementation Plan

- [ ] 逐项执行实测校准清单（见脚本文档 20 项，核心为：贴吧多吧、蜂巢、MTeam 系六站、NodeLoc、HHCLUB、U2、批量调度、FAB 皮肤、跨天守卫、行内重试）
- [ ] 校准中发现的问题按 pitfalls.md 记录并修复
- [x] 全部通过后：`src/PTAutoCheckIn-v2.user.js` 改名合入 `PTAutoCheckIn.user.js`，递增 `@version`，删除 v1 旧文件
- [x] 同步更新 `memory-bank/scripts/PTAutoCheckIn.md` 与 `@description`

## Progress Tracking

**Overall Status:** In Progress - 50%

### Subtasks
| ID | Description | Status | Updated | Notes |
|----|------------|--------|---------|-------|
| 1.1 | 贴吧多吧校准（6 吧含四新吧中文 kw） | In Progress | 2026-09-16 | 待实测中文 kw 匹配、吧间互不误签 |
| 1.2 | 蜂巢 successDetect 校准 | In Progress | 2026-09-16 | 已弃 confirmManual，待实测按钮变已签稳定 |
| 1.3 | MTeam 系六站校准 | In Progress | 2026-09-16 | 待实测首页 path、特征、未登录 failed |
| 1.4 | NodeLoc 校准 | In Progress | 2026-09-16 | 待实测点击签到 + 重现检测 |
| 1.5 | HHCLUB 校准 | In Progress | 2026-09-16 | 待实测普通触发稳定 |
| 1.6 | U2 仅检测型校准 | In Progress | 2026-09-16 | 待实测无点击无冷却 |
| 1.7 | 批量调度/落地页结算校准 | In Progress | 2026-09-16 | 断链 50s 跳过、中断恢复 |
| 1.8 | 15 个普通 PT 站回归 | Pending | - | 含 BTSchool noButtonMeansCheckedIn |
| 1.9 | FAB 四皮肤 / 跨天守卫 / 行内重试校准 | In Progress | 2026-09-16 | 待实测 |
| 1.10 | 并入正式版 + 删 v1 | Completed | 2026-09-16 | 已合入 `PTAutoCheckIn.user.js`（@name 改回 PTAutoCheckIn, v2026.09.16.1），删除 -v2 暂存与旧 v1 |

## Progress Log

### 2026-09-16
- **并入正式版完成**：`src/PTAutoCheckIn-v2.user.js` 内容已并入 `PTAutoCheckIn.user.js`，改回 `@name PTAutoCheckIn`，递增 `@version 2026.09.16.1`；`-v2` 暂存文件与旧 v1 已删除。生产脚本合并为单一 `PTAutoCheckIn.user.js`。
- 逐站实测校准仍在继续（1.1-1.9 子任务待实测），校准中发现的问题按 pitfalls.md 记录并修复。
- 校准清单 20 项详见 `memory-bank/scripts/PTAutoCheckIn.md` 第 183 行起。

### 2026-09-08
- 完成跨天守卫（.16）、仅检测型 detectOnly（.17）、按钮重现降级提醒（.18/.19/.20）、无按钮站接入（.21-.25）、载体无关信号（.26）、贴吧加四吧（.27）、行内强制重试（.28）。