// ==UserScript==
// @name         PTAutoCheckIn
// @name:zh-CN   PT多站点自动签到
// @namespace    https://github.com/ABackerNINI/TampermonkeyScripts
// @version      2026.05.03.1
// @description  访问部分PT网站与百度贴吧时自动完成签到
// @author       ABacker
// @match        *://*.tangpt.top/*
// @match        *://*.pttime.org/*
// @match        *://*.bilibili.download/*
// @match        *://*.ptzone.xyz/*
// @match        *://*.ptsbao.club/*
// @match        *://*.hdclone.top/*
// @match        *://*.hdbao.cc/*
// @match        *://*.btschool.club/*
// @match        *://*.daxiangjiao.org/*
// @match        *://*.novahd.top/*
// @match        *://*.ptfans.cc/*
// @match        *://*.tieba.baidu.com/*
// @match        *://*.carpt.net/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_log
// @license      GNU GPL-3.0
// @tag          utilities
// ==/UserScript==

const ScriptName = '[PTAutoCheckIn]';
const MIN_INTERVAL = 10 * 60 * 1000; // 10 分钟（单位：毫秒）

(function () {
    'use strict';

    // ========== 配置区 ==========

    const CLICK_CHECK_IN = {
        type: 'click_checkin',
        description: '点击“签到”按钮',
        timeout: 5000
    };

    // 每个站点配置一个对象
    const SITES = [
        {
            name: '躺平',
            match: /^https:\/\/.*\.tangpt\.top/,
            checkInSelector: 'a.faqlink[href="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            name: 'PTTime',
            match: /^https:\/\/.*\.pttime\.org/,
            checkInSelector: 'a.fcb[href*="attendance.php"]',
            checkInContent: '签到领魔力',
            alreadyCheckedInContent: '签到详情',
            steps: [CLICK_CHECK_IN]
        },
        {
            name: 'Railgun',
            match: /^https?:\/\/bilibili\.download\//,
            checkInSelector: 'a.faqlink[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            name: 'PTZone',
            match: /^https?:\/\/ptzone\.xyz\//,
            checkInSelector: 'a.faqlink[href*="attendance.php"]',
            checkInContent: '[簽到得魔力]',
            alreadyCheckedInContent: '簽到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            name: 'PTSBao',
            match: /^https?:\/\/ptsbao\.club\//,
            checkInSelector: 'a.faqlink[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            name: 'HDClone',
            match: /^https?:\/\/pt\.hdclone\.top\//,
            checkInSelector: 'a.faqlink[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            name: 'BTSchool',
            match: /^https?:\/\/pt\.btschool\.club\//,
            checkInSelector: 'a[href*="index.php?action=addbonus"] > font',
            checkInContent: '每日签到',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            name: '大香蕉',
            match: /^https?:\/\/pt\.daxiangjiao\.org\//,
            checkInSelector: 'a.faqlink[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            name: 'NovaHD',
            match: /^https?:\/\/pt\.novahd\.top\//,
            checkInSelector: 'a.faqlink[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            name: 'PTFans',
            match: /^https?:\/\/ptfans\.cc\//,
            checkInSelector: 'a.faqlink[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            name: 'CarPT',
            match: /^https?:\/\/carpt\.net\//,
            checkInSelector: 'a.faqlink[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            name: '百度贴吧',
            match: /^https?:\/\/tieba\.baidu\.com\//,
            checkInSelector: '.button-wrapper.operate-btn.follow-sign',
            checkInContent: ' 签到 ',
            alreadyCheckedInContent: '连签',
            steps: [CLICK_CHECK_IN]
        },
        { // 点击签到后会进入一个新的页面，无法在同一页面完成签到，因此暂时注释掉
            name: 'HDBao',
            match: /^https?:\/\/hdbao\.cc\//,
            checkInSelector: 'a.faqlink[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [
                {
                    type: 'click',
                    ignoreError: true,
                    selector: 'input[type="submit"][value="立即签到"][class="btn"]',
                    description: '点击"立即签到"按钮',
                    timeout: 5000
                },
                {
                    type: 'wait',
                    ms: 2000,
                    description: '等待2秒, 确保签到请求完成'
                },
                {
                    type: 'click_checkin',
                    ignoreError: true,
                    description: '点击“签到”按钮',
                    timeout: 5000
                }
            ]
        },
    ];

    // ========== 工具函数 ==========

    function waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(selector);
            if (existing) return resolve(existing);

            const observer = new MutationObserver(() => {
                const el = document.querySelector(selector);
                if (el) {
                    observer.disconnect();
                    resolve(el);
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });

            const timer = setTimeout(() => {
                observer.disconnect();
                reject(new Error(`等待元素 "${selector}" 超时 (${timeout}ms)`));
            }, timeout);
            // 让 resolve 能清除定时器
            const origResolve = resolve;
            resolve = (value) => {
                clearTimeout(timer);
                origResolve(value);
            };
        });
    }

    /**
     * 执行单个步骤
     * @param {object} step  步骤配置
     * @returns {Promise<void>}
     */
    async function executeStep(site, step) {
        console.log(`${ScriptName} 执行步骤: ${step.description || step.type}`);
        switch (step.type) {
            case 'click_checkin': {
                const el = await waitForElement(site.checkInSelector, step.timeout || 5000);
                if (!el) {
                    console.warn(`${ScriptName} 未找到签到按钮: ${site.checkInSelector} (已签到?)`);
                    return;
                }
                if (site.alreadyCheckedInContent && el.textContent.includes(site.alreadyCheckedInContent)) {
                    console.log(`${ScriptName} 已签到: ${el.textContent}`);
                    return;
                }
                if (site.checkInContent && !el.textContent.includes(site.checkInContent)) {
                    console.warn(`${ScriptName} 签到按钮内容不匹配: expected ${site.checkInContent}, got ${el.textContent}`);
                    return;
                }
                console.log(`${ScriptName} 点击按钮: ${el.textContent}`);
                el.click();
                break;
            }
            case 'click': {
                const el = await waitForElement(step.selector, step.timeout || 5000);
                if (!el) {
                    console.warn(`${ScriptName} 按钮未找到: ${step.selector}`);
                    return;
                }
                console.log(`${ScriptName} 点击按钮: ${el.textContent}`);
                el.click();
                break;
            }
            case 'wait': {
                await new Promise(resolve => setTimeout(resolve, step.ms || 1000));
                break;
            }
            case 'check': {
                try {
                    await waitForElement(step.selector, step.timeout || 3000);
                    console.log(`${ScriptName} 检查通过: ${step.selector}`);
                } catch (e) {
                    console.warn(`${ScriptName} 检查未通过: ${e.message}`);
                }
                break;
            }
            case 'function': {
                await step.func();
                break;
            }
            default:
                console.warn(`${ScriptName} 未知步骤类型: ${step.type}`);
        }
    }

    // 执行站点签到流程
    async function runSiteCheckin(site) {
        const siteName = site.name;
        console.log(`${ScriptName} 开始处理站点: ${siteName}`);

        // 3. 执行签到步骤
        let success = true;

        try {
            for (const step of site.steps) {
                try {
                    await executeStep(site, step);
                } catch (error) {
                    if (!step.ignoreError) {
                        throw error;
                    }
                }
            }
        } catch (error) {
            console.error(`${ScriptName} ${siteName} 签到失败:`, error);
            success = false;
        }

        // 4. 如果全部执行完毕（没有抛出异常），认为签到成功，记录
        if (success) {
            console.log(`${ScriptName} ${siteName} 签到完成`);
        } else {
            console.warn(`${ScriptName} ${siteName} 签到未完成`);
        }
    }

    // 主入口
    async function autoCheckin() {
        const url = window.location.href;
        console.log(`${ScriptName} 当前页面 URL: ${url}`);
        let matchedSite = false;
        for (const site of SITES) {
            if (site.match.test(url)) {
                matchedSite = true;
                await runSiteCheckin(site);
            }
        }
        if (!matchedSite) {
            console.warn(`${ScriptName} 未匹配到任何站点规则`);
        }
    }

    function loadLastActivationTime() {
        const siteKey = window.location.origin + window.location.pathname;
        const storageKey = `lastActivation_${siteKey}`;
        return GM_getValue(storageKey, 0);
    }

    function saveLastActivationTime() {
        const siteKey = window.location.origin + window.location.pathname;
        const storageKey = `lastActivation_${siteKey}`;
        console.log(`${ScriptName} 保存上次激活时间: ${new Date().toLocaleString()}`);
        GM_setValue(storageKey, Date.now());
    }

    async function waitForFromLastActivation(interval) {
        console.log(`${ScriptName} 检查上次激活时间...`);

        let lastTime = loadLastActivationTime();

        console.log(`${ScriptName} 上次激活时间: ${lastTime > 0 ? new Date(lastTime).toLocaleString() : '从未激活过'}`);

        // ---------- 计算需要等待的时间 ----------
        const now = Date.now();
        const elapsed = now - lastTime;
        let waitTime = Math.max(0, interval - elapsed); // 剩余等待毫秒数

        if (waitTime > 0) {
            // 等待时间
            console.log(`${ScriptName} 已激活，请等待 ${waitTime / 1000} / ${interval / 1000} 秒...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            console.log(`${ScriptName} 等待完毕...`);
        }

        saveLastActivationTime();
    }

    async function main() {
        console.log(`${ScriptName} 启动签到脚本`);

        if (document.readyState === 'loading') {
            window.addEventListener('DOMContentLoaded', autoCheckin, { once: true });
        } else {
            autoCheckin();
        }
    }

    if (window.top !== window.self) return; // 若在 iframe 中则直接退出

    waitForFromLastActivation(MIN_INTERVAL).then(() => {
        main();
    });
})();
