# [TASK016] - 测试基础设施与全面测试

**Status:** In Progress
**Added:** 2026-09-18
**Updated:** 2026-09-18

## Original Request

> 将测试用的 scripts 移入 tests 目录, 为之后全面测试铺路

## Thought Process

**问题**：本仓库刻意保持「无 `package.json` / 无 npm / 无构建 / 无测试框架」，导致测试脚本无处安放——`tests/check-ptac-budget.js` 之前放在顶层 `scripts/`，与「生产脚本只在 `src/`、项目文档在 `memory-bank/`」的既有结构不匹配，且没有任何「怎么加下一个测试」的约定。全面测试的第一障碍不是缺断言，而是**缺约定**。

**方向**：不引入测试框架（会破坏仓库的无依赖特性），而是定一套**零配置、零依赖**的约定：
- `tests/*.js` 顶层每个文件 = 一个可独立运行的测试，**以退出码表达结果**（0 通过 / 非 0 失败）——这样任何测试框架都能接，也可以完全不用框架；
- `tests/run-all.js` 极简运行器自动发现并逐个跑，新测试**不需要改运行器**；
- `tests/lib/`（共享辅助代码）、`tests/fixtures/`（数据样本）不被当作测试执行；
- 下划线开头 = 临时草稿，不参与。

**最大的技术障碍**：生产脚本是**单文件 IIFE + 无 DOM 环境**，无法直接 `require`。已验证的解法是「把源文件里**自包含**的代码块切出来，写进临时模块再 `require`」——生产文件一行不改，因此不违反 `conventions.md` §8.2「禁止为测试留通道」。反过来，若某段逻辑**无法**被切出来（闭包引用了 IIFE 的其它局部变量），那就是生产代码该重构的信号（§8.1 纯函数化），**不是**加 `window.xxx` 后门的理由。该技法已写入 `tests/README.md`。

## Implementation Plan

- [x] 把 `scripts/check-ptac-budget.js` 移入 `tests/`，删除空目录 `scripts/`
- [x] 更新全部引用（`memory-bank/` 10 个文件 + `src/PTAutoCheckIn.user.js` 注释 3 处 + 工作记忆 2 处，共 29 处）
- [x] `tests/run-all.js` 零依赖运行器（`--list` / `-v` / 参数转发；失败时打印子进程输出并以 1 退出）
- [x] `tests/README.md` 测试约定（运行 / 命名 / 三条纪律 / 「如何测 userscript」技法 / 现有测试 / 待铺的路）
- [x] 同步 `conventions.md` §8.1/§7/§10、`techContext.md`、`projectbrief.md` 仓库结构、`README.md`
- [ ] 场景矩阵回归脚本（原 TASK015 的 T14）——见下
- [ ] 纯函数抽取（原 TASK015 的 T13）——抽取后 `check-ptac-budget.js` 的 C 段正则检查可改为直接 import
- [ ] BTSchoolHelper `parseTorrentTable` 回归（可先为现存 Bug P2/P10 写失败断言，再修生产代码）
- [ ] 仓库元数据一致性检查（`@version` 格式 / `@match` 与 `SITES` 域名对齐 / `@grant` 与用到的 GM API 匹配）——TASK010 前置

## 候选测试清单（按价值排序）

1. **PTAutoCheckIn 场景矩阵**（每项对应一个已发现缺陷，防重构回归）：
   - 慢加载（元素 8s 才出现）→ 终态**不是** `failed`
   - 冷却 / `detect_only` / `suspect` 访问 → 40s 后状态**未被改写**（P28 的 F1 回归）
   - 双标签并发（A 写 failed、B 写 success）→ `success` 不被覆盖
   - 慢跳转（点击后 1.5s 才 `pagehide`）→ 不误判 failed
   - 预算不变式：遍历全部 unit，最坏内层预算 ≤ 外层
   - 既有行为基线：跨天守卫（P23）、P25 重现降级/恢复、P27 文本站信号等价性
2. **纯函数抽取**（前置）：状态阶梯守卫、预算计算、`deriveStateSignals`/`readEntryState`、超时分类。
3. **BTSchoolHelper 解析器回归**：用真实样本 HTML 断言列定位与字段值。
4. **元数据一致性**：见上。

## 决策与边界

- **不引入测试框架 / 不建 `package.json`**：保持「无依赖、无构建」是仓库的既有特性（`techContext.md` 明确记录）；退出码约定让将来接框架也不受阻。
- **不把测试写进 `src/`**：`src/` 只放生产脚本与真实页面样本。
- **不为测试改生产代码 / 不留测试通道**：见 `conventions.md` §8.2/§8.3；需要测内部逻辑时按 §8.1 重构为纯函数。
- **fixture 归属待定**：`src/BTSchoolTorrentsTableSample.html` 目前留在 `src/`（历史原因，与脚本同目录便于对照）。若第 3 项落地，建议迁到 `tests/fixtures/` 并同步更新 `conventions.md` §7、`techContext.md`、`scripts/BTSchoolHelper.md` 的引用——**需用户确认**（会改动多个文档引用）。

## Progress Tracking

**Overall Status:** In Progress - 40%（约定与运行器已就位；具体测试用例待补）

### Subtasks

| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 16.1 | `scripts/` → `tests/` 迁移 + 全量引用更新 | Completed | 2026-09-18 | 29 处 / 14 个文件；`scripts/` 已删除 |
| 16.2 | `tests/run-all.js` 零依赖运行器 | Completed | 2026-09-18 | 自动发现 + `--list`/`-v`/参数转发；已验证失败路径（故意失败 → 打印输出 + exit 1） |
| 16.3 | `tests/README.md` 测试约定 | Completed | 2026-09-18 | 含「如何测 userscript」技法与待铺的路 |
| 16.4 | 知识库同步（conventions §8.1/§7/§10、techContext、projectbrief、README） | Completed | 2026-09-18 | — |
| 16.5 | PTAutoCheckIn 场景矩阵回归脚本 | Pending | - | 原 TASK015 T14；6 类场景 |
| 16.6 | 纯函数抽取（阶梯/预算/信号/超时分类） | Pending | - | 原 TASK015 T13；16.5 的前置 |
| 16.7 | BTSchoolHelper 解析器回归 + P2/P10 失败断言 | Pending | - | 需先定 fixture 归属 |
| 16.8 | 仓库元数据一致性检查 | Pending | - | TASK010 前置 |

## Progress Log

### 2026-09-18

- 用户要求把测试用 scripts 移入 `tests/` 为全面测试铺路。
- 迁移 `scripts/check-ptac-budget.js` → `tests/check-ptac-budget.js`（该文件此前**未被 git 跟踪**，故为普通移动而非 `git mv`），删除空目录 `scripts/`。
- 全量更新引用 29 处 / 14 个文件：`memory-bank/` 10 个（含 `scripts/PTAutoCheckIn.md` 4 处）、`src/PTAutoCheckIn.user.js` 注释 3 处、`.workbuddy-ai/memory/` 2 处、测试文件自身 2 处。用一次性 Node 脚本做机械替换（比逐处 `Edit` 更可靠），改完 grep 复核无残留。
- 新增 `tests/run-all.js`（零依赖运行器）与 `tests/README.md`（约定 + 技法 + 候选清单）。
- 验证：`node tests/run-all.js` → 1 个测试通过（exit 0）；`--list` 正确；**故意造一个失败测试验证运行器的失败路径**（打印子进程输出 + exit 1 + 汇总列出失败项）后删除。
- 知识库同步：`conventions.md` §8.1（测试统一放 `tests/`、零依赖、子目录约定）/§7（跑 `run-all.js`）/§10（自检步骤）、`techContext.md`（测试条目 + 开发环境）、`projectbrief.md`（仓库结构块）、`README.md`（快速提醒 9 + 如何阅读）。
- **未提交**（`conventions.md` §0.2）：待用户审核。
- **注**：`src/PTAutoCheckIn.user.js` 仅改动**注释中的路径**（`scripts/` → `tests/`），属「纯注释」豁免，故 `@version` 仍为 `2026.09.18.1` 未再递增。
