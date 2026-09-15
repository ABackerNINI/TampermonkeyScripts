# [TASK008] - 解析工具函数收敛

**Status:** Pending
**Added:** 2026-09-16
**Updated:** 2026-09-16

## Original Request

将多个脚本重复的解析工具函数收敛为共享片段或独立 utils 用户脚本。

## Thought Process

- 重复函数：`parseCommaInt(Safe)` / `parseCommaNumber(Safe)` / `parseFileSizeInBytes` / `waitForElement`。
- 约束：Tampermonkey 不支持跨文件 import；可考虑 `@require` 同一 raw 文件，需权衡更新耦合。

## Implementation Plan

- [ ] 评估 `@require` 方案与耦合影响
- [ ] 收敛共享工具函数

## Progress Tracking

**Overall Status:** Not Started - 0%

## Progress Log
### 2026-09-16
- 任务登记（中期改进）。