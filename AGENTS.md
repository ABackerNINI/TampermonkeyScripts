# AGENTS.md

> 面向 AI 助手的项目说明文件。本项目按 **Memory Bank 模式**维护持久化知识库（位于 `memory-bank/` 目录），AI 助手应在每次任务开始前读取记忆库，以在会话间无缝恢复上下文。

## 任务开始前：先读记忆库（必做）

**本项目的记忆在每次会话间会重置。** AI 助手唯一能依赖的跨会话上下文就是 `memory-bank/` 记忆库，必须按以下顺序阅读全部核心文件——不是可选项：

1. `memory-bank/README.md` —— 记忆库入口与文档索引
2. `memory-bank/projectbrief.md` —— 项目范围与目标（基石）
3. `memory-bank/productContext.md` —— 项目为何存在、解决什么问题
4. `memory-bank/systemPatterns.md` —— 系统架构与关键设计决策
5. `memory-bank/techContext.md` —— 技术栈、开发环境、约束
6. `memory-bank/activeContext.md` —— 当前工作焦点、最近改动、下一步
7. `memory-bank/progress.md` —— 已实现 / 待办 / 现状 / 已知问题
8. `memory-bank/tasks/_index.md` —— 任务清单（按状态分类）

> 深度参考文档（记忆库允许的「附加上下文」）按需阅读：`memory-bank/conventions.md`（代码约定）、`memory-bank/pitfalls.md`（易错点）、`memory-bank/scripts/*.md`（各脚本详解）。

## 项目速览

**TampermonkeyScripts** —— 个人自用的 Tampermonkey 用户脚本集合，覆盖 B 站、多个 PT 站与百度贴吧的自动化辅助功能。无构建步骤、无依赖包、无测试框架；脚本为单文件 `.user.js`，可直接安装到 Tampermonkey。远程仓库：`https://github.com/ABackerNINI/TampermonkeyScripts`；许可证 GNU GPL-3.0。

现有脚本（详见 `memory-bank/scripts/`）：

| 脚本 | 作用 |
|------|------|
| `src/PTAutoCheckIn-v2.user.js` | PT 多站点自动签到 v2（被动 + 批量 + FAB 面板 + 贴吧多吧） |
| `src/BTSchoolHelper.user.js` | BTSchool 种子列表高亮 + 快捷键滚动 |
| `src/BilibiliEnterFullscreen.user.js` | B 站 Enter 键全屏切换 |
| `src/EnhanceVisitedLinks.user.js` | 全局已访问链接样式增强 |

## 项目铁律（最高优先级，违反即视为任务未完成）

以下约定是 `memory-bank/conventions.md` 的核心条款，所有 AI 助手与开发者必须无条件遵守：

1. **计划不改码**：任务定位为「计划 / 分析 / 调研 / 设计」时，**只输出方案，禁止改动任何代码文件**。确需改码才能得出结论时先停下征询用户。
2. **等审核再提交**：AI 完成代码修改后，**禁止自动 `git commit` / `git push`**，一律由用户审核后决定。修改完毕应汇报改动并提示「请审核，确认后再提交」。
3. **版本号铁律**：修改**任何代码/元数据**必须同步递增脚本头 `@version`（格式 `YYYY.MM.DD.N`，跨天重置 `N`），并与代码改动放入**同一次提交**（纯注释、仅改 `memory-bank/` 文档除外）。详见 `memory-bank/conventions.md` 第 1 节。
4. **知识库同步铁律**：每次更新代码或项目文档后，**必须同步更新 `memory-bank/` 记忆库**中受影响条目，并与代码改动同次提交。改码却不同步知识库，等同改动没做完。详见 `memory-bank/conventions.md` 第 0.4 / 6 节。

## 常见任务入口

- **首次接触项目**：读 `memory-bank/projectbrief.md` + `memory-bank/README.md` 了解结构与脚本概览。
- **修改某个脚本**：读 `memory-bank/scripts/<脚本名>.md` + 源文件（`src/*.user.js`）。
- **动手写代码前**：读 `memory-bank/conventions.md`（约定）与 `memory-bank/pitfalls.md`（易错点），避免重踩历史 Bug。
- **排障/查现状**：优先查 `memory-bank/pitfalls.md` 的症状→原因对照表；其次看脚本内 `[ScriptName]` 日志。
- **规划改动**：参考 `memory-bank/tasks/` 中已登记的待办与方向。
- **更新记忆库**：被要求「更新记忆库」时，须复查 `memory-bank/` 全部文件，重点更新 `activeContext.md`、`progress.md` 与 `tasks/_index.md`。

## 记忆库维护规则

- 发现新的项目模式、关键决策、用户偏好时，记录到 `memory-bank/activeContext.md` 与 `memory-bank/conventions.md`（学习日志）。
- 新任务建立时在 `memory-bank/tasks/` 创建任务文件并登记到 `_index.md`；进度变更时同步更新任务文件的 subtask 表与进度日志。
- 任务完成/状态变更后同步更新 `memory-bank/progress.md` 与 `memory-bank/tasks/`。

详见 `memory-bank/conventions.md` 完整约定与 `memory-bank/scripts/` 各脚本文档。