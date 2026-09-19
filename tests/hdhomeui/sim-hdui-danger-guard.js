#!/usr/bin/env node
'use strict';
/**
 * 仿真: 危险操作防护
 * ------------------------------------------------------------------
 * 用户在"改版后的页面"上误触是本脚本最大的风险面, 这里钉死三件事:
 *   1. 点我们自己的 UI(内嵌开关 / 面板主题项)与按快捷键 —— 事件不得冒泡到站内
 *      document 级监听(站内计数器必须纹丝不动)
 *   2. 切换主题全程零站内请求(签到 / 登出 / 魔力 / 邀请 / 捐赠 / 个人页 / RSS / 广告)
 *   3. 反过来证明站内监听与 RSS 交互仍然活着(计数器真的会涨、请求真的会发)
 */

const { withSim } = require('../lib/sim/harness');
const { runCase, assert, assertEq } = require('../lib/sim/tcase');
const H = require('../lib/hdui-help');

function clicks(page) {
    return page.eval('return window.__siteDocClicks;');
}

function rssHits(sim) {
    return sim.requests().filter(function (r) { return r.path === '/myrss.php'; });
}

runCase('HDHomeUI · 危险操作防护', async function () {
    await withSim(async function (sim) {
        sim.seed({ 'hdui.theme': 'film' });
        const page = await H.open(sim, 'hdhome-ui');
        await H.waitState(page, 'applied');

        const c0 = await clicks(page);
        assert(typeof c0 === 'number', '站内 document 级点击计数器就位');

        // ---- 1. 自持 UI 的事件不冒泡到站内 ----
        await H.clickDock(page);
        assertEq(await clicks(page), c0, '点内嵌开关不冒泡到站内监听');
        const top = await H.panelTop(page);
        assert(top !== null, '面板已展开');

        await H.clickFirstPanelItemThatChanges(page);
        assertEq(await clicks(page), c0, '点面板主题项不冒泡到站内监听');

        await H.pressAltShiftT(page);
        assertEq(await clicks(page), c0, '快捷键切换不冒泡到站内监听');

        // ---- 2. 切换主题全程零站内请求 ----
        assertEq(H.dangerousHits(sim).length, 0, '切换主题全程零危险端点访问');
        assertEq(rssHits(sim).length, 0, '切换主题不会触发 RSS 增删');

        // ---- 3. 站内交互确实还活着(反向证明计数器有效) ----
        await H.clickSiteElement(page, '#torrenttable [data-toggle-rss]');
        const c1 = await clicks(page);
        assert(c1 > c0, '站内 document 监听仍然存活(' + c0 + ' -> ' + c1 + ')');
        assertEq(rssHits(sim).length, 1, 'RSS 点击产生恰好 1 次请求');

        // ---- 4. 除用户主动那一次外, 无任何危险端点访问 ----
        const danger = H.dangerousHits(sim).filter(function (r) { return r.path !== '/myrss.php'; });
        assertEq(danger.length, 0, '除用户主动点的 RSS 外零危险访问, 实际 ' + JSON.stringify(danger.map(function (r) { return r.path; })));

        // ---- 5. 签到 / 登出 / 魔力入口始终只是链接, 从未被触发 ----
        const untouched = await page.eval([
            'const sels = [\'a[href*="attendance.php"]\', \'a[href*="logout.php"]\', \'a[href*="mybonus.php"]\'];',
            'return sels.map(function (s) {',
            '  const e = document.querySelector(s);',
            '  return e ? { href: e.getAttribute("href"), hasHandler: !!e.onclick } : null;',
            '});'
        ].join('\n'));
        for (let i = 0; i < untouched.length; i++) {
            assert(!!untouched[i], '危险入口仍在页面中 #' + i);
            assertEq(untouched[i].hasHandler, false, '危险入口未被脚本挂上 onclick #' + i);
        }
        await page.close();
    }, { scriptPath: H.HDUI_PATH });
});
