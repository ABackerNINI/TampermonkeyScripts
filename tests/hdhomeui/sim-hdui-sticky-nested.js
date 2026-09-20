#!/usr/bin/env node
'use strict';
/**
 * 仿真: 置顶行的**内外两层**都要上妆(P65)
 * ------------------------------------------------------------------
 * 为什么单独一个用例(不并入 theme-switch):
 *   真站 `tr.sticky_top` 有 **两层** —— 外层是种子行本体, 内层是标题格里
 *   `<table class="torrentname">` 的那一条(真站实测 86 个: 外层 43 + 内层 43)。
 *   主题原来只有 `R + '.sticky_top'` 一条规则, 而 `R` 是**直接子代**选择器
 *   (`#torrenttable > tbody > tr`), 只够到外层 —— 内层 43 个一条规则都没有,
 *   露出站点默认底色。用户实拍「第二段置顶种子仍是白色背景」即此。
 *   theme-switch 只验了 `sticky[0]`(外层)的金色 inset, 内层**一个断言都没有**,
 *   所以这条漏了整整一个版本没人发现。
 *
 * 覆盖(三道断言, 每条都有对应反例):
 *   ① 内外两层 `tr.sticky_top` 的背景都必须是主题片基色(不是站点底色 / 不是透明)
 *   ② 内层**不得**有金色 inset 金边(否则内外双金条)
 *   ③ 外层**必须**保留金色 inset 金边(置顶的视觉锚点不能丢)
 *
 * ⚠️ 判据纪律(见 pitfall P65 / conventions 判据纪律):
 *    只验"存在"抓不到漏规则 —— 必须**分层计数**(外层 vs 内层),
 *    且背景要验到具体色值(`--hdui-card`), 不能只验"非透明"。
 */

const { withSim } = require('../lib/sim/harness');
const { runCase, assert, assertEq } = require('../lib/sim/tcase');
const H = require('../lib/hdui-help');

/**
 * 分层探测: 把所有 tr.sticky_top 按「外层 / 内层」分开,
 * 各自统计数量、背景色、box-shadow。
 *
 * 外层 = `#torrenttable > tbody > tr.sticky_top`(R)
 * 内层 = `#torrenttable table.torrentname > tbody > tr.sticky_top`(TN)
 */
const PROBE = [
    'const q = function (s) {',
    '  return Array.prototype.slice.call(document.querySelectorAll(s));',
    '};',
    'const pick = function (els) {',
    '  return els.map(function (e) {',
    '    const cs = getComputedStyle(e);',
    '    return { bg: cs.backgroundColor, shadow: cs.boxShadow };',
    '  });',
    '};',
    // 站点自己的底色: 仿真页是 `.sticky_top{background-color:#bad6f4}`(浅蓝)。
    // 内层若漏了规则, 拿到的就是它 —— 这正是"白/浅底"的来源。
    'const outer = pick(q("#torrenttable > tbody > tr.sticky_top"));',
    'const inner = pick(q("#torrenttable table.torrentname > tbody > tr.sticky_top"));',
    'return { outer: outer, inner: inner };'
].join('\n');

/** 主题片基色 --hdui-card 的实测值(与 .25 真站探测一致: rgb(32,28,24)) */
const CARD = 'rgb(32, 28, 24)';

runCase('HDHomeUI · 置顶行内外两层都上妆(P65)', async function () {
    await withSim(async function (sim) {
        sim.seed({ 'hdui.theme': 'film' });
        const page = await H.open(sim, 'hdhome-ui');
        await H.waitState(page, 'applied');

        const r = await page.eval(PROBE);

        // ---- 前置: 仿真页必须真的造出了两层结构, 否则下面的断言全是空跑 ----
        // 仿真页 12 行里 i<2 是置顶 => 外层 2 + 内层 2
        assert(r.outer.length > 0,
            '仿真页存在**外层**置顶行(否则本用例空跑), 实际 ' + r.outer.length);
        assert(r.inner.length > 0,
            '仿真页存在**内层**置顶行(标题格嵌套表), 实际 ' + r.inner.length);

        // ---- ① 两层背景都必须是主题片基色 ----
        const badOuter = r.outer.filter(function (x) { return x.bg !== CARD; });
        assertEq(badOuter.length, 0,
            '外层置顶行背景=片基色 ' + CARD + '(共 ' + r.outer.length + ' 个, 异常 '
            + badOuter.length + ' 个: ' + JSON.stringify(badOuter.slice(0, 2)) + ')');

        const badInner = r.inner.filter(function (x) { return x.bg !== CARD; });
        // ⚠️ 这条是**本题的核心**: 漏掉 `TN + '.sticky_top{background:...}'` 时,
        //    内层会退回 `TN{...background:transparent}`(1,1,3) 或站点 `.sticky_top{background:#bad6f4}`,
        //    在深色片基上就是一块浅底 —— 用户实拍的"第二段置顶种子背景为白色"。
        assertEq(badInner.length, 0,
            '内层置顶行(标题格嵌套表)背景=片基色 ' + CARD + '(共 ' + r.inner.length
            + ' 个, 异常 ' + badInner.length + ' 个: ' + JSON.stringify(badInner.slice(0, 2))
            + ') —— 异常即 P65 复发');

        // ---- ② 内层不得有金色 inset 金边(避免内外双金条) ----
        const innerGold = r.inner.filter(function (x) {
            return /inset/.test(x.shadow) && /245, 179, 66/.test(x.shadow);
        });
        assertEq(innerGold.length, 0,
            '内层置顶行**没有**金色 inset 金边(否则内外各一条, 视觉重复), 实际 '
            + JSON.stringify(innerGold.slice(0, 2)));

        // ---- ③ 外层必须保留金色 inset 金边(置顶的视觉锚点) ----
        const outerGold = r.outer.filter(function (x) {
            return /inset/.test(x.shadow) && /245, 179, 66/.test(x.shadow);
        });
        assert(outerGold.length === r.outer.length,
            '外层置顶行保留金色 inset 金边(置顶的视觉锚点), 实际 ' + outerGold.length
            + '/' + r.outer.length + ' 个: ' + JSON.stringify(r.outer.slice(0, 1)));

        await page.close();
    }, { scriptPath: H.HDUI_PATH });
});
