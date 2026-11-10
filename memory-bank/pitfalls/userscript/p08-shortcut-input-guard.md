# 键盘快捷键误触输入框
> 摘要: 未检查 `document.activeElement` 会让打字误触全屏/跳转快捷键。
> 触发: 新增快捷键, 排查打字误触, 改 keydown

- **触发**: 在弹幕框/搜索框打字触发全屏/跳转。
- **判别**: 未检查 `document.activeElement`。
- **处置**: 所有 `keydown` 处理先判 `input` / `textarea` / `select` 直接 `return`（BilibiliEnterFullscreen 与 BTSchoolHelper 均已实现，新增快捷键照抄）。

## P8. 键盘快捷键误触输入框

**症状**：在弹幕框/搜索框打字触发全屏/跳转。
**原因**：未检查 `document.activeElement`。
**正确做法**：所有 `keydown` 处理先判 `input` / `textarea` / `select` 直接 `return`（BilibiliEnterFullscreen 与 BTSchoolHelper 均已实现，新增快捷键照抄）。

