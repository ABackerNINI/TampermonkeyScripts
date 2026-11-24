# review.pack 基哈希随 untracked→staged 树态漂移致 review.trace 判红

> 摘要: 新文件在 untracked 态跑 review.pack 取基哈希，git add 转 staged 后哈希算法口径不同，Review trailer 的 `· 基` 过不了闸
> 触发: review.pack 基哈希, review.trace 判红, untracked staged, Review trailer 基, 先 add 后 pack
**Refs:** memory-bank/tasks/26-11-24-webui-ptac-fab-skin-edge.md

## 本篇只回答

新建文件在「未跟踪 → 已暂存」之间切换树态时，`review.pack` 基哈希为何漂移、如何识别这种「内容没改却判红」的假账，以及取基哈希与提交怎样同相。

### 新文件先 pack 后 git add：基哈希换算法，trailer 判红

- **触发**: 本批改动含新建文件（新测试 / 新基线切片 / 新任务档案 / 新坑档）。在文件仍为 `??`（untracked）时跑 `commands run review.pack --base <rev>` 取「基哈希」并写进 commit message 的 `Review: … · 基 <12hex>`；随后按流程 `git add` 暂存（文件变 `A ` staged）再提交。提交闸门的 `review.trace` 在 staged 态重算基哈希，与 trailer 不一致 → 报「评审后有新改动，重跑 review.pack 取新基补一轮复评」，但源码内容一字未动。
- **判别**: ① 报错是 `· 基 <声明> ≠ 闸门重算 <实算>`，而非行数 / blocker 等其他 Review 位；② `git status --short` 里相关新文件在 pack 时是 `??`、过闸时已是 `A `（或反向）；③ 两条基哈希对应的路径集合与文件内容其实相同 —— 只是树态不同。三条满足即树态漂移，不是评审后真有新改动。
- **处置**: **先 `git add` 全部本批改动（树态固定为 staged），再跑 `commands run review.pack --base <闸门锚点 rev>` 取新基哈希**，把新的 `· 基 <12hex>` 写进 trailer；若该文件此前已评审，按「评审后新改动」补一轮**增量复评**（只评新基对应的改动面，不重评已评内容），别整批重来。反向做法（刻意保持 untracked 评审、提交前不 add）与「先暂存后提交」的常规闸门流程冲突，不推荐。
- **复发**: 1
