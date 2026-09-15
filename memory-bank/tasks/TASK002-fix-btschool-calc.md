# [TASK002] - 修复 BTSchoolHelper 时魔数值恒为 0（P2）

**Status:** In Progress
**Added:** 2026-09-16
**Updated:** 2026-09-16

## Original Request

修复 `src/BTSchoolHelper.user.js` 的时魔字段 `t.calcA` / `t.calcAve` 恒为 `0` 的问题。

## Thought Process

- 单元格 `data-calc-a="0.0005235113302643479"` 明明有浮点值，但解析结果恒为 0。
- 原因：第 246/251 行用 `parseCommaIntSafe(attr, 0)` 解析浮点属性；`parseCommaInt` 内部用 `/^-?\d+$/` 校验，含小数点 → NaN → 兜底 0。
- 修复：改用 `parseCommaNumberSafe(attr, 0)`（浮点解析）。

## Implementation Plan

- [ ] `src/BTSchoolHelper.user.js` 第 246/251 行 `parseCommaIntSafe` → `parseCommaNumberSafe`
- [ ] 确认显示逻辑与排序示例依赖 calcA/calcAve 的值
- [ ] 递增 `@version`，同步更新 `memory-bank/scripts/BTSchoolHelper.md` 与 `memory-bank/pitfalls.md` P2

## Progress Tracking

**Overall Status:** Pending - 0%

### Subtasks
| ID | Description | Status | Updated | Notes |
|----|------------|--------|---------|-------|
| 2.1 | 改解析函数 | Pending | - | `parseCommaIntSafe`→`parseCommaNumberSafe` |
| 2.2 | 递增版本号 + 知识库同步 | Pending | - | 与代码同次提交 |

## Progress Log
### 2026-09-16
- 任务登记（源自 `memory-bank/pitfalls.md` P2）。待实施。