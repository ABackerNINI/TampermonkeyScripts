'use strict';
/**
 * FAB 靠边模式仿真回归(2026.11.24, 计划 26-11-24-2226 §04 B1/B2/C1/C2/C3 + C4 八场景)
 * ------------------------------------------------------------------
 * 静态断言(check-ptac-fab-edge.js)钉住源码接线, 本用例在仿真站跑真实 Edge,
 * 验证用户可见行为:
 *
 *   B1/B2/C1(W3 基线):
 *   ① 靠边态几何: right:0 真贴右边缘/bottom:20, 4x120 竖线, 本体动画关停但辉光保留,
 *      角标数字存在但隐藏, 颜色仍随状态 class;
 *   ② 并集透明命中区(right:-20/width:72, 右锚点抵消展开内移): 竖线左侧的 ::before 外扩区域可被 elementFromPoint 命中;
 *   ③ hover/展开内移 20px 回 right:20px 恢复 52px 圆钮, 与完整 FAB 同位置,
 *      图标与角标恢复可见;
 *   ④ 点独立 edge 开关: .edge 与 GM ptac_edge 同步切换, 皮肤高亮不变(正交);
 *   ⑤ 跨站: B 站加载即读 ptac_edge=true 显示为竖线态.
 *
 *   C4(W4 状态机, §04 C4 验收八场景):
 *   ① 竖线态 -> hover 展开 -> 指针移出 -> 缩回竖线;
 *   ② hover 展开 -> 点开面板 -> 指针移出仍保持展开;
 *   ③ 关闭面板 + 指针移出 -> 缩回; 窗口失焦关面板后同样缩回;
 *   ④ 批量进行中(batchActive() 为真)指针移出不缩回, chip 定位独立;
 *   ⑤ 触屏点竖线先展开(不开面板)-> 再点才开面板;
 *   ⑥ 键盘焦点落入竖线 -> 展开, 且面板/chip 定位不随 fab 变形漂移.
 *
 *   fix2 C2/C3 闪烁根治: 指针判定改 document 捕获阶段 pointermove + elementFromPoint
 *   (host.contains 沿用面板自动关闭同款判定), 临界点连续 20 次左右移动不翻转;
 *   真离开并集才缩回; 并集区外页面坐标不命中宿主(不遮挡站点按钮); 无 setTimeout 时间锁.
 *
 * shadow 观测: FAB/面板挂在 closed shadow 下, 页面脚本拿不到元素;
 *   用 CDP DOM.pierce 穿透读取状态/几何, 并用 document.elementFromPoint 的
 *   shadow 命中重定向判定面板开合(测试基建特权, 生产代码零改动).
 *   异步一律用 page.waitFor / waitStore / 状态轮询, 不用裸 sleep 冒充轮询.
 */

const fs = require('fs');
const path = require('path');
const { withSim, todayStr } = require('../lib/sim/harness');
const { runCase, assert, assertEq, waitStore } = require('../lib/sim/tcase');

const A = 'http://www.tangpt.top';
const B = 'http://b.tangpt.top';
const UID = 'tangpt';
const SRC = path.join(__dirname, '..', '..', 'src', 'PTAutoCheckIn.user.js');
const SRC_TEXT = fs.readFileSync(SRC, 'utf8');
// 从源码取全部 unit id, 用于批量场景把除候选站外的站预置为已完成(批量只排一个站)
const ALL_UNIT_IDS = Array.from(new Set(
    (SRC_TEXT.match(/\bid:\s*'([a-zA-Z0-9_]+)'/g) || []).map((s) => s.match(/'([^']+)'/)[1])));

const HAS_UI = `return !!document.getElementById('ptac-root-v2');`;
// 面板开合: elementFromPoint 进入 shadow 后把命中结果重定向成宿主 #ptac-root-v2
const PANEL_HIT = `var el = document.elementFromPoint(Math.round(innerWidth - 60), Math.round(innerHeight - 104));
    return !!(el && el.id === 'ptac-root-v2');`;
const PANEL_MISS = `var el = document.elementFromPoint(Math.round(innerWidth - 60), Math.round(innerHeight - 104));
    return !(el && el.id === 'ptac-root-v2');`;

// 通过 CDP 穿透 closed shadow 解析任意元素的远程对象引用
async function resolveInShadow(sim, page, selector) {
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
        { nodeId: roots[0].nodeId, selector }, s);
    if (!el.nodeId) return null;
    const obj = await sim.cdp.send('DOM.resolveNode', { nodeId: el.nodeId }, s);
    return { sessionId: s, objectId: obj.object.objectId };
}
async function resolveFab(sim, page) { return resolveInShadow(sim, page, '.fab'); }

// 在 shadow 元素上执行一段函数(只读/记账), 返回 by-value 结果
async function callOn(sim, page, selector, fnDecl) {
    const ref = await resolveInShadow(sim, page, selector);
    if (!ref) return null;
    const r = await sim.cdp.send('Runtime.callFunctionOn', {
        objectId: ref.objectId, functionDeclaration: fnDecl, returnByValue: true
    }, ref.sessionId);
    return r && r.result ? r.result.value : null;
}

// 读 fab 的运行时几何 / 状态 / 可见性(open = C4 逻辑保持展开标记)
async function fabMetrics(sim, page) {
    const ref = await resolveFab(sim, page);
    if (!ref) return null;
    const r = await sim.cdp.send('Runtime.callFunctionOn', {
        objectId: ref.objectId,
        functionDeclaration: `function () {
            var b = this.getBoundingClientRect();
            var core = this.querySelector('.fab-core');
            var badge = this.querySelector('.fab-badge');
            return {
                w: b.width, h: b.height, left: b.left, top: b.top,
                right: innerWidth - b.right, bottom: innerHeight - b.bottom,
                cls: this.className,
                cssW: getComputedStyle(this).width,
                open: this.classList.contains('edge-open'),
                coreVis: core ? getComputedStyle(core).visibility : '',
                badgeVis: badge ? getComputedStyle(badge).visibility : '',
                badgeText: badge ? badge.textContent : '',
                anim: getComputedStyle(this).animationName,
                glowAnim: getComputedStyle(this, '::after').animationName,
                bg: getComputedStyle(this).backgroundImage
            };
        }`,
        returnByValue: true
    }, ref.sessionId);
    return r && r.result ? r.result.value : null;
}

const panelShown = (sim, page) => callOn(sim, page, '.panel',
    `function(){ return this.classList.contains('show'); }`);
const chipStyle = (sim, page) => callOn(sim, page, '.chip',
    `function(){ var s = getComputedStyle(this); return { right: s.right, bottom: s.bottom }; }`);
const panelBottom = (sim, page) => callOn(sim, page, '.panel',
    `function(){ return getComputedStyle(this).bottom; }`);

// 程序化点击独立 edge 开关, 读回皮肤高亮以验证正交
async function clickEdge(sim, page) {
    const ref = await resolveFab(sim, page);
    if (!ref) return null;
    const r = await sim.cdp.send('Runtime.callFunctionOn', {
        objectId: ref.objectId,
        functionDeclaration: `function () {
            var sr = this.getRootNode();
            var btn = sr.querySelector('.edge-btn');
            btn.click();
            var active = Array.prototype.slice.call(sr.querySelectorAll('.skin-btn'))
                .filter(function (b) { return b.classList.contains('active'); })
                .map(function (b) { return b.getAttribute('data-skin'); });
            return {
                cls: this.className,
                pressed: btn.getAttribute('aria-pressed'),
                label: btn.textContent,
                active: active
            };
        }`,
        returnByValue: true
    }, ref.sessionId);
    return r && r.result ? r.result.value : null;
}

async function hoverAt(sim, page, x, y) {
    await sim.cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved', x: Math.round(x), y: Math.round(y),
        button: 'none', buttons: 0
    }, page.sessionId);
}
async function clickAt(sim, page, x, y) {
    for (const type of ['mousePressed', 'mouseReleased']) {
        await sim.cdp.send('Input.dispatchMouseEvent',
            { type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 }, page.sessionId);
    }
}
const moveAway = (sim, page) => hoverAt(sim, page, 60, 60);

// 触屏两段式的输入模拟: 在 fab 上派发带 pointerType='touch' 的 pointerdown + click.
// composed:true 让 pointerdown 穿越 closed shadow 到达 document 的 C4 记账监听.
async function touchTapFab(sim, page) {
    return callOn(sim, page, '.fab', `function () {
        this.dispatchEvent(new PointerEvent('pointerdown',
            { pointerType: 'touch', bubbles: true, composed: true }));
        this.dispatchEvent(new PointerEvent('click',
            { pointerType: 'touch', bubbles: true, composed: true }));
        return true;
    }`);
}

function near(actual, expected, tol, label) {
    assert(Math.abs(actual - expected) <= tol,
        `${label} 应约 ${expected} (容差 ${tol}), 实际 ${actual}`);
}

// 状态轮询等宽度(0.18s 过渡), 不是裸 sleep
async function waitFabW(sim, page, expected, label) {
    const deadline = Date.now() + 6000;
    let m;
    while (Date.now() < deadline) {
        m = await fabMetrics(sim, page);
        if (m && Math.abs(m.w - expected) <= 1.2) {
            // 宽/高/right 走同一条 0.18s transition: 宽先达标时高可能仍在收尾,
            // 多等一帧再读, 避免取到中途态(展开高 53px)造成假失败.
            await new Promise((r) => setTimeout(r, 80));
            return await fabMetrics(sim, page);
        }
        await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`${label}: 等待 fab 宽度 ${expected} 超时, 最后 cls=${m && m.cls}, w=${m && m.w}, cssW=${m && m.cssW}`);
}
// 连续轮询确认"保持"宽度的稳定性(用于"移出仍展开"这类反向断言)
async function assertFabWStable(sim, page, expected, holdMs, label) {
    const deadline = Date.now() + holdMs;
    while (Date.now() < deadline) {
        const m = await fabMetrics(sim, page);
        assert(m && Math.abs(m.w - expected) <= 1.2,
            `${label}: 宽度应保持 ${expected}, 实际 ${m && m.w}`);
        await new Promise((r) => setTimeout(r, 100));
    }
}

// 靠边态开页(默认助手: 仅 tangpt 有成功记录, 不触发站点自动点击)
async function openEdgePage(sim) {
    sim.reset();
    sim.seed({
        ptac_edge: true,
        ptac_skin: 'chameleon',
        [K_status(UID)]: { date: todayStr(), status: 'success', msg: 'sim', ts: Date.now() }
    });
    const page = await sim.open(`${A}/?sim=already`, { waitMs: 1200 });
    await page.waitFor(HAS_UI, 20000, 'UI 注入');
    return page;
}
function K_status(uid) { return `ptac_status_${uid}`; }

// 批量场景开页: 除 pttime(置为已过冷却的未确认, 唯一候选)外全部成功 -> 批量仅一个站
async function openBatchPage(sim) {
    sim.reset();
    const seed = { ptac_edge: true, ptac_skin: 'chameleon' };
    for (const id of ALL_UNIT_IDS) {
        seed[K_status(id)] = { date: todayStr(), status: 'success', msg: 'sim', ts: Date.now() };
    }
    seed[K_status('pttime')] = {
        date: todayStr(), status: 'unconfirmed', msg: 'sim',
        ts: Date.now() - 30 * 60 * 1000
    };
    sim.seed(seed);
    const page = await sim.open(`${A}/?sim=already`, { waitMs: 1200 });
    await page.waitFor(HAS_UI, 20000, 'UI 注入');
    return page;
}

runCase('FAB 靠边: W3 基线 + C4 八场景状态机', async () => {
    await withSim(async (sim) => {
        // ==================== W3 基线(C1/C2/C3) ====================
        sim.reset();
        sim.seed({
            ptac_edge: true,
            ptac_skin: 'chameleon',
            [K_status(UID)]: { date: todayStr(), status: 'success', msg: 'sim', ts: Date.now() }
        });
        const page = await sim.open(`${A}/?sim=already`, { waitMs: 1500 });
        await page.waitFor(HAS_UI, 20000, 'UI 注入');

        const edge = await fabMetrics(sim, page);
        assert(edge, '应能穿透 shadow 读到 fab 几何');
        assert(/\bedge\b/.test(edge.cls), `靠边态 fab 应带 .edge 类, 实际 ${edge.cls}`);
        near(edge.w, 4, 0.6, '竖线宽');
        near(edge.h, 120, 0.6, '竖线高');
        near(edge.right, 0, 1, '竖线 right(真贴右边缘)');
        near(edge.bottom, 20, 1, '竖线 bottom');
        assertEq(edge.anim, 'none', '竖线态应禁掉 chameleonWave 本体形变');
        assert(edge.glowAnim && edge.glowAnim !== 'none', '竖线态辉光呼吸应保留(颜色跟随状态色)');
        assert(edge.bg.indexOf('gradient') >= 0, '竖线颜色应沿用状态 class 的渐变底');
        assertEq(edge.coreVis, 'hidden', '竖线态隐藏图标');
        assertEq(edge.badgeVis, 'hidden', '竖线态隐藏角标数字');
        assert(Number(edge.badgeText) > 0, '竖线态底层角标数字应仍存在(仅视觉隐藏)');

        const px = Math.round(edge.left - 16);
        const py = Math.round(edge.top + 100);
        assertEq(await page.eval(`var el = document.elementFromPoint(${px}, ${py});
            return !!(el && el.id === 'ptac-root-v2');`), true,
            `命中区探测点(${px},${py})应命中 UI 宿主(竖线+展开并集透明命中区)`);

        await hoverAt(sim, page, px, py);
        const expanded = await waitFabW(sim, page, 52, 'W3 hover 展开');
        near(expanded.h, 52, 1, '展开高');
        near(expanded.right, 20, 1, '展开 right(内移回完整 FAB 原视觉位置)');
        near(expanded.bottom, 20, 1, '展开 bottom(不跳位)');
        assert(/\bedge\b/.test(expanded.cls), '展开只是 hover 形变, .edge 类仍在');
        assertEq(expanded.coreVis, 'visible', '展开态恢复图标');
        assertEq(expanded.badgeVis, 'visible', '展开态恢复角标数字');

        const off = await clickEdge(sim, page);
        assert(off, '应能读到点击开关后的状态');
        assert(!/\bedge\b/.test(off.cls), `关闭靠边应移除 .edge 类, 实际 ${off.cls}`);
        assertEq(off.pressed, 'false', '关闭后 aria-pressed 应为 false');
        assertEq(off.label, '展开', '关闭后按钮文案应为展开');
        assertEq(off.active.join(','), 'chameleon', '切换靠边不应重置皮肤高亮');
        assertEq(sim.get('ptac_edge'), false, 'GM ptac_edge 应持久化为 false');

        const on = await clickEdge(sim, page);
        assert(on, '应能读到再次点击开关后的状态');
        assert(/\bedge\b/.test(on.cls), '再次开启应恢复 .edge 类');
        assertEq(on.pressed, 'true', '开启后 aria-pressed 应为 true');
        assertEq(on.label, '靠边', '开启后按钮文案应为靠边');
        assertEq(on.active.join(','), 'chameleon', '再次切换仍不动皮肤高亮');
        assertEq(sim.get('ptac_edge'), true, 'GM ptac_edge 应持久化为 true');
        await page.close();

        const pageB = await sim.open(`${B}/?sim=already`, { waitMs: 1500 });
        await pageB.waitFor(HAS_UI, 20000, 'B 站 UI 注入');
        const cross = await fabMetrics(sim, pageB);
        assert(cross, 'B 站应能读到 fab 几何');
        assert(/\bedge\b/.test(cross.cls),
            `B 站加载应直接是竖线态(ptac_edge 跨站), 实际 cls=${cross.cls}, GM=${JSON.stringify(sim.get('ptac_edge'))}, w=${cross.w}`);
        near(cross.w, 4, 0.6, 'B 站竖线宽');
        near(cross.h, 120, 0.6, 'B 站竖线高');
        await pageB.close();
        console.log('  W3 基线①-⑤ 通过');

        // ==================== C4 ① hover 展开 -> 移出缩回 ====================
        let p = await openEdgePage(sim);
        let m = await waitFabW(sim, p, 4, 'C4① 初始竖线');
        const hx = Math.round(m.left - 16);
        const hy = Math.round(m.top + 100);
        await hoverAt(sim, p, hx, hy);
        m = await waitFabW(sim, p, 52, 'C4① hover 展开');
        assertEq(m.open, false, '纯 hover 展开不应加 .edge-open 逻辑标记');
        await moveAway(sim, p);
        m = await waitFabW(sim, p, 4, 'C4① 指针移出缩回');
        assertEq(m.open, false, '缩回后无 .edge-open 残留');
        console.log('  C4① 竖线->hover 展开->移出缩回: PASS');
        await p.close();

        // ==================== C4 ② 点开面板 -> 移出仍保持展开 ====================
        p = await openEdgePage(sim);
        m = await waitFabW(sim, p, 4, 'C4② 初始竖线');
        const cx = Math.round(m.left - 16);
        const cy = Math.round(m.top + 100);
        await hoverAt(sim, p, cx, cy);
        await waitFabW(sim, p, 52, 'C4② hover 展开');
        await clickAt(sim, p, cx, cy);
        await p.waitFor(PANEL_HIT, 6000, 'C4② 点开面板');
        assertEq(await panelShown(sim, p), true, 'C4② 面板应处于 show 态');
        await moveAway(sim, p);
        await assertFabWStable(sim, p, 52, 600, 'C4② 面板打开期间移出仍保持展开');
        m = await fabMetrics(sim, p);
        assertEq(m.open, true, 'C4② 保持展开应带 .edge-open 标记');
        console.log('  C4② 面板打开+移出保持展开: PASS');

        // ==================== C4 ③ 关闭面板 + 移出缩回; 失焦关闭后缩回 ====================
        await clickAt(sim, p, 60, 60); // 点面板外 -> 既有失焦链 closePanel
        await p.waitFor(PANEL_MISS, 6000, 'C4③ 点外部关闭面板');
        assertEq(await panelShown(sim, p), false, 'C4③ 面板应已收起');
        m = await waitFabW(sim, p, 4, 'C4③ 关面板+移出缩回');
        assertEq(m.open, false, 'C4③ 缩回后无 .edge-open 残留');
        // 失焦通道: 重新开面板, 合成 window blur, 面板与 edge 都应收起
        await clickAt(sim, p, Math.round(m.left - 16), Math.round(m.top + 100));
        await p.waitFor(PANEL_HIT, 6000, 'C4③ 重新展开面板');
        await p.eval('window.dispatchEvent(new Event("blur")); return 1;');
        // headless 下合成 blur 不会真的移走焦点; 补一次 fab.blur() 模拟真实切窗时焦点离页
        await callOn(sim, p, '.fab', `function(){ this.blur(); return true; }`);
        await moveAway(sim, p); // 真实切窗时指针也不在命中区
        await p.waitFor(PANEL_MISS, 6000, 'C4③ 失焦关闭面板');
        m = await waitFabW(sim, p, 4, 'C4③ 失焦关面板后缩回');
        assertEq(m.open, false, 'C4③ 失焦关闭面板后不得继续保持展开');
        console.log('  C4③ 关面板缩回 + 失焦关面板后缩回: PASS');
        await p.close();

        // ==================== C4 ④ 批量进行中指针移出不缩回 ====================
        p = await openBatchPage(sim);
        // 通过 shadow 内 btn-primary 真实点击发起批量(armCancel -> batchActive 为真)
        const started = await callOn(sim, p, '.btn-primary', `function(){ this.click(); return true; }`);
        assertEq(started, true, 'C4④ 批量按钮应可点击');
        await waitStore(sim, 'ptac_task',
            (v) => v && Array.isArray(v.list) && v.list.length > 0,
            10000, 'C4④ 批量任务应创建');
        // 批量场景面板本就未开, 保持展开只可能来自 batchActive() 这条条件
        assertEq(await panelShown(sim, p), false, 'C4④ 批量场景面板应未打开');
        // 批量会开后台标签, headless 下原页的 width 过渡可能被节流 -> 测试内关掉过渡,
        // 让几何即时反映类名判定(不改生产代码, 只加速仿真收敛).
        await callOn(sim, p, '.fab', `function(){ this.style.transition='none'; return true; }`);
        // 触发一次鼠标离开, 让批量中的缩回判定实际跑过一遍
        m = await fabMetrics(sim, p);
        await hoverAt(sim, p, Math.round(m.left + m.w / 2), Math.round(m.top + m.h / 2));
        await moveAway(sim, p);
        await waitFabW(sim, p, 52, 'C4④ 批量强制展开');
        await assertFabWStable(sim, p, 52, 800, 'C4④ 批量中指针移出不缩回');
        m = await fabMetrics(sim, p);
        assertEq(m.open, true, 'C4④ 批量中应保持 .edge-open');
        // chip 定位独立于 fab 形变
        const chip = await chipStyle(sim, p);
        assertEq(chip.right, '84px', 'C4④ 批量中 chip right 不随 fab 变形');
        assertEq(chip.bottom, '30px', 'C4④ 批量中 chip bottom 不随 fab 变形');
        // 取消批量, 待 chip 隐藏后应能恢复缩回
        await callOn(sim, p, '.chip .cancel', `function(){ this.click(); return true; }`);
        const deadline = Date.now() + 12000;
        let chipGone = false;
        while (Date.now() < deadline) {
            chipGone = await callOn(sim, p, '.chip', `function(){ return !this.classList.contains('show'); }`);
            if (chipGone) break;
            await new Promise((r) => setTimeout(r, 150));
        }
        assertEq(chipGone, true, 'C4④ 取消批量后 chip 应隐藏(batchActive 结束)');
        // 不再额外进出命中区: 指针早已在区外, 面板也已关, 只能靠批量取消出口的重判缩回
        m = await waitFabW(sim, p, 4, 'C4④ 批量结束后恢复缩回');
        assertEq(m.open, false, 'C4④ 批量结束后不应残留 .edge-open');
        console.log('  C4④ 批量中不缩回 + chip 定位独立 + 结束后缩回: PASS');
        await p.close();

        // ==================== C4 ⑤ 触屏两段式 ====================
        p = await openEdgePage(sim);
        m = await waitFabW(sim, p, 4, 'C4⑤ 初始竖线');
        await touchTapFab(sim, p);
        m = await waitFabW(sim, p, 52, 'C4⑤ 触屏首段展开');
        assertEq(m.open, true, 'C4⑤ 触屏首段应加 .edge-open 逻辑展开');
        await p.waitFor(PANEL_MISS, 4000, 'C4⑤ 触屏首段不应开面板');
        assertEq(await panelShown(sim, p), false, 'C4⑤ 首次点竖线只展开不开面板');
        await touchTapFab(sim, p);
        await p.waitFor(PANEL_HIT, 6000, 'C4⑤ 触屏第二段开面板');
        assertEq(await panelShown(sim, p), true, 'C4⑤ 再点才打开面板');
        m = await fabMetrics(sim, p);
        assertEq(m.open, true, 'C4⑤ 面板打开期间保持展开');
        console.log('  C4⑤ 触屏首段只展开->再点开面板: PASS');
        await p.close();

        // ==================== C4 ⑥ 键盘焦点展开 + 定位不漂移 ====================
        p = await openEdgePage(sim);
        const chipV = await chipStyle(sim, p);
        const panelV = await panelBottom(sim, p);
        assertEq(chipV.right, '84px', 'C4⑥ 竖线态 chip right=84px');
        assertEq(chipV.bottom, '30px', 'C4⑥ 竖线态 chip bottom=30px');
        assertEq(panelV, '84px', 'C4⑥ 竖线态面板 bottom=84px');
        // 真断言: 读 closed shadow 的 activeElement, 而不是恒为 true 的函数返回值
        const focused = await callOn(sim, p, '.fab', `function(){
            this.focus();
            var sr = this.getRootNode();
            return sr.activeElement === this;
        }`);
        assertEq(focused, true, 'C4⑥ 焦点应真正落到 fab(shadowRoot.activeElement)');
        m = await waitFabW(sim, p, 52, 'C4⑥ 键盘焦点落入竖线展开');
        const chipE = await chipStyle(sim, p);
        const panelE = await panelBottom(sim, p);
        assertEq(chipE.right, '84px', 'C4⑥ 展开态 chip right 不漂移');
        assertEq(chipE.bottom, '30px', 'C4⑥ 展开态 chip bottom 不漂移');
        assertEq(panelE, '84px', 'C4⑥ 展开态面板 bottom 不漂移');
        // 焦点离开后(指针在外)应缩回
        await callOn(sim, p, '.fab', `function(){ this.blur(); return true; }`);
        m = await waitFabW(sim, p, 4, 'C4⑥ 焦点离开后缩回');
        console.log('  C4⑥ 键盘焦点展开 + 面板/chip 定位不漂移: PASS');
        await p.close();

        // ==================== C4 ⑦ 临界点连续 20 次左右移动不翻转(C2 验收) ====================
        // 计划 fix2 §04 C2: 指针判定改 pointermove + elementFromPoint(host.contains),
        // 命中区并集覆盖竖线与展开圆钮; 连续往返时 fab 宽度稳定在单一态, .edge-open 不反复增删.
        p = await openEdgePage(sim);
        m = await waitFabW(sim, p, 4, 'C4⑦ 初始竖线');
        const yHit = Math.round(m.top + 100);
        // C1 边界: 并集区外的页面坐标不应命中 UI 宿主(不遮挡站点按钮点击)
        assertEq(await p.eval(`var el = document.elementFromPoint(
            Math.round(innerWidth - 200), Math.round(innerHeight - 100));
            return !!(el && el.id === 'ptac-root-v2');`), false,
            'C1 并集区外页面坐标不命中 UI 宿主(不遮挡站点按钮)');
        // xInner: 竖线态并集命中区内, 展开后也落在 52px 圆钮内;
        // xOuter: 竖线态并集命中区之外, 但展开态圆钮本体之内(构成迟滞带, 不应翻转).
        const xInner = Math.round(m.left - 16);
        const xOuter = Math.round(m.left - 56);
        await hoverAt(sim, p, xInner, yHit);
        m = await waitFabW(sim, p, 52, 'C4⑦ 进入命中区展开');
        assertEq(m.open, false, 'C4⑦ 纯 hover 不应加 .edge-open');
        for (let i = 0; i < 20; i++) {
            await hoverAt(sim, p, xOuter, yHit);
            // 持续轮询 300ms(超过 0.18s 过渡), 防止"翻转还没开始就检查"的竞态假绿
            await assertFabWStable(sim, p, 52, 300, `C4⑦ 第 ${i + 1} 次外移仍展开`);
            m = await fabMetrics(sim, p);
            assertEq(m.open, false, `C4⑦ 第 ${i + 1} 次外移不应增删 .edge-open`);
            await hoverAt(sim, p, xInner, yHit);
            await assertFabWStable(sim, p, 52, 300, `C4⑦ 第 ${i + 1} 次内移仍展开`);
            m = await fabMetrics(sim, p);
            assertEq(m.open, false, `C4⑦ 第 ${i + 1} 次内移不应增删 .edge-open`);
        }
        await moveAway(sim, p);
        m = await waitFabW(sim, p, 4, 'C4⑦ 真正移出命中区后缩回');
        assertEq(m.open, false, 'C4⑦ 移出后无 .edge-open 残留');
        console.log('  C4⑦ 临界点连续 20 次左右移动不翻转: PASS');
        await p.close();

        // ==================== C4 ⑧ 键盘激活不被历史触屏指针误判 ====================
        // 修复 2 回归: 先在页面外部制造 touch pointerdown(旧实现会记成 lastPointerType='touch'),
        // 再派发无 pointerType 的 click(等价于 Enter/Space 激活), 必须直接开面板而非只展开.
        p = await openEdgePage(sim);
        m = await waitFabW(sim, p, 4, 'C4⑧ 初始竖线');
        await p.eval(`document.dispatchEvent(new PointerEvent('pointerdown',
            { pointerType: 'touch', bubbles: true })); return 1;`);
        await callOn(sim, p, '.fab', `function(){
            this.dispatchEvent(new PointerEvent('click', { bubbles: true, composed: true }));
            return true;
        }`);
        await p.waitFor(PANEL_HIT, 6000, 'C4⑧ 键盘激活应直接开面板');
        assertEq(await panelShown(sim, p), true,
            'C4⑧ 键盘激活必须直接开面板, 不得被历史触屏指针误判成首段');
        console.log('  C4⑧ 键盘激活直接开面板(不被历史触屏指针误判): PASS');
        await p.close();
    });
});
