// ==UserScript==
// @name         PTAutoCheckIn-v2
// @name:zh-CN   PT多站点自动签到v2
// @namespace    https://github.com/ABackerNINI/TampermonkeyScripts
// @version      2026.09.15.1
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
// @match        *://*.m-team.cc/*
// @match        *://*.hhanclub.net/*
// @match        *://*.digitalcore.club/*
// @match        *://*.hd-space.org/*
// @match        *://*.kufirc.com/*
// @match        *://*.pt.521.best/*
// @match        *://*.sportz247.bar/*
// @match        *://*.nodeloc.com/*
// @match        *://*.u2.dmhy.org/*
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
const RETRY_LOCK_MS = 30 * 1000;               // 单站前台重试互斥锁窗口(ms): 同站两个重试页不可并发点击; 跳转型页面跳走后锁自然过期

// 存储 key 前缀(GM 存储按脚本共享, 跨域可读, 满足"任意站点查看同一份状态")
const K = {
    status: (uid) => `ptac_status_${uid}`,     // {date:'YYYY-MM-DD', status:'success|failed|pending|skipped', msg, ts}
    cooldown: (uid) => `ptac_cooldown_${uid}`, // 上次触发时间戳(ms)
    favicon: (uid) => `ptac_favicon_${uid}`,   // 路过收集的站点真实 icon URL(面板列表图标用)
    skin: 'ptac_skin',                          // FAB 外观皮肤: chameleon|number|signal|ring
    task: 'ptac_task',                          // 批量任务 {taskId, list:[unitId...], index, startedAt, hb(调度心跳)}
    alert: (uid) => `ptac_alert_${uid}`,       // 签到按钮重现提醒 {date, btnText, ts, state:'on'|'off'}(见 P25)
    retryLock: (uid) => `ptac_retry_${uid}`    // 单站前台重试一次性锁(时间戳 ms): 防同站重试页/落地页并发强点(30s 窗口)
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
    //   landingCheckedInContent: 落地页确认标记文本(可选) — 签到动作导向的落地页上签到后才出现的
    //     唯一文本(如 PTT「总签到记录」表头)即判已签; "落地页"由签到按钮 href 推导(isLandingPageOf:
    //     显式 attendanceUrl 优先, 否则解析 checkInSelector 的 href 属性选择器得路径), 不写死
    //     attendance.php —— 各站落地页命名可不同(attendance/signin/...), 跟签到按钮走天然可扩展;
    //     整页文本匹配、纯文本不绑 class(class 可能随改版变化), 供"落地页无签到详情/无按钮反馈"的站
    //     确认; 非落地页不检测(防其它区域同文本误报); 等价于只对该站启用受限版整页已签检测
    //   successDetect: 点击后成功检测列表(同页 AJAX 场景) [{type:'url'|'text'|'func', ...}], 任一命中即成功
    //   stateSignals(可选, P25 重现检测的载体无关入口状态信号, .26): {checked:[信号], checkable:[信号]}
    //     — 引擎不再假设入口状态只在按钮可见文本里; checked 任一命中=入口呈已签, checkable 任一命中=
    //     可签(重现判定), checkable 不配=反向常驻按钮站(入口存在且非已签即可签); 信号项 {kind, ...}:
    //     {kind:'text', contains}(visibleText 含) / {kind:'attr', name, contains?}(属性值含) /
    //     {kind:'attrEq', name, eq}(属性值精确等于) / {kind:'class', name}(classList 含) /
    //     {kind:'fn', fn}(自定义谓词) / {kind:'exists'}(元素存在即命中); 不配时旧文本字段自动翻译
    //     (checked=[text alreadyCheckedInContent], checkable=有 checkInContent 则 [text checkInContent] 否则
    //     null→反向站), 文本站零改动行为不变; 结构排除同旧: 无 checkInSelector 或无已签基准 → 无重现语义
    //   confirmManual: true 表示无可靠成功特征, 点击后记为 pending 待人工确认
    //   detectOnly: true 表示"仅检测已签状态, 不自动签到"——签到需人工验证(验证码)的站(如 U2):
    //     已签检测照常执行(命中即 success), 未签时不做任何动作(不点击/不写冷却/不记失败),
    //     状态留待人工站内签到(面板提示"需人工签到"); 该站不参与批量(remainingCandidates 排除)
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
            // PTT(PTTime): 签到落地页(attendance.php)本身不显示"签到详情/签到已得"类反馈文案, 但签到成功
            // 后落地页会出现「总签到记录」记录表头 → 以其为落地确认标记(纯文本匹配, 不绑 class="mt10 fwb"——
            // class 可能随改版变化); 见配置头 landingCheckedInContent 说明
            id: 'pttime', name: 'PTTime',
            url: 'https://www.pttime.org/',
            checkInSelector: 'a.fcb[href*="attendance.php"]',
            checkInContent: '签到领魔力',
            alreadyCheckedInContent: '签到详情',
            landingCheckedInContent: '总签到记录', // 落地页确认标记: 签到按钮导向页(路径由按钮 href 推导)整页文本命中才判已签
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
            //   2026.09.08 实测: 点击签到成功后按钮即时变「已签到」= 可靠成功特征 → 弃 confirmManual(否则
            //   明明成功却记 pending 待人工确认), 改 successDetect 轮询按钮文案 5s: 变已签 → success;
            //   5s 仍未变(响应慢/未成功) → 走通用回退后记 failed(不再卡 pending, 语义见 detectSuccess)
            id: 'pting', name: '蜂巢',
            url: 'https://pting.club/',
            checkInSelector: 'button[data-slot="sidebar-user-check-in"]',
            alreadyCheckedInContent: '已签到',
            successDetect: [
                { type: 'text', selector: 'button[data-slot="sidebar-user-check-in"]', text: '已签到', timeout: 5000 }
            ],
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

        { // MTeam: 2026.09.08 接入 — 站方新站(kp.m-team.cc)无签到按钮/页面, 登录态访问主页
            //   /index 即自动完成当日签到(隐式签到, 无点击对象); 成功特征 = 主页渲染出「站点数据」
            //   卡片(antd Card 标题 .ant-card-head-title), 简体/繁体双文本防 locale 差异; 未登录会被
            //   重定向走登录页 → 无卡片 → 判 failed(需登录后脚本才会成功)。
            //   显式 match 只认 kp 子域 /index: 详情页/其它子域不触发, 防把"浏览页"误当签到动作
            //   (否则详情页无卡片会误报 failed 并污染当日状态); 无按钮 → 不配 checkInSelector /
            //   alreadyCheckedInContent(无按钮可检可点), 步骤仅等待 SPA 渲染, 成功靠 successDetect
            id: 'mteam', name: 'MTeam',
            url: 'https://kp.m-team.cc/index',
            match: (href) => {
                try {
                    const u = new URL(href);
                    return u.hostname.replace(/^www\./, '') === 'kp.m-team.cc'
                        && u.pathname.replace(/\/+$/, '') === '/index';
                } catch (e) { return false; }
            },
            steps: [{ type: 'wait', ms: 3000, description: '等待 SPA 主页渲染' }],
            successDetect: [{
                type: 'func',
                fn: async () => {
                    try {
                        await waitForTrue(() => {
                            for (const el of document.querySelectorAll('.ant-card-head-title')) {
                                const t = visibleText(el);
                                if (t.includes('站点数据') || t.includes('站點數據')) return true;
                            }
                            return null;
                        }, 16000, 300, '站点数据卡片');
                        return true;
                    } catch (e) { return false; }
                }
            }]
        },
        { // DigitalCore: 2026.09.08 接入 — 与 MTeam 同型「无按钮/隐式签到」站: 登录态访问
            //   首页即自动完成当日签到(无签到按钮可点); 成功特征 = 页面渲染出导航链接
            //   a[href="/alltorrents"](文案 All Torrents, 登录态导航栏才有)。显式 match 限定
            //   首页(根路径或 /index——DigitalCore 同 MTeam 为 SPA 型导航; 排除详情页/种子列表
            //   等, 防把浏览当签到动作误报; 未登录重定向登录页 → 无导航 → failed, 需登录后脚本
            //   才会成功)。无 checkInSelector/alreadyCheckedInContent → 按钮级/P25 重现检测自动跳过
            id: 'digitalcore', name: 'DigitalCore',
            url: 'https://digitalcore.club/',
            match: (href) => {
                try {
                    const u = new URL(href);
                    const p = u.pathname.replace(/\/+$/, '');
                    return u.hostname.replace(/^www\./, '') === 'digitalcore.club'
                        && (p === '' || p === '/index');
                } catch (e) { return false; }
            },
            steps: [{ type: 'wait', ms: 3000, description: '等待页面渲染' }],
            successDetect: [{
                type: 'func',
                fn: async () => {
                    try {
                        await waitForTrue(() => {
                            for (const a of document.querySelectorAll('a[href="/alltorrents"]')) {
                                if (visibleText(a).includes('All Torrents')) return true;
                            }
                            return null;
                        }, 16000, 300, 'All Torrents 导航链接');
                        return true;
                    } catch (e) { return false; }
                }
            }]
        },
        { // HD-Space: 2026.09.08 接入 — 同 MTeam「访问首页即签到」隐式签到型: 登录态访问首页
            //   自动完成当日签到; 成功特征 = 页面出现「Last access:」文本(整页文本检测; 该行随
            //   登录态首页渲染, 记录最近访问/签到时间)。match 限定首页根路径(排除种子/详情/论坛
            //   等页面误触发); 未登录被重定向 → 无该文本 → failed(需登录后脚本才会成功)。
            //   无 checkInSelector/alreadyCheckedInContent → 按钮级/P25 重现检测自动跳过
            id: 'hdspace', name: 'HD-Space',
            url: 'https://hd-space.org/',
            match: (href) => {
                try {
                    const u = new URL(href);
                    const p = u.pathname.replace(/\/+$/, '');
                    return u.hostname.replace(/^www\./, '') === 'hd-space.org' && p === '';
                } catch (e) { return false; }
            },
            steps: [{ type: 'wait', ms: 3000, description: '等待页面渲染' }],
            successDetect: [{ type: 'text', text: 'Last access:', timeout: 16000 }]
        },
        { // Kufirc: 2026.09.08 接入 — 同 DigitalCore/HD-Space 隐式签到型: 登录态访问首页即自动
            //   完成当日签到; 成功特征 = 导航链接 a[href="/torrents.php"](文案 Torrents, 登录态导航栏
            //   才有; 未登录页面显示 Login/Reactivate 无此链接)。match 限定首页根路径(排除种子/
            //   详情等页面误触发); 未登录 → 无 Torrents 链接 → failed(需登录后脚本才会成功)。
            //   无 checkInSelector/alreadyCheckedInContent → 按钮级/P25 重现检测自动跳过
            id: 'kufirc', name: 'Kufirc',
            url: 'https://kufirc.com/',
            match: (href) => {
                try {
                    const u = new URL(href);
                    const p = u.pathname.replace(/\/+$/, '');
                    return u.hostname.replace(/^www\./, '') === 'kufirc.com' && p === '';
                } catch (e) { return false; }
            },
            steps: [{ type: 'wait', ms: 3000, description: '等待页面渲染' }],
            successDetect: [{
                type: 'func',
                fn: async () => {
                    try {
                        await waitForTrue(() => {
                            for (const a of document.querySelectorAll('a[href="/torrents.php"]')) {
                                if (visibleText(a).includes('Torrents')) return true;
                            }
                            return null;
                        }, 16000, 300, 'Torrents 导航链接');
                        return true;
                    } catch (e) { return false; }
                }
            }]
        },
        { // 凤凰PT: 2026.09.08 接入 — 同 MTeam 隐式签到型: 登录态访问首页即自动完成当日签到
            //   (NexusPHP 传统中文站, 未登录 index.php 显示登录页)。成功特征 = 导航链接
            //   a[href="torrents.php"][rel="sub-menu"](文案「种子」, 登录态导航菜单才有; 注意 href 为
            //   相对路径不带前导斜杠, 且带 rel="sub-menu" 属性)。match 限定首页(根或 /index.php);
            //   未登录 → 重定向登录页无该链接 → failed(需登录后脚本才会成功)。
            //   无 checkInSelector/alreadyCheckedInContent → 按钮级/P25 重现检测自动跳过
            id: 'fenghuang', name: '凤凰PT',
            url: 'https://pt.521.best/index.php',
            match: (href) => {
                try {
                    const u = new URL(href);
                    const p = u.pathname.replace(/\/+$/, '');
                    return u.hostname.replace(/^www\./, '') === 'pt.521.best'
                        && (p === '' || p === '/index.php');
                } catch (e) { return false; }
            },
            steps: [{ type: 'wait', ms: 3000, description: '等待页面渲染' }],
            successDetect: [{
                type: 'func',
                fn: async () => {
                    try {
                        await waitForTrue(() => {
                            for (const a of document.querySelectorAll('a[href="torrents.php"][rel="sub-menu"]')) {
                                if (visibleText(a).includes('种子')) return true;
                            }
                            return null;
                        }, 16000, 300, '种子导航链接');
                        return true;
                    } catch (e) { return false; }
                }
            }]
        },
        { // Sportz Bar(F1GP): 2026.09.08 接入 — 同 MTeam 隐式签到型: 登录态访问首页即自动完成
            //   当日签到(xbtitFM 传统站, 未登录显示 Please Login 无导航菜单)。成功特征 = 导航链接
            //   a.level1-a.drop[href="#"](文案 Torrent Menu, 登录态主导航下拉才有; href 为 "#" 锚点,
            //   class 为 level1-a drop)。match 限定首页(根或 /index.php); 未登录 → 无该链接 → failed
            //   (需登录后脚本才会成功)。无 checkInSelector/alreadyCheckedInContent → 按钮级/P25 重现检测自动跳过
            id: 'sportz247', name: 'Sportz Bar',
            url: 'https://sportz247.bar/index.php',
            match: (href) => {
                try {
                    const u = new URL(href);
                    const p = u.pathname.replace(/\/+$/, '');
                    return u.hostname.replace(/^www\./, '') === 'sportz247.bar'
                        && (p === '' || p === '/index.php');
                } catch (e) { return false; }
            },
            steps: [{ type: 'wait', ms: 3000, description: '等待页面渲染' }],
            successDetect: [{
                type: 'func',
                fn: async () => {
                    try {
                        await waitForTrue(() => {
                            for (const a of document.querySelectorAll('a.level1-a.drop[href="#"]')) {
                                if (visibleText(a).includes('Torrent Menu')) return true;
                            }
                            return null;
                        }, 16000, 300, 'Torrent Menu 导航链接');
                        return true;
                    } catch (e) { return false; }
                }
            }]
        },
        { // HHCLUB: 2026.09.08 接入 — 签到入口藏在头像下拉菜单: 先点 img#user-avatar 展开菜单,
            //   再点菜单内 a[href="attendance.php"](文案[签到得憨豆])→ 跳 attendance.php; 落地页渲染
            //   当月日历 <p id="date-display">(内容为动态 yyyy-mm, 如 2026-09)→ 判已签。
            //   date-display 为动态文本, landingCheckedInContent(静态串匹配)不适用 → 用 alreadyCheck
            //   自定义函数(落地页限定 + 动态算当月前缀), 挂统一 detectAlreadyCheckedIn → 被动/批量/
            //   落地结算三路径自动共用; 无"签到已得"类已签反馈按钮。
            //   2026.09.08 实测: 普通触发偶发"未检测到成功特征"、随后"整流程超时", 强制重试即成功 →
            //   点击后导航不稳定(SPA 路由/慢导航/首访点击无效). 修复双保险:
            //   ① steps 头像改"点-验-重试"函数步骤: 点击后轮询签到链接"可见"(getClientRects>0, 非仅
            //      DOM 存在——隐藏元素 .click() 不触发导航), 未现则再点 avatar, 最多 3 次, 消除首访/
            //      页面未就绪导致程序化 click 无效的时序抖动;
            //   ② 补 successDetect func 同页确认: 点击后轮询 location.pathname 变 attendance.php 且
            //      #date-display 含当月(8s) → SPA 路由/800ms 后才跳转(无 pagehide)时同页也能确认成功,
            //      不再秒判 failed; 整页跳转仍走落地结算(两通道并存互不冲突)
            id: 'hhclub', name: 'HHCLUB',
            url: 'https://hhanclub.net/',
            checkInSelector: 'a[href*="attendance.php"]',
            checkInContent: '[签到得憨豆]',
            alreadyCheck: async () => {
                // 非签到落地页不判(防首页/其它区域误报)
                if (!/attendance\.php/i.test(location.pathname)) return false;
                try {
                    let hit = false;
                    await waitForTrue(() => {
                        const el = document.getElementById('date-display');
                        if (!el) return null;
                        const d = new Date();
                        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        hit = visibleText(el).includes(ym);
                        return hit ? true : null;
                    }, 3000, 200, '落地页日历(#date-display 当月)');
                    return hit;
                } catch (e) { return false; }
            },
            // 同页/慢导航成功确认: SPA 路由或 pagehide 前 URL 已变时, 轮询到 attendance.php + 当月日历即 success
            successDetect: [{
                type: 'func',
                fn: async () => {
                    try {
                        await waitForTrue(() => {
                            if (!/attendance\.php/i.test(location.pathname)) return null;
                            const el = document.getElementById('date-display');
                            if (!el) return null;
                            const d = new Date();
                            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                            return visibleText(el).includes(ym) ? true : null;
                        }, 8000, 300, '进入 attendance.php 且日历为当月');
                        return true;
                    } catch (e) { return false; }
                }
            }],
            steps: [
                { // 点击头像展开签到菜单(点-验-重试): 点击后轮询签到链接可见(getClientRects>0——菜单内
                    //   链接可能常驻 DOM 但 display:none, 隐藏元素程序化 .click() 不触发导航), 未现则再点
                    //   avatar(点击是 toggle, 奇数次开), 最多 3 次; 消除首访/页面未就绪的点击无效
                    type: 'function',
                    description: '点击头像展开签到菜单(点-验-重试, 最多3次)',
                    func: async () => {
                        const linkVisible = () => {
                            const a = document.querySelector('a[href*="attendance.php"]');
                            if (!a) return null;
                            const r = a.getClientRects();
                            return r && r.length > 0 ? a : null;
                        };
                        for (let i = 0; i < 3; i++) {
                            const avatar = document.querySelector('img#user-avatar');
                            if (avatar) {
                                console.log(`${ScriptName} [HHCLUB] 点击头像展开菜单 (尝试 ${i + 1}/3)`);
                                avatar.click();
                            } else {
                                console.warn(`${ScriptName} [HHCLUB] 未找到头像 img#user-avatar`);
                            }
                            try {
                                await waitForElement(linkVisible, 2500);
                                await sleep(300); // 菜单动画就位
                                return;
                            } catch (e) {
                                console.warn(`${ScriptName} [HHCLUB] 签到链接不可见, 重试 (${i + 1}/3)`);
                            }
                        }
                        throw new Error('头像菜单展开失败(签到链接 3 次重试后仍不可见)');
                    }
                },
                CLICK_CHECK_IN
            ]
        },

        { // U2 特殊: showup.php 签到需人工输入验证码 → detectOnly 仅检测状态、不自动签到
          id: 'u2', name: 'U2',
          url: 'https://u2.dmhy.org/',
          detectOnly: true, // 仅检测已签状态(未签不点/不记失败/不进批量), 由人工在站内完成签到
          checkInSelector: 'a[href*="showup.php"]', // 不依赖 faqlink class(2026.09.07 批量去 class 教训)
          checkInContent: '立即签到', // 未签文案: 兼作「按钮重现提醒」正向判定基准(P25)
          alreadyCheckedInContent: '已签到', // 按钮文案: 立即签到(未签) → 已签到(已签), 待实测校准
        },

        { // NodeLoc: 2026.09.08 接入 — Discourse 论坛按钮签到站: 首页「每日签到」图标按钮
            //   (button.checkin-button, no-text 无可见文本——只有 svg 图标; 可签态 title/aria-label=
            //   「每日签到」; 点击后同页变 class 含 checked-in + title/aria-label=「您今天已经签到过了」)。
            //   引擎按钮通道(click_checkin/按钮级已签)依赖 visibleText → 此按钮可见文本为空, 故已签判定
            //   走 alreadyCheck 自定义(class/title 属性), 点击走 function 步骤, 成功走 func successDetect;
            //   P25 重现检测经 stateSignals(class/attr 载体信号)纳入(.26 通用化改造): checked=class 含
            //   checked-in 或 title/aria-label 含「已经签到过」, checkable=title/aria-label 含「每日签到」
            //   (该词同时作为已签态与可签态区分, 两态互斥不误判)。match 限首页根路径(排除话题/节点页
            //   防无按钮误报 failed 污染当日状态)
            id: 'nodeloc', name: 'NodeLoc',
            url: 'https://www.nodeloc.com/',
            match: (href) => {
                try {
                    const u = new URL(href);
                    const p = u.pathname.replace(/\/+$/, '');
                    return u.hostname.replace(/^www\./, '') === 'nodeloc.com' && p === '';
                } catch (e) { return false; }
            },
            // 入口(供 P25 重现检测 readEntryState 定位; 仅首页根路径有, match 已保证)
            checkInSelector: 'button.checkin-button',
            // 载体无关已签/可签信号(P25 重现检测用; 无文本 → 走 class/attr 载体)
            stateSignals: {
                // 已签: Discourse 点击后按钮 class 加 checked-in, title/aria-label=「您今天已经签到过了」
                checked: [
                    { kind: 'class', name: 'checked-in' },
                    { kind: 'attr', name: 'title', contains: '已经签到过' },
                    { kind: 'attr', name: 'aria-label', contains: '已经签到过' }
                ],
                // 可签(重现判定): 未签态 title/aria-label=「每日签到」
                checkable: [
                    { kind: 'attr', name: 'title', contains: '每日签到' },
                    { kind: 'attr', name: 'aria-label', contains: '每日签到' }
                ]
            },
            // 已签判定(自定义, 供 detectAlreadyCheckedIn 第 1 通道): 按钮 class 含 checked-in 或
            // title/aria-label 含「已经签到过」(Discourse 点击后已签态); 未登录页无按钮 → false
            alreadyCheck: async () => {
                try {
                    const btn = document.querySelector('button.checkin-button');
                    if (!btn) return false;
                    if (btn.classList.contains('checked-in')) return true;
                    const label = btn.getAttribute('title') || btn.getAttribute('aria-label') || '';
                    return /已经签到过/.test(label);
                } catch (e) { return false; }
            },
            steps: [{
                type: 'function',
                description: '点击每日签到按钮(未签才点)',
                func: async () => {
                    const btn = await waitForElement('button.checkin-button', 10000);
                    if (!btn) return;
                    if (btn.classList.contains('checked-in')) return; // 已签不点
                    const label = btn.getAttribute('title') || btn.getAttribute('aria-label') || '';
                    if (/已经签到过/.test(label)) return; // 双保险
                    console.log(`${ScriptName} [NodeLoc] 点击每日签到按钮`);
                    btn.click();
                }
            }],
            successDetect: [{
                type: 'func',
                fn: async () => {
                    try {
                        await waitForTrue(() => {
                            const btn = document.querySelector('button.checkin-button');
                            if (!btn) return null;
                            if (btn.classList.contains('checked-in')) return true;
                            const label = btn.getAttribute('title') || btn.getAttribute('aria-label') || '';
                            return /已经签到过/.test(label) ? true : null;
                        }, 16000, 300, '按钮变已签到(checked-in)');
                        return true;
                    } catch (e) { return false; }
                }
            }]
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
                    id: 'tieba_dst', name: '饥荒吧',
                    url: 'https://tieba.baidu.com/f?kw=饥荒',
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
                    id: 'tieba_wows', name: '战舰世界吧',
                    url: 'https://tieba.baidu.com/f?kw=战舰世界',
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
                    id: 'tieba_subnautica', name: '深海迷航吧',
                    url: 'https://tieba.baidu.com/f?kw=深海迷航',
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
                    id: 'tieba_oni', name: '缺氧吧',
                    url: 'https://tieba.baidu.com/f?kw=缺氧',
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

    // 该 unit 签到动作导向的落地页路径(仅 pathname, 无 query/hash): 显式 attendanceUrl 优先;
    // 否则解析 checkInSelector 里的 href 属性选择器得按钮 href, 再相对 unit.url 解析出绝对路径
    // (按钮 href 多为 "attendance.php" 这类相对路径)。返回如 "/attendance.php", 解析失败返回 null。
    // 供 landingCheckedInContent 落地页确认标记判定"当前页是否为签到导向页"——不硬编码 attendance.php,
    // 各站落地页命名可不同(attendance/signin/...), 一律跟签到按钮 href 走, 天然可扩展。
    function landingPathOf(unit) {
        let raw = null;
        if (unit.attendanceUrl) raw = unit.attendanceUrl;
        else {
            const m = /\[href[~|^$*]?=\s*["']([^"']+)["']\]/.exec(unit.checkInSelector || '');
            if (m) raw = m[1];
        }
        if (!raw) return null;
        try {
            const u = new URL(raw, unit.url);
            let p = u.pathname;
            if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
            return p || null;
        } catch (e) {
            return null;
        }
    }
    // 当前页是否该 unit 的签到落地页: pathname 与签到动作导向路径一致(忽略 query; host 已由 matchUnit 保证)
    function isLandingPageOf(unit) {
        const target = landingPathOf(unit);
        if (!target) return false;
        let cur = location.pathname;
        if (cur.length > 1 && cur.endsWith('/')) cur = cur.slice(0, -1);
        return cur === target;
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

    // ---------- 页面出生日期(跨天守卫用) ----------
    // 页面 DOM 是页面加载时刻服务器状态的快照: 本地日期跨天后, DOM 上「今日已签到/
    // 已签到」等通用文案仍是昨日渲染结果, 无日期锚。若直接用旧 DOM 做当日判定,
    // 会把昨日已签误写为今日 success(实际今日未签)。故在脚本注入(document-start)
    // 瞬间记录出生日期, 任何「基于本页 DOM 的当日判定/执行」前先查跨天(见守卫),
    // 跨天一律整页刷新重新加载(新 DOM = 新一天服务器状态)后再判定。
    const PAGE_BORN_DATE = todayStr();

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

    // ---------- 签到按钮重现提醒(与当日状态联动降级, 见 P25) ----------
    // 语义: 引擎曾把某站判为「今日已签 success」, 但后续访问发现签到按钮又呈可签态
    // (服务器重置/换账号/上次 success 误报)→ 写常驻提醒供前台页面显示(FAB 琥珀角标/
    // 面板警示条/行标记); 同时把当日 status 降级为 suspect(面板显示「失败-待确认」),
    // 避免用户误以为今日已完成。纯提醒不自动重签(真已签时误点有重复签到/风控风险)。
    // 转正: 该站页面再次确认已签(按钮为已签文案 / noButtonMeansCheckedIn 站无按钮 /
    // 页面级已签通道)→ 状态恢复 success + 清提醒(alert 置 off)。
    // 节流: 提醒每站每天至多写一次 on(state:'on' 期间不重写; 页面确认已签 clearAlert 置
    // off 后当天不再复写提醒)。**降级与提醒解耦**: 闸门 = 当日状态仍 success 且按钮重现
    // → 直接降级 suspect(与 alert 当天是否已写/off 无关, 修复 .18/.19 旧残留导致当天
    // 永不再降级); 每天至多降级一次由状态转换幂等天然保证(success→suspect 后不再满足
    // 条件), 跨页/刷新不重复降级。off 仅代表「曾确认已签」, 不冻结状态轴。
    function readAlert(unitId) {
        const a = gmGet(K.alert(unitId), null);
        if (!a || a.date !== todayStr()) {
            if (a) gmSet(K.alert(unitId), null); // 顺带清理跨天过期记录
            return null;
        }
        return a.state === 'on' ? a : null;
    }
    // 返回 true=本次新写入提醒(当天首次); false=当天已提醒过/已人工确认置 off(不重写)
    function writeAlert(unitId, btnText) {
        const a = gmGet(K.alert(unitId), null);
        if (a && a.date === todayStr()) return false; // 今天已提醒过(无论 on/off), 防同站跨页刷屏
        gmSet(K.alert(unitId), { date: todayStr(), btnText, ts: Date.now(), state: 'on' });
        return true;
    }
    function clearAlert(unitId) {
        const a = gmGet(K.alert(unitId), null);
        if (a && a.date === todayStr() && a.state === 'on') {
            gmSet(K.alert(unitId), Object.assign({}, a, { state: 'off' }));
        }
    }
    // 今日有效提醒列表(面板警示条/FAB 角标用): 保持站点顺序
    function alertUnits() {
        const out = [];
        for (const u of UNITS) {
            const a = readAlert(u.id);
            if (a) out.push({ unit: u, alert: a });
        }
        return out;
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

    // ---------- 跨天守卫(页面出生日期 vs 今日) ----------
    // isDayRolled: 页面出生日(脚本注入时刻)与今日不一致 = 页面跨天常驻/加载期间跨天,
    //   其上一切「已签到」文案都属于昨日, 不可作为今日判定依据。
    // dayRollReload: 跨天即发起整页刷新(仅一次, 防多入口同刻重入); 返回 true 表示
    //   调用方须立刻终止本次执行且不得再读写当日状态(刷新后新页面会重走主流程)。
    //   策略 = 仅执行前守卫: 纯挂机常驻页跨天不主动刷新(不打扰用户), 只在引擎正要
    //   基于本页 DOM 做当日判定/执行(被动/批量/落地结算/发起批量)时拦截刷新。
    let dayRollReloadRequested = false;
    function isDayRolled() {
        return PAGE_BORN_DATE !== todayStr();
    }
    function dayRollReload() {
        if (!isDayRolled() || dayRollReloadRequested) return isDayRolled();
        dayRollReloadRequested = true;
        console.warn(`${ScriptName} 检测到跨天: 页面 DOM 为 ${PAGE_BORN_DATE} 状态(当前 ${todayStr()}), 已签到文案不可信 → 刷新页面以获取新一天状态`);
        location.reload();
        return true;
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
    function readRetryUidFromUrl() {
        try { return new URL(location.href).searchParams.get('ptacRetry'); }
        catch (e) { return null; }
    }
    // 一次性语义: 剥掉 URL 上的 ptacRetry(history.replaceState 不触发页面刷新/不产生历史记录),
    // 防用户停留在重试页按 F5/刷新重复强点; 站点内链接跳转(签到后跳落地页)本就丢弃该参数
    function stripRetryParamFromUrl() {
        try {
            const u = new URL(location.href);
            if (!u.searchParams.has('ptacRetry')) return;
            u.searchParams.delete('ptacRetry');
            history.replaceState(null, '', u.pathname + u.search + u.hash);
        } catch (e) { /* 忽略: 剥参失败不影响本次重试执行 */ }
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
        // 4) 落地页确认标记 — 仅在签到动作导向的落地页(路径由签到按钮 href 推导, 见 isLandingPageOf,
        //    不写死 attendance.php)上做整页文本匹配: 标记=签到落地后才出现的记录表头等(如 PTT
        //    「总签到记录」); 纯文本不绑 class(class 会随改版变化), 非落地页不检测(防首页/其它区域
        //    同文本误报); 落地页由点击跳转而来(被动/批量/调度落地结算共用本函数)
        if (unit.landingCheckedInContent && isLandingPageOf(unit)) {
            const body = document.body;
            if (body && visibleText(body).includes(unit.landingCheckedInContent)) {
                return { hit: true, source: `落地页标记(${unit.landingCheckedInContent})` };
            }
        }
        return { hit: false };
    }

    // ==================== 签到入口状态信号 ====================
    // 载体无关的「入口当前签到态」读取(见 P25): 引擎不再假设状态只存在按钮可见文本里——
    // 文本 / 元素属性(attr) / class / 自定义函数(fn) / 存在性(exists) 均可表达「已签」
    // 与「可签」。站点用两种方式描述其签到入口:
    //   A) 显式 stateSignals(推荐, 载体无关): checked 信号(任一命中=入口呈已签态) +
    //      checkable 信号(任一命中=入口呈可签态, 用于重现判定); checkable 不配 = 反向
    //      常驻按钮站(入口存在且非已签即可签, 如蜂巢 pting)。
    //   B) 旧文本字段自动翻译(文本站零改动):
    //      checked   = [{text alreadyCheckedInContent}](精确)
    //      checkable = [{text checkInContent}] 或 null(无 checkInContent → 反向常驻站)
    // 信号种类 kind: text(visibleText contains) / attr(属性值 contains) / attrEq(属性值
    // 精确等于) / class(classList 含) / fn(自定义谓词) / exists(元素存在即命中)。
    // 结构排除(与 P25 旧实现一致): 无 checkInSelector → 无入口可查(MTeam 等无按钮隐式站);
    // 无已签基准(显式 stateSignals 无 checked 或旧字段无 alreadyCheckedInContent)→ 无法表达
    // 「已签」→ 重现检测无意义(HHCLUB 菜单链接文案不随签到翻转, 已签靠动态落地页
    // date-display, 无按钮级已签表达)。这两类 deriveStateSignals 返回 null。
    const CHECKED_FLAVOR_WORDS = ['已签', '已成功', '连签', '已得', '已领', '已完成'];
    function deriveStateSignals(unit) {
        if (unit.stateSignals) {
            // 显式信号: 调用方保证 checked 非空(无已签基准则无重现语义)
            return (unit.stateSignals.checked && unit.stateSignals.checked.length) ? unit.stateSignals : null;
        }
        // 旧字段自动翻译(文本站零改动): 精确信号, 风味词守卫由调用方 flavor 选项另加
        if (!unit.alreadyCheckedInContent) return null; // 无已签基准 → 无重现语义
        return {
            checked: [{ kind: 'text', contains: unit.alreadyCheckedInContent }],
            checkable: unit.checkInContent ? [{ kind: 'text', contains: unit.checkInContent }] : null
        };
    }
    function signalHit(el, sig) {
        try {
            switch (sig.kind) {
                case 'text': return !!sig.contains && visibleText(el).includes(sig.contains);
                case 'attr': { const v = el.getAttribute(sig.name); return !!v && (!sig.contains || v.includes(sig.contains)); }
                case 'attrEq': { const v = el.getAttribute(sig.name); return !!v && v === sig.eq; }
                case 'class': return !!(el.classList && el.classList.contains(sig.name));
                case 'fn': return !!sig.fn(el);
                case 'exists': return true;
                default: return false;
            }
        } catch (e) { return false; }
    }
    // 命中信号的友好证据(供 alert 展示 / 日志): 文本站=按钮文案, attr=匹配的属性值, ...
    function signalEvidence(el, sig) {
        try {
            switch (sig.kind) {
                case 'text': { const t = visibleText(el).trim(); return t || sig.contains || ''; }
                case 'attr': {
                    const v = el.getAttribute(sig.name) || '';
                    return (sig.contains && v.includes(sig.contains)) ? sig.contains : (v || sig.name || '');
                }
                case 'attrEq': return sig.eq || '';
                case 'class': return sig.name || '';
                case 'exists': return visibleText(el).trim() || '入口存在';
                case 'fn': return visibleText(el).trim() || '自定义判定';
                default: return '';
            }
        } catch (e) { return ''; }
    }
    // 读入口当前签到态(载体无关):
    //   {state:'checked', evidence}   = 入口呈已签(checked 信号命中 / noButton 站按钮消失 /
    //     flavor=true 时文本命中已签风味词——仅文本载体站, 防已签变体文案误判为可签重现)
    //   {state:'checkable', evidence} = 入口呈可签(checkable 信号命中 / 反向站存在即可签)
    //   null = 无法判定(无入口配置 / 无已签基准 / 入口缺失非 noButton / 正向站文案非可签也非已签)
    function readEntryState(unit, flavor) {
        const sig = deriveStateSignals(unit);
        if (!sig) return null;
        let el = null;
        try { el = unit.checkInSelector ? document.querySelector(unit.checkInSelector) : null; } catch (e) { el = null; }
        if (!el) {
            // 入口缺失: noButtonMeansCheckedIn 站已签后按钮消失 = 已签(BTSchool); 否则无法判定
            return unit.noButtonMeansCheckedIn ? { state: 'checked', evidence: '入口消失(视为已签)' } : null;
        }
        for (const s of sig.checked) {
            if (signalHit(el, s)) return { state: 'checked', evidence: signalEvidence(el, s) };
        }
        // 已签风味词否定守卫(flavor=true, 旧 P25 语义): 仅文本载体站有效——已签变体文案
        // 不含配置的 alreadyCheckedInContent 却含可签内容子串时(如显示「已签到」而配置 only
        // 连签), 命中任一风味词即视为已签, 防误报重现; 无文本的 attr/class 信号站不受影响
        if (flavor && sig.checked.some((s) => s.kind === 'text')) {
            const t = visibleText(el);
            for (const w of CHECKED_FLAVOR_WORDS) {
                if (t.includes(w)) return { state: 'checked', evidence: w };
            }
        }
        // 无显式 checkable(反向常驻站, 如蜂巢): 入口存在且非已签 = 可签
        if (!sig.checkable) {
            const t = visibleText(el).trim();
            return { state: 'checkable', evidence: t || '入口存在(可签)' };
        }
        for (const s of sig.checkable) {
            if (signalHit(el, s)) return { state: 'checkable', evidence: signalEvidence(el, s) };
        }
        return null; // 正向站: 文案非可签也非已签(改版/未知文案)→ 不判重现
    }
    // ==================== 签到按钮重现检测(见 P25) ====================
    // 前提: 今日记录已签(success)但签到入口又呈可签态 → 返回可签证据文本用于常驻提醒;
    // 否则 null。基于通用 readEntryState(载体无关) + 风味词守卫, 覆盖: 文本翻转站
    // (正向/反向常驻)、noButtonMeansCheckedIn 站、以及显式 stateSignals 的属性/class 信号站
    // (NodeLoc)。结构排除仍适用: 无 checkInSelector(MTeam 等无按钮隐式站)或无已签基准的站。
    function checkInButtonReappeared(unit) {
        const st = readEntryState(unit, true); // flavor=true: 保留已签风味词否定守卫(旧语义)
        return st && st.state === 'checkable' ? st.evidence : null;
    }
    // 入口是否确认已签(用于清除提醒 / suspect 恢复): 精确信号判定(旧 signedByButton 语义,
    // 无风味词宽松匹配); noButtonMeansCheckedIn 站无按钮 = 已签
    function signedByButton(unit) {
        const st = readEntryState(unit, false);
        return !!(st && st.state === 'checked');
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
     * status: success | failed | pending | skipped | suspect(失败-待确认, 见 P25)
     */
    async function runUnit(unit, ctx = {}) {
        const log = (msg) => console.log(`${ScriptName} [${unit.name}] ${msg}`);
        const warn = (msg) => console.warn(`${ScriptName} [${unit.name}] ${msg}`);

        // 0) 跨天守卫: 页面 DOM 是昨日状态, 已签文案不可信 → 刷新取新一天状态后重跑;
        //    刷新后本页进程销毁, 不写任何当日状态(reload 后普通页/后台任务标签重走 main)
        if (dayRollReload()) {
            return { status: 'skipped', msg: '页面跨天, 刷新中', reason: 'day_roll' };
        }

        // 1) 今日已有当日结果(success 已成功 / suspect 失败-待确认)→ 跳过自动处理, 做
        //    「签到按钮重现」复核(见 P25):
        //    · 按钮再现可签(服务器重置/换账号/上次误报)→ 当日 success **降级为 suspect**
        //      (面板不再显示已成功, 改显「失败-待确认”), 写常驻提醒 + 页面级呈现; 不点击、不写冷却;
        //    · 页面确认已签(按钮已签文案 / noButton 已签型无按钮 / 页面级已签通道)→
        //      suspect **恢复 success** + 清提醒(收掉高亮/横条);
        //    suspect 非 success(不计今日成功), 但本分支拦截返回, 不会落入步骤 2+ 自动点击;
        //    次日记录 date 不匹配自然作废, 恢复常态签到。
        const todaySt = readStatus(unit.id);
        const suspectToday = !!(todaySt && todaySt.status === 'suspect' && todaySt.date === todayStr());
        if (isSuccessToday(unit.id) || suspectToday) {
            log(suspectToday ? '今日失败-待确认(suspect), 复核中' : '今日已签到成功, 复核中');
            let downgraded = suspectToday;
            try {
                let confirmedSigned = signedByButton(unit); // 按钮已签文案 / noButton 已签型无按钮
                log(`复核: signedByButton=${confirmedSigned}, 按钮=${(function(){ try { const el = document.querySelector(unit.checkInSelector); return el ? JSON.stringify(visibleText(el).trim()) : '无(noButton:' + !!unit.noButtonMeansCheckedIn + ')'; } catch (e) { return 'err'; } })()}`);
                if (!confirmedSigned) {
                    const btnText = checkInButtonReappeared(unit); // 非 null = 按钮呈可签态(重现)
                    log(`复核: checkInButtonReappeared=${btnText === null ? 'null(未重现)' : JSON.stringify(btnText)}`);
                    if (btnText) {
                        // 状态降级(.20 用户需求): 当日记录仍 success(尚未降级)且按钮重现 →
                        // 降级 suspect。闸门 = 「状态轴事实」, 与 alert 是否已写/已 off 完全解耦:
                        // 修复 .18/.19 旧版残留(当天已写 on/off 提醒但状态仍是 success)导致
                        // writeAlert 返回 false 而永不降级、面板永远显示「已成功」的问题;
                        // 降级每天至多一次由状态转换天然保证(success→suspect 后不再满足条件),
                        // 跨页/刷新不会重复降级(见 P25)。off 仅用于「不写新提醒、不打扰」。
                        const a = gmGet(K.alert(unit.id), null);
                        const offToday = !!(a && a.date === todayStr() && a.state === 'off');
                        const firstWrite = writeAlert(unit.id, btnText); // 当天已有记录(含 off)不重写
                        if (!suspectToday && todaySt && todaySt.status === 'success') {
                            writeStatus(unit.id, 'suspect', '已改为失败-待确认(补签后自动恢复)');
                            warn(`检测到签到按钮重现(${btnText}) → 状态已改为失败-待确认(不自动重签)`);
                            log(`降级执行: alert=${JSON.stringify(a)}, offToday=${offToday}, firstWrite=${firstWrite}`);
                            downgraded = true;
                            // 本次触发页即时反馈: 高亮按钮 + 重建横条(off 时不清提醒则不重建 on 记录,
                            // 但本次页面仍 toast/高亮一次直达用户); 已降级过不再 toast
                            if (uiActive()) {
                                highlightReappearedBtn(unit);
                                renderPageAlertBar();
                                UI.toast(`⚠ ${unit.name} 签到按钮重现(${btnText}) → 已标失败-待确认`, 4000, 'warn');
                            }
                        } else if (suspectToday) {
                            // 已是 suspect(刷新/跨页重访本分支): 重建页面装饰(高亮/横条), 不重复降级
                            if (uiActive()) {
                                highlightReappearedBtn(unit);
                                renderPageAlertBar();
                            }
                        }
                        // 其余(offToday 已人工确认 / firstWrite=false 当天已提醒过 on): 不打扰、不重复
                    } else {
                        // 无按钮重现迹象: 页面级已签通道确认(整页文案/落地页标记/自定义判定),
                        // 覆盖「补签完成但按钮通道未覆盖」场景(如跳页落地页无按钮)
                        try {
                            const already = await detectAlreadyCheckedIn(unit);
                            confirmedSigned = already.hit;
                        } catch (e) { /* 忽略 */ }
                    }
                }
                if (confirmedSigned) {
                    if (suspectToday) {
                        writeStatus(unit.id, 'success', '页面确认已签(解除失败-待确认)');
                        log('页面确认已签, 状态恢复已成功');
                    }
                    if (readAlert(unit.id)) {
                        clearAlert(unit.id);
                        log('清除签到按钮重现提醒');
                        clearReappearedBtn(unit);
                        renderPageAlertBar(); // 同步收掉页面高亮/横条
                    }
                }
            } catch (e) {
                warn(`按钮重现复核异常: ${e.message}`);
            }
            return {
                status: 'skipped',
                msg: downgraded ? '失败-待确认, 不自动重签' : '今日已签到成功',
                reason: downgraded ? 'suspect' : 'done_today'
            };
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

        // 2.5) 仅检测型站(detectOnly, 签到需人工验证如 U2): 第 2 步未命中已签 → 不做任何
        //      动作(不点击/不写冷却/不记失败), 返回 skipped 提示人工; 状态保持无记录(面板
        //      「— / 需人工签到」), 人工站内签到后下次访问检测自动命中 → success
        if (unit.detectOnly) {
            log('仅检测模式(需人工验证), 未检测到已签, 不自动签到');
            return { status: 'skipped', msg: '需人工签到(验证码)', reason: 'detect_only' };
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
        /* FAB 皮肤: 进度光环(光环) — 中间圆本体透明, ::before 合成紫罩+彩环:
           ①紫罩(径向 closest-side, 中心紫实→越边缘越透明, 实盖至圆缘)= 图标底兼"盖光层"
           (sample.html 中 center-icon 盖住射线根的作用由此承担: 光芒沉在它下层, 根不外穿);
           ②--ring-grad 全幅 conic 彩(成功绿/失败粉/待办灰段, 段弧长=站数占比)兼作彩带与
           圆内透出色; 段色 alpha 低(0.34/0.26) → 常亮辉光弱。
           辉光呼吸 ringBreathe(brightness 明暗 + drop-shadow 外扩收拢, 幅度小不抢戏)。
           光芒动感 = 完全复刻 sample.html 太阳算法(逐条真实 DOM 射线; 不用 translateY 锚圆缘/
           不用埋段+mask 挖孔/不用平台渐变——那几轮发挥都被证伪): 每条射线底边锚圆心、
           rotate 绕圆心指向均分角+随机扰动(±7.5°), 全长 = 圆心到尖端(根部被 ::before 紫罩
           盖住, 露出=圆缘外的渐变尾段); 渐变 sample 金档 0.9@0 → 0.6@30% → 0.2@70% →
           0@100%(根亮尖透, 无平台), 顶部半圆帽弧形收窄, filter blur(1px) 羽化; 静态
           opacity 0, 动画 rayPulse 三帧(sample solarPulse): 0.15 弱/blur2 → 0.9 峰/blur0 →
           0.3 缓/blur1.5, alternate 往复 + 正 delay 错相 → 逐条呼吸闪烁(峰值锐利、低谷模糊
           柔化); 主 18 束 + 4 日冕长细束(sample 同款数量, 长/细/慢/更长延迟)。层序:
           ring-rays z-index:-1 沉到 ::before 之下(根被中心紫罩盖, 光从圆缘外浮出)、
           fab-core(图标 z1)/fab-badge(z2)最上; 本体 background 透明 + animation:none(关
           baseGlow) + box-shadow 换柔和紫光晕(透明圆上黑硬投影破坏光感)。中间圆不做波纹
           (transform 留给 hover/active 反馈)。 */
        .fab.ring {
            background: transparent;
            animation: none; /* 本体透明圆: 必须关掉 .fab 默认 baseGlow(外圈紫晕又强又与呼吸脱节), 辉光全交给 ::before 弱呼吸 + DOM 光芒 */
            box-shadow: 0 0 14px rgba(139, 92, 246, 0.28), 0 0 42px rgba(139, 92, 246, 0.14); /* 透明圆上硬黑投影换成柔和紫环境光(贴 sample 中心太阳光效) */
        }
        .fab.ring .fab-core { position: relative; z-index: 1; }
        .fab.ring .fab-badge { z-index: 2; }
        .fab.ring::before { /* 紫罩蒙版(图标底 + 盖光层, 实盖至圆缘 26px 让光芒根不外穿) + 全幅分段彩光(彩带); 呼吸幅度已收敛(辉光勿过强) */
            content: ''; position: absolute; inset: -13px; border-radius: 50%;
            background:
                radial-gradient(circle closest-side at 50% 50%,
                        var(--accent-2) 0%, var(--accent-1) 42%, transparent 67%),
                var(--ring-grad, rgba(148, 163, 184, 0.26));
            -webkit-mask: radial-gradient(farthest-side,
                    #000 0%, #000 calc(100% - 13px), transparent calc(100% - 5px));
            mask: radial-gradient(farthest-side,
                    #000 0%, #000 calc(100% - 13px), transparent calc(100% - 5px));
            animation: ringBreathe 3.6s ease-in-out infinite;
            pointer-events: none;
        }
        @keyframes ringBreathe { /* 辉光呼吸(弱): blur 重声明防被动画覆盖; 幅度小=呼吸仍在但辉光不刺眼 */
            0%, 100% { filter: blur(2px) brightness(0.96) drop-shadow(0 0 2px rgba(167, 139, 250, 0.22)); }
            50% { filter: blur(2px) brightness(1.07) drop-shadow(0 0 9px rgba(167, 139, 250, 0.42)); }
        }
        .fab.ring .ring-rays { /* 光芒容器: 仅作定位(射线底边 bottom:50% = fab 中心); 无 mask 无裁剪——
                                   射线根部由 ::before 紫罩盖住(本容器 z-index:-1 沉于其下), 与 sample.html
                                   中心图标盖射线根同构; 容器大小不影响显示(射线溢出可见) */
            position: absolute; inset: -60px; pointer-events: none; z-index: -1;
        }
        .fab.ring .ray { /* 单条光芒(完全照 sample.html): 底边锚圆心、rotate(var(--a)) 绕圆心指向角度
                            (勿加 translateY——rotate 绕 transform-origin=底边中心, 根会全叠圆正上一点
                            呈折扇); 全长 --h = 圆心到尖端(根部被 ::before 盖住, 露出=圆缘外渐变尾段);
                            渐变 sample 金档 0.9@0 → 0.6@30% → 0.2@70% → 透明(根亮尖透, 无平台) +
                            顶部半圆帽弧形收窄 + filter blur(1px) 羽化; 静态 opacity 0(动画 0.15 起),
                            三帧 rayPulse 呼吸 + 正 delay 错相 */
            position: absolute; bottom: 50%; left: 50%;
            transform-origin: bottom center;
            width: var(--w, 3px); height: var(--h, 100px);
            margin-left: calc(var(--w, 3px) / -2);
            background: linear-gradient(to top,
                    rgba(255, 220, 100, 0.9) 0%,
                    rgba(255, 180, 50, 0.6) 30%,
                    rgba(255, 120, 20, 0.2) 70%,
                    transparent 100%);
            border-radius: 50% 50% 0 0 / 100% 100% 0 0; /* 顶部半圆帽: 顶边弧形收窄(同 sample.html) */
            filter: blur(1px);
            transform: rotate(var(--a, 0deg));
            opacity: 0;
            animation: rayPulse var(--d, 2s) ease-in-out var(--del, 0s) infinite alternate;
            pointer-events: none;
        }
        @keyframes rayPulse { /* 光芒呼吸(照 sample.html solarPulse 三帧): 低谷 0.15 弱且 blur2 柔化 →
                                峰值 0.9 亮且 blur0 锐利 → 0.3 缓且 blur1.5; alternate 往复 + 正 delay
                                错相 → 逐条闪烁(峰值时射线清晰带尖); 动画覆盖 transform/filter, 须重组 */
            0% { opacity: 0.15; transform: rotate(var(--a, 0deg)) scaleY(0.6); filter: blur(2px); }
            50% { opacity: 0.9; transform: rotate(var(--a, 0deg)) scaleY(1.1); filter: blur(0px); }
            100% { opacity: 0.3; transform: rotate(var(--a, 0deg)) scaleY(0.8); filter: blur(1.5px); }
        }
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
        .skin-dot.d4 { background: conic-gradient(#6ee7b7 0 210deg, #fda4af 210deg 270deg, rgba(127, 133, 150, 0.6) 270deg); } /* 光环: 柔和淡绿多段/淡粉/灰示例 */
        .banner {
            display: none; margin: 10px 14px 0; padding: 8px 12px; border-radius: 10px;
            background: rgba(22, 163, 74, 0.12); color: var(--ok); font-weight: 600;
            align-items: center; gap: 8px; flex-shrink: 0; font-size: 12px; line-height: 1.5;
        }
        .banner.warn { background: rgba(217, 119, 6, 0.15); color: var(--pend); }
        /* 按钮重现提醒警示条(面板列表顶部, 常驻直至页面确认已签/次日自然作废) */
        .alert-bar {
            margin: 0 0 8px; padding: 8px 10px; border-radius: 10px;
            background: rgba(217, 119, 6, 0.12); border: 1px solid rgba(217, 119, 6, 0.35);
            color: var(--text); font-size: 11px; line-height: 1.5;
        }
        .alert-bar b { color: var(--pend); margin-right: 4px; }
        .alert-bar span { color: var(--muted); display: block; }
        .alert-bar .alert-names { margin-top: 2px; color: var(--pend); word-break: break-all; }
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
        .row.alert { box-shadow: inset 3px 0 0 var(--pend); }
        .row.alert .row-sub { color: var(--pend); font-weight: 600; }
        .badge {
            flex-shrink: 0; font-size: 11px; font-weight: 600;
            padding: 3px 8px; border-radius: 999px; white-space: nowrap;
        }
        .badge.ok   { background: rgba(22, 163, 74, 0.14); color: var(--ok); }
        .badge.err  { background: rgba(229, 72, 77, 0.14); color: var(--err); }
        .badge.pend { background: rgba(217, 119, 6, 0.16); color: var(--pend); }
        .badge.skip { background: rgba(100, 116, 139, 0.16); color: var(--skip); }
        .badge.none { background: var(--surface-2); color: var(--muted); }
        /* 失败站重试入口: 悬停由「失败」切换为「↻ 重试」(琥珀警示 + 可点击); 点击=前台新标签强制重试 */
        .badge.retry { cursor: pointer; transition: background 0.15s ease, color 0.15s ease; }
        .badge.retry .t-retry { display: none; }
        .badge.retry:hover { background: rgba(245, 158, 11, 0.22); color: var(--pend); }
        .badge.retry:hover .t-fail { display: none; }
        .badge.retry:hover .t-retry { display: inline; }
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
        .toast.warn {
            background: linear-gradient(135deg, #f59e0b, #d97706);
            color: #fff; border-color: transparent;
            font-weight: 600; box-shadow: 0 4px 18px rgba(217, 119, 6, 0.45);
        }
    `;

    const UI = (function () {
        let host = null, fab, fabCore, fabBadge, chip, chipText, panel, summaryEl, bannerEl, barEl, barTextEl, listEl, btnBatch, forceToggle, forcePop, btnForce, btnSkin, skinBtns;
        let cancelObj = null;
        let batchBase = '';
        let toastEl = null, toastTimer = null;
        let lastRetryAt = 0; // 单站重试发起时间戳: 8s 内同页防连点(焦点已切新标签, 防切回误触)
        let skin = 'chameleon'; // FAB 皮肤: 变色龙(chameleon)|图标数字(number)|信号灯(signal)|进度光环(ring)

        const SVG_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.26"/></svg>';

        function esc(s) {
            return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        }
        function statusMeta(status) {
            switch (status) {
                case 'success': return { label: '已成功', cls: 'ok' };
                case 'failed': return { label: '失败', cls: 'err' };
                case 'suspect': return { label: '失败-待确认', cls: 'pend' }; // 签到按钮重现降级(见 P25)
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
            const alert = readAlert(unit.id); // 按钮重现提醒(常驻标记)
            let sub = '今日未处理';
            if (todayHit && st) {
                sub = `${esc(st.msg || '')}${st.ts ? ' · ' + formatTime(st.ts) : ''}`;
                if (cool) sub += ' · 冷却中, 默认不参与批量';
            } else if (unit.detectOnly && !todayHit) {
                sub = '需人工签到(验证码), 不自动签'; // 仅检测型站: 未签时留待人工
            }
            if (alert) {
                // 重现提醒存在即当日已降级 suspect(失败-待确认): 前置警示按钮文案, 后附降级说明
                sub = `⚠ 签到按钮重现: ${esc(alert.btnText || '')}${sub && sub !== '今日未处理' ? ' · ' + sub : ''}`;
            }
            const retryable = todayHit && st.status === 'failed'; // 今日失败 → 提供「重试」入口(suspect 待确认/其余状态不提供)
            const url = esc(unit.url);
            const fav = faviconSrc(unit);
            const badge = retryable
                ? `<span class="badge err retry" data-uid="${esc(unit.id)}" title="点击: 在新标签页【强制重试】本站(无视 10 分钟冷却, 执行完不关闭标签)。风险提示: 站点持续不可用时反复强制重试可能触发风控/封号, 请先确认站点可访问">`
                    + `<span class="t-fail">${meta.label}</span><span class="t-retry">↻ 重试</span></span>`
                : `<span class="badge ${meta.cls}">${meta.label}</span>`;
            return `<div class="row${cool ? ' cool' : ''}${alert ? ' alert' : ''}">`
                + `<div class="row-main"><div class="row-name" data-url="${url}" title="新标签打开 ${url}">`
                + (fav ? `<img class="fav" src="${esc(fav)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '')
                + `<span class="nm">${esc(unit.name)}</span><span class="ext">↗</span></div>`
                + `<div class="row-sub">${sub}</div></div>`
                + badge
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
                    <button class="skin-btn" type="button" data-skin="ring" title="光环: 分段彩光贴圆缘(成功绿/失败粉/待办灰段, 段长=站数占比)+弱辉光呼吸(明暗+光晕外扩收拢), 真实 DOM 日冕射线逐条独立呼吸(复刻 sample.html 太阳: 金色渐变长射线根部被中心圆盖住、从圆缘向外发散, 均分角+随机扰动, 长短/粗细/周期/延迟随机, blur 羽化+三帧呼吸峰值锐利, 逐条错相闪烁, 每页图案不同); 绿角标=成功数"><span class="skin-dot d4"></span>光环</button>
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
                // 失败站行内「重试」badge → 前台新标签强制重试(单站, 执行完不关闭标签, 见 openRetryTab)
                const retryEl = e.target && e.target.closest ? e.target.closest('.badge.retry') : null;
                if (retryEl) {
                    const uid = retryEl.getAttribute('data-uid');
                    const unit = uid ? UNIT_MAP.get(uid) : null;
                    if (unit) openRetryTab(unit);
                    return;
                }
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

        // 单站强制重试入口(行内失败 badge 点击): 前台新标签打开带 ptacRetry=<uid> 的 URL,
        // 重试页对该站执行一次无视冷却的强制签到(forceCooldown, 语义同批量"强制重试"),
        // 完毕不关闭标签(用户留在页面观察); 与批量任务(ptacTask)完全隔离——不建任务/
        // 不进调度/不轮询/不关标签。批量调度进行中或任务正处理该站时拒绝(防并行双点)。
        function openRetryTab(unit) {
            if (batchActive()) { toast('批量签到进行中, 暂不支持单站重试', 2800, 'warn'); return; }
            const t = loadTask();
            // 仅心跳新鲜的活跃调度才阻止(调度正由某页驱动); 已中断(stale)任务放行
            if (t && !isTaskStale(t) && Date.now() - (t.hb || 0) < HEARTBEAT_FRESH_MS) {
                const curId = t.list && t.list[t.index];
                if (curId === unit.id) { toast('批量任务正在处理该站, 请稍后再试', 2800, 'warn'); return; }
            }
            const now = Date.now();
            if (now - lastRetryAt < 8000) return; // 防连点(双击/误触)
            lastRetryAt = now;
            try {
                GM_openInTab(appendQuery(targetUrlOf(unit), 'ptacRetry', unit.id), { active: true });
                toast(`正在新标签页强制重试: ${unit.name}`, 3000);
            } catch (e) {
                toast(`打开重试标签失败: ${unit.name}`);
            }
        }

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

        // 按当前皮肤与今日汇总刷新 FAB(c: countToday 结果; alertN: 按钮重现提醒站数)
        // 语义统一: 全部完成 vs 有站点未签到 必须有明显差异, 四种皮肤各按自身语言表达
        function applyFabSkin(c, alertN = 0) {
            fab.classList.remove('ok', 'warn', 'err', 'ring', 'chameleon');
            if (skin !== 'ring') fab.querySelectorAll('.ring-rays').forEach((el) => el.remove()); // 切走 ring 时移除 DOM 光芒(样式挂在 .fab.ring 下, 不清理会残留裸元素)
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
                case 'ring': { // 进度光环: 弧按状态分段(成功绿/失败粉/待办灰, 段长=各状态站数占比, alpha 0.34/0.26 常亮弱); 辉光 ringBreathe 呼吸(brightness+drop-shadow 外扩收拢); 光芒=完全复刻 sample.html 太阳算法(射线底锚圆心 rotate 绕圆心, 不 translateY/不埋段/不 mask 挖孔): 全长=圆心到尖, 根部被 ::before 紫罩盖(rays z:-1 沉其下), 渐变 sample 金档 0.9@0→0.6@30→0.2@70→透明 + blur 羽化 + 半圆帽; rayPulse 三帧呼吸(0.15 blur2 → 0.9 峰 blur0 → 0.3 blur1.5)alternate + 正 delay 错相; 主 18 束均分±7.5° 扰动 + 日冕长细 4 束全随机角
                    fab.classList.add('ring');
                    fabCore.innerHTML = SVG_ICON;
                    if (!fab.querySelector('.ring-rays')) { // DOM 光芒只生成一次(图案随机, 每次页面加载不同); 切走再切回时已移除会重建
                        const raysBox = document.createElement('div');
                        raysBox.className = 'ring-rays';
                        let html = '';
                        const ray = (a, h, w, dur, del) => { // 完全照 sample.html 生成: 角度/全长高/宽/周期/正延迟
                            html += `<i class="ray" style="--a:${a.toFixed(1)}deg;--h:${h.toFixed(1)}px;--w:${w.toFixed(1)}px;--d:${dur.toFixed(2)}s;--del:${del.toFixed(2)}s"></i>`; // --del 正延迟(动画静止中等待, 各条错相闪烁); 全长 h=圆心到尖, 根部(0~26px)被 ::before 紫罩盖 → 露出=圆缘外渐变尾段(0.9→0.6→0.2→透明, 尖端渐隐)
                        };
                        const n = 18; // 主光芒 18 束(同 sample.html): 均分 360 + 随机扰动, 覆盖全周
                        for (let i = 0; i < n; i++) {
                            ray(i / n * 360 + (Math.random() * 15 - 7.5), // 均匀基准角 ±7.5° 扰动(破呆板对称)
                                70 + Math.random() * 54,                  // 全长 70~124(圆心到尖; 圆缘外露段 ≈ 44~98)
                                1.8 + Math.random() * 2.8,                // 宽 1.8~4.6px(柔光带)
                                1.8 + Math.random() * 2.0,                // 周期 1.8~3.8s
                                Math.random() * 2.5);                     // 延迟 0~2.5s
                        }
                        for (let i = 0; i < 4; i++) { // 日冕长细射线 4 束(同 sample.html): 全随机角, 更长更细更慢
                            ray(Math.random() * 360,
                                118 + Math.random() * 44,                 // 全长 118~162(露段 ≈ 92~136)
                                1 + Math.random() * 1.6,                  // 更细 1~2.6px
                                2.5 + Math.random() * 1.5,                // 更慢 2.5~4s
                                Math.random() * 3);                       // 延迟 0~3s
                        }
                        raysBox.innerHTML = html;
                        fab.insertBefore(raysBox, fabCore); // 插到图标之前; rays z:-1 沉 ::before 下 → 根被中心紫罩盖, 光从圆缘外浮出
                    }
                    const T = c.total > 0 ? c.total : 1;
                    const segs = [];
                    let cur = 0;
                    const seg = (n, from, to) => {
                        if (n <= 0 || cur >= 100) return;
                        const end = Math.min(100, cur + n / T * 100);
                        segs.push(from + ' ' + cur + '%', to + ' ' + end + '%');
                        cur = end;
                    };
                    seg(c.success, 'rgba(110, 231, 183, 0.34)', 'rgba(52, 211, 153, 0.34)'); // 今日成功: 淡绿 mint(alpha 低=常亮辉光弱, 呼吸动效由光芒射线承担)
                    seg(c.failed, 'rgba(253, 164, 175, 0.34)', 'rgba(251, 113, 133, 0.34)');  // 今日失败: 淡粉 rose(同上)
                    if (cur < 100) segs.push('rgba(148, 163, 184, 0.26) ' + cur + '% 100%'); // 待办(含跳过/未处理): 灰段
                    fab.style.setProperty('--ring-grad', 'conic-gradient(from -90deg, ' + segs.join(', ') + ')');
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
            // 按钮重现提醒优先角标: 存在告警且今日无失败(失败红标语义更紧急, 保持不动)时,
            // 琥珀 warn 角标改显告警站数, 提示用户开面板查看(面板内警示条/行标记常驻)
            if (alertN > 0 && c.failed === 0) setFabBadge(alertN, 'warn');
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
            const alerts = alertUnits(); // 按钮重现提醒(今日有效, 跨站持久)
            applyFabSkin(c, alerts.length);
            let html = '';
            if (alerts.length) {
                html += `<div class="alert-bar"><b>⚠ 签到按钮重现 ${alerts.length} 站</b>`
                    + `<span>记录显示今日已签但检测到可签按钮 → 已标「失败-待确认」; 不自动重签, 页面确认已签后自动恢复已成功并消除, 次日自然作废</span>`
                    + `<div class="alert-names">${alerts.map((a) => `${esc(a.unit.name)}(${esc(a.alert.btnText || '')})`).join('、')}</div></div>`;
            }
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
        // cls: 可选样式类('warn' = 琥珀警示底/白字, 用于按钮重现等提醒; 普通消息不带类)
        function toast(msg, ms = 2600, cls = '') {
            toastEl.classList.remove('warn'); // 清上次残留, 防普通/警示交替时样式串
            toastEl.textContent = msg;
            if (cls) toastEl.classList.add(cls);
            toastEl.classList.add('show');
            clearTimeout(toastTimer);
            toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
        }

        return {
            init, render, toast, togglePanel, openPanel, closePanel,
            showBatch, updateBatchResult, updateBatchText, countdown,
            endBatch, isCancelled, requestCancel, armCancel, showBatchDone,
            showBanner, hideBanner
        };
    })();

    // ==================== 页面级呈现: 签到按钮重现(按钮高亮 / 页面常驻横条) ====================
    // .18 教训(P25): alert 只呈现在 Shadow 面板/FAB 内时, 用户不打开面板就毫无感知 —— 用户
    // 盯着的是页面上的签到按钮. 故 .19 增加页面 light DOM 级反馈, 生命周期与 ptac_alert_* 同源:
    //  ① 按钮高亮: 该站按钮加琥珀描边 + 呼吸光晕 + 旁插 ⚠ 徽标(常驻到已签清除/次日作废/无按钮)
    //  ② 页面底部居中常驻横条: 列出当日全部 alert 站(可 ✕ 关闭本页会话; 刷新后若仍 on 会重现)
    //  ③ 即时琥珀警示 toast 一次(4s, 由 runUnit 重现分支触发)
    // 仅普通前台页(UI 已注入)执行; 后台任务标签无 UI 不处理。
    function uiActive() {
        return !!document.getElementById('ptac-root-v2');
    }
    function ensurePageCss() {
        let st = document.getElementById('ptac-page-style'); // 幂等: 已存在也覆写最新样式, 防旧 style 残留旧版位置/外观
        if (!st) {
            st = document.createElement('style');
            st.id = 'ptac-page-style';
            (document.head || document.documentElement).appendChild(st);
        }
        st.textContent = `
        .ptac-hl {
            outline: 2px solid #f59e0b !important; outline-offset: 2px;
            animation: ptacHlPulse 1.8s ease-in-out infinite;
        }
        @keyframes ptacHlPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.5); }
            50% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
        }
        .ptac-hl-badge {
            display: inline-flex; align-items: center; margin-left: 8px; padding: 2px 8px;
            font: 600 11px/1.6 -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif !important;
            color: #92400e !important; background: #fef3c7 !important;
            border: 1px solid #f59e0b !important; border-radius: 999px;
            cursor: default; vertical-align: middle; white-space: nowrap;
        }
        .ptac-page-alert {
            position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%); z-index: 2147483646;
            display: flex; align-items: center; gap: 8px;
            max-width: min(720px, calc(100vw - 24px));
            padding: 8px 10px 8px 16px; border-radius: 12px;
            background: #fff7ed; border: 1px solid #f59e0b;
            color: #7c2d12; font: 500 12px/1.5 -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
            box-shadow: 0 6px 24px rgba(217, 119, 6, 0.28);
        }
        .ptac-page-alert b { color: #b45309; flex-shrink: 0; }
        .ptac-page-alert span { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ptac-page-alert .ptac-alert-close {
            flex-shrink: 0; cursor: pointer;
            width: 22px; height: 22px; padding: 0; border-radius: 50%;
            display: inline-flex; align-items: center; justify-content: center;
            border: 1px solid rgba(217, 119, 6, 0.5); background: #fff;
            color: #b45309; font: 700 11px/1 -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
            transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease;
        }
        .ptac-page-alert .ptac-alert-close:hover {
            background: #b45309; color: #fff; transform: scale(1.1);
        }
        `;
    }
    function highlightReappearedBtn(unit) {
        if (!unit.checkInSelector) return;
        let el;
        try { el = document.querySelector(unit.checkInSelector); } catch (e) { return; }
        if (!el) return;
        ensurePageCss();
        if (el.classList.contains('ptac-hl')) return; // 本页已高亮过
        el.classList.add('ptac-hl');
        el.style.outline = '2px solid #f59e0b'; // 内联兜底(style 注入被站点清理时描边仍可见)
        el.style.outlineOffset = '2px';
        const holder = el.parentElement;
        if (holder && holder.querySelector(`.ptac-hl-badge[data-uid="${unit.id}"]`)) return;
        const badge = document.createElement('span');
        badge.className = 'ptac-hl-badge';
        badge.dataset.uid = unit.id;
        badge.textContent = '⚠ 按钮重现, 已标失败-待确认(仅提醒)';
        badge.title = '脚本记录今日已签, 但此按钮又呈可签态 → 已把当日状态改为失败-待确认; 不自动重签, 请确认是否需重新签到(补签后自动恢复已成功)';
        // 内联兜底(与 .ptac-hl-badge 同值): 页面级 style 注入偶被站点清理时形态仍正确
        badge.style.cssText = 'display:inline-flex;align-items:center;margin-left:8px;padding:2px 8px;' +
            'font:600 11px/1.6 -apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;' +
            'color:#92400e;background:#fef3c7;border:1px solid #f59e0b;border-radius:999px;' +
            'cursor:default;vertical-align:middle;white-space:nowrap;';
        el.insertAdjacentElement('afterend', badge);
    }
    function clearReappearedBtn(unit) {
        let el = null;
        try { el = document.querySelector(unit.checkInSelector); } catch (e) { el = null; }
        if (el) el.classList.remove('ptac-hl');
        const holder = el && el.parentElement;
        if (holder) {
            const b = holder.querySelector(`.ptac-hl-badge[data-uid="${unit.id}"]`);
            if (b) b.remove();
        }
    }
    let pageAlertDismissed = false; // 本页会话内用户已 ✕ 关闭横条(刷新后若 alert 仍 on 会重新显示)
    function renderPageAlertBar() {
        if (!uiActive()) return;
        const alerts = alertUnits();
        const existing = document.getElementById('ptac-alert-bar-root');
        if (!alerts.length) {
            if (existing) existing.remove();
            return;
        }
        if (pageAlertDismissed) return;
        ensurePageCss();
        if (existing) existing.remove();
        const root = document.createElement('div');
        root.id = 'ptac-alert-bar-root';
        root.className = 'ptac-page-alert';
        // 关键样式全部内联兜底(不依赖 style 注入): 任何情况下都呈「底部居中琥珀卡片 + 圆钮关闭」
        root.style.cssText = 'position:fixed;bottom:18px;left:50%;transform:translateX(-50%);' +
            'z-index:2147483646;display:flex;align-items:center;gap:8px;' +
            'max-width:min(720px,calc(100vw - 24px));padding:8px 10px 8px 16px;border-radius:12px;' +
            'background:#fff7ed;border:1px solid #f59e0b;color:#7c2d12;' +
            'font:500 12px/1.5 -apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;' +
            'box-shadow:0 6px 24px rgba(217,119,6,0.28);';
        const b = document.createElement('b');
        b.textContent = `⚠ 签到按钮重现 ${alerts.length} 站:`;
        b.style.cssText = 'color:#b45309;flex-shrink:0;';
        const span = document.createElement('span');
        span.textContent = alerts.map((a) => `${a.unit.name}(${a.alert.btnText || ''})`).join('、');
        span.title = '记录显示今日已签, 但检测到可签按钮; 仅提醒不自动重签, 页面确认已签后自动消除, 次日自然作废';
        span.style.cssText = 'flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'ptac-alert-close';
        close.textContent = '✕';
        close.title = '本页关闭(按钮恢复已签或次日不再提示)';
        close.style.cssText = 'flex-shrink:0;cursor:pointer;width:22px;height:22px;padding:0;border-radius:50%;' +
            'display:inline-flex;align-items:center;justify-content:center;' +
            'border:1px solid rgba(217,119,6,0.5);background:#fff;color:#b45309;' +
            'font:700 11px/1 -apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;' +
            'transition:background 0.15s ease,color 0.15s ease,transform 0.1s ease;';
        close.addEventListener('click', () => {
            pageAlertDismissed = true;
            const bar = document.getElementById('ptac-alert-bar-root');
            if (bar) bar.remove();
        });
        // hover 形态用事件驱动(不依赖 style 表, 与内联同保底)
        close.addEventListener('mouseenter', () => { close.style.background = '#b45309'; close.style.color = '#fff'; });
        close.addEventListener('mouseleave', () => { close.style.background = '#fff'; close.style.color = '#b45309'; });
        root.appendChild(b);
        root.appendChild(span);
        root.appendChild(close);
        document.body.insertBefore(root, document.body.firstChild);
    }

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
            if (u.detectOnly) continue; // 仅检测型站(人工验证, 如 U2)不参与批量
            if (isSuccessToday(u.id)) continue;
            const prev = readStatus(u.id);
            // 失败-待确认(suspect, 签到按钮重现降级): 不自动重签 → 不进普通/强制批量
            if (prev && prev.status === 'suspect' && prev.date === todayStr()) continue;
            if (prev && prev.status === 'pending' && prev.date === todayStr()
                && Date.now() - prev.ts < MIN_INTERVAL) continue;
            if (!force && isFailedInCooldown(u.id)) continue;
            out.push(u.id);
        }
        return out;
    }

    // 发起页开始批量: force=true 时纳入"今日失败且仍在冷却期"的站并强制重试(无视冷却点击)
    function startBatch(force) {
        if (dayRollReload()) return; // 跨天旧发起页: 先刷新, 以今日状态页重新发起
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
        // 跨天守卫触发: 本标签正在刷新重载(重载后重新执行本站), 此时不得把
        // skipped(day_roll) 写入当日状态——否则调度页会把它当作结算结果推进任务,
        // 该站今日实际未签。直接返回, 由重载后的执行写真实结果(调度窗口内可等到)
        if (res.reason === 'day_roll') return;
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
        if (dayRollReload()) return; // 跨天旧落地页: 不采信昨日 DOM, 刷新后重结算
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

    // ==================== 前台单站强制重试(面板行内「失败 → 重试」入口) ====================
    // 入口页(UI 面板)在新标签页打开带 ptacRetry=<uid> 的 URL → 本页执行:
    //   · UI 已注入(main 分支先行 init), 用户留在本页观察执行过程与结果(不关闭标签);
    //   · runUnitWithTimeout forceCooldown=true: 无视冷却直接签到(语义同批量"强制重试");
    //   · 与批量任务完全隔离: 不写 task / 不参与调度心跳轮询 / 不关标签; 若调度正活跃且
    //     任务当前位置正是本站 → 放弃本次(避免与调度点击竞争, 双点有风控风险);
    //   · 跨标签互斥锁(K.retryLock): 防同站两个重试页并发点击; 本页未跳转销毁即清锁;
    //     若点击触发整页跳转(跳转型站), 本页销毁锁不清理 → 30s 窗口内落地页再发起会被拦,
    //     窗口到期自然解除(期间状态已被落地页结算, 重试页实为多余, 提示合理)。
    async function runRetryUnitPage(unit) {
        if (dayRollReload()) return; // 跨天守卫(剥参后刷新会以普通访问重走 main, 不会重复强点)
        const task = loadTask();
        if (task && !isTaskStale(task)) {
            const curId = task.list && task.list[task.index];
            if (curId === unit.id && Date.now() - (task.hb || 0) < HEARTBEAT_FRESH_MS) {
                UI.toast('批量任务正在处理该站, 已取消本次重试', 3200, 'warn');
                console.warn(`${ScriptName} 批量调度正在处理该站, 前台重试放弃`);
                return;
            }
        }
        const lockKey = K.retryLock(unit.id);
        const lockAt = gmGet(lockKey, 0);
        if (Date.now() - lockAt < RETRY_LOCK_MS) {
            UI.toast('该站重试已在进行中, 请稍候(30 秒锁窗口)', 3200, 'warn');
            return;
        }
        gmSet(lockKey, Date.now());
        const res = await runUnitWithTimeout(unit, { mode: 'retry', forceCooldown: true });
        gmSet(lockKey, 0); // 本页未跳转销毁 → 立即清锁; 已跳转(跳转型站)本行不执行, 锁自然过期
        console.log(`${ScriptName} [${unit.name}] 前台重试执行完成: ${res.status}(${res.reason || ''})`);
        UI.render(); // 状态已由 runUnit 落盘, 刷新面板呈现(失败 → 成功 / 仍失败 / 其它)
        if (res.status === 'success') UI.toast(`重试成功: ${unit.name}`, 3200);
        else if (res.status === 'failed') UI.toast(`重试失败: ${unit.name}${res.msg ? ' - ' + res.msg : ''}`, 4200, 'warn');
        else UI.toast(`未触发点击: ${unit.name}(${res.msg || ''})`, 3200);
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
        if (dayRollReload()) return; // 页面加载期间跨天(DOM 慢/大页面): 刷新后重走主流程
        collectFavicon(); // 路过收集当前站真实 icon URL(仅匹配站), 供面板列表图标显示
        let task = loadTask();
        if (task && isTaskStale(task)) {
            console.log(`${ScriptName} 清理过期批量任务(中断超过 ${TASK_STALE_MS / 60000} 分钟)`);
            clearTask();
            task = null;
        }

        // 前台单站强制重试页(面板行内「失败 → 重试」入口 GM_openInTab 打开, URL 带
        // ptacRetry=<uid>): 注入 UI(用户留在页面观察执行结果, 不关闭标签), 对该站执行
        // 一次无视冷却的强制签到(forceCooldown, 语义同批量"强制重试"); 与批量任务隔离。
        const urlRetryUid = readRetryUidFromUrl();
        if (urlRetryUid) {
            stripRetryParamFromUrl(); // 一次性语义: F5/刷新不再重复强点(不影响本站匹配)
            UI.init();
            renderPageAlertBar();
            const retryUnit = UNIT_MAP.get(urlRetryUid);
            if (!retryUnit || !matchUnit(retryUnit, location.href)) {
                // uid 不存在或本页实际不是该站(参数残留/手工拼错): 不硬签, 按普通访问处理
                console.warn(`${ScriptName} 重试页与站点不匹配(uid=${urlRetryUid}), 转入被动模式`);
                await runPassiveMode();
            } else {
                console.log(`${ScriptName} 前台强制重试页, 站点: ${retryUnit.name}`);
                await runRetryUnitPage(retryUnit);
            }
            UI.render();
            renderPageAlertBar(); // 刷新提醒横条(执行期间可能新增/清除)
            return;
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
        renderPageAlertBar(); // 展示既有「签到按钮重现」提醒(跨站 GM 持久, 页面顶部横条)
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
        renderPageAlertBar(); // 刷新提醒横条(runUnit 期间可能新增/清除)
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
