// ==UserScript==
// @name         PT多站点自动签到
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
// @match        *://*.tieba.baidu.com/*
// @run-at       document-end
// @grant        GM_getValue
// @grant        GM_setValue
// @license      GNU GPL-3.0
// @tag          utilities
// ==/UserScript==

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
            name: '百度贴吧',
            match: /^https?:\/\/tieba\.baidu\.com\//,
            checkInSelector: '.button-wrapper.operate-btn.follow-sign',
            checkInContent: ' 签到 ',
            alreadyCheckedInContent: '连签',
            steps: [CLICK_CHECK_IN]
        },
        // { // 点击签到后会进入一个新的页面，无法在同一页面完成签到，因此暂时注释掉
        //     name: 'HDBao',
        //     match: /^https?:\/\/hdbao\.cc\//,
        //     checkInSelector: 'a.faqlink[href*="attendance.php"]',
        //     checkInContent: '[签到得魔力]',
        //     alreadyCheckedInContent: '签到已得',
        //     steps: [CLICK_CHECK_IN]
        // },
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
        console.log(`[签到] 执行步骤: ${step.description || step.type}`);
        switch (step.type) {
            case 'click_checkin': {
                const el = await waitForElement(site.checkInSelector, step.timeout || 5000);
                if (!el) {
                    console.warn(`[签到] 未找到签到按钮: ${site.checkInSelector} (已签到?)`);
                    return;
                }
                if (site.alreadyCheckedInContent && el.textContent.includes(site.alreadyCheckedInContent)) {
                    console.log(`[签到] 已签到: ${el.textContent}`);
                    return;
                }
                if (site.checkInContent && !el.textContent.includes(site.checkInContent)) {
                    console.warn(`[签到] 签到按钮内容不匹配: expected ${site.checkInContent}, got ${el.textContent}`);
                    return;
                }
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
                    console.log(`[签到] 检查通过: ${step.selector}`);
                } catch (e) {
                    console.warn(`[签到] 检查未通过: ${e.message}`);
                }
                break;
            }
            case 'function': {
                await step.func();
                break;
            }
            default:
                console.warn(`[签到] 未知步骤类型: ${step.type}`);
        }
    }

    // 执行站点签到流程
    async function runSiteCheckin(site) {
        const siteName = site.name;
        console.log(`[签到] 开始处理站点: ${siteName}`);

        // 3. 执行签到步骤
        let success = true;
        for (const step of site.steps) {
            try {
                await executeStep(site, step);
            } catch (error) {
                console.error(`[签到] ${siteName} 签到失败:`, error);
                success = false;
                break;
            }
        }

        // 4. 如果全部执行完毕（没有抛出异常），认为签到成功，记录
        if (success) {
            console.log(`[签到] ${siteName} 签到完成`);
        } else {
            console.warn(`[签到] ${siteName} 签到未完成`);
        }
    }

    // 主入口
    async function autoCheckin() {
        const url = window.location.href;
        console.log(`[签到] 当前页面 URL: ${url}`);
        let matchedSite = false;
        for (const site of SITES) {
            if (site.match.test(url)) {
                matchedSite = true;
                await runSiteCheckin(site);
            }
        }
        if (!matchedSite) {
            console.warn('[签到] 未匹配到任何站点规则');
        }
    }

    if (window.top !== window.self) return; // 若在 iframe 中则直接退出

    // 启动
    console.log('[签到] 启动签到脚本');
    if (document.readyState === 'complete') {
        autoCheckin();
    } else {
        window.addEventListener('DOMContentLoaded', autoCheckin, { once: true });
    }
})();
