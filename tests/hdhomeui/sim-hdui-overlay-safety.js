#!/usr/bin/env node
'use strict';
/**
 * 仿真: 浮层 / 弹窗 / 公告专项(用户点名的三类)
 * ------------------------------------------------------------------
 * 主题是纯 CSS 层, 它"屏蔽"一个浮层不会去删 DOM, 而是让它在视觉上失效:
 *   · contain 把 #torrenttable 变成 fixed 后代的**定位基准** => 弹窗被挪到别的坐标(可能出视口)
 *   · 片头 position:sticky 的 z-index 比站内浮层高 => 弹窗被压住
 *   · 自持的错误横幅固定在顶部 => 盖住站内的消息条
 *   · 站点提示框(div.niceTitle)平时 visibility:hidden, 渲染扫描抓不到 —— 要主动切成可见再验
 *
 * 覆盖:
 *   ① 挂在 body 的 fixed 弹窗: 上妆前后**位置一致**
 *   ② 挂在 #torrenttable 里的 fixed 弹窗: 上妆前后**位置一致**(专测 contain 的定位基准陷阱)
 *   ③ 弹窗里的关闭按钮**点得到**(hit-test 命中按钮本身, 不是被主题盖住)
 *   ④ 片头吸顶不压站内浮层(滚动后浮层仍压在最上面)
 *   ⑤ 站点提示框从 hidden 切成 visible 后: 面积非零 + 对比度够(.23 的教训: 隐藏态扫描看不见)
 *   ⑥ 错误横幅存在时, 站内消息条**没被删/没被隐藏**; 关掉横幅后消息条可点
 */

const { withSim } = require('../lib/sim/harness');
const { runCase, assert } = require('../lib/sim/tcase');
const H = require('../lib/hdui-help');
const scan = require('../lib/hdui-scan');

const OVERLAY_INJECT = [
    '(function () {',
    '  function mk(id, css, html) {',
    '    const e = document.createElement("div");',
    '    e.setAttribute("data-canary", id);',
    '    e.style.cssText = css;',
    '    if (html) e.innerHTML = html;',
    '    return e;',
    '  }',
    '  const POP = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);'
    + 'background:#fff;color:#000;padding:10px;box-sizing:border-box";',
    // ① body 上的居中弹窗(站内消息弹窗的典型形态)
    '  document.body.appendChild(mk("ov-body", POP + ";width:320px;height:160px;z-index:9999",'
    + ' "<b>你有一条新消息</b><button id=\\"canary-close\\" style=\\"margin-top:8px\\">关闭</button>"));',
    // ② 同一个弹窗挂进 #torrenttable —— contain 会把它俩摆到不同地方, 这就是要量的差
    '  const t = document.getElementById("torrenttable");',
    '  if (t) t.appendChild(mk("ov-table", POP + ";width:300px;height:140px;z-index:9998", "<b>表内弹窗</b>"));',
    // ③ 顶部消息条(站点公告条那种), z-index 只给 100 —— 片头是 6, 它不该被压住
    '  document.body.appendChild(mk("ov-bar", "position:fixed;left:0;top:0;width:100%;height:38px;'
    + 'background:#333;color:#fff;z-index:100;display:flex;align-items:center;padding:0 12px",'
    + ' "<b>站内消息条: 您有 1 条未读消息</b>"));',
    // ④ 站点 hover 提示框(平时 visibility:hidden, 量之前手动切成可见)
    '  const nt = mk("ov-nicetitle", "position:fixed;left:20px;top:220px;width:220px;height:60px;'
    + 'background:#7c98ae;color:#000;padding:6px;z-index:600;visibility:hidden", "<b>提示: 新功能</b>");',
    '  nt.className = "niceTitle";',
    '  document.body.appendChild(nt);',
    '  return true;',
    '})()'
].join('\n');

/** 把提示框切成可见(站点是 hover 时才切) */
const SHOW_TIP = [
    'const e = document.querySelector("[data-canary=\\"ov-nicetitle\\"]");',
    'if (e) e.style.visibility = "visible";',
    'return !!e;'
].join('\n');

async function measure(page) {
    const box = await page.eval([
        'const out = {};',
        '["ov-body", "ov-table", "ov-bar", "ov-nicetitle"].forEach(function (id) {',
        '  const e = document.querySelector("[data-canary=\\"" + id + "\\"]");',
        '  if (!e) { out[id] = null; return; }',
        '  const r = e.getBoundingClientRect();',
        '  out[id] = { x: Math.round(r.left), y: Math.round(r.top),',
        '    w: Math.round(r.width), h: Math.round(r.height) };',
        '});',
        'out.__scrollY = Math.round(window.scrollY);',
        'return out;'
    ].join('\n'));
    return box;
}

runCase('HDHomeUI · 浮层 / 弹窗 / 公告专项(位置不被改动、不被压住、不被隐形)', async function () {
    await withSim(async function (sim) {
        // ---- 对照组: 不上妆 ----
        sim.seed({ 'hdui.theme': 'default' });
        const p0 = await H.open(sim, 'hdhome-ui');
        await p0.waitFor('return document.documentElement.dataset.hduiState === "off"', 15000, 'state=off');
        await p0.eval(OVERLAY_INJECT);
        await p0.eval(SHOW_TIP);
        const base = await measure(p0);
        await p0.close();

        // ---- 实验组: 上妆 ----
        sim.seed({ 'hdui.theme': 'film' });
        const page = await H.open(sim, 'hdhome-ui');
        await H.waitState(page, 'applied');
        await page.eval(OVERLAY_INJECT);
        await page.eval(SHOW_TIP);
        const got = await measure(page);

        // ① body 上的 fixed 弹窗: 位置必须一致
        assert(base['ov-body'] && got['ov-body'], '两侧都量到了 body 弹窗');
        assert(Math.abs(base['ov-body'].x - got['ov-body'].x) <= 1
            && Math.abs(base['ov-body'].y - got['ov-body'].y) <= 1,
            'body 上的 fixed 弹窗位置不变(对照 ' + base['ov-body'].x + ',' + base['ov-body'].y
            + ' -> 上妆 ' + got['ov-body'].x + ',' + got['ov-body'].y + ')');

        // ② 表内 fixed 弹窗: 位置必须一致 —— 这条专抓 contain 把定位基准改掉
        assert(base['ov-table'] && got['ov-table'], '两侧都量到了表内弹窗');
        assert(Math.abs(base['ov-table'].x - got['ov-table'].x) <= 1
            && Math.abs(base['ov-table'].y - got['ov-table'].y) <= 1,
            '#torrenttable 内的 fixed 弹窗位置不变(contain 不得把它的定位基准改掉); 对照 '
            + base['ov-table'].x + ',' + base['ov-table'].y
            + ' -> 上妆 ' + got['ov-table'].x + ',' + got['ov-table'].y);

        // ③ 弹窗里的关闭按钮点得到
        const btn = await page.eval([
            'const b = document.getElementById("canary-close");',
            'if (!b) return null;',
            'const r = b.getBoundingClientRect();',
            'const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);',
            'const el = document.elementFromPoint(x, y);',
            'return { x: x, y: y, w: Math.round(r.width), h: Math.round(r.height),',
            '  ok: el === b, hit: el ? el.tagName + "#" + el.id : null };'
        ].join('\n'));
        assert(btn && btn.w > 0 && btn.h > 0, '关闭按钮有面积: ' + JSON.stringify(btn));
        assert(btn && btn.ok, '弹窗的关闭按钮点得到(hit-test 命中按钮本身); 实测命中 ' + (btn && btn.hit));

        // ④ 滚到片头吸顶区, 顶部消息条(z-index 100)仍压在最上面
        await page.eval('window.scrollTo(0, 600); return true;');
        await new Promise(function (r) { setTimeout(r, 200); });
        const bar = await scan.canaries(page, ['ov-bar']);
        assert(bar['ov-bar'] && bar['ov-bar'].hitOk,
            '滚动 600px 后站内消息条没被片头压住(hit-test 命中自身); 实测命中 '
            + (bar['ov-bar'] && (bar['ov-bar'].hit || bar['ov-bar'].hitWhy)));

        // ⑤ 提示框切成可见后: 面积 + 对比度
        const tip = (await scan.canaries(page, ['ov-nicetitle']))['ov-nicetitle'];
        assert(tip && tip.exists && tip.w >= 8 && tip.h >= 8,
            '站点提示框(niceTitle)可见态有面积: ' + JSON.stringify(tip && { w: tip.w, h: tip.h }));
        assert(tip && tip.contrast >= 40,
            '提示框文字与底色亮度差 ≥ 40(实测 ' + (tip && tip.contrast) + ')');
        await page.close();

        // ---- ⑥ 错误横幅 vs 站内消息条 ----
        sim.seed({ 'hdui.theme': 'film' });
        const p2 = await H.open(sim, 'hdhome-ui-broken');
        await p2.waitFor('return document.documentElement.dataset.hduiState === "fallback"', 15000, 'state=fallback');
        await p2.eval([
            'const bar = document.createElement("div");',
            'bar.setAttribute("data-canary", "site-msgbar");',
            'bar.style.cssText = "background:#ffffcc;color:#000;padding:6px 12px";',
            'bar.innerHTML = "<b>站内消息条: 您有 1 条未读消息</b>";',
            'document.body.insertBefore(bar, document.body.firstChild);',
            'return true;'
        ].join('\n'));
        const mb = (await scan.canaries(p2, ['site-msgbar']))['site-msgbar'];
        assert(mb && mb.exists, '错误横幅存在时, 站内消息条**还在 DOM 里**(没被脚本删掉)');
        assert(mb && mb.display !== 'none' && mb.visibility === 'visible' && mb.w >= 8 && mb.h >= 8,
            '站内消息条没被隐藏(实测 display=' + (mb && mb.display) + ' visibility='
            + (mb && mb.visibility) + ' ' + (mb && mb.w) + 'x' + (mb && mb.h) + ')');

        // 关掉横幅后, 消息条必须点得到(横幅是临时的, 不许永久占地)
        const closed = await p2.eval([
            'const box = document.getElementById("hdui-alert");',
            'if (!box) return "no-banner";',
            'const bs = Array.prototype.slice.call(box.querySelectorAll("button"));',
            'const b = bs.filter(function (x) { return (x.textContent || "").indexOf("知道了") >= 0; })[0] || bs[0];',
            'if (!b) return "no-button";',
            'b.click();',
            'return "clicked";'
        ].join('\n'));
        assert(closed === 'clicked', '横幅上有「知道了」按钮并可关闭; 实测 ' + closed);
        await new Promise(function (r) { setTimeout(r, 300); });
        const mb2 = (await scan.canaries(p2, ['site-msgbar']))['site-msgbar'];
        assert(mb2 && mb2.hitOk,
            '关掉横幅后站内消息条点得到(hit-test 命中自身); 实测命中 '
            + (mb2 && (mb2.hit || mb2.hitWhy)));
        await p2.close();
    }, { scriptPath: H.HDUI_PATH });
});
