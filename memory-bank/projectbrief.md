# 项目简介（Project Brief）
> 摘要: 定义项目范围、核心需求与目标, 是记忆库基石; 含产品语境与技术关键约束
> 触发: 了解项目, 查项目范围, 查项目定位

> 记忆库基石文档：定义项目范围、核心需求与目标。其他文件在此之上构建。详细脚本速查见 [README.md](./README.md)，代码约定见 [conventions/](./conventions/)。

## 仓库结构

```
TampermonkeyScripts/
├── LICENSE
├── README.md                     # 简短仓库说明
├── .vscode/settings.json         # cSpell 词典（站点域名等专有名词）
├── memory-bank/                           # AI 知识库（本目录）
│   ├── README.md                 # 入口与索引
│   ├── projectbrief.md           # 本文档（范围/目标/基石）
│   ├── conventions/              # 代码约定（按主题分件）与新增站点/脚本检查清单
│   ├── pitfalls/_index.md               # 易错点与坑（含现存 Bug 清单）
│   ├── tasks/                    # 任务清单（按状态分类）
│   └── scripts/                  # 各脚本详细说明
├── tests/                        # 开发期测试与校验工具（非 userscript, 无 @version 头, 零依赖）
│   ├── README.md                 # 测试约定：目录结构 / 如何运行 / 纪律 / 可测性技法
│   ├── run-all.js                # 极简零依赖运行器（**递归**发现并逐个跑 tests/** 下的测试）
│   ├── lib/                      # 共享基建（不是测试）
│   │   └── sim/                  #   本地仿真站：真浏览器 + 假站点（server/sites/gm-shim/cdp/harness/tcase）
│   ├── fixtures/                 # 测试数据（真实页面 HTML 样本等）
│   └── ptautocheckin/            # PTAutoCheckIn 的用例（一个脚本一个目录，新增脚本照此建目录）
│       ├── check-ptac-budget.js  #   超时预算/状态阶梯/不透明成本声明静态校验（见 P28）
│       └── sim-security-s*.js    #   仿真站安全向用例 S00–S17（见 P30）
└── src/
    ├── PTAutoCheckIn.user.js                 # PT 多站点自动签到(v2 并入正式版: 批量+FAB+贴吧多吧, 2026.09.19.4)
    ├── BTSchoolHelper.user.js                # BTSchool 种子列表增强
    ├── BTSchoolTorrentsTableSample.html      # BTSchool 种子表格真实 HTML 样本（测试用 fixture）
    ├── BilibiliEnterFullscreen.user.js       # B 站 Enter 键全屏
    └── EnhanceVisitedLinks.user.js           # 全局已访问链接样式增强
```

## 项目定位

个人自用的 **Tampermonkey 用户脚本** 集合，覆盖 B 站、多个 PT 站与百度贴吧的自动化辅助功能。代码以中文注释为主，功能以解决实际使用痛点为目标。无构建步骤、无依赖包、无测试框架；脚本为单文件、可直接安装到 Tampermonkey 的 `.user.js`。

- 远程仓库：`https://github.com/ABackerNINI/TampermonkeyScripts`（Gitee 镜像用于 B 站脚本直链更新）
- 许可证：GNU GPL-3.0（每个脚本头部均标注）

## 现有脚本清单

> 完整站点表/行为细节见各脚本文档（`memory-bank/scripts/*.md`）。下表为速览。

| 脚本 | 匹配站点 | run-at | grant | 核心能力 |
|------|----------|--------|-------|----------|
| `src/PTAutoCheckIn.user.js` | 30 站 + 百度贴吧 6 吧 | `document-start` | `GM_getValue` / `GM_setValue` / `GM_log` / `GM_openInTab` | 被动签到 + 批量调度 + 跨站 FAB 结果面板 + 贴吧多吧 + 按钮重现降级 + 行内重试（详见 `scripts/PTAutoCheckIn/`） |
| `src/BTSchoolHelper.user.js` | `pt.btschool.club/torrents.php*` | `document-end` | 无 | 高亮 2xFree 种子、置顶种低亮、空格键跳转 |
| `src/BilibiliEnterFullscreen.user.js` | `bilibili.com/video/*`、`/bangumi/*` | `document-body` | 无 | 进页面自动网页全屏；Enter 全屏 / Shift+Enter 网页全屏 |
| `src/EnhanceVisitedLinks.user.js` | 全部站点 `*` | `document-start` | `GM_addStyle` | 紫色高亮 `a:visited` 并适配明/暗色模式 |

## 核心需求与目标

1. **稳定可用的自动化**：优先保证主路径可用——站点失效时宁可跳过并打 warn，不阻塞用户浏览。
2. **版本驱动更新**：所有脚本元数据 `@version YYYY.MM.DD.N`，修改代码/元数据必须同步递增，否则 Tampermonkey 不会向用户端推送更新。
3. **文档与代码同步**：任何代码/项目文档变更后，必须同步更新 `memory-bank/` 记忆库，并与代码同次提交。
4. **保守扩展**：个人脚本以稳定为先，新增能力默认关闭或可配置，避免未经请求改变用户浏览行为。
5. **防封号/防风控**：PT/贴吧签到类脚本把「每次访问都检测、冷却只防重复点击」作为核心安全设计；**冷却期内绝不重复点击**（含"自动重试"——只复检状态、不重复写操作）。
6. **慢不等于坏**：签到结果必须区分「确定失败」与「未确认（超时/无信号，可重试）」，且**超时不得覆写已给出的结论**；单站内部超时必须装进整流程预算（预算不变式 + 自动校验，见 `pitfalls/_index.md` P28）。

## 项目边界

- 本仓库只有 Tampermonkey 用户脚本，无 Web 应用、无服务端、无 CI 构建产物。
- `src/` 下所有 `.user.js` 为生产脚本；`src/*Sample*.html` 为测试用真实页面 HTML 样本（脱敏）。
- 只改**已授权域名**（`@match` 范围内）的逻辑，不越界操作其他站点。

## 为什么存在

作者使用多个 PT 站（私密种子站）与百度贴吧，这些站点普遍有**每日签到**奖励机制（魔力值、积分、吧经验）。手工逐站签到耗时且易遗漏。同时 B 站播放、BTSchool 种子浏览等场景也有重复性操作痛点。本项目用 Tampermonkey 用户脚本把这些重复操作自动化，把「每个 PT 站每天都要记着去点一下」变成「开着浏览器就自动完成」。

## 解决的问题

- **多 PT 站每日签到**：十几到二十几个 PT 站、多个贴吧，手工签到繁琐易漏 → 自动签到。
- **B 站全屏操作**：进页面想直接全屏、按 Enter 想切换全屏 → 自动全屏 + Enter 快捷键。
- **BTSchool 种子筛选**：在大量种子列表中想快速找到「免费 & 2x 上传」的种子 → 高亮 + 快捷键滚动。
- **已访问链接辨识**：全局 `:visited` 链接默认样式不清晰 → 紫色增强 + 明暗适配。

## 应当如何工作

- **被动优先**：访问匹配站点即自动执行，无需用户干预；设置项（若以后面板化）默认值与旧版行为一致。
- **主动批量**（PTAutoCheckIn）：用户点「批量签到」后，在后台标签串行打开各站执行签到，全部完成后弹出结果面板，发起页常驻不跳走。
- **安全纪律**：签到类脚本「每次访问都检测已签、冷却只防重复点击」，避免风控/封号；无法自动化的站（如 U2 需人工验证码）只检测不自动签。
- **可观测**：脚本用 `[ScriptName]` 前缀打 console 日志，失败给出中文可读提示；PTAutoCheckIn 有跨站 FAB 结果面板。

## 用户体验目标

1. **零打扰**：正常情况下自动完成，不弹窗刷屏；只在「按钮重现降级提醒」这类异常时给出页面级醒目提示（琥珀 toast / 按钮描边 / 常驻横条）。
2. **一眼可知**：PTAutoCheckIn 的 FAB 面板/角标让「今日全部签完」与「还有未签」在颜色/数字/皮肤上明显可辨。
3. **可靠一致**：面板数据跨站共享，任意已匹配站点打开都是同一份当日结果。
4. **不引入负担**：站点失效时跳过 + warn 日志，不阻塞浏览；无多余网络请求（favicon 命中浏览器缓存）。

## 演进方向（详见 `tasks/`）

签到站点覆盖扩展、BTSchoolHelper 快捷键增强、B 站全屏适配加固、设置面板化、解析工具收敛、发布自动化、远期跨站种子聚合与结果推送等。

## 关键技术约束（摘自 `architecture/tech-context.md`，原句照搬）

- **语言**：JavaScript（ES6+，`const`/`let`，禁止 `var`）
- **运行时**：浏览器 + Tampermonkey（Greasemonkey API）
- **脚本格式**：`.user.js`（单文件，含 UserScript 元数据头）
- **版本管理**：git（远程 GitHub + Gitee 镜像）
- 无 package.json / 无 npm / 无构建步骤。直接编辑 `src/*.user.js`。
- 测试用 Node 直接跑（无需 `npm install`）：`node tests/run-all.js`（全部）或 `node tests/<某测试>.js`（单个）；语法检查 `node --check src/*.user.js`。
