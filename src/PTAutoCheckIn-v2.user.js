// ==UserScript==
// @name         PTAutoCheckIn-v2
// @name:zh-CN   PT多站点自动签到v2
// @namespace    https://github.com/ABackerNINI/TampermonkeyScripts
// @version      2026.09.07.10
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
// @grant        GM_openInTab
// @license      GNU GPL-3.0
// @tag          utilities
// ==/UserScript==

const ScriptName = '[PTAutoCheckIn-v2]';
const MIN_INTERVAL = 10 * 60 * 1000;           // 单站触发最小间隔, 防止高频触发导致封号
const POST_CLICK_SETTLE = 800;                 // 点击后停留观察时长(ms), 判断是否发生页面跳转
const WAIT_TEXT_TIMEOUT = 3000;                // 成功文案轮询默认超时(ms)
const TASK_STALE_MS = 30 * 60 * 1000;          // 批量任务总超时判定(ms): 超过视为过期并清理(调度页离开后的兜底)
const UNIT_TOTAL_TIMEOUT = 25 * 1000;          // 单个站点整流程总超时(ms), 防卡死
const DEFAULT_BATCH_DELAY_MS = 0;              // 默认站间缓冲(ms), 站点可自行配置覆盖
const POLL_INTERVAL_MS = 1000;                 // 调度页轮询后台标签结果间隔(ms)
const PER_UNIT_TIMEOUT_MS = 50 * 1000;         // 单站调度窗口上限(ms): 覆盖标签内整流程 + 落地页结算 + 网络慢
const PENDING_GRACE_MS = 10 * 1000;            // 状态 pending 后观察窗口(ms): 等待落地页将其改写为 success/failed
const HEARTBEAT_FRESH_MS = 15 * 1000;          // 调度页心跳保鲜判定(ms): 超过视为调度者已离开(断链/关页)

// 存储 key 前缀(GM 存储按脚本共享, 跨域可读, 满足"任意站点查看同一份状态")
const K = {
    status: (uid) => `ptac_status_${uid}`,     // {date:'YYYY-MM-DD', status:'success|failed|pending|skipped', msg, ts}
    cooldown: (uid) => `ptac_cooldown_${uid}`, // 上次触发时间戳(ms)
    favicon: (uid) => `ptac_favicon_${uid}`,   // 路过收集的站点真实 icon URL(面板列表图标用)
    skin: 'ptac_skin',                          // FAB 外观皮肤: chameleon|number|signal|ring
    task: 'ptac_task'                          // 批量任务 {taskId, list:[unitId...], index, startedAt, hb(调度心跳)}
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
    //   match: 可选 — RegExp 或函数(传 location.href), 显式决定页面归属; 缺省由 url 推导:
    //     host 相等(忽略 www. 前缀差异), 且 url 带 query 时逐参数一致(页面可带额外参数, 如贴吧 kw)
    //   checkInSelector/checkInContent/alreadyCheckedInContent: 签到按钮定位与文案校验
    //     → 已签到检测以按钮文案为准, 每次访问页面都会检测, 不受 10 分钟冷却限制
    //       (冷却只限制"是否点击", 不限制"是否检测")
    //   alreadyCheck: 可选函数, 自定义"已签到"判定(返回 bool)
    //   noButtonMeansCheckedIn: true 时"找不到签到按钮即视为已签"(适用于已签后签到按钮消失的站, 如 BTSchool);
    //     注意仅当按钮确实会因已签而消失时启用, 避免在无签到入口的其它页面误判
    //   alreadyPageCheck: 默认 false — 全部站点默认关闭整页文本检测(防页面其它区域误报);
    //     仅特殊站点显式置 true 才启用整页文本级"已签到"检测(如跳页型落地页无签到按钮的站)
    //   successDetect: 点击后成功检测列表(同页 AJAX 场景) [{type:'url'|'text'|'func', ...}], 任一命中即成功
    //   confirmManual: true 表示无可靠成功特征, 点击后记为 pending 待人工确认
    //   batchDelayMs: 批量模式本站处理完后、跳转下一站前的缓冲(ms)
    //   enabled: 是否参与批量签到
    //   steps: 步骤数组(click_checkin/click/wait/check/function), 缺省为 [CLICK_CHECK_IN]
    //   注: 2026.09.07 实测各站签到链接普遍不再带 faqlink class(如 <a href="attendance.php" class="">),
    //       故 PT 站 checkInSelector 一律不依赖 class, 仅按 href 定位; url 同步为当前有效入口
    const SITES = [
        // ============ PT 站(单站 group) ============
        {
            id: 'tangpt', name: '躺平',
            url: 'https://www.tangpt.top/',
            checkInSelector: 'a[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'pttime', name: 'PTTime',
            url: 'https://www.pttime.org/',
            checkInSelector: 'a.fcb[href*="attendance.php"]',
            checkInContent: '签到领魔力',
            alreadyCheckedInContent: '签到详情',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'railgun', name: 'Railgun',
            url: 'https://bilibili.download/',
            checkInSelector: 'a[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'ptzone', name: 'PTZone',
            url: 'https://ptzone.xyz/',
            checkInSelector: 'a[href*="attendance.php"]',
            checkInContent: '[簽到得魔力]',
            alreadyCheckedInContent: '簽到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'ptsbao', name: 'PTSBao',
            url: 'https://ptsbao.club/',
            checkInSelector: 'a[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'hdclone', name: 'HDClone',
            url: 'https://pt.hdclone.top/',
            checkInSelector: 'a[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'btschool', name: 'BTSchool',
            url: 'https://pt.btschool.club/',
            checkInSelector: 'a[href*="index.php?action=addbonus"] > font',
            checkInContent: '每日签到',
            alreadyCheckedInContent: '签到已得',
            noButtonMeansCheckedIn: true, // 实测: 已签后签到按钮消失, 找不到即视为已签
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'daxiangjiao', name: '大香蕉',
            url: 'https://pt.daxiangjiao.org/',
            checkInSelector: 'a[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'novahd', name: 'NovaHD',
            url: 'https://pt.novahd.top/',
            checkInSelector: 'a[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'ptfans', name: 'PTFans',
            url: 'https://ptfans.cc/',
            checkInSelector: 'a[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'carpt', name: 'CarPT',
            url: 'https://carpt.net/',
            checkInSelector: 'a[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'hdtime', name: 'HDTime',
            url: 'https://hdtime.org/',
            checkInSelector: 'a[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'hdfans', name: 'HDFans',
            url: 'https://hdfans.org/',
            checkInSelector: 'a[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'crabpt', name: 'CrabPT',
            url: 'https://crabpt.vip/',
            checkInSelector: 'a[href*="attendance.php"]',
            checkInContent: '[签到得蟹币]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        {
            id: 'cyanbug', name: 'Cyanbug',
            url: 'https://cyanbug.net/',
            checkInSelector: 'a.nav-btn[href*="attendance.php"]',
            checkInContent: '[签到得魔力]',
            alreadyCheckedInContent: '签到已得',
            steps: [CLICK_CHECK_IN]
        },
        { // 点击"立即签到"提交表单后页面刷新显示结果, 需整页级已签检测
            id: 'hdbao', name: 'HDBao',
            url: 'https://hdbao.cc/',
            attendanceUrl: 'https://hdbao.cc/attendance.php',
            checkInSelector: 'a[href*="attendance.php"]',
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
            url: 'https://pt.muxuege.org/',
            attendanceUrl: 'https://pt.muxuege.org/attendance.php',
            checkInSelector: 'a[href*="attendance.php"]',
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
        { // 蜂巢: 2026.09.07 站方改版为 shadcn/Radix 风格 UI, 签到按钮固定
            //   data-slot="sidebar-user-check-in", 已签时按钮文案为「已签到」→ 按钮级已签检测已启用;
            //   未签时点击同一按钮; 改版后是否仍弹对话框待实测, 故对话框两步降级为可选(找不到自动跳过);
            //   无可靠成功特征, 点击后仍 confirmManual 记 pending 待人工确认
            id: 'pting', name: '蜂巢',
            url: 'https://pting.club/',
            checkInSelector: 'button[data-slot="sidebar-user-check-in"]',
            alreadyCheckedInContent: '已签到',
            confirmManual: true,
            steps: [
                {
                    type: 'wait',
                    ms: 5000, // 网站限制, 实测 3 秒不够
                    description: '等待5秒'
                },
                {
                    type: 'click_checkin',
                    description: '点击侧栏"签到"按钮(文案含"已签到"则识别为已签, 不点击)',
                    timeout: 5000
                },
                {
                    type: 'wait',
                    ms: 1000,
                    description: '等待1秒'
                },
                { // 对话框"签到"按钮 — 可选步骤: 若改版后已无对话框则超时自动跳过
                    type: 'click',
                    ignoreError: true,
                    timeout: 2000,
                    selector: () => {
                        const btns = document.querySelectorAll('span > button[data-slot="button"][type="button"]:not([title])');
                        for (const btn of btns) {
                            if (btn.textContent && btn.textContent.includes('签到') && btn.textContent.length < 4) {
                                return btn;
                            }
                        }
                        return null;
                    },
                    description: '点击对话框"签到"按钮(可选)'
                },
                {
                    type: 'wait',
                    ms: 800,
                    description: '等待0.8秒'
                },
                { // 对话框"关闭"按钮 — 可选步骤
                    type: 'click',
                    ignoreError: true,
                    timeout: 2000,
                    selector: () => {
                        const btns = document.querySelectorAll('div > button[data-slot="dialog-close"][type="button"]:not([title])');
                        for (const btn of btns) {
                            if (btn.textContent === '关闭') {
                                return btn;
                            }
                        }
                        return null;
                    },
                    description: '点击对话框"关闭"按钮(可选)'
                }
            ]
        },

        // ============ 百度贴吧(多吧 group: 每个吧是独立签到单元) ============
        {
            id: 'tieba', name: '百度贴吧',
            units: [
                {
                    id: 'tieba_pt', name: 'pt吧',
                    url: 'https://tieba.baidu.com/f?kw=pt',
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
                    url: 'https://tieba.baidu.com/f?kw=hdsky',
                    checkInSelector: '.button-wrapper.operate-btn.follow-sign',
                    checkInContent: '签到',
                    alreadyCheckedInContent: '连签',
                    successDetect: [
                        { type: 'text', selector: 'body', text: '签到成功', timeout: 3000 }
                    ],
                    batchDelayMs: 3000,
                    steps: [CLICK_CHECK_IN]
                },
                {
                    id: 'tieba_test', name: 'test吧',
                    url: 'https://tieba.baidu.com/f?kw=test',
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

    // 判断当前页面是否属于某 unit: 显式 match(正则/函数)优先; 缺省由 url 推导 ——
    // 域名单一事实来源在 url, 新增/改入口无需再同步 match, 避免两者漂移
    function matchUnit(unit, href) {
        try {
            if (unit.match) return typeof unit.match === 'function' ? !!unit.match(href) : unit.match.test(href);
            let u, p;
            try { u = new URL(unit.url); p = new URL(href); } catch (e) { return false; }
            if (u.hostname.replace(/^www\./, '') !== p.hostname.replace(/^www\./, '')) return false;
            // url 带 query(如贴吧 kw)时逐参数比较; 无 query 的站忽略页面参数
            for (const [k, v] of u.searchParams) {
                if (p.searchParams.get(k) !== v) return false;
            }
            return true;
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
    // 今日成功/失败数 / 总数(面板汇总与 FAB 皮肤用)
    function countToday() {
        let success = 0, failed = 0;
        const today = todayStr();
        for (const u of UNITS) {
            const st = readStatus(u.id);
            if (st && st.date === today) {
                if (st.status === 'success') success += 1;
                else if (st.status === 'failed') failed += 1;
            }
        }
        return { success, failed, total: UNITS.length };
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
    // 今日失败且仍在冷却期(批量默认排除此类站, 避免白开标签重复点击; 勾选强制重试才纳入)
    function isFailedInCooldown(unitId) {
        const st = readStatus(unitId);
        return !!(st && st.status === 'failed' && st.date === todayStr() && cooldownRemainMs(unitId) > 0);
    }

    // ---------- 站点图标(favicon) ----------
    // 取用链: unit.favicon 配置显式指定 → GM 路过收集的真实 icon URL → 站点根 /favicon.ico → 空(不显示)。
    // 图标 URL 与站点页面所用一致时天然命中浏览器 HTTP 缓存, 无额外网络流量。
    const favCache = new Map(); // 同页多次渲染(批量推进时)避免反复 GM 读
    function faviconSrc(unit) {
        if (favCache.has(unit.id)) return favCache.get(unit.id);
        let src = '';
        if (unit.favicon) src = unit.favicon;
        else {
            src = gmGet(K.favicon(unit.id), '');
            if (!src) {
                try { src = new URL(unit.url).origin + '/favicon.ico'; } catch (e) { src = ''; }
            }
        }
        favCache.set(unit.id, src);
        return src;
    }
    // 路过收集: 脚本运行在当前站时读取其 <link rel="icon"> 真实 URL 存入匹配 unit
    // (同 host 多吧共享同一 icon, 各自存一份量级可忽略); 仅收 http(s), 无 icon/已相同则跳过
    function collectFavicon() {
        try {
            const link = document.querySelector('link[rel~="icon"]');
            const href = link && link.getAttribute('href');
            if (!href) return;
            let abs;
            try { abs = new URL(href, document.baseURI).href; } catch (e) { return; }
            if (!/^https?:/i.test(abs)) return; // 丢弃 data:/javascript: 等
            for (const u of UNITS) {
                if (!matchUnit(u, location.href)) continue;
                if (gmGet(K.favicon(u.id), '') === abs) continue;
                gmSet(K.favicon(u.id), abs);
            }
        } catch (e) { /* 静默: 收集失败不影响签到主流程 */ }
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
        // 2.5) 无按钮即视为已签 — 仅显式开启的站(已签后签到按钮消失, 如 BTSchool)
        if (unit.noButtonMeansCheckedIn && unit.checkInSelector) {
            const el = document.querySelector(unit.checkInSelector);
            if (!el) {
                return { hit: true, source: '未找到签到按钮(视为已签)' };
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
        //    forceCooldown(批量勾选"强制重试")时无视冷却照常点击; 点击前仍会重写冷却,
        //    若再失败会进入新一轮冷却, 不会连环无脑重试
        const remain = cooldownRemainMs(unit.id);
        if (remain > 0 && !(ctx && ctx.forceCooldown)) {
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
            writeStatus(unit.id, 'failed', `步骤失败: ${e.message.slice(0, 200)}`);
            return { status: 'failed', msg: e.message.slice(0, 200), reason: 'step_error' };
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
            if (!isSuccessToday(unit.id)) writeStatus(unit.id, 'failed', e.message.slice(0, 200));
            return { status: 'failed', msg: e.message.slice(0, 200), reason: 'exception' };
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
            box-shadow: var(--shadow);
            animation: baseGlow 3.2s ease-in-out infinite; /* 基础紫柔光呼吸(默认态, 所有皮肤共用) */
            transition: transform 0.15s ease, box-shadow 0.15s ease;
            font-family: var(--font); padding: 0;
        }
        @keyframes baseGlow {
            0%, 100% { box-shadow: var(--shadow), 0 0 5px rgba(139, 92, 246, 0.22); }
            50% { box-shadow: var(--shadow), 0 0 14px rgba(139, 92, 246, 0.45); }
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
        .fab-badge.err { background: var(--err); }
        .fab-badge.warn { background: var(--pend); }
        /* FAB 皮肤: 状态底色(变色/信号灯) — 渐变底 + 同色辉光呼吸(双光层, 振幅加强) */
        .fab.ok { background: linear-gradient(135deg, #22c55e, #15803d); --glow: rgba(74, 222, 128, 0.55); }
        .fab.warn { background: linear-gradient(135deg, #fbbf24, #d97706); --glow: rgba(251, 191, 36, 0.5); }
        .fab.err { background: linear-gradient(135deg, #f87171, #dc2626); --glow: rgba(248, 113, 113, 0.6); }
        .fab.ok, .fab.warn, .fab.err { animation: stateGlow 2.4s ease-in-out infinite; }
        @keyframes stateGlow {
            0%, 100% { box-shadow: var(--shadow), 0 0 6px var(--glow, transparent), 0 0 2px var(--glow, transparent); }
            50% { box-shadow: var(--shadow), 0 0 22px var(--glow, transparent), 0 0 8px var(--glow, transparent); }
        }
        /* FAB 皮肤: 变色(chameleon) — 悬浮图标整体波纹荡漾:
           本体周期性做轻微 scale 拉伸 + 上下浮动 + 圆角波浪起伏(transform/border-radius),
           按钮连同图标整体如水波荡漾; 动画占用 transform, hover/active 的位移缩放互斥 → 改用 filter 亮度反馈;
           辉光叠加: 未完成(紫底)→ baseGlow, 完成(.ok)→ stateGlow */
        .fab.chameleon { animation: chameleonWave 3.6s ease-in-out infinite, baseGlow 3.2s ease-in-out infinite; }
        .fab.chameleon.ok { animation: chameleonWave 3.6s ease-in-out infinite, stateGlow 2.4s ease-in-out infinite; }
        .fab.chameleon:hover { filter: brightness(1.12); }
        .fab.chameleon:active { filter: brightness(0.9); }
        @keyframes chameleonWave {
            0%, 100% { transform: translateY(0) scale(1, 1); border-radius: 50%; }
            12.5% { transform: translateY(-1.5px) scale(1.02, 0.98); border-radius: 49% 51% 54% 46% / 53% 47% 46% 54%; }
            37.5% { transform: translateY(1px) scale(0.985, 1.02); border-radius: 52% 48% 45% 55% / 47% 53% 56% 44%; }
            62.5% { transform: translateY(1.8px) scale(1.02, 0.985); border-radius: 46% 54% 52% 48% / 56% 44% 47% 53%; }
            87.5% { transform: translateY(-1px) scale(0.99, 1.015); border-radius: 53% 47% 47% 53% / 45% 55% 54% 46%; }
        }
        /* FAB 皮肤: 数字/感叹号主显示(图标换脸/信号灯) — 白字辉光 + 轻微脉冲 */
        .fab-core { display: flex; align-items: center; justify-content: center; }
        .fab-core .num { font-size: 20px; font-weight: 800; line-height: 1; color: #fff; text-shadow: 0 0 8px rgba(255, 255, 255, 0.55); animation: numPulse 1.6s ease-in-out infinite; }
        .fab-core .mark { font-size: 21px; font-weight: 800; line-height: 1; color: #fff; text-shadow: 0 0 8px rgba(255, 255, 255, 0.6); animation: numPulse 1.2s ease-in-out infinite; }
        @keyframes numPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.15); text-shadow: 0 0 16px rgba(255, 255, 255, 0.9); }
        }
        /* FAB 皮肤: 进度光环(光环) — 主体保持紫底不变, 外圈 conic 渐变弧由 --ring-p 控比例;
           配色: 默认青→品红渐变(紫底上对比鲜明), 全完成→绿满环, 今日有失败→琥珀起点红终点警示弧;
           抗锯齿: mask 内外缘各羽化 1px(消除硬切圆环锯齿), 环与按钮主体间由羽化平滑过渡 */
        .fab.ring {
            background: linear-gradient(135deg, var(--accent-1), var(--accent-2));
            animation: none;
            --ring-c1: #22d3ee; --ring-c2: #e879f9; --ring-gl: rgba(34, 211, 238, 0.55);
        }
        .fab.ring::before {
            content: ''; position: absolute; inset: -6px; border-radius: 50%;
            background: conic-gradient(from -90deg,
                    var(--ring-c1, #22d3ee) 0%,
                    var(--ring-c2, #e879f9) var(--ring-p, 0%),
                    rgba(148, 163, 184, 0.35) var(--ring-p, 0%) 100%);
            -webkit-mask: radial-gradient(farthest-side,
                    transparent calc(100% - 7px),
                    #000 calc(100% - 6px),
                    #000 calc(100% - 1px),
                    transparent 100%);
                    mask: radial-gradient(farthest-side,
                    transparent calc(100% - 7px),
                    #000 calc(100% - 6px),
                    #000 calc(100% - 1px),
                    transparent 100%);
            animation: ringGlow 2s ease-in-out infinite;
            pointer-events: none;
        }
        @keyframes ringGlow {
            0%, 100% { filter: drop-shadow(0 0 3px var(--ring-gl, transparent)); }
            50% { filter: drop-shadow(0 0 12px var(--ring-gl, transparent)); }
        }
        .fab.ring.ok::before { --ring-c1: #86efac; --ring-c2: #16a34a; --ring-gl: rgba(74, 222, 128, 0.65); }
        .fab.ring.err::before { --ring-c1: #fbbf24; --ring-c2: #ef4444; --ring-gl: rgba(239, 68, 68, 0.6); }
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
        .btn-skin {
            border: none; background: none; cursor: pointer; color: var(--muted);
            font-size: 12px; line-height: 1; padding: 3px 6px; border-radius: 6px;
            font-family: var(--font); flex-shrink: 0;
        }
        .btn-skin:hover { background: var(--surface-2); color: var(--text); }
        /* FAB 皮肤选择条(面板头部「外观」展开) */
        .skin-bar { display: none; align-items: center; gap: 6px; padding: 10px 14px 0; flex-wrap: wrap; flex-shrink: 0; }
        .panel.skin-open .skin-bar { display: flex; }
        .skin-bar .lbl { font-size: 11px; color: var(--muted); margin-right: 2px; }
        .skin-btn {
            display: flex; align-items: center; gap: 5px;
            border: 1px solid var(--border); background: var(--surface-2); color: var(--text);
            cursor: pointer; border-radius: 999px; padding: 3px 10px 3px 5px;
            font-size: 11px; font-family: var(--font);
        }
        .skin-btn:hover { border-color: var(--accent-1); }
        .skin-btn.active { border-color: var(--accent-1); background: rgba(91, 108, 255, 0.12); color: var(--accent-1); font-weight: 600; }
        .skin-dot {
            width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0;
            display: inline-flex; align-items: center; justify-content: center;
        }
        .skin-dot.d1 { background: linear-gradient(135deg, #16a34a, #5b6cff); }       /* 变色: 完成绿/未完紫 */
        .skin-dot.d2 { background: #5b6cff; }                                          /* 数字: 主体紫 */
        .skin-dot.d3 { background: conic-gradient(#16a34a 0 120deg, #d97706 120deg 240deg, #e5484d 240deg); } /* 信号灯三色 */
        .skin-dot.d4 { background: conic-gradient(#5b6cff 0 300deg, rgba(127, 133, 150, 0.35) 300deg); }      /* 光环弧 */
        .banner {
            display: none; margin: 10px 14px 0; padding: 8px 12px; border-radius: 10px;
            background: rgba(22, 163, 74, 0.12); color: var(--ok); font-weight: 600;
            align-items: center; gap: 8px; flex-shrink: 0; font-size: 12px; line-height: 1.5;
        }
        .banner.warn { background: rgba(217, 119, 6, 0.15); color: var(--pend); }
        .banner button {
            border: none; cursor: pointer; border-radius: 999px; padding: 3px 12px;
            background: var(--pend); color: #fff; font-size: 12px; font-weight: 600;
            font-family: var(--font); flex-shrink: 0; white-space: nowrap;
        }
        .banner button:hover { filter: brightness(1.08); }
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
        .row-name {
            display: flex; align-items: center; gap: 4px; cursor: pointer; min-width: 0;
            font-weight: 600;
        }
        .row-name .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .row-name .fav {
            width: 14px; height: 14px; border-radius: 3px; object-fit: contain;
            flex-shrink: 0; background: rgba(128, 128, 128, 0.15); /* 透明图标底色, 防白底/透明 png 不可见 */
        }
        .row-name .ext { font-size: 10px; color: var(--muted); flex-shrink: 0; opacity: 0.8; }
        .row-name:hover { color: var(--accent-1); }
        .row-name:hover .ext { opacity: 1; }
        .row-sub { font-size: 11px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .row.cool { opacity: 0.72; box-shadow: inset 3px 0 0 var(--pend); }
        .row.cool .row-sub { color: var(--pend); }
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
        .btn-row { position: relative; display: flex; align-items: stretch; gap: 0; }
        .btn-row .btn-primary { flex: 1; width: auto; border-radius: 10px 0 0 10px; }
        .btn-row .btn-primary.full { border-radius: 10px; }
        /* 强制展开钮: 图标化, 紧贴「批量签到」右侧成拆分按钮组(同色系深紫 + 细分隔线), 展开态/悬停琥珀警示 */
        .force-toggle {
            flex-shrink: 0; width: 28px; border: none; cursor: pointer; padding: 0;
            display: flex; align-items: center; justify-content: center;
            border-radius: 0 10px 10px 0;
            background: linear-gradient(135deg, #4b53e0, #7a4cf0);
            color: #fff; border-left: 1px solid rgba(255, 255, 255, 0.28);
            transition: background 0.15s ease, transform 0.2s ease;
        }
        .force-toggle svg { width: 15px; height: 15px; }
        .force-toggle:hover:not(:disabled) { background: linear-gradient(135deg, #f59e0b, #d97706); }
        .force-toggle:disabled { opacity: 0.45; cursor: not-allowed; }
        /* 展开态仅以琥珀色高亮提示(图标不旋转, 保持 chevron-up) */
        .force-toggle.open { background: linear-gradient(135deg, #f59e0b, #d97706); }
        /* 强制弹出层: 点击图标后自批量按钮上方浮出(不占文档流, 覆盖站点列表底部);
           右缘留出 28px 图标钮宽度 → 弹出按钮与「批量签到」本体对齐 */
        .force-pop {
            position: absolute; left: 0; right: 28px; bottom: calc(100% + 6px);
            display: none; z-index: 12;
        }
        .force-pop.open { display: block; }
        .force-wrap { position: relative; }
        .btn-force {
            width: 100%; border: none; cursor: pointer;
            padding: 9px 0; border-radius: 10px;
            background: linear-gradient(135deg, #f59e0b, #d97706); /* 琥珀色警示, 与常规按钮区分 */
            color: #fff; font-size: 13px; font-weight: 600; font-family: var(--font);
            transition: opacity 0.15s ease, transform 0.1s ease;
        }
        .btn-force:hover { opacity: 0.92; }
        .btn-force:active { transform: scale(0.98); }
        .force-wrap .tooltip {
            position: absolute; bottom: calc(100% + 10px); left: 50%; transform: translateX(-50%);
            width: max-content; max-width: 270px; padding: 9px 12px; border-radius: 10px;
            background: #1e293b; color: #e2e8f0; font-size: 11px; line-height: 1.6; font-weight: 400;
            text-align: left; box-shadow: var(--shadow); z-index: 6; pointer-events: none;
            opacity: 0; visibility: hidden; transition: opacity 0.15s ease 0.1s, visibility 0s linear 0.15s;
        }
        .force-wrap .tooltip::after {
            content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
            border: 6px solid transparent; border-top-color: #1e293b;
        }
        .force-wrap:hover .tooltip { opacity: 1; visibility: visible; transition-delay: 0s; }
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
        let host = null, fab, fabCore, fabBadge, chip, chipText, panel, summaryEl, bannerEl, barEl, barTextEl, listEl, btnBatch, forceToggle, forcePop, btnForce, btnSkin, skinBtns;
        let cancelObj = null;
        let batchBase = '';
        let toastEl = null, toastTimer = null;
        let skin = 'chameleon'; // FAB 皮肤: 变色龙(chameleon)|图标数字(number)|信号灯(signal)|进度光环(ring)

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
            const cool = isFailedInCooldown(unit.id);
            let sub = '今日未处理';
            if (todayHit && st) {
                sub = `${esc(st.msg || '')}${st.ts ? ' · ' + formatTime(st.ts) : ''}`;
                if (cool) sub += ' · 冷却中, 默认不参与批量';
            }
            const url = esc(unit.url);
            const fav = faviconSrc(unit);
            return `<div class="row${cool ? ' cool' : ''}">`
                + `<div class="row-main"><div class="row-name" data-url="${url}" title="新标签打开 ${url}">`
                + (fav ? `<img class="fav" src="${esc(fav)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '')
                + `<span class="nm">${esc(unit.name)}</span><span class="ext">↗</span></div>`
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
            fab.innerHTML = '<span class="fab-core">' + SVG_ICON + '</span><span class="fab-badge"></span>';
            fabCore = fab.querySelector('.fab-core');
            fabBadge = fab.querySelector('.fab-badge');
            skin = gmGet(K.skin, 'chameleon');

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
                    <button class="btn-skin" type="button" title="FAB 外观(皮肤)">外观</button>
                    <button class="panel-close" title="关闭">\u00d7</button>
                </div>
                <div class="skin-bar">
                    <span class="lbl">FAB:</span>
                    <button class="skin-btn" type="button" data-skin="chameleon" title="变色(默认): 全部完成→绿底✓无角标; 有站点未签→紫底✓ + 红底剩余数角标"><span class="skin-dot d1"></span>变色</button>
                    <button class="skin-btn" type="button" data-skin="number" title="数字: 有未签时 FAB 主体用大字直接显示剩余站数(绿角标=今日成功数); 全部完成→✓"><span class="skin-dot d2"></span>数字</button>
                    <button class="skin-btn" type="button" data-skin="signal" title="信号灯: 全部完成→绿底✓; 今日有失败→红底! + 失败数角标; 仅未完成→琥珀底✓ + 剩余数角标"><span class="skin-dot d3"></span>信号灯</button>
                    <button class="skin-btn" type="button" data-skin="ring" title="光环: 外圈按今日成功比例画渐变进度弧(青→品红, 带辉光呼吸); 全部完成→绿色满环; 今日有失败→琥珀到红色的警示弧; 绿角标=成功数"><span class="skin-dot d4"></span>光环</button>
                </div>
                <div class="banner"></div>
                <div class="batchbar"><span class="batchbar-text"></span><button class="stop">停止</button></div>
                <div class="list"></div>
                <div class="panel-foot">
                    <div class="btn-row">
                        <button class="btn-primary">批量签到</button>
                        <button class="force-toggle" title="展开 / 收起「强制批量签到」选项"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg></button>
                        <div class="force-pop">
                            <div class="force-wrap">
                                <button class="btn-force" type="button">强制批量签到</button>
                                <div class="tooltip">强制批量签到: 将今日「已失败且仍在冷却期(10 分钟)」的站点加入批量, 无视冷却直接重试点击, 适用于站点短暂故障/超时恢复后想立即补签。风险提示: 若站点持续不可用, 强制重试会反复触发点击, 可能触发站点风控/封号, 请确认站点可访问后再使用。</div>
                            </div>
                        </div>
                    </div>
                </div>`;
            summaryEl = panel.querySelector('#summary');
            bannerEl = panel.querySelector('.banner');
            barEl = panel.querySelector('.batchbar');
            barTextEl = panel.querySelector('.batchbar-text');
            listEl = panel.querySelector('.list');
            btnBatch = panel.querySelector('.btn-primary');
            forceToggle = panel.querySelector('.force-toggle');
            forcePop = panel.querySelector('.force-pop');
            btnForce = panel.querySelector('.btn-force');
            btnSkin = panel.querySelector('.btn-skin');
            skinBtns = Array.prototype.slice.call(panel.querySelectorAll('.skin-btn'));
            panel.querySelector('.panel-close').addEventListener('click', () => closePanel());
            barEl.querySelector('.stop').addEventListener('click', requestCancel);
            btnSkin.addEventListener('click', () => panel.classList.toggle('skin-open'));
            skinBtns.forEach((b) => b.addEventListener('click', () => setSkin(b.dataset.skin)));
            btnBatch.addEventListener('click', () => startBatch(false));
            forceToggle.addEventListener('click', () => {
                if (batchActive()) return;
                setForcePop(!forcePop.classList.contains('open'));
            });
            btnForce.addEventListener('click', () => {
                setForcePop(false);
                startBatch(true);
            });
            // 点击站点名 → 新标签页(前台)打开该站; 行内容每次 render 重建, 故用事件委托
            listEl.addEventListener('click', (e) => {
                const nameEl = e.target && e.target.closest ? e.target.closest('.row-name') : null;
                if (!nameEl) return;
                const url = nameEl.getAttribute('data-url');
                if (!url) return;
                try { GM_openInTab(url, { active: true }); }
                catch (err) { toast(`打开站点失败: ${url}`); }
            });
            // 图标加载失败(站点无 favicon/路径非标准/防外链) → 隐藏图标不占位, 站名不受影响;
            // img 的 error 事件不冒泡, 需捕获阶段委托(行每次 render 重建, 委托避免重复绑定)
            listEl.addEventListener('error', (e) => {
                const t = e.target;
                if (t && t.tagName === 'IMG' && t.classList.contains('fav')) {
                    t.style.display = 'none';
                }
            }, true);

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

        // 展开/收起「强制批量签到」选项区(同时旋转 ^ 按钮)
        function setForcePop(open) {
            forcePop.classList.toggle('open', !!open);
            forceToggle.classList.toggle('open', !!open);
        }

        // 切换 FAB 皮肤(存 GM, 跨站生效)
        function setSkin(id) {
            skin = id;
            gmSet(K.skin, id);
            panel.classList.remove('skin-open');
            render();
        }

        // 按当前皮肤与今日汇总刷新 FAB(c: countToday 结果)
        // 语义统一: 全部完成 vs 有站点未签到 必须有明显差异, 四种皮肤各按自身语言表达
        function applyFabSkin(c) {
            fab.classList.remove('ok', 'warn', 'err', 'ring', 'chameleon');
            const left = c.total - c.success;       // 未成功站数(含失败/pending/skipped/未处理)
            const allDone = c.total > 0 && left <= 0;
            switch (skin) {
                case 'number': { // 图标换脸: 全完成→✓; 有未签→主区大字剩余数; 绿角标=成功数(保进度)
                    if (allDone) fabCore.innerHTML = SVG_ICON;
                    else fabCore.innerHTML = `<span class="num">${left}</span>`;
                    setFabBadge(c.success);
                    break;
                }
                case 'signal': { // 信号灯: 完成=绿✓; 今日有失败=红底!+失败角标; 其余=琥珀✓+剩余角标
                    if (allDone) { fab.classList.add('ok'); fabCore.innerHTML = SVG_ICON; setFabBadge(0); }
                    else if (c.failed > 0) { fab.classList.add('err'); fabCore.innerHTML = '<span class="mark">!</span>'; setFabBadge(c.failed, 'err'); }
                    else { fab.classList.add('warn'); fabCore.innerHTML = SVG_ICON; setFabBadge(left, 'warn'); }
                    break;
                }
                case 'ring': { // 进度光环: 主体保持紫底; 外圈渐变弧=完成比例; 全完成→绿满环; 今日有失败→红警示弧
                    fab.classList.add('ring');
                    fabCore.innerHTML = SVG_ICON;
                    const pct = c.total > 0 ? Math.round(c.success / c.total * 100) : 0;
                    fab.style.setProperty('--ring-p', (allDone ? 100 : pct) + '%');
                    fab.classList.toggle('ok', allDone);
                    fab.classList.toggle('err', !allDone && c.failed > 0);
                    setFabBadge(c.success);
                    break;
                }
                default: { // chameleon 变色龙: 全完成→绿底✓(无角标); 有未签→紫底✓+红底剩余角标; 白色涟漪波纹(::before/::after)随皮肤常驻
                    fab.classList.add('chameleon');
                    fabCore.innerHTML = SVG_ICON;
                    if (allDone) { fab.classList.add('ok'); setFabBadge(0); }
                    else setFabBadge(left, 'err');
                }
            }
            if (skinBtns) skinBtns.forEach((b) => b.classList.toggle('active', b.dataset.skin === skin));
        }
        function setFabBadge(n, cls) {
            fabBadge.classList.remove('err', 'warn');
            if (cls) fabBadge.classList.add(cls);
            if (n > 0) {
                fabBadge.textContent = String(n);
                fabBadge.classList.add('show');
            } else {
                fabBadge.textContent = '';
                fabBadge.classList.remove('show');
            }
        }

        function render() {
            if (!host) return;
            const c = countToday();
            summaryEl.textContent = `今日 ${c.success}/${c.total} 已成功`;
            applyFabSkin(c);
            let html = '';
            for (const g of GROUPS) {
                const isMulti = g.units.length > 1;
                if (isMulti) html += `<div class="g-head">${esc(g.name)}</div>`;
                for (const u of g.units) html += buildRowHtml(u);
            }
            listEl.innerHTML = html;
            const running = batchActive();
            const normalLeft = remainingCandidates(false).length;
            const forceTotal = remainingCandidates(true).length;
            const forceExtra = forceTotal - normalLeft; // 仅在强制模式下才纳入的失败冷却站数
            if (normalLeft > 0) {
                btnBatch.textContent = `批量签到 (剩余 ${normalLeft})`;
            } else {
                btnBatch.textContent = forceExtra > 0 ? '批量签到 (常规已完成)' : '批量签到 (今日已完成)';
            }
            btnBatch.disabled = running || normalLeft === 0;
            // 存在可强制重试的失败冷却站才显示展开钮; 全部签到完毕或批量进行中不显示
            if (!running && forceExtra > 0) {
                btnForce.textContent = `强制批量签到 (${forceTotal} 站)`;
                forceToggle.style.display = '';
                forceToggle.disabled = false;
                btnBatch.classList.remove('full'); // 拆分按钮组: 批量钮左侧圆角
            } else {
                forceToggle.style.display = 'none';
                forceToggle.disabled = true;
                btnBatch.classList.add('full'); // 独立按钮: 恢复完整圆角
                setForcePop(false);
            }
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
        function showBanner(msg, variant, actionText, onAction) {
            bannerEl.className = 'banner' + (variant ? ' ' + variant : '');
            bannerEl.textContent = '';
            const span = document.createElement('span');
            span.textContent = msg;
            bannerEl.appendChild(span);
            if (actionText && onAction) {
                const btn = document.createElement('button');
                btn.textContent = actionText;
                btn.addEventListener('click', onAction);
                bannerEl.appendChild(btn);
            }
            bannerEl.style.display = 'flex';
        }
        function hideBanner() {
            bannerEl.style.display = 'none';
            bannerEl.textContent = '';
            bannerEl.className = 'banner';
        }
        function closePanel() {
            panel.classList.remove('show');
            panel.classList.remove('skin-open');
            hideBanner();
        }
        function showBatchDone() {
            endBatch();
            openPanel();
            showBanner('\u2713 批量签到完成', '', null, null);
            toast('批量签到完成');
            setTimeout(hideBanner, 8000);
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
            endBatch, isCancelled, requestCancel, armCancel, showBatchDone,
            showBanner, hideBanner
        };
    })();

    // ==================== 批量任务引擎(常驻发起页 + 后台标签串行调度) ====================
    // 方案: 发起页(用户停留页)建任务后不开导航, 由调度循环逐个:
    //   GM_openInTab 后台开新标签执行签到 → 标签页将结果写入 GM 状态 → 发起页轮询读取
    // 优点: 站点无法访问/打开超时不会"断链"(接力导航死在浏览器错误页), 调度页始终
    // 存活, 单站失败/超时由调度窗口兜底自动跳过, 全部完成后停在发起页弹完成面板。
    // 全程低频(单站 1 次点击) + 站间可配缓冲, 不并行; 后台标签用完即关。

    // 待处理候选: enabled 且非今日成功且非"待确认(pending)未过期";
    // 默认排除"今日失败且仍在冷却期"的站(避免白开标签重复点击), force=true 时纳入(强制重试)
    function remainingCandidates(force) {
        const out = [];
        for (const u of UNITS) {
            if (u.enabled === false) continue;
            if (isSuccessToday(u.id)) continue;
            const prev = readStatus(u.id);
            if (prev && prev.status === 'pending' && prev.date === todayStr()
                && Date.now() - prev.ts < MIN_INTERVAL) continue;
            if (!force && isFailedInCooldown(u.id)) continue;
            out.push(u.id);
        }
        return out;
    }

    // 发起页开始批量: force=true 时纳入"今日失败且仍在冷却期"的站并强制重试(无视冷却点击)
    function startBatch(force) {
        force = !!force;
        const list = remainingCandidates(force);
        if (list.length === 0) {
            UI.toast('今日签到均已成功或均在待确认中');
            return;
        }
        const taskId = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        const task = { taskId, list, index: 0, startedAt: Date.now(), hb: Date.now(), force };
        saveTask(task);
        console.log(`${ScriptName} 批量任务已创建: ${list.join(', ')}`);
        UI.toast(`批量开始, 共 ${list.length} 个站点`);
        runBatchScheduler(task); // async, 发起页停留展示进度
    }

    // 后台打开目标站标签(签到任务由该页执行, 结果经 GM 状态回传)
    function openTaskTab(unit, taskId) {
        const tab = GM_openInTab(buildTaskUrl(unit, taskId), { active: false, insert: true });
        return tab;
    }

    // 刷新任务心跳: 证明调度页仍存活(其它页面据此区分"调度中"与"已中断"), 节流写入
    function touchTask(task) {
        const now = Date.now();
        if (task._hb && now - task._hb < 4000) return; // 4s 内已写, 避免高频 GM 写入
        task.hb = now;
        task._hb = now;
        saveTask(task);
    }

    // 调度循环(发起页常驻): 逐个后台标签执行, 轮询结果后推进
    async function runBatchScheduler(task) {
        UI.armCancel(); // 整个批量过程可取消(含单站调度窗口内)
        UI.render();
        while (task.index < task.list.length) {
            const unit = UNIT_MAP.get(task.list[task.index]);
            if (!unit || unit.enabled === false) {
                task.index += 1;
                saveTask(task);
                continue;
            }
            // 该站可能已被其它页面/被动流程完成, 跳过
            if (isSuccessToday(unit.id)) {
                task.index += 1;
                saveTask(task);
                continue;
            }
            UI.showBatch({ index: task.index + 1, total: task.list.length, unitName: unit.name });
            touchTask(task);

            // 打开后台标签执行; 记录打开前该站状态时间戳, 用于识别"新写入"
            const prevTs = (readStatus(unit.id) || { ts: 0 }).ts;
            let tab = null;
            try {
                tab = openTaskTab(unit, task.taskId);
            } catch (e) {
                console.warn(`${ScriptName} [${unit.name}] 打开后台标签失败: ${e.message}`);
                writeStatus(unit.id, 'failed', '打开后台标签失败');
                task.index += 1;
                saveTask(task);
                UI.render();
                continue;
            }

            // 调度窗口内轮询: 读到该站"今日且比打开前更新"的状态即结算
            const deadline = Date.now() + PER_UNIT_TIMEOUT_MS;
            let settle = null;
            let pendingSince = 0;
            while (Date.now() < deadline) {
                if (UI.isCancelled()) break;
                await sleep(POLL_INTERVAL_MS);
                touchTask(task);
                const st = readStatus(unit.id);
                if (st && st.date === todayStr() && st.ts > prevTs) {
                    if (st.status === 'pending') {
                        // pending 需观察: 点击跳转型落地页稍后会改写 success/failed;
                        // 若 PENDING_GRACE_MS 内未改写(如 confirmManual 站)则以 pending 结算
                        if (!pendingSince) pendingSince = Date.now();
                        else if (Date.now() - pendingSince > PENDING_GRACE_MS) { settle = st; break; }
                        continue;
                    }
                    settle = st; // success / failed / skipped
                    break;
                }
            }
            // 收尾: 关闭后台标签
            if (tab && typeof tab.close === 'function') {
                try { tab.close(); } catch (e) { /* 标签已关闭则忽略 */ }
            }
            if (UI.isCancelled()) break;

            if (!settle) {
                // 调度窗口耗尽仍无回写: 站点无法访问/页面加载失败/脚本未运行 → 记为失败并跳过
                writeStatus(unit.id, 'failed', '站点暂时无法访问或超时, 已跳过');
                settle = { status: 'failed', msg: '站点暂时无法访问, 已跳过' };
            }
            UI.updateBatchResult(unit.name, settle);
            UI.render();

            // 推进到下一站
            task.index += 1;
            saveTask(task);
            if (task.index >= task.list.length) break;
            const next = UNIT_MAP.get(task.list[task.index]);
            if (!next) break;
            // 本站完成后按配置等待缓冲(如贴吧吧间防风控), 期间可取消
            const delay = (unit.batchDelayMs != null ? unit.batchDelayMs : DEFAULT_BATCH_DELAY_MS) || 0;
            if (delay > 0) {
                const cancelled = await UI.countdown(delay, next.name);
                if (cancelled) break;
            }
        }

        if (UI.isCancelled()) {
            clearTask();
            UI.endBatch();
            UI.toast('批量已取消, 停留在当前页面');
            UI.render();
            return;
        }
        // 全部处理完: 停在发起页, 弹出完成面板
        clearTask();
        UI.endBatch();
        UI.showBatchDone();
    }

    // ==================== 后台任务标签页(执行 + 落地结算) ====================
    // 调度页 GM_openInTab 打开的标签: URL 带 ptacTask, 任务存在且本页命中任务当前
    // unit → 执行单站签到并把结果写入 GM 状态(调度页轮询读取); 不在此推进任务。
    // 注: 本函数不依赖 UI(FAB/面板), 标签页为后台打开, 不渲染以免打扰。
    async function runBatchTabPage(task) {
        const unit = UNIT_MAP.get(task.list[task.index]);
        // 安全校验: 任务指向的 unit 必须存在, 且当前页面确实命中该 unit
        if (!unit || !matchUnit(unit, location.href)) {
            console.warn(`${ScriptName} 后台标签页与任务不匹配, 终止`);
            return;
        }
        const res = await runUnitWithTimeout(unit, { mode: 'batch', forceCooldown: !!task.force });
        console.log(`${ScriptName} [${unit.name}] 后台标签执行完成: ${res.status}(${res.reason || ''})`);
        // runUnit 的 skipped(冷却中/今日成功)不落盘状态, 而调度页靠状态回写判定完成:
        // 若今日尚无任何结果写入, 补写本次结果, 避免调度页等待到超时误判为"无法访问"
        const st = readStatus(unit.id);
        if (!st || st.date !== todayStr()) {
            writeStatus(unit.id, res.status || 'skipped', res.msg || '');
        }
    }

    // 落地页结算(调度中): 后台标签点击跳转到落地页(URL 无 ptacTask)时, 本页命中
    // 任务当前 unit → 只检测已签并写成功(不推进任务, 由调度页轮询推进); 未命中已签
    // 则不改写(保留 pending, 由调度页宽限观察后决定)
    async function settleUnitOnLandingPage(unit) {
        if (isSuccessToday(unit.id)) return;
        try {
            const already = await detectAlreadyCheckedIn(unit);
            if (already.hit) {
                writeStatus(unit.id, 'success', `落地页确认已签到(${already.source})`);
                console.log(`${ScriptName} [${unit.name}] 落地页结算: ${already.source}`);
            }
        } catch (e) {
            console.warn(`${ScriptName} [${unit.name}] 落地页结算异常: ${e.message}`);
        }
    }

    // 中断恢复: 调度页消失(hb 陈旧)后, 用户回到任意匹配页 → 提供横幅一键恢复调度
    function offerBatchResume(task) {
        const unit = UNIT_MAP.get(task.list[task.index]) || null;
        const name = unit ? unit.name : (task.list[task.index] || '');
        UI.openPanel(); // 横幅在面板内, 需先展开面板才能让用户看到恢复入口
        UI.showBanner(
            `检测到中断的批量任务(第 ${task.index + 1}/${task.list.length} 站「${name}」)`,
            'warn', '恢复批量', async () => {
                UI.hideBanner();
                task.hb = Date.now(); // 接管调度: 刷新心跳
                saveTask(task);
                UI.openPanel();
                await runBatchScheduler(task);
            }
        );
        UI.render();
    }

    // ==================== 主流程 ====================
    async function main() {
        collectFavicon(); // 路过收集当前站真实 icon URL(仅匹配站), 供面板列表图标显示
        let task = loadTask();
        if (task && isTaskStale(task)) {
            console.log(`${ScriptName} 清理过期批量任务(中断超过 ${TASK_STALE_MS / 60000} 分钟)`);
            clearTask();
            task = null;
        }

        const urlTaskId = readTaskIdFromUrl();
        if (urlTaskId) {
            // 后台任务标签页(调度页 GM_openInTab 打开): 执行本站并把结果写入状态;
            // 不注入 UI(FAB/面板), 避免后台标签闪烁干扰
            if (task && task.taskId === urlTaskId) {
                const curUnitId = task.list && task.list[task.index];
                const curUnit = curUnitId ? UNIT_MAP.get(curUnitId) : null;
                if (curUnit && matchUnit(curUnit, location.href)) {
                    console.log(`${ScriptName} 后台任务标签页, 执行站点: ${curUnit.name}`);
                    await runBatchTabPage(task);
                } else {
                    console.warn(`${ScriptName} 后台标签页与任务当前位置不匹配, 跳过`);
                }
            }
            return; // 任务标签页不初始化 UI
        }

        // 普通访问页
        UI.init();
        if (task) {
            const curUnitId = task.list && task.list[task.index];
            const curUnit = curUnitId ? UNIT_MAP.get(curUnitId) : null;
            const curHit = !!(curUnit && matchUnit(curUnit, location.href));
            const hbFresh = Date.now() - (task.hb || 0) < HEARTBEAT_FRESH_MS;
            if (hbFresh) {
                // 调度进行中(发起页存活): 本页命中任务当前站点则视为跳转落地页, 只结算不推进;
                // 未命中则被动签到但跳过任务当前位置站点, 防并行重复触发
                if (curHit) {
                    console.log(`${ScriptName} 批量调度中, 当前页为任务站点落地页, 落地结算`);
                    await settleUnitOnLandingPage(curUnit);
                } else {
                    console.log(`${ScriptName} 批量调度中, 被动模式跳过任务当前位置站点`);
                    await runPassiveMode(curUnitId ? [curUnitId] : []);
                }
            } else {
                // 调度者已中断(发起页被关/崩溃等): 提供恢复入口; 同时当前页仍正常被动
                // 签到, 但跳过任务当前位置站点, 避免与"恢复批量"重复触发该站
                console.log(`${ScriptName} 检测到中断的批量任务(调度心跳过期), 提供恢复入口`);
                offerBatchResume(task);
                if (!curHit) {
                    await runPassiveMode(curUnitId ? [curUnitId] : []);
                }
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
