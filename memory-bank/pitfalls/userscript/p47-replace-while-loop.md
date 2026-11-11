# 批量替换用 `while (s.indexOf(from) >= 0)` 会死循环 —— 当 `to` 包含 `from` 时
> 摘要: 批量替换用 `while (s.indexOf(from) >= 0)` 会死循环 —— 当 `to` 包含 `from` 时；全量替换应改用 `split/join` 或 `replaceAll`。
> 触发: 批量替换, while 死循环, replace, node -e, 进程挂起

- **触发**: 一条 `node -e` 批量改原型的命令挂死，跑了 4 小时 47 分，内存涨到 354 MB（同机其它 node 进程只有 60–80 MB），任务面板一直显示 "background task running"。
- **判别**: `to = from + "'"`，替换后字符串里仍然能匹配到 `from`（`width:100%'` 中包含 `width:100%`）；`replace()` 不带 `g` 只换第一处，于是每轮让字符串变长一点，`indexOf` 永远 >= 0；判定线索（不用看代码）：进程存活数小时 + 内存持续增长 ⇒ 字符串在循环里变长；本次损伤为 0 —— `writeFileSync` 在循环之后从未执行，文件 mtime 停在命令启动前。
- **处置**: 规避按优先级：① 别用 while，全量替换用 `s.split(from).join(to)` 或 `replaceAll` / 正则 `/…/g` 一次性完成；② 只换第一处就直接 `replace` 一次；③ 必须循环时加次数上限 `while (n < 100 && s.indexOf(from) >= 0)`；④ 确保 `to` 不包含 `from`（死循环的充要条件，写之前先想清楚）；连带教训：内联 `node -e` 的反引号/`$` 会被 Git Bash 展开（本次把 `tasks/_index.md` 写坏），带引号/中文/正则的复杂替换写成 `.js` 文件再跑，`node -e` 只适合一次性小改；挂起后 `tasklist | grep node` 找内存异常大的进程 → `Get-CimInstance Win32_Process` 看完整命令行 → 确认是自己的失控脚本才 `Stop-Process -Force`，认命令行不认进程名（IDE 自身也有多个 node）。

## P47. 批量替换用 `while (s.indexOf(from) >= 0)` 会死循环 —— 当 `to` 包含 `from` 时

**症状**（2026-09-19 实测）：一条 `node -e` 批量改原型的命令挂死，
跑了 **4 小时 47 分**，内存涨到 **354 MB**（同机其它 node 进程只有 60–80 MB），
任务面板一直显示 "background task running"。
**代码**：
```js
const from = "…column-gap:' + gap + ';width:100%";
const to   = "…column-gap:' + gap + ';width:100%'";   // 只比 from 多一个单引号
let n = 0;
while (s.indexOf(from) >= 0) { s = s.replace(from, to); n++; }
fs.writeFileSync('index-v2.html', s);
```
**为什么死循环**：`to = from + "'"`，替换后字符串里**仍然能匹配到 `from`**
（`width:100%'` 中包含 `width:100%`）；而 `replace()` 不带 `g` 只换第一处 ——
于是每轮让字符串变长一点，`indexOf` 永远 >= 0。
**判定线索**（不用看代码也能猜到）：进程存活数小时 + 内存持续增长 ⇒ 字符串在循环里变长。
**好在这次的损伤是 0**：`writeFileSync` 在循环**之后**，从未执行，文件 mtime 停在命令启动前；
若它在循环**内**，文件会被反复覆盖、且越写越大。
**规避**（按优先级）：
1. **别用 while**：全量替换用 `s.split(from).join(to)`，或 `replaceAll` / 正则 `/…/g` —— 一次性完成，无循环。
2. 只需替换第一处就**直接 `replace` 一次**，不要包循环。
3. 必须循环时**加次数上限**：`while (n < 100 && s.indexOf(from) >= 0)`。
4. **确保 `to` 不包含 `from`** —— 这是死循环的充要条件，写之前先想清楚。
**连带教训 —— 内联 `node -e` 的两个坑**：
- **引号会被 shell 动**：`node -e "…\``…"` 里的反引号 / `$` 会被 Git Bash 展开。
  本次会话就吃过：一条 `node -e` 里的反引号被解释，把 `tasks/_index.md` 写坏了。
  **带引号 / 中文 / 正则的复杂替换，写成 `.js` 文件再跑**（可读、可复用、便于中断），
  `node -e` 只适合一次性小改。
- **挂起后要主动查**：`tasklist | grep node`（哪个进程内存异常大）→
  `Get-CimInstance Win32_Process -Filter "ProcessId=<pid>"` 看完整命令行 →
  确认是自己的失控脚本就 `Stop-Process -Id <pid> -Force`。
  注意 IDE 自身也有多个 node（mcp 服务），别误杀 —— **认命令行，不认进程名**。

---


