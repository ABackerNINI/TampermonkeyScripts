# git — 提交与版本号纪律

> **本文件是生成物, 不要手改** —— 由 `commands run kb.index` 扫描本目录主题文件的三行头元数据生成; 新增 / 改名 / 改摘要后重跑即可, 冲突也只需重跑。
> 库内细路由见 [memory-bank/README.md](../../README.md)。
> **检索纪律**: 先读本索引定位, 再按需打开单个主题文件 —— **不要整读本目录**。
> **摘要**: 提交与版本号纪律 —— `YYYY.MM.DD.N` 的 N 是当日流水号，跨天必须从 .1 重计；提交前定版本号要对齐 @version，不沿用前一天计数。
> **触发**: 提交前, 定版本号, 跨天首提, 对齐 @version, 跑 git 前

## 主题

| 主题 | 一句话 | 触发词 |
|---|---|---|
| [history-integration.md](history-integration.md) | 历史整合(merge/rebase/stash)曾因删除拦截层批量删 `.git/objects` 而被禁 —— 该问题 2026-09-25 已修复, **禁令解除**; 本文件保留作事故档案与恢复手册, 高风险历史整合前仍建议 `cp -a .git <备份>`。**同步一律… | 落后主线要同步, 想跑 git rebase, git merge, 合并, 变基, .git 损坏, 事故恢复 |
| [p20-version-day-reset.md](p20-version-day-reset.md) | `YYYY.MM.DD.N` 的 N 是当日流水号，跨天必须从 .1 重计。 | 提交前定版本号, 跨天首提, 对齐 @version |
| [refs.md](refs.md) | ref 核对已内联进 `ship.commit`(静默通过; 只看 commit 输出会被骗, 由脚本兜住; packed-refs 陈旧形态 v5 起自动修复+放行, v7 起自愈静默 —— 失败说明仅 COMMAND_FLOW_DEBUG=1 可见); 本 shell 里 `… | 提交后核对, ref, packed-refs, 分支被回退, staged 暴增, 上游未设置, 领先落后算不出, dry-run, 预检推送 |
