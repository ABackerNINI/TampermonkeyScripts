# 签到防重复机制的坑（10 分钟间隔）
> 摘要: 10 分钟冷却按 `origin+pathname` 分页面计时、iframe 直接 return、前台 sleep 看似无反应。
> 触发: 排查冷却, 改签到调度, 排查 iframe 不签, 排查页面无反应

- **触发**: 记录 key = `lastActivation_` + `origin + pathname`（**含路径**），脚本在 iframe 中直接 return（`window.top !== window.self`）。
- **判别**: 同一站点不同页面各自计时（若期望"全站一次签到"需改为仅 `origin`）；等待逻辑先 `loadLastActivationTime` 再 `saveLastActivationTime`，首次运行会立即执行（lastTime=0）。
- **处置**: **注意**：`waitForFromLastActivation` 在激活记录存在且未满 10 分钟时会在前台 sleep（可能长达数分钟），期间页面看似无反应——属预期行为，勿误判为卡死。

## P6. 签到防重复机制的坑（10 分钟间隔）

- 记录 key = `lastActivation_` + `origin + pathname`：**含路径**，同一站点不同页面各自计时；若期望"全站一次签到"需改为仅 `origin`。
- 脚本在 iframe 中直接 return（`window.top !== window.self`），iframe 页面不会签到。
- 等待逻辑先 `loadLastActivationTime` 再 `saveLastActivationTime`：首次运行会立即执行（lastTime=0）。
- **注意**：`waitForFromLastActivation` 在激活记录存在且未满 10 分钟时会在前台 sleep（可能长达数分钟），期间页面看似无反应——属预期行为。

