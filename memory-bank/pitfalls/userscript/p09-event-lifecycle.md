# 事件与页面生命周期
> 摘要: `window.onload` 后 SPA 动态渲染的按钮仍可能未出现，监听注册要防重复。
> 触发: 新增页面监听, 排查按钮不出现, 改 onload, 改 GM 持久化

- **触发**: BilibiliEnterFullscreen 依赖 `window.onload`，B 站播放器改版为 SPA 动态渲染。
- **判别**: `onload` 后按钮仍可能未出现；`document.addEventListener` 每次脚本执行注册一次（Tampermonkey 刷新页面即全新执行，一般无碍；但 `GM_` 持久化内容要幂等）。
- **处置**: 靠轮询（50 次 × 200ms）兜底；若仍失效需评估改 `MutationObserver`；监听注册要防重复，`GM_` 持久化内容要幂等。

## P9. 事件与页面生命周期

- BilibiliEnterFullscreen 依赖 `window.onload`：若 B 站播放器改版为 SPA 动态渲染，`onload` 后按钮仍可能未出现 → 靠轮询（50 次 × 200ms）兜底；若仍失效需评估改 `MutationObserver`。
- 监听注册要防重复：`document.addEventListener` 每次脚本执行注册一次（Tampermonkey 刷新页面即全新执行，一般无碍；但 `GM_` 持久化内容要幂等）。

