# 项目简介（Project Brief）

> 记忆库基石文档：定义项目范围、核心需求与目标。其他文件在此之上构建。详细脚本速查见 [README.md](./README.md)，代码约定见 [conventions.md](./conventions.md)。

## 仓库结构

```
TampermonkeyScripts/
├── LICENSE
├── README.md                     # 简短仓库说明
├── .vscode/settings.json         # cSpell 词典（站点域名等专有名词）
├── memory-bank/                           # AI 知识库（本目录）
│   ├── README.md                 # 入口与索引
│   ├── projectbrief.md           # 本文档（范围/目标/基石）
│   ├── conventions.md            # 代码约定与新增站点/脚本检查清单
│   ├── pitfalls.md               # 易错点与坑（含现存 Bug 清单）
│   ├── tasks/                    # 任务清单（按状态分类）
│   └── scripts/                  # 各脚本详细说明
└── src/
    ├── PTAutoCheckIn.user.js                 # PT 多站点自动签到(v1 旧版, 待 v2 实测后并入删除)
    ├── PTAutoCheckIn-v2.user.js              # PT 多站点自动签到 v2(批量+FAB+贴吧多吧, 2026.09.08.28)
    ├── BTSchoolHelper.user.js                # BTSchool 种子列表增强
    ├── BTSchoolTorrentsTableSample.html      # BTSchool 种子表格真实 HTML 样本（测试用）
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
| `src/PTAutoCheckIn-v2.user.js` | 27 站 + 百度贴吧 6 吧 | `document-start` | `GM_getValue` / `GM_setValue` / `GM_log` / `GM_openInTab` | 被动签到 + 批量调度 + 跨站 FAB 结果面板 + 贴吧多吧 + 按钮重现降级 + 行内重试（详见 `scripts/PTAutoCheckIn.md`） |
| `src/BTSchoolHelper.user.js` | `pt.btschool.club/torrents.php*` | `document-end` | 无 | 高亮 2xFree 种子、置顶种低亮、空格键跳转 |
| `src/BilibiliEnterFullscreen.user.js` | `bilibili.com/video/*`、`/bangumi/*` | `document-body` | 无 | 进页面自动网页全屏；Enter 全屏 / Shift+Enter 网页全屏 |
| `src/EnhanceVisitedLinks.user.js` | 全部站点 `*` | `document-start` | `GM_addStyle` | 紫色高亮 `a:visited` 并适配明/暗色模式 |

## 核心需求与目标

1. **稳定可用的自动化**：优先保证主路径可用——站点失效时宁可跳过并打 warn，不阻塞用户浏览。
2. **版本驱动更新**：所有脚本元数据 `@version YYYY.MM.DD.N`，修改代码/元数据必须同步递增，否则 Tampermonkey 不会向用户端推送更新。
3. **文档与代码同步**：任何代码/项目文档变更后，必须同步更新 `memory-bank/` 记忆库，并与代码同次提交。
4. **保守扩展**：个人脚本以稳定为先，新增能力默认关闭或可配置，避免未经请求改变用户浏览行为。
5. **防封号/防风控**：PT/贴吧签到类脚本把「每次访问都检测、冷却只防重复点击」作为核心安全设计。

## 项目边界

- 本仓库只有 Tampermonkey 用户脚本，无 Web 应用、无服务端、无 CI 构建产物。
- `src/` 下所有 `.user.js` 为生产脚本；`src/*Sample*.html` 为测试用真实页面 HTML 样本（脱敏）。
- 只改**已授权域名**（`@match` 范围内）的逻辑，不越界操作其他站点。