#!/usr/bin/env node
'use strict';
/**
 * 仿真: 胶片墙与原型 `film.html` 的**保真度**
 * ------------------------------------------------------------------
 * 为什么要有这个用例:
 *   原有 26 个用例只能证明"没回归"(功能保持 / 危险防护 / 骨架还在),
 *   它们**证明不了"长得像原型"**。而且原型是理想化的手写页面, 真站的类名/结构/站点 CSS
 *   与它并不一致 —— 照着原型写的仿真页自然测不出这些差异(见 pitfalls P48/P49)。
 *   所以本用例的每一条都对着**原型的设计值**断言, 且全部走**运行时实测**
 *   (`getComputedStyle` / `getBoundingClientRect`), 不查源码字符串。
 *
 * 覆盖: 列头补充图标 / 列头不是白粗字 / 数据行对齐 / 标题与 RSS 同行 /
 *       类别色块 34px / 三层灰 / 促销徽章 / 标签药丸保留分类色 / 类别兜底 /
 *       导航 hover 与末 6 项弱化 / 入口胶囊尺寸与预留槽位 / 面板卡片宽度
 */

const { withSim } = require('../lib/sim/harness');
const { runCase, assert, assertEq } = require('../lib/sim/tcase');
const H = require('../lib/hdui-help');

const SVG = 'data:image/svg+xml';
const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

/** 列头: 6 个"原本无图标"的列必须补出 ::before 图标, 且不是白粗字 */
const HEAD_PROBE = [
    'const head = document.getElementById("torrenttable").tBodies[0].rows[0];',
    'const cells = Array.prototype.slice.call(head.cells);',
    'function cs(e, p, ps) { return ps ? getComputedStyle(e, ps).getPropertyValue(p) : getComputedStyle(e).getPropertyValue(p); }',
    'return {',
    '  icons: cells.map(function (c) {',
    '    const bg = cs(c, "background-image", "::before");',
    '    const w = parseFloat(cs(c, "width", "::before")) || 0;',
    '    return { svg: String(bg).indexOf("data:image/svg+xml") >= 0, w: Math.round(w) };',
    '  }),',
    '  colors: cells.map(function (c) {',
    '    const a = c.querySelector("a");',
    '    const t = a || c;',
    '    return { color: cs(t, "color"), weight: cs(t, "font-weight"),',
    '      after: a ? cs(a, "content", "::after") : "" };',
    '  })',
    '};'
].join('\n');

/**
 * 文本截断(.20 用户实拍「下载进度显示不全」): 内容被裁(scrollW/H > clientW/H)且非 ellipsis。
 * 真站由此抓到「进度」列头被裁 3px(列宽 40 放不下 ::before 图标 15 + gap 5 + 文字 23)。
 */
const TRUNC_PROBE = [
    'function cs(e, p) { return getComputedStyle(e).getPropertyValue(p); }',
    'const bad = [];',
    'Array.prototype.forEach.call(document.querySelectorAll("#torrenttable td, #torrenttable b,"',
    '  + " #torrenttable font, #torrenttable span"), function (e) {',
    '  const r = e.getBoundingClientRect();',
    '  if (r.width < 4 || r.height < 4) return;',
    '  let txt = "";',
    '  for (let n = e.firstChild; n; n = n.nextSibling) {',
    '    if (n.nodeType === 3) txt += n.nodeValue;',
    '  }',
    '  if (!txt.trim()) return;',
    '  const ovX = e.scrollWidth - e.clientWidth, ovY = e.scrollHeight - e.clientHeight;',
    '  if (ovX <= 1 && ovY <= 1) return;',
    '  if (cs(e, "text-overflow") === "ellipsis") return;',
    '  bad.push(e.tagName.toLowerCase() + (e.getAttribute("class") ? "." + e.getAttribute("class").split(/\\s+/)[0] : "")',
    '    + " " + Math.round(r.width) + "x" + Math.round(r.height) + " 超出 " + ovX + "x" + ovY',
    '    + " 例:" + txt.replace(/\\s+/g, " ").trim().slice(0, 12));',
    '});',
    'return bad.slice(0, 8);'
].join('\n');

/**
 * 片头与数据行是否同一条列网格(.19 用户实拍「标题栏错位」)。
 * 真站实测: 片头 `padding:10px 0 9px`(左右 0) vs 数据行 `padding:7px 10px`(左右 10)
 * ⇒ 每一列的表头都比数据往左 10px。这里逐列比对左右边缘。
 */
const ALIGN_PROBE = [
    'const t = document.getElementById("torrenttable").tBodies[0];',
    'const h = t.rows[0];',
    'const r = t.rows[1];',
    'if (!h || !r) return { err: "no rows" };',
    'const n = Math.min(h.cells.length, r.cells.length);',
    'const out = [];',
    'for (let i = 0; i < n; i++) {',
    '  const a = h.cells[i].getBoundingClientRect(), b = r.cells[i].getBoundingClientRect();',
    '  out.push({ i: i, dL: Math.round(b.left - a.left), dR: Math.round(b.right - a.right) });',
    '}',
    'return { cols: out };'
].join('\n');

/** 数据行: 对齐 / 灰阶 / 类别色块 / 促销 / 标签 / 兜底类别 */
const ROW_PROBE = [
    'const t = document.getElementById("torrenttable");',
    'const rows = Array.prototype.slice.call(t.tBodies[0].rows).slice(1);',
    'const r0 = rows[0];',
    'function cs(e, p) { return getComputedStyle(e).getPropertyValue(p); }',
    'const cells = Array.prototype.slice.call(r0.cells);',
    'const catImgs = Array.prototype.slice.call(t.querySelectorAll("img[class*=\'c_\']"));',
    'const pro = t.querySelector("img[class*=\'pro_\']");',
    'const tag = t.querySelector("span.tags");',
    'const tn = r0.cells[1].querySelector("table.torrentname");',
    'const inner = tn.tBodies[0].rows[0];',
    'const titleA = inner.cells[0].querySelector("a");',
    'const rssA = inner.cells[2].querySelector("a");',
    'const cat0 = catImgs[0];',
    'const cb = cat0 ? cat0.getBoundingClientRect() : null;',
    'return {',
    '  align: cells.map(function (c) { return cs(c, "text-align"); }),',
    '  colors: cells.map(function (c) { return cs(c, "color"); }),',
    '  cat: cb ? { w: Math.round(cb.width), h: Math.round(cb.height), radius: cs(cat0, "border-radius"),',
    '    pad: cs(cat0, "padding-left") } : null,',
    '  catAllSvg: catImgs.map(function (im) { return String(cs(im, "content")).indexOf("data:image/svg+xml") >= 0; }),',
    '  catCls: catImgs.map(function (im) { return im.className; }),',
    '  pro: pro ? { w: Math.round(pro.getBoundingClientRect().width),',
    '    svg: String(cs(pro, "content")).indexOf("data:image/svg+xml") >= 0 } : null,',
    '  tag: tag ? { float: cs(tag, "float"), radius: cs(tag, "border-radius"),',
    '    bg: cs(tag, "background-color") } : null,',
    '  titleTop: titleA ? Math.round(titleA.getBoundingClientRect().top) : null,',
    '  rssTop: rssA ? Math.round(rssA.getBoundingClientRect().top) : null,',
    '  rssLeft: rssA ? Math.round(rssA.getBoundingClientRect().left) : null,',
    '  titleLeft: titleA ? Math.round(titleA.getBoundingClientRect().left) : null,',
    '  titleEllipsis: titleA ? cs(titleA, "text-overflow") : null,',
    '  infoColor: cs(document.getElementById("info_block"), "color"),',
    '  infoB: (function () { const b = document.querySelector("#info_block b"); return b ? cs(b, "color") : null; })()',
    '};'
].join('\n');

/** 导航: hover 底色 / 末 6 项弱化 / 图标尺寸 */
const NAV_PROBE = [
    'const as = Array.prototype.slice.call(document.querySelectorAll("ul#mainmenu li a"));',
    'function cs(e, p, ps) { return ps ? getComputedStyle(e, ps).getPropertyValue(p) : getComputedStyle(e).getPropertyValue(p); }',
    'return as.map(function (a) {',
    '  return { fs: cs(a, "font-size"), pad: cs(a, "padding-left"), radius: cs(a, "border-radius"),',
    '    bg: cs(a, "background-color"), border: cs(a, "border-top-width"),',
    '    iconW: Math.round(parseFloat(cs(a, "width", "::before")) || 0),',
    '    iconOpacity: cs(a, "opacity", "::before") };',
    '});'
].join('\n');

runCase('HDHomeUI · 胶片墙与原型 film.html 的保真度', async function () {
    await withSim(async function (sim) {
        sim.seed({ 'hdui.theme': 'film' });
        const page = await H.open(sim, 'hdhome-ui');
        await H.waitState(page, 'applied');

        // ================= 列头 =================
        const head = await page.eval(HEAD_PROBE);
        const needIcon = [0, 1, 8, 9, 10, 11]; // 类型 / 标题 / 进度 / A / A·GB / 发布者
        needIcon.forEach(function (i) {
            const ic = head.icons[i];
            assert(!!ic && ic.svg && ic.w > 0,
                '列头第 ' + (i + 1) + ' 列补出 ::before 图标(原型有, 真站只有文字), 实际 '
                + JSON.stringify(ic));
        });
        head.colors.forEach(function (c, i) {
            assert(c.color !== 'rgb(255, 255, 255)',
                '列头第 ' + (i + 1) + ' 列不是站点默认的纯白(已被重置为 fg2), 实际 ' + c.color);
            assert(c.weight !== '700' && c.weight !== 'bold',
                '列头第 ' + (i + 1) + ' 列不是粗体(站点 td.colhead 的 bold 已被重置), 实际 ' + c.weight);
        });
        // 「发布者」列头自带文字 ⇒ ::after 只能补箭头
        assert(String(head.colors[11].after).indexOf('发布者') < 0,
            '发布者列头不重复补栏名(A4), 实际 ' + JSON.stringify(head.colors[11].after));

        // ================= 文本截断(.20) =================
        const trunc = await page.eval(TRUNC_PROBE);
        assertEq(trunc.length, 0,
            '无内容被裁(scrollW/H > clientW/H 且非 ellipsis); 截断: ' + JSON.stringify(trunc));

        // ================= 片头 vs 数据行: 同一条列网格(.19) =================
        const al = await page.eval(ALIGN_PROBE);
        assert(!al.err, '取到片头与数据行' + (al.err ? '(' + al.err + ')' : ''));
        const bad = (al.cols || []).filter(function (c) {
            return Math.abs(c.dL) > 2 || Math.abs(c.dR) > 2;
        });
        assertEq(bad.length, 0,
            '片头与数据行逐列对齐(12 列左右边缘差 ≤ 2px); 错位列: '
            + JSON.stringify(bad) + ' —— 片头横向 padding 必须与数据行一致');

        // ================= 数据行 =================
        const row = await page.eval(ROW_PROBE);
        // 站点 `table.torrents td.rowfollow{text-align:center}` 会把标题也居中
        [0, 1, 11].forEach(function (i) {
            assertEq(row.align[i], 'left', '第 ' + (i + 1) + ' 列数据格左对齐(压住站点的居中)');
        });
        assertEq(row.align[8], 'center', '进度列居中');
        assertEq(row.align[5], 'right', '做种列右对齐(数值成列)');

        // 三层灰: dim #7a7267 / muted #a79e93
        assertEq(row.colors[11], 'rgb(122, 114, 103)', '上传者用最弱一档灰(--hdui-dim)');
        assertEq(row.colors[4], 'rgb(167, 158, 147)', '大小列用中间一档灰(--hdui-muted)');
        assertEq(row.colors[5], 'rgb(245, 179, 66)', '做种数是唯一强调金');
        assertEq(row.infoColor, 'rgb(122, 114, 103)', '信息栏用最弱一档灰');
        assertEq(row.infoB, 'rgb(167, 158, 147)', '信息栏加粗项用中间一档灰');

        // 类别色块: 22px 图形 + 6px 内边距 = 34px 方块, 圆角 10
        assert(!!row.cat, '找得到类别图标');
        assert(Math.abs(row.cat.w - 34) <= 2 && Math.abs(row.cat.h - 34) <= 2,
            '类别色块 34px(22 + 6×2, 原型尺寸), 实际 ' + row.cat.w + 'x' + row.cat.h);
        assertEq(row.cat.radius, '10px', '类别色块圆角 10px');
        assertEq(row.cat.pad, '6px', '类别色块内边距 6px');

        // 兜底: **所有**类别图标都换成 SVG —— 含 c_cartoon / c_misc / c_4kuhd_remux 这些
        // 原型清单里没有、真站却真实存在的家族(漏一个就会显示雪碧图碎片)
        assert(row.catAllSvg.length >= 8, '表内类别图标 >= 8 个, 实际 ' + row.catAllSvg.length);
        row.catCls.forEach(function (cls, i) {
            assert(row.catAllSvg[i], '类别 ' + cls + ' 也换成了 SVG(兜底生效)');
        });
        assert(row.catCls.some(function (c) { return /c_cartoon|c_misc|c_4kuhd/.test(c); }),
            '仿真页确实覆盖了原型清单之外的类别家族, 实际 ' + JSON.stringify(row.catCls));

        // 促销徽章: 真站是 img.pro_*, 原型是"药丸"; 图形化后 16px 内联 SVG
        assert(!!row.pro, '找得到促销图标 img.pro_*');
        assert(row.pro.svg, '促销图标换成内联 SVG(真站的 36×11 雪碧图已替换)');
        assertEq(row.pro.w, 16, '促销徽章 16px');

        // 标签: 保留站点 23 种分类色, 只改形状
        assert(!!row.tag, '找得到行内标签 span.tags');
        assertEq(row.tag.float, 'none', '标签不再 float:left(站点默认)');
        assertEq(row.tag.radius, '999px', '标签是药丸');
        assert(row.tag.bg !== 'rgba(0, 0, 0, 0)',
            '标签保留站点分类底色(23 色不丢), 实际 ' + row.tag.bg);

        // 标题与 RSS 同行(原型的排法), 且标题用省略号而不是把整格裁掉
        assert(Math.abs(row.titleTop - row.rssTop) <= 8,
            '标题与 RSS 在同一行(原型排法), 实际 title.top=' + row.titleTop + ' rss.top=' + row.rssTop);
        assert(row.rssLeft > row.titleLeft, 'RSS 在标题右侧');
        assertEq(row.titleEllipsis, 'ellipsis', '标题用省略号(且只加在标题链接上)');

        // ================= 导航 =================
        const nav = await page.eval(NAV_PROBE);
        assert(nav.length >= 16, '导航 ' + nav.length + ' 项 >= 16');
        assertEq(nav[0].pad, '11px', '导航项内边距回到原型的 7px 11px');
        assertEq(nav[0].radius, '9px', '导航项是 9px 圆角药丸');
        assertEq(nav[0].fs, '12.5px', '导航项字号 12.5px');
        // .15 用户实拍: 站点给 `ul.menu li a` 画了 1px 白边 + #dedede 底, 只清 border 不清底
        // 就是一排白页签。原型里导航项默认无底(只有 hover 的 5.5% 白)。
        const navWhite = nav.filter(function (x) {
            const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(x.bg);
            if (!m) return false;
            if (m[4] !== undefined && parseFloat(m[4]) < 0.5) return false; // 半透明不算白
            return (parseInt(m[1], 10) + parseInt(m[2], 10) + parseInt(m[3], 10)) / 3 > 190
                && x.bg !== 'rgb(245, 179, 66)'; // 选中项是金底, 不算漏白
        });
        assertEq(navWhite.length, 0, '导航项无一站点的浅灰底(.15: #dedede 已清, 不是一排白页签)');
        assertEq(nav[0].border, '0px', '导航项清掉站点的 1px 白边');
        assertEq(nav[0].iconW, 15, '导航图标 15px');
        assertEq(nav[10].fs, '11.5px', '第 11 项起弱化一档(11.5px)');
        assertEq(nav[10].iconW, 12, '第 11 项起图标缩到 12px');
        assert(parseFloat(nav[10].iconOpacity) < parseFloat(nav[0].iconOpacity),
            '第 11 项起图标更淡(' + nav[10].iconOpacity + ' < ' + nav[0].iconOpacity + ')');

        // 真实鼠标悬停: 导航项要有底色反馈(全局 a:hover 被更高特异性压死过)
        const first = await page.eval([
            'const r = document.querySelector("ul#mainmenu li a").getBoundingClientRect();',
            'return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };'
        ].join('\n'));
        await sim.cdp.send('Input.dispatchMouseEvent',
            { type: 'mouseMoved', x: first.x, y: first.y, button: 'none' }, page.sessionId);
        await sleep(250);
        const hoverBg = await page.eval(
            'return getComputedStyle(document.querySelector("ul#mainmenu li a")).backgroundColor;');
        assert(hoverBg !== 'rgba(0, 0, 0, 0)',
            '导航项悬停有底色反馈(原型如此), 实际 ' + hoverBg);

        // ================= 站点老式 <font> 着色(.17) =================
        // 站点给统计值一律 #1900d1(深蓝)、给数据行标记用暗红 —— 在深色片基上亮度差只有 3~9, 等于看不见。
        // ⚠️ 这份断言专防"把 7 个选择器并成一条、声明块里连写 7 个 color" —— 那样只有最后一个生效,
        //    6 个统计值会变成同一个色, 而语法上完全合法、静态检查也查不出来。
        const STAT = {
            color_ratio: 'rgb(245, 179, 66)', color_bonus: 'rgb(201, 168, 106)',
            color_uploaded: 'rgb(127, 184, 78)', color_downloaded: 'rgb(224, 91, 74)',
            color_invite: 'rgb(155, 127, 212)', color_slots: 'rgb(124, 143, 214)',
            color_active: 'rgb(79, 184, 154)'
        };
        const statColors = await page.eval([
            'const out = {};',
            'Object.keys(' + JSON.stringify(Object.keys(STAT)) + ').forEach(function (i) {',
            '  const k = ' + JSON.stringify(Object.keys(STAT)) + '[i];',
            '  const e = document.querySelector("font." + k);',
            '  out[k] = e ? getComputedStyle(e).color : null;',
            '});',
            'return out;'
        ].join('\n'));
        Object.keys(STAT).forEach(function (k) {
            assertEq(statColors[k], STAT[k],
                '统计值 font.' + k + ' 用的是可读的色位(站点原色 #1900d1 在深色底上看不见)');
        });
        const distinct = new Set(Object.values(statColors).filter(Boolean));
        assertEq(distinct.size, Object.keys(STAT).length,
            '7 个统计值颜色两两不同(防止被写成一条规则里连写 7 个 color)');

        // ================= UA 渲染的界面(.18: 不是 DOM 元素, 漏白扫描看不见) =================
        const ua = await page.eval([
            'const d = document.createElement("div");',
            'd.style.cssText = "position:absolute;left:-9999px;top:0;width:100px;height:50px;overflow-y:scroll";',
            'document.body.appendChild(d);',
            'const w = d.offsetWidth - d.clientWidth;',
            'd.remove();',
            'return { scheme: getComputedStyle(document.documentElement).colorScheme, sb: w };'
        ].join('\n'));
        assertEq(ua.scheme, 'dark',
            'color-scheme 已设 dark(.18: 滚动条 / 下拉弹层是浏览器画的, 只能靠这一条变深)');

        // ================= 入口 + 面板 =================
        // 入口在 closed shadow 里读不到内部样式, 只能量宿主盒子(它就是 chip 的外框)
        const dock = await H.dockRect(page);
        assertEq(Math.round(dock.w), 150, '入口胶囊宽 150px(原型 chip 尺寸)');
        assertEq(Math.round(dock.h), 27, '入口胶囊高 27px(原型 chip 尺寸)');
        // 预留槽位: 导航项不得与入口矩形相交(否则入口会压住站内内容)
        const clash = await page.eval([
            'const h = document.getElementById("hdui-root").getBoundingClientRect();',
            'const as = Array.prototype.slice.call(document.querySelectorAll("ul#mainmenu li a"));',
            'return as.filter(function (a) {',
            '  const r = a.getBoundingClientRect();',
            '  return r.left < h.right && r.right > h.left && r.top < h.bottom && r.bottom > h.top;',
            '}).map(function (a) { return a.textContent.trim(); });'
        ].join('\n'));
        assertEq(clash.length, 0, '导航项不与入口矩形相交(右侧留了槽位), 冲突: ' + JSON.stringify(clash));

        // 面板: 340px 双列卡片(closed shadow 下只能量水平跨度)
        await H.clickDock(page);
        const top = await H.panelTop(page);
        assert(top !== null, '点入口后面板展开');
        const box = await H.panelBox(page, top + 40);
        assert(!!box, '取到面板水平跨度');
        assert(box.right - box.left >= 300,
            '面板是 340px 宽的卡片(原型), 实测跨度 ' + (box.right - box.left));
        await page.close();
    }, { scriptPath: H.HDUI_PATH });
});
