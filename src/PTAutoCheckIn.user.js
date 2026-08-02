// ==UserScript==
// @name         PT多站点自动签到
// @namespace    https://github.com/ABackerNINI/TampermonkeyScripts
// @version      2026.05.03.1
// @description  访问网站时自动完成签到（支持多步骤、不同选择器）
// @author       ABacker
// @match        *://*.tangpt.top/*
// @grant        none
// @run-at       document-end
// @grant        GM_setValue
// @grant        GM_getValue
// @license      GNU GPL-3.0
// @tag          utilities
// ==/UserScript==

(function() {
    'use strict';

    // ========== 配置区 ==========
    // 每个站点配置一个对象
    const SITES = [
        // 示例1：论坛签到（单步）
        {
            name: '躺平',
            match: /^https:\/\/.*\.tangpt\.top\/.*/,
            alreadyCheckedInSelector: '.checked-in-today',   // 已签到标记
            steps: [
                {
                    type: 'click',
                    selector: 'a.faqlink[href="attendance.php"',            // 签到按钮选择器
                    description: '点击“签到”按钮',
                    timeout: 5000
                },
                {
                    type: 'wait',
                    ms: 2000
                },
                {
                    type: 'check',
                    selector: '.checkin-success',
                    description: '验证签到成功'
                }
            ]
        },
        // 示例2：资源站签到（两步）
        {
            name: '示例资源站',
            match: /^https?:\/\/www\.example2\.com\/.*/,
            alreadyCheckedInSelector: '.already-signed',
            steps: [
                {
                    type: 'click',
                    selector: 'button.qiandao-btn',
                    description: '点击“签到得魔力”'
                },
                {
                    type: 'wait',
                    ms: 1500
                },
                {
                    type: 'click',
                    selector: 'div.popup .confirm-btn',
                    description: '点击弹窗中的“确认签到”'
                },
                {
                    type: 'wait',
                    ms: 1000
                },
                {
                    type: 'check',
                    selector: '.toast-success',
                    description: '检查签到成功提示'
                }
            ]
        }
        // 继续添加更多……
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
    async function executeStep(step) {
        console.log(`[签到] 执行步骤: ${step.description || step.type}`);
        switch (step.type) {
            case 'click': {
                const el = await waitForElement(step.selector, step.timeout || 5000);
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

    // 获取今日日期字符串
    function getTodayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    // 检查某站点今天是否已签到（根据存储）
    function isTodayCheckedIn(siteName) {
        const key = `checkin_${siteName}`;
        const lastDate = GM_getValue(key, '');
        return lastDate === getTodayStr();
    }

    // 记录某站点今日签到成功
    function recordCheckinToday(siteName) {
        const key = `checkin_${siteName}`;
        GM_setValue(key, getTodayStr());
        console.log(`[签到] 已记录 ${siteName} 今日签到状态`);
    }

    // 执行站点签到流程
    async function runSiteCheckin(site) {
        const siteName = site.name;
        console.log(`[签到] 开始处理站点: ${siteName}`);

        // 1. 检查存储是否已签到
        if (isTodayCheckedIn(siteName)) {
            console.log(`[签到] ${siteName} 今日已签到（存储记录），跳过`);
            return;
        }

        // 2. 如果存在 alreadySignedSelector，也作为辅助判断（防止存储失效或手动签到）
        if (site.alreadySignedSelector) {
            const signedEl = document.querySelector(site.alreadySignedSelector);
            if (signedEl) {
                console.log(`[签到] ${siteName} 页面上已有已签到标记，跳过并更新存储`);
                recordCheckinToday(siteName); // 同步存储
                return;
            }
        }

        // 3. 执行签到步骤
        let success = true;
        for (const step of site.steps) {
            try {
                await executeStep(step);
            } catch (error) {
                console.error(`[签到] ${siteName} 签到失败:`, error);
                success = false;
                break;
            }
        }

        // 4. 如果全部执行完毕（没有抛出异常），认为签到成功，记录
        if (success) {
            recordCheckinToday(siteName);
            console.log(`[签到] ${siteName} 签到流程成功完成`);
        } else {
            console.warn(`[签到] ${siteName} 签到未完成，未记录今日状态`);
        }
    }

    // 主入口
    async function autoCheckin() {
        const url = window.location.href;
        for (const site of SITES) {
            if (site.match.test(url)) {
                await runSiteCheckin(site);
                break;
            }
        }
    }

    // 启动
    console.log('[签到] 启动签到脚本');
    if (document.readyState === 'complete') {
        autoCheckin();
    } else {
        window.addEventListener('load', autoCheckin);
    }
})();
