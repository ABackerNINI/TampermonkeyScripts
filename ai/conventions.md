# 代码约定（Conventions）

> 维护要求：新增/修改脚本时遵循本文；与脚本实际代码不一致时以**脚本为准**并回来更新本文。

## 0. 核心铁律（动手前必读）

> ⚠️ **修改代码必须同步递增 `@version` 版本号**——这是本仓库最重要的约定，无例外、不可跳过。

详见第 1 节「版本管理」。

## 1. 版本管理

### 铁律：修改代码 ⇒ 同步递增版本号

- **任何代码/元数据的改动，都必须递增脚本头 `@version`**，与代码修改放在**同一次提交**中（不允许「改了代码但忘了版本号」的提交）。
- 原因：Tampermonkey 依据 `@version` 判断脚本是否有新版本（结合 `@downloadURL` / `@updateURL` 自动更新）；版本号不变则用户端**永远不会收到你的修复**。
- 版本号递增规则：`YYYY.MM.DD.N`
  - 跨天修改：`YYYY.MM.DD.1`（如 `2026.08.30.1` → `2026.09.07.1`）；
  - 同一天多次修改：`N` 递增（`2026.09.07.1` → `2026.09.07.2`）。

### 何时必须递增版本号

| 改动类型 | 是否递增 | 说明 |
|----------|:--------:|------|
| 修复 Bug / 新增功能 / 调整逻辑 | ✅ 必须 | 任何行为变化 |
| 修改 `@match` / `@description` / `@grant` 等元数据 | ✅ 必须 | 影响匹配范围/权限/说明 |
| 纯注释 / 代码格式化 | ⬜ 不必（建议不递增） | 不产生行为差异 |
| 只改 `ai/` 知识库文档 | ⬜ 不必 | 不涉及脚本本体 |

### 提交前自查

1. 本次改动的脚本头 `@version` 是否已递增？
2. 版本号是否符合 `YYYY.MM.DD.N`（跨天重置 N、同日递增 N）？
3. 是否与代码改动在**同一次提交**中？
4. 改动行为时，`@description` 是否需要同步更新？

- 提交信息用中文、动宾结构（`添加XX自动签到` / `修复XX流程`），一句话说清改动，可附版本号如 `2026.09.07.2`。

## 2. 代码风格

- 主体包在 `(function () { 'use strict'; ... })();` 中。
- 变量：统一 `const` / `let`，**禁止 `var`**。
- 命名：
  - 常量（含枚举映射表）：`UPPER_SNAKE_CASE`，枚举对象用 `Object.freeze`；
  - 函数/变量：`camelCase`；
  - 函数名前缀表达意图：`parse*`（解析）、`get*`（取值）、`scrollTo*`（滚动）、`click*`（点击）、`handle*`（事件）。
- 日志前缀：文件顶部定义 `const ScriptName = '...'`；输出时统一 `[ScriptName]` 或 `[标签]` 前缀（PTAutoCheckIn 用 `[PTAutoCheckIn]`、BTSchoolHelper 用 `[BTSchool助手]`）。
- **注释与日志用中文，但一律使用英文标点**（`,` `:` `?` 而非 `，` `：` `？`）——历史上因中文标点被 IDE 特殊标记而专门修复过。
- console 分级：成功/过程 `console.log`，可预期失败 `console.warn`，异常堆栈 `console.error`；错误消息中文、含失败对象信息（如选择器、站点名）。

## 3. UserScript 元数据约定

- 必需字段：`@name`（英文）、`@name:zh-CN`、`@namespace`、`@version`、`@description`（中文，说明能力）、`@author ABacker`、`@license GNU GPL-3.0`。
- `@match`：只声明脚本确实要操作的域名；个人站点（PT 站）用小域名 + 路径限定，避免误伤。
- `@run-at`：
  - 需要尽早执行（拦截样式、早期注册监听）：`document-start`；
  - 依赖页面结构渲染完：`document-end`；
  - 需要 body 已存在即可：`document-body`。
- `@grant`：用到哪个 GM API 显式声明哪个；没有则写 `@grant none`（未声明却调用 GM API 会失败）。
- `@tag` 补充主题（如 `utilities`、`BTSchool`、`bilibili`）。
- 支持远程更新的脚本可加 `@downloadURL` / `@updateURL`（国内场景可指向 Gitee 直链）。

## 4. 代码健壮性约定

- 键盘快捷键必须防误触：先检查 `document.activeElement` 是否为 `input` / `textarea` / `select`，是则直接返回。
- 元素可能延迟出现：优先 `MutationObserver` + 超时（见 `waitForElement`），或 `setInterval` 有限重试（如 BilibiliEnterFullscreen 50 次 × 200ms、BTSchoolHelper 10 次 × 500ms）。
- 外部数据解析：文本一律先 `trim`；数字解析走 `parseCommaIntSafe / parseCommaNumberSafe`（千分位兼容 + 兜底值）；文件大小走 `parseFileSizeInBytes` 得到**数值字节**。
- DOM 查询在可预期失败的路径上做空值兜底（`el ? el.textContent : ''`），不抛错中断整行解析。
- 页面跳转/对话框等复杂交互：拆成步骤数组按序执行，允许单步 `ignoreError`（见 PTAutoCheckIn 的 HDBao/蜂巢案例）。

## 5. 脚本内数据流约定（以 PT/表格解析类为例）

- **配置与逻辑分离**：站点/规则配置集中为数据（如 `SITES` 数组、`TorrentState` 映射），引擎只写一套（`executeStep`、`parseTorrentTable`）。新增站点时**只改配置不改引擎**。
- 解析函数返回结构化对象（宁可多带原始元素引用，如 `_row` / `titleElement`，便于后续滚动/样式操作与调试），不直接操作 UI。
- 所有解析出的「时间」尽量同时保留 `absolute`（`Date`/`title` 属性）与 `relativeStr`（页面显示文本），避免依赖站点格式化。

## 6. 文档同步（本项目特有）

- 修改脚本功能后，**同步更新**：
  1. 脚本头 `@version`（**必须**，见第 1 节铁律）+ `@description`（能力变化时）；
  2. `ai/scripts/<脚本名>.md`（结构/字段/站点表变化时）；
  3. 若属通用约定或已知坑，更新 `ai/conventions.md` / `ai/pitfalls.md`；
  4. 新脚本需在 `ai/README.md` 索引登记。
- 新站点/新规则上线前，先在真实页面控制台验证解析与点击日志，再提交。

## 7. 新增站点/脚本检查清单

新增 PTAutoCheckIn 站点：
- [ ] 在 `@match` 增加域名；
- [ ] `SITES` 增加配置对象：`name` / `match` 正则 / `checkInSelector` / `checkInContent` / `alreadyCheckedInContent` / `steps`；
- [ ] 对照站点页面的真实 DOM（非网络截图）核对选择器与文案；
- [ ] 实测：未签到页能点、已签到页不重复点、10 分钟内刷新不重复触发；
- [ ] 递增版本号 + 更新 `ai/scripts/PTAutoCheckIn.md` 站点表。

新增独立脚本：
- [ ] 完整元数据头（见第 3 节）+ IIFE + `ScriptName`；
- [ ] 参照 `project-overview.md` 速查表补充登记；
- [ ] 创建 `ai/scripts/<name>.md` 并在 `ai/README.md` 索引登记；
- [ ] 递增 `@version` 并提交。
