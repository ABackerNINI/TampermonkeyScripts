# R4 评审方法论与命令面（单点）
> 摘要: 沉淀 R4 分批评审骨架 / checklist 指针 / lane 状态机原则 / 不带走清单 / 命令面与已知限制, 治「方法论散落在 qB 评审实体里、本项目无处可查」的病
> 触发: 做收口评审, 生成评审包, 校验 findings, 查评审方法论

## 1. 评审骨架（带走）

- **分批 ≤400 行**: 评审规模按可评行数分档, 每批不超过 400 行; 记账类/生成物/二进制不计行, 分档只作派遣提示、不是拦截闸门。
- **只读 reviewer 三件套**: 每个 reviewer 子代理只读、不改码; 主 agent 随评审包给出指路四件(档案/计划路径、涉及模块清单、安全敏感面、批次 base hash), 三件套 = 评审包 + 指路四件 + checklist。
- **findings 七字段 schema**: 每条发现固定 file / line / quote / severity / claim / relevance / fix 七字段, 缺字段不采信。
- **引文逐字校验（±3 行、refute 即弃）**: quote 必须与源码逐字比对(单行内连续片段 ≥4 字符, 行号允许 ±3 邻近), 由 review.check 机检; REFUTE 的发现直接弃、不复核。
- **severity 分级**: 发现按严重度分级(blocker / major / minor 等), 分级与 relevance 枚举都须合法。
- **blocker 必修**: blocker 级发现必须修复后才收口, 不允许带 blocker 合入。
- **收口接缝终审 ≤200 行**: 合流前对收口接缝再做一次终审, 规模控制在 ≤200 行。
- **修复循环**: 评审 → 裁决 → 修复 → 复评(重跑 pack 取新基) 循环, 直到无 blocker 且发现全部处置。

## 2. checklist 单点指针

- 10 条通用 checklist(通用面 6 条 + 文档面 4 条)与本项目补充面的**唯一单点**在 `.agents/skills/code-review/SKILL.md` ⑥, 本文件不重复、不复制清单正文。
- 需要逐条自查或派遣 reviewer 时, 直接读该文件 ⑥ 段。

## 3. review.lane 状态机原则（代码未移植）

- 七步语义: **manifest**(冻结基线 + 批次→文件矩阵) → **claim**(认领路线) → **start**(导出冻结快照 + 打印三件套) → **verify**(每批派遣前后开工自检/收尾复核) → **batch**(单批完成勾选进度, 须先过 review.check) → **done**(全批完成翻终态) → **smoke**(全环真冒烟含负例断言)。
- **状态单点在机器 JSON**: 路线进度/认领/冻结基线一律落在机器可读的 JSON(route / manifest), 不靠人脑或文档记账。
- **互斥 + 全覆盖守卫**: manifest 生成时校验批次文件矩阵互斥(无重叠)且全覆盖(无漏配), 不满足即 rc=1 列清单。
- **计划 HTML 静态不随执行改版**: 评审计划是成文那天的静态 HTML 制品, 执行进度不回写改写它。
- **本轮不移植状态机代码**(按 D2 与用户「纯裁剪 + 文档、零新增/改写 Python」决策): 该状态机深度依赖 ls-remote 现查 / develop tip 钉定 / 多 clone 冻结快照 / Review: trailer 口径; 与本项目「本地分支无远端、中文首行提交、不引入该 trailer」的口径冲突, 且属 qB 存量评审专用执行面, 故只把方法论与原则落成本文档, 不带代码。

## 4. 不带走清单（D2）

- 473 条 findings、6 份 issue HTML、终审报告、route JSON、auto-qb 路径常量, 一律不带走。
- Review-Skip / Review: trailer 口径不带走 —— 与本项目「中文首行 + 详述」提交规范冲突。

## 5. 命令面

- 只保留 review.pack(评审包生成) 与 review.check(findings 引文校验) 两个 task, 脚本均落在 `.commands/review/scripts/review_pack.py`(机械面, 本轮零改写)。
- review.trace 与 7 个 review.lane.* 命令已随 qB 专属脚本一并退役。
- `.commands/review/scripts/review_content.py` 作为 `review_pack.py` 的必需 stdlib 依赖模块予以保留(432 行、无 qB 路径常量), 故本轮实际退役 3 个 qB 专属脚本、包内为 3 文件。

## 6. 已知限制（如实登记）

- `.commands/review/scripts/review_pack.py` 第 135 / 141 行仍有两处 Review: / Review-Skip: 锚点提示措辞(历史注释与警告文本), 按「零改写 Python」本轮未改。
- 本项目提交信息不引入该 trailer; review.pack 实际使用以 --base <rev> **显式指定**评审起点为准, 不依赖任何 trailer 锚点自动推算。
- 计划/报告制品协议(dark 单文件 HTML、doc-added / doc-updated / doc-status / doc-refs meta、变更记录 R 行、认领链双向声明)归 `conventions/doc-forms.md`, 由 S12 建立, 本步不建该文件、只留此指针。
