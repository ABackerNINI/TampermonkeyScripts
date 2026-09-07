# BilibiliEnterFullscreen.user.js — B站 Enter 键全屏

> 源文件：`src/BilibiliEnterFullscreen.user.js` ｜ 版本 `2026.07.22.7`（升级时同步更新）

## 功能概述

在 B 站视频/番剧播放页提供全屏快捷键与自动网页全屏：

1. **自动网页全屏**：页面加载后自动尝试点击「网页全屏」按钮（最多重试 50 次 × 200ms，成功即停）。
2. **Enter**：切换**全屏**。
3. **Shift + Enter**：切换**网页全屏**。
4. 切换后延迟 50ms 让当前焦点元素/弹幕输入框失焦，避免全屏后弹幕输入框不自动隐藏。

## 脚本元数据要点

- `@match *.bilibili.com/video/*` 与 `*.bilibili.com/bangumi/*`
- `@run-at document-body`：页面主体存在后尽早执行。
- `@grant none`。
- 头部含 `@downloadURL` / `@updateURL`（Gitee 直链，因国内访问 GitHub 慢）。
- `ScriptName = 'B站Enter键全屏'`。

## 核心逻辑

### 自动网页全屏（window.onload 后启动）
```js
window.onload = (function () {
    const maxTryCount = 50;   // 最多 50 次
    let tryCount = 0;
    let timer = setInterval(function () {
        tryCount++;
        if (clickWebFullscreenButton() || tryCount >= maxTryCount) {
            clearInterval(timer);
        }
    }, 200);                  // 每 200ms 一次
})();
```
- 页面加载早期播放器可能尚未渲染，因此轮询点击直至成功或达上限。
- 演进记录：间隔曾从 1000ms 调到 200ms，上限从 10 调到 50，以应对慢加载。

### 按钮点击（多选择器按优先级）
```js
function clickButton(selectors, buttonName) {
    for (let selector of selectors) { … }  // 命中即 click 并返回 true
}
```
- `clickFullscreenButton()`：「全屏」按钮：`.bpx-player-ctrl-btn.bpx-player-ctrl-full` → `[aria-label="全屏"]`
- `clickWebFullscreenButton()`：「网页全屏」按钮：`.bpx-player-ctrl-btn.bpx-player-ctrl-web` → `[aria-label="网页全屏"]`
- 设计初衷：应对 B 站改版导致类名/aria-label 变化，维护多条候选路径。

### 键盘监听
```js
document.addEventListener('keydown', handleKeyDown);
```
- `Enter`（`event.key === 'Enter'`）且非输入框（`input`/`textarea`/`select`）时：`preventDefault` + `stopPropagation`（阻止焦点跳弹幕输入框）。
- `shiftKey` → 网页全屏；否则全屏。
- 50ms 后 `blurActiveElement()`。

### 失焦处理 blurActiveElement()
1. 若 `document.activeElement` 非 body，先 blur。
2. 针对弹幕输入框的多候选选择器逐一 blur：`.bpx-player-dm-input`、`input[class*="dm-input"]`、`input[class*="danmaku"]`、`[class*="danmaku"] input`。

## 维护提示

- **B 站播放器改版**是最大风险：优先检查 `.bpx-player-ctrl-btn` 相关类名与 `aria-label` 文案是否变化，更新 `clickFullscreenButton` / `clickWebFullscreenButton` 的候选选择器数组（把新选择器放最前）。
- 自动网页全屏依赖 `window.onload`；若站点改为 SPA 式加载需评估改用 MutationObserver。
- 改动后递增 `@version`，并同步考虑 Gitee 直链文件更新。
