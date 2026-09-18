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
