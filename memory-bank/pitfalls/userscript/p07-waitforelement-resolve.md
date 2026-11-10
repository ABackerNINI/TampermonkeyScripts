# `waitForElement` 的写法陷阱（PTAutoCheckIn）
> 摘要: 覆盖 `resolve` 只为命中时清超时定时器，重构勿删 `clearTimeout`。
> 触发: 重构 waitForElement, 改轮询选择器, 排查 Promise reject

- **触发**: 读到 `const origResolve = resolve; resolve = (value) => { clearTimeout(timer); origResolve(value); };` 的写法。
- **判别**: 覆盖 `resolve` 仅为**在命中时清除超时定时器**，属合法但易被误读；重构时勿删掉 `clearTimeout`，否则元素在超时前命中后定时器仍会触发 `reject`（Promise 已定型，无副作用但浪费）。
- **处置**: 保留 `clearTimeout`；函数选择器每次轮询都会执行，需保证**无副作用、可重复调用**（蜂巢对话框查找函数即为此模式）。

## P7. `waitForElement` 的写法陷阱（PTAutoCheckIn）

```js
const origResolve = resolve;
resolve = (value) => { clearTimeout(timer); origResolve(value); };
```
- 覆盖 `resolve` 仅为**在命中时清除超时定时器**，属合法但易被误读；重构时勿删掉 `clearTimeout`，否则元素在超时前命中后定时器仍会触发 `reject`（Promise 已定型，无副作用但浪费）。
- 函数选择器每次轮询都会执行，需保证**无副作用、可重复调用**（蜂巢对话框查找函数即为此模式）。

