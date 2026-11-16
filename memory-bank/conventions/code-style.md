# 代码风格与 UserScript 元数据
> 摘要: IIFE / 命名 / 注释标点 / console 分级, 以及 UserScript 元数据头字段约定
> 触发: 写代码, 加元数据, 改脚本头

## 1.5. 非 ASCII 图形符号禁令 (随 auto-qb 口径 2026-11-17 移植)

**代码 / 配置不用装饰性图形符号, 一律 ASCII 表达; 文档 (`.md` / 交付 `*.html`) 不受限。**

- 口径: 管**装饰性 / 状态性象形字符**(终端 / TTY 下显示成方框、乱码或不可见、破坏对齐的那类), **不管中文行文里的语义标点**; 箭头(`→` `⇒` `←`)、章节符(`§`)与数学 / 逻辑符(`≠` `≈` `≤`)豁免 —— 凡不在禁用码位区间者一律不判。
- 禁用类(按码位区间判): 带圈 / 括号码 `U+2460-24FF`·`U+2776-2793`(`①` `❶`) · 杂项符号 `U+2600-26FF`(`★` `⚠`) · Dingbats `U+2700-27BF`(`✓` `❗` `✅` `❌` `➡`) · 符号箭头 `U+2B00-2BFF`(`⬆`) · 几何块 `U+25A0-25FF`(`■` `●` `▲`) · emoji / pictograph `U+1F000-1FAFF`(`📌` `🔍` `🐛`) · 不可见 / 已损坏 `U+FE0F`·`U+FFFD`·`U+FEFF`(变体选择符 / 替换字符 / BOM)。
- ASCII 替代参考: ❗→`!` ｜ ⚠→`WARN:` ｜ ✅→`[OK]` ｜ ❌→`[X]` ｜ ★→`*` ｜ ✓→`[x]` ｜ ⬜→`[ ]` ｜ ①→`1.`
- 覆盖: `.js` / `.user.js` / `.py` / `.yml` / `.toml` / `.json` / `.css` / 源码与配置面的注释、字符串字面量、日志模板; **用户可见 UI 文案不在此列**(延续 WebUI 可见符号先例)。
- **机检面未随迁**(auto-qb 由 pytest 守阵从同一张判据表派生, 本仓无 pytest 通道): 新代码按本节自律, 由评审面把关; 测试基建接入后再挂机检并同步判据表。

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
