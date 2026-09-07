// ==UserScript==
// @name         PTAutoCheckIn-v2
// @name:zh-CN   PT多站点自动签到v2
// @namespace    https://github.com/ABackerNINI/TampermonkeyScripts
// @version      2026.09.07.2
// @description  访问PT网站与百度贴吧(多吧)时自动签到, 支持悬浮按钮一键批量签到与结果查看
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
// @match        *://*.pting.club/*
// @match        *://*.hdtime.org/*
// @match        *://*.hdfans.org/*
// @match        *://*.cyanbug.net/*
// @match        *://*.crabpt.vip/*
// @match        *://*.muxuege.org/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_log
// @license      GNU GPL-3.0
// @tag          utilities
// ==/UserScript==

const ScriptName = '[PTAutoCheckIn-v2]';
const MIN_INTERVAL = 10 * 60 * 1000;           // 单站触发最小间隔, 防止高频触发导致封号
const POST_CLICK_SETTLE = 800;                 // 点击后停留观察时长(ms), 判断是否发生页面跳转
const WAIT_TEXT_TIMEOUT = 3000;                // 成功文案轮询默认超时(ms)
const TASK_STALE_MS = 30 * 60 * 1000;          // 批量任务链条断连判定(ms), 超过视为中断并清理
const UNIT_TOTAL_TIMEOUT = 25 * 1000;          // 单个站点整流程总超时(ms), 防卡死
const DEFAULT_BATCH_DELAY_MS = 0;              // 默认站间缓冲(ms), 站点可自行配置覆盖

// 存储 key 前缀(GM 存储按脚本共享, 跨域可读, 满足"任意站点查看同一份状态")
const K = {
    status: (uid) => `ptac_status_${uid}`,     // {date:'YYYY-MM-DD', status:'success|failed|pending|skipped', msg, ts}
    cooldown: (uid) => `ptac_cooldown_${uid}`, // 上次触发时间戳(ms)
    task: 'ptac_task'                          // 批量任务 {taskId, list:[unitId...], index, startedAt}
};

(function () {
    'use strict';

    // ==================== 配置区 ====================
    // 通用步骤: 大部分简单站点仅需点击一次"签到"按钮
    const CLICK_CHECK_IN = {
        type: 'click_checkin',
        description: '点击"签到"按钮',
        timeout: 5000
    };

    // 站点配置:
    // - 单站 group: 顶层字段即单元字段(id/name/url/match/.../steps)
    // - 多单元 group: {id, name, units:[{id,name,url,match,...}]} (如百度贴吧多吧)
    // unit 字段说明:
    //   id: 稳定唯一标识(存储与批量任务均用它); name: 展示名
    //   url: 批量任务导航入口; attendanceUrl: 可选, 直达签到/结果页(引擎优先跳它)
    //   match: RegExp 或函数(传 location.href), 决定当前页面是否属于该 unit
    //   checkInSelector/checkInContent/alreadyCheckedInContent: 签到按钮定位与文案校验
    //     → 已签到检测以按钮文案为准, 每次访问页面都会检测, 不受 10 分钟冷却限制
    //       (冷却只限制"是否点击", 不限制"是否检测")
    //   alreadyCheck: 可选函数, 自定义"已签到"判定(返回 bool)
    //   alreadyPageCheck: 默认 false — 全部站点默认关闭整页文本检测(防页面其它区域误报);
    //     仅特殊站点显式置 true 才启用整页文本级"已签到"检测(如跳页型落地页无签到按钮的站)
    //   successDetect: 点击后成功检测列表(同页 AJAX 场景) [{type:'url'|'text'|'func', ...}], 任一命中即成功
    //   confirmManual: true 表示无可靠成功特征, 点击后记为 pending 待人工确认
    //   batchDelayMs: 批量模式本站处理完后、跳转下一站前的缓冲(ms)
    //   enabled: 是否参与批量签到
    //   steps: 步骤数组(click_checkin/click/wait/check/function), 缺省为 [CLICK_CHECK_IN]
    const SITES = [
        // ============ PT 站(单站 group) ============
        {
            id: 'tangpt', name: '躺平',
            url: 'https://www.tangpt.top/',
            match: /^https?:\/\/[^/]*\.tangpt\.top\//,
            checkInSelector: 'a.faqlink[href="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'pttime', name: 'PTTime',
            url: 'https://www.pttime.org/',
            match: /^https?:\/\/[^/]*\.pttime\.org\//,
            checkInSelector: 'a.fcb[href*="attendance.php"]',
            checkInContent: '签到领魔力',
            alreadyCheckedInContent: '签到详情',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'railgun', name: 'Railgun',
            url: 'https://www.bilibili.download/',
            match: /^https?:\/\/bilibili\.download\//,
            checkInSelector: 'a.faqlink[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'ptzone', name: 'PTZone',
            url: 'https://ptzone.xyz/',
            match: /^https?:\/\/ptzone\.xyz\//,
            checkInSelector: 'a.faqlink[href*="attendance.php"]',
            checkInContent: '[簽到得魔力]',
            alreadyCheckedInContent: '簽到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'ptsbao', name: 'PTSBao',
            url: 'https://www.ptsbao.club/',
            match: /^https?:\/\/ptsbao\.club\//,
            checkInSelector: 'a.faqlink[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'hdclone', name: 'HDClone',
            url: 'https://www.pt.hdclone.top/',
            match: /^https?:\/\/pt\.hdclone\.top\//,
            checkInSelector: 'a.faqlink[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'btschool', name: 'BTSchool',
            url: 'https://www.pt.btschool.club/',
            match: /^https?:\/\/pt\.btschool\.club\//,
            checkInSelector: 'a[href*="index.php?action=addbonus"] > font',
            checkInContent: '每日签到',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'daxiangjiao', name: '大香蕉',
            url: 'https://www.pt.daxiangjiao.org/',
            match: /^https?:\/\/pt\.daxiangjiao\.org\//,
            checkInSelector: 'a.faqlink[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'novahd', name: 'NovaHD',
            url: 'https://www.pt.novahd.top/',
            match: /^https?:\/\/pt\.novahd\.top\//,
            checkInSelector: 'a.faqlink[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'ptfans', name: 'PTFans',
            url: 'https://www.ptfans.cc/',
            match: /^https?:\/\/ptfans\.cc\//,
            checkInSelector: 'a.faqlink[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'carpt', name: 'CarPT',
            url: 'https://www.carpt.net/',
            match: /^https?:\/\/carpt\.net\//,
            checkInSelector: 'a.faqlink[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'hdtime', name: 'HDTime',
            url: 'https://www.hdtime.org/',
            match: /^https?:\/\/hdtime\.org\//,
            checkInSelector: 'a.faqlink[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'hdfans', name: 'HDFans',
            url: 'https://www.hdfans.org/',
            match: /^https?:\/\/hdfans\.org\//,
            checkInSelector: 'a.faqlink[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'crabpt', name: 'CrabPT',
            url: 'https://www.crabpt.vip/',
            match: /^https?:\/\/crabpt\.vip\//,
            checkInSelector: 'a.faqlink[href*="attendance.php"]',
            checkInContent: '[签到得蟹币]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'cyanbug', name: 'Cyanbug',
            url: 'https://www.cyanbug.net/',
            match: /^https?:\/\/cyanbug\.net\//,
            checkInSelector: 'a.nav-btn[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        { // 点击"立即签到"提交表单后页面刷新显示结果, 需整页级已签检测
            id: 'hdbao', name: 'HDBao',
            url: 'https://www.hdbao.cc/',
            attendanceUrl: 'https://hdbao.cc/attendance.php',
            match: /^https?:\/\/hdbao\.cc\//,
            checkInSelector: 'a.faqlink[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            alreadyPageCheck: true,
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
                    ms: 1500,
                    description: '等待1.5秒, 确保签到请求完成'
                },
                {
                    type: 'click_checkin',
                    ignoreError: true,
                    description: '点击"签到"按钮',
                    timeout: 5000
                }
            ]
        },
        { // 同上: 跳页型站点
            id: 'muxuege', name: 'MuXueGe',
            url: 'https://www.pt.muxuege.org/',
            attendanceUrl: 'https://pt.muxuege.org/attendance.php',
            match: /^https?:\/\/pt\.muxuege\.org\//,
            checkInSelector: 'a.faqlink[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            alreadyPageCheck: true,
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
                    ms: 1500,
                    description: '等待1.5秒, 确保签到请求完成'
                },
                {
                    type: 'click_checkin',
                    ignoreError: true,
                    description: '点击"签到"按钮',
                    timeout: 5000
                }
            ]
        },
        { // 对话框式签到, 无可靠的成功特征, 点击后记为 pending 待人工确认(实测校准项)
            id: 'pting', name: '蜂巢',
            url: 'https://www.pting.club/',
            match: /^https?:\/\/pting\.club\//,
            confirmManual: true,
            steps: [
                {
                    type: 'wait',
                    ms: 5000, // 网站限制, 实测 3 秒不够
                    description: '等待5秒'
                },
                {
                    type: 'click',
                    selector: () => { // 外层"签到"按钮
                        const btns = document.querySelectorAll('button:has(> svg):not([title])');
                        for (const btn of btns) {
                            const text = btn.textContent;
                            if (text && text.includes('签到') && !text.includes('已') && text.length < 4) {
                                return btn;
                            }
                        }
                        return null;
                    },
                    description: '点击外层"签到"按钮',
                    timeout: 5000
                },
                {
                    type: 'wait',
                    ms: 1000,
                    description: '等待1秒'
                },
                {
                    type: 'click',
                    selector: () => { // 对话框"签到"按钮
                        const btns = document.querySelectorAll('span > button[data-slot="button"][type="button"]:not([title])');
                        for (const btn of btns) {
                            if (btn.textContent && btn.textContent.includes('签到') && btn.textContent.length < 4) {
                                return btn;
                            }
                        }
                        return null;
                    },
                    description: '点击对话框"签到"按钮',
                    timeout: 5000
                },
                {
                    type: 'wait',
                    ms: 1000,
                    description: '等待1秒'
                },
                {
                    type: 'click',
                    selector: () => { // 对话框"关闭"按钮
                        const btns = document.querySelectorAll('div > button[data-slot="dialog-close"][type="button"]:not([title])');
                        for (const btn of btns) {
                            if (btn.textContent === '关闭') {
                                return btn;
                            }
                        }
                        return null;
                    },
                    description: '点击对话框"关闭"按钮',
                    timeout: 5000
                }
            ]
        },

        // ============ 百度贴吧(多吧 group: 每个吧是独立签到单元) ============
        {
            id: 'tieba', name: '百度贴吧',
            units: [
                {
                    id: 'tieba_pt', name: 'pt吧',
                    url: 'https://www.tieba.baidu.com/f?kw=pt',
                    match: (href) => { // 按 URL 参数 kw 判定所属吧, 比正则更可靠
                        try { return new URL(href).searchParams.get('kw') === 'pt'; }
                        catch (e) { return false; }
                    },
                    checkInSelector: '.button-wrapper.operate-btn.follow-sign',
                    checkInContent: '签到',
                    alreadyCheckedInContent: '连签', // 待实测校准: 已签后按钮可能显示"已签/连签"
                    successDetect: [
                        { type: 'text', selector: 'body', text: '签到成功', timeout: 3000 } // 待实测校准
                    ],
                    batchDelayMs: 3000, // 吧间缓冲, 防贴吧风控
                    steps: [CLICK_CHECK_IN]
                },
                {
                    id: 'tieba_hdsky', name: 'hdsky吧',
                    url: 'https://www.tieba.baidu.com/f?kw=hdsky',
                    match: (href) => {
                        try { return new URL(href).searchParams.get('kw') === 'hdsky'; }
                        catch (e) { return false; }
                    },
                    checkInSelector: '.button-wrapper.operate-btn.follow-sign',
                    checkInContent: '签到',
                    alreadyCheckedInContent: '连签',
                    successDetect: [
                        { type: 'text', selector: 'body', text: '签到成功', timeout: 3000 }
                    ],
                    batchDelayMs: 3000,
                    steps: [CLICK_CHECK_IN]
                }
                // 新增吧: 复制一条, 修改 id/name/url 与 kw 即可, 无需改引擎
            ]
        }
    ];

    // ==================== 运行时派生配置 ====================

    // 把配置拍平为 group + unit 两级结构
    const GROUPS = SITES.map((s) => (s.units ? s : Object.assign({}, s, { units: [s] })));
    const UNITS = [];
    for (const g of GROUPS) {
        for (const u of g.units) {
            UNITS.push(Object.assign({}, u, { groupId: g.id, groupName: g.name }));
        }
    }
    const UNIT_MAP = new Map(UNITS.map((u) => [u.id, u]));

    // 判断当前页面是否属于某 unit
    function matchUnit(unit, href) {
        try {
            return typeof unit.match === 'function' ? !!unit.match(href) : unit.match.test(href);
        } catch (e) {
            console.warn(`${ScriptName} match 判定异常: ${unit.id}`, e);
            return false;
        }
    }

    // 获取某 unit 的批量导航目标地址(attendanceUrl 优先, 可直达签到/结果页)
    function targetUrlOf(unit) {
        return unit.attendanceUrl || unit.url;
    }

    // ==================== 工具函数 ====================

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // 等待元素出现(支持字符串/函数选择器), 超时 reject
    function waitForElement(selector, timeout = 5000) {
        const isFunction = typeof selector === 'function';
        return new Promise((resolve, reject) => {
            const check = () => (isFunction ? selector() : document.querySelector(selector));
            const found = check();
            if (found) return resolve(found);
            if (document.body == null) {
                // body 尚不存在(理论上 DOMContentLoaded 后不会发生, 防御)
                return reject(new Error(`等待元素 "${selector}" 失败: body 不存在`));
            }
            const observer = new MutationObserver(() => {
                const el = check();
                if (el) {
                    observer.disconnect();
                    clearTimeout(timer);
                    resolve(el);
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
            const timer = setTimeout(() => {
                observer.disconnect();
                reject(new Error(`等待元素 "${selector}" 超时 (${timeout}ms)`));
            }, timeout);
        });
    }

    // 轮询等待谓词为真(用于成功文案等动态内容检测)
    async function waitForTrue(predicate, timeout = WAIT_TEXT_TIMEOUT, interval = 200, label = '条件') {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const result = predicate();
            if (result) return result;
            await sleep(interval);
        }
        throw new Error(`等待${label}超时 (${timeout}ms)`);
    }

    // 取元素可见文本(优先 innerText, 避免命中隐藏模板文本)
    function visibleText(el) {
        if (!el) return '';
        if (typeof el.innerText === 'string') return el.innerText;
        return el.textContent || '';
    }

    // ==================== 存储与状态层 ====================
    // GM 存储按脚本共享、跨域可读: 状态/任务在任何匹配站点页面均可见

    function gmGet(key, fallback) {
        try { return GM_getValue(key, fallback); } catch (e) { return fallback; }
    }
    function gmSet(key, value) {
        try { GM_setValue(key, value); } catch (e) { console.error(`${ScriptName} GM_setValue 失败:`, e); }
    }

    // ---------- 当日日期 ----------
    function todayStr() {
        const d = new Date();
        const p = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }
    function formatTime(ts) {
        const d = new Date(ts);
        const p = (n) => String(n).padStart(2, '0');
        return `${p(d.getHours())}:${p(d.getMinutes())}`;
    }

    // ---------- 单站状态(当日结果) ----------
    function readStatus(unitId) {
        return gmGet(K.status(unitId), null);
    }
    function writeStatus(unitId, status, msg) {
        gmSet(K.status(unitId), { date: todayStr(), status, msg, ts: Date.now() });
    }
    function isSuccessToday(unitId) {
        const st = readStatus(unitId);
        return !!(st && st.status === 'success' && st.date === todayStr());
    }
    // 今日成功数 / 总数(面板汇总用)
    function countToday() {
        let success = 0;
        for (const u of UNITS) if (isSuccessToday(u.id)) success += 1;
        return { success, total: UNITS.length };
    }

    // ---------- 冷却(防高频触发) ----------
    function readCooldown(unitId) {
        return gmGet(K.cooldown(unitId), 0);
    }
    function writeCooldown(unitId) {
        gmSet(K.cooldown(unitId), Date.now());
    }
    function cooldownRemainMs(unitId) {
        const elapsed = Date.now() - readCooldown(unitId);
        return Math.max(0, MIN_INTERVAL - elapsed);
    }

    // ---------- 批量任务 ----------
    function loadTask() {
        return gmGet(K.task, null);
    }
    function saveTask(task) {
        gmSet(K.task, task);
    }
    function clearTask() {
        gmSet(K.task, null);
    }
    function isTaskStale(task) {
        return Date.now() - (task && task.startedAt || 0) > TASK_STALE_MS;
    }
    function readTaskIdFromUrl() {
        try { return new URL(location.href).searchParams.get('ptacTask'); }
        catch (e) { return null; }
    }
    function appendQuery(url, key, value) {
        const sep = url.includes('?') ? '&' : '?';
        return `${url}${sep}${key}=${encodeURIComponent(value)}`;
    }
    function buildTaskUrl(unit, taskId) {
        return appendQuery(targetUrlOf(unit), 'ptacTask', taskId);
    }

    // ==================== 步骤执行引擎 ====================

    /**
     * 执行单个步骤, 返回标记:
     *   undefined           正常继续
     *   {alreadyHit: true}  检测到已签到(不再点击, 全流程视为成功)
     */
    async function executeStep(unit, step) {
        console.log(`${ScriptName} 执行步骤: ${step.description || step.type}`);
        switch (step.type) {
            case 'click_checkin': {
                const el = await waitForElement(unit.checkInSelector, step.timeout || 5000);
                if (!el) {
                    console.warn(`${ScriptName} 未找到签到按钮: ${unit.checkInSelector} (已签到?)`);
                    return;
                }
                if (unit.alreadyCheckedInContent && visibleText(el).includes(unit.alreadyCheckedInContent)) {
                    console.log(`${ScriptName} 按钮已显示已签到状态, 不再点击`);
                    return { alreadyHit: true };
                }
                if (unit.checkInContent && !visibleText(el).includes(unit.checkInContent)) {
                    console.warn(`${ScriptName} 签到按钮内容不匹配: expected ${unit.checkInContent}, got ${visibleText(el)}`);
                    return;
                }
                console.log(`${ScriptName} 点击按钮: ${visibleText(el).trim()}`);
                el.click();
                break;
            }
            case 'click': {
                const el = await waitForElement(step.selector, step.timeout || 5000);
                if (!el) {
                    console.warn(`${ScriptName} 按钮未找到: ${step.selector}`);
                    return;
                }
                console.log(`${ScriptName} 点击按钮: ${visibleText(el).trim() || step.selector}`);
                el.click();
                break;
            }
            case 'wait': {
                await sleep(step.ms || 1000);
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

    // 依序执行全部步骤, 任一非 ignoreError 步骤失败向上抛出
    async function executeSteps(unit) {
        const steps = unit.steps || [CLICK_CHECK_IN];
        let alreadyHit = false;
        for (const step of steps) {
            try {
                const marker = await executeStep(unit, step);
                if (marker && marker.alreadyHit) alreadyHit = true;
            } catch (e) {
                if (!step.ignoreError) throw e;
            }
        }
        return { alreadyHit };
    }

    // ==================== 已签到检测 ====================
    // 主通道: 签到按钮文案(精准, 默认)。整页文本检测默认关闭(误报风险), 仅显式
    // alreadyPageCheck: true 的站启用。检测不依赖冷却状态 —— 每次访问页面都会执行,
    // 冷却只限制"是否点击签到", 不限制"是否检测已签状态"。
    async function detectAlreadyCheckedIn(unit) {
        // 1) 自定义判定
        if (unit.alreadyCheck) {
            try {
                if (await unit.alreadyCheck()) return { hit: true, source: '自定义判定' };
            } catch (e) { /* 忽略 */ }
        }
        // 2) 按钮文本判定(落地页/首页按钮显示已签文案即命中)
        if (unit.checkInSelector && unit.alreadyCheckedInContent) {
            const el = document.querySelector(unit.checkInSelector);
            if (el && visibleText(el).includes(unit.alreadyCheckedInContent)) {
                return { hit: true, source: `按钮文案(${visibleText(el).trim()})` };
            }
        }
        // 3) 整页文本判定 — 仅显式开启的站(如跳页型落地页无签到按钮的 HDBao/MuXueGe)
        if (unit.alreadyPageCheck && unit.alreadyCheckedInContent) {
            const body = document.body;
            if (body && visibleText(body).includes(unit.alreadyCheckedInContent)) {
                return { hit: true, source: '页面文案' };
            }
        }
        return { hit: false };
    }

    // ==================== 成功检测(点击后) ====================
    // 返回 true/false; 仅当页面未发生跳转(同页 AJAX/SPA)时才有意义
    async function detectSuccess(unit) {
        // 1) 配置的 successDetect 列表
        if (unit.successDetect) {
            for (const d of unit.successDetect) {
                try {
                    let hit = false;
                    if (d.type === 'url') {
                        hit = (d.pattern instanceof RegExp)
                            ? d.pattern.test(location.href)
                            : location.href.includes(d.pattern);
                    } else if (d.type === 'text') {
                        await waitForTrue(() => {
                            const scope = d.selector ? document.querySelector(d.selector) : document.body;
                            return scope && visibleText(scope).includes(d.text) ? true : null;
                        }, d.timeout || WAIT_TEXT_TIMEOUT, 200, `成功文案(${d.text})`);
                        hit = true;
                    } else if (d.type === 'func') {
                        hit = !!(await d.fn());
                    }
                    if (hit) {
                        console.log(`${ScriptName} 成功检测命中: type=${d.type}`);
                        return true;
                    }
                } catch (e) {
                    console.log(`${ScriptName} 成功检测未命中(${d.type}): ${e.message}`);
                }
            }
        }
        // 2) 回退: 点击后按钮文案变为"已签到"(同页 AJAX 刷新型站点)
        if (unit.checkInSelector && unit.alreadyCheckedInContent) {
            try {
                await waitForTrue(() => {
                    const el = document.querySelector(unit.checkInSelector);
                    return el && visibleText(el).includes(unit.alreadyCheckedInContent) ? true : null;
                }, 2500, 200, '按钮变为已签到');
                console.log(`${ScriptName} 成功检测回退命中: 按钮已变已签到`);
                return true;
            } catch (e) { /* 未命中 */ }
        }
        return false;
    }

    // ==================== 单 unit 签到主流程 ====================
    /**
     * 返回结果 {status, msg, reason}
     * status: success | failed | pending | skipped
     */
    async function runUnit(unit, ctx = {}) {
        const log = (msg) => console.log(`${ScriptName} [${unit.name}] ${msg}`);
        const warn = (msg) => console.warn(`${ScriptName} [${unit.name}] ${msg}`);

        // 1) 当日已签到成功 → 跳过(今日不再检测/点击)
        if (isSuccessToday(unit.id)) {
            log('今日已签到成功, 跳过');
            return { status: 'skipped', msg: '今日已签到成功', reason: 'done_today' };
        }

        // 2) 已签到检测 —— 每次访问都执行, 不受冷却限制(检测 ≠ 点击, 无封号风险)
        //    命中(按钮文案/整页文案)即得当日结果 success
        try {
            const already = await detectAlreadyCheckedIn(unit);
            if (already.hit) {
                writeStatus(unit.id, 'success', `检测到已签到(${already.source})`);
                log(`检测到已签到: ${already.source}`);
                return { status: 'success', msg: '检测到已签到', reason: 'already' };
            }
        } catch (e) {
            warn(`已签到检测异常: ${e.message}`);
        }

        // 3) 上次点击后落盘 pending 且未过冷却、且第 2 步仍检测不到已签
        //    → 说明上次点击确实未生效/无法确认, 记为失败(避免永久挂起)
        const prev = readStatus(unit.id);
        if (prev && prev.status === 'pending' && prev.date === todayStr()
            && Date.now() - prev.ts < MIN_INTERVAL) {
            writeStatus(unit.id, 'failed', '上次签到尝试未确认生效');
            log('上次签到尝试(pending)未确认, 记录为失败');
            return { status: 'failed', msg: '上次签到未确认', reason: 'pending_stale' };
        }

        // 4) 冷却中 → 跳过点击(检测已在第 2 步完成; 冷却只防高频点击)
        const remain = cooldownRemainMs(unit.id);
        if (remain > 0) {
            log(`冷却中, 剩余 ${Math.ceil(remain / 1000)} 秒, 跳过本次触发`);
            return { status: 'skipped', msg: `冷却中(${Math.ceil(remain / 1000)}s)`, reason: 'cooldown' };
        }

        // 5) 执行签到步骤
        //    点击前先写冷却: 即使点击触发整页跳转(本页被销毁), 冷却也已落盘,
        //    落地页 10 分钟内不会重复点击, 从根本上防止高频
        writeCooldown(unit.id);
        log('开始执行签到步骤');
        let navigated = false;
        const onPageHide = () => { navigated = true; };
        window.addEventListener('pagehide', onPageHide, { once: true });

        try {
            const { alreadyHit } = await executeSteps(unit);
            if (alreadyHit) {
                writeStatus(unit.id, 'success', '步骤中检测到已签到');
                log('步骤中检测到已签到, 记为成功');
                return { status: 'success', msg: '检测到已签到', reason: 'already' };
            }
        } catch (e) {
            warn(`签到步骤执行失败: ${e.message}`);
            writeStatus(unit.id, 'failed', `步骤失败: ${e.message.slice(0, 60)}`);
            return { status: 'failed', msg: e.message.slice(0, 60), reason: 'step_error' };
        }

        // 6) 点击后确认: 先落盘 pending(防跳页丢状态), 再同页检测
        writeStatus(unit.id, 'pending', '已点击签到, 等待结果确认');
        await sleep(POST_CLICK_SETTLE);

        if (navigated) {
            // 页面正在/已经跳转: 状态保持 pending, 由落地页判定(已签 → success, 未签 → failed)
            log('点击后发生页面跳转, 状态待落地页确认');
            return { status: 'pending', msg: '已点击, 页面跳转中待确认', reason: 'navigated' };
        }

        // 同页确认
        if (unit.confirmManual) {
            log('无自动确认特征(confirmManual), 记为 pending');
            return { status: 'pending', msg: '已执行签到步骤, 请人工确认', reason: 'manual' };
        }
        const ok = await detectSuccess(unit);
        if (ok) {
            writeStatus(unit.id, 'success', '签到成功(已检测到成功特征)');
            log('签到成功(成功特征已确认)');
            return { status: 'success', msg: '签到成功', reason: 'detected' };
        }
        writeStatus(unit.id, 'failed', '点击后未检测到成功特征');
        warn('点击后未检测到成功特征');
        return { status: 'failed', msg: '未检测到成功特征', reason: 'no_confirm' };
    }

    // 带整流程超时保护的 runUnit(防单站卡死拖住批量)
    async function runUnitWithTimeout(unit, ctx) {
        try {
            return await Promise.race([
                runUnit(unit, ctx),
                sleep(UNIT_TOTAL_TIMEOUT).then(() => {
                    console.warn(`${ScriptName} [${unit.name}] 整流程超时(${UNIT_TOTAL_TIMEOUT}ms), 记为失败`);
                    if (!isSuccessToday(unit.id)) {
                        writeStatus(unit.id, 'failed', '整流程超时');
                    }
                    return { status: 'failed', msg: '整流程超时', reason: 'timeout' };
                })
            ]);
        } catch (e) {
            console.error(`${ScriptName} [${unit.name}] 未捕获异常:`, e);
            if (!isSuccessToday(unit.id)) writeStatus(unit.id, 'failed', e.message.slice(0, 60));
            return { status: 'failed', msg: e.message.slice(0, 60), reason: 'exception' };
        }
    }

    // ==================== 被动模式(访问即签) ====================
    async function runPassiveMode(skipUnitIds = []) {
        const href = location.href;
        console.log(`${ScriptName} 被动模式, 当前 URL: ${href}`);
        const hits = UNITS.filter((u) => matchUnit(u, href));
        if (hits.length === 0) {
            console.warn(`${ScriptName} 未匹配到任何站点规则`);
            return;
        }
        for (const unit of hits) {
            if (skipUnitIds.includes(unit.id)) {
                console.log(`${ScriptName} [${unit.name}] 批量任务正在处理该站, 跳过被动触发`);
                continue;
            }
            await runUnitWithTimeout(unit, { mode: 'passive' });
        }
    }

    // ==================== 悬浮按钮与面板 UI ====================
    // Shadow DOM 隔离样式; CSS 变量 + prefers-color-scheme 实现深浅色跟随系统
    const UI_CSS = `
        :host { all: initial; }
        *, *::before, *::after { box-sizing: border-box; }
        :host {
            /* 主题变量: 浅色默认, 深色见下方 media 查询 */
            --surface: #ffffff;
            --surface-2: #f6f7fb;
            --text: #1f2430;
            --muted: #6c7480;
            --border: #e6e8ee;
            --accent-1: #5b6cff;
            --accent-2: #8a5cff;
            --ok: #16a34a;
            --err: #e5484d;
            --pend: #d97706;
            --skip: #64748b;
            --shadow: 0 10px 30px rgba(15, 23, 42, 0.16), 0 2px 8px rgba(15, 23, 42, 0.08);
            --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
        }
        @media (prefers-color-scheme: dark) {
            :host {
                --surface: #1b1f2b;
                --surface-2: #232838;
                --text: #e7eaf1;
                --muted: #99a1b3;
                --border: #2d3342;
                --shadow: 0 10px 30px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.3);
            }
        }
        .fab {
            position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
            width: 52px; height: 52px; border-radius: 50%; border: none; cursor: pointer;
            background: linear-gradient(135deg, var(--accent-1), var(--accent-2));
            color: #fff; display: flex; align-items: center; justify-content: center;
            box-shadow: var(--shadow); transition: transform 0.15s ease, box-shadow 0.15s ease;
            font-family: var(--font); padding: 0;
        }
        .fab:hover { transform: translateY(-2px) scale(1.04); }
        .fab:active { transform: scale(0.96); }
        .fab svg { width: 24px; height: 24px; }
        .fab-badge {
            position: absolute; top: -2px; right: -2px; min-width: 18px; height: 18px;
            padding: 0 4px; border-radius: 9px; background: var(--ok); color: #fff;
            font-size: 11px; font-weight: 600; line-height: 18px; text-align: center;
            font-family: var(--font); display: none;
        }
        .fab-badge.show { display: block; }
        .chip {
            position: fixed; right: 84px; bottom: 30px; z-index: 2147483000;
            display: none; align-items: center; gap: 8px; max-width: 300px;
            background: var(--surface); color: var(--text); border: 1px solid var(--border);
            border-radius: 999px; padding: 8px 8px 8px 14px; box-shadow: var(--shadow);
            font-family: var(--font); font-size: 12px;
        }
        .chip.show { display: flex; }
        .chip-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .chip .cancel {
            border: none; cursor: pointer; border-radius: 999px; padding: 4px 10px;
            background: var(--surface-2); color: var(--muted); font-size: 12px;
            font-family: var(--font); flex-shrink: 0;
        }
        .chip .cancel:hover { color: var(--err); background: rgba(229, 72, 77, 0.12); }
        .panel {
            position: fixed; right: 20px; bottom: 84px; z-index: 2147483000;
            width: 330px; max-height: min(620px, calc(100vh - 120px));
            display: none; flex-direction: column;
            background: var(--surface); color: var(--text);
            border: 1px solid var(--border); border-radius: 16px; box-shadow: var(--shadow);
            font-family: var(--font); font-size: 13px; overflow: hidden;
        }
        .panel.show { display: flex; }
        .panel-head {
            display: flex; align-items: center; gap: 10px; padding: 14px 16px 10px;
            border-bottom: 1px solid var(--border); flex-shrink: 0;
        }
        .panel-title { font-size: 15px; font-weight: 700; }
        .panel-sub { font-size: 12px; color: var(--muted); margin-left: auto; }
        .panel-close {
            border: none; background: none; cursor: pointer; color: var(--muted);
            font-size: 18px; line-height: 1; padding: 2px 6px; border-radius: 6px;
            font-family: var(--font);
        }
        .panel-close:hover { background: var(--surface-2); color: var(--text); }
        .banner {
            display: none; margin: 10px 14px 0; padding: 8px 12px; border-radius: 10px;
            background: rgba(22, 163, 74, 0.12); color: var(--ok); font-weight: 600; flex-shrink: 0;
        }
        .batchbar {
            display: none; margin: 10px 14px 0; padding: 8px 10px; border-radius: 10px;
            background: var(--surface-2); font-size: 12px; align-items: center; gap: 8px; flex-shrink: 0;
        }
        .batchbar.show { display: flex; }
        .batchbar-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .batchbar .stop {
            border: none; cursor: pointer; border-radius: 999px; padding: 3px 10px;
            background: rgba(229, 72, 77, 0.14); color: var(--err); font-size: 12px;
            font-family: var(--font); flex-shrink: 0;
        }
        .list { overflow-y: auto; padding: 6px 14px; flex: 1; }
        .g-head {
            font-size: 11px; font-weight: 700; color: var(--muted);
            padding: 12px 2px 4px; letter-spacing: 0.5px;
        }
        .g-head:first-child { padding-top: 8px; }
        .row {
            display: flex; align-items: center; gap: 10px;
            padding: 8px 2px; border-bottom: 1px dashed var(--border);
        }
        .row:last-child { border-bottom: none; }
        .row-main { flex: 1; min-width: 0; }
        .row-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .row-sub { font-size: 11px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .badge {
            flex-shrink: 0; font-size: 11px; font-weight: 600;
            padding: 3px 8px; border-radius: 999px; white-space: nowrap;
        }
        .badge.ok   { background: rgba(22, 163, 74, 0.14); color: var(--ok); }
        .badge.err  { background: rgba(229, 72, 77, 0.14); color: var(--err); }
        .badge.pend { background: rgba(217, 119, 6, 0.16); color: var(--pend); }
        .badge.skip { background: rgba(100, 116, 139, 0.16); color: var(--skip); }
        .badge.none { background: var(--surface-2); color: var(--muted); }
        .panel-foot { padding: 10px 14px 14px; border-top: 1px solid var(--border); flex-shrink: 0; }
        .btn-primary {
            width: 100%; border: none; cursor: pointer;
            padding: 10px 0; border-radius: 10px;
            background: linear-gradient(135deg, var(--accent-1), var(--accent-2));
            color: #fff; font-size: 14px; font-weight: 600; font-family: var(--font);
            transition: opacity 0.15s ease, transform 0.1s ease;
        }
        .btn-primary:hover:not(:disabled) { opacity: 0.92; }
        .btn-primary:active:not(:disabled) { transform: scale(0.98); }
        .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
        .toast {
            position: fixed; right: 84px; bottom: 84px; z-index: 2147483001;
            max-width: 260px; padding: 9px 14px; border-radius: 10px;
            background: var(--surface); color: var(--text); border: 1px solid var(--border);
            box-shadow: var(--shadow); font-family: var(--font); font-size: 12px;
            opacity: 0; transform: translateY(6px); transition: opacity 0.2s ease, transform 0.2s ease;
            pointer-events: none;
        }
        .toast.show { opacity: 1; transform: translateY(0); }
    `;

    const UI = (function () {
        let host = null, fab, fabBadge, chip, chipText, panel, summaryEl, bannerEl, barEl, barTextEl, listEl, btnBatch;
        let cancelObj = null;
        let batchBase = '';
        let toastEl = null, toastTimer = null;

        const SVG_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.26"/></svg>';

        function esc(s) {
            return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        }
        function statusMeta(status) {
            switch (status) {
                case 'success': return { label: '已成功', cls: 'ok' };
                case 'failed': return { label: '失败', cls: 'err' };
                case 'pending': return { label: '待确认', cls: 'pend' };
                case 'skipped': return { label: '已跳过', cls: 'skip' };
                default: return { label: '—', cls: 'none' };
            }
        }

        function buildRowHtml(unit) {
            const st = readStatus(unit.id);
            const todayHit = st && st.date === todayStr();
            const meta = statusMeta(todayHit ? st.status : '');
            const sub = todayHit && st
                ? `${esc(st.msg || '')}${st.ts ? ' · ' + formatTime(st.ts) : ''}`
                : '今日未处理';
            return `<div class="row">`
                + `<div class="row-main"><div class="row-name">${esc(unit.name)}</div>`
                + `<div class="row-sub">${sub}</div></div>`
                + `<span class="badge ${meta.cls}">${meta.label}</span>`
                + `</div>`;
        }

        function init() {
            host = document.createElement('div');
            host.id = 'ptac-root-v2';
            const shadow = host.attachShadow({ mode: 'open' });
            const style = document.createElement('style');
            style.textContent = UI_CSS;
            shadow.appendChild(style);

            // FAB
            fab = document.createElement('button');
            fab.className = 'fab';
            fab.title = 'PT 自动签到';
            fab.innerHTML = SVG_ICON + '<span class="fab-badge"></span>';
            fabBadge = fab.querySelector('.fab-badge');

            // 批量状态条(芯片)
            chip = document.createElement('div');
            chip.className = 'chip';
            chip.innerHTML = '<span class="chip-text"></span><button class="cancel">停止</button>';
            chipText = chip.querySelector('.chip-text');
            chip.querySelector('.cancel').addEventListener('click', requestCancel);

            // 面板
            panel = document.createElement('div');
            panel.className = 'panel';
            panel.innerHTML = `
                <div class="panel-head">
                    <span class="panel-title">PT 自动签到</span>
                    <span class="panel-sub" id="summary"></span>
                    <button class="panel-close" title="关闭">\u00d7</button>
                </div>
                <div class="banner"></div>
                <div class="batchbar"><span class="batchbar-text"></span><button class="stop">停止</button></div>
                <div class="list"></div>
                <div class="panel-foot"><button class="btn-primary">批量签到</button></div>`;
            summaryEl = panel.querySelector('#summary');
            bannerEl = panel.querySelector('.banner');
            barEl = panel.querySelector('.batchbar');
            barTextEl = panel.querySelector('.batchbar-text');
            listEl = panel.querySelector('.list');
            btnBatch = panel.querySelector('.btn-primary');
            panel.querySelector('.panel-close').addEventListener('click', () => closePanel());
            barEl.querySelector('.stop').addEventListener('click', requestCancel);
            btnBatch.addEventListener('click', startBatch);

            fab.addEventListener('click', togglePanel);

            // toast
            toastEl = document.createElement('div');
            toastEl.className = 'toast';

            shadow.appendChild(fab);
            shadow.appendChild(chip);
            shadow.appendChild(panel);
            shadow.appendChild(toastEl);
            document.body.appendChild(host);

            render();
        }

        function requestCancel() {
            if (cancelObj) cancelObj.cancelled = true;
        }
        function isCancelled() { return !!(cancelObj && cancelObj.cancelled); }

        function render() {
            if (!host) return;
            const c = countToday();
            summaryEl.textContent = `今日 ${c.success}/${c.total} 已成功`;
            if (c.success > 0) {
                fabBadge.textContent = String(c.success);
                fabBadge.classList.add('show');
            } else {
                fabBadge.classList.remove('show');
            }
            let html = '';
            for (const g of GROUPS) {
                const isMulti = g.units.length > 1;
                if (isMulti) html += `<div class="g-head">${esc(g.name)}</div>`;
                for (const u of g.units) html += buildRowHtml(u);
            }
            listEl.innerHTML = html;
            const left = remainingCandidates().length;
            btnBatch.textContent = left > 0 ? `批量签到 (剩余 ${left})` : '批量签到 (今日已完成)';
            btnBatch.disabled = batchActive() || left === 0;
        }
        function batchActive() { return !!(cancelObj); }

        // ---------- 批量进行中 UI ----------
        // 整个批量过程(含单站执行与倒计时)都可取消: 挂一个全局取消令牌
        function armCancel() {
            if (!cancelObj) cancelObj = { cancelled: false };
            return cancelObj;
        }
        function showBatch(data) {
            batchBase = `批量 ${data.index}/${data.total}`;
            updateBatchText(data.unitName);
            chip.classList.add('show');
            barTextEl.textContent = `${batchBase} · 正在处理: ${data.unitName}`;
            barEl.classList.add('show');
        }
        function updateBatchResult(unitName, res) {
            if (res && res.status) {
                const meta = statusMeta(res.status);
                updateBatchText(`${unitName} ${meta.label}${res.msg ? ' - ' + res.msg : ''}`);
            }
        }
        function updateBatchText(msg) {
            const text = msg ? `${batchBase} · ${msg}` : batchBase;
            chipText.textContent = text;
            barTextEl.textContent = text;
        }
        function endBatch() {
            chip.classList.remove('show');
            barEl.classList.remove('show');
            cancelObj = null;
            batchBase = '';
        }
        function countdown(ms, nextName) {
            return new Promise((resolve) => {
                const total = Math.max(1, Math.round(ms / 1000));
                let left = total;
                // 复用批量过程已有的取消令牌(若用户此前已点停止, 立即取消)
                const token = cancelObj || { cancelled: false };
                cancelObj = token;
                const text = () => `${left}s 后前往: ${nextName} (可点停止)`;
                updateBatchText(text());
                const stop = () => { clearInterval(iv); };
                const iv = setInterval(() => {
                    if (token.cancelled) { stop(); resolve(true); return; }
                    left -= 1;
                    if (left <= 0) { stop(); resolve(false); return; }
                    updateBatchText(text());
                }, 1000);
            });
        }

        // ---------- 面板 ----------
        function togglePanel() {
            panel.classList.contains('show') ? closePanel() : openPanel();
        }
        function openPanel() {
            panel.classList.add('show');
            render();
        }
        function closePanel() {
            panel.classList.remove('show');
            bannerEl.style.display = 'none';
        }
        function showBatchDone() {
            endBatch();
            openPanel();
            bannerEl.textContent = '\u2713 批量签到完成';
            bannerEl.style.display = 'block';
            toast('批量签到完成');
            setTimeout(() => { bannerEl.style.display = 'none'; }, 8000);
        }

        // ---------- toast ----------
        function toast(msg) {
            toastEl.textContent = msg;
            toastEl.classList.add('show');
            clearTimeout(toastTimer);
            toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
        }

        return {
            init, render, toast, togglePanel, openPanel, closePanel,
            showBatch, updateBatchResult, updateBatchText, countdown,
            endBatch, isCancelled, requestCancel, armCancel
        };
    })();

    // ==================== 批量任务引擎 ====================
    // 采用"当前标签页接力导航"的串行方案: 每站签完跳下一站,
    // 天然低频 + 站间可配缓冲, 全程单标签, 不并行不弹窗

    // 待处理候选: enabled 且非今日成功且非"待确认(pending)未过期"
    function remainingCandidates() {
        const out = [];
        for (const u of UNITS) {
            if (u.enabled === false) continue;
            if (isSuccessToday(u.id)) continue;
            const prev = readStatus(u.id);
            if (prev && prev.status === 'pending' && prev.date === todayStr()
                && Date.now() - prev.ts < MIN_INTERVAL) continue;
            out.push(u.id);
        }
        return out;
    }

    // 发起页开始批量: 建任务 → 立即接力到第一个候选站点(在用户点击手势内导航)
    function startBatch() {
        const list = remainingCandidates();
        if (list.length === 0) {
            UI.toast('今日签到均已成功或均在待确认中');
            return;
        }
        const taskId = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        const task = { taskId, list, index: 0, startedAt: Date.now() };
        saveTask(task);
        const first = UNIT_MAP.get(list[0]);
        console.log(`${ScriptName} 批量任务已创建: ${list.join(', ')}`);
        UI.toast(`批量开始, 共 ${list.length} 个站点`);
        // 稍延迟让 toast 可见, 再导航
        setTimeout(() => location.replace(buildTaskUrl(first, taskId)), 300);
    }

    // 任务模式页面主流程(每个接力页调用一次, 处理完本站后导航到下一站或收尾)
    async function runBatchOnCurrentPage(task) {
        const unit = UNIT_MAP.get(task.list[task.index]);
        // 安全校验: 任务指向的 unit 必须存在, 且当前页面确实命中该 unit(防 URL 参数被篡改后跳转任意域)
        if (!unit || !matchUnit(unit, location.href)) {
            clearTask();
            UI.toast('批量任务已失效(当前页面与任务不匹配)');
            UI.render();
            return;
        }
        UI.showBatch({ index: task.index + 1, total: task.list.length, unitName: unit.name });
        UI.armCancel(); // 整个批量过程可取消(单站执行中也可点停止, 处理完当前站后中止)
        const res = await runUnitWithTimeout(unit, { mode: 'batch' });
        UI.updateBatchResult(unit.name, res);

        // 点击触发了整页跳转(如 NexusPHP 签到链 attendance.php): 本页即将卸载,
        // 不在此推进任务 —— 落地页会自动续链结算本站(见 main 的自动续链分支)
        if (res && res.reason === 'navigated') return;

        if (UI.isCancelled()) {
            clearTask();
            UI.endBatch();
            UI.toast('批量已取消, 停留在当前页面');
            UI.render();
            return;
        }

        task.index += 1;
        if (task.index >= task.list.length) {
            // 全部处理完: 停在最后一站, 弹出完成面板
            clearTask();
            UI.endBatch();
            UI.showBatchDone();
            return;
        }
        const next = UNIT_MAP.get(task.list[task.index]);
        if (!next) {
            clearTask();
            UI.endBatch();
            UI.showBatchDone();
            return;
        }
        // 本站完成后按配置等待缓冲(如贴吧吧间防风控), 期间可取消
        task.startedAt = Date.now();
        saveTask(task);
        const delay = (unit.batchDelayMs != null ? unit.batchDelayMs : DEFAULT_BATCH_DELAY_MS) || 0;
        if (delay > 0) {
            const cancelled = await UI.countdown(delay, next.name);
            if (cancelled) {
                clearTask();
                UI.endBatch();
                UI.toast('批量已取消, 停留在当前页面');
                UI.render();
                return;
            }
        }
        location.replace(buildTaskUrl(next, task.taskId));
    }

    // ==================== 主流程 ====================
    async function main() {
        UI.init();

        let task = loadTask();
        if (task && isTaskStale(task)) {
            console.log(`${ScriptName} 清理过期批量任务(链条中断超过 ${TASK_STALE_MS / 60000} 分钟)`);
            clearTask();
            task = null;
        }

        const urlTaskId = readTaskIdFromUrl();
        if (urlTaskId) {
            // 批量接力页: URL 带任务参数
            if (task && task.taskId === urlTaskId) {
                await runBatchOnCurrentPage(task);
            } else {
                clearTask();
                UI.toast('批量任务已失效(已取消或已完成), 本次不处理');
            }
            return;
        }

        // 普通访问页
        if (task) {
            // 存在进行中的批量任务: 若当前页正是任务当前位置站点
            // (如签到点击后自动跳转的落地页 attendance.php, 无 URL 参数),
            // 则自动续链: 在本页完成本站结算并推进到下一站
            const curUnitId = task.list && task.list[task.index];
            const curUnit = curUnitId ? UNIT_MAP.get(curUnitId) : null;
            if (curUnit && matchUnit(curUnit, location.href)) {
                console.log(`${ScriptName} 检测到进行中的批量任务, 当前页命中任务站点, 自动续链`);
                await runBatchOnCurrentPage(task);
            } else {
                // 其它页面: 被动签到, 但跳过任务当前位置站点, 防并行重复触发
                console.log(`${ScriptName} 存在进行中的批量任务, 将跳过与其当前位置冲突的站点`);
                await runPassiveMode(curUnitId ? [curUnitId] : []);
            }
        } else {
            await runPassiveMode();
        }
        UI.render();
    }

    (async function boot() {
        if (window.top !== window.self) return; // iframe 内不运行
        if (document.readyState === 'loading') {
            await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
        }
        try {
            await main();
        } catch (e) {
            console.error(`${ScriptName} 主流程异常:`, e);
        }
    })();
})();
