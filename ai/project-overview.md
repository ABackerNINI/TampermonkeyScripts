# 项目概览

## 仓库定位

个人自用的 **Tampermonkey 用户脚本** 集合，覆盖 B 站、多个 PT 站与百度贴吧的自动化辅助功能。代码以中文注释为主，功能以解决实际使用痛点为目标。

- 远程仓库：`https://github.com/ABackerNINI/TampermonkeyScripts`（Gitee 镜像用于 B 站脚本直链更新）
- 许可证：GNU GPL-3.0（每个脚本头部均标注）
- 无构建步骤、无依赖包、无测试框架；脚本为单文件、可直接安装到 Tampermonkey 的 `.user.js`。

## 目录结构

```
TampermonkeyScripts/
├── LICENSE
├── README.md                     # 简短仓库说明
├── .vscode/settings.json         # cSpell 词典（站点域名等专有名词）
├── ai/                           # AI 知识库（本目录）
│   ├── README.md                 # 入口与索引
│   ├── project-overview.md       # 本文档（仓库结构/脚本速查/工作流）
│   ├── conventions.md            # 代码约定与新增站点/脚本检查清单
│   ├── pitfalls.md               # 易错点与坑（含现存 Bug 清单）
│   ├── roadmap.md                # 路线图（待修/近期/中期/远期）
│   └── scripts/                  # 各脚本详细说明
└── src/
    ├── PTAutoCheckIn.user.js                 # PT 多站点自动签到(v1 旧版, 待 v2 实测后并入删除)
    ├── PTAutoCheckIn-v2.user.js              # PT 多站点自动签到 v2(批量+FAB+贴吧多吧, 2026.09.07.10)
    ├── BTSchoolHelper.user.js                # BTSchool 种子列表增强
    ├── BTSchoolTorrentsTableSample.html      # BTSchool 种子表格真实 HTML 样本（测试用）
    ├── BilibiliEnterFullscreen.user.js       # B 站 Enter 键全屏
    └── EnhanceVisitedLinks.user.js           # 全局已访问链接样式增强
```

## 脚本速查

| 脚本 | 匹配站点 | run-at | grant | 核心能力 |
|------|----------|--------|-------|----------|
| `PTAutoCheckIn-v2.user.js` | 19 域名(18 PT + 百度贴吧多吧) | `document-start` | `GM_getValue` / `GM_setValue` / `GM_log` / `GM_openInTab` | 被动签到 + 批量(发起页常驻 + 后台标签串行调度, 超时自动跳过) + 跨站结果面板; 单站 10min 间隔, 贴吧吧间 3s 缓冲; 详情见 `scripts/PTAutoCheckIn.md` |
| `BTSchoolHelper.user.js` | `pt.btschool.club/torrents.php*` | `document-end` | 无 | 高亮 2xFree 种子、置顶种低亮、空格键跳转 |
| `BilibiliEnterFullscreen.user.js` | `bilibili.com/video/*`、`/bangumi/*` | `document-body` | 无 | 进页面自动网页全屏；Enter 全屏 / Shift+Enter 网页全屏 |
| `EnhanceVisitedLinks.user.js` | 全部站点 `*` | `document-start` | `GM_addStyle` | 紫色高亮 `a:visited` 并适配明/暗色模式 |

> 注：所有脚本元数据块中 `@version` 格式为 `YYYY.MM.DD.N`。**修改代码/元数据时必须同步递增版本号并与代码同次提交**（纯注释、仅改 `ai/` 文档除外），否则 Tampermonkey 不会向用户端推送更新。详见 `conventions.md` 第 1 节。

## 通用代码约定

> 本节为快速概览；**详细约定与检查清单见 [conventions.md](./conventions.md)**，历史踩坑与排障见 **[pitfalls.md](./pitfalls.md)**，规划方向见 **[roadmap.md](./roadmap.md)**。

1. **元数据块（UserScript header）**
   - 每个脚本包含：`@name` + `@name:zh-CN`、`@namespace`、`@version`、`@description`、`@author ABacker`、`@license GNU GPL-3.0`、`@tag`。
   - `@run-at` 依功能需求设置：需要尽早拦截 DOM 用 `document-start`；等待页面渲染用 `document-end`/`document-body`。
   - 需要用户脚本 API 时显式声明 `@grant`（如 `GM_getValue`、`GM_setValue`、`GM_addStyle`），无需要时写 `@grant none`。

2. **IIFE 包裹**：主体代码放入 `(function () { 'use strict'; ... })();`。

3. **脚本常量**：文件级声明 `const ScriptName = '...';`（控制台日志前缀，注意 BTSchoolHelper 用 `[BTSchool助手]` 带方括号；PTAutoCheckIn 用 `[PTAutoCheckIn]`）。

4. **语言与标点**：注释、console 输出用中文，但**一律使用英文标点**（`,`、`:`、`?` 等），避免中文标点引发 IDE 特殊标记或编码问题（git 历史中有专门修复该问题的提交）。

5. **变量声明**：统一 `const`/`let`，禁止 `var`。

6. **命名**：函数使用 `camelCase`；语义清晰。工具函数前缀如 `parse*`、`get*`、`scrollTo*`、`click*`。

7. **健壮性辅助函数**（重复出现于多个脚本）：
   - `parseCommaInt(str)` / `parseCommaNumber(str)`：解析带千分位逗号的整数/浮点，含 `Safe` 变体带默认值。
   - `parseFileSizeInBytes(sizeStr)`：解析 `"13.12MB"`、`"8.15GB"` 为字节数（1024 进制，支持 K/M/G/T/P 简写），无效格式抛错。
   - `waitForElement(selector, timeout)`：轮询/`MutationObserver` 等待元素出现（PTAutoCheckIn），支持传入**函数选择器**。

8. **防误触**：键盘快捷键处理函数统一检查 `document.activeElement` 是否在 `input`/`textarea`/`select` 内，是则直接返回。

9. **console 分级**：信息用 `console.log`，可预期失败用 `console.warn`，异常用 `console.error`；失败场景给出中文可读提示（如「未找到表格」「等待元素…超时」）。

## 站点适配注意（重要）

PT 站大多基于同一套开源代码（NexusPHP 系），但**各站模板与签到交互存在差异**：

- 通用签到入口多为 `a.faqlink[href*="attendance.php"]`，按钮文案如 `[签到得魔力]`。
- 部分站点点击签到会**跳转新页面**（HDBao、慕雪阁），需要多步骤：先点"立即签到"提交表单 → 等待 → 再在新页面点签到。
- 部分站点使用**对话框签到**（蜂巢 pting.club），需依次点击外层按钮、对话框按钮、关闭按钮。
- BTSchool 站种子表格结构特殊（详见 `scripts/BTSchoolHelper.md`）。

## 开发与发布工作流

1. 编辑 `src/*.user.js`。
2. **递增版本号**：同一天多次修改用 `.N` 递增（`2026.08.30.1` → `2026.08.30.2`）；跨天修改为 `YYYY.MM.DD.1`。
3. **同步更新 `ai/` 知识库**：受影响条目（脚本文档/约定/易错点/路线图）与代码同次提交（见 `conventions.md` 第 0.4 节）。
4. **提交信息规范且详细**：首行概括 + 正文分条说明背景/要点/影响；一次提交只做一件事（见 `conventions.md` 第 1 节）。
5. Tampermonkey 安装/更新脚本后，到目标站点页面按 F12 观察 console 日志验证。
6. 推送后脚本可经 `@downloadURL`/`@updateURL` 更新（BilibiliEnterFullscreen 使用 Gitee 直链）。
7. 测试纪律：可设计易测代码，但不为测试留后门、不为过测试改生产代码（见 `conventions.md` 第 8 节）。

## 修改脚本时注意

- 不要改动脚本头部 `@match` 之外无法访问的站点逻辑（仅限已授权域名）。
- BTSchoolHelper 与 PTAutoCheckIn 都有 `SITES`/解析逻辑依赖真实页面结构，改动后建议对照 `src/BTSchoolTorrentsTableSample.html` 验证。
- 若站点改版导致选择器失效，优先观察控制台 warn 日志定位是哪一步失效。
