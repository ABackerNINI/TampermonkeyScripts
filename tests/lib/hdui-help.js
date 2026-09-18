'use strict';
/**
 * HDHomeUI 仿真测试公共工具(共享基建, 不被 tests/run-all.js 当作测试执行)
 * ------------------------------------------------------------------
 * 覆盖: 打开仿真页 / 功能基线快照 / 版式签名 / 真实鼠标键盘事件 / 危险端点请求筛查。
 */

const path = require('path');

const HDUI_PATH = path.join(__dirname, '..', '..', 'src', 'HDHomeUI.user.js');
// 注意用 http: 仿真服务器是纯 http, 只有 --host-resolver-rules 把域名指到本机,
// 用 https 会去跟 http 端口做 TLS 握手而整页加载失败(与既有 PTAC 用例一致)
const BASE = 'http://hdhome.org/torrents.php';

/** 站内「误触即出事」的端点: 签到 / 登出 / 魔力 / 邀请 / 捐赠 / 个人页 / RSS 增删 / 广告跳转 */
const DANGER_RE = /(attendance|logout|mybonus|invite|donate|userdetails|myrss|adredir)\.php/;

function open(sim, scenario) {
    return sim.open(BASE + '?sim=' + scenario, { waitMs: 600 });
}

function waitState(page, state, timeoutMs) {
    return page.waitFor('return document.documentElement.dataset.hduiState === ' + JSON.stringify(state),
        timeoutMs || 15000, 'hduiState=' + state);
}

function themeOf(page) {
    return page.eval('return document.documentElement.dataset.hduiTheme || null;');
}

/** 功能基线: 所有可能被"换肤"误伤的东西都拍一遍 */
function snapshot(page) {
    return page.eval([
        'const q = function (s) { return Array.prototype.map.call(document.querySelectorAll(s), function (e) { return e.getAttribute("href"); }); };',
        'const t = document.getElementById("torrenttable");',
        'const tb = t ? t.tBodies[0] : null;',
        'const si = document.getElementById("searchinput");',
        'return {',
        '  nav: q("ul#mainmenu a"),',
        '  infoLinks: q("#info_block a"),',
        '  rows: tb ? tb.rows.length : 0,',
        '  details: q(\'#torrenttable a[href*="details.php"]\'),',
        '  rssIds: Array.prototype.map.call(document.querySelectorAll("[data-toggle-rss]"), function (e) { return e.getAttribute("data-toggle-rss"); }),',
        '  rssHref: Array.prototype.map.call(document.querySelectorAll("[data-toggle-rss]"), function (e) { return e.getAttribute("href"); }),',
        '  comments: q(\'#torrenttable a[href*="comment.php"]\'),',
        '  snatch: q(\'#torrenttable a[href*="viewsnatches"]\'),',
        '  sortLinks: q(\'#torrenttable a[href*="sort="]\'),',
        '  pager: q(\'p[align="center"] a\'),',
        '  formAction: document.forms.searchbox ? document.forms.searchbox.getAttribute("action") : null,',
        '  formMethod: document.forms.searchbox ? document.forms.searchbox.getAttribute("method") : null,',
        '  submitValue: (document.querySelector(\'input[type="submit"]\') || {}).value || null,',
        '  searchAttrs: ["onkeyup", "onkeypress", "ondblclick"].map(function (a) { return si ? si.getAttribute(a) : null; }),',
        '  checkboxCount: document.querySelectorAll(\'table.searchbox input[type="checkbox"]\').length,',
        '  selectNames: Array.prototype.map.call(document.querySelectorAll("table.searchbox select"), function (e) { return e.getAttribute("name"); }),',
        '  tagOnclick: Array.prototype.map.call(document.querySelectorAll("span.tags"), function (e) { return e.getAttribute("onclick"); }),',
        '  searchboxToggleHref: (document.querySelector(\'a[href*="klappe_news"]\') || {}).getAttribute ? document.querySelector(\'a[href*="klappe_news"]\').getAttribute("href") : null,',
        '  ksearchDisplay: getComputedStyle(document.getElementById("ksearchboxmain")).display,',
        '  footer: q("#footer a"),',
        '  calcHeads: [!!document.getElementById("calcTHeadA"), !!document.getElementById("calcTHeadAve")]',
        '};'
    ].join('\n'));
}

/** 版式签名: 用于证明 5 套主题是骨架不同, 而非只换颜色 */
function signature(page) {
    return page.eval([
        'const t = document.getElementById("torrenttable");',
        'if (!t) return null;',
        'const tb = t.tBodies[0];',
        'const row = tb.rows[1];',
        'const cs = function (e) { return getComputedStyle(e); };',
        'return {',
        '  table: cs(t).display,',
        '  tbody: cs(tb).display,',
        '  row: cs(row).display,',
        '  cols: cs(row).gridTemplateColumns,',
        '  seedFont: cs(row.cells[5]).fontSize,',
        '  rowBorder: cs(row).borderTopWidth,',
        '  bodyFont: cs(document.body).fontFamily,',
        '  bodyBg: cs(document.body).backgroundColor,',
        '  cat: row.style.getPropertyValue("--hdui-cat") || "",',
        '  ratio: row.style.getPropertyValue("--hdui-ratio") || ""',
        '};'
    ].join('\n'));
}

function dangerousHits(sim) {
    return sim.requests().filter(function (r) { return DANGER_RE.test(r.path || ''); });
}

async function mouseClick(page, x, y) {
    await page.sim.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x, y: y, button: 'left', clickCount: 1 }, page.sessionId);
    await page.sim.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x, y: y, button: 'left', clickCount: 1 }, page.sessionId);
}

async function viewport(page) {
    return page.eval('return { w: window.innerWidth, h: window.innerHeight };');
}

/** 点右下角浮动开关(FAB)。真实鼠标事件, 可穿透 closed shadow */
async function clickFab(page) {
    const v = await viewport(page);
    await mouseClick(page, v.w - 18 - 22, v.h - 18 - 22);
    await new Promise(function (r) { setTimeout(r, 250); });
}

/** 找出面板最顶端(hit-test 会被重定向到 shadow 宿主, 这正是判据) */
async function panelTop(page) {
    const v = await viewport(page);
    return page.eval([
        'const x = ' + (v.w - 150) + ';',
        'for (let y = 20; y < window.innerHeight - 70; y += 6) {',
        '  const e = document.elementFromPoint(x, y);',
        '  if (e && e.id === "hdui-root") return y;',
        '}',
        'return null;'
    ].join('\n'));
}

/** 在面板里从上往下试, 点到第一个能改变主题的条目为止(避开"精确坐标"的脆弱断言) */
async function clickFirstPanelItemThatChanges(page) {
    const v = await viewport(page);
    const before = await themeOf(page);
    const top = await panelTop(page);
    if (top === null) return null;
    for (let dy = 16; dy <= 320; dy += 10) {
        await mouseClick(page, v.w - 150, top + dy);
        await new Promise(function (r) { setTimeout(r, 120); });
        const now = await themeOf(page);
        if (now !== before) return now;
    }
    return null;
}

/** Alt+Shift+T 循环切换(真实键盘事件) */
async function pressAltShiftT(page) {
    const mods = { key: 'T', code: 'KeyT', windowsVirtualKeyCode: 84, text: 'T' };
    await page.sim.cdp.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyDown', modifiers: 1 | 8 }, mods), page.sessionId);
    await page.sim.cdp.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp', modifiers: 1 | 8 }, mods), page.sessionId);
    await new Promise(function (r) { setTimeout(r, 250); });
}

/** 点站内某个元素(用页面坐标), 用于验证站内交互仍然活着 */
async function clickSiteElement(page, selector) {
    const pt = await page.eval([
        'const e = document.querySelector(' + JSON.stringify(selector) + ');',
        'if (!e) return null;',
        'e.scrollIntoView({ block: "center" });',
        'const r = e.getBoundingClientRect();',
        'return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: r.width, h: r.height };'
    ].join('\n'));
    if (!pt) throw new Error('找不到站内元素: ' + selector);
    if (pt.w === 0 || pt.h === 0) throw new Error('站内元素尺寸为 0(主题把它遮没了): ' + selector + ' ' + JSON.stringify(pt));
    await mouseClick(page, pt.x, pt.y);
    await new Promise(function (r) { setTimeout(r, 400); });
    return pt;
}

module.exports = {
    HDUI_PATH: HDUI_PATH,
    BASE: BASE,
    DANGER_RE: DANGER_RE,
    open: open,
    waitState: waitState,
    themeOf: themeOf,
    snapshot: snapshot,
    signature: signature,
    dangerousHits: dangerousHits,
    mouseClick: mouseClick,
    clickFab: clickFab,
    panelTop: panelTop,
    clickFirstPanelItemThatChanges: clickFirstPanelItemThatChanges,
    pressAltShiftT: pressAltShiftT,
    clickSiteElement: clickSiteElement
};
