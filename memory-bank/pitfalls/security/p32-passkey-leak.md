# 「另存为」的整页网页里带着**你自己的** passkey：别把它拷进仓库任何受追踪的地方
> 摘要: 「另存为」的整页网页里带着自己的 passkey：别拷进仓库任何受追踪的地方。
> 触发: 另存为整页, 加页面样本, 写仿真剧本, 提交前自查, 给 AI 分析页面

- **触发**: 为了分析页面结构，把 PT 站「另存为」的整页 HTML（含 `*_files/`）放进仓库，或直接把其中一段 `<a href="download.php?id=123&passkey=xxxxxxxx...">` 复制到 `src/*.html` 样本、`tests/lib/sim/` 剧本、`memory-bank/` 文档里 → 提交推送后，**个人下载密钥进入公开仓库历史**。
- **判别**: 本仓库远端是公开的 GitHub / Gitee，凭据一旦推送即向全网可见；`git rm` / 删文件 / 改历史都**不能**保证已被抓取、fork、镜像站与搜索引擎缓存的内容消失，唯一正确的处置是**推之前别让它进来**。NexusPHP 系站点的下载链接、`usercp`/RSS 链接、`rsstoken`、`authkey`、隐藏表单里的 CSRF token 都在这一列。**注意「未被 Git 追踪」不等于安全**：AI 助手读取本地文件后，内容会进入会话上下文，可能被原样贴进回复 / 日志 / 提交信息 —— 泄露面不止 Git 一条。
- **处置**: ① `resources-do-not-track/` 保持被 `.gitignore` 忽略，永不 `git add -f`；② 需要结构时**只描述结构**（选择器、类名、DOM 层级、URL 形状），值写 `***`；③ 需要样本入库时**先复制到受控位置、手工清凭据再提交**；仿真剧本一律手写脱敏 HTML；④ 提交前自查：`git ls-files resources-do-not-track` 必须为空，且 diff 中无真实 token。**顺带**：拿这类页面给 AI 分析时，先自己确认已脱敏再粘贴；AI 侧同样不得输出其中的真实值（对策即 `conventions.md` 0.5，铁律 5）。

## P32. 「另存为」的整页网页里带着**你自己的** passkey：别把它拷进仓库任何受追踪的地方

**症状**：为了分析页面结构，把 PT 站「另存为」的整页 HTML（含 `*_files/`）放进仓库，
或直接把其中一段 `<a href="download.php?id=123&passkey=xxxxxxxx...">` 复制到 `src/*.html` 样本、
`tests/lib/sim/` 剧本、`memory-bank/` 文档里 → 提交推送后，**个人下载密钥进入公开仓库历史**。
**为什么严重**：本仓库远端是公开的 GitHub / Gitee，凭据一旦推送即向全网可见；
`git rm` / 删文件 / 改历史都**不能**保证已被抓取、fork、镜像站与搜索引擎缓存的内容消失，
唯一正确的处置是**推之前别让它进来**。NexusPHP 系站点的下载链接、`usercp`/RSS 链接、
`rsstoken`、`authkey`、隐藏表单里的 CSRF token 都在这一列。
**注意「未被 Git 追踪」不等于安全**：AI 助手读取本地文件后，内容会进入会话上下文，
可能被原样贴进回复 / 日志 / 提交信息 —— 泄露面不止 Git 一条。
**对策（即 `conventions.md` 0.5，铁律 5）**：
1. `resources-do-not-track/` 保持被 `.gitignore` 忽略，永不 `git add -f`；
2. 需要结构时**只描述结构**（选择器、类名、DOM 层级、URL 形状），值写 `***`；
3. 需要样本入库时**先复制到受控位置、手工清凭据再提交**；仿真剧本一律手写脱敏 HTML；
4. 提交前自查：`git ls-files resources-do-not-track` 必须为空，且 diff 中无真实 token。
**顺带**：拿这类页面给 AI 分析时，先自己确认已脱敏再粘贴；AI 侧同样不得输出其中的真实值。

