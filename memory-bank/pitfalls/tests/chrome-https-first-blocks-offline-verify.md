# Chrome 新版 HTTPS-First 升级把离线真站验收拦成空文档(ERR_BLOCKED_BY_CLIENT)

> 摘要: Chrome 新版 HTTPS-First 升级把离线真站验收拦成空文档(ERR_BLOCKED_BY_CLIENT)
> 触发: HTTPS-First, HttpsUpgrades, ERR_BLOCKED_BY_CLIENT, 离线验收, host-resolver-rules, 空文档, 卸妆

## 本篇只回答

「离线真站/仿真验收(本地静态服务器 + `--host-resolver-rules` MAP 域名)里, 公网域名的 http 导航为何变成空文档、结构守卫为何误判卸妆、怎么修」—— 只覆盖这一类 Chrome 导航策略拦截, 不覆盖 SSL 证书/代理配置问题。

### Chrome 新版默认 HttpsUpgrades 会把「公网域名 http 导航」拦死在本地 MAP 服务器之前

- **触发**: 用「本地静态服务器 + `--host-resolver-rules=MAP * 127.0.0.1:<port>`」做离线渲染验收(真站脱敏整页/仿真站), 导航目标是**公网域名 + 明文 http**(如 `http://hdhome.org/torrents.php`)。Chrome 自动更新启用 HTTPS-First 升级(`HttpsUpgrades`/`HttpsFirstBalancedModeAutoEnable`)后必现——测试代码零改动也会突然红, 属环境漂移。
- **判别**: 三个信号同时成立即可确诊: ① 页面是空壳(`documentElement.outerHTML` 约 39 字符, 四处锚点(ANCHORS)全缺), 报错形态像「结构守卫卸妆/`E_ANCHOR_MISSING`」但**样本本身完好**(四处锚点在样本文件里 grep 全命中, 会误诊成「样本过期」); ② `Page.navigate` 的返回值带 `errorText: "net::ERR_BLOCKED_BY_CLIENT"`, **本地服务器零请求命中**(只收到 Chrome 自身 cup2key 升级 ping); ③ 拦截面按域名分: 公网 TLD(.org/.com/…)全拦, `*.test`/`*.invalid` 等伪 TLD 正常; 对同一域名直接 `https://` 导航报 `ERR_SSL_PROTOCOL_ERROR`(TLS 撞纯 HTTP 服务器)。注意 CDP 层 `Page.frameNavigated`/`Network.loadingFailed` **都为空**——拦截发生在导航发起前, 别在这两个事件里找线索。
- **处置**: 测试驱动的 Chrome 启动参数补 `--disable-features=HttpsUpgrades,HttpsFirstBalancedModeAutoEnable,HttpsFirstBalancedMode`(一行修复); 共享 harness 的 `--disable-features` 清单同步补全。修完先用「直连 `127.0.0.1:<port>/<路径>`」交叉验证样本/仿真页本身完好, 再恢复域名导航。**取证纪律**: 空文档类失败先量 `outerHTML.length` 与服务器命中日志, 再下「样本过期/站点改版」结论——本坑曾差点让用户白存一份真站样本。
- **守阵**: 无机检(Chrome 行为随版本漂移, 静态断言守不住); 依赖全量测试本身——`verify-hdui-real-page.js` 是这条坑的哨兵, 它绿 = 该组 feature 禁用仍生效。
- **复发**: 0 (复踩时在此行追加「+N (日期): 为什么没命中」, 无复发可删本行)
