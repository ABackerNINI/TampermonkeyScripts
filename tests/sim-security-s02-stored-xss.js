'use strict';
/**
 * S02 跨站存储型 XSS(A1)
 * ------------------------------------------------------------------
 * 攻击链: 站 A 的页面把恶意文本放进"签到按钮"文案 → 脚本抓取并写入 GM 存储
 *          (GM 存储脚本级共享、跨所有 @match 域可读) → 用户在**站 B** 打开面板时渲染。
 * 本用例先证明"恶意文本确实跨站进了存储"(通道打通), 再断言渲染未执行它。
 */

const { withSim, todayStr } = require('./sim/harness');
const { runCase, assert, waitStore } = require('./sim/tcase');

const A = 'http://www.tangpt.top';   // 站 A: 埋恶意文案
const B = 'http://www.pttime.org';   // 站 B: 受害者页面, 在此渲染面板
const UID = 'tangpt';

runCase('S02 跨站存储型 XSS(站 A 埋文本 → 站 B 面板渲染)', async () => {
    await withSim(async (sim) => {
        // 预置"今日已签", 使脚本走「按钮重现复核」分支, 把按钮文案写进 alert 存储
        sim.seed({
            [`ptac_status_${UID}`]: { date: todayStr(), status: 'success', msg: '预置已签', ts: Date.now() }
        });

        const pageA = await sim.open(`${A}/?sim=evil-xss-text`, { waitMs: 6000 });
        const alert = await waitStore(sim, `ptac_alert_${UID}`,
            (v) => v && v.date === todayStr() && v.btnText, 15000, '站 A 写入 alert.btnText');
        // 通道自检: 恶意文本确实进了存储, 否则这个用例等于没测
        assert(/<img\s+src=x\s+onerror=/i.test(alert.btnText), '恶意文本未进入 GM 存储, 用例无效: ' + JSON.stringify(alert.btnText));
        await pageA.close();

        // 站 B: 面板渲染(alert 常驻提醒条会显示 btnText)
        const pageB = await sim.open(`${B}/?sim=already`, { waitMs: 6000 });
        // 面板在 closed shadow 里, 宿主页面读不到内容 —— 但脚本与它同属一个 JS 上下文,
        // 若 innerHTML 里的载荷被执行, window.__pwned 一定会被赋值, 故这是有效的执行检测。
        const probe = await pageB.eval(`
            return {
                uiInjected: !!document.getElementById('ptac-root-v2'),
                pwned: window.__pwned,
                injectedImg: document.querySelectorAll('img[src="x"]').length
            };
        `);
        assert(probe.uiInjected, '站 B 未注入面板(用例前提不成立)');
        assert(probe.pwned === undefined, 'XSS 被执行: window.__pwned 已被赋值');
        assert(probe.injectedImg === 0, 'XSS 被执行: 文档里出现了注入的 <img> 元素');
        await pageB.close();
    });
});
