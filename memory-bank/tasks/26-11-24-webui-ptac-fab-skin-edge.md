# 26-11-24-webui-ptac-fab-skin-edge — PTAutoCheckIn FAB 皮肤精简与靠边模式改造

**Status:** Done
**Added:** 2026-11-24
**Updated:** 2026-11-24
**Summary:** FAB 四皮肤收敛为三皮肤、新增与皮肤正交的靠边模式并修复静息 CPU 高占用；四批实施与 D 批验收回写完成
**Topics:** webui-ptac-fab-skin-edge
**Refs:** memory-bank/plans/26-11-24-1409-plan-ptac-fab-skin-edge.html, memory-bank/pitfalls/git/review-base-hash-tree-state.md, memory-bank/plans/26-11-24-2226-plan-ptac-fab-fix2.html

## 本篇只回答

本次改造为何收敛皮肤、靠边模式如何与皮肤正交落地、四批实施的版本演进与验收结论、后续边界在哪里。领域事实见 `scripts/PTAutoCheckIn/fab-ui.md` 与 `overview.md`，方案全文见计划件。

## 原始请求

1. 用户指令（原话要点）：「趁此机会改造脚本 UI：移除数字/光环皮肤、添加隐藏动效按钮、添加靠边模式（静态竖线/颜色跟随状态色/移入响应/移出恢复靠边），将修复一并纳入计划，grilling 然后出一个计划」。
2. 上一轮只读根因分析的静息 CPU 高占用结论须一并纳入修复范围（非合成属性 infinite 动画逐帧全链路重绘，非定时器猜测）。
3. 三轮 grilling（Q1–Q12）全部拍板；实施按 A 性能修复 / B 皮肤精简 / C 靠边模式 / D 验收回写四批推进，用户逐项授权。
4. D 批为纯文档轮：只做测试与基线、事实回写、立档收尾，不改代码/元数据，@version 保持 2026.11.24.4 不递增。

## 思考过程与决策

- 计划件：`memory-bank/plans/26-11-24-1409-plan-ptac-fab-skin-edge.html`（三轮 grilling Q1–Q12 全拍板，含两项否决 AI 推荐改选备选）。
- 关键拍板：D1 改动画本身 + 提供开关（默认无感修复，开关是兜底而非责任转嫁）；D2 隐藏动效作为皮肤条内的「静态」选项；D3 靠边与皮肤**正交独立开关**（竖线颜色直接复用状态色语义，不另立规则）；D4 legacy skin 静默回退变色（内存归一、GM 原值保留不回写）；D5 静态=变色静态版；D6/D10 竖线沿用 FAB 原 right/bottom 锚点 4×120 向上、向左侧展开不跳位；D7 透明命中区 + 面板打开保持展开；D8 触屏两段式、批量/键盘焦点保持展开；D9 皮肤条内独立 data-edge 布尔项；D11 新 GM 键 ptac_edge 跨站；D12 换合成属性写法、保留轻微动感。
- 取舍：性能修复不靠「加开关让用户自己关」；靠边与皮肤正交故竖线复用状态色；静默回退不写迁移提示代码，靠文档与测试钉死行为；面板定位保持固定 bottom:84px 不随竖线形变漂移。

## 实现计划

四批各自独立可验、逐批提交：
- A 性能修复：辉光呼吸改预渲染光晕伪元素只动 `opacity`、变色形变去 `border-radius` 只留 `transform`；验收 = 静态断言无 infinite 动画改 box-shadow/border-radius/filter + Performance 静息不再逐帧 Recalculate Style。
- B 皮肤精简：皮肤条 3 钮（chameleon/signal/static）、`applyFabSkin` 增 static 分支禁全部动画、legacy 内存归一变色 GM 不回写；验收 = 三钮静态断言 + 三态仿真 + legacy 注入渲染为变色。
- C 靠边模式：data-edge 独立开关 + ptac_edge 跨站 + 竖线几何/hover 展开双锚点不跳位 + 四条件状态机/触屏两段式；验收 = 六场景真浏览器仿真。
- D 验收回写：test.full 全绿 + 新基线切片（数字只进切片）+ 分批评审 + memory-bank 事实回写 + 立档收尾。

## 子任务状态表

| 步 | 内容 | 状态 |
|---|---|---|
| A | 性能修复（合成属性改写 + 静态断言） | Done(2026-11-24) |
| B | 皮肤精简（三钮 + 静态皮肤 + legacy 归一） | Done(2026-11-24) |
| C | 靠边模式（ptac_edge + 竖线 + 四条件状态机） | Done(2026-11-24) |
| D1 | test.full 全绿 + 新基线切片 | Done(2026-11-24) |
| D3 | 事实回写（fab-ui/overview/P17/known-issues/README）+ 立档收尾 | Done(2026-11-24) |

## 进度日志

### R0 · 立档 (2026-11-24)

- 四批实施已入库，版本逐批演进：`55cff61`（A 性能修复，@version 2026.11.19.3 → 2026.11.24.1）/ `a60019f`（B 皮肤精简，→ 2026.11.24.2）/ `be7fb8e`（C 靠边模式首版，→ 2026.11.24.3）/ `7cbb2dc`（C 收口为四条件状态机 + 六场景仿真，→ 2026.11.24.4）。
- 验收结论：`commands run test.full` 全绿(见 kb.baseline)，新基线切片 `memory-bank/testing/baselines/26-11-24-1734-ptac-fab-skin-edge.md`（数字只写该切片）；C4 六场景真浏览器仿真已通过，观测手法沿用 `document.elementFromPoint` 的 shadow 重定向（详见 `calibration-detail.md` 校准项 23 的 C4 段）。
- 本批（D 纯文档轮）只做文档与知识库回写，不改 src/ 与 tests/，@version 保持 2026.11.24.4 不递增。

- 2026-11-24 17:39 D 批纯文档轮：test.full 全绿并新建基线切片，回写 fab-ui/overview/P17/known-issues/README，任务档案立档并与计划件双向认领，新坑入池重跑索引，四批实施收口
