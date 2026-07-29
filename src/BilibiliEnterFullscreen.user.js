// ==UserScript==
// @name         Bilibili enter fullscreen
// @name:zh-CN   B站Enter键全屏
// @namespace    https://github.com/ABackerNINI/TampermonkeyScripts
// @version      2026.07.22.7
// @description  在B站视频页面自动网页全屏, 按<Enter>键切换全屏, 按<Shift+Enter>键切换网页全屏
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

const ScriptName = 'B站Enter键全屏';

(function () {
    'use strict';

    /**
     * 自动网页全屏
     */
    window.onload = (function () {
        const maxTryCount = 50;
        let tryCount = 0;
        let webFullScreenTimer = setInterval(function () {
            tryCount++;
            console.log(`[${ScriptName}] 自动全屏尝试次数: ${tryCount}`);
            if (clickWebFullscreenButton() || tryCount >= maxTryCount) {
                clearInterval(webFullScreenTimer);
            }
        }, 200);
    }
    )();

    /**
     * 尝试点击按钮, 支持多种选择器, 按优先级尝试点击, 返回是否成功点击
     */
    function clickButton(selectors, buttonName) {
        for (let selector of selectors) {
            const button = document.querySelector(selector);
            if (button) {
                button.click();
                console.log(`[${ScriptName}] 已点击按钮: ${buttonName}, selector=${selector}`);
                return true;
            } else {
                console.log(`[${ScriptName}] 未找到按钮: ${buttonName}, selector=${selector}`);
            }
        }

        console.warn(`[${ScriptName}] 未找到按钮: ${buttonName}, selectors=${selectors.join(', ')}`);
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
     * 让弹幕输入框及当前焦点元素失焦，防止全屏后弹幕输入框不自动隐藏
     */
    function blurActiveElement() {
        // 先让当前焦点元素失焦
        if (document.activeElement && document.activeElement !== document.body) {
            document.activeElement.blur();
        }
        // 特别针对弹幕输入框（多种可能的选择器）
        const dmSelectors = [
            '.bpx-player-dm-input',
            'input[class*="dm-input"]',
            'input[class*="danmaku"]',
            '[class*="danmaku"] input'
        ];
        for (let selector of dmSelectors) {
            const input = document.querySelector(selector);
            if (input) {
                input.blur();
                console.log(`[${ScriptName}] 已让弹幕输入框失焦: ${selector}`);
            } else {
                console.log(`[${ScriptName}] 未找到弹幕输入框: ${selector}`);
            }
        }
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

            // 阻止 Enter 键的默认行为和事件冒泡，防止焦点转移到弹幕输入框
            event.preventDefault();
            event.stopPropagation();

            if (event.shiftKey) {
                clickWebFullscreenButton();
            } else {
                clickFullscreenButton();
            }

            // 延迟失焦，确保在全屏切换完成后让弹幕输入框失焦
            setTimeout(blurActiveElement, 50);
        }
    }

    // 监听键盘按下事件
    document.addEventListener('keydown', handleKeyDown);

    console.log(`[${ScriptName}] 脚本已加载，按<Enter>键切换全屏, 按<Shift+Enter>键切换网页全屏`);
})();
