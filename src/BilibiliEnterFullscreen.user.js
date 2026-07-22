// ==UserScript==
// @name         Bilibili enter fullscreen
// @name:zh-CN   B站Enter键全屏
// @namespace    https://github.com/ABackerNINI/TampermonkeyScripts
// @version      2026.07.22.7
// @description  在B站视频页面自动网页全屏, 按<Enter>键切换全屏/退出全屏, 按<Shift+Enter>键切换网页全屏
// @author       ABacker
// @match        *.bilibili.com/video/*
// @match        *.bilibili.com/bangumi/*
// @icon         https://www.bilibili.com/favicon.ico
// @grant        none
// @run-at       document-body
// @license      GNU GPL-3.0
// @tag          utilities
// @tag          bilibili
// @tag          哔哩哔哩
// @tag          b站
// @tag          b站全屏快捷键
// @tag          b站网页全屏快捷键
// @downloadURL  https://gitee.com/ABacker/TampermonkeyScripts/blob/master/src/BilibiliEnterFullscreen.user.js
// @updateURL    https://gitee.com/ABacker/TampermonkeyScripts/blob/master/src/BilibiliEnterFullscreen.user.js
// @supportURL   https://github.com/ABackerNINI/TampermonkeyScripts/issues
// ==/UserScript==

// Github might be slow in China
// https://gitee.com/ABacker/TampermonkeyScripts/blob/master/src/BilibiliEnterFullscreen.user.js
// https://github.com/ABackerNINI/TampermonkeyScripts/blob/master/src/BilibiliEnterFullscreen.user.js

(function () {
    'use strict';

    /**
     * 自动网页全屏
     */
    window.onload = (function () {
        var maxTryCount = 10;
        var tryCount = 0;
        var webFullScreenTimer = setInterval(function () {
            tryCount++;
            console.log(`自动全屏尝试次数: ${tryCount}`);
            if (clickWebFullscreenButton() || tryCount >= maxTryCount) {
                clearInterval(webFullScreenTimer);
            }
        }, 1000);
    }
    )();

    /**
     * 尝试点击全屏按钮
     * 支持新版和旧版播放器的多种类名
     */
    function clickButton(selectors, buttonName) {
        for (let selector of selectors) {
            const button = document.querySelector(selector);
            if (button) {
                button.click();
                console.log(`[${buttonName}] 已点击按钮: ${selector}`);
                return true;
            } else {
                console.log(`[${buttonName}] 未找到按钮: ${selector}`);
            }
        }

        console.warn(`[${buttonName}] 未找到按钮: ${selectors.join(', ')}`);
        return false;
    }

    /**
     * 尝试点击全屏按钮
     */
    function clickFullscreenButton() {
        // 全屏按钮的多种可能类名，按优先级排列
        const selectors = [
            '.bpx-player-ctrl-btn.bpx-player-ctrl-full',
            '[aria-label="全屏"]'
        ];

        return clickButton(selectors, '全屏');
    }

    /**
     * 点击“网页全屏”按钮
     */
    function clickWebFullscreenButton() {
        const selectors = [
            '.bpx-player-ctrl-btn.bpx-player-ctrl-web',
            '[aria-label="网页全屏"]'
        ];

        return clickButton(selectors, '网页全屏');
    }

    /**
     * 键盘事件处理函数
     */
    function handleKeyDown(event) {
        // 检查是否按下了 Enter 键 (keyCode 13 或 key 'Enter')
        if (event.key === 'Enter' || event.keyCode === 13) {
            // 防止在输入框中误触
            const tagName = document.activeElement.tagName.toLowerCase();
            if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
                return;
            }

            // 检测Shift+Enter
            if (event.shiftKey && event.key === 'Enter') {
                // 阻止 Enter 键的默认行为（如表单提交等）
                event.preventDefault();

                clickWebFullscreenButton();
                return;
            }

            // 检测单独的Enter
            if (event.key === 'Enter') {
                // 阻止 Enter 键的默认行为（如表单提交等）
                event.preventDefault();

                clickFullscreenButton();
                return;
            }
        }
    }

    // 监听键盘按下事件
    document.addEventListener('keydown', handleKeyDown);

    console.log('[Enter全屏]脚本已加载，按<Enter>键切换全屏');
})();
