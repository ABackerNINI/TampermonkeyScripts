# pitfalls — 用户脚本与 PT 站点踩坑索引
> 摘要: 按「你要做的动作」定位本项目踩过的坑 —— Tampermonkey 用户脚本、PT 站点解析、HDHomeUI 换肤、测试、git 与知识库操作，改码前先在这里过一遍。
> 触发: 改码前, 跑 git 前, 排障, 新增站点, 换肤, 写测试, 提交前, 动知识库, 查凭据, 对版本号

> **读法**: 条目以「症状 → 原因 → 对策」为主，按动作选类、再进主题文件；找不到时用 `grep -rn "<词>" memory-bank/` 兜底。
> **不要整读本目录** —— 目录化的意义就是「按动作定位一条」，整读会把预算吃回去。
> **过渡态**: 单文件 `pitfalls.md` 仍是事实源；P1–P40 已按八类迁入本目录（本批），P41–P79 待 S07b 续作，全部迁完才重跑生成器与删单文件。本批**不生成最终索引**（只前半条目，索引会误导）。

## 类目定义（8 类，按本项目实际坑型定制）

一条只归一类，按「主坑型」判；边界模糊时看这条最先该被谁读到：

- `userscript` —— 用户脚本引擎实现层：GM API / 元数据 / IIFE / 事件与生命周期 / 键盘快捷键 / 通用 JS 陷阱 / 命名 / 状态机与渲染层 / 预算与超时。
- `site-adapt` —— PT 站点适配：签到建模 / 表格与字段解析 / 落地页 / 状态判定通道 / 页面归属 / favicon / 选择器随站点改版。
- `css-theme` —— 换肤与 SVG 图标：HDHomeUI 换肤 / FAB 皮肤 / CSS 规则 / 布局 / 16px 图标设计 / 列结构契约 / 底色与颜色 / 主题扫描判据。
- `tests` —— 测试基建：仿真站 / 断言与判据 / 原型派生 / CI 度量 / hit-test / 程序化校验。
- `git` —— 提交 / 分支 / 版本号（`YYYY.MM.DD.N` 当日流水号）。
- `kb` —— 知识库 / AI 协作纪律（计划阶段不改码、未审核不提交）。
- `docs` —— 文档漂移 / 约定 / 编码与仓库卫生。
- `security` —— 凭据 / 私有资源 / 仿真站安全审计 / 跨站存储与宿主 DOM 通道。

> 三处同步已完成：本目录 `_about.md`、`_common.PITFALL_CLASSES`、`memory-bank/README.md` 细路由。
> **量**（S07a 实测，仅取标题行分段统计）：单文件 78772 字符 / 1472 行；79 条起始行 P1=6 … P79=1440；单条字符数区间 **203（P12）～ 5300（P28）**，79 条合计 78575 字符 + 文件头 197 字符。最大五条：P28(5300) / P25(4535) / P30(2471) / P26(2258) / P17(2248)。P28·P30·P31 含 `###` 子标题，随该条一起搬进同一文件。

## 归类清单（P1–P79 全量，S07b 续作依据）

格式：`P<编号> -> <类>/<文件名>`。文件名带 P 编号便于守恒核对；P1–P40 已落盘，P41–P79 待 S07b 按本清单建。

```
P1 -> site-adapt/p01-btschool-table-parsing.md
P2 -> site-adapt/p02-calc-a-float-parse.md
P3 -> site-adapt/p03-comma-number-functions.md
P4 -> userscript/p04-foreach-return-noop.md
P5 -> site-adapt/p05-checkin-already-misjudge.md
P6 -> site-adapt/p06-checkin-cooldown.md
P7 -> userscript/p07-waitforelement-resolve.md
P8 -> userscript/p08-shortcut-input-guard.md
P9 -> userscript/p09-event-lifecycle.md
P10 -> userscript/p10-naming-mismatch.md
P11 -> site-adapt/p11-has-selector-csp.md
P12 -> docs/p12-encoding-repo-hygiene.md
P13 -> kb/p13-ai-collab-discipline.md
P14 -> tests/p14-test-discipline.md
P15 -> site-adapt/p15-favicon-fallback.md
P16 -> site-adapt/p16-url-ownership.md
P17 -> css-theme/p17-fab-skin-semantics.md
P18 -> site-adapt/p18-landing-page-text-marker.md
P19 -> site-adapt/p19-confirmmanual-successdetect.md
P20 -> git/p20-version-day-reset.md
P21 -> site-adapt/p21-visit-checkin-modeling.md
P22 -> site-adapt/p22-redirect-no-pagehide.md
P23 -> site-adapt/p23-crossday-dom-snapshot.md
P24 -> site-adapt/p24-detectonly-captcha.md
P25 -> site-adapt/p25-button-reappear-suspect.md
P26 -> site-adapt/p26-notext-icon-button.md
P27 -> site-adapt/p27-carrier-agnostic-signals.md
P28 -> userscript/p28-slow-site-budget-invariant.md
P29 -> userscript/p29-panel-null-status.md
P30 -> security/p30-sim-security-audit.md
P31 -> site-adapt/p31-nobutton-means-checkedin.md
P32 -> security/p32-passkey-leak.md
P33 -> css-theme/p33-injected-columns-contract.md
P34 -> css-theme/p34-16px-icon-signals.md
P35 -> css-theme/p35-evenodd-fill-rule.md
P36 -> css-theme/p36-icon-layout-overflow.md
P37 -> css-theme/p37-vertical-slot-hand.md
P38 -> css-theme/p38-invert-not-semantic.md
P39 -> css-theme/p39-evenodd-subpath-bounds.md
P40 -> css-theme/p40-edge-notch-path.md
P41 -> tests/p41-ispointinfill-ascii-map.md
P42 -> css-theme/p42-svg-img-width-height.md
P43 -> userscript/p43-unhandledrejection-prefix.md
P44 -> userscript/p44-storage-option-migration.md
P45 -> css-theme/p45-color-3d-distance.md
P46 -> css-theme/p46-fixed-width-table-layout.md
P47 -> userscript/p47-replace-while-loop.md
P48 -> tests/p48-prototype-vs-realsite.md
P49 -> tests/p49-sim-from-prototype.md
P50 -> css-theme/p50-background-image-important.md
P51 -> css-theme/p51-table-white-bg.md
P52 -> css-theme/p52-flatten-inline-table.md
P53 -> css-theme/p53-border-not-background.md
P54 -> css-theme/p54-logic-key-vs-dom-class.md
P55 -> css-theme/p55-font-color-dark-theme.md
P56 -> css-theme/p56-ua-rendered-ui.md
P57 -> css-theme/p57-css-silent-failure.md
P58 -> css-theme/p58-column-grid-padding.md
P59 -> css-theme/p59-promo-badge-colors.md
P60 -> css-theme/p60-progress-text-node.md
P61 -> css-theme/p61-truncation-scan.md
P62 -> css-theme/p62-column-width-both-sides.md
P63 -> css-theme/p63-flatten-bg-loses-state.md
P64 -> css-theme/p64-hover-hidden-scan.md
P65 -> css-theme/p65-sticky-top-two-layers.md
P66 -> css-theme/p66-hidden-not-display-none.md
P67 -> css-theme/p67-inline-style-enumerate.md
P68 -> css-theme/p68-row-structure-per-row.md
P69 -> css-theme/p69-unknown-structure-unmakeup.md
P70 -> tests/p70-local-green-ci-metrics.md
P71 -> tests/p71-ci-node-websocket.md
P72 -> tests/p72-unfalsifiable-assertion.md
P73 -> tests/p73-fixed-sleep-polling.md
P74 -> tests/p74-hittest-covered-ancestor.md
P75 -> css-theme/p75-transparent-not-white.md
P76 -> css-theme/p76-rule-not-matched-vs-overridden.md
P77 -> css-theme/p77-flatten-bg-ask-first.md
P78 -> css-theme/p78-valid-syntax-dead-rule.md
P79 -> css-theme/p79-dont-redesign-site.md
```

> 类分布（共 79）：`css-theme` 37 / `site-adapt` 18 / `userscript` 10 / `tests` 9 / `security` 2 / `git` 1 / `kb` 1 / `docs` 1。
> 本批 P1–P40 落盘 40 个文件：site-adapt 18 / css-theme 9 / userscript 7 / security 2 / tests 1 / git 1 / kb 1 / docs 1。
