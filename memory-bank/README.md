# memory-bank 细路由（过渡版）

> 本文件是 AI 助手进入知识库的**细路由**：按「要做的动作」选文档。铁律、提交口径、常用命令的**单点在根 `AGENTS.md`**，本文件不复述。

## 检索纪律（三步）

1. `commands run kb.active` —— 先看最近会话滚动状态（在办专题切片，按最后活动倒序）
2. 回本 README 细路由，按任务选目录 / 文档
3. 不确定关键词时 `grep -rn "<词>" memory-bank/` 兜底

**禁止整读整个目录**（含 `pitfalls/`）—— 整读行为一旦回来，目录化就白做了；这是预算纪律，不是格式洁癖。

## 坑档切片已完成（重要，别把 agent 带进死路）

原 `pitfalls` 单文件**已删除**（git 历史即冷库，不留墓碑/存根）；**P1–P79 全 79 条**已按八类切片落盘到 `pitfalls/<类>/`，正文逐字节照搬原文。
改码前查坑 / 排障统一从 `pitfalls/_index.md`（生成物，由 `commands run kb.index` 产出，**不要手改**）进入，按「要做的动作」选类再进单文件；全量归类清单在 `pitfalls/_about.md`「归类清单」段。
路由表**同时给出「现在去哪」与「迁入后去哪」**：坑档一律按「现在去哪」走；「迁入后去哪」只作后续波次的前瞻，指向尚不存在的目录时不要去点。本步（S08）已把 `conventions.md` 拆为 `conventions/`、四常青件蒸馏进 `projectbrief.md` 与 `architecture/`；S09 又把 `activeContext.md` 的「当前工作焦点」按专题拆进 `active-context/`，并将 `progress.md` 未修项归位到 `conventions/known-issues.md`、`tasks/_index.md` 退役（TASK001–020 冻结保留），对应行的「现在去哪」与「迁入后去哪」均标为已完成（三段过期流水由 git 历史兜底，不搬运）。

## 路由表（现在去哪 → 迁入后去哪）

| 我要… | 现在去哪（事实源） | 迁入后去哪（已完成） |
|---|---|---|
| 看项目范围 / 基石 / 仓库结构 | `projectbrief.md` | 仍为 `projectbrief.md`（基石保留，S08） |
| 看项目为何存在 / 用户体验目标 | `projectbrief.md`（为何存在 / 解决的问题 / 用户体验目标） | 已完成 → `projectbrief.md`（S08） |
| 看当前焦点 / 最近改动 / 下一步 / 活跃决策 | `active-context/`（按 `kb.active` 定位切片） | 已完成 → `active-context/`（按 `kb.active` 定位切片，S09） |
| 看已实现 / 待办 / 现状 / 已知问题 | `conventions/known-issues.md` | 已完成 → `conventions/known-issues.md`（S09） |
| 查架构 / 关键技术决策 / 组件关系 | `architecture/system-patterns.md` | 已完成 → `architecture/system-patterns.md`（S08） |
| 查技术栈 / 环境 / 依赖 / 约束 | `architecture/tech-context.md` + `projectbrief.md`（关键约束） | 已完成 → `architecture/tech-context.md`（S08） |
| 改码前查坑 / 排障（症状→原因→对策） | `pitfalls/_index.md`（生成物索引，全 79 条按八类落盘） | `pitfalls/<类>/`（按下方八类细路由选类再进单文件） |
| 查铁律 / 约定 / 提交规范 / 检查清单 / 开发发布工作流 | `conventions/`（按主题分件） | 已完成 → `conventions/`（S08） |
| 查某个脚本的职责与用法 | `memory-bank/scripts/<脚本名>.md` | 不变 |
| 写 / 跑测试 | `tests/README.md` + `node tests/run-all.js` | `testing/baselines/`（基线快照） |
| 看计划 / 方案 | `docs/plans/` | 不变 |
| 查任务档案 | `memory-bank/tasks/`（TASK001–020） | 不变 |

> 表没覆盖的：`grep -rn "<词>" memory-bank/` 兜底，别整读目录。

## pitfalls/ 八类细路由（P1–P79 全 79 条已落盘）

按「要做的动作」选类，再进单个主题文件；文件名带 P 编号便于守恒核对。全量 79 条归类清单在 `pitfalls/_about.md`「归类清单」段。

| 类目目录 | 治什么病 | 已落条目 |
|---|---|---|
| `pitfalls/userscript/` | 脚本引擎 / 元数据 / IIFE / GM API / 事件生命周期 / 通用 JS 陷阱 / 状态机与渲染层 / 预算超时 | P4·P7–P10·P28·P29·P43·P44·P47 |
| `pitfalls/site-adapt/` | PT 站点签到建模 / 表格与字段解析 / 落地页 / 状态判定 / 页面归属 / favicon | P1–P3·P5·P6·P11·P15·P16·P18·P19·P21–P27·P31 |
| `pitfalls/css-theme/` | HDHomeUI 换肤 / FAB 皮肤 / CSS 规则 / 布局 / 16px SVG 图标 / 列结构契约 | P17·P33–P40·P42·P45·P46·P50–P69·P75–P79 |
| `pitfalls/tests/` | 测试基建 / 仿真 / 断言与判据 / 原型派生 / CI 度量 | P14·P41·P48·P49·P70–P74 |
| `pitfalls/git/` | 提交 / 分支 / 版本号 | P20 |
| `pitfalls/kb/` | 知识库 / AI 协作纪律 | P13 |
| `pitfalls/docs/` | 文档漂移 / 约定 / 编码与仓库卫生 | P12 |
| `pitfalls/security/` | 凭据 / 私有资源 / 仿真站安全审计 | P30·P32 |

> `pitfalls/_index.md` 是生成物（由 `commands run kb.index` 产出，不要手改）；上表目录即各类条目件的实际落点，按类进单文件。

## 本项目特有落点（别走错）

- **计划**在 `docs/plans/`（HTML 制品），**不在** `memory-bank/plans/`；
- **脚本文档**在 `memory-bank/scripts/`：`PTAutoCheckIn/` / `BTSchoolHelper.md` / `BilibiliEnterFullscreen.md` / `EnhanceVisitedLinks.md` / `HDHomeUI.md`，与 `src/*.user.js` 一一对应；
- **任务档案**在 `memory-bank/tasks/`，TASK001–020 **冻结**（正文零改动，死链靠 `grep` + `git log -- <旧路径>` 兜底）；
- 脚本速查表、约定、检查清单、测试约定、开发与发布工作流、HDHomeUI 两条铁律等**事实性内容**仍完整保存在 `conventions/`（按主题分件）与上述脚本文档 / `pitfalls/_index.md`，本文件只做路由、不复述。

## 一条不能丢的红线

`resources-do-not-track/`（私有站点另存为的整页网页）**永不被 Git 追踪**，其中的 passkey / authkey / token / cookie / uid **禁止以任何形式外泄**（不进回复、日志、截图、提交、issue、测试夹具、示例 HTML）；只描述结构、值一律脱敏为 `***`。详见 `conventions/iron-rules.md` 第 0.5 节与 `pitfalls/_index.md` P32。

---
铁律（计划不改码 / 版本号 `@version` / 知识库同步）、提交信息规范、常用命令的**单点在根 `AGENTS.md`**；找它们直接看 AGENTS.md，本文件不复述。
