#!/usr/bin/env node
'use strict';
/**
 * 真站脱敏整页离线渲染验收(P49 硬要求)
 * ------------------------------------------------------------------
 * 为什么要有这个文件:
 *   "动过底色 / 图标 / 布局之后必须跑真站" 这条规矩一直靠 `.workbuddy-ai/_verify-hdui-real-render.js`
 *   执行 —— 而它在 gitignore 里, 意味着**除了本人没人能复现这套验收**, 也永远进不了回归。
 *   五档扫描本身已经提升为共享基建 `tests/lib/hdui-scan.js`, 这里补上"驱动":
 *   起本地静态服务器 + 一次性 Chrome(--host-resolver-rules 把域名指到本机) + 注入生产脚本,
 *   然后跑扫描并把关键结构量一遍。
 *
 * 门禁: 缺真站整页样本 / 缺浏览器 => 打印 SKIP 并退 0(环境分级, 与仿真用例同一口径)。
 *      有样本时**必须真过**, 不得因为"真站和仿真页可能不一样"就放宽阈值 —— 那正是要抓的差异。
 *
 * ⚠️ 铁律 5: 只输出**结构 / 几何 / 颜色 / 计数**, 绝不输出页面文本、链接、UID、网名。
 *
 * 用法:
 *   node tests/hdhomeui/verify-hdui-real-page.js                  # 用默认样本路径
 *   node tests/hdhomeui/verify-hdui-real-page.js <页面路径>
 *   HDUI_PAGE=<路径> node tests/hdhomeui/verify-hdui-real-page.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const { findChrome } = require('../lib/sim/harness');
const { CDP } = require('../lib/sim/cdp');
const scan = require('../lib/hdui-scan');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src', 'HDHomeUI.user.js');
const DEFAULT_PAGE = path.join(ROOT, 'resources-do-not-track', 'HDHome-Whole-Web',
    'HDHome __ 种子 高清家园 - Powered by NexusPHP.html');
const PAGE = process.env.HDUI_PAGE || process.argv[2] || DEFAULT_PAGE;
const DIR = path.dirname(PAGE);
const NAME = path.basename(PAGE);
const VW = parseInt(process.env.HDUI_VW || '1280', 10);
const VH = parseInt(process.env.HDUI_VH || '900', 10);

function skip(why) { console.log('SKIP 真站整页验收: ' + why); process.exit(0); }

if (!findChrome()) skip('未找到 Chrome/Edge(可用 SIM_CHROME 指定)');
if (!fs.existsSync(PAGE)) {
    skip('缺真站整页样本(已 gitignore, 不会入库): ' + path.relative(ROOT, PAGE)
        + '\n     可用 HDUI_PAGE=<路径> 或命令行参数指定');
}

let failed = 0;
function ok(cond, msg) {
    if (cond) console.log('  ✓ ' + msg);
    else { failed++; console.log('  ✗ ' + msg); }
}

// ------------------------------------------------------------------
// 本地静态服务器: 把整页样本及其 _files 目录按原样吐出来
// ------------------------------------------------------------------
const MIME = {
    '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
    '.png': 'image/png', '.gif': 'image/gif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

function startStatic() {
    return new Promise(function (resolve) {
        const srv = http.createServer(function (req, res) {
            let p;
            try { p = decodeURIComponent(new URL('http://x' + req.url).pathname); } catch (e) { p = req.url; }
            // 站点首页一律回整页样本(样本就是种子页)
            if (p === '/' || p === '/torrents.php' || p === '/index.php') p = '/' + NAME;
            const file = path.join(DIR, p.replace(/^\/+/, ''));
            if (!file.startsWith(DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
                res.writeHead(404); res.end('nf'); return;
            }
            res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
            fs.createReadStream(file).pipe(res);
        });
        srv.listen(0, '127.0.0.1', function () { resolve(srv); });
    });
}

function launch(port, profile) {
    const args = ['--headless=new', '--no-sandbox', '--disable-gpu', '--mute-audio',
        '--disable-popup-blocking', '--no-first-run', '--no-default-browser-check',
        '--disable-extensions', '--disable-background-networking', '--disable-component-update',
        '--disable-sync', '--window-size=' + VW + ',' + VH,
        '--host-resolver-rules=MAP * 127.0.0.1:' + port,
        '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'];
    const proc = spawn(findChrome(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    return new Promise(function (resolve, reject) {
        let buf = '';
        const to = setTimeout(function () { reject(new Error('等待 DevTools 地址超时\n' + buf.slice(-1200))); }, 30000);
        const on = function (d) {
            buf += String(d);
            const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf);
            if (m) { clearTimeout(to); resolve({ proc: proc, ws: m[1] }); }
        };
        proc.stderr.on('data', on);
        proc.stdout.on('data', on);
        proc.on('exit', function (c) { clearTimeout(to); reject(new Error('Chrome 提前退出 ' + c)); });
    });
}

// ---- 极简 Page(与 lib/sim/harness 的 Page 同接口, 好复用 hdui-scan) ----
class Page {
    constructor(cdp, targetId, sessionId) {
        this.cdp = cdp; this.targetId = targetId; this.sessionId = sessionId;
    }
    async eval(expression) {
        const r = await this.cdp.send('Runtime.evaluate', {
            expression: '(() => { ' + expression + ' })()', returnByValue: true, awaitPromise: true
        }, this.sessionId);
        if (r && r.exceptionDetails) {
            const ex = r.exceptionDetails;
            throw new Error('页面求值异常: ' + ((ex.exception && ex.exception.description) || ex.text));
        }
        return r && r.result ? r.result.value : undefined;
    }
    async waitFor(expression, timeoutMs, label) {
        const deadline = Date.now() + (timeoutMs || 15000);
        let last;
        while (Date.now() < deadline) {
            try { const v = await this.eval(expression); if (v) return v; last = v; }
            catch (e) { last = e.message; }
            await new Promise(function (r) { setTimeout(r, 200); });
        }
        throw new Error('waitFor 超时(' + (label || expression) + ') 最后=' + JSON.stringify(last));
    }
    async close() {
        try { await this.cdp.send('Target.closeTarget', { targetId: this.targetId }); } catch (e) { /* ignore */ }
    }
}

/** 最小 GM 垫片: 只需要 GM_getValue/GM_setValue 存在且同步(不给值 -> 走首装默认 film) */
const GM_MIN = [
    '(function () {',
    '  try {',
    '    var S = {};',
    '    window.GM_getValue = function (k, d) { return Object.prototype.hasOwnProperty.call(S, k) ? S[k] : d; };',
    '    window.GM_setValue = function (k, v) { S[k] = v; };',
    '    window.GM_deleteValue = function (k) { delete S[k]; };',
    '  } catch (e) {}',
    '})();'
].join('\n');

// ------------------------------------------------------------------
(async function main() {
    const srv = await startStatic();
    const port = srv.address().port;
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hdui-real-'));
    const { proc, ws } = await launch(port, profile);
    const cdp = new CDP();
    await cdp.connect(ws);

    const scriptSrc = fs.readFileSync(SRC, 'utf8');
    let plainDocW = 0;

    try {
        // ---- 对照组: 不注入脚本(原站界面) ----
        const t1 = await cdp.send('Target.createTarget', { url: 'about:blank' });
        const s1 = await cdp.send('Target.attachToTarget', { targetId: t1.targetId, flatten: true });
        const p1 = new Page(cdp, t1.targetId, s1.sessionId);
        await cdp.send('Page.enable', {}, s1.sessionId);
        await cdp.send('Page.navigate', { url: 'http://hdhome.org/torrents.php' }, s1.sessionId);
        await new Promise(function (r) { setTimeout(r, 2500); });
        plainDocW = await p1.eval('return document.documentElement.scrollWidth;');
        await p1.close();

        // ---- 实验组: 注入生产脚本 ----
        const t2 = await cdp.send('Target.createTarget', { url: 'about:blank' });
        const s2 = await cdp.send('Target.attachToTarget', { targetId: t2.targetId, flatten: true });
        const p2 = new Page(cdp, t2.targetId, s2.sessionId);
        await cdp.send('Page.enable', {}, s2.sessionId);
        await cdp.send('Runtime.enable', {}, s2.sessionId);
        await cdp.send('Page.addScriptToEvaluateOnNewDocument',
            { source: GM_MIN + '\n' + scriptSrc }, s2.sessionId);
        await cdp.send('Page.navigate', { url: 'http://hdhome.org/torrents.php' }, s2.sessionId);

        console.log('真站整页验收(脱敏样本, 离线) —— ' + NAME);
        try {
            await p2.waitFor('return document.documentElement.dataset.hduiState === "applied"', 20000, 'applied');
            ok(true, '真站页面**仍然正常上妆**(新增的"未知结构一律卸妆"规则没有误判真站)');
        } catch (e) {
            const st = await p2.eval('return { state: document.documentElement.dataset.hduiState,'
                + ' err: (document.getElementById("hdui-alert") || {}).textContent || "" };');
            ok(false, '真站页面应当正常上妆; 实测 ' + JSON.stringify(st));
            throw e;
        }
        // ⚠️ 必须等 CSS 过渡跑完再量: 导航项带 `transition:background .14s`,
        //    上妆那一刻的 computed 值还是**中间态**(实测抓到 rgba(222,222,222,.616) —— 站点 #dedede
        //    正在褪成透明), 会被小件近白扫描误报。等过渡结束再量, 而不是放宽阈值。
        await new Promise(function (r) { setTimeout(r, 900); });

        // ① 文档宽(不被撑宽)
        const docW = await p2.eval('return document.documentElement.scrollWidth;');
        ok(docW <= plainDocW + 2, '文档宽没被撑宽(原站 ' + plainDocW + ' → 上妆 ' + docW + ')');

        // ② CSS 规则存活(静默失败)
        const css = await p2.eval([
            'const st = document.getElementById("hdui-css");',
            'if (!st) return { err: "no css" };',
            'const txt = st.textContent;',
            'const chunks = []; let depth = 0, buf = "";',
            'for (let i = 0; i < txt.length; i++) {',
            '  const c = txt[i];',
            '  if (c === "{") { depth++; buf += c; }',
            '  else if (c === "}") { depth--; buf += c;',
            '    if (depth <= 0) { if (buf.trim()) chunks.push(buf.trim()); buf = ""; depth = 0; } }',
            '  else if (depth === 0 && c === ";") { if (buf.trim()) chunks.push(buf.trim()); buf = ""; }',
            '  else buf += c;',
            '}',
            'return { total: chunks.length, parsed: st.sheet ? st.sheet.cssRules.length : -1 };'
        ].join('\n'));
        ok(css.total > 60 && css.parsed === css.total,
            '生成的 CSS 无静默失败(切出 ' + css.total + ' 条 / 解析出 ' + css.parsed + ' 条)');

        // ③ 图标: 真站里所有类别 / 促销 / 指标图标都换成了主题 SVG(含未登记家族的兜底)
        const icons = await p2.eval([
            'function cs(e, p) { return getComputedStyle(e).getPropertyValue(p); }',
            'function svg(e) { return String(cs(e, "content")).indexOf("data:image/svg+xml") >= 0; }',
            'const cats = Array.prototype.slice.call(document.querySelectorAll("#torrenttable img[class*=\'c_\']"));',
            'const pros = Array.prototype.slice.call(document.querySelectorAll("#torrenttable img[class*=\'pro_\']"));',
            'const tags = Array.prototype.slice.call(document.querySelectorAll("#torrenttable span.tags"));',
            'const fams = {};',
            'cats.forEach(function (i) { const f = (String(i.className).match(/^c_[a-z]+/) || ["?"])[0]; fams[f] = (fams[f] || 0) + 1; });',
            'return {',
            '  catN: cats.length, catSvg: cats.filter(svg).length,',
            '  proN: pros.length, proSvg: pros.filter(svg).length,',
            '  tagN: tags.length,',
            '  tagPill: tags.filter(function (s) { return cs(s, "float") === "none" && cs(s, "border-radius") === "999px"; }).length,',
            '  tagColored: tags.filter(function (s) { return cs(s, "background-color") !== "rgba(0, 0, 0, 0)"; }).length',
            '};'
        ].join('\n'));
        ok(icons.catN > 0 && icons.catSvg === icons.catN,
            '类别图标全部换成 SVG(含未登记家族的兜底): ' + icons.catSvg + '/' + icons.catN);
        ok(icons.proN > 0 && icons.proSvg === icons.proN,
            '促销徽章全部换成 SVG: ' + icons.proSvg + '/' + icons.proN);
        ok(icons.tagN > 0 && icons.tagPill === icons.tagN && icons.tagColored === icons.tagN,
            '标签是药丸且**保留站点分类底色**: ' + icons.tagPill + '/' + icons.tagN + ' 药丸, '
            + icons.tagColored + '/' + icons.tagN + ' 保留底色');

        // ④ 置顶行: 内外两层都要有背景(P65)
        const sticky = await p2.eval([
            'const rs = Array.prototype.slice.call(document.querySelectorAll("#torrenttable tr.sticky_top"));',
            'const bad = rs.filter(function (r) { return getComputedStyle(r).backgroundColor === "rgba(0, 0, 0, 0)"; });',
            'return { n: rs.length, bad: bad.length };'
        ].join('\n'));
        ok(sticky.n === 0 || sticky.bad === 0,
            '置顶行内外两层都有背景(P65): 共 ' + sticky.n + ' 个, 透明 ' + sticky.bad + ' 个');

        // ⑤ 五档扫描里的四档(UA 界面单独量)
        const white = await scan.scanWhite(p2);
        ok(white.length === 0, '漏白扫描: 无大面积近白容器; ' + JSON.stringify(white.slice(0, 3)));
        const near = await scan.scanNearWhite(p2);
        ok(near.length === 0, '小件近白扫描: 无; ' + JSON.stringify(near.slice(0, 3)));
        const deco = await scan.scanDeco(p2);
        ok(deco.length === 0, '站点残留装饰扫描(背景图/阴影/亮边框/outline): 无; ' + JSON.stringify(deco.slice(0, 3)));
        const lowc = await scan.scanContrast(p2);
        ok(lowc.length === 0, '对比度扫描: 无低对比文本(Δ<40); ' + JSON.stringify(lowc.slice(0, 3)));

        // ⑥ UA 界面(color-scheme) —— 滚动条/下拉弹层是浏览器画的, 不在上面四档的视野里
        const ua = await scan.scanUa(p2);
        ok(String(ua.colorScheme).indexOf('dark') >= 0,
            'color-scheme=dark(滚动条 / 下拉弹层等 UA 界面); 实测 ' + JSON.stringify(ua.colorScheme));
        await p2.close();
    } finally {
        try { await cdp.send('Browser.close'); } catch (e) { /* ignore */ }
        cdp.close();
        try { proc.kill('SIGKILL'); } catch (e) { /* ignore */ }
        try { srv.close(); } catch (e) { /* ignore */ }
        try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (e) { /* ignore */ }
    }

    console.log('');
    if (failed) { console.error('FAIL 真站整页验收: ' + failed + ' 项不达标'); process.exit(1); }
    console.log('PASS 真站整页验收: 全部达标');
    process.exit(0);
})().catch(function (e) {
    console.error('ERR ' + (e && e.message ? e.message : e));
    process.exit(1);
});
