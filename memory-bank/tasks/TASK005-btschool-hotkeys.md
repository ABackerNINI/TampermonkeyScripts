# [TASK005] - BTSchoolHelper 快捷键增强

**Status:** Pending
**Added:** 2026-09-16
**Updated:** 2026-09-16

## Original Request

增强 BTSchoolHelper 的键盘快捷键（N/B 键跳转 + 当前选中行高亮）。

## Thought Process

- 空格行为已有；补充 `2xFree 下一个`（N）、`2xFree 上一个`（B）并支持循环边界提示（控制台日志）。
- 键盘高亮当前选中种子行（视觉反馈），便于连续浏览。
- 依赖 TASK003（先修命名不一致，N 键才能工作）。

## Implementation Plan

- [ ] 依赖 TASK003 完成
- [ ] 接入 N/B 键到 `handleKeyDown`，补全 `scrollToNext2xFreeTorrent` / 新增上一个
- [ ] 键盘高亮当前选中行

## Progress Tracking

**Overall Status:** Not Started - 0%

## Progress Log
### 2026-09-16
- 任务登记。待 TASK003 完成后进行。