// ==UserScript==
// @name         Enhance Visited Links
// @name:zh-CN   已访问链接增强
// @namespace    https://github.com/ABackerNINI/TampermonkeyScripts
// @version      2026.08.01.1
// @description  增强已访问链接辨识度，使用中度亮度紫色，并增加点状下划线，适配明亮模式和暗黑模式。
// @author       ABacker
// @include      *
// @run-at       document-end
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    // 1. 定义样式
    const style = `
            /* 明亮模式 - 使用中度亮度紫色 */
            a:visited {
                color: #6a4dad !important;
            }

            /* 暗黑模式 - 使用稍高亮度紫色 */
            @media (prefers-color-scheme: dark) {
                a:visited {
                    color: #b380ff !important;
                }
            }
        `;

    // 2. 注入样式的函数
    function injectStyles() {
        // 为避免重复注入，可以先移除旧的 style 标签再添加新的
        const oldStyle = document.getElementById('my-visited-link-style');
        if (oldStyle) {
            oldStyle.remove();
        }
        GM_addStyle(style);
        // 给 style 标签加个 id 方便管理
        const newStyle = document.querySelector('style:last-child');
        if (newStyle) {
            newStyle.id = 'my-visited-link-style';
        }
    }

    function main() {
        // 3. 初次加载时注入
        injectStyles();

        // 4. 监听 URL 变化，在软导航后重新注入
        let lastUrl = location.href;

        // 4.1 使用 MutationObserver 监听页面主体的变化（最通用）
        const observer = new MutationObserver(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                // 延迟一点点执行，等待新内容加载
                setTimeout(injectStyles, 200);
            }
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // 4.2 降级方案：使用 setInterval 定时检查（作为保险）
        setInterval(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                setTimeout(injectStyles, 200);
            }
        }, 1000);
    }

    main();

})();
