# AGENTS.md

> 所有 AI 编码代理的统一入口。完整知识库在 `memory-bank/`(Memory Bank 模式)——本文件只放**路由与硬约束**; 不要凭印象回答项目问题, 按路由深入后再动代码。
> ⚠本文件有**8000 字符硬上限**——超出部分 IDE 注入时被静默截断, 尾部内容模型看不到。改完用 `commands run doc.caps` 自查。

## 知识库路由(两层:本文件粗路由→`memory-bank/README.md`细路由)

「按任务读哪份文档」的单点在 `memory-bank/README.md` 的细路由表(含改代码前/跑 git 前必读的 pitfalls 索引、检索纪律: `commands run kb.active`(最近)→ [README](memory-bank/README.md) 路由 → `grep -rn` 兜底; 禁止整读)——本文件不复述, 免得两处各自演化。

## 会话协议

完整规程(会话开始/收尾 DoD/立档阈值 4 条/任务档案模板)见 memory-bank skill(`.agents/skills/memory-bank/SKILL.md`)。本节只留入口。

- **开始**: ①**先同步(硬性, 无豁免——问答/只读分析轮次也必须先同步)**——`commands run my-commit-flow.sync`: 自动 fetch+快进/分叉自动 rebase(保线性), 结果行「已同步 <hash>」贴进回复; 真改写 HEAD 的步骤(快进/rebase)按「旧 hash→新 hash」各留一行在它上面; 失败一行含原因与步骤(树脏/冲突已自动回滚), 照做后重跑, **禁止在落后的分支上工作——只读分析同样禁止**。**只读评审子代理豁免本步**(同步是主会话开工动作; 其 git 状态不动, 自检锚=任务提示给的 head hash); **可写子代理不豁免**(照常同步, 或在任务提示里钉死基线)。②看会话滚动状态: `commands run kb.active` 列 `memory-bank/active-context/` 切片; 该读哪份文档走上面的路由。③**只动当前这一个 clone**——跨仓库操作**绝对禁止**, 须用户显式说「授权」(见「🔴 跨仓库操作」节)。
- **建件与改版**: 一律命令化创建(`kb.new <族>` / `kb.status` / `kb.bump` / `kb.wrap`), 派生面零手写; 四工位与决策树见 `memory-bank/conventions/doc-forms.md`「四工位」「决策树」节, 族清单与口径见其「创建/更新方式」。
- **收尾**: 每批收尾先跑 code-review skill(批次判定见其①, `review.pack`/`review.check` 是机械面; 提交闸门强制 `Review:` trailer), 然后按 skill 的 DoD: 切片 `commands run kb.wrap`(蒸馏与判断仍是 agent 的活)→达阈值立档 `commands run kb.new task`→代码事实变更回写 `memory-bank/` 与根 README→`commands run test.full` 并新建基线切片(`kb.new baseline --total ..`, 数字从实测誊写)→**新坑按动作写进 `pitfalls/<类>/<主题>.md` 并重跑 `commands run kb.index`**。若这轮踩到**已记的坑**, 把该条`复发`+1, 并在档案里写一句为什么没命中(路由没到/文件没读/读了没照做)。
- **冲突裁决**: 代码 > `memory-bank/` > 根 `README.md` > `想法.md`; 漂移以代码为准并回写。

## 产出口径

- **项目定位: 长期装机使用的个人生产脚本**——每日真实使用(部分脚本经 `@downloadURL` 分发自动更新), 不是实验场/玩具样例。兼容性、报错文案、默认值变更、错误处理一律按真实使用标准评估; 禁止以「反正是自用」为由降级方案、留一次性代码或不写验证。
- **计划/报告/issue 一律单文件 HTML; 任务档案为 Markdown(唯一滚动更新); 四工位制品一律 `kb.new` 建**(决策树见 `memory-bank/conventions/doc-forms.md`), **不走 `delivery-artifact` skill**(它只管四工位外的可视化交付物: 原型/Stage/PPT/演示页)。
- **HTML 一律 dark 主题**: 见 `memory-bank/conventions/doc-forms.md`「四工位」节渲染边界(视觉/骨架规格单点在 memory-bank skill `templates/`)。
- **测试基线数字只写一处**: 权威在 `memory-bank/testing/baselines/` 最新切片, 其余一律引用不手抄(`commands run kb.baseline`)。

## 编码约束: 非 ASCII 图形符号

- 代码/配置禁**装饰性**图形符号→ASCII 表达; 文档(`.md`/交付 `*.html`)可用, 中文语义标点与箭头/数学符不在禁内。判据与替代表见 `memory-bank/conventions/code-style.md`「非 ASCII 图形符号禁令」(机检面未随迁, 新代码按判据自律)。

## 项目铁律(最高优先级, 违反即视为任务未完成)

完整原文单点在 `memory-bank/conventions/iron-rules.md`; 本节只留压缩口径:

1. **计划不改码**: 任务定位为「计划/分析/调研/设计」时只输出方案, 禁止改动任何代码文件; 确需改码才能得出结论时先停下征询用户。
2. **等审核再提交**: AI 完成修改后禁止自动 `git commit` / `git push`, 一律由用户审核决定; 修完汇报并提示「请审核, 确认后再提交」。
3. **版本号铁律**: 改任何代码/元数据必须同步递增脚本头 `@version`(`YYYY.MM.DD.N`, 跨天重置 N)并与代码改动同一次提交(纯注释、仅改 `memory-bank/` 文档除外)。详见 `conventions/version.md` 第 1 节。
4. **知识库同步铁律**: 每次更新代码或项目文档后必须同步更新 `memory-bank/` 受影响条目并同次提交; 改码不同步知识库等同没做完。详见 `conventions/doc-sync.md` 第 0.4/6 节。
5. **私有资源与凭据铁律**: `resources-do-not-track/` 永不被 Git 追踪, 其中 passkey/authkey/token/cookie/uid 等不得以任何形式泄露到网络——不 `git add -f`、不改 `.gitignore`、不复制进受追踪位置; 引用只描述结构(选择器/类名/URL 形状), 值一律 `***`。详见 `conventions/iron-rules.md` 第 0.5 节。
6. **范围守恒**: 计划外的代码/文档缺陷**一行都不改**——入池 `memory-bank/issues/`(8 类类型/便签与标准两档/`kb.new issue` 建件; 制品协议见 `conventions/doc-forms.md`); **入池不为填单做代码分析**。该不该现在修见 scope-guard skill `.agents/skills/scope-guard/SKILL.md`; 建报告与改状态见 create-issue skill `.agents/skills/create-issue/SKILL.md`。
7. **请求边界**: 开工先判这一轮是**问答/只读**还是**执行任务**——只是问就**只在回复里作答**, 不得入池 issue/立档/出计划/改文件/commit push; 想延伸排查先问。只有执行任务才适用上面的收尾 DoD 与立档阈值。
   - **"继续/continue/接着做/你看着办"不构成授权**——只表示"把你手上这一步做完"。四类动作必须**逐项**显式确认: ①新建文件 ②入池 issue ③认领 issue ④commit/push。
   - **开工同步不受本条豁免**: 问答/只读轮次开工照样先跑 `my-commit-flow.sync`(协议硬步骤, 只 fetch+快进, 不扩大本轮动作范围)。
   - 反面案例见 `memory-bank/pitfalls/kb/request-boundary.md`。

## 红线(私有文件与生成物, 禁止改动/提交)

- **`resources-do-not-track/`**: 用户真实站点整页与凭据(铁律 5; 出现即 STOP, 闸门已拦)。
- **用户自己的在途改动**(`想法.md` 若出现为高危)与**生成物**: `.tools/`(vnu.jar)、`commands`/`commands.cmd` wrapper、`__pycache__/`——已 gitignore, 不要"顺手"入库或重排。
- 清单单点在 `.commands/my-commit-flow/.my-commit-flow.toml` 的 `red_lines`/`warn_lines`(闸门强制读取)。

## 命令

**想跑测试/自检/提交/推送/包内脚本, 第一步是找 task id, 不是拼裸命令**——裸跑等价物会丢掉包里单点定义的环境陷阱。引擎用法(task id 写法 / 先试跑再装 wrapper / `list` / `show` / 收录协议)见 commands skill `.agents/skills/commands/SKILL.md`; `<task>` 映射表在 `.commands/` 各包的 `config.toml`。常用:

```text
commands run test.full   # 全量测试(零依赖 Node 运行器; 无浏览器时 SKIP 仿真用例)
commands run kb.check    # 知识库自查(改完 memory-bank 先跑)
commands run kb.index    # 重建 pitfalls 索引(全库唯一生成索引)
commands run doc.caps    # 上下文字符上限自查(AGENTS.md 是硬规定)
commands run doc.links   # 相对链接坏链机检
commands run doc.drift   # 命令漂移: 文档手抄已收录命令判红
```

- 本项目无 npm/pip 依赖面: 测试零依赖 Node; 被改的 Python 脚本 `--help` 冒烟由闸门自动做。

## 🔴 Skill 代码禁读

- 禁止阅读 skill 目录(`.agents/skills/`)下的代码(SKILL.md 与规程指示的文件除外)——按 skill 规程+其提示处置即可。
- 例外仅 skill 本身疑似缺陷须排障: 经用户显式授权才可读; 想绕过 skill 流程不构成读代码的理由。

## ⚠ 环境硬约束: Git 操作(AI 工具 shell 特有)

**工作区模式: 多 clone 并行**: 每个 AI 实例用**一份独立克隆**, 跨 clone 同步一律走 Gitee `develop`。细则见 `memory-bank/conventions/collaboration.md`「协作约定」; 完整判据与事故档案单点在 `memory-bank/pitfalls/git/_index.md`。本节只留最容易致命的几条:

- **rebase/merge/stash 禁令已解除**: 历史上删除拦截层会在这几类操作写入 `.git` 时批量删对象(3 次事故), 已修复、恢复可用——高风险历史整合前仍建议先 `cp -a .git <备份>`。落后/分叉一律 `commands run my-commit-flow.sync`(自动快进/rebase 保线性; 树脏会给失败行, 行内自带 stash 解锁配方)。
- **ref 三处核对与推送核验已内联进 ship 脚本**: `HEAD`==`refs/heads/<branch>`==loose/packed、推完 `ls-remote` 现查远端真值, 全部由 `ship.commit`/`ship.push`/`my-commit-flow.sync` 自动做——**不要手工核验**; 不一致/「无法核实」会出现在失败行里, 排障用 `commands run my-commit-flow.verify-ref`。(本 shell 里 `refs/remotes/*` 写入被静默丢弃、`git push --dry-run` 永远"成功", 都不可信——详单点 `memory-bank/pitfalls/git/refs.md`。)
- 机检与停手点一律走 **task id**: `commands run ship.commit` / `ship.push` / `my-commit-flow.sync` / `my-commit-flow.verify-ref`(排障)。**包内 README 与 `references/` 只在排障/迁移时读**——日常整读它, 等于把"读整份文档找命令"的成本又搬回来。

## 🔴 跨仓库操作: 绝对禁止(需显式强授权)

- **除当前工作 clone 外, 对其它 clone 的任何写操作一律绝对禁止**——改文件/`git apply`/复制覆盖/跑任何 git 命令。
- **授权指令只认 `授权`**, 须用户**显式**说出; **「提交」不算**——它只授权 commit+push 到远端。
- 未授权时**停下来问**: 发现"改动在别的 clone 上不生效"应报告交由用户决定, **不能自己动手**。
- **跨工作区同步一律走 Gitee `develop`**, 没有第二种路径。完整判据与止损纪律见 `memory-bank/conventions/collaboration.md`「🔴 跨仓库操作」节。

## 提交 / PR

**步骤与机检一律走 task id**(不是文档): 收到"提交"→①收尾回写文档(DoD)→②消息写进 `.git/COMMIT_MSG_AI.txt`(提交后脚本自动删除)后 `commands run ship.commit`: 消息机检(gitmoji+中文骨架, BOM/乱码/残留被拦按失败行处置)+闸门+暂存+提交+内部同步(**提交先行**——树净 rebase 恒可自动)+核 ref+推 Gitee 全自动; 结果行「提交成功 <hash>」, 推送未完成不改退出码(补 `ship.push`)。本地分支无 upstream 阶段用 `ship.commit --no-push`(只提交, 不 push 不开 sync)。**本节只留口径**; 原理与完整判据在包内 `references/pipeline.md`(排障才读)。

- **协作主线**: 日常开发在 `develop`, 以 **Gitee 的 `develop`** 为准; **交付与否只看 Gitee**。GitHub 只作镜像、**允许滞后**——别用 GitHub 状态判断进度(直连不稳定, 会误判成"改动没推上去")。
- **用户说"提交"=commit+push**, 一次走完; **触发词只认"提交/入库/推上去"这类显式指令**, "继续/接着做/ok/你看着办"一律不算。**本条是提交口径的单点定义**, 优先于 `memory-bank/` 里的历史表述。
- **推送顺序固定**: 先推 Gitee(必须成功)→核远端 ref==本地→再镜像推一次(本仓=GitHub)——**全程静默, 成败都不提**(允许滞后; 不重试/不换代理/不改走 SSH/不回滚已完成的主线推送)。
- **提交信息=gitmoji+中文**: 首行 `<gitmoji> <中文一句话概述>`, 空一行后写动机/取舍/影响面/实测数字; 小改只写首行。**数字必须是提交那一刻实测的**。选 emoji 走 gitmoji skill `.agents/skills/gitmoji/SKILL.md`。**多个逻辑改动拆独立提交**, 每个提交自包含可回溯。
- **回写合流交脚本**: 收尾回写直接写在本地基线上, 与远端的合流由 `ship.commit` 提交后 rebase 完成——生成物冲突由 sync 自动化解(机制/边界单点见包内 `references/pipeline.md`), 手写件冲突才停下要人; 回写文件仍**随主提交一并暂存**, 不推完再补一笔(已推送的提交不能 amend+强推)。
- **提交后必查幽灵 diff**: `git status --short` 两列——`M `(第一列)=待提交, ` M`(第二列)=已提交过但工作区又脏; 权威判据(两者同时成立才算已提交)=`git log --oneline -1 -- <文件>` 有记录**且**`git diff --quiet -- <文件>` 退 0。发现后补一次"格式化, 无行为变化"提交, 不改写已入库提交。
- **硬纪律**: 只逐路径 `git add <文件...>` 不用 `-A`, 清单不混入用户未提交改动(`想法.md` 高危, `config.yml`/`resources-do-not-track/` 红线); `git pull <remote>` 必须带分支名; push 前再 fetch 一次(ahead/behind 是快照); 提交前全量测试通过; 用户可见行为变更同步 `README.md` 与 `memory-bank/`。
