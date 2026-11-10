# 安全审计(本地仿真站)结论: 站点可控数据进入「跨站共享存储 + 宿主 DOM」的三条通道
> 摘要: 站点可控数据进入「跨站共享存储 + 宿主 DOM」的三条通道：已修 4 项、残留 2 项、正向基线一批。
> 触发: 做安全审计, 接入仿真站, 排查跨站信标, 改 shadow mode

- **触发**: 2026-09-18 搭了 `tests/lib/sim/` 仿真站做安全向测试(详见 `memory-bank/tasks/TASK017-*.md`), 用 `--host-resolver-rules="MAP * 127.0.0.1:<port>"` 让真实域名 URL 落到本地服务器, **生产脚本零改动**即可命中 `@match`；共 11 个用例(`tests/ptautocheckin/sim-security-s*.js`)。
- **判别**: 脚本同时做了三件"把控制权交给站点"的事 —— ① 把**页面内容**当事实来源(按钮文案/href/favicon); ② 把结论写进**脚本级、跨所有 @match 域共享**的 GM 存储; ③ 把面板 UI 注入**宿主页面的 DOM**；这三条各对应一条可利用通道。
- **处置**: 已修复(2026.09.18.4): S03 **favicon 跨站信标** → 采集前校验 `isSameSiteHost`(本站主域或其子域, 兼容 CDN 图标), 跨站丢弃并回落 `/favicon.ico`; S05 **宿主页面读穿面板** → 改 `attachShadow({mode:'closed'})`(脚本自身全程持有 `shadow` 引用, 不需要 `shadowRoot`, 功能无影响); S07 **`?ptacRetry` 强制动作** → 强制重试改为必须出示脚本自签的**一次性票据** `ptacToken`(存 `ptac_retryticket_<uid>`, 校验后立即作废, TTL 10 分钟); S09a **站外伪造签到入口** → 点击前 `hrefIsOffSite()` 校验 host 与协议, 被拒时返回 `{refused:true}`, 主流程记 `failed`(**不能**继续走"点击后确认", 否则会写成 pending 谎称"已点击")。残留风险(已评估, 暂不修, 需真站回归后再定): S09b 同站任意参数入口、S13 `@match` 过宽(29 条 `@match` 全是 `*://*.域名/*` —— 含**明文 http**(可被 MITM 注入)且覆盖**任意子域**)。**通用教训**: 「站点提供的数据」一律属于**不可信输入** —— 包括按钮文案、href、favicon URL、URL 参数；凡是"这个值会被存下来 / 会被点 / 会被当 URL 用"的地方, 都要有明确的来源约束(同站? 同协议? 有票据?), 而不是只校验"长得像不像"。

## P30. 安全审计(本地仿真站)结论: 站点可控数据进入「跨站共享存储 + 宿主 DOM」的三条通道

**背景**: 2026-09-18 搭了 `tests/lib/sim/` 仿真站做安全向测试(详见 `memory-bank/tasks/TASK017-*.md`),
用 `--host-resolver-rules="MAP * 127.0.0.1:<port>"` 让真实域名 URL 落到本地服务器,
**生产脚本零改动**即可命中 `@match`。共 11 个用例(`tests/ptautocheckin/sim-security-s*.js`)。

**根因结构**: 脚本同时做了三件"把控制权交给站点"的事 ——
① 把**页面内容**当事实来源(按钮文案/href/favicon);
② 把结论写进**脚本级、跨所有 @match 域共享**的 GM 存储;
③ 把面板 UI 注入**宿主页面的 DOM**。
这三条各对应一条可利用通道。

### 已修复(2026.09.18.4)

| 编号 | 问题 | 机制 | 修复 |
|------|------|------|------|
| S03 | **favicon 跨站信标** | `collectFavicon` 只滤伪协议(`^https?:`)不滤来源 → 站 A 挂一个外链 `<link rel=icon>`, 该 URL 以 `ptac_favicon_<uid>` 长期驻留; 此后用户在**任意其它 PT 站**开面板都会把它当 `<img src>` 发出 → 站 A 拿到跨站跟踪信标 | 采集前校验 `isSameSiteHost`(本站主域或其子域, 兼容 CDN 图标), 跨站丢弃并回落 `/favicon.ico` |
| S05 | **宿主页面读穿面板** | UI 用 `attachShadow({mode:'open'})` → 宿主页面脚本可 `getElementById('ptac-root-v2').shadowRoot` 读出**全部 33 个站点的清单与今日状态**(实测可读) | 改 `mode:'closed'`; 脚本自身全程持有 `shadow` 引用, 不需要 `shadowRoot`, 功能无影响 |
| S07 | **`?ptacRetry` 强制动作** | 任何人诱导用户打开 `<站点>/?ptacRetry=<uid>` 即触发 `forceCooldown:true`, **无视 10 分钟冷却**直接点击(实测冷却窗内两次 = 2 次点击) | 强制重试改为必须出示脚本自签的**一次性票据** `ptacToken`(存 `ptac_retryticket_<uid>`, 校验后立即作废, TTL 10 分钟); 无票据退化成普通访问 |
| S09a | **站外伪造签到入口** | 选择器只约束 href 的**子串**(`a[href*="attendance.php"]`), 故 `https://evil.test/attendance.php` 同样命中 → 脚本带着用户会话点去站外 | 点击前 `hrefIsOffSite()` 校验 host 与协议; 被拒时返回 `{refused:true}`, 主流程记 `failed`(**不能**继续走"点击后确认", 否则会写成 pending 谎称"已点击") |

### 残留风险(已评估, 暂不修, 需真站回归后再定)

- **S09b 同站任意参数入口**: 站点仍可放一个文案合规、href 为 `attendance.php?action=…` 的链接,
  脚本会点并记为 success。不修的理由: 攻击者在**自己站内**本就能以用户身份发起任意请求,
  脚本只是省掉了用户那一次点击; 而"禁止 href 带配置外的 query"会误伤真实站点
  (配置里确有 `index.php?action=addbonus` 这类带参入口), 属于会破坏功能的改动。
  真要做, 建议做成**按 unit 声明 href 白名单**(配置驱动), 而不是全局一刀切。
- **S13 `@match` 过宽**: 29 条 `@match` 全是 `*://*.域名/*` —— 含**明文 http**(可被 MITM 注入)
  且覆盖**任意子域**(实测脚本会在 `cdn.tangpt.top` 上运行并注入 UI)。
  收紧到 `https://` 的前提是确认每个站都支持 https, **必须真站回归**, 故本轮不动;
  `matchUnit` 按 host 全等比较, 子域不会误匹配到 unit(不点击), 这点是对的。

### 已验证为"没问题"的正向基线(防回归)

`esc()` 全量转义 → 跨站存储型 **XSS 不成立**(S02); favicon 伪协议过滤有效(S04);
无 `window.__*` 后门、无 `unsafeWindow`(S01); 无 `eval`/`GM_xmlhttpRequest`/`@connect`,
`@grant` 恰为 4 个最小集(S17/S18); 冷却期内不重复点击且**不把 unconfirmed 改写成 failed**(S11);
无签到入口时在预算内收敛为 unconfirmed 不挂死(S16); 1MB 按钮文案不进存储、面板不崩(S15)。

**通用教训**: 「站点提供的数据」一律属于**不可信输入** —— 包括按钮文案、href、favicon URL、
URL 参数。凡是"这个值会被存下来 / 会被点 / 会被当 URL 用"的地方, 都要有明确的来源约束
(同站? 同协议? 有票据?), 而不是只校验"长得像不像"。

