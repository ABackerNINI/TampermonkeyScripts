#!/usr/bin/env node
'use strict';
/**
 * 仿真: 入口内嵌(不占悬浮位 / 不压站内内容)
 * ------------------------------------------------------------------
 * 2026.09.19.3 的需求: 右下角浮动圆钮会和其它脚本的 FAB 抢同一个位置, 必须改成
 * 页面里的内置小按钮。这个用例把「内嵌」钉死成可验证的事实:
 *   1. 宿主不是 fixed(不悬浮), 且落在导航栏那一行里(与 ul#mainmenu 垂直相交)
 *   2. 开关矩形内任何一点做 hit-test 都命中我们自己 —— 没压住任何站内元素
 *   3. 导航栏 16 个入口在上妆前后都仍然可点(没被开关遮住)
 *   4. 换主题后开关会重摆(主题改了导航排版, 位置必须跟着走)
 *   5. 视口右下角(其它脚本 FAB 的常用位)不留我们的东西
 */

const { withSim } = require('../lib/sim/harness');
const { runCase, assert, assertEq } = require('../lib/sim/tcase');
const H = require('../lib/hdui-help');

/** 开关矩形内均匀取点做 hit-test, 返回未命中宿主的那些点(应为空) */
function dockOverlapProbe(page) {
    return page.eval([
        'const h = document.getElementById("hdui-root");',
        'if (!h) return { missing: true };',
        'const r = h.getBoundingClientRect();',
        'const bad = [];',
        'for (let fx = 0.1; fx <= 0.9; fx += 0.2) {',
        '  for (let fy = 0.2; fy <= 0.8; fy += 0.3) {',
        '    const x = Math.round(r.left + r.width * fx), y = Math.round(r.top + r.height * fy);',
        '    const e = document.elementFromPoint(x, y);',
        '    if (!e || e.id !== "hdui-root") bad.push({ x: x, y: y, hit: e ? (e.tagName + (e.id ? "#" + e.id : "")) : "none" });',
        '  }',
        '}',
        'return { missing: false, bad: bad };'
    ].join('\n'));
}

/** 开关是否落在导航行内: 与 ul#mainmenu 垂直有交集, 且水平上不早于菜单起点 */
function dockInNavRow(page) {
    return page.eval([
        'const h = document.getElementById("hdui-root");',
        'const m = document.querySelector("ul#mainmenu");',
        'if (!h || !m) return null;',
        'const r = h.getBoundingClientRect(), mr = m.getBoundingClientRect();',
        'return {',
        '  vOverlap: Math.min(r.bottom, mr.bottom) - Math.max(r.top, mr.top),',
        '  dockTop: r.top, dockLeft: r.left, menuTop: mr.top, menuBottom: mr.bottom, menuLeft: mr.left, menuRight: mr.right',
        '};'
    ].join('\n'));
}

/** 导航所有条目是否都还能被点到(hit-test) */
function navHitTest(page) {
    return page.eval([
        'const as = Array.prototype.slice.call(document.querySelectorAll("ul#mainmenu li a"));',
        'return as.map(function (a) {',
        '  const r = a.getBoundingClientRect();',
        '  if (r.width === 0 || r.height === 0) return false;',
        '  const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);',
        '  return !!e && (a === e || a.contains(e) || e.contains(a));',
        '});'
    ].join('\n'));
}

runCase('HDHomeUI · 入口内嵌(不悬浮 / 不压站内内容)', async function () {
    await withSim(async function (sim) {
        sim.seed({ 'hdui.theme': 'film' });
        const page = await H.open(sim, 'hdhome-ui');
        await H.waitState(page, 'applied');

        // ---- 1. 不悬浮, 且落在导航行内 ----
        const d = await H.dockRect(page);
        assert(!!d, '内嵌入口 #hdui-root 存在');
        assertEq(d.position, 'absolute', '入口不悬浮(position=absolute, 随页面滚动)');
        const nav = await dockInNavRow(page);
        assert(!!nav, '导航容器与入口都存在');
        assert(nav.vOverlap > 0, '入口落在导航栏那一行里(垂直相交 ' + Math.round(nav.vOverlap) + 'px)');
        assert(nav.dockLeft >= nav.menuLeft - 1, '入口不越到导航栏左侧之外');

        // ---- 2. 没压住任何站内元素 ----
        const probe = await dockOverlapProbe(page);
        assertEq(probe.missing, false, '入口矩形可取到');
        assertEq(probe.bad.length, 0, '入口矩形内 hit-test 全命中自己, 未命中: '
            + JSON.stringify(probe.bad.slice(0, 3)));

        // ---- 3. 导航 16 个入口仍然可点 ----
        const hits = await navHitTest(page);
        assert(hits.length >= 15, '导航栏条目数 >= 15, 实际 ' + hits.length);
        const blocked = hits.filter(function (x) { return !x; }).length;
        assertEq(blocked, 0, '导航栏条目全部可点, 被遮住 ' + blocked + ' 个');

        // ---- 4. 切回「原站默认」后入口要重新量位 ----
        // ⚠️ 这里**不能**断言"位置必须变化": 入口锚在导航右端的预留槽位(`ul#mainmenu` 的
        //    padding-right), 而菜单右边缘在两个主题下是同一个值 —— 位置不动反而是对的。
        //    要钉的是"锚定关系成立且没压住信息栏", 那才是重新量位的可验证结果。
        await H.clickDock(page);
        let changed = await H.clickFirstPanelItemThatChanges(page);
        if (changed === null) { // 面板里第一下可能点到已选项, 用快捷键兜底推进
            await H.pressAltShiftT(page);
            changed = await H.themeOf(page);
        }
        assert(changed !== null, '面板/快捷键可切换主题');
        await new Promise(function (r) { setTimeout(r, 400); });
        const after = await H.dockRect(page);
        assert(!!after, '换主题后入口仍在');
        assertEq(after.position, 'absolute', '换主题后入口仍不悬浮');
        const nav2 = await dockInNavRow(page);
        assert(nav2.vOverlap > 0, '换主题后入口仍贴在导航行内');
        const anchor = await page.eval([
            'const h = document.getElementById("hdui-root").getBoundingClientRect();',
            'const m = document.querySelector("ul#mainmenu").getBoundingClientRect();',
            'const ib = document.getElementById("info_block").getBoundingClientRect();',
            'const ox = Math.min(h.right, ib.right) - Math.max(h.left, ib.left);',
            'const oy = Math.min(h.bottom, ib.bottom) - Math.max(h.top, ib.top);',
            'return { gap: Math.round(m.right - h.right),',
            '  vOverlap: Math.round(Math.min(h.bottom, m.bottom) - Math.max(h.top, m.top)),',
            '  infoOverlap: (ox > 0 && oy > 0) ? { ox: Math.round(ox), oy: Math.round(oy) } : null };'
        ].join('\n'));
        assert(Math.abs(anchor.gap - 8) <= 3,
            '入口锚在导航右端预留槽位上(距菜单右边 ' + anchor.gap + 'px, 期望 8)');
        assert(anchor.vOverlap > 0, '入口与导航垂直相交 ' + anchor.vOverlap + 'px');
        assertEq(anchor.infoOverlap, null,
            '入口不压住用户信息栏(留槽位就是为了这个), 实际 ' + JSON.stringify(anchor.infoOverlap));

        // ---- 5. 右下角(其它脚本 FAB 的常用位)不留我们的东西 ----
        const v = await page.eval('return { w: window.innerWidth, h: window.innerHeight };');
        const corner = await page.eval([
            'const pts = [[window.innerWidth - 18 - 22, window.innerHeight - 18 - 22],',
            '             [window.innerWidth - 18 - 22, window.innerHeight - 18 - 40]];',
            'return pts.map(function (p) {',
            '  const e = document.elementFromPoint(p[0], p[1]);',
            '  return e ? (e.id || e.tagName) : "none";',
            '});'
        ].join('\n'));
        for (let i = 0; i < corner.length; i++) {
            assert(corner[i] !== 'hdui-root', '右下角浮动位未被我们占用 #' + i + ' 实际 ' + corner[i]);
        }
        assert(v.w > 0 && v.h > 0, '视口尺寸有效');

        await page.close();
    }, { scriptPath: H.HDUI_PATH });
});
