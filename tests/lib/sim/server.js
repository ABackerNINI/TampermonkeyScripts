'use strict';
/**
 * 仿真站服务器(零依赖, 只用 Node 内置 http)
 * ------------------------------------------------------------------
 * 与 Chrome 的 --host-resolver-rules="MAP * 127.0.0.1:<port>" 配合使用:
 * URL 里的真实域名得以保留(@match / matchUnit 正常命中), 但请求全部落到本机。
 *
 * 路由:
 *   /__gm/get?key=...     取 GM 存储(返回一个 {found, value})
 *   /__gm/set  (POST)     写 GM 存储, body = JSON {key, value}
 *   /__gm/dump            导出全部存储
 *   /__gm/reset           清空存储
 *   /__sim/log            导出请求日志(已剔除 __gm/__sim 自身流量)
 *   /__sim/reset          清空日志与存储
 *   /__sim/seed (POST)    批量预置存储, body = JSON {key: value}
 *   其它                   交给 sites.js 渲染的站点剧本
 */

const http = require('http');
const { renderPage } = require('./sites');

function json(res, obj, code) {
    const body = JSON.stringify(obj);
    res.writeHead(code || 200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(body);
}

function html(res, body, code) {
    res.writeHead(code || 200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    res.end(body);
}

function readBody(req) {
    return new Promise((resolve) => {
        let s = '';
        req.on('data', (c) => { s += c; });
        req.on('end', () => resolve(s));
    });
}

// 站内图片占位。
// 真站的图标几乎都是 1×1 的 `trans.gif` + CSS 雪碧图(尺寸由 CSS 给), 不是真的图片文件。
// 必须返回一张**能解码的** 1×1 透明图: 否则 <img> 变成"加载失败", 浏览器会把 alt 文字画出来,
// 把格子撑得比真站宽/高得多 —— 截图复核和几何断言都会被这个假象带偏。
const BLANK_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const BLANK_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64');

function image(res, buf, type) {
    res.writeHead(200, {
        'Content-Type': type,
        'Content-Length': buf.length,
        'Cache-Control': 'no-store'
    });
    res.end(buf);
}

function createSimServer() {
    const store = new Map();
    const log = [];

    const server = http.createServer(async (req, res) => {
        const host = (req.headers.host || 'sim.local').split(':')[0];
        const url = `http://${host}${req.url}`;
        let path;
        try { path = new URL(url).pathname; } catch (e) { path = req.url.split('?')[0]; }

        // 控制面与存储面的流量不计入"站点请求日志", 否则会淹没断言目标
        if (!path.startsWith('/__gm/') && !path.startsWith('/__sim/')) {
            log.push({ t: Date.now(), host, path, url: req.url, ua: req.headers['user-agent'] || '' });
        }

        try {
            if (path === '/__gm/get') {
                const key = new URL(url).searchParams.get('key');
                return json(res, { found: store.has(key), value: store.get(key) });
            }
            if (path === '/__gm/set') {
                const { key, value } = JSON.parse((await readBody(req)) || '{}');
                store.set(key, value === undefined ? null : value);
                return json(res, { ok: true });
            }
            if (path === '/__gm/dump') return json(res, { store: Object.fromEntries(store) });
            if (path === '/__gm/reset') { store.clear(); return json(res, { ok: true }); }

            if (path === '/__sim/log') return json(res, { log });
            if (path === '/__sim/reset') { log.length = 0; store.clear(); return json(res, { ok: true }); }
            if (path === '/__sim/seed') {
                const obj = JSON.parse((await readBody(req)) || '{}');
                for (const [k, v] of Object.entries(obj)) store.set(k, v);
                return json(res, { ok: true });
            }

            // 站内静态图: 一律给 1×1 透明占位(尺寸由站点 CSS 决定, 与真站一致)。
            // ⚠️ 必须在 renderPage **之前**拦下来: 站点剧本对未知路径是兜底渲染整页 HTML 的,
            //    把 HTML 当成图片响应, <img> 就是"加载失败" —— 浏览器改用 alt 文字排版,
            //    一个 16px 的图标会变成 83px 宽("download" 那串字), 布局与几何断言全被带偏。
            if (path.startsWith('/static/')) {
                return /\.gif$/i.test(path)
                    ? image(res, BLANK_GIF, 'image/gif')
                    : image(res, BLANK_PNG, 'image/png');
            }

            const out = await renderPage({ host, path, url, req });
            return html(res, out.body, out.status);
        } catch (e) {
            return html(res, `<!doctype html><p>sim server error: ${String(e && e.message)}</p>`, 500);
        }
    });

    // 测试进程与服务器同进程: 直接读写 store / log, 无需绕 HTTP
    server.simStore = store;
    server.simLog = log;
    return server;
}

module.exports = { createSimServer };
