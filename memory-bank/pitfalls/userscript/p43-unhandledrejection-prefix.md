# 全局 `unhandledrejection` 监听会把**别人的**异常打成自己的前缀，造成归因误导
> 摘要: 全局 `unhandledrejection` 是页面级事件，日志前缀 `[HDHomeUI]` 会把外部异常伪装成本脚本故障，造成归因误导。
> 触发: 全局监听, unhandledrejection, 日志前缀, 归因误导, 零异步

- **触发**: 控制台出现 `[HDHomeUI] WARN UNHANDLED_REJECTION TypeError: Cannot read properties of undefined (reading 'innerText')` —— 但在 HDHomeUI 里搜 `innerText` 一个都搜不到，于是越查越乱。
- **判别**: `unhandledrejection` 是页面级事件，任何脚本、任何页面代码抛出的未处理拒绝都会进这个回调；两步判定缺一不可：① 在本脚本里 grep `innerText`（或报错里提到的属性）搜不到 ⇒ 不是本脚本抛的；② grep `\basync\s+function|\bawait\s|new\s+Promise\b|\.then\s*\(` 命中数为 0 ⇒ 本脚本不可能自己产生 Promise 拒绝，只能是观察方（本例 `innerText` 真实位于 `src/PTAutoCheckIn.user.js:1139` 的 `visibleText(el)`）。
- **处置**: 监听里必须做三件事：① 带 stack 首帧指明真正的抛出方；② 显式写「非本脚本故障」；③ 说明依据（本脚本零异步）；`check-hdui-static.js` 加一条「脚本零异步（无 Promise/async/await/.then）」断言，一旦引入异步立刻变红提醒同时改这段措辞；通用口诀：共享的全局监听（error / unhandledrejection）打日志时，前缀 ≠ 来源，必须先证明「不是我的」再免责。

## P43. 全局 `unhandledrejection` 监听会把**别人的**异常打成自己的前缀，造成归因误导

**症状**：控制台出现
`[HDHomeUI] WARN UNHANDLED_REJECTION TypeError: Cannot read properties of undefined (reading 'innerText')`
—— 但在 HDHomeUI 里搜 `innerText` **一个都搜不到**，于是越查越乱。
**为什么会发生**：脚本为了「不吞异常」注册了全局 `unhandledrejection` 监听（好意：把页面里没人接的
Promise 拒绝记录下来）。但 `unhandledrejection` 是**页面级**事件 —— **任何脚本、任何页面代码**
抛出的未处理拒绝都会进这个回调。日志前缀写的是 `[HDHomeUI]`，于是把一个**外部**异常伪装成了本脚本故障。
**判定方法**（两步，缺一不可）：
1. 在本脚本里 grep `innerText`（或报错里提到的那个属性）—— 搜不到 ⇒ 不是本脚本抛的。
2. 在本脚本里 grep `\basync\s+function|\bawait\s|new\s+Promise\b|\.then\s*\(` —— **命中数为 0**
   ⇒ 本脚本不可能自己产生 Promise 拒绝，**只能是观察方**。
（本例中 `innerText` 真实位于 `src/PTAutoCheckIn.user.js:1139` 的 `visibleText(el)`，且该函数有
`if (!el) return ''` 守卫 ⇒ 抛出点在更上层的调用方。）
**对策**：监听里必须做三件事，否则日志就是误导：
```js
let frame = '';                       // ① 带 stack 首帧，指明真正的抛出方
if (r && r.stack) { const m = /^\s*at\s+(.+)$/m.exec(String(r.stack)); if (m) frame = ' @ ' + m[1].trim().slice(0, 160); }
Diag.warn('UNHANDLED_REJECTION', msg + frame + ' —— 来自页面或其它脚本(本脚本无异步代码), 非 HDHomeUI 故障');
                                      // ② 显式写明「非本脚本故障」 ③ 说明依据(零异步)
```
**不变量要钉进测试**：`check-hdui-static.js` 里加一条「脚本零异步（无 Promise/async/await/.then）」断言 ——
一旦将来有人引入异步代码，这条立刻变红，提醒同时去改这段措辞（否则免责声明就成了谎言）。
**通用口诀**：**共享的全局监听（error / unhandledrejection）打日志时，前缀 ≠ 来源；必须先证明"不是我的"再免责。**


