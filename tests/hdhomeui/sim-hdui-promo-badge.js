#!/usr/bin/env node
'use strict';
/**
 * 仿真: 促销徽章**保持站点原图**(.30)
 * ------------------------------------------------------------------
 * 为什么单独一个用例:
 *   站点促销是 `<img class="pro_*">`(36×11 雪碧图)。它的 `src` 是**透明占位图**(`trans.gif`),
 *   真正看得见的图标全靠 `background:url(icons.gif) -Xpx 0` 画。
 *   所以任何 `content:` 替换或 `background-image:none` 都会**把原图干掉** ——
 *   这正是 .20(图形徽章)与 .29(文字徽章)踩的坑, 用户两次都不满意, .30 改回显示原图。
 *
 * 覆盖(全是**反断言**, 因为本用例的诉求就是"别动它"):
 *   ① 三种已知促销的 `content` 仍是 `normal`(没被换成 url(...))
 *   ② `background-image` 仍是站点的 icons.gif 雪碧图(没被清成 none)
 *   ③ 尺寸仍是站点的 36×11(没被改 —— sprites 按这个定位, 改了会露出相邻图标)
 *   ④ **未登记**的 pro_* 家族同样不被我们动手脚(P66: 显示站点给它的图, 天然不空白)
 *
 * ⚠️ 历程记在这里免得再绕: .20 图形徽章 → .29 文字徽章 → **.30 站点原图**(用户最终选择)。
 *    结论: 促销这种"站点自己画得挺好、尺寸也刚好"的东西, **不要替它重新设计**。
 */

const { withSim } = require('../lib/sim/harness');
const { runCase, assert, assertEq } = require('../lib/sim/tcase');
const H = require('../lib/hdui-help');

// ⚠️ harness 的 eval 会把表达式包进 `(() => { ... })()`, 这里**不能再套一层 IIFE**。
const PROBE = [
    'const out = {};',
    '["pro_free", "pro_50pctdown", "pro_free2up"].forEach(function (k) {',
    '  const e = document.querySelector("#torrenttable img." + k);',
    '  if (!e) { out[k] = null; return; }',
    '  const cs = getComputedStyle(e);',
    '  const r = e.getBoundingClientRect();',
    '  out[k] = { content: String(cs.content), bg: String(cs.backgroundImage),',
    '    w: Math.round(r.width), h: Math.round(r.height) };',
    '});',
    // 未登记家族: 仿真页 unknown 变体里有 pro_znewpromo
    'const un = document.querySelector("#torrenttable img.pro_znewpromo");',
    'if (un) {',
    '  const cs = getComputedStyle(un);',
    '  out.__unknown = { content: String(cs.content), bg: String(cs.backgroundImage) };',
    '}',
    'return out;'
].join('\n');

runCase('HDHomeUI · 促销徽章保持站点原图(.30)', async function () {
    await withSim(async function (sim) {
        sim.seed({ 'hdui.theme': 'film' });

        // ================= ① ② ③ 三种已知促销 =================
        const page = await H.open(sim, 'hdhome-ui');
        await H.waitState(page, 'applied');
        const r = await page.eval(PROBE);

        Object.keys(r).filter(function (k) { return k !== '__unknown'; }).forEach(function (k) {
            const v = r[k];
            assert(v, '找得到促销图标 img.' + k + '(否则本用例空跑)');
            // ① 没被换 content —— 站点 src 是透明占位图, 换了 content 原图就没了
            assertEq(v.content, 'normal',
                '促销 ' + k + ' 的 content 仍是 normal(.30: 显示站点原图), 实际 ' + v.content);
            // ② 雪碧图还在 —— 这就是"原图"的本体
            assert(/icons\.gif/.test(v.bg) && /url\(/.test(v.bg),
                '促销 ' + k + ' 的背景仍是站点雪碧图 icons.gif(.30: 清成 none 就只剩空框), 实际 ' + v.bg);
            // ③ 尺寸没被改 —— sprites 按 36×11 定位, 改了会露出相邻图标
            assertEq(v.w, 36, '促销 ' + k + ' 宽度仍是站点原尺寸 36, 实际 ' + v.w);
            assertEq(v.h, 11, '促销 ' + k + ' 高度仍是站点原尺寸 11, 实际 ' + v.h);
        });
        await page.close();

        // ================= ④ 未登记家族也不被动过 =================
        const p2 = await H.open(sim, 'hdhome-ui-unknown');
        await H.waitState(p2, 'applied');
        const r2 = await p2.eval(PROBE);
        assert(r2.__unknown,
            '仿真页存在未登记的促销家族 pro_znewpromo(否则本段空跑)');
        // 我们不能给它换 content, 也不能把它的背景清成 none —— 显示什么由站点决定
        assertEq(r2.__unknown.content, 'normal',
            '未登记促销家族的 content 也是 normal(.30/P66: 站点给它什么就显示什么), 实际 '
            + r2.__unknown.content);
        // ⚠️ 这里**不**断言 background: 仿真夹具没给 `pro_znewpromo` 配站点背景(真站任何
        //    pro_* 家族都有雪碧图), 所以量到 none 是**夹具的设定**而不是我们清的 ——
        //    断言它会变成测夹具而非测主题。"我们没给 pro_* 生成任何规则"由静态断言把关。
        await p2.close();
    }, { scriptPath: H.HDUI_PATH });
});
