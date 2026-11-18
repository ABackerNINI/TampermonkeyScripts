# 37 —— PTAutoCheckIn 全量绿(Railgun 已签检测校准)

> 摘要: PTAutoCheckIn 全量绿(Railgun 已签检测校准)
> 基线时间: 2026-11-19 05:58

## 验收数字

- TOTAL: 37 · 通过: 37 · 失败: 0
- 汇总行(实测誊写): `✔ 全部 37 个测试通过。`
- 差值(vs 上一片 26-11-19-0306-ptautocheckin-sites): 0 变化 —— 本轮仅动 Railgun 检测字段与注释(已签文案校准 + 新增落地标记), 测试面无增删, 37/37 恒绿。

## 本改动面

- `src/PTAutoCheckIn.user.js`: Railgun 已签检测按真站已签样本校准 —— `alreadyCheckedInContent` `签到已得`(旧口径猜的) → `今日已签到`(真站已签横幅 `<b>今日已签到</b>`); 新增 `landingCheckedInContent: '签到成功'`(attendance.php 签到后才出现的 h2 文本; 落地页上 `a[href*="attendance.php"]` 文档序首中是通知铃占位 href, 按钮文案通道在落地页失效, 同 P18/PTT 机制); 配置块注释同步校准记录; `@version` 2026.11.19.1 → 2026.11.19.2。
- 知识库: 新坑 `pitfalls/site-adapt/p33-href-decoy-first-match.md`(href 子串选择器整页唯一假设只对入口页成立 + 已签文案勿沿用旧口径猜); p32 注意节改写(待校准 → 已校准留痕 + 展开态不保证跨步骤保持); 站点总表 `memory-bank/scripts/PTAutoCheckIn/sites.md` Railgun 行同步校准(评审发现的漏同步面); `kb.index` 重跑。
- 评审 2 轮(轮1: 1 major sites.md 漏同步 + 1 nit p33 铃铛微观事实失实——实为 `.nx-icon span{display:none}` 隐藏致 innerText 空文本, 均修; 轮2 零发现), 引文机检 2/2 过。
