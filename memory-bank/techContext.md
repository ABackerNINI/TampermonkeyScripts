# 技术语境（Tech Context）

> 记忆库核心文件：使用的技术、开发环境、技术约束、依赖。

## 技术栈

- **语言**：JavaScript（ES6+，`const`/`let`，禁止 `var`）
- **运行时**：浏览器 + Tampermonkey（Greasemonkey API）
- **脚本格式**：`.user.js`（单文件，含 UserScript 元数据头）
- **测试**：**无测试框架**（刻意保持：无 `package.json` / 无 npm / 无构建），但已有 `tests/` 开发期测试区 —— 约定为「`tests/*.js` 顶层每个文件 = 一个可独立运行的测试，**以退出码表达结果**」，`node tests/run-all.js` 一次跑完（极简零依赖运行器）。现有测试：`tests/check-ptac-budget.js`（PTAutoCheckIn 超时预算 / 状态阶梯 / 不透明成本声明 / `computeUnitBudget` 自测，见 P28）。另有真实页面 HTML 样本（`src/BTSchoolTorrentsTableSample.html`）+ 浏览器 F12 console 手动验证。测试约定与「如何测 userscript」技法见 `tests/README.md`。
- **版本管理**：git（远程 GitHub + Gitee 镜像）

## 开发环境与设置

- 工作目录：`D:\Projects\TampermonkeyScripts`
- `.vscode/settings.json` 配置 cSpell 词典（站点域名等专有名词拼写白名单）
- 无 package.json / 无 npm / 无构建步骤。直接编辑 `src/*.user.js`。
- 测试用 Node 直接跑（无需 `npm install`）：`node tests/run-all.js`（全部）或 `node tests/<某测试>.js`（单个）；语法检查 `node --check src/*.user.js`。

## UserScript 元数据约定（见 conventions.md 第 3 节）

- 必需字段：`@name`（英文）+ `@name:zh-CN`、`@namespace`、`@version`、`@description`、`@author ABacker`、`@license GNU GPL-3.0`、`@tag`。
- `@match`：只声明脚本确实要操作的域名；个人站点用小域名 + 路径限定，避免误伤。
- `@run-at`：`document-start`（尽早拦截 DOM）/ `document-end` / `document-body`（需 body 已存在）。
- `@grant`：用到哪个 GM API 显式声明哪个（`GM_getValue`/`GM_setValue`/`GM_log`/`GM_openInTab`/`GM_addStyle`），没有则 `@grant none`。
- `@downloadURL`/`@updateURL`：支持远程更新（BilibiliEnterFullscreen 用 Gitee 直链，国内访问快）。

## 技术约束

- **版本号**：`@version YYYY.MM.DD.N`——Tampermonkey 依据它判断是否有新版本（结合 `@downloadURL`/`@updateURL` 自动更新）；版本号不变则用户端**永远收不到修复**。
- **现代浏览器选择器**：`:has()` / `:scope` 为 Chrome 105+ / Safari 15.4+ 特性（BTSchoolHelper 解析用）。
- **GM API 依赖**：`GM_openInTab` 需显式 `@grant`；更新脚本时 Tampermonkey 会弹新增权限确认，须接受。批量后台标签无法用 `window.open`（会被弹窗拦截）。
- **跨域数据**：GM 存储按脚本共享、跨域可读——PTAutoCheckIn 跨站状态/任务依赖此特性。
- **无跨文件 import**：Tampermonkey 不支持跨文件 import，共享工具函数靠复制或 `@require` 同一 raw 文件（需权衡更新耦合）。

## 依赖

- 无第三方运行时依赖。每个脚本自带健壮性辅助函数：
  - `parseCommaInt(str)` / `parseCommaIntSafe(str, fb)` —— 千分位整数解析
  - `parseCommaNumber(str)` / `parseCommaNumberSafe` —— 千分位浮点解析
  - `parseFileSizeInBytes(sizeStr)` —— `"8.15GB"` → 字节数（1024 进制，支持 K/M/G/T/P）
  - `waitForElement(selector, timeout)` —— 轮询/`MutationObserver` 等待元素（支持函数选择器）

## 发布与更新流程（详见 conventions.md 第 10 节）

完整工作流见 [conventions.md](./conventions.md) 第 10 节「开发与发布工作流」，此处仅列技术要点：

1. 编辑 `src/*.user.js`。
2. 递增版本号（跨天重置 `N`）。
3. 同步更新 `memory-bank/` 记忆库（受影响条目同次提交）。
4. 推送后脚本可经 `@downloadURL`/`@updateURL` 更新。