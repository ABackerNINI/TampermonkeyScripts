#!/usr/bin/env node
'use strict';
/**
 * 仿真: 未知的列 / 未知的行 一律卸妆 + 新标签的前向兼容
 * ------------------------------------------------------------------
 * 用户裁决(2026-09-20): **未知结构一律卸妆**。
 *   主题是「每列一个 nth-child 槽位」的排版 —— 站点多一列、多一种行, 主题就无从知道该把它摆哪。
 *   硬上妆的结果只有两种: 内容被摆到错误的槽位, 或被 overflow 压成一坨。**两者都等于屏蔽未知元素。**
 *   「对未知元素不默认屏蔽」的底线是**不猜**: 认不出来就把页面还给原站。
 *
 * 覆盖:
 *   ① 表头 + 数据行同步多一列 => E_COLUMN_UNEXPECTED => 卸妆 + 横幅 + 写 lastError
 *   ② 表体中间插分组行(colspan) => E_ROW_UNKNOWN => 卸妆(旧代码只查 rows[1], 这条查的是中间)
 *   ③ 分组行插在第一条数据行之前 => 同样是 E_ROW_UNKNOWN, 且**不进等待窗口**(不是时序问题)
 *   ④ 卸妆要卸干净(无 #hdui-css、theme=default), 且**未知内容本身没被藏起来**
 *   ⑤ 新标签的前向兼容: 未知分类色**保留站点底色**(信息不丢)、未知类别/促销图标有兜底图形
 */

const { withSim } = require('../lib/sim/harness');
const { runCase, assert, assertEq } = require('../lib/sim/tcase');
const H = require('../lib/hdui-help');
const scan = require('../lib/hdui-scan');

/** 等一个「非 pending」的终态 —— 这几类都不该进等结构窗口 */
async function settled(page, timeoutMs) {
    await page.waitFor('const s = document.documentElement.dataset.hduiState;'
        + ' return s === "fallback" || s === "applied";', timeoutMs || 12000, 'state=fallback|applied');
    return page.eval('return document.documentElement.dataset.hduiState;');
}

async function expectUnload(page, code, label) {
    const st = await settled(page);
    assertEq(st, 'fallback', label + ': 直接回退(不等窗口)');

    const left = await page.eval([
        'const a = document.getElementById("hdui-alert");',
        'return { css: !!document.getElementById("hdui-css"),'
        + ' theme: document.documentElement.dataset.hduiTheme,'
        + ' banner: a ? (a.textContent || "") : null };'
    ].join('\n'));
    assert(!left.css, label + ': 主题样式表已移除(卸干净)');
    assertEq(left.theme, 'default', label + ': data-hdui-theme=default');
    assert(left.banner && left.banner.indexOf(code) >= 0,
        label + ': 横幅里写明错误码 ' + code + '; 实测横幅=' + String(left.banner).slice(0, 160));
}

runCase('HDHomeUI · 未知列 / 未知分组行一律卸妆, 新标签保留站点底色', async function () {
    await withSim(async function (sim) {
        // ---------- ① 多一列 ----------
        sim.seed({ 'hdui.theme': 'film' });
        const p1 = await H.open(sim, 'hdhome-ui-extracol');
        await expectUnload(p1, 'E_COLUMN_UNEXPECTED', '未知列');
        const store1 = sim.get('hdui.lastError');
        assert(store1 && store1.code === 'E_COLUMN_UNEXPECTED',
            'lastError 写入 E_COLUMN_UNEXPECTED; 实测 ' + JSON.stringify(store1));
        // 卸妆后, 那一列的内容必须还看得见(没被主题藏起来)
        const c1 = (await scan.canaries(p1, ['col-unknown']))['col-unknown'];
        assert(c1 && c1.exists && c1.w >= 8 && c1.h >= 8 && c1.hitOk,
            '卸妆后未知列的内容仍可见且点得到: ' + JSON.stringify(c1));
        await p1.close();

        // ---------- ② 分组行插在中间 ----------
        sim.seed({ 'hdui.theme': 'film', 'hdui.lastError': null });
        const p2 = await H.open(sim, 'hdhome-ui-grouprow');
        await expectUnload(p2, 'E_ROW_UNKNOWN', '中间分组行');
        const store2 = sim.get('hdui.lastError');
        assert(store2 && store2.code === 'E_ROW_UNKNOWN',
            'lastError 写入 E_ROW_UNKNOWN; 实测 ' + JSON.stringify(store2));
        const c2 = (await scan.canaries(p2, ['row-group']))['row-group'];
        assert(c2 && c2.exists && c2.w >= 8 && c2.h >= 8 && c2.hitOk,
            '卸妆后分组行仍可见且点得到: ' + JSON.stringify(c2));
        await p2.close();

        // ---------- ③ 分组行插在第一条数据行之前 ----------
        sim.seed({ 'hdui.theme': 'film', 'hdui.lastError': null });
        const p3 = await H.open(sim, 'hdhome-ui-grouprow-first');
        await expectUnload(p3, 'E_ROW_UNKNOWN', '首条分组行');
        await p3.close();

        // ---------- ④ 只有中间某行少一格: 行结构必须**逐行**查, 不能只看 rows[1] ----------
        // 旧代码 `rows[1].cells.length !== head` 只看第一行 —— 补列补到一半(第一行好了、后面没好)
        // 会被判成"结构正常", 于是 10 列的行硬塞进 12 列的槽位, 整张表的列全错位。
        sim.seed({ 'hdui.theme': 'film', 'hdui.lastError': null });
        const p6 = await H.open(sim, 'hdhome-ui-laterow');
        await settled(p6, 20000);
        const st6 = await p6.eval('return document.documentElement.dataset.hduiState;');
        assert(st6 !== 'applied',
            '中间某行少一格时不得照样上妆(实测 state=' + st6 + ', 期望 fallback)');
        const store6 = sim.get('hdui.lastError');
        assert(store6 && String(store6.detail).indexOf('ROW_CELL_COUNT_MISMATCH') >= 0,
            '错误详情指向行列数不符; 实测 ' + JSON.stringify(store6));
        await p6.close();

        // ---------- ⑤ 新标签的前向兼容 ----------
        // 对照组: 不上妆时这些新标签的底色是什么
        sim.seed({ 'hdui.theme': 'default' });
        const p4 = await H.open(sim, 'hdhome-ui-unknown');
        await p4.waitFor('return document.documentElement.dataset.hduiState === "off"', 15000, 'state=off');
        const base = await p4.eval([
            'const o = {};',
            '["tag-unknown", "badge-unknown"].forEach(function (id) {',
            '  const e = document.querySelector("[data-canary=\\"" + id + "\\"]");',
            '  o[id] = e ? getComputedStyle(e).backgroundColor : null;',
            '});',
            'return o;'
        ].join('\n'));
        await p4.close();

        sim.seed({ 'hdui.theme': 'film' });
        const p5 = await H.open(sim, 'hdhome-ui-unknown');
        await H.waitState(p5, 'applied');
        const themed = await p5.eval([
            'const o = {};',
            '["tag-unknown", "badge-unknown"].forEach(function (id) {',
            '  const e = document.querySelector("[data-canary=\\"" + id + "\\"]");',
            '  o[id] = e ? getComputedStyle(e).backgroundColor : null;',
            '});',
            'return o;'
        ].join('\n'));
        // 未知分类标签: 站点给的分类色是**信息**, 不许被主题抹掉
        assert(base['tag-unknown'] && themed['tag-unknown'] === base['tag-unknown'],
            '未知分类标签保留站点底色(对照 ' + base['tag-unknown'] + ' -> 上妆 '
            + themed['tag-unknown'] + ')');
        assert(base['badge-unknown'] && themed['badge-unknown'] === base['badge-unknown'],
            '全新徽章类保留原有底色(对照 ' + base['badge-unknown'] + ' -> 上妆 '
            + themed['badge-unknown'] + ')');

        // 未知图标: 必须换成主题 SVG(不是被清成空白)
        const ic = await p5.eval([
            'const o = {};',
            '["icon-unknown-cat", "icon-unknown-pro"].forEach(function (id) {',
            '  const e = document.querySelector("[data-canary=\\"" + id + "\\"]");',
            '  if (!e) { o[id] = null; return; }',
            '  const s = getComputedStyle(e);',
            '  o[id] = { content: String(s.content), bg: String(s.backgroundImage),'
            + ' w: Math.round(e.getBoundingClientRect().width) };',
            '});',
            'return o;'
        ].join('\n'));
        ['icon-unknown-cat', 'icon-unknown-pro'].forEach(function (id) {
            const v = ic[id];
            assert(v && v.w >= 8, '[' + id + '] 未知图标有尺寸(实测 ' + (v && v.w) + 'px)');
            assert(v && (v.content.indexOf('data:image/svg+xml') >= 0
                || v.bg.indexOf('data:image/svg+xml') >= 0),
                '[' + id + '] 未知图标换成了主题 SVG 兜底图形(不是空白); 实测 content='
                + String(v && v.content).slice(0, 40) + ' bg=' + String(v && v.bg).slice(0, 40));
        });
        await p5.close();
    }, { scriptPath: H.HDUI_PATH });
});
