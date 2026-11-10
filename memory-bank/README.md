# memory-bank 细路由（过渡版）

> 本文件是 AI 助手进入知识库的**细路由**：按「要做的动作」选文档。铁律、提交口径、常用命令的**单点在根 `AGENTS.md`**，本文件不复述。

## 检索纪律（三步）

1. `commands run kb.active` —— 先看最近会话滚动状态（在办专题切片，按最后活动倒序）
2. 回本 README 细路由，按任务选目录 / 文档
3. 不确定关键词时 `grep -rn "<词>" memory-bank/` 兜底

**禁止整读整个目录**（含 `pitfalls/`）—— 整读行为一旦回来，目录化就白做了；这是预算纪律，不是格式洁癖。

## 过渡态声明（重要，别把 agent 带进死路）

当前仍是**单文件事实源**：`projectbrief.md` / `productContext.md` / `activeContext.md` / `systemPatterns.md` / `techContext.md` / `progress.md` / `conventions.md` / `pitfalls.md`。
`pitfalls/` 等目录族将在后续波次（S07–S10）把条目逐条迁入；`pitfalls/` 现在只有 `_about.md` 与生成物 `_index.md`（空索引，属中间态）。
路由表**同时给出「现在去哪」与「迁入后去哪」**：中间态一律先按「现在去哪」走；「迁入后去哪」只作前瞻，不要去点还不存在的目录。

## 路由表（现在去哪 → 迁入后去哪）

| 我要… | 现在去哪（事实源） | 迁入后去哪（S07–S10） |
|---|---|---|
| 看项目范围 / 基石 / 仓库结构 | `projectbrief.md` | `architecture/` |
| 看项目为何存在 / 用户体验目标 | `productContext.md` | `architecture/` |
| 看当前焦点 / 最近改动 / 下一步 / 活跃决策 | `activeContext.md` | `active-context/`（按 `kb.active` 定位切片） |
| 看已实现 / 待办 / 现状 / 已知问题 | `progress.md` | `reports/` |
| 查架构 / 关键技术决策 / 组件关系 | `systemPatterns.md` | `architecture/` |
| 查技术栈 / 环境 / 依赖 / 约束 | `techContext.md` | `architecture/` |
| 改码前查坑 / 排障（症状→原因→对策） | `pitfalls.md`（P28 测试 / P32 凭据 / P33·P66·P69 HDHomeUI 等） | `pitfalls/`（按 `_index.md` 选类，再进单个主题文件） |
| 查铁律 / 约定 / 提交规范 / 检查清单 / 开发发布工作流 | `conventions.md` | `conventions/` |
| 查某个脚本的职责与用法 | `memory-bank/scripts/<脚本名>.md` | 不变 |
| 写 / 跑测试 | `tests/README.md` + `node tests/run-all.js` | `testing/baselines/`（基线快照） |
| 看计划 / 方案 | `docs/plans/` | 不变 |
| 查任务档案 | `memory-bank/tasks/`（`_index.md` + TASK001–020） | 不变 |

> 表没覆盖的：`grep -rn "<词>" memory-bank/` 兜底，别整读目录。

## 本项目特有落点（别走错）

- **计划**在 `docs/plans/`（HTML 制品），**不在** `memory-bank/plans/`；
- **脚本文档**在 `memory-bank/scripts/`：`PTAutoCheckIn.md` / `BTSchoolHelper.md` / `BilibiliEnterFullscreen.md` / `EnhanceVisitedLinks.md` / `HDHomeUI.md`，与 `src/*.user.js` 一一对应；
- **任务档案**在 `memory-bank/tasks/`，TASK001–020 **冻结**（正文零改动，死链靠 `grep` + `git log -- <旧路径>` 兜底）；
- 脚本速查表、约定、检查清单、测试约定、开发与发布工作流、HDHomeUI 两条铁律等**事实性内容**仍完整保存在 `conventions.md` 与上述脚本文档 / `pitfalls.md`，本文件只做路由、不复述。

## 一条不能丢的红线

`resources-do-not-track/`（私有站点另存为的整页网页）**永不被 Git 追踪**，其中的 passkey / authkey / token / cookie / uid **禁止以任何形式外泄**（不进回复、日志、截图、提交、issue、测试夹具、示例 HTML）；只描述结构、值一律脱敏为 `***`。详见 `conventions.md` 第 0.5 节与 `pitfalls.md` P32。

---
铁律（计划不改码 / 版本号 `@version` / 知识库同步）、提交信息规范、常用命令的**单点在根 `AGENTS.md`**；找它们直接看 AGENTS.md，本文件不复述。
