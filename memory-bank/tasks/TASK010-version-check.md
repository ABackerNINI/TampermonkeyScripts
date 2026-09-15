# [TASK010] - 发布自动化（版本号校验）

**Status:** Pending
**Added:** 2026-09-16
**Updated:** 2026-09-16

## Original Request

增加版本号校验脚本或 Git 钩子，防止漏更 `@version`。

## Thought Process

- 读取脚本头 `@version` 与上次 tag 比对。
- 或 Git 钩子阻止「改了代码但没递增版本号」的提交。
- 核心铁律：任何代码/元数据改动必须递增版本号（见 conventions.md 第 1 节）。

## Implementation Plan

- [ ] 设计版本号校验脚本或 Git 钩子
- [ ] 接入提交流程

## Progress Tracking

**Overall Status:** Not Started - 0%

## Progress Log
### 2026-09-16
- 任务登记（中期改进）。