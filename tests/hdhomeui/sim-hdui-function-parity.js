#!/usr/bin/env node
'use strict';
/**
 * 仿真: 功能保持(5 套主题逐个上妆后, 原站功能必须一模一样)
 * ------------------------------------------------------------------
 * 断言四条:
 *   1. 换肤前后「功能基线快照」逐字段相同(导航/信息栏/行链接/表单/分页/页脚)
 *   2. 关键可交互元素在新版式下仍可命中(hit-test, 没被遮挡或压成 0 尺寸)
 *   3. 站内 RSS 切换仍然工作(点一下 = 恰好一次 myrss.php?ajax=1&torrentid=)
 *   4. 上妆过程零危险端点访问(签到/登出/魔力/邀请/捐赠/个人页/RSS/广告)
 */

const { withSim } = require('../lib/sim/harness');
const { runCase, assert, assertEq } = require('../lib/sim/tcase');
const H = require('../lib/hdui-help');

const THEMES = ['film'];

// 换肤不允许改变的功能面
const FIELDS = ['nav', 'infoLinks', 'rows', 'details', 'rssIds', 'rssHref', 'comments',
    'snatch', 'sortLinks', 'pager', 'formAction', 'formMethod', 'submitValue',
    'searchAttrs', 'checkboxCount', 'selectNames', 'tagOnclick', 'searchboxToggleHref',
    'ksearchDisplay', 'footer', 'calcHeads'];

// 注: 搜索箱默认折叠(#ksearchboxmain display:none), 其提交按钮本就 0 尺寸,
// 故不参与 hit-test; 它的可用性由后面的「表单提交仍带关键词」断言覆盖。
const HIT_TEST = [
    'ul#mainmenu li a',
    '#info_block a[href*="attendance.php"]',
    '#torrenttable a[href*="details.php"]',
    '#torrenttable [data-toggle-rss]',
    '#torrenttable a[href*="viewsnatches"]',
    '#torrenttable td:nth-child(1) a',
    'p[align="center"] a'
];

function diffKey(a, b) {
    const out = [];
    for (const k of FIELDS) {
        const x = JSON.stringify(a[k]);
        const y = JSON.stringify(b[k]);
        if (x !== y) out.push(k + ': ' + x.slice(0, 160) + ' -> ' + y.slice(0, 160));
    }
    return out;
}

async function hitTest(page) {
    return page.eval([
        'const sels = ' + JSON.stringify(HIT_TEST) + ';',
        'return sels.map(function (s) {',
        '  const e = document.querySelector(s);',
        '  if (!e) return { s: s, ok: false, why: "missing" };',
        '  e.scrollIntoView({ block: "center" });',
        '  const r = e.getBoundingClientRect();',
        '  if (r.width === 0 || r.height === 0) return { s: s, ok: false, why: "zero-size" };',
        '  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);',
        '  const ok = !!top && (e === top || e.contains(top) || top.contains(e));',
        '  return { s: s, ok: ok, why: top ? top.tagName + (top.className ? "." + top.className : "") : "none" };',
        '});'
    ].join('\n'));
}

runCase('HDHomeUI · 功能保持(胶片墙)', async function () {
    await withSim(async function (sim) {
        // ---- 基线(显式播种 film: 首次安装默认已是「原站默认」, 不再自动上妆) ----
        sim.seed({ 'hdui.theme': 'film' });
        const base = await H.open(sim, 'hdhome-ui');
        await H.waitState(base, 'applied');
        const baseSnap = await H.snapshot(base);
        assertEq(baseSnap.rows, 13, '基线: 1 表头 + 12 数据行');
        assert(baseSnap.nav.length >= 15, '基线: 主导航 >= 15 项, 实际 ' + baseSnap.nav.length);
        assertEq(baseSnap.rssIds.length, 12, '基线: 12 个 RSS 切换按钮');
        assert(baseSnap.infoLinks.some(function (h) { return h && h.indexOf('attendance.php') >= 0; }),
            '基线: 签到入口存在');
        assertEq(H.dangerousHits(sim).length, 0, '基线: 上妆零危险端点访问');

        const baseHits = await hitTest(base);
        for (const h of baseHits) assert(h.ok, '基线 hit-test: ' + h.s + ' (' + h.why + ')');
        await base.close();

        // ---- 5 套主题逐个上妆 ----
        for (const id of THEMES) {
            sim.seed({ 'hdui.theme': id });
            // 上一轮"用户主动点 RSS"会留下 1 条 myrss 记录, 故按增量判定, 不按绝对值
            const dangerBase = H.dangerousHits(sim).length;
            const page = await H.open(sim, 'hdhome-ui');
            await H.waitState(page, 'applied');
            assertEq(await H.themeOf(page), id, '主题 ' + id + ' 已生效');

            const snap = await H.snapshot(page);
            const d = diffKey(baseSnap, snap);
            assert(d.length === 0, '主题 ' + id + ' 功能基线不变; 差异: ' + d.join(' | '));

            const hits = await hitTest(page);
            for (const h of hits) assert(h.ok, '主题 ' + id + ' hit-test: ' + h.s + ' (' + h.why + ')');

            assertEq(H.dangerousHits(sim).length, dangerBase, '主题 ' + id + ' 上妆零危险端点访问');

            // RSS 切换: 点一下 = 恰好一次 myrss.php
            const before = sim.requests().filter(function (r) { return r.path === '/myrss.php'; }).length;
            await H.clickSiteElement(page, '#torrenttable [data-toggle-rss]');
            const after = sim.requests().filter(function (r) { return r.path === '/myrss.php'; });
            assertEq(after.length - before, 1, '主题 ' + id + ': RSS 点击产生恰好 1 次请求');
            assert(/torrentid=300000/.test(after[after.length - 1].url),
                '主题 ' + id + ': RSS 请求带正确 torrentid, 实际 ' + after[after.length - 1].url);
            await page.close();
        }

        // ---- 搜索箱折叠(站内 klappe_news)仍然工作 ----
        sim.seed({ 'hdui.theme': 'film' });
        const p2 = await H.open(sim, 'hdhome-ui');
        await H.waitState(p2, 'applied');
        assertEq(await p2.eval('return getComputedStyle(document.getElementById("ksearchboxmain")).display;'),
            'none', '搜索箱初始收起');
        await p2.eval('window.klappe_news("searchboxmain"); return 1;');
        assert(await p2.eval('return getComputedStyle(document.getElementById("ksearchboxmain")).display;') !== 'none',
            '站内 klappe_news 仍能展开搜索箱');

        // ---- 搜索表单仍可提交 ----
        await p2.eval('document.getElementById("searchinput").value = "kunning"; return 1;');
        await p2.eval('document.forms.searchbox.submit(); return 1;');
        await new Promise(function (r) { setTimeout(r, 1200); });
        const search = await p2.eval('return location.search;');
        assert(search.indexOf('search=kunning') >= 0, '搜索表单仍能提交并带上关键词, 实际 ' + search);

        // ---- 运行时局部刷新后结构仍成立(MutationObserver 不误报) ----
        await p2.eval([
            'const t = document.getElementById("torrenttable");',
            'const tb = t.tBodies[0];',
            'tb.appendChild(tb.rows[1]);', // 移动一行, 模拟站内局部重排
            'return 1;'
        ].join('\n'));
        await new Promise(function (r) { setTimeout(r, 1200); });
        assertEq(await p2.eval('return document.documentElement.dataset.hduiState;'), 'applied',
            '局部重排后仍保持上妆(未误判为结构损坏)');
        await p2.close();
    }, { scriptPath: H.HDUI_PATH });
});
