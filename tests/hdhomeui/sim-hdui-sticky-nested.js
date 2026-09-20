#!/usr/bin/env node
'use strict';
/**
 * 仿真: 置顶行的**内外两层**都要上妆, 且**置顶区1 / 区2 要能分辨**(P65 / .29)
 * ------------------------------------------------------------------
 * 为什么单独一个用例(不并入 theme-switch):
 *   真站 `tr.sticky_top` 有 **两层** —— 外层是种子行本体, 内层是标题格里
 *   `<table class="torrentname">` 的那一条。主题原来只有 `R + '.sticky_top'` 一条规则,
 *   而 `R` 是**直接子代**选择器(`#torrenttable > tbody > tr`), 只够到外层 —— 内层一条规则都没有。
 *   theme-switch 只验了 `sticky[0]`(外层)的金色 inset, 内层**零断言** —— 这条漏了整整一版。
 *
 * .29 追加: 真站实测 101 行 = 表头(0) / 置顶区1(1-41, 无 inline) / 置顶区2(42-50,
 *   带 inline `background-color: rgb(250, 238, 244);`) / 普通区(51-100)。
 *   站点用**两个不同底色**区分两区, 主题原先一律压成片基色 ⇒ 两区不可分辨(用户诉求)。
 *   现在: 区1 金调、区2 青绿调, 靠**色相**区分(单看亮度分不出, 因为亮度刻意做成接近)。
 *
 * 覆盖:
 *   ① 区1: 内外两层背景都 = --hdui-zone1, 且站点的 inline 底色压不住它
 *   ② 区2: 打了 inline 底色的那几行 = --hdui-zone2, 且与区1 **不同**
 *   ③ 内层不得有金色 inset(防内外双金条) / 外层必须保留(置顶视觉锚点)
 *
 * ⚠️ 判据纪律(见 pitfall P65 / P75 / P76):
 *    只验"存在"抓不到漏规则 —— 必须**分层计数**(外层 vs 内层) + **分区计数**,
 *    且背景要验到**具体色值**, 不能只验"非透明"。
 */

const { withSim } = require('../lib/sim/harness');
const { runCase, assert, assertEq } = require('../lib/sim/tcase');
const H = require('../lib/hdui-help');

/**
 * 分层探测: 把所有 tr.sticky_top 按「外层 / 内层」分开, 各报背景与 box-shadow。
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
    '    return { bg: cs.backgroundColor, shadow: cs.boxShadow,',
    '      hasInline: /background/.test(e.getAttribute("style") || "") };',
    '  });',
    '};',
    'const outer = pick(q("#torrenttable > tbody > tr.sticky_top"));',
    'const inner = pick(q("#torrenttable table.torrentname > tbody > tr.sticky_top"));',
    'return { outer: outer, inner: inner };'
].join('\n');

/** 给**前 n 个**置顶行(外 + 内)打上站点同款 inline 底色, 模拟「置顶区2」 */
function injectZone2(n) {
    return [
        'const o = document.querySelectorAll("#torrenttable > tbody > tr.sticky_top");',
        'const i = document.querySelectorAll("#torrenttable table.torrentname > tbody > tr.sticky_top");',
        'for (let k = 0; k < ' + n + ' && k < o.length; k++) {',
        // 与真站一致的写法: 带空格、带分号
        '  o[k].setAttribute("style", "background-color: rgb(250, 238, 244);");',
        '  if (i[k]) i[k].setAttribute("style", "background-color: rgb(250, 238, 244);");',
        '}',
        'return { marked: Math.min(' + n + ', o.length) };'
    ].join('\n');
}

/** .29 分区配色的实测 rgb(与 THEMES.film.vars 一一对应) */
const ZONE1 = 'rgb(46, 39, 24)';   // #2e2718 金调
const ZONE1H = 'rgb(58, 49, 32)';  // #3a3120 区1 hover 亮档
const ZONE2 = 'rgb(24, 46, 40)';   // #182e28 青绿调

runCase('HDHomeUI · 置顶行内外两层上妆 + 两区分色(P65 / .29)', async function () {
    await withSim(async function (sim) {
        sim.seed({ 'hdui.theme': 'film' });
        const page = await H.open(sim, 'hdhome-ui');
        await H.waitState(page, 'applied');

        // ================= ① 未打 inline 时, 内外两层都应是区1 =================
        const r = await page.eval(PROBE);
        assert(r.outer.length > 0,
            '仿真页存在**外层**置顶行(否则本用例空跑), 实际 ' + r.outer.length);
        assert(r.inner.length > 0,
            '仿真页存在**内层**置顶行(标题格嵌套表), 实际 ' + r.inner.length);
        assert(r.outer.length === r.inner.length,
            '内外两层数量一致(每个置顶行各一个外/内 tr), 实际 外 ' + r.outer.length
            + ' / 内 ' + r.inner.length);

        const badOuter1 = r.outer.filter(function (x) { return x.bg !== ZONE1; });
        assertEq(badOuter1.length, 0,
            '外层置顶行(区1)背景=' + ZONE1 + '(共 ' + r.outer.length + ' 个, 异常 '
            + badOuter1.length + ' 个: ' + JSON.stringify(badOuter1.slice(0, 2)) + ')');

        const badInner1 = r.inner.filter(function (x) { return x.bg !== ZONE1; });
        // ⚠️ 这条是 P65 的核心: 漏掉 `TN + '.sticky_top{...}'` 时内层会退回
        //    `TN{...background:transparent}` 或站点 `.sticky_top{background:#bad6f4}`,
        //    在深色片基上就是一块浅底 —— 用户实拍的"第二段置顶种子背景为白色"。
        assertEq(badInner1.length, 0,
            '内层置顶行(区1)背景=' + ZONE1 + '(共 ' + r.inner.length + ' 个, 异常 '
            + badInner1.length + ' 个: ' + JSON.stringify(badInner1.slice(0, 2)) + ')');

        // ================= ② 打上 inline 底色的行 → 区2, 且必须与区1 不同 =================
        const marked = await page.eval(injectZone2(1));
        assert(marked.marked > 0, '成功给置顶行打上站点同款 inline 底色, 实际 ' + marked.marked);

        const r2 = await page.eval(PROBE);
        const z2Outer = r2.outer.filter(function (x) { return x.hasInline; });
        const z1Outer = r2.outer.filter(function (x) { return !x.hasInline; });
        const z2Inner = r2.inner.filter(function (x) { return x.hasInline; });
        const z1Inner = r2.inner.filter(function (x) { return !x.hasInline; });

        assert(z2Outer.length > 0 && z1Outer.length > 0,
            '同时存在区1 与区2 的外层行(否则"能不能分辨"无从谈起), 实际 区1 '
            + z1Outer.length + ' / 区2 ' + z2Outer.length);

        const badZ2o = z2Outer.filter(function (x) { return x.bg !== ZONE2; });
        assertEq(badZ2o.length, 0,
            '置顶区2 的外层行背景=' + ZONE2 + '(.29: 站点 inline 底色压不住它), 异常 '
            + badZ2o.length + ' 个: ' + JSON.stringify(badZ2o.slice(0, 2)));
        const badZ2i = z2Inner.filter(function (x) { return x.bg !== ZONE2; });
        assertEq(badZ2i.length, 0,
            '置顶区2 的内层行背景=' + ZONE2 + '(否则标题格那块还是区1 的色, 一行两色), 异常 '
            + badZ2i.length + ' 个: ' + JSON.stringify(badZ2i.slice(0, 2)));

        // 未被标记的行**必须仍是区1** —— 否则等于两区又被压成同一个色
        const badZ1o = z1Outer.filter(function (x) { return x.bg !== ZONE1; });
        assertEq(badZ1o.length, 0,
            '未被标记的置顶行仍是区1 ' + ZONE1 + '(不能被区2 规则连带改掉), 异常 '
            + badZ1o.length + ' 个: ' + JSON.stringify(badZ1o.slice(0, 2)));
        const badZ1i = z1Inner.filter(function (x) { return x.bg !== ZONE1; });
        assertEq(badZ1i.length, 0,
            '未被标记的置顶行内层仍是区1 ' + ZONE1 + ', 异常 ' + badZ1i.length + ' 个');

        // 两区颜色必须真的不同(分不出来 = 白做)
        assert(ZONE1 !== ZONE2 && z2Outer[0].bg !== z1Outer[0].bg,
            '置顶区1 与区2 背景**不同**(可分辨), 实际 区1=' + z1Outer[0].bg
            + ' 区2=' + z2Outer[0].bg);

        // ================= ③ 金边: 内层无、外层有 =================
        const innerGold = r2.inner.filter(function (x) {
            return /inset/.test(x.shadow) && /245, 179, 66/.test(x.shadow);
        });
        assertEq(innerGold.length, 0,
            '内层置顶行**没有**金色 inset(否则内外各一条金边, 视觉重复), 实际 '
            + JSON.stringify(innerGold.slice(0, 2)));

        const outerGold = r2.outer.filter(function (x) {
            return /inset/.test(x.shadow) && /245, 179, 66/.test(x.shadow);
        });
        assertEq(outerGold.length, r2.outer.length,
            '外层置顶行保留金色 inset(置顶的视觉锚点, 两区都有), 实际 ' + outerGold.length
            + '/' + r2.outer.length);

        // ================= ④ hover 链: 外层变亮 + 内层必须跟随 =================
        // ⚠️ 静态断言只能证明"规则写了", 证明不了"真的生效" —— 这里用真实鼠标移动实测。
        //    内层不跟随的话, 标题格(真站约 315px 宽)会留一块"没跟着亮"的补丁。
        //    用索引 1(未被标记 => 区1), 索引 0 已被上面打成区2。
        // ⚠️ 鼠标要落在行**内部空白处**, 不能压在标题链接上(链接有自己的 hover 样式)。
        const spot = await page.eval([
            'const o = document.querySelectorAll("#torrenttable > tbody > tr.sticky_top");',
            'const e = o[1];',
            'if (!e) return null;',
            'e.scrollIntoView({ block: "center" });',
            'const r = e.getBoundingClientRect();',
            'return { x: Math.round(r.right - 8), y: Math.round(r.top + r.height / 2) };'
        ].join('\n'));
        assert(spot, '拿到置顶行用于 hover 实测(否则本段空跑)');
        await page.sim.cdp.send('Input.dispatchMouseEvent',
            { type: 'mouseMoved', x: spot.x, y: spot.y }, page.sessionId);
        await new Promise(function (res) { setTimeout(res, 300); });

        const hov = await page.eval(PROBE);
        assertEq(hov.outer[1].bg, ZONE1H,
            'hover 时外层置顶行变亮到 ' + ZONE1H + '(.29: 不能用 --hdui-rule, 它比区色还暗), 实际 '
            + hov.outer[1].bg);
        assertEq(hov.inner[1].bg, ZONE1H,
            'hover 时内层**跟随**一起变亮(.29: 不跟随会留一块没亮的补丁), 实际 ' + hov.inner[1].bg);

        await page.close();
    }, { scriptPath: H.HDUI_PATH });
});
