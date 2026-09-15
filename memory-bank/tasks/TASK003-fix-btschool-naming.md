# [TASK003] - 修复 BTSchoolHelper 命名不一致（P10）

**Status:** In Progress
**Added:** 2026-09-16
**Updated:** 2026-09-16

## Original Request

修复 `src/BTSchoolHelper.user.js` 的 `scrollToNext2xFreeTorrent` 内函数调用名与实际定义不一致的问题，为启用 N 键前置。

## Thought Process

- `scrollToNext2xFreeTorrent` 内调用 `getBottomTorrentId()`（小写 d）与 `arrayFindIndex`，而实际定义是 `getBottomTorrentID()`（大写 D）与 `arrayFind`。
- 当前 N 键功能未启用，故不报错（ReferenceError 未触发）。
- 启用 N 键前必须先对齐命名，否则直接 ReferenceError。

## Implementation Plan

- [ ] `scrollToNext2xFreeTorrent` 内调用名对齐：`getBottomTorrentId()`→`getBottomTorrentID()`、`arrayFindIndex`→`arrayFind`
- [ ] 递增 `@version`，同步更新 `memory-bank/scripts/BTSchoolHelper.md` 与 `memory-bank/pitfalls.md` P10
- [ ] 完成本任务后 TASK005（快捷键增强）可进行

## Progress Tracking

**Overall Status:** Pending - 0%

### Subtasks
| ID | Description | Status | Updated | Notes |
|----|------------|--------|---------|-------|
| 3.1 | 对齐函数调用名 | Pending | - | 两处调用名 |
| 3.2 | 递增版本号 + 知识库同步 | Pending | - | 与代码同次提交 |

## Progress Log
### 2026-09-16
- 任务登记（源自 `memory-bank/pitfalls.md` P10）。待实施。