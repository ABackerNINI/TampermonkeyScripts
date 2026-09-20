'use strict';
/**
 * 仿真站测试载体(harness)
 * ------------------------------------------------------------------
 * 一次 withSim() = 起本地仿真服务器 + 起一次性 Chrome(独立 profile + host-resolver
 * 把真实域名全指向本机) + 注入「GM 垫片 + 生产 userscript」+ 跑用例 + 收尾。
 *
 * 生产代码零改动: 不靠改 @match, 靠 --host-resolver-rules 保留真实域名。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const { createSimServer } = require('./server');
const { SHIM } = require('./gm-shim');
const { CDP } = require('./cdp');

const ROOT = path.join(__dirname, '..', '..', '..'); // tests/lib/sim -> repo root
const SCRIPT_PATH = path.join(ROOT, 'src', 'PTAutoCheckIn.user.js');

function findChrome() {
    if (process.env.SIM_CHROME) return process.env.SIM_CHROME;
    // Windows / Linux / macOS 常见位置; CI(Linux runner)自带 Chrome, 无需额外安装
    const cands = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    ];
    for (const p of cands) { try { if (fs.existsSync(p)) return p; } catch (e) { /* ignore */ } }
    return null;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/**
 * 杀掉一个进程**及其子进程树**(只针对 harness 自己 spawn 出来的那个 PID)。
 * Windows: taskkill /T /F; POSIX: 杀进程组。
 */
function killTree(proc) {
    try {
        if (process.platform === 'win32') {
            // 用同步版本: 异步 spawn 可能还没来得及执行, 宿主进程就退出了
            spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
        } else {
            try { process.kill(-proc.pid, 'SIGKILL'); } catch (e) { /* 没有进程组则退化为单进程 */ }
        }
    } catch (e) { /* ignore */ }
    try { proc.kill('SIGKILL'); } catch (e) { /* ignore */ }
}

function browserArgs(port) {
    return [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        '--mute-audio',
        '--disable-popup-blocking',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-component-update',
        '--disable-sync',
        '--disable-features=HttpsFirstBalancedMode,TranslateUI',
        '--window-size=1280,900',
        `--host-resolver-rules=MAP * 127.0.0.1:${port}`,
        '--remote-debugging-port=0',
        'about:blank'
    ];
}

async function startChrome(port, profile) {
    const chrome = findChrome();
    if (!chrome) throw new Error('未找到 Chrome/Edge, 可用 SIM_CHROME 环境变量指定');
    const proc = spawn(chrome, browserArgs(port), { stdio: ['ignore', 'pipe', 'pipe'] });
    const wsUrl = await new Promise((resolve, reject) => {
        let buf = '';
        const to = setTimeout(() => reject(new Error('等待 DevTools 地址超时\n' + buf.slice(-2000))), 30000);
        const onData = (d) => {
            buf += String(d);
            const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf);
            if (m) { clearTimeout(to); resolve(m[1]); }
        };
        proc.stderr.on('data', onData);
        proc.stdout.on('data', onData);
        proc.on('exit', (code) => { clearTimeout(to); reject(new Error(`Chrome 提前退出, code=${code}\n${buf.slice(-2000)}`)); });
    });
    return { proc, wsUrl };
}

class Page {
    constructor(sim, targetId, sessionId) {
        this.sim = sim;
        this.targetId = targetId;
        this.sessionId = sessionId;
        this.logs = [];
        this.sim._pages.set(sessionId, this);
    }

    async eval(expression) {
        const r = await this.sim.cdp.send('Runtime.evaluate', {
            expression: `(() => { ${expression} })()`,
            returnByValue: true,
            awaitPromise: true
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
            try {
                const v = await this.eval(expression);
                if (v) return v;
                last = v;
            } catch (e) { last = e.message; }
            await sleep(200);
        }
        throw new Error(`waitFor 超时(${label || expression}) 最后结果=${JSON.stringify(last)}`);
    }

    async close() {
        try { await this.sim.cdp.send('Target.closeTarget', { targetId: this.targetId }); } catch (e) { /* ignore */ }
        this.sim._pages.delete(this.sessionId);
    }
}

class Sim {
    constructor(server, port, proc, profile, cdp, injectSource) {
        this.server = server;
        this.port = port;
        this.proc = proc;
        this.profile = profile;
        this.cdp = cdp;
        this.injectSource = injectSource;
        this._pages = new Map();
        this.debug = !!process.env.SIM_DEBUG;

        cdp.on((msg) => {
            if (msg.method !== 'Runtime.consoleAPICalled') return;
            const page = this._pages.get(msg.sessionId);
            const text = (msg.params && msg.params.args || []).map((a) => {
                if (a.value !== undefined) return typeof a.value === 'object' ? JSON.stringify(a.value) : String(a.value);
                return a.description || a.type;
            }).join(' ');
            const line = `[${msg.params.type}] ${text}`;
            if (page) page.logs.push(line);
            if (this.debug) console.log('    · ' + line);
        });
    }

    // ---- 存储直读直写(与服务器同进程, 无需绕 HTTP) ----
    store() { return Object.fromEntries(this.server.simStore); }
    seed(obj) { for (const [k, v] of Object.entries(obj)) this.server.simStore.set(k, v); }
    get(key) { return this.server.simStore.get(key); }
    requests(filter) {
        const all = this.server.simLog;
        if (!filter) return all.slice();
        return all.filter((r) => {
            for (const [k, v] of Object.entries(filter)) {
                if (v instanceof RegExp) { if (!v.test(r[k])) return false; }
                else if (r[k] !== v) return false;
            }
            return true;
        });
    }
    reset() { this.server.simLog.length = 0; this.server.simStore.clear(); }

    async newPage() {
        const { targetId } = await this.cdp.send('Target.createTarget', { url: 'about:blank' });
        const { sessionId } = await this.cdp.send('Target.attachToTarget', { targetId, flatten: true });
        const page = new Page(this, targetId, sessionId);
        await this.cdp.send('Page.enable', {}, sessionId);
        await this.cdp.send('Runtime.enable', {}, sessionId);
        await this.cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: this.injectSource }, sessionId);
        return page;
    }

    /** 打开一个页面(注入已就绪), 可选等待页面主流程收敛 */
    async open(url, opts) {
        const page = await this.newPage();
        await this.cdp.send('Page.navigate', { url }, page.sessionId);
        if (opts && opts.waitMs) await sleep(opts.waitMs);
        return page;
    }

    sleep(ms) { return sleep(ms); }

    async close() {
        try { await this.cdp.send('Browser.close'); } catch (e) { /* ignore */ }
        this.cdp.close();
        // ⚠️ 只 kill 主进程是不够的: Windows 上 Chrome 的渲染进程等**子进程会变成孤儿**,
        //    每跑一个用例泄漏一批 ⇒ 套件跑到后面进程堆积、资源紧张, 于是**随机**有 1 个用例超时
        //    (症状: 每次红的还不一样 —— 极易被误判成"某个用例不稳定")。
        //    这里改成杀整棵树; /T 只作用于本用例自己拉起的那个 PID, 不碰用户正在用的浏览器。
        try { killTree(this.proc); } catch (e) { /* ignore */ }
        try { this.server.close(); } catch (e) { /* ignore */ }
        try { fs.rmSync(this.profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (e) { /* ignore */ }
    }
}

/**
 * @param {(sim:Sim)=>Promise<any>} fn
 * @param {{scriptPath?:string}} [opts]  scriptPath 缺省为 src/PTAutoCheckIn.user.js,
 *   测其它脚本时显式传入(如 src/HDHomeUI.user.js)
 */
async function withSim(fn, opts) {
    const scriptPath = (opts && opts.scriptPath) || SCRIPT_PATH;
    const server = createSimServer();
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ptac-sim-'));
    const { proc, wsUrl } = await startChrome(port, profile);
    const cdp = new CDP();
    await cdp.connect(wsUrl);

    const scriptSrc = fs.readFileSync(scriptPath, 'utf8');
    const sim = new Sim(server, port, proc, profile, cdp, `${SHIM}\n${scriptSrc}`);
    try {
        return await fn(sim);
    } finally {
        await sim.close();
    }
}

/** 今日日期字符串(与脚本 todayStr() 同语义: 本地时区 YYYY-MM-DD) */
function todayStr() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

module.exports = { withSim, todayStr, sleep, findChrome };
