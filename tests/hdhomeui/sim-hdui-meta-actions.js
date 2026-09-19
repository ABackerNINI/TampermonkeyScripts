#!/usr/bin/env node
'use strict';
/**
 * 仿真: 标题格动作区(豆瓣/IMDb/下载/收藏)与图标背景层
 * ------------------------------------------------------------------
 * 为什么单独一个用例(不并入 film-fidelity):
 *   这四样东西**原型 film.html 里根本没有**(原型是简化页, 标题格只有"标题 + RSS")。
 *   它们是真站独有的第二格, 之前脚本的处理方式(摊平成 flex + 去掉 <br>)把 4 个链接
 *   塞进同一条 inline 流 —— 就是用户看到的「豆瓣/IMDB/下载/收藏按钮挤到一起」。
 *   图标那两条同理: 真站用 `background:url(png.png)` 画图标、用 `!important` 钉雪碧图,
 *   只换 `content` 是换不干净的(底下还透着原图)。这类"原型测不到"的差异必须单独钉。
 *
 * 覆盖:
 *   ① 类别图标: content 是 SVG **且 background-image 已清成 none**(站点那条是 !important)
 *   ② 豆瓣/IMDb/下载/收藏: content 与 background-image 双双换成 SVG
 *   ③ 布局: 评分列(豆瓣/IMDb)与操作列(下载/收藏)各自竖排、两列左右分开、四个 chip 互不重叠
 *   ④ 无种子表页: 站点 `table{background-color:#bccad6}` 通配底色已被压深(大面积白底的来源)
 */

const { withSim } = require('../lib/sim/harness');
const { runCase, assert, assertEq } = require('../lib/sim/tcase');
const H = require('../lib/hdui-help');

/** 图标层探测: content / background-image / background-color */
const ICON_PROBE = [
    'function cs(e,p){return getComputedStyle(e).getPropertyValue(p);}',
    'const isSvg=function(v){return String(v).indexOf("data:image/svg+xml")>=0;};',
    'const q=function(s){return document.querySelector(s);};',
    'const cat=q("#torrenttable img[class*=\'c_\']");',
    'const act={',
    '  douban:q("#torrenttable img[src*=\'icon-douban\']"),',
    '  imdb:q("#torrenttable img[src*=\'icon-imdb\']"),',
    '  download:q("#torrenttable img.download"),',
    '  bookmark:q("#torrenttable img.delbookmark")',
    '};',
    'const out={cat:null,act:{}};',
    'if(cat){out.cat={svgContent:isSvg(cs(cat,"content")),bgImg:cs(cat,"background-image"),',
    '  bgCol:cs(cat,"background-color")};}',
    'for(const k in act){const e=act[k];',
    '  out.act[k]=e?{svgContent:isSvg(cs(e,"content")),svgBg:isSvg(cs(e,"background-image"))}:null;}',
    'return out;'
].join('\n');

/** 动作区布局: 取第一行的 4 个 chip + 标题 a 的 top(用来断言 meta 与标题同行, .13 用户反馈) */
const LAYOUT_PROBE = [
    'const as=Array.prototype.slice.call(document.querySelectorAll(',
    '  "#torrenttable table.torrentname td.embedded:not(.rss):not(:first-child) a")).slice(0,4);',
    'const titleA=document.querySelector(',
    '  "#torrenttable table.torrentname td.embedded:first-child > a");',
    'const metaRects=as.map(function(a){const r=a.getBoundingClientRect();',
    '  return {t:Math.round(r.top),b:Math.round(r.bottom),l:Math.round(r.left),',
    '    r:Math.round(r.right),w:Math.round(r.width),h:Math.round(r.height)};});',
    'const titleTop=titleA?Math.round(titleA.getBoundingClientRect().top):null;',
    'return {metaRects:metaRects,titleTop:titleTop};'
].join('\n');

/** 两两不重叠(共享一条边不算重叠) */
function overlap(a, b) {
    return a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
}

runCase('HDHomeUI · 标题格动作区与图标背景层', async function () {
    await withSim(async function (sim) {
        sim.seed({ 'hdui.theme': 'film' });

        // ================= ① ② 图标层 =================
        const page = await H.open(sim, 'hdhome-ui');
        await H.waitState(page, 'applied');
        const ic = await page.eval(ICON_PROBE);

        assert(ic.cat && ic.cat.svgContent,
            '类别图标 content 已换成内联 SVG, 实际 ' + JSON.stringify(ic.cat));
        // ⚠️ 这条是「图标未成功替换」的关键: 站点 `img[class*="c_"]{background-image:url(catsprites.png)
        //    !important}` 带 !important, 写 `background:rgba()` 简写是清不掉的 —— 必须显式 none。
        assertEq(ic.cat && ic.cat.bgImg, 'none',
            '类别图标的站点雪碧图背景已清成 none(否则 45×46 的雪碧图会透在 SVG 底下)');
        assert(ic.cat && /^rgba\(/.test(ic.cat.bgCol) && ic.cat.bgCol !== 'rgba(0, 0, 0, 0)',
            '类别色块仍在(半透明类别底色), 实际 ' + (ic.cat && ic.cat.bgCol));

        ['douban', 'imdb', 'download', 'bookmark'].forEach(function (k) {
            const v = ic.act[k];
            assert(v && v.svgContent,
                '动作图标 ' + k + ' 的 content 换成 SVG(真站是 png.png 雪碧图), 实际 ' + JSON.stringify(v));
            // content 与 background-image 双写: 站点拿 background 画图标, 只换 content 换不干净
            assert(v && v.svgBg,
                '动作图标 ' + k + ' 的 background-image 也换成 SVG(站点用 background 画, 必须一起换)');
        });

        // ================= ③ 布局 =================
        const lay = await page.eval(LAYOUT_PROBE);
        const rects = lay.metaRects;
        const titleTop = lay.titleTop;
        assertEq(rects.length, 4, '动作区拿到 4 个 chip(豆瓣 / IMDb / 下载 / 收藏)');
        // .13 用户反馈「豆瓣/IMDb/下载/收藏应在标题后面」(不要扔到第二行)
        assert(titleTop !== null && rects[0] && Math.abs(titleTop - rects[0].t) <= 8,
            '四个动作 chip 跟在标题后面同行(.13), 实际 titleTop=' + titleTop + ' metaTop=' + (rects[0] && rects[0].t));

        const [douban, imdb, download, bookmark] = rects;
        // 评分列竖排: 豆瓣在上、IMDb 在下, 左边缘对齐
        assert(Math.abs(douban.l - imdb.l) <= 2,
            '豆瓣与 IMDb 左对齐(同属评分列), 实际 ' + douban.l + ' / ' + imdb.l);
        assert(imdb.t >= douban.b - 2,
            'IMDb 排在豆瓣下方(竖排, 不再挤成一行), 实际 豆瓣底=' + douban.b + ' IMDb顶=' + imdb.t);
        // 操作列竖排: 下载在上、收藏在下, 左边缘对齐
        assert(Math.abs(download.l - bookmark.l) <= 2,
            '下载与收藏左对齐(同属操作列), 实际 ' + download.l + ' / ' + bookmark.l);
        assert(bookmark.t >= download.b - 2,
            '收藏排在下载下方(竖排), 实际 下载底=' + download.b + ' 收藏顶=' + bookmark.t);
        // 两列左右分开: 操作列整体在评分列右侧
        assert(download.l >= douban.r,
            '操作列在评分列右侧(两列分开, 不再糊成一坨), 实际 评分列右=' + douban.r
            + ' 操作列左=' + download.l);
        // 四个 chip 两两不重叠
        for (let i = 0; i < rects.length; i++) {
            for (let j = i + 1; j < rects.length; j++) {
                assert(!overlap(rects[i], rects[j]),
                    '动作 chip ' + (i + 1) + ' 与 ' + (j + 1) + ' 互不重叠, 实际 '
                    + JSON.stringify(rects[i]) + ' vs ' + JSON.stringify(rects[j]));
            }
        }
        await page.close();

        // ================= ④ 无种子表页的全局底色 =================
        const p2 = await H.open(sim, 'hdhome-ui-notable');
        await H.waitState(p2, 'applied');
        const bg = await p2.eval([
            'function cs(e,p){return getComputedStyle(e).getPropertyValue(p);}',
            'const t=document.querySelector("table.mainouter")||document.querySelector("table");',
            'return {body:cs(document.body,"background-color"),',
            '  table:t?cs(t,"background-color"):null};'
        ].join('\n'));
        // 站点 `table{background-color:#bccad6}` 是 (0,0,1) 通配, 原先只覆盖了 .mainouter/.main,
        // 种子表之外的任何表格都在漏这块浅蓝灰 —— 视觉上就是"一整片白"。
        assertEq(bg.body, 'rgb(16, 14, 13)', '无种子表页: body 底色为胶片墙片基 #100e0d');
        assertEq(bg.table, 'rgb(25, 21, 18)',
            '无种子表页: 通配 table 的底色已从 #bccad6 压成 panel #191512(大面积白底的来源)');
        await p2.close();
    }, { scriptPath: H.HDUI_PATH });
});
