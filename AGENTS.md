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
| `src/PTAutoCheckIn.user.js` | PT 多站点自动签到（被动 + 批量 + FAB 面板 + 贴吧多吧，v2 已并入正式版） |
| `src/BTSchoolHelper.user.js` | BTSchool 种子列表高亮 + 快捷键滚动 |
| `src/BilibiliEnterFullscreen.user.js` | B 站 Enter 键全屏切换 |
| `src/EnhanceVisitedLinks.user.js` | 全局已访问链接样式增强 |

## 项目铁律（最高优先级，违反即视为任务未完成）

以下约定是 `memory-bank/conventions.md` 的核心条款，所有 AI 助手与开发者必须无条件遵守：

1. **计划不改码**：任务定位为「计划 / 分析 / 调研 / 设计」时，**只输出方案，禁止改动任何代码文件**。确需改码才能得出结论时先停下征询用户。
2. **等审核再提交**：AI 完成代码修改后，**禁止自动 `git commit` / `git push`**，一律由用户审核后决定。修改完毕应汇报改动并提示「请审核，确认后再提交」。
3. **版本号铁律**：修改**任何代码/元数据**必须同步递增脚本头 `@version`（格式 `YYYY.MM.DD.N`，跨天重置 `N`），并与代码改动放入**同一次提交**（纯注释、仅改 `memory-bank/` 文档除外）。详见 `memory-bank/conventions.md` 第 1 节。
4. **知识库同步铁律**：每次更新代码或项目文档后，**必须同步更新 `memory-bank/` 记忆库**中受影响条目，并与代码改动同次提交。改码却不同步知识库，等同改动没做完。详见 `memory-bank/conventions.md` 第 0.4 / 6 节。
5. **私有资源与凭据铁律**：`resources-do-not-track/` 目录**永远不得被 Git 追踪**；其中网页内含的 **passkey / authkey / token / cookie / uid 等密钥与凭据，不得以任何形式泄露到网络**。详见 `memory-bank/conventions.md` 第 0.5 节。要点速记：
   - 不 `git add -f`、不改 `.gitignore` 解除忽略、不复制目录内容到仓库受追踪位置（含 `src/`、`tests/`、`memory-bank/`）。
   - 不得把其中的真实值写进对话回复、日志、截图、提交信息、issue/PR、Gist、云端笔记、测试夹具、示例 HTML。
   - 需要引用时**只描述结构**（选择器 / 类名 / URL 形状），值一律脱敏为 `***`；需要样本入库时先复制一份并手工清除凭据。
6. **范围守恒**: 计划外的代码/文档缺陷**一行都不改** —— 入池到 `memory-bank/issues/`: 报告文件名 = `<时间>-<类型>-<slug>.html`(类型 8 类: `bug` / `perf` / `docs` / `test` / `refactor` / `feat` / `chore` / `question`), 档位由类型定(便签档一两句话 / 标准档取证), `_index.md` 登记类型+简述+链接(生成物, 重跑脚本更新)。**入池不为填单做代码分析**(结论会过期)。该不该现在修见 [scope-guard skill](.agents/skills/scope-guard/SKILL.md); 建报告与改状态见 [create-issue skill](.agents/skills/create-issue/SKILL.md)。
7. **请求边界 (2026-09-20 用户指定)**: 开工先判这一轮是**问答 / 只读**还是**执行任务**。
   - 用户只是问("能不能 X""是什么""怎么看""有没有") ⇒ **只在回复里作答**, 不得入池 issue、
     不得立档 `tasks/`、不得产出计划文档、不得改动任何文件、不得 commit / push。
     **想延伸排查(跑测试、跑冒烟、写探针、做实验)先问**, 别把"回答"做成"交付"。
   - 只有**执行任务**那一类才适用上面的收尾 DoD 与立档阈值。
   - ❗**"继续 / continue / 接着做 / 你看着办"不构成授权** —— 它只表示"把你手上这一步做完",
     不表示"可以开始下一件更大的事"。下面四类动作必须**逐项**拿到显式确认:
     ①新建文件(计划文档 / 任务档案 / 报告) ②入池 issue ③认领 issue(置 `In Progress`)
     ④commit / push。
   - 踩过的坑 (2026-09-20): 用户只问"本项目能启用 Playwright 吗", 代理一路做到入池 + 认领 +
     出计划 + 4 次推送, 最后全部 revert。根因是把"提议 → 用户说继续"当成了全权授权, 又拿
     「收尾 DoD / 立档阈值 / 入池」三条规则给自己加码 —— 那三条的前提都是"正在执行任务"。

## 常见任务入口

- **首次接触项目**：读 `memory-bank/projectbrief.md` + `memory-bank/README.md` 了解结构与脚本概览。
- **修改某个脚本**：读 `memory-bank/scripts/<脚本名>.md` + 源文件（`src/*.user.js`）。
- **动手写代码前**：读 `memory-bank/conventions.md`（约定）与 `memory-bank/pitfalls.md`（易错点），避免重踩历史 Bug。
- **排障/查现状**：优先查 `memory-bank/pitfalls.md` 的症状→原因对照表；其次看脚本内 `[ScriptName]` 日志。
- **规划改动**：参考 `memory-bank/tasks/` 中已登记的待办与方向。
- **更新记忆库**：被要求「更新记忆库」时，须复查 `memory-bank/` 全部文件，重点更新 `activeContext.md`、`progress.md` 与 `tasks/_index.md`。
- **计划产出**: 列计划时使用 `delivery-artifact` skill 产出文档, 将计划文档放入 `docs/plans/` 中; **格式一律为单文件 HTML (`.html`), 不使用 Markdown (`.md`)** —— `docs/plans/` 下的计划文档若出现 `.md` 即为违规, 需转为 HTML; 命名统一为"日期-时间-标题", 如 `26-09-17-0906-improve-webui-plan.html`, 意思为"26年9月17日上午9点6分的改进webui计划", 方便检索, 注意需通过命令获取当前准确的日期和时间, 不要靠记忆!
- **提交 / 推送 (commit + push)** | [my-commit-flow skill](.agents/skills/my-commit-flow/SKILL.md) (口径在本文件「提交 / PR」节) |

## 记忆库维护规则

- 发现新的项目模式、关键决策、用户偏好时，记录到 `memory-bank/activeContext.md` 与 `memory-bank/conventions.md`（学习日志）。
- 新任务建立时在 `memory-bank/tasks/` 创建任务文件并登记到 `_index.md`；进度变更时同步更新任务文件的 subtask 表与进度日志。
- 任务完成/状态变更后同步更新 `memory-bank/progress.md` 与 `memory-bank/tasks/`。

详见 `memory-bank/conventions.md` 完整约定与 `memory-bank/scripts/` 各脚本文档。

## 提交 / PR

> **步骤、命令与机检脚本一律走 [my-commit-flow skill](.agents/skills/my-commit-flow/SKILL.md)** —— 预检 → 闸门 → 逐路径暂存 → 提交并核 ref 三处 → 推 Gitee → 尝试一次 GitHub 直连 → 查幽灵 diff(脚本: `preflight.py` / `commit.py` / `verify_ref.py` / `push.py`)。**本节只留口径与红线, 不重复命令**。

- **协作主线**: 日常开发在 `dev`, 统一以 **Gitee 的 `dev`** 为准; **交付与否只看 Gitee 上有没有该提交**。GitHub 只作镜像, **允许滞后** —— 不要用 GitHub 的提交状态判断进度(直连不稳定, 会误判成"改动没推上去")。
- **用户说"提交" = commit + push**, 一次流程走完 —— **触发词只认"提交 / 入库 / 推上去"这类显式指令; "继续 / 接着做 / ok / 你看着办"一律不算** (2026-09-20 用户指定): 没等到触发词就**只 commit 不 push**(或先问一句)。**本条是"提交 / push"口径的单点定义, 优先于 `memory-bank/` 里的历史表述**
- **推送顺序固定**: 先推 Gitee(必须成功)→ 核对远端 ref == 本地 → 再**尝试一次** GitHub 直连; 直连失败**只如实报告一次** —— 不重试 / 不换代理 / 不改走 SSH / 不回滚改写 Gitee 上已完成的推送。
- **提交信息**: 中文, **一句话概述 + 详细描述** —— 首行说清"改了什么 / 为什么"(参照 `git log` 风格), 空一行后写动机 / 取舍 / 影响面 / 实测数字; 单句能说清的小改只写首行。**数字必须提交那一刻实测**, 不沿用会话中途量的旧值。
- **硬纪律(逐条都有机检, 命令见 skill)**:
  - 远端先确认指向 Gitee(历史 clone 的 `origin` 可能是 GitHub 镜像);`git pull <remote>` **必须带分支名**, 不带只 fetch 不合并。
  - **push 前再 fetch 一次** —— `git status -sb` 的 ahead/behind 是上次 fetch 的快照, 不会自己刷新。
  - **只暂存本次范围**: 逐路径 `git add <文件...>`, 不用 `-A`; 清单里不得混入用户自己的未提交改动(`想法.md` 高危, `config.yml` 红线)。
  - 提交前: 全量测试通过; 改过的 Python 先过 `yapf -i`; 用户可见行为变更同步 `README.md` 与 `memory-bank/`。
  - **提交后必核 ref 三处**(`HEAD` == `refs/heads/<branch>` == loose/packed-refs), 不要只看 commit 输出 —— 见下节。
  - **提交后必查幽灵 diff**: `git status --short` 看两列 —— `M `(第一列) = 待提交, ` M`(第二列) = 已提交过但工作区又脏。权威判据(两者同时成立才算已提交): `git log --oneline -1 -- <文件>` 有记录 **且** `git diff --quiet -- <文件>` 退出码 0。发现后补一次"格式化, 无行为变化"提交, 不要改写已入库的提交。
