# 代码风格与 UserScript 元数据
> 摘要: IIFE / 命名 / 注释标点 / console 分级, 以及 UserScript 元数据头字段约定
> 触发: 写代码, 加元数据, 改脚本头

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
