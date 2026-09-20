# 技术语境（Tech Context）

> 记忆库核心文件：使用的技术、开发环境、技术约束、依赖。

## 技术栈

- **语言**：JavaScript（ES6+，`const`/`let`，禁止 `var`）
- **运行时**：浏览器 + Tampermonkey（Greasemonkey API）
- **脚本格式**：`.user.js`（单文件，含 UserScript 元数据头）
- **测试**：**无测试框架**（刻意保持：无 `package.json` / 无 npm / 无构建），但已有 `tests/` 开发期测试区 —— 约定为「按被测脚本分子目录 `tests/<脚本名>/*.js`（如 `tests/ptautocheckin/`），每个文件 = 一个可独立运行的测试，**以退出码表达结果**」，`node tests/run-all.js` 一次跑完（极简零依赖运行器）。现有测试：`tests/ptautocheckin/check-ptac-budget.js`（PTAutoCheckIn 超时预算 / 状态阶梯 / 不透明成本声明 / `computeUnitBudget` 自测，见 P28）与 `check-ptac-panel.js`（主面板「失焦自动关闭」+「重现不弹主面板」两条交互不变式的静态校验，2026.09.19.4）；
以及 `tests/ptautocheckin/sim-*.js` 共 13 个**仿真站**用例（`sim-security-s*.js` 11 个安全向 + `sim-hdhome-pagetext.js` 站点功能向 + `sim-panel-autoclose.js` UI 交互向，2026.09.19 起仿真站不再只服务安全用例）：起本地仿真服务器 + 一次性 Chrome
（`--host-resolver-rules="MAP * 127.0.0.1:<port>"` 让真实域名 URL 落到本机，**生产脚本零改动**即可命中 `@match`），
用 CDP（Node 22 内置 `WebSocket`，零依赖）注入「GM 垫片 + userscript」跑真浏览器端到端断言，
覆盖安全向为主（见 P30），站点功能向由 `sim-hdhome-pagetext.js` 打样（已签/点击落地/入口消失三态，
站点页面模型见 `tests/lib/sim/sites.js`，支持按 host 路由不同页面模型的假站）。另有真实页面 HTML 样本
（`src/BTSchoolTorrentsTableSample.html`）+ 浏览器 F12 console 手动验证。测试约定与「如何测 userscript」技法见 `tests/README.md`。
HDHomeUI 另有 **5 个「未知元素安全」用例**（`check/sim-hdui-hide-allowlist`、`sim-hdui-unknown-canary`、
`sim-hdui-overlay-safety`、`sim-hdui-unknown-tags`）—— 它们是**反向（deny-by-default）断言**，
专门回答「站点改版冒出来的东西还在不在」，与既有正向断言互补；配套共享基建
`tests/lib/hdui-scan.js`（五档渲染扫描 + 金丝雀探针，从 gitignore 的 `_verify-hdui-real-render.js` 提升而来，
不入库就永远无法回归）。详见 `pitfalls.md` P66–P69。
- **CI**：`.github/workflows/ci.yml` —— GitHub Actions，`ubuntu-latest` × Node 20/22 矩阵：
  `node --check src/*.user.js` 语法检查 + `node tests/run-all.js -v` 跑全部测试。
  （旧版 ci.yml 是从一个 Python/uv/pytest 仓库复制过来忘了清理的，2026-09-18 已整体替换。）
  仿真站用例在无浏览器的环境会打印 `SKIP` 并退 0，不会让 CI 变红；GitHub 的 ubuntu 镜像自带 Chrome。
  ⚠️ 仿真站还依赖 **Node 22 内置的全局 `WebSocket`**（`cdp.js` 靠它做到零依赖）——
  Node 20 上 `new WebSocket` 会 ReferenceError，所以 `runCase` 加了第二道门禁让它也走 `SKIP`
  （否则 CI 的 Node 20 job 会**失败**而不是跳过；静态用例不用 `runCase`，在 Node 20 上照跑）。
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