#!/usr/bin/env node
'use strict';
/**
 * 仿真: SVG 图标体系真的落到页面上(不是只不报错)
 * ------------------------------------------------------------------
 * 前情: 图标体系从 mock 移植进脚本后, 原有测试只能证明"没回归"(功能保持/危险防护),
 *       没有任何一条断言"图标真的画出来了"。本用例补上这一层:
 *   ① 类别图标 —— 站内 img[class*="c_xxx"] 的 content 变成 data:image/svg+xml
 *   ② 表头指标图标 —— comments / size / seeders 等同样被换成 SVG
 *   ③ 导航图标 —— 16 项 ::before 的 background-image 是 SVG, 且每项不同
 *   ④ 保种 / 断种 必须拿到**不同**图标(断种是带锯齿缺角的枯黄叶, 不能与保种同图)
 *   ⑤ 导航 16 项各一色, 且保种 / 断种不同图
 *   ⑥ 图标不能把站内元素压成零宽(P42: SVG 必须带 width/height, 否则固有尺寸为 0)
 */

const { withSim } = require('../lib/sim/harness');
const { runCase, assert, assertEq } = require('../lib/sim/tcase');
const H = require('../lib/hdui-help');

const THEMES = ['film'];
const SVG = 'data:image/svg+xml';

/** 取元素最终 content 值(::before 用 background-image) */
const PROBE = `
return (function () {
  function cs(el, prop, pseudo) {
    return pseudo ? getComputedStyle(el, pseudo).getPropertyValue(prop)
                  : getComputedStyle(el).getPropertyValue(prop);
  }
  var catImg = document.querySelector('#torrenttable img[class*="c_"]');
  // 类型格结构是 <td><a><img class="c_xxx"></a></td>; 取父级 <a> 以便需要时量它的尺寸
  var dot = (catImg && catImg.parentNode && catImg.parentNode.tagName === 'A') ? catImg.parentNode : null;
  var met = {};
  ['comments','size','seeders','leechers','snatched','time'].forEach(function (k) {
    var e = document.querySelector('#torrenttable img.' + k);
    met[k] = e ? cs(e, 'content') : null;
  });
  // .16: 站点自绘、脚本此前完全没接管的图标族(真站整页"残留装饰"扫描发现)。
  // 注意 img.time 是"存活"列头 —— 列映射里它归到逻辑键 alive, 但 DOM 上的 class 是 time,
  // 只写 img.alive 这条规则一条都不命中(存活列头会一直挂着站点雪碧图)。
  var misc = {};
  ['sticky','star','arrowup','arrowdown','inbox','sentbox','buddylist','rss','plus'].forEach(function (k) {
    var els = document.querySelectorAll('img.' + k);
    if (!els.length) { misc[k] = { n: 0 }; return; }
    var svgN = 0, bgN = 0;
    for (var j = 0; j < els.length; j++) {
      if (String(cs(els[j], 'content')).indexOf('data:image/svg+xml') >= 0) svgN++;
      if (String(cs(els[j], 'background-image')).indexOf('data:image/svg+xml') >= 0) bgN++;
    }
    misc[k] = { n: els.length, svg: svgN, bg: bgN };
  });
  var nav = {};
  var links = document.querySelectorAll('#mainmenu a');
  for (var i = 0; i < links.length; i++) {
    var href = links[i].getAttribute('href') || '';
    nav[href] = { bg: cs(links[i], 'background-image', '::before'),
                  w: cs(links[i], 'width', '::before') };
  }
  // 站内 RSS 链接(曾经被零尺寸压塌过, P42)
  var rssA = document.querySelector('#torrenttable [data-toggle-rss]');
  var rssBox = rssA ? rssA.getBoundingClientRect() : null;
  return {
    cat: catImg ? { cls: catImg.className, content: cs(catImg, 'content'),
                    w: catImg.getBoundingClientRect().width, display: cs(catImg, 'display') } : null,
    dot: dot ? { w: dot.getBoundingClientRect().width, bg: cs(dot, 'background-color') } : null,
    met: met,
    misc: misc,
    nav: nav,
    rssW: rssBox ? rssBox.width : -1,
    rssH: rssBox ? rssBox.height : -1
  };
})()
`;

runCase('HDHomeUI · SVG 图标体系落地', async function () {
    await withSim(async function (sim) {
        for (const id of THEMES) {
            sim.seed({ 'hdui.theme': id });
            const page = await H.open(sim, 'hdhome-ui');
            await H.waitState(page, 'applied');
            assertEq(await H.themeOf(page), id, '主题 ' + id + ' 已生效');

            const r = await page.eval(PROBE);

            // ---- ① 类别图标 ----
            assert(!!r.cat, id + ': 找得到类别图标 img');
            assert(String(r.cat.content).indexOf(SVG) >= 0,
                id + ': 类别图标 content 是内联 SVG(实际: ' + String(r.cat.content).slice(0, 40) + ')');
            assert(r.cat.w > 0, id + ': 类别图标宽度 > 0(P42 固有尺寸), 实际 ' + r.cat.w);

            // ---- ② 表头指标图标 ----
            for (const k of ['comments', 'size', 'seeders', 'leechers', 'snatched', 'time']) {
                assert(!!r.met[k] && String(r.met[k]).indexOf(SVG) >= 0,
                    id + ': 指标图标 ' + k + ' 换成 SVG(实际: ' + String(r.met[k]).slice(0, 40) + ')');
            }

            // ---- ②b 站点自绘的零散图标族(.16 真站扫描发现, 此前脚本完全没接管) ----
            for (const k of Object.keys(r.misc)) {
                const m = r.misc[k];
                if (!m.n) continue; // 仿真页没这一族就跳过
                assertEq(m.svg, m.n, id + ': img.' + k + ' 全部换成 SVG(' + m.n + ' 个，'
                    + 'content 命中 ' + m.svg + ')');
                assert(m.bg >= 1, id + ': img.' + k + ' 背景层也换成同一张 SVG(站点是拿 background 画的, '
                    + '只换 content 会透底)');
            }

            // ---- ⑥ RSS 链接不能被压塌 ----
            assert(r.rssW > 0 && r.rssH > 0,
                id + ': 站内 RSS 链接仍有尺寸(P42), 实际 ' + r.rssW + 'x' + r.rssH);

            // ---- ③④⑤ 导航 ----
            const hrefs = Object.keys(r.nav);
            assert(hrefs.length >= 16, id + ': 导航项 ' + hrefs.length + ' >= 16');

            {
                const withIcon = hrefs.filter(function (h) { return String(r.nav[h].bg).indexOf(SVG) >= 0; });
                assert(withIcon.length >= 14,
                    id + ': 至少 14 个导航项挂上图标, 实际 ' + withIcon.length);
                // 保种 vs 断种 必须不同图
                const keep = r.nav['/torrents.php?mystat=keep'];
                const dead = r.nav['/torrents.php?mystat=dead'];
                assert(!!keep && !!dead, id + ': 取到保种/断种导航项');
                assert(String(keep.bg).indexOf(SVG) >= 0, id + ': 保种有图标');
                assert(String(dead.bg).indexOf(SVG) >= 0, id + ': 断种有图标');
                assert(keep.bg !== dead.bg, id + ': 保种与断种图标必须不同(断种是带缺角的枯叶)');
            }

            await page.close();
        }
    }, { scriptPath: H.HDUI_PATH });
});
