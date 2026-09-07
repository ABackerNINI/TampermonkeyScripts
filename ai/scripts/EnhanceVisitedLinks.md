# EnhanceVisitedLinks.user.js — 已访问链接增强

> 源文件：`src/EnhanceVisitedLinks.user.js` ｜ 版本 `2026.08.09.1`（升级时同步更新）

## 功能概述

全局（所有网站）增强已访问链接（`:visited`）的辨识度：

- 明色模式下：中度亮度紫色 `#6a4dad`。
- 暗色模式（`prefers-color-scheme: dark`）：更高亮度紫色 `#b380ff`。
- 以 `!important` 覆盖站点默认样式。
- 点状下划线（描述如此；实际当前样式表仅设置 `color`，如需下划线可扩展 `text-decoration`）。

## 脚本元数据要点

- `@include *`：全局生效。
- `@run-at document-start`：尽早注入避免站点样式覆盖 / 闪烁。
- `@grant GM_addStyle`。
- 无 `ScriptName` 常量（本脚本极少打日志）。

## 核心逻辑

### 样式注入 `injectStyles()`
1. 移除旧的 `#my-visited-link-style`（避免重复注入）。
2. `GM_addStyle(style)`。
3. 找到 `style:last-child` 打上 id `my-visited-link-style` 便于下次移除。

### URL 变化检测（SPA 软导航兼容）
```js
let lastUrl = location.href;
// 1) MutationObserver 监听 document.body 子树
// 2) 降级：setInterval 每 1s 比对 location.href
// 任一检测到 URL 变化 → 200ms 后重新 injectStyles()
```
- 双保险设计：MutationObserver 覆盖常规软导航；interval 作为兜底（某些站点可能干扰 observer 或脚本注入时机）。
- 重复注入成本低（先删后加），故不做复杂去重。

## 维护提示

- 若要在暗色/明色下调整紫色色值，修改 `style` 模板字符串即可（两处媒体查询块）。
- 若站点使用 shadow DOM 或以 `<a>` 之外的伪装链接样式，可考虑补充；当前设计保持简单。
- 改动后递增 `@version`。
