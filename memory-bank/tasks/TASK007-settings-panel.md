# [TASK007] - 设置面板化（GM 存储驱动）

**Status:** Pending
**Added:** 2026-09-16
**Updated:** 2026-09-16

## Original Request

提供统一设置（GM 菜单或注入面板）驱动各脚本开关与行为。

## Thought Process

- PTAutoCheckIn：签到总开关、单站开关、间隔时长。
- BTSchoolHelper：高亮色、是否低亮置顶、是否自动滚动。
- BilibiliEnterFullscreen：是否自动网页全屏。
- 约定：设置项默认值与旧版行为一致，改动同步 `GM_setValue` 并立即生效。

## Implementation Plan

- [ ] 设计 GM 存储设置结构
- [ ] 各脚本接入设置项读取
- [ ] 提供 UI（GM 菜单或注入面板）

## Progress Tracking

**Overall Status:** Not Started - 0%

## Progress Log
### 2026-09-16
- 任务登记（中期改进）。