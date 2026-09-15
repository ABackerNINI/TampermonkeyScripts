# 活跃上下文（Active Context）

> 记忆库核心文件：**当前工作焦点**、最近改动、下一步、活跃决策与考量。此文件是所有核心文件中更新最频繁的。

## 当前工作焦点

**PTAutoCheckIn v2（`src/PTAutoCheckIn-v2.user.js`，当前 `2026.09.08.28`）——待实测校准后并入正式版**。核心引擎与站点建模已完成，正处在「逐站实测校准 → 修 Bug → 并入 v1」的收敛阶段。主要近期改动集中在：跨天守卫、仅检测型站（U2）、无按钮访问即签站（MTeam 系六站）、no-text 按钮站（NodeLoc）、按钮重现降级提醒（P25）、行内单站强制重试（.28）。

## 最近改动时间线（2026.09.07–09.08）

- **v2 重构**：被动 + 批量调度 + FAB 面板 + 贴吧多吧；unit 级独立冷却/状态；`match` 字段删除、页面归属由 `url` 推导。
- **.16 跨天守卫**：DOM 是加载时刻快照，跨天旧 DOM 会把昨日已签误写为今日 success → 引擎记 `PAGE_BORN_DATE`，执行前查跨天刷新（见 P23）。
- **.17 仅检测型 `detectOnly`**：U2 需人工验证码，只检测状态不自动点击（见 P24）。
- **.18/.19/.20 签到按钮重现降级提醒**：状态从单向成功快照改可逆，按钮重现 → 状态降级 `suspect`（失败-待确认）+ 页面级警示（toast/按钮描边/常驻横条）（见 P25）。
- **.21–.25 无按钮站批量接入**：MTeam / DigitalCore / HD-Space / Kufirc / 凤凰PT / Sportz Bar（访问即签）+ NodeLoc（Discourse no-text 图标按钮）（见 P21/P22/P26）。
- **.26 载体无关信号通用化**：`stateSignals`/`readEntryState` 重构，文本站自动翻译零回归，NodeLoc 纳入重现通道（见 P25/P27）。
- **.27 贴吧加四吧**：饥荒 / 战舰世界 / 深海迷航 / 缺氧（kw 为中文）。
- **.28 行内单站强制重试**：面板今日失败站 badge 悬停变「↻ 重试」，前台新标签无视冷却强制签到，完成不关标签。

## 活跃决策与考量

- **PTAutoCheckIn v2 并入策略**：v2 实测校准通过后合入 `PTAutoCheckIn.user.js`（改回 `@name PTAutoCheckIn`，递增版本号），删除 v1 旧文件。当前 v1（`2026.08.30.1`）暂保留。
- **P25 重现检测**：suspect（失败-待确认）不自动重签、不进批量，人工补签后任意访问自动转回 success。
- **「强制批量签到」「行内重试」有风控风险**：无视冷却重试站点，仅今日失败站提供，谨慎使用（见 P5/P19）。

## 下一步（按优先级）

1. **逐项实测 PTAutoCheckIn v2 校准清单**（见 `scripts/PTAutoCheckIn.md` 第 184 行起 20 项）：
   - 贴吧四吧（中文 kw 匹配、吧间互不误签）
   - 蜂巢 `successDetect`（按钮变已签稳定）
   - MTeam 系六站（实际首页 path、特征 16s 内出现、未登录 failed）
   - NodeLoc（点击签到、class 变 checked-in、重现检测）
   - HHCLUB（普通触发不再偶发失败）
   - U2（detectOnly 无点击无冷却）
   - 批量调度（断链 50s 跳过、中断恢复）
   - FAB 四皮肤、跨天守卫、行内重试
2. **BTSchoolHelper 待修 Bug**：时魔数值恒为 0（P2，`parseCommaIntSafe`→`parseCommaNumberSafe`）；命名不一致（P10）。
3. **BilibiliEnterFullscreen**：评估 `window.onload + 轮询` 升级 `MutationObserver`。
4. **新增/校准站点**：按 `conventions.md` 第 7 节清单继续补站。

## 待办追踪

- 完整任务清单见 [tasks/_index.md](./tasks/_index.md)；路线图见 [roadmap.md](./roadmap.md)。
- 现存 Bug 清单见 [pitfalls.md](./pitfalls.md)（P2、P10 为未修复的现存 Bug）。