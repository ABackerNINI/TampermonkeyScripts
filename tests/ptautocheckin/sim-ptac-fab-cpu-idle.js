'use strict';
/**
 * D2: FAB 静息 CPU=0 验收 —— CDP Performance 录 5s 静息(全程不操作鼠标)
 * ------------------------------------------------------------------
 * 计划 26-11-24-2226 §04 D2 / §01 不变量 6 / §06 D4,D9 / §07 CDP 不可用对策。
 *
 * 两态各录一次:
 *   ① 关动效态 (ptac_motion=false, edge=false, chameleon)
 *   ② 靠边态   (ptac_edge=true, motion 默认开, chameleon) —— 验 B1 竖线本体 animation:none
 * 静息口径(D9): 只管静止不动时; 形变 transition 属交互响应, 不计静息负载。
 * 不计入: ptacHlPulse(签到按钮高亮, §06 D1)与 200ms 签到 tick(§04 D2)。
 *
 * 证据三路交叉(数字全部实测, 不伪造):
 *   1. computed: 穿透 closed shadow 读 FAB 本体 / ::after / ::before 的 animation-name;
 *   2. CDP Tracing 5s: 统计 Paint 与 UpdateLayoutTree(Recalculate Style) 事件;
 *   3. Overlay.paintRect: 收集真实重绘矩形, 与 FAB 几何相交的即为 FAB 归因重绘(应为 0)。
 * 录屏: Page.startScreencast 5s 收帧数, 数字随结论入基线切片。
 *
 * 环境门禁沿用 tcase.runCase: 无浏览器/无 Node22 WebSocket 时 SKIP 退 0,
 * 具备环境时必须真过 —— SKIP 理由由门禁打印, 本用例不伪造任何数字。
 */

const { withSim, todayStr } = require('../lib/sim/harness');
const { runCase, assert, assertEq } = require('../lib/sim/tcase');

const A = 'http://www.tangpt.top';
const UID = 'tangpt';
const HAS_UI = `return !!document.getElementById('ptac-root-v2');`;
const K_STATUS = `ptac_status_${UID}`;
const IDLE_MS = 5000;

// 穿透 closed shadow 取 .fab 远程对象引用(与 sim-ptac-fab-edge.js 同款基建)
async function resolveFab(sim, page) {
    const s = page.sessionId;
    const doc = await sim.cdp.send('DOM.getDocument', { depth: 1, pierce: true }, s);
    const host = await sim.cdp.send('DOM.querySelector',
        { nodeId: doc.root.nodeId, selector: '#ptac-root-v2' }, s);
    if (!host.nodeId) return null;
    const desc = await sim.cdp.send('DOM.describeNode',
        { nodeId: host.nodeId, pierce: true, depth: -1 }, s);
    const roots = (desc.node && desc.node.shadowRoots) || [];
    if (!roots.length) return null;
    const el = await sim.cdp.send('DOM.querySelector',
        { nodeId: roots[0].nodeId, selector: '.fab' }, s);
    if (!el.nodeId) return null;
    const obj = await sim.cdp.send('DOM.resolveNode', { nodeId: el.nodeId }, s);
    return { sessionId: s, objectId: obj.object.objectId };
}

// 读 FAB 几何与三处 computed animation-name
async function fabIdleMetrics(sim, page) {
    const ref = await resolveFab(sim, page);
    if (!ref) return null;
    const r = await sim.cdp.send('Runtime.callFunctionOn', {
        objectId: ref.objectId,
        functionDeclaration: `function () {
            var b = this.getBoundingClientRect();
            return {
                cls: this.className,
                w: b.width, h: b.height, left: b.left, top: b.top,
                anim: getComputedStyle(this).animationName,
                glowAnim: getComputedStyle(this, '::after').animationName,
                hitAnim: getComputedStyle(this, '::before').animationName
            };
        }`,
        returnByValue: true
    }, ref.sessionId);
    return r && r.result ? r.result.value : null;
}

function metricValue(metrics, name) {
    const found = (metrics || []).find((m) => m.name === name);
    return found ? found.value : 0;
}

function parseTrace(raw) {
    let data;
    try { data = JSON.parse(raw); } catch (e) { data = null; }
    if (Array.isArray(data)) return data;
    // Chrome 可能以 {"traceEvents":[...], "metadata":{...}} 包装流式输出
    if (data && Array.isArray(data.traceEvents)) return data.traceEvents;
    const out = [];
    for (const line of raw.split('\n')) {
        const t = line.trim().replace(/,$/, '');
        if (!t || t === '[' || t === ']') continue;
        try { out.push(JSON.parse(t)); } catch (_) { /* 非事件行 */ }
    }
    return out;
}

function overlapsFab(rect, fab) {
    return rect.x < fab.left + fab.w && rect.x + rect.width > fab.left &&
           rect.y < fab.top + fab.h && rect.y + rect.height > fab.top;
}

// RecalcStyle trace 事件只带 frame/elementCount, 无选择器可归因; 改用"静息前后 FAB 状态不变"
// 交叉证明: FAB 类名/三处 animation-name/几何全程恒定, 则 5s 内的样式重算不可能归因 FAB。
function assertFabStill(before, after, label) {
    assert(after, `${label}: 录制后应仍能读到 fab`);
    for (const key of ['cls', 'anim', 'glowAnim', 'hitAnim']) {
        assertEq(after[key], before[key], `${label}: 5s 静息期间 FAB ${key} 不应变化`);
    }
    assert(Math.abs(after.w - before.w) <= 0.5 && Math.abs(after.h - before.h) <= 0.5,
        `${label}: 5s 静息期间 FAB 几何不应变化`);
}

function recalcBrief(rec) {
    return rec.recalcSamples.map((e) => {
        const a = e.args || {};
        return `elementCount=${a.elementCount === undefined ? '?' : a.elementCount}`;
    }).join(',') || '无';
}

/** 录 5s 静息: 全程不派发任何 Input 事件, 只被动收集 CDP 证据。 */
async function recordIdle(sim, page, label) {
    const s = page.sessionId;
    let stream = null;
    let frames = 0;
    const paintRects = [];
    const off = sim.cdp.on((msg) => {
        if (msg.method === 'Tracing.tracingComplete') stream = msg.params.stream;
        if (msg.method === 'Page.screencastFrame') {
            frames++;
            sim.cdp.send('Page.screencastFrameAck', { sessionId: msg.params.sessionId }).catch(() => {});
        }
        if (msg.method === 'Overlay.paintRect' && msg.params && msg.params.rect) {
            paintRects.push(msg.params.rect);
        }
    });

    await sim.cdp.send('Performance.enable', {}, s);
    const before = await sim.cdp.send('Performance.getMetrics', {}, s);
    await sim.cdp.send('Overlay.enable', {}, s);
    await sim.cdp.send('Overlay.setShowPaintRects', { result: true }, s);
    await sim.cdp.send('Page.startScreencast',
        { format: 'jpeg', quality: 40, maxWidth: 320, maxHeight: 240 }, s);
    await sim.cdp.send('Tracing.start', {
        categories: 'devtools.timeline,disabled-by-default-devtools.timeline.frame',
        transferMode: 'ReturnAsStream'
    });

    await sim.sleep(IDLE_MS); // 静息: 不操作鼠标/键盘, 不做任何导航

    await sim.cdp.send('Page.stopScreencast', {}, s);
    await sim.cdp.send('Overlay.setShowPaintRects', { result: false }, s);
    await sim.cdp.send('Overlay.disable', {}, s);
    await sim.cdp.send('Tracing.end');

    const deadline = Date.now() + 10000;
    while (!stream && Date.now() < deadline) await sim.sleep(50);
    if (!stream) throw new Error(`${label}: Tracing 未返回 stream(无法量化静息重绘)`);
    let raw = '';
    while (true) {
        const chunk = await sim.cdp.send('IO.read', { handle: stream, size: 1048576 });
        raw += chunk.data || '';
        if (chunk.eof) break;
    }
    await sim.cdp.send('IO.close', { handle: stream });
    off();

    const after = await sim.cdp.send('Performance.getMetrics', {}, s);
    const events = parseTrace(raw);
    const paintEvents = events.filter((e) => e.name === 'Paint').length;
    const recalcList = events.filter((e) =>
        e.name === 'UpdateLayoutTree' || e.name === 'RecalculateStyles');
    return {
        frames,
        paintEvents,
        recalcEvents: recalcList.length,
        recalcSamples: recalcList.slice(0, 2).map((e) => ({ name: e.name, args: e.args })),
        recalcCount: metricValue(after.metrics, 'RecalcStyleCount') - metricValue(before.metrics, 'RecalcStyleCount'),
        layoutCount: metricValue(after.metrics, 'LayoutCount') - metricValue(before.metrics, 'LayoutCount'),
        paintRects
    };
}

function openPage(sim, seedExtra) {
    sim.reset();
    sim.seed(Object.assign({
        ptac_skin: 'chameleon',
        [K_STATUS]: { date: todayStr(), status: 'success', msg: 'sim', ts: Date.now() }
    }, seedExtra));
    return sim.open(`${A}/?sim=already`, { waitMs: 1500 });
}

runCase('FAB 静息 CPU=0: 关动效态与靠边态 5s CDP 实测', async () => {
    await withSim(async (sim) => {
        // ========== ① 关动效态 ==========
        let page = await openPage(sim, { ptac_motion: false, ptac_edge: false });
        await page.waitFor(HAS_UI, 20000, 'UI 注入');
        let m = await fabIdleMetrics(sim, page);
        assert(m, '关动效态: 应能穿透 shadow 读到 fab 几何');
        assertEq(m.anim, 'none', '关动效态 FAB 本体 computed animation-name 应为 none');
        assertEq(m.glowAnim, 'none', '关动效态 FAB ::after 辉光 computed animation-name 应为 none');
        assertEq(m.hitAnim, 'none', '关动效态 FAB ::before 命中区 computed animation-name 应为 none');

        let rec = await recordIdle(sim, page, '关动效态');
        assertFabStill(m, await fabIdleMetrics(sim, page), '关动效态');
        const offFabRects = rec.paintRects.filter((r) => overlapsFab(r, m));
        assertEq(offFabRects.length, 0,
            '关动效态: 5s 静息与 FAB 几何相交的重绘矩形数应为 0');
        console.log(`  关动效态: computed=${m.anim}/${m.glowAnim}/${m.hitAnim} · ` +
            `Paint事件=${rec.paintEvents} · RecalcStyle事件=${rec.recalcEvents}(${recalcBrief(rec)}) · ` +
            `RecalcStyleCountΔ=${rec.recalcCount} · LayoutCountΔ=${rec.layoutCount} · ` +
            `重绘矩形=${rec.paintRects.length}(FAB归因=${offFabRects.length}) · 录屏帧=${rec.frames}`);
        await page.close();

        // ========== ② 靠边态(motion 默认开, 验 B1 竖线本体无动画) ==========
        page = await openPage(sim, { ptac_edge: true });
        await page.waitFor(HAS_UI, 20000, 'UI 注入');
        m = await fabIdleMetrics(sim, page);
        assert(m, '靠边态: 应能穿透 shadow 读到 fab 几何');
        assert(/\bedge\b/.test(m.cls), `靠边态 fab 应带 .edge 类, 实际 ${m.cls}`);
        assertEq(m.anim, 'none', '靠边态 FAB 本体 computed animation-name 应为 none(竖线不被逐帧晃动)');
        assertEq(m.hitAnim, 'none', '靠边态 FAB ::before 命中区 computed animation-name 应为 none');
        // ::after 辉光呼吸属状态色语义(B1 明确保留), 只动 opacity 是合成属性, 不产生 Paint/RecalcStyle。

        rec = await recordIdle(sim, page, '靠边态');
        assertFabStill(m, await fabIdleMetrics(sim, page), '靠边态');
        const edgeFabRects = rec.paintRects.filter((r) => overlapsFab(r, m));
        assertEq(edgeFabRects.length, 0,
            '靠边态: 5s 静息与 FAB 几何相交的重绘矩形数应为 0');
        console.log(`  靠边态: computed=${m.anim}/${m.glowAnim}/${m.hitAnim} · ` +
            `Paint事件=${rec.paintEvents} · RecalcStyle事件=${rec.recalcEvents}(${recalcBrief(rec)}) · ` +
            `RecalcStyleCountΔ=${rec.recalcCount} · LayoutCountΔ=${rec.layoutCount} · ` +
            `重绘矩形=${rec.paintRects.length}(FAB归因=${edgeFabRects.length}) · 录屏帧=${rec.frames}`);
        await page.close();
    });
});
