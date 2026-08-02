// ==UserScript==
// @name         多站点自动签到
// @namespace    https://github.com/ABackerNINI/TampermonkeyScripts
// @version      2026.05.03.1
// @description  访问网站时自动完成签到（支持多步骤、不同选择器）
// @author       ABacker
// @match        *://*/*
// @grant        none
// @run-at       document-end
// @license      GNU GPL-3.0
// @tag          utilities
// ==/UserScript==

(function() {
    'use strict';

    // ========== 配置区（按需修改） ==========
    // 每个站点配置一个对象，包含：
    //   - match       : 正则表达式，匹配当前URL
    //   - name        : 站点名称（仅用于日志）
    //   - steps       : 签到步骤数组，按顺序执行
    //   - alreadyCheckedInSelector : 可选，若页面上存在此元素则视为已签到，跳过流程
    const SITES = [
        // 示例1：论坛签到（单步）
        {
            name: '躺平',
            match: /^https?:\/\/*\.tangpt\.top\/.*/,
            alreadyCheckedInSelector: '.checked-in-today',   // 已签到标记
            steps: [
                {
                    type: 'click',
                    selector: 'a#faqlink',            // 签到按钮选择器
                    description: '点击“签到”按钮',
                    timeout: 5000                    // 等待元素出现的最长时间(ms)
                },
                {
                    type: 'wait',
                    ms: 2000                         // 等待签到反馈
                },
                {
                    type: 'check',
                    selector: '.checkin-success',     // 检查是否出现成功提示
                    description: '验证签到成功'
                }
            ]
        },
        // 示例2：资源站签到（两步：先点“签到得魔力”，再点弹窗中的“确认签到”）
        {
            name: '示例资源站',
            match: /^https?:\/\/www\.example2\.com\/.*/,
            alreadyCheckedInSelector: '.already-checked-in',
            steps: [
                {
                    type: 'click',
                    selector: 'button.checkin-btn',
                    description: '点击“签到得魔力”'
                },
                {
                    type: 'wait',
                    ms: 1500                         // 等待弹窗出现
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
        // 可根据需要继续添加更多站点……
    ];

    // ========== 核心函数 ==========

    /**
     * 等待指定选择器的元素出现在 DOM 中
     * @param {string} selector  CSS 选择器
     * @param {number} timeout   超时时间（毫秒）
     * @returns {Promise<Element>}
     */
    function waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(selector);
            if (existing) {
                return resolve(existing);
            }

            const observer = new MutationObserver(() => {
                const el = document.querySelector(selector);
                if (el) {
                    observer.disconnect();
                    resolve(el);
                }
            });
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            const timer = setTimeout(() => {
                observer.disconnect();
                reject(new Error(`等待元素 "${selector}" 超时 (${timeout}ms)`));
            }, timeout);
            // 让 resolve 能清除定时器
            const originalResolve = resolve;
            resolve = (value) => {
                clearTimeout(timer);
                originalResolve(value);
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

    /**
     * 执行一个站点的全部签到步骤
     * @param {object} site  站点配置
     * @returns {Promise<void>}
     */
    async function runSiteCheckIn(site) {
        console.log(`[签到] 开始处理站点: ${site.name}`);

        // 检查是否已经签到
        if (site.alreadyCheckedInSelector) {
            const checkedInEl = document.querySelector(site.alreadyCheckedInSelector);
            if (checkedInEl) {
                console.log(`[签到] ${site.name} 今日已签到，跳过`);
                return;
            }
        }

        // 依次执行步骤
        for (const step of site.steps) {
            try {
                await executeStep(step);
            } catch (error) {
                console.error(`[签到] ${site.name} 签到失败:`, error);
                // 若某步失败，可根据需求决定是否继续后续步骤
                // 这里选择中断流程
                break;
            }
        }
        console.log(`[签到] ${site.name} 签到流程结束`);
    }

    /**
     * 主入口：根据当前 URL 匹配站点并执行签到
     */
    async function autoCheckIn() {
        const url = window.location.href;
        for (const site of SITES) {
            if (site.match.test(url)) {
                await runSiteCheckIn(site);
                break; // 匹配到第一个就执行，之后退出
            }
        }
    }

    // ========== 启动 ==========
    if (document.readyState === 'complete') {
        autoCheckIn();
    } else {
        window.addEventListener('load', autoCheckIn);
    }
})();
