# CDP 流式 trace 是对象包装，直接当数组解析会崩
> 摘要: `Tracing.start(transferMode=ReturnAsStream)` 的 `IO.read` 结果是 `{"traceEvents":[...]}` 对象包装，须取 `.traceEvents` 后才能 filter
> 触发: 写 CDP Performance/Tracing 验收用例，统计 Paint / Recalculate Style 事件

- **触发**: 用 `Tracing.start` + `IO.read` 采集 5s 静息 trace，`JSON.parse(raw)` 成功但对返回值直接 `.filter(...)` 抛 `TypeError: events.filter is not a function`，用例 FAIL。
- **判别**: Chrome 的流式 trace 输出不是裸事件数组，而是 `{"traceEvents":[...], "metadata":{...}}` 对象（某些版本为逐行 NDJSON）；只看 `JSON.parse` 不报错会误以为拿到数组。解析函数须同时兼容三种形态。
- **处置**: 先 `Array.isArray(data)` 直接返回；再判断 `data.traceEvents` 取数组；最后回退逐行 `JSON.parse` 并清洗 `[`/`]`/尾逗号。断言前再确认 `Array.isArray(events)`，别把「JSON 解析成功」当成「拿到事件数组」。
