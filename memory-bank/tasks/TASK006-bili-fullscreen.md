# [TASK006] - BilibiliEnterFullscreen 适配加固

**Status:** Pending
**Added:** 2026-09-16
**Updated:** 2026-09-16

## Original Request

加固 `src/BilibiliEnterFullscreen.user.js` 对 B 站改版的适配。

## Thought Process

- 评估将自动网页全屏由 `window.onload + 轮询` 升级为 `MutationObserver` 监听播放器容器出现，减少无效点击日志。
- 补充「倍速/画中画」相关键位冲突检查（Enter 在输入法组合中不应触发——已防 input，但 IME 候选框场景需再验）。

## Implementation Plan

- [ ] 评估 MutationObserver 方案
- [ ] 补充 IME 候选框场景的键位冲突检查
- [ ] 递增 `@version`，同步更新 `memory-bank/scripts/BilibiliEnterFullscreen.md`

## Progress Tracking

**Overall Status:** Not Started - 0%

## Progress Log
### 2026-09-16
- 任务登记。