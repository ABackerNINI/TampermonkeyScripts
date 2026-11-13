# 开发与发布工作流
> 摘要: 编辑 / 递增版本 / 自检 / 同步知识库 / 提交 / 安装验证 的发布步骤与修改脚本注意
> 触发: 开发, 发布, 提交, 改脚本

## 10. 开发与发布工作流

1. 编辑 `src/*.user.js`。
2. **递增版本号**：同一天多次修改用 `.N` 递增（`2026.08.30.1` → `2026.08.30.2`）；跨天修改为 `YYYY.MM.DD.1`。
3. **自检**：改 PTAutoCheckIn 后跑 `node tests/ptautocheckin/check-ptac-budget.js`（必须全绿；改到超时预算/状态阶梯/不透明步骤时尤其必要，见 P28）；改了任何脚本后跑 `node tests/run-all.js`（全部测试）+ 至少 `node --check src/*.user.js` 验语法。
4. **同步更新 `memory-bank/` 知识库**：受影响条目（脚本文档/约定/易错点/任务）与代码同次提交（见第 0.4 节）。
5. **提交信息规范且详细**：首行概括 + 正文分条说明背景/要点/影响；一次提交只做一件事（见第 1 节）。
6. Tampermonkey 安装/更新脚本后，到目标站点页面按 F12 观察 console 日志验证。
7. 推送后脚本可经 `@downloadURL`/`@updateURL` 更新（BilibiliEnterFullscreen 使用 Gitee 直链）。
8. 测试纪律：可设计易测代码，但不为测试留后门、不为过测试改生产代码（见第 8 节）。

### 修改脚本时注意

- 不要改动脚本头部 `@match` 之外无法访问的站点逻辑（仅限已授权域名）。
- BTSchoolHelper 与 PTAutoCheckIn 都有 `SITES`/解析逻辑依赖真实页面结构，改动后建议对照 `src/BTSchoolTorrentsTableSample.html` 验证。
- 若站点改版导致选择器失效，优先观察控制台 warn 日志定位是哪一步失效。
- 新站点/新规则上线前，先在真实页面控制台验证解析与点击日志，再提交。
