'use strict';
/**
 * HDHomeUI 渲染扫描器(共享基建, 不被 tests/run-all.js 当作测试执行)
 * ------------------------------------------------------------------
 * 为什么要有这个文件:
 *   真站整页验收脚本 `_verify-hdui-real-render.js` 一直躺在 `.workbuddy-ai/`(已 gitignore),
 *   于是「漏白 / 小件近白 / 残留装饰 / 对比度 / UA 界面」这五档扫描**永远无法回归** ——
 *   每次都是临时重写一遍, 写错的算法也没人发现。这里把它提升为仓库内基建:
 *     · 仿真用例可直接 require 复用(尤其是对比度算法, 别再各写一份);
 *     · 算法本身进入 run-all.js 的可回归范围。
 *
 * 纪律(铁律 5): 只输出**结构键 / 计数 / 几何值 / 颜色**, 绝不输出页面文本。
 *
 * 页面侧片段都用 `page.eval(<源码>)` 执行(源码末尾 `return ...`), 与既有用例一致。
 */

/** 页面侧公共函数: 取值 / 亮度 / 有效背景 / 对比度 / 可见性 / 命中测试 / 图标层 */
const CORE_JS = [
    'function __cs(e, p, ps) { return ps ? getComputedStyle(e, ps).getPropertyValue(p) : getComputedStyle(e).getPropertyValue(p); }',
    'function __lum(c) {',
    '  const m = /^rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?/.exec(String(c));',
    '  if (!m) return null;',
    // ⚠️ 必须算 alpha: rgba(255,255,255,.043) 的 rgb 是纯白, 视觉上却几乎透明 ——
    //    不算 alpha 会把"刻意做的 4% 白底 chip"全报成漏白。
    '  if (m[4] !== undefined && parseFloat(m[4]) < 0.5) return null;',
    '  return (parseInt(m[1], 10) * 299 + parseInt(m[2], 10) * 587 + parseInt(m[3], 10) * 114) / 1000;',
    '}',
    'function __effBg(e) {',
    '  for (let p = e; p; p = p.parentElement) { const v = __lum(__cs(p, "background-color")); if (v !== null) return v; }',
    '  return 12;',   // 兜底: 主题片基是深色
    '}',
    'function __contrast(e) {',
    '  const f = __lum(__cs(e, "color"));',
    '  return f === null ? null : Math.abs(f - __effBg(e));',
    '}',
    'function __vis(e) {',
    '  const r = e.getBoundingClientRect();',
    '  const s = getComputedStyle(e);',
    '  return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top),',
    '    display: s.display, visibility: s.visibility, opacity: parseFloat(s.opacity || "1"),',
    '    inView: r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight };',
    '}',
    // hit-test: 元素存在 ≠ 看得见。被裁 / 被压 / 跑到视口外都会在 elementFromPoint 上暴露。
    // ⚠️ 只有"命中自身或**后代**"才算数。祖先命中一律算**被盖住** ——
    //    早期版本把 `el.contains(e)`(祖先)也算通过, 结果 BODY 包含一切,
    //    任何"整页遮罩"都会被判成命中 => 这类断言永远不可能变红(P72 式的假绿, 反例才抓出来)。
    // ⚠️ 多行 inline 元素的 bounding box 中心可能落在**行盒之间的空隙**里, 那时会命中父级块;
    //    所以补测一次"第一段 client rect"的中心, 避免把行内元素误判成被盖住。
    'function __hit(e) {',
    '  const r = e.getBoundingClientRect();',
    '  if (r.width <= 0 || r.height <= 0) return { ok: false, why: "zero-rect" };',
    '  if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) {',
    '    e.scrollIntoView({ block: "center" });',
    '  }',
    '  const r2 = e.getBoundingClientRect();',
    '  const pts = [{ x: r2.left + r2.width / 2, y: r2.top + r2.height / 2 }];',
    '  const crs = e.getClientRects ? e.getClientRects() : null;',
    '  if (crs && crs.length) pts.push({ x: crs[0].left + crs[0].width / 2, y: crs[0].top + crs[0].height / 2 });',
    '  let last = null, lastTag = null;',
    '  for (let i = 0; i < pts.length; i++) {',
    '    const x = Math.round(pts[i].x), y = Math.round(pts[i].y);',
    '    const el = document.elementFromPoint(x, y);',
    '    if (!el) { lastTag = null; continue; }',
    '    if (el === e || (e.contains && e.contains(el))) {',
    '      return { ok: true, x: x, y: y, hit: __tagOf(el) };',
    '    }',
    '    last = el; lastTag = __tagOf(el);',
    '  }',
    '  return { ok: false, why: lastTag ? "covered" : "offscreen", hit: lastTag };',
    '}',
    // 图标层: 站点是用 background 画的雪碧图, 主题用 content 换 SVG。
    // 两者**都**是 none 才是真的"没内容 = 空白"(新徽章被屏蔽的典型形态)。
    'function __icon(e) {',
    '  const s = getComputedStyle(e);',
    '  return { content: String(s.content || "none"), bg: String(s.backgroundImage || "none") };',
    '}',
    'function __tagOf(e) {',
    '  return e.tagName.toLowerCase()',
    '    + (e.getAttribute("class") ? "." + String(e.getAttribute("class")).split(/\\s+/)[0] : "")',
    '    + (e.id ? "#" + e.id.slice(0, 18) : "");',
    '}'
].join('\n');

/**
 * 金丝雀探针: 给一组 `data-canary` id, 逐个报「是否还看得见」。
 * 这是"未知元素不被屏蔽"的统一判据 —— T3/T5 都借它, 免得每个用例各写一份。
 */
function canaryJs(ids) {
    return [
        CORE_JS,
        'const ids = ' + JSON.stringify(ids) + ';',
        'const out = {};',
        'ids.forEach(function (id) {',
        '  const e = document.querySelector("[data-canary=\\"" + id + "\\"]");',
        '  if (!e) { out[id] = { exists: false }; return; }',
        // ⚠️ 每次都先回到页顶: __hit 为了量视口外的元素会 scrollIntoView,
        //    不复位的话后一条金丝雀量到的是"被上一条滚过的页面"(实测坑过一次)。
        '  window.scrollTo(0, 0);',
        '  const v = __vis(e);',
        '  const h = __hit(e);',
        '  const d = __contrast(e);',
        '  out[id] = { exists: true, w: v.w, h: v.h, x: v.x, y: v.y,',
        '    display: v.display, visibility: v.visibility, opacity: v.opacity, inView: v.inView,',
        '    hitOk: !!h.ok, hit: h.hit || null, hitWhy: h.why || null,',
        '    contrast: d === null ? null : Math.round(d),',
        '    icon: __icon(e), tag: __tagOf(e) };',
        '});',
        'return out;'
    ].join('\n');
}

/** 全页扫描: ① 大面积漏白(白底块) */
const WHITE_JS = [
    CORE_JS,
    'const out = [];',
    'Array.prototype.forEach.call(document.querySelectorAll("body *"), function (e) {',
    '  const lum = __lum(__cs(e, "background-color"));',
    '  if (lum === null || lum <= 200) return;',
    '  const r = e.getBoundingClientRect();',
    '  if (r.width * r.height <= 20000) return;',
    '  out.push({ tag: __tagOf(e), w: Math.round(r.width), h: Math.round(r.height), lum: Math.round(lum) });',
    '});',
    'return out.sort(function (a, b) { return b.w * b.h - a.w * a.h; }).slice(0, 8);'
].join('\n');

/** 全页扫描: ② 小件近白(标签/按钮这类几十 px² 的, ① 抓不到) */
const NEAR_WHITE_JS = [
    CORE_JS,
    'const agg = {};',
    'Array.prototype.forEach.call(document.querySelectorAll("body *"), function (e) {',
    '  const lum = __lum(__cs(e, "background-color"));',
    '  if (lum === null || lum <= 190) return;',
    '  const r = e.getBoundingClientRect();',
    '  const area = r.width * r.height;',
    '  if (area < 150 || area > 20000) return;',
    '  const k = __tagOf(e) + " | " + __cs(e, "background-color") + " | " + Math.round(r.width) + "x" + Math.round(r.height);',
    '  agg[k] = (agg[k] || 0) + 1;',
    '});',
    'return Object.keys(agg).map(function (k) { return { k: k, n: agg[k] }; })',
    '  .sort(function (a, b) { return b.n - a.n; }).slice(0, 12);'
].join('\n');

/** 全页扫描: ③ 站点残留装饰(背景图 / 阴影 / 亮边框 / outline) */
const DECO_JS = [
    CORE_JS,
    'const agg = {};',
    'Array.prototype.forEach.call(document.querySelectorAll("body *"), function (e) {',
    '  const r = e.getBoundingClientRect();',
    '  if (r.width < 2 || r.height < 2) return;',
    '  const hits = [];',
    '  const bi = __cs(e, "background-image");',
    '  if (bi && bi !== "none" && bi.indexOf("data:") < 0) hits.push("bg-img");',
    '  const bs = __cs(e, "box-shadow");',
    // tr.sticky_top 那条 inset 金边是我们自己的置顶标记, 不是站点残留
    '  if (bs && bs !== "none" && !(e.matches && e.matches("tr.sticky_top"))) hits.push("shadow");',
    '  if (__cs(e, "outline-style") !== "none") hits.push("outline");',
    '  ["border-top", "border-right", "border-bottom", "border-left"].forEach(function (s) {',
    '    if (parseFloat(__cs(e, s + "-width")) <= 0) return;',
    '    const c = __cs(e, s + "-color");',
    '    const m = /^rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?/.exec(String(c));',
    '    if (!m) return;',
    '    if (m[4] !== undefined && parseFloat(m[4]) < 0.5) return;',
    '    if ((parseInt(m[1], 10) + parseInt(m[2], 10) + parseInt(m[3], 10)) / 3 > 190) hits.push("light-border");',
    '  });',
    '  if (!hits.length) return;',
    '  const k = __tagOf(e) + " | " + hits.join(",");',
    '  agg[k] = (agg[k] || 0) + 1;',
    '});',
    'return Object.keys(agg).map(function (k) { return { k: k, n: agg[k] }; })',
    '  .sort(function (a, b) { return b.n - a.n; }).slice(0, 14);'
].join('\n');

/**
 * 全页扫描: ④ 对比度(「软屏蔽」—— 内容还在, 但前景与背景亮度太近, 人看不见)。
 * 只看**自带文本**的元素(直接子文本节点非空), 沿祖先找第一个不透明底色当有效背景。
 */
const CONTRAST_JS = [
    CORE_JS,
    'const agg = {};',
    'Array.prototype.forEach.call(document.querySelectorAll("body *"), function (e) {',
    '  let hasText = false;',
    '  for (let n = e.firstChild; n; n = n.nextSibling) {',
    '    if (n.nodeType === 3 && n.nodeValue.trim().length) { hasText = true; break; }',
    '  }',
    '  if (!hasText) return;',
    '  const r = e.getBoundingClientRect();',
    '  if (r.width < 4 || r.height < 4) return;',
    '  const d = __contrast(e);',
    '  if (d === null || d >= 40) return;',
    '  const k = __tagOf(e) + " | fg " + __cs(e, "color") + " vs bg~" + Math.round(__effBg(e))',
    '    + " (差 " + Math.round(d) + ")";',
    '  agg[k] = (agg[k] || 0) + 1;',
    '});',
    'return Object.keys(agg).map(function (k) { return { k: k, n: agg[k] }; })',
    '  .sort(function (a, b) { return b.n - a.n; }).slice(0, 12);'
].join('\n');

/** 全页扫描: ⑤ UA 界面(color-scheme / 滚动条) —— 不是 DOM 元素, 前面四档都看不见 */
const UA_JS = [
    'const p = document.createElement("div");',
    'p.style.cssText = "width:120px;height:120px;overflow-y:scroll;position:absolute;top:0;left:0;visibility:hidden";',
    'document.body.appendChild(p);',
    'const w = p.offsetWidth - p.clientWidth;',
    'p.remove();',
    'return { colorScheme: getComputedStyle(document.documentElement).colorScheme',
    '  || getComputedStyle(document.documentElement).getPropertyValue("color-scheme"), scrollbarW: w };'
].join('\n');

async function canaries(page, ids) {
    return page.eval(canaryJs(ids));
}
async function scanWhite(page) { return page.eval(WHITE_JS); }
async function scanNearWhite(page) { return page.eval(NEAR_WHITE_JS); }
async function scanDeco(page) { return page.eval(DECO_JS); }
async function scanContrast(page) { return page.eval(CONTRAST_JS); }
async function scanUa(page) { return page.eval(UA_JS); }

/** 五档一次跑完(返回 { white, nearWhite, deco, contrast, ua }) */
async function scanAll(page) {
    return {
        white: await scanWhite(page),
        nearWhite: await scanNearWhite(page),
        deco: await scanDeco(page),
        contrast: await scanContrast(page),
        ua: await scanUa(page)
    };
}

module.exports = {
    CORE_JS: CORE_JS,
    canaryJs: canaryJs,
    canaries: canaries,
    WHITE_JS: WHITE_JS,
    NEAR_WHITE_JS: NEAR_WHITE_JS,
    DECO_JS: DECO_JS,
    CONTRAST_JS: CONTRAST_JS,
    UA_JS: UA_JS,
    scanWhite: scanWhite,
    scanNearWhite: scanNearWhite,
    scanDeco: scanDeco,
    scanContrast: scanContrast,
    scanUa: scanUa,
    scanAll: scanAll
};
