// ==UserScript==
// @name         HDHomeUI
// @name:zh-CN   HDHome 界面主题套件
// @namespace    https://github.com/ABackerNINI/TampermonkeyScripts
// @version      2026.09.19.2
// @description  HDHome 界面主题套件: 5 套可切换 UI(片库索引/电传纸带/大开本/瑞士网格/播控台)。纯样式层, 不重建 DOM、不接管交互, 原站功能全部保留; 页面结构异常时提示并回退默认界面。
// @author       ABacker
// @license      GNU GPL-3.0
// @match        *://*.hdhome.org/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// @tag          HDHome, theme, ui
// ==/UserScript==

(function () {
    'use strict';

    const ScriptName = 'HDHomeUI';
    const STORE_THEME = 'hdui.theme';
    const STORE_ERR = 'hdui.lastError';
    const DEFAULT_ID = 'default';
    const STYLE_ID = 'hdui-css';
    const BOOT_ID = 'hdui-boot';
    const ALERT_ID = 'hdui-alert';
    const ROOT_ID = 'hdui-root';

    // 种子表 12 列的字典(键 -> 表头识别方式)。站点加列/改名都能被 detectColumns 感知
    const COLUMNS = Object.freeze([
        'type', 'title', 'comments', 'alive', 'size', 'seeders',
        'leechers', 'snatched', 'progress', 'a', 'ave', 'uploader'
    ]);
    // A 级锚点: 缺任一即判定「不是认识的 HDHome 页面」, 直接回退
    const ANCHORS = Object.freeze([
        { sel: 'table.mainouter', label: '页面主框架 table.mainouter' },
        { sel: '#nav_block', label: '导航容器 #nav_block' },
        { sel: '#info_block', label: '用户信息栏 #info_block' },
        { sel: 'ul#mainmenu', label: '主导航 ul#mainmenu' }
    ]);

    // 类别色(按类别图标 class 前缀取色, 供卡片色条 / 播控台色点使用)
    const CAT_COLORS = Object.freeze([
        ['c_movie', '#8a7f6d'], ['c_movies', '#8a7f6d'],
        ['c_tvseries', '#5f7c96'], ['c_tv', '#5f7c96'],
        ['c_music', '#6f8f7a'],
        ['c_document', '#7a6f96'],
        ['c_animate', '#96706f'],
        ['c_sport', '#6d8a8f'],
        ['c_other', '#8a8a8a']
    ]);
    const CAT_FALLBACK = '#8a8a8a';

    // ==================================================================
    // 诊断账本: 所有异常的唯一出口。禁止空 catch、禁止静默吞错
    // ==================================================================
    const Diag = (function () {
        const items = [];
        const MAX = 60;
        const listeners = [];

        function emit(level, code, detail) {
            const rec = { level: level, code: code, detail: String(detail === undefined ? '' : detail), t: Date.now() };
            items.push(rec);
            if (items.length > MAX) items.shift();
            const line = '[' + ScriptName + '] ' + level.toUpperCase() + ' ' + code + ' ' + rec.detail;
            if (level === 'error') console.error(line);
            else if (level === 'warn') console.warn(line);
            else console.log(line);
            for (let i = 0; i < listeners.length; i++) {
                try { listeners[i](rec); } catch (e) { console.error('[' + ScriptName + '] 诊断订阅者异常', e); }
            }
            return rec;
        }

        return {
            info: function (code, detail) { return emit('info', code, detail); },
            warn: function (code, detail) { return emit('warn', code, detail); },
            error: function (code, detail) { return emit('error', code, detail); },
            // catch 的统一落点: catch (e) { Diag.fail('CODE', e); }
            fail: function (code, err) {
                return emit('error', code, (err && err.message) ? err.message : String(err));
            },
            list: function () { return items.slice(); },
            last: function (level) {
                for (let i = items.length - 1; i >= 0; i--) {
                    if (!level || items[i].level === level) return items[i];
                }
                return null;
            },
            onChange: function (fn) { listeners.push(fn); }
        };
    })();

    // ==================================================================
    // 主题定义: 5 套, 布局骨架 / 字体体系 / 信息层级各不相同
    // ==================================================================
    function reelCss(m) {
        const c = function (k) { return ':nth-child(' + m[k] + ')'; };
        return [
            '#torrenttable{display:block;}',
            '#torrenttable > tbody{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;}',
            '#torrenttable > tbody > tr:first-child{grid-column:1/-1;display:flex;gap:10px;background:transparent;border:0;padding:0 2px 6px;}',
            '#torrenttable > tbody > tr:not(:first-child){display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;padding:12px 14px;background:var(--hdui-card);border:1px solid var(--hdui-line);border-top:3px solid var(--hdui-cat,' + CAT_FALLBACK + ');border-radius:var(--hdui-radius);}',
            '#torrenttable > tbody > tr:not(:first-child):hover{border-color:var(--hdui-accent);}',
            '#torrenttable > tbody > tr > td{border:0;padding:0;background:transparent;font-size:var(--hdui-fs-sm);color:var(--hdui-muted);}',
            '#torrenttable > tbody > tr > td' + c('type') + '{order:1;}',
            '#torrenttable > tbody > tr > td' + c('title') + '{order:2;flex:1 1 100%;font-family:var(--hdui-font-title);font-size:15px;line-height:1.45;color:var(--hdui-fg);}',
            '#torrenttable > tbody > tr > td' + c('uploader') + '{order:3;flex:1 1 100%;color:var(--hdui-muted);}',
            '#torrenttable > tbody > tr > td' + c('size') + '{order:4;}',
            '#torrenttable > tbody > tr > td' + c('alive') + '{order:5;}',
            '#torrenttable > tbody > tr > td' + c('seeders') + '{order:6;margin-left:auto;font-size:22px;color:var(--hdui-fg);}',
            '#torrenttable > tbody > tr > td' + c('seeders') + ' a{font-size:22px;color:var(--hdui-accent);}',
            '#torrenttable > tbody > tr > td' + c('leechers') + '{order:7;}',
            '#torrenttable > tbody > tr > td' + c('snatched') + '{order:8;}',
            '#torrenttable > tbody > tr > td' + c('comments') + '{order:9;}',
            '#torrenttable > tbody > tr > td' + c('progress') + '{order:10;}',
            '#torrenttable > tbody > tr > td' + c('a') + '{order:11;}',
            '#torrenttable > tbody > tr > td' + c('ave') + '{order:12;}',
            '#torrenttable table.torrentname{display:flex;width:100%;}',
            '#torrenttable table.torrentname > tbody{display:flex;width:100%;}',
            '#torrenttable table.torrentname > tbody > tr{display:flex;width:100%;align-items:baseline;}',
            '#torrenttable table.torrentname td{border:0;padding:0;}',
            '#torrenttable table.torrentname td.rss{margin-left:auto;}',
            'ul#mainmenu li a{border-bottom:2px solid transparent;}',
            'ul#mainmenu li.selected a{border-bottom-color:var(--hdui-accent);}'
        ].join('\n');
    }

    function tapeCss(m) {
        const c = function (k) { return ':nth-child(' + m[k] + ')'; };
        return [
            '#torrenttable{display:table;}',
            '#torrenttable > tbody{display:table-row-group;}',
            '#torrenttable > tbody > tr{display:table-row;}',
            '#torrenttable > tbody > tr > td{display:table-cell;border:0;padding:2px 6px;font-size:12px;line-height:1.35;vertical-align:middle;color:var(--hdui-fg);}',
            '#torrenttable > tbody > tr:not(:first-child):nth-child(odd){background:var(--hdui-zebra1);}',
            '#torrenttable > tbody > tr:not(:first-child):nth-child(even){background:var(--hdui-zebra2);}',
            '#torrenttable > tbody > tr:first-child > td{background:var(--hdui-headbg);color:var(--hdui-headfg);letter-spacing:0.04em;}',
            '#torrenttable > tbody > tr > td' + c('title') + '{max-width:560px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
            '#torrenttable > tbody > tr > td' + c('comments') + ',#torrenttable > tbody > tr > td' + c('alive') + ',#torrenttable > tbody > tr > td' + c('size') + ',#torrenttable > tbody > tr > td' + c('seeders') + ',#torrenttable > tbody > tr > td' + c('leechers') + ',#torrenttable > tbody > tr > td' + c('snatched') + ',#torrenttable > tbody > tr > td' + c('a') + ',#torrenttable > tbody > tr > td' + c('ave') + '{text-align:right;}',
            '#torrenttable > tbody > tr > td' + c('seeders') + ' a{color:var(--hdui-accent);font-weight:700;}',
            '#torrenttable > tbody > tr > td' + c('uploader') + ',#torrenttable > tbody > tr > td' + c('progress') + '{color:var(--hdui-muted);}',
            '#torrenttable img{width:12px;height:12px;vertical-align:middle;}',
            'ul#mainmenu li a::before{content:"[";}',
            'ul#mainmenu li a::after{content:"]";}',
            'ul#mainmenu li.selected a{color:var(--hdui-accent);}'
        ].join('\n');
    }

    function broadsheetCss(m) {
        const c = function (k) { return ':nth-child(' + m[k] + ')'; };
        return [
            '#torrenttable{display:block;}',
            '#torrenttable > tbody{display:block;}',
            '#torrenttable > tbody > tr{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 12px;padding:10px 0;}',
            '#torrenttable > tbody > tr:not(:first-child){border-top:2px solid var(--hdui-line);}',
            '#torrenttable > tbody > tr:last-child{border-bottom:1px solid var(--hdui-line);}',
            '#torrenttable > tbody > tr > td{border:0;padding:0;font-size:var(--hdui-fs-sm);color:var(--hdui-muted);}',
            '#torrenttable > tbody > tr > td' + c('title') + '{flex:1 1 100%;font-family:var(--hdui-font-title);font-size:17px;line-height:1.5;color:var(--hdui-fg);}',
            '#torrenttable > tbody > tr > td' + c('type') + '{order:-1;}',
            '#torrenttable > tbody > tr > td' + c('type') + ' img{width:9px;height:9px;}',
            '#torrenttable > tbody > tr > td' + c('seeders') + '{font-size:12px;color:var(--hdui-fg);}',
            '#torrenttable > tbody > tr > td' + c('uploader') + '{margin-left:auto;}',
            '#torrenttable > tbody > tr:first-child{background:transparent;border-top:0;padding-bottom:6px;}',
            '#torrenttable table.torrentname{display:block;}',
            '#torrenttable table.torrentname > tbody{display:block;}',
            '#torrenttable table.torrentname > tbody > tr{display:block;}',
            '#torrenttable table.torrentname td{border:0;padding:0;display:inline;}',
            'ul#mainmenu{text-align:center;}',
            'ul#mainmenu li.selected a{font-weight:700;border-top:2px solid var(--hdui-accent);}'
        ].join('\n');
    }

    function swissCss(m) {
        const c = function (k) { return ':nth-child(' + m[k] + ')'; };
        return [
            '#torrenttable{display:block;}',
            '#torrenttable > tbody{display:block;}',
            '#torrenttable > tbody > tr{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 16px;padding:20px 0;border:0;}',
            '#torrenttable > tbody > tr > td{border:0;padding:0;font-size:11px;color:var(--hdui-muted);}',
            '#torrenttable > tbody > tr > td' + c('title') + '{flex:1 1 60%;font-size:14px;line-height:1.4;color:var(--hdui-fg);}',
            '#torrenttable > tbody > tr > td' + c('type') + '{order:-1;}',
            '#torrenttable > tbody > tr > td' + c('seeders') + '{margin-left:auto;font-size:28px;line-height:1;}',
            '#torrenttable > tbody > tr > td' + c('seeders') + ' a{font-size:28px;font-weight:700;color:var(--hdui-accent);line-height:1;}',
            '#torrenttable > tbody > tr > td' + c('uploader') + '{flex-basis:100%;}',
            '#torrenttable > tbody > tr:first-child{padding:0 0 6px;}',
            '#torrenttable > tbody > tr:first-child > td{background:transparent;color:var(--hdui-fg);font-size:11px;letter-spacing:0.12em;text-transform:uppercase;border-bottom:1px solid var(--hdui-fg);}',
            '#torrenttable table.torrentname{display:block;}',
            '#torrenttable table.torrentname > tbody{display:block;}',
            '#torrenttable table.torrentname > tbody > tr{display:block;}',
            '#torrenttable table.torrentname td{border:0;padding:0;display:inline;}',
            'ul#mainmenu{padding:14px 0;}',
            'ul#mainmenu li a{padding:2px 0;font-size:13px;color:var(--hdui-fg);}',
            'ul#mainmenu li.selected a{color:var(--hdui-accent);}'
        ].join('\n');
    }

    function signalCss(m) {
        const c = function (k) { return ':nth-child(' + m[k] + ')'; };
        return [
            '#torrenttable{display:block;}',
            '#torrenttable > tbody{display:block;}',
            '#torrenttable > tbody > tr{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:center;gap:2px 10px;padding:7px 10px;margin-bottom:5px;background:var(--hdui-card);border-radius:4px;border-bottom:1px solid var(--hdui-line);}',
            '#torrenttable > tbody > tr > td{border:0;padding:0;font-size:12px;color:var(--hdui-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
            '#torrenttable > tbody > tr > td' + c('type') + ' img{display:none;}',
            '#torrenttable > tbody > tr > td' + c('type') + ' a{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--hdui-cat,' + '#5fd4e4' + ');vertical-align:middle;}',
            '#torrenttable > tbody > tr > td' + c('title') + '{grid-column:span 3;font-size:13px;color:var(--hdui-fg);}',
            '#torrenttable > tbody > tr > td' + c('seeders') + '{font-size:18px;overflow:visible;}',
            '#torrenttable > tbody > tr > td' + c('seeders') + ' a{font-size:18px;color:var(--hdui-accent);}',
            '#torrenttable > tbody > tr > td' + c('seeders') + '::after{content:"";display:block;width:calc(var(--hdui-ratio,0) * 56px);max-width:56px;height:4px;margin-top:3px;border-radius:2px;background:var(--hdui-accent);}',
            '#torrenttable > tbody > tr:first-child{background:transparent;margin-bottom:8px;}',
            '#torrenttable > tbody > tr:first-child > td{background:transparent;color:var(--hdui-muted);font-size:11px;letter-spacing:0.06em;}',
            '#torrenttable table.torrentname{display:block;}',
            '#torrenttable table.torrentname > tbody{display:block;}',
            '#torrenttable table.torrentname > tbody > tr{display:block;}',
            '#torrenttable table.torrentname td{border:0;padding:0;display:inline;}',
            'ul#mainmenu{display:flex;gap:2px;background:var(--hdui-card);padding:3px;border-radius:5px;}',
            'ul#mainmenu li{flex:0 0 auto;}',
            'ul#mainmenu li a{padding:5px 9px;border-radius:4px;font-size:12px;color:var(--hdui-muted);}',
            'ul#mainmenu li.selected a{background:var(--hdui-accent);color:#06202a;}'
        ].join('\n');
    }

    const THEMES = Object.freeze([
        {
            id: 'reel', name: '片库索引', note: '卡片网格 · 衬线 · 暗金 · 低密度',
            vars: {
                '--hdui-bg': '#16181c', '--hdui-panel': '#1b1e23', '--hdui-card': '#1e2126',
                '--hdui-fg': '#ece7de', '--hdui-muted': '#8b8f96', '--hdui-accent': '#c8a35a',
                '--hdui-link': '#d8d2c6', '--hdui-line': '#2c3037', '--hdui-headbg': '#101216',
                '--hdui-headfg': '#8b8f96', '--hdui-zebra1': '#1e2126', '--hdui-zebra2': '#22262c',
                '--hdui-font': '"Songti SC","Noto Serif SC",Georgia,"Microsoft YaHei",serif',
                '--hdui-font-title': '"Songti SC","Noto Serif SC",Georgia,serif',
                '--hdui-font-num': 'ui-monospace,Consolas,monospace',
                '--hdui-fs': '13px', '--hdui-fs-sm': '11px',
                '--hdui-navpad': '8px 6px', '--hdui-radius': '3px'
            },
            css: reelCss
        },
        {
            id: 'tape', name: '电传纸带', note: '表格密排 · 全等宽 · 纸黄 · 极高密度',
            vars: {
                '--hdui-bg': '#f4efe3', '--hdui-panel': '#f4efe3', '--hdui-card': '#efeae0',
                '--hdui-fg': '#1b1a17', '--hdui-muted': '#6b665d', '--hdui-accent': '#a12a20',
                '--hdui-link': '#1b1a17', '--hdui-line': '#1b1a17', '--hdui-headbg': '#1b1a17',
                '--hdui-headfg': '#f4efe3', '--hdui-zebra1': '#f6f3ec', '--hdui-zebra2': '#efeae0',
                '--hdui-font': 'ui-monospace,Consolas,"Courier New","Microsoft YaHei",monospace',
                '--hdui-font-title': 'ui-monospace,Consolas,"Courier New",monospace',
                '--hdui-font-num': 'ui-monospace,Consolas,monospace',
                '--hdui-fs': '12px', '--hdui-fs-sm': '11px',
                '--hdui-navpad': '6px 4px', '--hdui-radius': '0px'
            },
            css: tapeCss
        },
        {
            id: 'sheet', name: '大开本', note: '单列长条 · 衬线标题 · 双细线 · 纵向',
            vars: {
                '--hdui-bg': '#fbfaf7', '--hdui-panel': '#fbfaf7', '--hdui-card': '#fbfaf7',
                '--hdui-fg': '#14120f', '--hdui-muted': '#5c5751', '--hdui-accent': '#8f2b21',
                '--hdui-link': '#14120f', '--hdui-line': '#14120f', '--hdui-headbg': '#fbfaf7',
                '--hdui-headfg': '#14120f', '--hdui-zebra1': '#fbfaf7', '--hdui-zebra2': '#f6f4ef',
                '--hdui-font': '"Songti SC","Noto Serif SC","Microsoft YaHei",serif',
                '--hdui-font-title': '"Songti SC","Noto Serif SC",serif',
                '--hdui-font-num': 'ui-monospace,Consolas,monospace',
                '--hdui-fs': '13px', '--hdui-fs-sm': '11px',
                '--hdui-navpad': '10px 0', '--hdui-radius': '0px'
            },
            css: broadsheetCss
        },
        {
            id: 'swiss', name: '瑞士网格', note: '留白分隔 · 28px 数字锚点 · 钴蓝',
            vars: {
                '--hdui-bg': '#ffffff', '--hdui-panel': '#ffffff', '--hdui-card': '#ffffff',
                '--hdui-fg': '#111111', '--hdui-muted': '#9a9a9a', '--hdui-accent': '#1a35d8',
                '--hdui-link': '#111111', '--hdui-line': '#e6e6e6', '--hdui-headbg': '#ffffff',
                '--hdui-headfg': '#111111', '--hdui-zebra1': '#ffffff', '--hdui-zebra2': '#ffffff',
                '--hdui-font': 'Inter,"Helvetica Neue","PingFang SC","Microsoft YaHei",sans-serif',
                '--hdui-font-title': 'Inter,"Helvetica Neue","PingFang SC",sans-serif',
                '--hdui-font-num': 'Inter,"Helvetica Neue",sans-serif',
                '--hdui-fs': '13px', '--hdui-fs-sm': '11px',
                '--hdui-navpad': '14px 0', '--hdui-radius': '0px'
            },
            css: swissCss
        },
        {
            id: 'signal', name: '播控台', note: '暗色 · 电平条 · 类别色点 · 告警橙',
            vars: {
                '--hdui-bg': '#0f1620', '--hdui-panel': '#131c27', '--hdui-card': '#16202c',
                '--hdui-fg': '#dce6ef', '--hdui-muted': '#7d8fa1', '--hdui-accent': '#5fd4e4',
                '--hdui-link': '#bcd2e0', '--hdui-line': '#24313f', '--hdui-headbg': '#131c27',
                '--hdui-headfg': '#7d8fa1', '--hdui-zebra1': '#16202c', '--hdui-zebra2': '#18232f',
                '--hdui-font': '"PingFang SC","Microsoft YaHei",system-ui,sans-serif',
                '--hdui-font-title': '"PingFang SC","Microsoft YaHei",sans-serif',
                '--hdui-font-num': 'ui-monospace,Consolas,monospace',
                '--hdui-fs': '13px', '--hdui-fs-sm': '11px',
                '--hdui-navpad': '8px 6px', '--hdui-radius': '4px'
            },
            css: signalCss
        }
    ]);

    const DEFAULT_THEME = {
        id: DEFAULT_ID, name: '原站默认', note: '不做任何改动',
        vars: {}, css: function () { return ''; }
    };

    function themeById(id) {
        if (id === DEFAULT_ID) return DEFAULT_THEME;
        for (let i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i];
        return null;
    }

    // ==================================================================
    // 结构与契约校验
    // ==================================================================
    function headerKey(td) {
        const txt = (td.textContent || '').trim();
        const id = td.getAttribute('id') || '';
        const img = td.querySelector('img');
        const cls = img ? (img.getAttribute('class') || '') : '';
        const title = img ? (img.getAttribute('title') || '') : '';
        const hint = txt + ' ' + title;
        if (id === 'calcTHeadA') return 'a';
        if (id === 'calcTHeadAve') return 'ave';
        if (txt === '类型') return 'type';
        if (txt === '标题') return 'title';
        if (txt === '进度') return 'progress';
        if (txt.indexOf('发布者') >= 0) return 'uploader';
        if (/\bcomments\b/.test(cls) || /评论/.test(hint)) return 'comments';
        if (/\btime\b/.test(cls) || /存活/.test(hint)) return 'alive';
        if (/\bsize\b/.test(cls) || /大小/.test(hint)) return 'size';
        if (/seeders/.test(cls) || /种子数/.test(hint)) return 'seeders';
        if (/leechers/.test(cls) || /下载数/.test(hint)) return 'leechers';
        if (/snatched/.test(cls) || /完成数/.test(hint)) return 'snatched';
        return '';
    }

    /** 读出表头 -> {key: 1-based 列号}; 缺列返回 missing 列表 */
    function detectColumns(table) {
        const body = table.tBodies && table.tBodies[0];
        if (!body) return { map: null, missing: COLUMNS.slice(), reason: 'TABLE_NO_TBODY' };
        const head = body.rows[0];
        if (!head) return { map: null, missing: COLUMNS.slice(), reason: 'TABLE_NO_HEAD' };
        const map = {};
        const cells = head.cells;
        for (let i = 0; i < cells.length; i++) {
            const key = headerKey(cells[i]);
            if (key && map[key] === undefined) map[key] = i + 1;
        }
        const missing = [];
        for (let i = 0; i < COLUMNS.length; i++) {
            if (map[COLUMNS[i]] === undefined) missing.push(COLUMNS[i]);
        }
        // 数据行必须与表头列数一致, 否则说明站点改版导致错位
        let shapeOk = true;
        if (body.rows.length > 1 && body.rows[1].cells.length !== cells.length) shapeOk = false;
        return { map: missing.length ? null : map, missing: missing, reason: shapeOk ? '' : 'ROW_CELL_COUNT_MISMATCH', headCount: cells.length };
    }

    /**
     * 契约校验:
     *   A 级 —— 主框架 / 导航 / 信息栏, 缺任一即失败
     *   B 级 —— 种子表存在时, 12 列必须全部识别出来(否则拒绝上妆, 防列错位)
     */
    function validateContract() {
        const missingAnchors = [];
        for (let i = 0; i < ANCHORS.length; i++) {
            if (!document.querySelector(ANCHORS[i].sel)) missingAnchors.push(ANCHORS[i].label);
        }
        if (missingAnchors.length) {
            return { ok: false, code: 'E_ANCHOR_MISSING', detail: '缺少: ' + missingAnchors.join(' / '), colMap: null };
        }
        const table = document.getElementById('torrenttable');
        if (!table) return { ok: true, code: 'OK_NO_TABLE', detail: '本页无种子表, 只应用全局样式', colMap: null };

        const d = detectColumns(table);
        const shapeMsg = '种子表数据行列数与表头不一致(表头 ' + d.headCount + ' 列)';
        // 列识别不全 -> 拒绝上妆(列一旦错位, 主题会把数据摆到错误的槽位)
        if (!d.map) {
            const detail = d.reason === 'ROW_CELL_COUNT_MISMATCH'
                ? shapeMsg
                : '种子表缺少可识别的列: ' + d.missing.join(',');
            return { ok: false, code: d.reason || 'E_COLUMN_UNKNOWN', detail: detail, colMap: null };
        }
        // 列都在、但数据行单元格数与表头对不上 -> 同样是改版信号, 一样拒绝
        if (d.reason) {
            return { ok: false, code: d.reason, detail: shapeMsg, colMap: null };
        }
        return { ok: true, code: 'OK', detail: '', colMap: d.map };
    }

    // ==================================================================
    // 样式装配 / 卸载(唯一的 DOM 写入: <style> + html data 属性 + 自定义属性)
    // ==================================================================
    let paintedRows = [];

    function catColor(row, typeIdx) {
        const cell = typeIdx ? row.cells[typeIdx - 1] : null;
        const img = cell ? cell.querySelector('img') : null;
        const cls = img ? (img.getAttribute('class') || '') : '';
        for (let i = 0; i < CAT_COLORS.length; i++) {
            if (cls.indexOf(CAT_COLORS[i][0]) === 0) return CAT_COLORS[i][1];
        }
        return CAT_FALLBACK;
    }

    function numOf(row, idx) {
        if (!idx) return 0;
        const cell = row.cells[idx - 1];
        if (!cell) return 0;
        const v = parseInt((cell.textContent || '').replace(/[^\d-]/g, ''), 10);
        return isNaN(v) ? 0 : v;
    }

    /** 给已校验的行写入 --hdui-cat / --hdui-ratio(纯自定义属性, 不动结构、不动事件) */
    function paintRows(colMap) {
        const table = document.getElementById('torrenttable');
        if (!table || !colMap) return;
        const body = table.tBodies && table.tBodies[0];
        if (!body) return;
        for (let i = 1; i < body.rows.length; i++) {
            const row = body.rows[i];
            const seed = numOf(row, colMap.seeders);
            const leech = numOf(row, colMap.leechers);
            const ratio = (seed + leech) > 0 ? (seed / (seed + leech)) : 0;
            row.style.setProperty('--hdui-cat', catColor(row, colMap.type));
            row.style.setProperty('--hdui-ratio', ratio.toFixed(3));
            paintedRows.push(row);
        }
    }

    function clearPaint() {
        for (let i = 0; i < paintedRows.length; i++) {
            paintedRows[i].style.removeProperty('--hdui-cat');
            paintedRows[i].style.removeProperty('--hdui-ratio');
        }
        paintedRows = [];
    }

    function buildCss(theme, colMap) {
        const vars = [];
        for (const k in theme.vars) {
            if (Object.prototype.hasOwnProperty.call(theme.vars, k)) vars.push(k + ':' + theme.vars[k] + ';');
        }
        let out = 'html[data-hdui-theme="' + theme.id + '"]{' + vars.join('') + '}\n';
        out += [
            'html[data-hdui-theme] body{background:var(--hdui-bg);color:var(--hdui-fg);font-family:var(--hdui-font);font-size:var(--hdui-fs);}',
            'html[data-hdui-theme] table.mainouter,html[data-hdui-theme] table.main{background:var(--hdui-panel);border-color:var(--hdui-line);}',
            'html[data-hdui-theme] td.embedded,html[data-hdui-theme] td.outer,html[data-hdui-theme] td.bottom{background:transparent;}',
            'html[data-hdui-theme] a{color:var(--hdui-link);text-decoration:none;}',
            'html[data-hdui-theme] a:hover{color:var(--hdui-accent);}',
            'html[data-hdui-theme] #info_block{color:var(--hdui-muted);font-size:var(--hdui-fs-sm);}',
            'html[data-hdui-theme] #info_block a{color:var(--hdui-link);}',
            'html[data-hdui-theme] #footer{color:var(--hdui-muted);font-size:var(--hdui-fs-sm);}',
            'html[data-hdui-theme] ul#mainmenu{margin:0;padding:var(--hdui-navpad);background:var(--hdui-panel);list-style:none;}',
            'html[data-hdui-theme] ul#mainmenu li{display:inline-block;}',
            'html[data-hdui-theme] ul#mainmenu li a{display:inline-block;padding:6px 10px;color:var(--hdui-muted);}',
            'html[data-hdui-theme] ul#mainmenu li.selected a{color:var(--hdui-accent);}',
            'html[data-hdui-theme] table.searchbox{background:var(--hdui-panel);color:var(--hdui-fg);border:1px solid var(--hdui-line);}',
            'html[data-hdui-theme] table.searchbox td.colhead{background:var(--hdui-headbg);color:var(--hdui-headfg);}',
            'html[data-hdui-theme] table.searchbox td.rowfollow{background:transparent;border-color:var(--hdui-line);}',
            'html[data-hdui-theme] input.btn,html[data-hdui-theme] select,html[data-hdui-theme] input[type=text]{font-family:var(--hdui-font);font-size:var(--hdui-fs-sm);}',
            'html[data-hdui-theme] p[align="center"]{color:var(--hdui-muted);font-size:var(--hdui-fs-sm);}',
            'html[data-hdui-theme] p[align="center"] a{color:var(--hdui-link);}',
            'html[data-hdui-theme] #torrenttable{width:100%;border-collapse:collapse;background:transparent;}',
            'html[data-hdui-theme] #torrenttable > tbody > tr:first-child > td{background:var(--hdui-headbg);color:var(--hdui-headfg);}',
            'html[data-hdui-theme] #torrenttable > tbody > tr:first-child > td a{color:var(--hdui-headfg);}',
            'html[data-hdui-theme] #torrenttable > tbody > tr:hover > td{background:var(--hdui-zebra2);}'
        ].join('\n');
        if (colMap) out += '\n' + theme.css(colMap);
        return out;
    }

    function injectCss(id, text) {
        const old = document.getElementById(id);
        if (old && old.parentNode) old.parentNode.removeChild(old);
        const st = document.createElement('style');
        st.setAttribute('id', id);
        st.setAttribute('data-hdui', 'css');
        st.textContent = text;
        const target = document.head || document.documentElement;
        target.appendChild(st);
        return st;
    }

    function unload() {
        // 回退/换妆时先停掉结构守卫, 否则 MutationObserver 会在默认界面上空转
        stopWatch();
        clearPaint();
        const css = document.getElementById(STYLE_ID);
        if (css && css.parentNode) css.parentNode.removeChild(css);
        const boot = document.getElementById(BOOT_ID);
        if (boot && boot.parentNode) boot.parentNode.removeChild(boot);
        delete document.documentElement.dataset.hduiTheme;
        delete document.documentElement.dataset.hduiState;
    }

    // ==================================================================
    // 可见提示: 结构错误必须让用户看见, 不许静默
    // ==================================================================
    function showAlert(code, detail) {
        if (!document.body) return null;
        let box = document.getElementById(ALERT_ID);
        if (!box) {
            box = document.createElement('div');
            box.setAttribute('id', ALERT_ID);
            box.setAttribute('role', 'alert');
            box.setAttribute('data-hdui', 'alert');
            box.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:2147483001;'
                + 'background:#7a1f1a;color:#fff;padding:10px 16px;font:13px/1.5 "Microsoft YaHei",sans-serif;'
                + 'box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;gap:12px;flex-wrap:wrap;';
            document.body.appendChild(box);
        }
        while (box.firstChild) box.removeChild(box.firstChild);

        const txt = document.createElement('span');
        txt.setAttribute('data-hdui', 'alert-text');
        txt.textContent = '[' + ScriptName + '] 页面结构与预期不符(' + code + '), 已恢复站点默认界面。' + (detail ? ' ' + detail : '');
        box.appendChild(txt);

        const retry = document.createElement('button');
        retry.setAttribute('type', 'button');
        retry.setAttribute('data-hdui', 'alert-retry');
        retry.textContent = '重新尝试';
        retry.style.cssText = 'background:#fff;color:#7a1f1a;border:0;border-radius:3px;padding:4px 10px;cursor:pointer;font-size:12px;';
        retry.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            dismissAlert();
            applyStored(true);
        });
        box.appendChild(retry);

        const close = document.createElement('button');
        close.setAttribute('type', 'button');
        close.setAttribute('data-hdui', 'alert-close');
        close.textContent = '知道了';
        close.style.cssText = 'background:transparent;color:#fff;border:1px solid #fff;border-radius:3px;padding:3px 10px;cursor:pointer;font-size:12px;';
        close.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            dismissAlert();
        });
        box.appendChild(close);
        return box;
    }

    function dismissAlert() {
        const box = document.getElementById(ALERT_ID);
        if (box && box.parentNode) box.parentNode.removeChild(box);
    }

    // ==================================================================
    // 选择 / 记忆
    // ==================================================================
    let currentId = DEFAULT_ID;
    let observer = null;
    let watchTimer = 0;

    function storeGet(key, def) {
        if (typeof GM_getValue !== 'function') return def;
        const v = GM_getValue(key, undefined);
        return v === undefined || v === null ? def : v;
    }

    function storeSet(key, value) {
        if (typeof GM_setValue !== 'function') return;
        GM_setValue(key, value);
    }

    function fallbackToDefault(code, detail) {
        unload();
        document.documentElement.dataset.hduiTheme = DEFAULT_ID;
        document.documentElement.dataset.hduiState = 'fallback';
        storeSet(STORE_ERR, { code: code, detail: detail, at: Date.now() });
        showAlert(code, detail);
        renderPanel();
    }

    /** 应用主题。silentRetry=true 时失败不重复弹横幅(用户手动点「重新尝试」的场景) */
    function applyTheme(id, silentRetry) {
        const theme = themeById(id);
        if (!theme) {
            Diag.warn('UNKNOWN_THEME', '未知主题 ' + id + ', 回落默认');
            fallbackToDefault('E_UNKNOWN_THEME', '未知主题 ' + id);
            return false;
        }
        unload();
        dismissAlert();
        if (theme.id === DEFAULT_ID) {
            currentId = DEFAULT_ID;
            document.documentElement.dataset.hduiTheme = DEFAULT_ID;
            document.documentElement.dataset.hduiState = 'off';
            Diag.info('THEME_OFF', '已恢复原站默认界面');
            renderPanel();
            return true;
        }

        const v = validateContract();
        if (!v.ok) {
            Diag.error(v.code, v.detail);
            currentId = DEFAULT_ID;
            fallbackToDefault(v.code, v.detail);
            return false;
        }

        try {
            injectCss(STYLE_ID, buildCss(theme, v.colMap));
            paintRows(v.colMap);
            currentId = theme.id;
            document.documentElement.dataset.hduiTheme = theme.id;
            document.documentElement.dataset.hduiState = 'applied';
            storeSet(STORE_ERR, null);
            Diag.info('THEME_ON', theme.name + '(' + theme.id + ') 已应用 [' + v.code + ']; '
                + (v.code === 'OK_NO_TABLE' ? '本页无种子表, 只应用全局样式' : '列映射完整'));
            watchStructure();
            renderPanel();
            return true;
        } catch (e) {
            Diag.fail('E_APPLY_FAILED', e);
            fallbackToDefault('E_APPLY_FAILED', (e && e.message) || String(e));
            return false;
        }
    }

    function applyStored(isRetry) {
        // 首次安装默认「原站默认」: 不擅自改用户看到的界面, 由用户自己选主题
        const id = storeGet(STORE_THEME, DEFAULT_ID);
        applyTheme(id, !!isRetry);
    }

    function selectTheme(id) {
        storeSet(STORE_THEME, id);
        applyTheme(id, false);
    }

    function cycleTheme() {
        const ids = [DEFAULT_ID];
        for (let i = 0; i < THEMES.length; i++) ids.push(THEMES[i].id);
        const at = ids.indexOf(currentId);
        selectTheme(ids[(at + 1) % ids.length]);
    }

    // ==================================================================
    // 运行时结构守卫: 页面局部刷新后重新校验, 失效即回退(防"页面变了还带着旧妆")
    // ==================================================================
    function stopWatch() {
        if (observer) { observer.disconnect(); observer = null; }
        if (watchTimer) { clearTimeout(watchTimer); watchTimer = 0; }
    }

    function watchStructure() {
        stopWatch();
        const scope = document.getElementById('outer') || document.body;
        if (!scope || typeof MutationObserver !== 'function') return;
        observer = new MutationObserver(function () {
            if (watchTimer) clearTimeout(watchTimer);
            watchTimer = setTimeout(function () {
                watchTimer = 0;
                try {
                    if (currentId === DEFAULT_ID) return;
                    const v = validateContract();
                    if (!v.ok) {
                        Diag.error('E_STRUCTURE_CHANGED', '页面结构在运行中变化: ' + v.detail);
                        currentId = DEFAULT_ID;
                        fallbackToDefault('E_STRUCTURE_CHANGED', v.detail);
                    } else {
                        clearPaint();
                        paintRows(v.colMap);
                    }
                } catch (e) {
                    Diag.fail('E_WATCH_FAILED', e);
                }
            }, 500);
        });
        observer.observe(scope, { childList: true, subtree: true });
    }

    // ==================================================================
    // 自持 UI: 浮动开关 + 面板(closed shadow, 事件不冒泡到站内)
    // ==================================================================
    let uiRoot = null;
    let uiShadow = null;
    let panelOpen = false;

    function el(tag, text, style) {
        const n = document.createElement(tag);
        if (text !== undefined) n.textContent = text;
        if (style) n.style.cssText = style;
        return n;
    }

    function panelCss() {
        return [
            '.fab{width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.25);',
            'background:#1b1e23;color:#ece7de;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;}',
            '.fab:hover{border-color:#c8a35a;}',
            '.panel{position:fixed;right:18px;bottom:74px;width:300px;max-height:70vh;overflow:auto;',
            'background:#1b1e23;color:#ece7de;border:1px solid rgba(255,255,255,.18);border-radius:8px;',
            'padding:14px;font:13px/1.6 "Microsoft YaHei",sans-serif;}',
            '.panel h3{margin:0 0 10px;font-size:14px;font-weight:600;color:#ece7de;}',
            '.item{display:block;width:100%;text-align:left;margin-bottom:6px;padding:8px 10px;cursor:pointer;',
            'background:#232830;color:#d8d2c6;border:1px solid transparent;border-radius:6px;font:13px/1.4 inherit;}',
            '.item:hover{border-color:#c8a35a;}',
            '.item[aria-pressed="true"]{background:#2f2a1f;border-color:#c8a35a;color:#f0e6d2;}',
            '.item small{display:block;color:#8b8f96;font-size:11px;margin-top:2px;}',
            '.diag{margin-top:12px;border-top:1px solid rgba(255,255,255,.14);padding-top:10px;color:#8b8f96;font-size:11px;}',
            '.diag code{color:#e0a0a0;font-family:ui-monospace,Consolas,monospace;}',
            '.hint{margin-top:8px;color:#8b8f96;font-size:11px;}'
        ].join('');
    }

    function renderPanel() {
        if (!uiShadow || !panelOpen) return;
        const old = uiShadow.querySelector('.panel');
        if (old) old.remove();

        const panel = el('div', undefined, '');
        panel.className = 'panel';
        panel.setAttribute('data-hdui', 'panel');
        panel.appendChild(el('h3', ScriptName + ' · 界面主题'));

        const all = [DEFAULT_THEME];
        for (let i = 0; i < THEMES.length; i++) all.push(THEMES[i]);
        for (let i = 0; i < all.length; i++) {
            const t = all[i];
            const btn = el('button', undefined, '');
            btn.className = 'item';
            btn.setAttribute('type', 'button');
            btn.setAttribute('data-hdui-theme-id', t.id);
            btn.setAttribute('aria-pressed', t.id === currentId ? 'true' : 'false');
            btn.appendChild(document.createTextNode(t.name));
            const note = el('small', t.note);
            btn.appendChild(note);
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                selectTheme(t.id);
            });
            panel.appendChild(btn);
        }

        const diag = el('div', undefined, '');
        diag.className = 'diag';
        const err = storeGet(STORE_ERR, null);
        const head = el('div', undefined, '');
        head.appendChild(document.createTextNode('当前: '));
        const code = el('code', String(currentId));
        head.appendChild(code);
        diag.appendChild(head);

        if (err && err.code) {
            const line = el('div', undefined, '');
            line.appendChild(document.createTextNode('上次错误: '));
            line.appendChild(el('code', String(err.code)));
            diag.appendChild(line);
        }
        const recent = Diag.list().slice(-5);
        for (let i = 0; i < recent.length; i++) {
            const r = recent[i];
            diag.appendChild(el('div', r.level.toUpperCase() + ' ' + r.code));
        }
        panel.appendChild(diag);
        panel.appendChild(el('div', '快捷键 Alt+Shift+T 循环切换', ''));

        // 面板整体阻断冒泡: 点到我们 UI 的事件不传给站内 document 级监听
        panel.addEventListener('click', function (e) { e.stopPropagation(); });
        panel.addEventListener('mousedown', function (e) { e.stopPropagation(); });
        uiShadow.appendChild(panel);
    }

    function mountUi() {
        if (uiRoot || !document.body) return;
        uiRoot = document.createElement('div');
        uiRoot.setAttribute('id', ROOT_ID);
        uiRoot.setAttribute('data-hdui', 'root');
        // 注意: 宿主必须显式给尺寸 —— 它是 0 内容盒, 撑不开时浮动按钮会溢出到视口外
        uiRoot.style.cssText = 'all:initial;position:fixed;right:18px;bottom:18px;width:44px;height:44px;z-index:2147483000;';
        uiShadow = uiRoot.attachShadow({ mode: 'closed' });

        const style = document.createElement('style');
        style.textContent = panelCss();
        uiShadow.appendChild(style);

        const fab = el('button', 'UI', '');
        fab.className = 'fab';
        fab.setAttribute('type', 'button');
        fab.setAttribute('data-hdui', 'fab');
        fab.setAttribute('title', ScriptName + ' 界面主题');
        fab.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            panelOpen = !panelOpen;
            if (panelOpen) renderPanel();
            else {
                const p = uiShadow.querySelector('.panel');
                if (p) p.remove();
            }
        });
        uiShadow.appendChild(fab);
        document.body.appendChild(uiRoot);
    }

    // ==================================================================
    // 启动
    // ==================================================================
    function onKeydown(e) {
        if (!e.altKey || !e.shiftKey) return;
        const k = e.key || '';
        if (k !== 'T' && k !== 't') return;
        const a = document.activeElement;
        if (a) {
            const tag = (a.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || a.isContentEditable) return;
        }
        e.preventDefault();
        cycleTheme();
    }

    let bootObserver = null;

    function stopBootWatch() {
        if (bootObserver) { bootObserver.disconnect(); bootObserver = null; }
    }

    /**
     * 铺一层主题底色, 避免加载瞬间闪一下原站配色(回退时由 unload() 撤掉)。
     * 真正的 document-start 上 <head> 通常还没建, injectCss 会自动退到 <html>;
     * 若连 <html> 都尚未创建(注入点比真实 Tampermonkey 更早时会出现), 返回 false。
     */
    function paintBootBg() {
        const theme = themeById(storeGet(STORE_THEME, DEFAULT_ID));
        if (!theme || !theme.vars['--hdui-bg']) return false;
        if (!document.documentElement) return false;
        injectCss(BOOT_ID, 'html{background:' + theme.vars['--hdui-bg'] + ';}');
        return true;
    }

    /** <html> 还没出现时退一步: 它一被创建就立刻铺上(仍早于首屏渲染与 DOMContentLoaded) */
    function paintBootBgWhenPossible() {
        if (paintBootBg()) return;
        if (typeof MutationObserver !== 'function') return;
        bootObserver = new MutationObserver(function () {
            if (paintBootBg()) stopBootWatch();
        });
        bootObserver.observe(document, { childList: true });
    }

    function boot() {
        // 全局兜底: 只记录, 不吞掉(不 preventDefault、不改返回值)
        window.addEventListener('error', function (ev) {
            Diag.error('UNCAUGHT', (ev && ev.message) ? ev.message : 'unknown');
        });
        window.addEventListener('unhandledrejection', function (ev) {
            Diag.warn('UNHANDLED_REJECTION', ev && ev.reason ? String(ev.reason) : 'unknown');
        });

        // 底色已在 document-start 铺过; 若那时连 <html> 都还没建则在这里补最后一次
        stopBootWatch();
        if (!document.getElementById(BOOT_ID)) paintBootBg();

        mountUi();
        applyStored(false);
        document.addEventListener('keydown', onKeydown);
    }

    // @run-at document-start: 此处即真正的 document-start(DOM 尚未解析), 先把底色铺上
    // (<html> 若尚未创建, 由 paintBootBgWhenPossible 退化为"一出现就铺")
    try { paintBootBgWhenPossible(); } catch (e) { Diag.fail('E_BOOT_PAINT', e); }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            try { boot(); } catch (e) { Diag.fail('E_BOOT_FAILED', e); }
        }, { once: true });
    } else {
        try { boot(); } catch (e) { Diag.fail('E_BOOT_FAILED', e); }
    }
})();
