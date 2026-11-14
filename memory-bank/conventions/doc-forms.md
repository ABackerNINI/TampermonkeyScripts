# 计划 / 报告制品协议（doc-forms）
> 摘要: 计划/方案与 issue 报告的落点、建件、命名、meta 四项、变更记录 R 行、认领链双向声明、状态词表与 HTML 通用禁律, 是「制品协议」单点
> 触发: 写计划, 建 issue 报告, 改 meta, 翻状态, 填 Refs, 校验制品协议

## 1. 落点（事实源）

- **计划 / 方案**一律落 `docs/plans/`, 单文件 `.html` 制品 —— **不是** `memory-bank/plans/`; 计划 HTML 是成文那天的静态快照, 执行进度不回写改版。
- **issue 报告**落 `memory-bank/issues/`。报告类型 8 类: `bug` / `perf` / `docs` / `test` / `refactor` / `feat` / `chore` / `question`。
- 报告两档: **便签档**(一两句话: 现象 + 位置 + 可选一句建议) / **标准档**(取证: 现象与场景 · 证据原文 · 影响面 · 定位锚点); 档位由类型定, `--tier` 可显式覆盖(如 test 失败用例用 standard)。入池只为「别人能直接开工」而写, 不为填满字段而写。
- 人找 issue 走 `commands run kb.nav`(现算台账, 与索引零耦合); agent 走 `grep -rn "<词>" memory-bank/issues/`。

## 2. 建件（命令派生）

- 报告由 `commands run kb.new issue <slug> --type … --title … --summary …` 建件: 时间戳 / 命名 / 头部字段 / 封面状态徽标全由命令派生, 模板零 SLOT; 目标已存在即 rc=1 不覆盖。
- **不再维护 `_index.md` 索引**: issues 的 `_index.md` 已退役(开放池无 agent 消费者), `conventions/` 下同样不放 `_about.md` / `_index.md`; 查重靠时间戳 slug 与 grep, 导航靠 `kb.nav` 现算。
- 时间统一 `commands run kb.time`(UTC+8 钉死, 与机器时区无关, **禁止凭记忆写日期**); `kb.new` 经时间单点自动取时, 手写带日期文件才手工取。
- 旧 `--dir` / `--root` / `--project` 可移植性参数已退役, issues 目录固定 `memory-bank/issues/`。

## 3. 命名

- 标题用 `日期-时间-标题`; HTML 文件名用 `<时间>-<类型>-<slug>.html`。
- 计划例: `docs/plans/26-09-17-0906-improve-webui-plan.html`; issue 例: `memory-bank/issues/26-09-19-2359-docs-readme-drift.html`。
- 时间前缀天然区分同 slug 的多次入池, 不靠序号; `doc-topic` 跨形态串联主键默认 = slug, 同一专题多条 issue 须显式给同一个 `--topic`。

## 4. meta 四项（现有计划 HTML 实测值）

- `<meta name="doc-added" content="26-11-11-0210">` —— 建档时间。
- `<meta name="doc-updated" content="26-11-11-0237">` —— 末次修订时间, 与 R 行同步抬。
- `<meta name="doc-status" content="Open">` —— 任务档案状态(词表见 §7)。
- `<meta name="doc-refs" content="">` —— 认领链声明位, 空值合法; 与既有计划/档案相关时填仓库根相对路径。
- 另 **issue 报告**有 `<meta name="issue-status">`, 与封面状态徽标 `<span class="badge">` **两处一起改**。
- 头部字段由 `kb.new` 派生, 缺 `doc-topic` 会让该 issue 从专题视图静默漏掉(守卫判红)。

## 5. 变更记录 R 行

- 文档每次修订在变更记录追加一行 `R1` / `R2` …, 附时间 + 一句话缘由(例 `R1 · 26-11-11-0237 用户审核后拍板 D5–D8 …`), 同步抬 `doc-updated`; 不覆写旧行。
- 时间取本机时间命令实测, 不取上下文日期。

## 6. 认领链双向声明

- 引用他件(issue / 计划 / 报告 / 基线切片 / 坑档)写 `**Refs:**` 行: 值 = **仓库根相对路径**, **多目标一律英文逗号、全写一行**; 用 `·` / 顿号 / 分号当分隔符会被整串当成单一路径判红。
- HTML 侧用 `doc-refs` meta 填同样的仓库根相对路径(多目标英文逗号)。
- **每个被引目标必须反向声明本档案**(HTML `doc-refs` meta / md `**Refs:** <档案路径>` 行); **单向链提交闸门 `gen_doc_map --check` 判红**。
- 协议单点在本文件; `create-issue` 与 `memory-bank` 两个 skill 的 doc-forms 链接指回这里, 本文件不复述它们的正文。

## 7. 状态词表

- **任务档案 `**Status:**`** 仅 4 个英文词: `In Progress` / `Open` / `Done` / `Dropped`; 守卫正则 + `check_doc_templates` 按词表校验, 写成中文「完成」或加前缀(`✅ 完成`)会判**非法状态行**。
- **issue 状态 5 词表**(封面徽标 + `issue-status` meta 两处一致): `Open`(未修待排期, 新建默认) / `In Progress`(已被用户指派或已批准的计划认领) / `Done`(已修并验证, 旧词 `Fixed`) / `Dropped`(决定不修, 旧词 `WontFix`) / `Superseded`(与他件重复或被取代, 旧词 `Duplicate`)。
- **旧词映射**: `Pending`→`Open` / `Completed`→`Done` / `Abandoned`→`Dropped`。
- 改状态唯一入口 `commands run kb.status <件> <新状态>`: 两处状态一起改、追加一行状态变更日志, 幂等(同状态翻转不抬时间戳), 词表外值直接拒绝。

## 8. HTML 通用禁律与版式单点

- 单文件 dark; 无外部资源; 无 `localStorage` / `alert` / `<script>`; 无 emoji 装饰 / 阴影渐变; 1px hairline 分隔。
- **版式细节单点**指向 `.agents/skills/delivery-artifact/references/native-html-checklist.md`, 本文件不复述版式构件。
