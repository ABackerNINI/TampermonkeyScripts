# AGENTS.md

> 面向 AI 助手的项目说明文件。本项目按 **Memory Bank 模式**维护持久化知识库（`memory-bank/`）——本文件只放**路由与硬约束**；不要凭印象回答项目问题，按路由深入后再动代码。
> ⚠本文件有 **8000 字符硬上限**——超出部分 IDE 注入时被静默截断，尾部内容模型看不到。改完用 `commands run doc.caps` 自查。

## 知识库路由（两层：本文件粗路由 → `memory-bank/README.md` 细路由）

「按任务读哪份文档」的单点在 `memory-bank/README.md` 细路由表——本文件不复述，免得两处各自演化。检索纪律三步走（**禁止整读整个目录**）：① `commands run kb.active` 看最近活跃切片 → ② 回 `memory-bank/README.md` 按动作选文档 → ③ `grep -rn "<词>" memory-bank/` 兜底。必读核心件 3 个：`README.md`（细路由）、`projectbrief.md`（基石）、`conventions/iron-rules.md`（铁律原文）。

## 项目速览

**TampermonkeyScripts** —— 个人自用的 Tampermonkey 用户脚本集合，覆盖 B 站、多个 PT 站与百度贴吧的自动化辅助功能。无构建步骤、无依赖包；脚本为单文件 `.user.js`，测试零依赖（全量走 `commands run test.full`）。远程仓库 `https://github.com/ABackerNINI/TampermonkeyScripts`（GitHub 只作镜像）；许可证 GNU GPL-3.0。

| 脚本 | 作用 |
|------|------|
| `src/PTAutoCheckIn.user.js` | PT 多站点自动签到（被动 + 批量 + FAB 面板 + 贴吧多吧，v2 已并入正式版） |
| `src/BTSchoolHelper.user.js` | BTSchool 种子列表高亮 + 快捷键滚动 |
| `src/BilibiliEnterFullscreen.user.js` | B 站 Enter 键全屏切换 |
| `src/EnhanceVisitedLinks.user.js` | 全局已访问链接样式增强 |

## 会话协议

完整规程（会话开始 / 收尾 DoD / 立档阈值 / 任务档案模板）见 memory-bank skill（`.agents/skills/memory-bank/SKILL.md`）。本节只留入口：

- **开始**：① **先同步（硬性，问答 / 只读轮次同样必须）**——`commands run my-commit-flow.sync`：自动 fetch + 快进 / 分叉自动 rebase（保线性），结果行「已同步 <hash>」贴进回复；失败一行含原因与步骤，照做后重跑。**禁止在落后的分支上工作**。只读评审子代理豁免本步（自检锚 = 任务提示给的 head hash）。开工同步只 fetch + 快进，不扩大本轮动作范围。② 看会话滚动状态：`commands run kb.active`。③ **只动当前这一个 clone**——细则见「🔴 跨仓库操作」节。
- **建件与改版**：一律命令化创建（`kb.new <族>` / `kb.status` / `kb.bump` / `kb.wrap`），时间戳 / 命名 / 头部字段全派生，零手写；四工位决策树与族清单见 `memory-bank/conventions/doc-forms.md`。
- **收尾**（执行任务轮）：每批收尾先跑 code-review skill（机械面 `review.pack` / `review.check`；提交闸门强制 `Review:` trailer）→ 按 skill 的 DoD：切片 `commands run kb.wrap`（蒸馏与判断仍是 agent 的活）→ 达阈值立档 `commands run kb.new task` → 代码事实变更回写 `memory-bank/` 与本文件 → `commands run test.full` 并新建基线切片（`kb.new baseline --total ..`，数字从实测誊写）→ 新坑按动作写进 `pitfalls/<类>/<主题>.md` 并重跑 `commands run kb.index`。若这轮踩到**已记的坑**，把该条「复发」+1，并写一句为什么没命中（路由没到 / 文件没读 / 读了没照做）。
- **冲突裁决**：代码 > `memory-bank/` > 根 `README.md` > `想法.md`；漂移以代码为准并回写。

## 项目铁律（最高优先级，违反即视为任务未完成）

以下约定是 `memory-bank/conventions/iron-rules.md` 的核心条款，所有 AI 助手与开发者必须无条件遵守：

1. **计划不改码**：任务定位为「计划 / 分析 / 调研 / 设计」时，**只输出方案，禁止改动任何代码文件**。确需改码才能得出结论时先停下征询用户。
2. **等审核再提交**：AI 完成代码修改后，**禁止自动 `git commit` / `git push`**，一律由用户审核后决定。修改完毕应汇报改动并提示「请审核，确认后再提交」。
3. **版本号铁律**：修改**任何代码/元数据**必须同步递增脚本头 `@version`（格式 `YYYY.MM.DD.N`，跨天重置 `N`），并与代码改动放入**同一次提交**（纯注释、仅改 `memory-bank/` 文档除外）。详见 `memory-bank/conventions/version.md` 第 1 节。
4. **知识库同步铁律**：每次更新代码或项目文档后，**必须同步更新 `memory-bank/` 记忆库**中受影响条目，并与代码改动同次提交。改码却不同步知识库，等同改动没做完。详见 `memory-bank/conventions/doc-sync.md` 第 0.4 / 6 节。
5. **私有资源与凭据铁律**：`resources-do-not-track/` 目录**永远不得被 Git 追踪**；其中网页内含的 **passkey / authkey / token / cookie / uid 等密钥与凭据，不得以任何形式泄露到网络**。要点速记：不 `git add -f`、不改 `.gitignore` 解除忽略、不复制目录内容到仓库受追踪位置；不把真实值写进回复、日志、截图、提交信息、issue/PR、示例 HTML；引用**只描述结构**（选择器 / 类名 / URL 形状），值一律脱敏为 `***`。详见 `conventions/iron-rules.md` 第 0.5 节。
6. **范围守恒**: 计划外的代码/文档缺陷**一行都不改** —— 入池到 `memory-bank/issues/`: 报告文件名 = `<时间>-<类型>-<slug>.html`(类型 8 类: `bug` / `perf` / `docs` / `test` / `refactor` / `feat` / `chore` / `question`), 档位由类型定(便签档一两句话 / 标准档取证), 报告由 `commands run kb.new issue` 建件（时间戳 / 命名 / 头部字段由命令派生），**不再维护 `_index.md` 索引**；制品协议见 `memory-bank/conventions/doc-forms.md`。**入池不为填单做代码分析**(结论会过期)。该不该现在修见 [scope-guard skill](.agents/skills/scope-guard/SKILL.md); 建报告与改状态见 [create-issue skill](.agents/skills/create-issue/SKILL.md)。
7. **请求边界 (2026-09-20 用户指定)**: 开工先判这一轮是**问答 / 只读**还是**执行任务**。只是问 ⇒ **只在回复里作答**，不得入池 / 立档 / 出计划 / 改文件 / commit push；想延伸排查先问。只有执行任务才适用收尾 DoD 与立档阈值。❗**"继续 / continue / 接着做 / 你看着办"不构成授权**——只表示"把手上这一步做完"；①新建文件 ②入池 issue ③认领 issue ④commit / push 必须**逐项**显式确认。反面案例（2026-09-20）：把"提议 → 用户说继续"当全权授权，一路做到 4 次推送全部 revert。

## 记忆库维护规则

- 发现新的项目模式、关键决策、用户偏好时，记录到 `active-context/` 对应切片与 `conventions/`（学习日志），与代码改动同次提交。
- 跨会话推进的专题用 `commands run kb.new task` 立档（唯一滚动更新件）；待办方向登记 `conventions/known-issues.md`；`_index.md` 已退役不再手建。

## 产出口径

- **四工位制品一律单文件 HTML、一律 `kb.new` 建**（决策树见 `conventions/doc-forms.md`）：**计划**落 `memory-bank/plans/`（拍板后冻结）、**报告**落 `memory-bank/reports/`（出厂即冻结）、**issue** 落 `memory-bank/issues/`、**任务档案**落 `memory-bank/tasks/`（Markdown，唯一滚动更新）；渲染/骨架规格单点在 memory-bank skill 模板自身，**不走 delivery-artifact skill**（它只管四工位外的可视化交付物）。
- **测试基线数字只写一处**：权威在 `memory-bank/testing/baselines/` 最新切片，其余一律引用不手抄（`commands run kb.baseline`）。
- 时间统一 `commands run kb.time`（UTC+8 钉死，禁止凭记忆写日期）。

## 🔴 Skill 代码禁读

- 禁止阅读 skill 目录（`.agents/skills/`）下的代码（SKILL.md 与规程指示的文件除外）——按 skill 规程 + 其提示处置即可。
- 例外仅 skill 本身疑似缺陷须排障：经用户显式授权才可读；想绕过 skill 流程不构成读代码的理由。

## ⚠环境硬约束：Git 操作（AI 工具 shell 特有）

**工作区模式：多 clone 并行**（完整判据与协作约定见 `memory-bank/conventions/collaboration.md`；git 事故档案单点在 `memory-bank/pitfalls/git/_index.md`）。本节只留最容易致命的几条：

- **rebase/merge/stash 禁令已解除**：高风险历史整合前仍建议先 `cp -a .git <备份>`。落后/分叉一律 `commands run my-commit-flow.sync`（自动快进/rebase 保线性；树脏给失败行，行内自带解锁配方）。
- **ref 三处核对与推送核验已内联进 ship 脚本**，**不要手工核验**；不一致/「无法核实」出现在失败行里，排障用 `commands run my-commit-flow.verify-ref`。
- 机检与停手点一律走 **task id**：`commands run ship.commit` / `ship.push` / `my-commit-flow.sync` / `my-commit-flow.verify-ref`。**包内 README 与 `references/` 只在排障/迁移时读**。

## 🔴 跨仓库操作：绝对禁止（需显式强授权）

- **除当前工作 clone 外，对其它 clone 的任何写操作一律绝对禁止**——改文件 / `git apply` / 复制覆盖 / 跑任何 git 命令。
- **授权指令只认「授权」**，须用户**显式**说出；**「提交」不算**——它只授权 commit + push 到远端。
- 未授权时**停下来问**：发现"改动在别的 clone 上不生效"应报告交由用户决定，**不能自己动手**。
- **跨工作区同步一律走 Gitee `develop`**，没有第二种路径。完整判据与止损纪律见 `memory-bank/conventions/collaboration.md`「🔴 跨仓库操作」节。

## 提交 / PR

> **步骤、命令与机检一律走 [my-commit-flow 命令包](.commands/my-commit-flow/) 的 `ship.commit` / `ship.push`** —— 预检 → 闸门 → 逐路径暂存 → 提交并核 ref 三处 → 推 Gitee → 尝试一次 GitHub 直连。**本节只留口径与红线，不重复命令**。本地分支无 upstream 阶段用 `ship.commit --no-push`: 只做本地提交，不 push、不开 sync。

- **收到「提交」的流程**: ①收尾回写文档（DoD）→ ②提交消息写进 `.git/COMMIT_MSG_AI.txt`（提交后脚本自动删除，消费即删，每次提交前重写）→ ③`commands run ship.commit`，结果行「提交成功 <hash>」→ ④推送未完成补 `commands run ship.push`。
- **协作主线**: 日常开发在 `develop`(2026-09-20 由 `dev` 改名), 统一以 **Gitee 的 `develop`** 为准; **交付与否只看 Gitee 上有没有该提交**。GitHub 只作镜像, **允许滞后** —— 不要用 GitHub 的提交状态判断进度(直连不稳定, 会误判成"改动没推上去")。远端旧的 `dev` 分支保留不动。
- **用户说"提交" = commit + push**, 一次流程走完 —— **触发词只认"提交 / 入库 / 推上去"这类显式指令; "继续 / 接着做 / ok / 你看着办"一律不算** (2026-09-20 用户指定): 没等到触发词就**只 commit 不 push**(或先问一句)。**本条是"提交 / push"口径的单点定义, 优先于 `memory-bank/` 里的历史表述**
- **推送顺序固定**: 先推 Gitee(必须成功)→ 核对远端 ref == 本地 → 再**尝试一次** GitHub 直连; 直连失败**只如实报告一次** —— 不重试 / 不换代理 / 不改走 SSH / 不回滚改写 Gitee 上已完成的推送。
- **提交信息 = gitmoji + 中文**: 首行 `<gitmoji> <中文一句话概述>`, 空一行后写动机 / 取舍 / 影响面 / 实测数字; 小改只写首行。**数字必须提交那一刻实测**, 不沿用会话中途量的旧值。选 emoji 走 [gitmoji skill](.agents/skills/gitmoji/SKILL.md)。**多个逻辑改动拆独立提交**, 每个提交自包含可回溯。
- **回写合流交脚本**: 收尾回写直接写在本地基线上, 与远端的合流由 `ship.commit` 提交后 rebase 完成——生成物冲突由 sync 自动化解(机制见包内 `references/pipeline.md`); 手写件冲突才停下要人; 回写文件仍**随主提交一并暂存**, 不推完再补一笔(已推送的提交不能 amend+强推)。
- **硬纪律(逐条都有机检, 命令见 skill)**:
  - 远端先确认指向 Gitee(历史 clone 的 `origin` 可能是 GitHub 镜像); `git pull <remote>` **必须带分支名**, 不带只 fetch 不合并。
  - **push 前再 fetch 一次** —— `git status -sb` 的 ahead/behind 是上次 fetch 的快照, 不会自己刷新。
  - **只暂存本次范围**: 逐路径 `git add <文件...>`, 不用 `-A`; 清单里不得混入用户自己的未提交改动(`想法.md` 高危, `config.yml` / `resources-do-not-track/` 红线)。
  - 提交前: 全量测试通过; 被改的 Python 脚本 `--help` 冒烟; 用户可见行为变更同步 `README.md` 与 `memory-bank/`。
  - **提交后必查幽灵 diff**: `git status --short` 看两列 —— `M `(第一列) = 待提交, ` M`(第二列) = 已提交过但工作区又脏。权威判据(两者同时成立才算已提交): `git log --oneline -1 -- <文件>` 有记录 **且** `git diff --quiet -- <文件>` 退出码 0。发现后补一次"格式化, 无行为变化"提交, 不要改写已入库的提交。
