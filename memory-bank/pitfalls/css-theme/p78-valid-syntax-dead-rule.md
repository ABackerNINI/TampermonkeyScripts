# **语法合法 ≠ 能匹配** —— 拼接后代选择器时用错「带根锚点的常量」会造出死规则
> 摘要: 语法合法 ≠ 能匹配 —— 拼接后代选择器时用错「带根锚点的常量」会造出死规则；把 `TN`（`#torrenttable ...`）拼在后代组合器后面，要求置顶行内部再套一个 `#torrenttable`，永远匹配不上且不报任何错。
> 触发: 语法合法, 死规则, 带根锚点常量, 后代组合器, 运行时 hover 实测

- **触发**: .29 写「内层跟随外层 hover」时写成 `R + '.sticky_top:hover ' + TN + '...'`（`TN = '#torrenttable table.torrentname > tbody > tr'`），展开后是 `#torrenttable > tbody > tr.sticky_top:hover #torrenttable table.torrentname > tbody > tr` —— 要求置顶行内部再套一个 `#torrenttable`，而嵌套表只是 `table.torrentname`，永远匹配不上；CSS 解析完全合法、不报任何错，浏览器只是安静地不应用它。
- **判别**: 静态断言抓不到：它只能验「源码里有这个字符串」，而字符串确实在 —— 错的是拼出来的语义；最后是仿真里的真实 hover 实测抓到的（外层变亮到 `zone1h`，内层仍停在 `zone1`）。
- **处置**: 四条纪律：① 带根锚点的选择器常量（`TN` = `#torrenttable ...`）只能当独立规则用，不能拼在后代组合器后面，要相对路径就写相对路径（`table.torrentname > tbody > tr`），同理 `R`/`H`/`tdSel()` 这些带 `#torrenttable` 的常量拼接前都要先想清楚组合器；②「规则写了」≠「规则生效了」，静态断言管前者、运行时实测管后者，凡是靠拼接生成的复杂选择器至少要有一条运行时断言真的量到渲染结果；③ hover / `:focus` / 相邻兄弟这类依赖状态的规则最危险（不触发状态就永远测不到，而静态扫描连状态都模拟不了），用 CDP `Input.dispatchMouseEvent({type:'mouseMoved'})` 真实移动鼠标去测（本例就是这样抓到的）；④ 反断言要盯「错误写法」本身（本例 `:hover ' + TN`），而不只是「正确写法存在」—— 否则下一个人照着错的模式抄一遍，断言还是绿的。

## P78. **语法合法 ≠ 能匹配** —— 拼接后代选择器时用错「带根锚点的常量」会造出死规则

**怎么发现的**: .29 写"内层跟随外层 hover"时写成
```js
R + '.sticky_top:hover ' + TN + '...'
// TN = '#torrenttable table.torrentname > tbody > tr'
```
展开后是:
```css
#torrenttable > tbody > tr.sticky_top:hover #torrenttable table.torrentname > tbody > tr
```
—— 要求**置顶行内部再套一个 `#torrenttable`**, 而嵌套表只是 `table.torrentname`。
**永远匹配不上。** CSS 解析完全合法、不报任何错, 浏览器只是安静地不应用它。

**静态断言抓不到**: 它只能验"源码里有这个字符串", 而字符串确实在 —— 错的是**拼出来的语义**。
最后是**仿真里的真实 hover 实测**抓到的: 外层变亮到 `zone1h`, 内层仍停在 `zone1`。

**四条纪律**:
1. **带根锚点的选择器常量(`TN` = `#torrenttable ...`)只能当独立规则用,
   不能拼在后代组合器后面。** 要相对路径就写相对路径(`table.torrentname > tbody > tr`)。
   同理, `R`/`H`/`tdSel()` 这些带 `#torrenttable` 的常量拼接前都要先想清楚组合器。
2. **"规则写了" ≠ "规则生效了"。** 静态断言管前者, 运行时实测管后者 ——
   凡是**靠拼接生成**的复杂选择器, 至少要有一条运行时断言真的量到渲染结果。
3. hover / `:focus` / 相邻兄弟这类**依赖状态**的规则最危险: 不触发状态就永远测不到,
   而静态扫描连状态都模拟不了。用 CDP `Input.dispatchMouseEvent({type:'mouseMoved'})`
   真实移动鼠标去测(本例就是这样抓到的)。
4. **反断言要盯"错误写法"本身**(本例 `:hover ' + TN`), 而不只是"正确写法存在" ——
   否则下一个人照着错的模式抄一遍, 断言还是绿的。


