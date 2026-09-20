#!/usr/bin/env node
'use strict';
/**
 * 仿真: 真正生效的那张样式表里, 隐藏类规则全部在白名单内
 * ------------------------------------------------------------------
 * 为什么静态那份还不够:
 *   `check-hdui-hide-allowlist.js` 扫的是**源码文本**, 而本主题的选择器是**运行时拼出来的**
 *   (`:nth-child(N)` 由列映射算出来、TN_META 是拼接常量、可选列缺席时整段不生成)。
 *   源码里只有一条 `br{display:none}`, 运行时却可能展开成好几条不同列号的规则 ——
 *   "文本没有" 不等于 "没有生效"。这里看的是浏览器**解析后真正生效的那张表**。
 *
 * 覆盖:
 *   ① display:none 的规则集合 == 白名单(多一条即红, 并把 selectorText 打出来)
 *   ② 不使用 visibility / opacity / clip-path / content-visibility 这几种"看不见"的写法
 *   ③ contain 只出现在 #torrenttable 上且取值是 inline-size
 *   ④ overflow:hidden / z-index 白名单化
 *   ⑤ **每条规则的选择器都必须锚定在已知根** —— 这条是防 `table{display:none}` 级别事故的闸门
 */

const { withSim } = require('../lib/sim/harness');
const { runCase, assert } = require('../lib/sim/tcase');
const H = require('../lib/hdui-help');

/**
 * 把 style#hdui-css 里每条规则的关键属性抓出来。
 * ⚠️ 用 CSSOM 的 style.getPropertyValue(而不是读文本): 拿到的就是浏览器实际采用的值。
 */
const DUMP = [
    'const st = document.getElementById("hdui-css");',
    'if (!st || !st.sheet) return { err: "拿不到 style#hdui-css 的 sheet" };',
    'function walk(rules, out) {',
    '  for (let i = 0; i < rules.length; i++) {',
    '    const r = rules[i];',
    '    if (r.cssRules && r.cssRules.length) { walk(r.cssRules, out); continue; }',
    '    if (!r.selectorText) continue;',
    '    const s = r.style;',
    '    out.push({ sel: r.selectorText,',
    '      display: s.getPropertyValue("display"),',
    '      visibility: s.getPropertyValue("visibility"),',
    '      opacity: s.getPropertyValue("opacity"),',
    '      overflow: s.getPropertyValue("overflow"),',
    '      clip: s.getPropertyValue("clip-path"),',
    '      cv: s.getPropertyValue("content-visibility"),',
    '      contain: s.getPropertyValue("contain"),',
    '      z: s.getPropertyValue("z-index"),',
    '      pos: s.getPropertyValue("position") });',
    '  }',
    '  return out;',
    '}',
    'const rules = walk(st.sheet.cssRules, []);',
    'return { n: rules.length, rules: rules };'
].join('\n');

/** 白名单: 运行时允许存在的 display:none 规则(选择器用正则, 因为列号是算出来的) */
const HIDE_ALLOW = [
    { why: '大小列的 <br>', re: /^#torrenttable > tbody > tr:not\(:first-child\) > td:nth-child\(\d+\) br$/ },
    { why: '动作区的 <br>', re: /^#torrenttable table\.torrentname > tbody > tr > td\.embedded:not\(\.rss\):not\(:first-child\) br$/ },
    { why: '搜索箱折叠小图标', re: /^html\[data-hdui-theme\] table\.searchbox img\.plus$/ }
];

/** overflow:hidden 白名单 */
const OVER_ALLOW = [
    { why: '片头格子(列宽固定)', re: /^#torrenttable > tbody > tr:first-child > td$/ },
    { why: '数据行格子(列宽固定)', re: /^#torrenttable > tbody > tr:not\(:first-child\) > td$/ },
    { why: '标题链接(省略号)', re: /^#torrenttable table\.torrentname > tbody > tr > td:first-child > a$/ },
    { why: '发布者列(省略号)', re: /^#torrenttable > tbody > tr:not\(:first-child\) > td:nth-child\(\d+\)$/ },
    { why: '搜索箱卡片(圆角)', re: /^html\[data-hdui-theme\] table\.searchbox$/ }
];

/**
 * 选择器必须锚定的已知根。
 * ⚠️ 这一条是「对未知元素不默认屏蔽」的结构性保证: 任何一条规则都只能作用在
 *    我们已经认识的区域上, 不可能误伤页面其它地方(尤其是将来新增的弹窗 / 公告 / 新标签)。
 */
const ROOTS = [/^html\[data-hdui-theme/, /^#torrenttable/, /^ul#mainmenu/];

runCase('HDHomeUI · 生效的样式表里没有白名单外的隐藏规则（CSSOM 逐条）', async function () {
    await withSim(async function (sim) {
        sim.seed({ 'hdui.theme': 'film' });
        const page = await H.open(sim, 'hdhome-ui');
        await H.waitState(page, 'applied');

        const d = await page.eval(DUMP);
        assert(!d.err, '拿到 style#hdui-css 的规则' + (d.err ? '(' + d.err + ')' : ''));
        assert(d.n > 60, '规则数 ' + d.n + ' > 60(防 CSS 没生成)');

        // ⑤ 每条规则的选择器都必须锚定在已知根
        const stray = d.rules.filter(function (r) {
            return !ROOTS.some(function (re) { return re.test(r.sel); });
        });
        assert(stray.length === 0,
            '每条规则都锚定在已知根(html[data-hdui-theme] / #torrenttable / ul#mainmenu), 共 '
            + d.n + ' 条; 越界: ' + JSON.stringify(stray.slice(0, 5).map(function (r) { return r.sel; })));

        // ① 隐藏规则集合 == 白名单
        const hidden = d.rules.filter(function (r) { return r.display === 'none'; });
        const unclaimed = [];
        const used = new Array(HIDE_ALLOW.length).fill(0);
        hidden.forEach(function (r) {
            let hit = -1;
            for (let k = 0; k < HIDE_ALLOW.length; k++) { if (HIDE_ALLOW[k].re.test(r.sel)) { hit = k; break; } }
            if (hit < 0) unclaimed.push(r.sel); else used[hit]++;
        });
        assert(unclaimed.length === 0,
            '没有白名单外的 display:none 规则(共 ' + hidden.length + ' 条); 未认领: '
            + JSON.stringify(unclaimed));
        HIDE_ALLOW.forEach(function (a, k) {
            assert(used[k] >= 1, 'display:none 白名单条目仍有效: ' + a.why);
        });

        // ② 其它几种"看不见"的写法一律不用
        ['visibility', 'clip', 'cv'].forEach(function (p) {
            const bad = d.rules.filter(function (r) { return r[p] && r[p] !== ''; });
            assert(bad.length === 0,
                '不使用 ' + p + '(共 ' + d.n + ' 条规则); 命中: '
                + JSON.stringify(bad.slice(0, 4).map(function (r) { return r.sel; })));
        });
        const op0 = d.rules.filter(function (r) { return r.opacity !== '' && parseFloat(r.opacity) === 0; });
        assert(op0.length === 0, '不使用 opacity:0; 命中: '
            + JSON.stringify(op0.slice(0, 4).map(function (r) { return r.sel; })));

        // ③ contain 只在 #torrenttable 上, 且是 inline-size
        const cont = d.rules.filter(function (r) { return r.contain && r.contain !== ''; });
        assert(cont.length === 1 && cont[0].sel === '#torrenttable',
            'contain 只出现在 #torrenttable 上; 实际: '
            + JSON.stringify(cont.map(function (r) { return r.sel + ' -> ' + r.contain; })));
        assert(cont.length === 1 && cont[0].contain === 'inline-size',
            'contain 取值是 inline-size(不是 paint/strict/content —— 那些会裁切或改变定位基准); 实际: '
            + (cont[0] ? cont[0].contain : '(无)'));

        // ④ overflow:hidden 白名单化
        const over = d.rules.filter(function (r) { return r.overflow === 'hidden'; });
        const overUn = [];
        const overUsed = new Array(OVER_ALLOW.length).fill(0);
        over.forEach(function (r) {
            let hit = -1;
            for (let k = 0; k < OVER_ALLOW.length; k++) { if (OVER_ALLOW[k].re.test(r.sel)) { hit = k; break; } }
            if (hit < 0) overUn.push(r.sel); else overUsed[hit]++;
        });
        assert(overUn.length === 0,
            '没有白名单外的 overflow:hidden(共 ' + over.length + ' 条); 未认领: ' + JSON.stringify(overUn));
        OVER_ALLOW.forEach(function (a, k) {
            assert(overUsed[k] >= 1, 'overflow 白名单条目仍有效: ' + a.why);
        });

        // ④b z-index: 站内样式里只允许片头吸顶那一档
        const zs = d.rules.filter(function (r) { return r.z && r.z !== '' && r.z !== 'auto'; });
        const badZ = zs.filter(function (r) { return parseInt(r.z, 10) > 6; });
        assert(badZ.length === 0,
            '站内样式里没有大 z-index(只有片头吸顶那档); 越界: '
            + JSON.stringify(badZ.map(function (r) { return r.sel + ' -> ' + r.z; })));

        // ④c 主题 CSS 里不得出现 position:fixed(会盖住站内弹窗)
        const fix = d.rules.filter(function (r) { return r.pos === 'fixed'; });
        assert(fix.length === 0,
            '主题 CSS 里没有 position:fixed; 命中: ' + JSON.stringify(fix.map(function (r) { return r.sel; })));

        await page.close();
    }, { scriptPath: H.HDUI_PATH });
});
