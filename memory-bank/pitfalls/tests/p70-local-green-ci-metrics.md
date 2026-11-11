# 本地绿 ≠ 判据稳 —— Windows 与 CI(Linux)的字体度量/可滚动高度不同
> 摘要: 本地绿 ≠ 判据稳 —— Windows 与 CI(Linux)的字体度量/可滚动高度不同；自己注入的 `position:fixed` 居中弹窗会盖住被 `scrollIntoView` 量到视口正中的元素。
> 触发: 本地绿 CI 红, 字体度量, 可滚动高度, scrollIntoView, fixed 浮层

- **触发**: 同一个仿真用例，Windows 本地 34/34 全绿，GitHub Actions(ubuntu, 自带 Chrome)的 Node 22 job 却红：`[iframe-unknown] hit-test 命中自身; 实测命中: div @ 520,380`。
- **判别**: 根因链每一步都「看起来没问题」：① 金丝雀 `iframe-unknown` 插在 `#outer` 末尾 ⇒ 在页面很下方、视口外；② `hdui-scan.js` 的 `__hit` 为了量视口外元素会 `scrollIntoView({block:'center'})` 把它滚到视口正中；③ 而自己注入的 `popup-fixed` 恰恰是 `position:fixed` 的居中弹窗，正好压在视口正中 ⇒ `elementFromPoint` 命中的是弹窗不是 iframe；④ Windows 上一直绿纯属运气（本地页面滚动高度不足，`scrollIntoView` 到不了正中，iframe 落在弹窗下方躲开了；CI 上字体度量不同能滚到位于是撞上）；这是第二次踩同一类坑（第一次是 `ann-marquee` 被自己注入的居中弹窗压住）—— 症状不同、根因相同：自己注入的浮层把要测的东西盖住了。
- **处置**: 让金丝雀不依赖滚动 —— iframe 改插 `#outer` 开头（首屏内），实测 `y=190, inView=true, hitOk=true, hit=iframe`，不再受任何浮层影响；教训：① 注入多个浮层时位置必须互相岔开，更要紧的是被 `scrollIntoView` 量到的元素会落到视口正中，那里不能有任何 fixed 浮层；②「本地全绿」不能作为判据稳的证据，Windows 与 ubuntu 的字体度量、可滚动高度都不同，几何/命中类断言必须靠 CI 交叉验证，反过来 CI 红而本地绿时先怀疑「依赖滚动/依赖字体」的断言；③ host-test 类断言要先证明前置状态成立（例如先断言 `scrollY === 600` 再断言命中），否则会出现「看起来验了、其实一直在另一个状态下验」的假绿（同批修掉的 `sim-hdui-overlay-safety` ④ 就是这个毛病）。

## P70. 本地绿 ≠ 判据稳 —— Windows 与 CI(Linux)的字体度量/可滚动高度不同

**症状**: 同一个仿真用例, Windows 本地 34/34 全绿, GitHub Actions(ubuntu, 自带 Chrome)的
Node 22 job 却红:
```
[iframe-unknown] hit-test 命中自身; 实测命中: div @ 520,380
```

**根因链**(每一步都"看起来没问题"):
1. 金丝雀 `iframe-unknown` 插在 `#outer` **末尾** ⇒ 在页面很下方, 视口外;
2. `hdui-scan.js` 的 `__hit` 为了量视口外元素, 会 `scrollIntoView({block:'center'})`
   把它滚到**视口正中**;
3. 而我**自己注入的** `popup-fixed` 恰恰是 `position:fixed` 的**居中弹窗**, 正好压在视口正中
   ⇒ `elementFromPoint` 命中的是弹窗, 不是 iframe。
4. **Windows 上一直绿纯属运气**: 本地页面滚动高度不足, `scrollIntoView` 到不了正中,
   iframe 落在弹窗下方躲开了; CI 上字体度量不同、能滚到位, 于是撞上。

**这是第二次踩同一类坑**(第一次是 `ann-marquee` 被自己注入的居中弹窗压住) ——
症状不同, 根因相同: **自己注入的浮层把要测的东西盖住了**。

**修法**: 让金丝雀**不依赖滚动** —— iframe 改插 `#outer` 开头(首屏内),
实测 `y=190, inView=true, hitOk=true, hit=iframe`, 不再受任何浮层影响。

**教训**:
1. **注入多个浮层时, 位置必须互相岔开**; 更要紧的是 —— **被 scrollIntoView 量到的元素
   会落到视口正中, 那里不能有任何 fixed 浮层**。
2. **"本地全绿"不能作为判据稳的证据**。Windows 与 ubuntu 的字体度量、可滚动高度都不同,
   几何/命中类断言必须靠 CI 交叉验证; 反过来, CI 红而本地绿时先怀疑"依赖滚动/依赖字体"的断言。
3. **host-test 类断言要先证明前置状态成立**(例如先断言 `scrollY === 600` 再断言命中),
   否则会出现"看起来验了、其实一直在另一个状态下验"的假绿(同批修掉的
   `sim-hdui-overlay-safety` ④ 就是这个毛病)。


