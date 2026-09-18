'use strict';
/**
 * 主面板(主弹出 UI)交互 —— 真浏览器回归(2026.09.19.4)
 * ------------------------------------------------------------------
 * 静态校验器 check-ptac-panel.js 只能钉住"接线"(有没有 armAutoClose / 有没有 openPanel),
 * 证明不了它真的работает。本用例在仿真站里跑真实 Chrome, 实测四条用户可见行为:
 *
 *   ① 点面板外 → 面板收起(失焦自动关闭的主通道)
 *   ② 点 UI 自身 → 面板**不**收起(host.contains(e.target) 豁免)
 *   ③ window 失焦(切标签页) → 面板收起
 *   ④ 检测到「签到按钮重现」→ **不弹主面板**, 只有页面级横条 + 零点击
 *   ⑤ 中断恢复横幅(带操作钮)在用户点页面别处时**不**被收起(一次性入口不能丢)
 *
 * 怎么在不破坏 closed shadow 的前提下观测面板开合:
 *   面板挂在 closed shadow 下, 页面脚本与 CDP **都拿不到 panel 元素**(这正是 S05 那条安全
 *   约束的代价)。但命中测试能感知它: `elementFromPoint` 会进入 shadow 树, 并把结果**重定向**
 *   成宿主 `#ptac-root-v2`。于是"这个坐标最上层是不是 UI 宿主" = 面板是否覆盖该点 = 开合状态。
 *   探测点取面板右下角内侧(`innerWidth-60, innerHeight-104`): 面板 right:20/bottom:84 且
 *   宽 330 → 该点在面板内; FAB(52px, bottom:20)与芯片(bottom:30)都在它下方, toast
 *   `pointer-events:none` 不参与命中 → 面板收起时该点必然是页面自己的元素。
 */

const { withSim, todayStr } = require('../lib/sim/harness');
const { runCase, assert, assertEq, waitStore } = require('../lib/sim/tcase');

const A = 'http://www.tangpt.top';
const UID = 'tangpt';

// 面板是否处于展开态(命中测试 + shadow 重定向, 见文件头说明)
const PANEL_OPEN = `var el = document.elementFromPoint(Math.round(innerWidth - 60), Math.round(innerHeight - 104));
    return !!(el && el.id === 'ptac-root-v2');`;
const HAS_UI = `return !!document.getElementById('ptac-root-v2');`;
const HAS_ALERT_BAR = `return !!document.getElementById('ptac-alert-bar-root');`;

async function click(sim, page, x, y) {
    for (const type of ['mousePressed', 'mouseReleased']) {
        await sim.cdp.send('Input.dispatchMouseEvent',
            { type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 }, page.sessionId);
    }
}

async function viewport(page) {
    return page.eval('return { w: innerWidth, h: innerHeight };');
}

async function openSite(sim, scenario, waitMs) {
    const page = await sim.open(`${A}/?sim=${scenario}`, { waitMs: waitMs || 1200 });
    await page.waitFor(HAS_UI, 20000, 'UI 注入');
    return page;
}

runCase('主面板失焦自动关闭 + 重现不弹面板', async () => {
    await withSim(async (sim) => {
        // ---------- ①②③ 失焦自动关闭 ----------
        let page = await openSite(sim, 'already', 4000); // 已签页: 只检测不点击, 不干扰 UI 断言
        await waitStore(sim, `ptac_status_${UID}`, (v) => v && v.status === 'success', 20000, '已签页应直接判成功');
        const vp = await viewport(page);

        assertEq(await page.eval(PANEL_OPEN), false, '初始状态面板应是收起的');
        // ① 点 FAB(面板内, 不算失焦)→ 展开
        await click(sim, page, vp.w - 46, vp.h - 46);
        await sim.sleep(300);
        assertEq(await page.eval(PANEL_OPEN), true, '点 FAB 后面板应展开');

        // ② 点 UI 自身 → 不收起。真实点击会击中面板底部的「批量签到」(副作用太大), 而 shadow
        //    内部事件传播到 document 时 target 会被重定向成宿主 —— 直接在宿主上派发 mousedown
        //    与真实点击在处理函数眼里完全等价(target 都是 host), 且不会误触面板里的按钮。
        await page.eval(`document.getElementById('ptac-root-v2')
            .dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); return 1;`);
        await sim.sleep(200);
        assertEq(await page.eval(PANEL_OPEN), true, '点在 UI 自身不应收起面板(host.contains 豁免失效)');

        // ① 点面板外(页面左上角)→ 收起
        await click(sim, page, 60, 60);
        await sim.sleep(300);
        assertEq(await page.eval(PANEL_OPEN), false, '点面板外应自动收起(失焦自动关闭失效)');

        // ③ window 失焦(切标签页)→ 收起: 真实切换到另一个标签页
        await click(sim, page, vp.w - 46, vp.h - 46); // 重新展开
        await sim.sleep(300);
        assertEq(await page.eval(PANEL_OPEN), true, '再次点 FAB 应能展开');
        const other = await sim.newPage();
        await sim.cdp.send('Page.bringToFront', {}, other.sessionId);
        await sim.sleep(600);
        const closedByBlur = await page.eval(PANEL_OPEN);
        if (!closedByBlur) {
            // headless 下真实标签切换未必派发 blur(无窗口焦点)→ 退化为同源的 window blur 事件,
            // 断言"失焦这条通道本身通", 并在输出里说明用的是合成事件。
            await page.eval('window.dispatchEvent(new Event("blur")); return 1;');
            await sim.sleep(300);
            assertEq(await page.eval(PANEL_OPEN), false, 'window 失焦(blur)应自动收起面板');
            console.log('  实测: 切标签未派发 blur(headless 限制), 用 window blur 事件验证该通道');
        }
        await other.close();
        await page.close();

        // ---------- ④ 签到按钮重现: 不弹主面板 ----------
        sim.reset();
        sim.seed({ [`ptac_status_${UID}`]: { date: todayStr(), status: 'success', msg: '模拟昨日已签', ts: Date.now() } });
        page = await openSite(sim, 'index', 1500); // 首页按钮呈"可签" → 与 success 记录冲突 = 重现
        const st = await waitStore(sim, `ptac_status_${UID}`, (v) => v && v.status === 'suspect', 25000, '重现应降级为失败-待确认');
        assertEq(st.status, 'suspect', '重现未降级为 suspect');
        await page.waitFor(HAS_ALERT_BAR, 8000, '页面级重现横条应出现');
        assertEq(await page.eval(PANEL_OPEN), false, '检测到签到按钮重现时不应弹出主面板');
        assertEq(sim.requests({ host: 'www.tangpt.top', path: '/attendance.php' }).length, 0,
            '重现(失败-待确认)不得自动重签');
        console.log(`  实测: 重现 → 状态 ${st.status}(${st.msg || ''}) + 页面横条, 面板保持收起、零点击`);
        await page.close();

        // ---------- ⑤ 待决横幅豁免: 中断恢复入口不得被误关 ----------
        sim.reset();
        sim.seed({
            ptac_task: { taskId: 'tsim', list: [UID], index: 0, startedAt: Date.now() - 120000, hb: Date.now() - 60000 }
            // 心跳 60s 前: 已过期(>15s)但未 stale(<30min) → 应提供「恢复批量」横幅
        });
        page = await openSite(sim, 'already', 2500);
        await sim.sleep(800); // 等 offerBatchResume 弹面板
        assertEq(await page.eval(PANEL_OPEN), true, '中断恢复应弹出带横幅的面板');
        await click(sim, page, 60, 60); // 用户去点页面别处
        await sim.sleep(400);
        assertEq(await page.eval(PANEL_OPEN), true, '待决横幅(恢复批量)存在时, 点页面别处不应收起面板');
        console.log('  实测: 中断恢复横幅在外部点击后仍保留(一次性入口未被误关)');
        await page.close();
    });
});
