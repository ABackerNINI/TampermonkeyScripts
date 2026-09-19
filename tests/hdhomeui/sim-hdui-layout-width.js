#!/usr/bin/env node
'use strict';
/**
 * 仿真: 布局不把页面撑宽 / 窄屏导航仍可点 / 长列表片头吸顶
 * ------------------------------------------------------------------
 * 两条都是实测踩出来的(2026.09.19):
 *
 * ① **上妆不能把页面撑宽**。站点外层是 `table-layout:auto`, 会被内容的 max-content 撑开 ——
 *    标题列不限宽时整页被撑到 **1503px**(原站仅 1260), 窄屏用户得多横向滚 240px。
 *    修法: 标题列 `max-width:max(240px,calc(100vw - 900px))`。
 *
 * ② **窄屏导航必须还能点**。脚本把 `ul#mainmenu` 改成 flex(防 16 个 inline 挤一坨),
 *    但站点外层固定宽会让导航条拿到 1248px, flex **单行**排下去 —— 视口 <1248 时
 *    后面的入口排到屏幕外。原站 inline 布局是会自然换行的, 换成 flex 后必须显式给
 *    `max-width:100vw` 才会 wrap。
 */

const { withSim } = require('../lib/sim/harness');
const { runCase, assert } = require('../lib/sim/tcase');
const H = require('../lib/hdui-help');

const PROBE = [
    'const t = document.getElementById("torrenttable");',
    'const u = document.getElementById("mainmenu");',
    'const as = Array.prototype.slice.call(document.querySelectorAll("ul#mainmenu li a"));',
    'const blocked = as.filter(function (a) {',
    '  const b = a.getBoundingClientRect();',
    '  if (b.width === 0 || b.height === 0) return false;',
    '  const cx = b.left + b.width / 2, cy = b.top + b.height / 2;',
    '  if (cx > window.innerWidth || cy < 0 || cy > window.innerHeight) return true;',
    '  const e = document.elementFromPoint(cx, cy);',
    '  return !(e && (a === e || a.contains(e) || e.contains(a)));',
    '}).length;',
    'return { vw: window.innerWidth, docW: document.documentElement.scrollWidth,',
    '  ulW: u ? Math.round(u.getBoundingClientRect().width) : null,',
    '  navCount: as.length, blocked: blocked };'
].join('\n');

async function setWidth(sim, page, w) {
    if (w === null) {
        await sim.cdp.send('Emulation.clearDeviceMetricsOverride', {}, page.sessionId);
    } else {
        await sim.cdp.send('Emulation.setDeviceMetricsOverride',
            { width: w, height: 800, deviceScaleFactor: 1, mobile: false }, page.sessionId);
    }
    await new Promise(function (r) { setTimeout(r, 400); });
}

runCase('HDHomeUI · 不撑宽页面 / 窄屏导航可点 / 片头吸顶', async function () {
    await withSim(async function (sim) {
        // ---- 基准: 不上妆(原站)时的文档宽度 ----
        sim.seed({ 'hdui.theme': 'default' });
        const base = await H.open(sim, 'hdhome-ui');
        await new Promise(function (r) { setTimeout(r, 500); });
        const baseW = await base.eval('return document.documentElement.scrollWidth;');
        assert(baseW > 0, '取到原站文档宽度: ' + baseW);
        await base.close();

        // ---- 1. 上妆后不能比原站更宽 ----
        sim.seed({ 'hdui.theme': 'film' });
        const page = await H.open(sim, 'hdhome-ui');
        await H.waitState(page, 'applied');
        const w0 = await page.eval(PROBE);
        assertEqish(w0.docW, baseW, '上妆后文档宽度不超过原站(标题列 max-width 生效)');
        assertEqish(w0.blocked, 0, '默认宽度下导航 16 项全部可点');

        // ---- 2. 窄屏: 导航条要收窄换行, 16 项仍可点 ----
        for (const w of [1024, 900]) {
            await setWidth(sim, page, w);
            const r = await page.eval(PROBE);
            assertEqish(r.blocked, 0, '视口 ' + w + ': 导航 16 项全部可点(实际 ' + r.blocked + ' 个被挡)');
            assert(r.ulW <= w + 2, '视口 ' + w + ': 导航条收窄到视口内(实际 ' + r.ulW + ', 靠 max-width:100vw 换行)');
        }
        await setWidth(sim, page, null);

        // ---- 3. 长列表滚动: 片头要吸顶 ----
        await page.eval('window.scrollTo(0, 600); return 1;');
        await new Promise(function (r) { setTimeout(r, 400); });
        const head = await page.eval([
            'const t = document.getElementById("torrenttable");',
            'const h = t.tBodies[0].rows[0];',
            'return { top: Math.round(h.getBoundingClientRect().top), pos: getComputedStyle(h).position,',
            '  scrollY: Math.round(window.scrollY) };'
        ].join('\n'));
        assert(head.scrollY > 0, '页面确实滚动了(实际 ' + head.scrollY + 'px)');
        assertEqish(head.pos, 'sticky', '片头是 sticky');
        assert(head.top <= 2 && head.top >= -2,
            '滚动后片头吸在顶部(top≈0, 实际 ' + head.top + ') —— 长列表仍能排序');
        await page.close();
    }, { scriptPath: H.HDUI_PATH });
});

/** 数值断言(带容差), 失败信息里带上实际值 */
function assertEqish(actual, expected, msg) {
    if (typeof expected === 'number') {
        assert(Math.abs(actual - expected) <= 2, msg + ' — 期望 ' + expected + ', 实际 ' + actual);
    } else {
        assert(actual === expected, msg + ' — 期望 ' + expected + ', 实际 ' + actual);
    }
}
