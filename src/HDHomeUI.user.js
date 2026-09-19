// ==UserScript==
// @name         HDHomeUI
// @name:zh-CN   HDHome 界面主题套件
// @namespace    https://github.com/ABackerNINI/TampermonkeyScripts
// @version      2026.09.19.4
// @description  HDHome 界面主题套件: 5 套可切换 UI(片库索引/电传纸带/大开本/瑞士网格/播控台)。纯样式层, 不重建 DOM、不接管交互, 原站功能全部保留; 开关内嵌在导航栏末尾(不占悬浮位、不与其它脚本的浮动按钮打架); A/A·GB 两列由其它脚本注入, 有或没有都能上妆、补进来会自动重摆; 页面结构异常时先等结构就绪, 超时才提示并回退默认界面。
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

    // 入口内嵌尺寸(导航栏末尾的一个小文字钮, 不悬浮、不遮挡)
    const DOCK_W = 132;
    const DOCK_H = 22;
    const DOCK_MODE = 'inline'; // 静态校验钉死: 不得退回 fixed 悬浮按钮

    // 种子表 12 列的字典(键 -> 表头识别方式)。站点加列/改名都能被 detectColumns 感知
    const COLUMNS = Object.freeze([
        'type', 'title', 'comments', 'alive', 'size', 'seeders',
        'leechers', 'snatched', 'progress', 'a', 'ave', 'uploader'
    ]);
    // 可选列: A / A/GB 这两列是**别的脚本**注入的(#calcTHeadA / #calcTHeadAve, 单元格带 data-calc-a),
    // 本脚本不能把它们当硬性契约 —— 那个脚本没装、没开、或者注入得比我们晚, 页面就只有 10 列。
    // 规则: 缺失只记日志并跳过这两列的排版, 照常上妆; 之后它们补进来了, 由结构守卫重摆一次。
    const OPTIONAL_COLUMNS = Object.freeze(['a', 'ave']);
    const REQUIRED_COLUMNS = Object.freeze(COLUMNS.filter(function (k) {
        return OPTIONAL_COLUMNS.indexOf(k) < 0;
    }));
    // 结构类错误码: 这类失败**先等一个窗口**再决定要不要弹横幅 —— 外部脚本补列是有时间差的,
    // 表头插了、数据行还没插完的瞬间就会命中 ROW_CELL_COUNT_MISMATCH, 直接弹横幅是误报。
    // 只等这一个码: E_COLUMN_UNKNOWN / E_ANCHOR_MISSING 都是"必需的东西没了",
    // 那是真坏了, 等也没用(拖 8 秒才报错只会让人以为脚本卡死), 直接回退。
    const STRUCT_CODES = Object.freeze(['ROW_CELL_COUNT_MISMATCH']);
    const PENDING_FIRST_MS = 8000;   // 首装/刷新: 那个脚本可能压根还没跑
    const PENDING_LATE_MS = 4000;    // 已上妆后结构变化: 大概率是它正在补列
    const PENDING_TICK_MS = 700;
    const PENDING_MAX_TRIES = 30;
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
    // 版式工具
    // ------------------------------------------------------------------
    // 一条种子 = 一条「记录」, 拆成三个信息区, 由每套主题各自摆位:
    //   主行(类别 + 标题) / 指标带(做种·下载·完成·大小·存活·评论) / 尾注(进度·A·A/GB·发布者)
    // 关键: 每个数值都是「标签 + 值」的独立块, 不再让 12 个格子挤在同一行里飘。
    // ==================================================================
    const R = '#torrenttable > tbody > tr:not(:first-child)'; // 数据行
    const H = '#torrenttable > tbody > tr:first-child';       // 表头行

    function C(m, k) { return ':nth-child(' + m[k] + ')'; }

    /**
     * 指标块(标签在上, 值在下): 用于卡片/网格里需要对齐的数值。
     * 列不在 colMap 里(外部脚本没注入 A / A/GB)时返回空串 —— 绝不能生成 :nth-child(undefined)。
     */
    function statStack(m, key, label, extra) {
        if (!m[key]) return '';
        const s = R + ' > td' + C(m, key);
        return [
            s + '{display:flex;flex-direction:column;justify-content:flex-end;gap:2px;min-width:0;' + (extra || '') + '}',
            s + '::before{content:"' + label + '";font-size:9px;line-height:1.2;letter-spacing:.04em;color:var(--hdui-muted);white-space:nowrap;}'
        ].join('\n');
    }

    /** 指标块(标签在前, 值在后, 同一行): 用于成行排版(纸带/大开本)。同样对缺列免疫 */
    function statInline(m, key, label, extra) {
        if (!m[key]) return '';
        const s = R + ' > td' + C(m, key);
        return [
            s + '{display:block;min-width:0;' + (extra || '') + '}',
            s + '::before{content:"' + label + ' ";font-size:10px;color:var(--hdui-muted);}'
        ].join('\n');
    }

    /** 表头行统一压成一行小标签(列名字典), 不再是一整条色块。grid-column 供卡片网格主题跨满整行 */
    function headStrip(cols, extra) {
        return [
            H + '{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 14px;'
            + 'background:transparent;border:0;border-bottom:1px solid var(--hdui-line);'
            + 'padding:0 2px 6px;margin-bottom:8px;' + (extra || '') + '}',
            H + ' > td{border:0;padding:0;background:transparent;font-size:10px;line-height:1.4;'
            + 'letter-spacing:.06em;color:var(--hdui-muted);' + (cols || '') + '}'
        ].join('\n');
    }

    // ==================================================================
    // 主题定义: 5 套, 布局骨架 / 字体体系 / 信息层级各不相同
    // ==================================================================

    /** 片库索引: 暗色卡片网格 —— 一条记录 = 一张索引卡(类别色条 + 衬线标题 + 指标带) */
    function reelCss(m) {
        const td = function (k) { return R + ' > td' + C(m, k); };
        return [
            '#torrenttable{display:block;}',
            '#torrenttable > tbody{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;}',
            headStrip(''),
            R + '{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px 8px;padding:12px 14px;'
            + 'background:var(--hdui-card);border:1px solid var(--hdui-line);'
            + 'border-top:3px solid var(--hdui-cat,' + CAT_FALLBACK + ');border-radius:var(--hdui-radius);align-items:end;}',
            R + ':hover{border-color:var(--hdui-accent);}',
            R + ' > td{border:0;padding:0;background:transparent;font-size:var(--hdui-fs-sm);color:var(--hdui-muted);}',
            td('type') + '{grid-column:1;grid-row:1;align-self:center;}',
            td('type') + ' img{width:16px;height:16px;}',
            td('title') + '{grid-column:2/-1;grid-row:1;align-self:end;font-family:var(--hdui-font-title);'
            + 'font-size:15px;line-height:1.45;color:var(--hdui-fg);min-width:0;}',
            statStack(m, 'seeders', '做种', 'grid-column:1;grid-row:2;font-size:20px;'),
            R + ' > td' + C(m, 'seeders') + ' a{font-family:var(--hdui-font-num);font-size:20px;line-height:1;color:var(--hdui-accent);}',
            statStack(m, 'leechers', '下载', 'grid-column:2;grid-row:2;'),
            statStack(m, 'snatched', '完成', 'grid-column:3;grid-row:2;'),
            statInline(m, 'size', '大小', 'grid-column:4;grid-row:2;align-self:end;white-space:nowrap;'),
            statStack(m, 'alive', '存活', 'grid-column:5;grid-row:2;'),
            statStack(m, 'comments', '评论', 'grid-column:6;grid-row:2;'),
            statInline(m, 'progress', '进度', 'grid-column:1;grid-row:3;align-self:end;'),
            statInline(m, 'a', 'A', 'grid-column:2;grid-row:3;align-self:end;font-family:var(--hdui-font-num);'),
            statInline(m, 'ave', 'A/GB', 'grid-column:3;grid-row:3;align-self:end;font-family:var(--hdui-font-num);'),
            statInline(m, 'uploader', '发布者', 'grid-column:4/-1;grid-row:3;align-self:end;text-align:right;'),
            '#torrenttable table.torrentname{display:flex;width:100%;}',
            '#torrenttable table.torrentname > tbody{display:flex;width:100%;}',
            '#torrenttable table.torrentname > tbody > tr{display:flex;width:100%;align-items:baseline;}',
            '#torrenttable table.torrentname td{border:0;padding:0;}',
            '#torrenttable table.torrentname td.rss{margin-left:auto;}',
            'ul#mainmenu li a{border-bottom:2px solid transparent;}',
            'ul#mainmenu li.selected a{border-bottom-color:var(--hdui-accent);}'
        ].join('\n');
    }

    /** 电传纸带: 唯一保留真表格语义的一套 —— 全等宽、密排、反白表头、数字右对齐成列 */
    function tapeCss(m) {
        const c = function (k) { return C(m, k); };
        // 只挑真正存在的列(A / A·GB 可能没被外部脚本注入)
        const nums = ['comments', 'alive', 'size', 'seeders', 'leechers', 'snatched', 'a', 'ave']
            .filter(function (k) { return !!m[k]; }).map(c);
        const rules = ['comments', 'alive', 'size', 'seeders', 'leechers']
            .filter(function (k) { return !!m[k]; }).map(c);
        return [
            '#torrenttable{display:table;}',
            '#torrenttable > tbody{display:table-row-group;}',
            '#torrenttable > tbody > tr{display:table-row;}',
            '#torrenttable > tbody > tr > td{display:table-cell;border:0;padding:2px 6px;font-size:12px;'
            + 'line-height:1.35;vertical-align:middle;color:var(--hdui-fg);font-variant-numeric:tabular-nums;}',
            '#torrenttable > tbody > tr:not(:first-child):nth-child(odd){background:var(--hdui-zebra1);}',
            '#torrenttable > tbody > tr:not(:first-child):nth-child(even){background:var(--hdui-zebra2);}',
            // 表头是唯一一条反白横条: 纸带机的栏位标尺
            '#torrenttable > tbody > tr:first-child > td{background:var(--hdui-headbg);color:var(--hdui-headfg);'
            + 'letter-spacing:.04em;border-bottom:2px solid var(--hdui-fg);}',
            '#torrenttable > tbody > tr > td' + c('title') + '{max-width:560px;overflow:hidden;'
            + 'text-overflow:ellipsis;white-space:nowrap;}',
            // 数字成列靠右 + 细点竖线分栏(不是挤成一团)
            nums.map(function (s) { return '#torrenttable > tbody > tr > td' + s + '{text-align:right;}'; }).join('\n'),
            rules.map(function (s) {
                return '#torrenttable > tbody > tr:not(:first-child) > td' + s
                    + '{border-right:1px dotted var(--hdui-rule);}';
            }).join('\n'),
            '#torrenttable > tbody > tr > td' + c('seeders') + ' a{color:var(--hdui-accent);font-weight:700;}',
            '#torrenttable > tbody > tr > td' + c('uploader') + ',#torrenttable > tbody > tr > td' + c('progress')
            + '{color:var(--hdui-muted);}',
            '#torrenttable img{width:12px;height:12px;vertical-align:middle;}',
            'ul#mainmenu li a::before{content:"[";}',
            'ul#mainmenu li a::after{content:"]";}',
            'ul#mainmenu li.selected a{color:var(--hdui-accent);}'
        ].join('\n');
    }

    /** 大开本: 报纸 —— 一行 = 一条新闻(衬线标题 / 署名行 / 规格行), 双细线分隔 */
    function sheetCss(m) {
        const td = function (k) { return R + ' > td' + C(m, k); };
        return [
            '#torrenttable{display:block;}',
            '#torrenttable > tbody{display:block;}',
            '#torrenttable > tbody > tr{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 14px;padding:12px 0;}',
            '#torrenttable > tbody > tr:not(:first-child){border-top:2px solid var(--hdui-line);}',
            '#torrenttable > tbody > tr:last-child{border-bottom:1px solid var(--hdui-line);}',
            // 两个零高满宽伪元素 = 版面换行点: order 3 之后是署名行, order 8 之后是规格行
            R + '::before{content:"";order:3;flex:0 0 100%;height:0;}',
            R + '::after{content:"";order:8;flex:0 0 100%;height:0;}',
            '#torrenttable > tbody > tr > td{border:0;padding:0;font-size:var(--hdui-fs-sm);color:var(--hdui-muted);}',
            headStrip(''),
            td('type') + '{order:1;}',
            td('type') + ' img{width:9px;height:9px;}',
            td('title') + '{order:2;flex:1 1 auto;min-width:0;font-family:var(--hdui-font-title);'
            + 'font-size:17px;line-height:1.5;color:var(--hdui-fg);}',
            td('uploader') + '{order:4;font-style:italic;}',
            statInline(m, 'size', '大小', 'order:9;white-space:nowrap;'),
            statInline(m, 'alive', '存活', 'order:10;white-space:nowrap;'),
            statInline(m, 'comments', '评论', 'order:11;'),
            statInline(m, 'seeders', '做种', 'order:12;font-size:15px;'),
            R + ' > td' + C(m, 'seeders') + ' a{font-size:15px;font-weight:700;color:var(--hdui-fg);}',
            statInline(m, 'leechers', '下载', 'order:13;'),
            statInline(m, 'snatched', '完成', 'order:14;'),
            statInline(m, 'progress', '进度', 'order:15;'),
            statInline(m, 'a', 'A', 'order:16;font-family:var(--hdui-font-num);'),
            statInline(m, 'ave', 'A/GB', 'order:17;font-family:var(--hdui-font-num);'),
            '#torrenttable table.torrentname{display:block;}',
            '#torrenttable table.torrentname > tbody{display:block;}',
            '#torrenttable table.torrentname > tbody > tr{display:block;}',
            '#torrenttable table.torrentname td{border:0;padding:0;display:inline;}',
            'ul#mainmenu{text-align:center;justify-content:center;}',
            'ul#mainmenu li.selected a{font-weight:700;border-top:2px solid var(--hdui-accent);}'
        ].join('\n');
    }

    /** 瑞士网格: 零线条, 全靠留白 —— 左侧文字块, 右侧数字锚点(做种数 28px) */
    function swissCss(m) {
        const td = function (k) { return R + ' > td' + C(m, k); };
        return [
            '#torrenttable{display:block;}',
            '#torrenttable > tbody{display:block;}',
            '#torrenttable > tbody > tr{display:grid;'
            + 'grid-template-columns:auto minmax(0,1fr) repeat(3,96px) 118px;'
            + 'column-gap:28px;row-gap:4px;align-items:end;padding:22px 0;border:0;}',
            '#torrenttable > tbody > tr > td{border:0;padding:0;font-size:11px;color:var(--hdui-muted);min-width:0;}',
            headStrip('text-transform:none;'),
            td('type') + '{grid-column:1;grid-row:1;align-self:start;}',
            td('type') + ' img{width:14px;height:14px;}',
            td('title') + '{grid-column:2;grid-row:1;font-size:14px;line-height:1.4;color:var(--hdui-fg);}',
            td('uploader') + '{grid-column:2;grid-row:2;}',
            statStack(m, 'size', '大小', 'grid-column:3;grid-row:1;'),
            statStack(m, 'alive', '存活', 'grid-column:3;grid-row:2;'),
            statStack(m, 'comments', '评论', 'grid-column:4;grid-row:1;'),
            statStack(m, 'progress', '进度', 'grid-column:4;grid-row:2;'),
            statStack(m, 'leechers', '下载', 'grid-column:5;grid-row:1;'),
            statStack(m, 'snatched', '完成', 'grid-column:5;grid-row:2;'),
            statStack(m, 'a', 'A 值', 'grid-column:3;grid-row:3;'),
            statStack(m, 'ave', 'A/GB', 'grid-column:4;grid-row:3;'),
            // 唯一的视觉锚点: 做种数 28px, 跨两行, 右对齐
            td('seeders') + '{grid-column:6;grid-row:1/span 2;text-align:right;align-self:center;font-size:28px;}',
            R + ' > td' + C(m, 'seeders') + ' a{font-size:28px;font-weight:700;line-height:1;color:var(--hdui-accent);}',
            '#torrenttable table.torrentname{display:block;}',
            '#torrenttable table.torrentname > tbody{display:block;}',
            '#torrenttable table.torrentname > tbody > tr{display:block;}',
            '#torrenttable table.torrentname td{border:0;padding:0;display:inline;}',
            'ul#mainmenu li a{padding:2px 0;font-size:13px;}',
            'ul#mainmenu li.selected a{color:var(--hdui-accent);}'
        ].join('\n');
    }

    /** 播控台: 深石板 + 青 —— 行分 4 轨道, 类别色点 + 做种电平条 */
    function signalCss(m) {
        const td = function (k) { return R + ' > td' + C(m, k); };
        return [
            '#torrenttable{display:block;}',
            '#torrenttable > tbody{display:block;}',
            '#torrenttable > tbody > tr{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));'
            + 'align-items:center;gap:6px 12px;padding:8px 12px;margin-bottom:5px;'
            + 'background:var(--hdui-card);border-radius:4px;border-top:1px solid var(--hdui-line);}',
            '#torrenttable > tbody > tr > td{border:0;padding:0;font-size:12px;color:var(--hdui-muted);'
            + 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
            headStrip(''),
            td('type') + '{grid-column:1;grid-row:1;}',
            td('type') + ' img{display:none;}',
            // 类别改成色点: 一眼扫过整个列表的类别分布
            td('type') + ' a{display:inline-block;width:9px;height:9px;border-radius:50%;'
            + 'background:var(--hdui-cat,' + '#5fd4e4' + ');vertical-align:middle;}',
            td('title') + '{grid-column:2/-1;grid-row:1;font-size:13px;color:var(--hdui-fg);white-space:normal;}',
            statStack(m, 'seeders', '做种', 'grid-column:1;grid-row:2;overflow:visible;font-size:18px;'),
            R + ' > td' + C(m, 'seeders') + ' a{font-family:var(--hdui-font-num);font-size:18px;line-height:1;color:var(--hdui-accent);}',
            // 电平条: 做种占比, 长度由行上的 --hdui-ratio 驱动
            R + ' > td' + C(m, 'seeders') + '::after{content:"";display:block;'
            + 'width:calc(var(--hdui-ratio,0) * 56px);max-width:56px;height:4px;margin-top:4px;'
            + 'border-radius:2px;background:var(--hdui-accent);}',
            statStack(m, 'leechers', '下载', 'grid-column:2;grid-row:2;'),
            statStack(m, 'snatched', '完成', 'grid-column:3;grid-row:2;'),
            statStack(m, 'comments', '评论', 'grid-column:4;grid-row:2;'),
            statStack(m, 'size', '大小', 'grid-column:1;grid-row:3;'),
            statStack(m, 'alive', '存活', 'grid-column:2;grid-row:3;'),
            statStack(m, 'progress', '进度', 'grid-column:3;grid-row:3;'),
            statStack(m, 'a', 'A 值', 'grid-column:4;grid-row:3;'),
            statStack(m, 'ave', 'A/GB', 'grid-column:1;grid-row:4;'),
            td('uploader') + '{grid-column:2/-1;grid-row:4;text-align:right;}',
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
            id: 'reel', name: '片库索引', note: '索引卡网格 · 衬线标题 · 暗金',
            vars: {
                '--hdui-bg': '#16181c', '--hdui-panel': '#1b1e23', '--hdui-card': '#1e2126',
                '--hdui-fg': '#ece7de', '--hdui-muted': '#8b8f96', '--hdui-accent': '#c8a35a',
                '--hdui-link': '#d8d2c6', '--hdui-line': '#2c3037', '--hdui-rule': '#3a3f47',
                '--hdui-headbg': 'transparent', '--hdui-headfg': '#8b8f96',
                '--hdui-zebra1': '#1e2126', '--hdui-zebra2': '#22262c',
                '--hdui-font': '"Songti SC","Noto Serif SC",Georgia,"Microsoft YaHei",serif',
                '--hdui-font-title': '"Songti SC","Noto Serif SC",Georgia,serif',
                '--hdui-font-num': 'ui-monospace,Consolas,monospace',
                '--hdui-fs': '13px', '--hdui-fs-sm': '11px',
                '--hdui-navpad': '8px 6px', '--hdui-navitem': '6px 10px', '--hdui-navgap': '2px',
                '--hdui-radius': '3px'
            },
            css: reelCss
        },
        {
            id: 'tape', name: '电传纸带', note: '真表格密排 · 全等宽 · 纸黄 · 反白标尺',
            vars: {
                '--hdui-bg': '#f4efe3', '--hdui-panel': '#f4efe3', '--hdui-card': '#efeae0',
                '--hdui-fg': '#1b1a17', '--hdui-muted': '#6b665d', '--hdui-accent': '#a12a20',
                '--hdui-link': '#1b1a17', '--hdui-line': '#1b1a17', '--hdui-rule': '#b3aa97',
                '--hdui-headbg': '#1b1a17', '--hdui-headfg': '#f4efe3',
                '--hdui-zebra1': '#f6f3ec', '--hdui-zebra2': '#efeae0',
                '--hdui-font': 'ui-monospace,Consolas,"Courier New","Microsoft YaHei",monospace',
                '--hdui-font-title': 'ui-monospace,Consolas,"Courier New",monospace',
                '--hdui-font-num': 'ui-monospace,Consolas,monospace',
                '--hdui-fs': '12px', '--hdui-fs-sm': '11px',
                '--hdui-navpad': '6px 4px', '--hdui-navitem': '6px 6px', '--hdui-navgap': '0px',
                '--hdui-radius': '0px'
            },
            css: tapeCss
        },
        {
            id: 'sheet', name: '大开本', note: '报纸三行 · 衬线标题 · 双细线',
            vars: {
                '--hdui-bg': '#fbfaf7', '--hdui-panel': '#fbfaf7', '--hdui-card': '#fbfaf7',
                '--hdui-fg': '#14120f', '--hdui-muted': '#5c5751', '--hdui-accent': '#8f2b21',
                '--hdui-link': '#14120f', '--hdui-line': '#14120f', '--hdui-rule': '#c9c3b6',
                '--hdui-headbg': 'transparent', '--hdui-headfg': '#5c5751',
                '--hdui-zebra1': '#fbfaf7', '--hdui-zebra2': '#f6f4ef',
                '--hdui-font': '"Songti SC","Noto Serif SC","Microsoft YaHei",serif',
                '--hdui-font-title': '"Songti SC","Noto Serif SC",serif',
                '--hdui-font-num': 'ui-monospace,Consolas,monospace',
                '--hdui-fs': '13px', '--hdui-fs-sm': '11px',
                '--hdui-navpad': '10px 0', '--hdui-navitem': '8px 0', '--hdui-navgap': '18px',
                '--hdui-radius': '0px'
            },
            css: sheetCss
        },
        {
            id: 'swiss', name: '瑞士网格', note: '零线条 · 28px 做种锚点 · 钴蓝',
            vars: {
                '--hdui-bg': '#ffffff', '--hdui-panel': '#ffffff', '--hdui-card': '#ffffff',
                '--hdui-fg': '#111111', '--hdui-muted': '#9a9a9a', '--hdui-accent': '#1a35d8',
                '--hdui-link': '#111111', '--hdui-line': '#e6e6e6', '--hdui-rule': '#e6e6e6',
                '--hdui-headbg': 'transparent', '--hdui-headfg': '#9a9a9a',
                '--hdui-zebra1': '#ffffff', '--hdui-zebra2': '#ffffff',
                '--hdui-font': 'Inter,"Helvetica Neue","PingFang SC","Microsoft YaHei",sans-serif',
                '--hdui-font-title': 'Inter,"Helvetica Neue","PingFang SC",sans-serif',
                '--hdui-font-num': 'Inter,"Helvetica Neue",sans-serif',
                '--hdui-fs': '13px', '--hdui-fs-sm': '11px',
                '--hdui-navpad': '16px 0', '--hdui-navitem': '2px 0', '--hdui-navgap': '26px',
                '--hdui-radius': '0px'
            },
            css: swissCss
        },
        {
            id: 'signal', name: '播控台', note: '4 轨道 · 电平条 · 类别色点 · 青',
            vars: {
                '--hdui-bg': '#0f1620', '--hdui-panel': '#131c27', '--hdui-card': '#16202c',
                '--hdui-fg': '#dce6ef', '--hdui-muted': '#7d8fa1', '--hdui-accent': '#5fd4e4',
                '--hdui-link': '#bcd2e0', '--hdui-line': '#24313f', '--hdui-rule': '#24313f',
                '--hdui-headbg': 'transparent', '--hdui-headfg': '#7d8fa1',
                '--hdui-zebra1': '#16202c', '--hdui-zebra2': '#18232f',
                '--hdui-font': '"PingFang SC","Microsoft YaHei",system-ui,sans-serif',
                '--hdui-font-title': '"PingFang SC","Microsoft YaHei",sans-serif',
                '--hdui-font-num': 'ui-monospace,Consolas,monospace',
                '--hdui-fs': '13px', '--hdui-fs-sm': '11px',
                '--hdui-navpad': '4px', '--hdui-navitem': '5px 9px', '--hdui-navgap': '2px',
                '--hdui-radius': '4px'
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

    /**
     * 读出表头 -> {key: 1-based 列号}。
     * missing = 缺**必需**列(判失败); absent = 缺**可选**列(A / A/GB, 只记日志, 排版时跳过)。
     */
    function detectColumns(table) {
        const body = table.tBodies && table.tBodies[0];
        if (!body) return { map: null, missing: REQUIRED_COLUMNS.slice(), absent: [], reason: 'TABLE_NO_TBODY' };
        const head = body.rows[0];
        if (!head) return { map: null, missing: REQUIRED_COLUMNS.slice(), absent: [], reason: 'TABLE_NO_HEAD' };
        const map = {};
        const cells = head.cells;
        for (let i = 0; i < cells.length; i++) {
            const key = headerKey(cells[i]);
            if (key && map[key] === undefined) map[key] = i + 1;
        }
        const missing = [];
        for (let i = 0; i < REQUIRED_COLUMNS.length; i++) {
            if (map[REQUIRED_COLUMNS[i]] === undefined) missing.push(REQUIRED_COLUMNS[i]);
        }
        const absent = [];
        for (let i = 0; i < OPTIONAL_COLUMNS.length; i++) {
            if (map[OPTIONAL_COLUMNS[i]] === undefined) absent.push(OPTIONAL_COLUMNS[i]);
        }
        // 数据行必须与表头列数一致, 否则说明站点改版导致错位(也可能是外部脚本补列补到一半)
        let shapeOk = true;
        if (body.rows.length > 1 && body.rows[1].cells.length !== cells.length) shapeOk = false;
        return {
            map: missing.length ? null : map,
            missing: missing,
            absent: absent,
            reason: shapeOk ? '' : 'ROW_CELL_COUNT_MISMATCH',
            headCount: cells.length
        };
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
        // 必需列识别不全 -> 拒绝上妆(列一旦错位, 主题会把数据摆到错误的槽位)
        if (!d.map) {
            const detail = d.reason === 'ROW_CELL_COUNT_MISMATCH'
                ? shapeMsg
                : '种子表缺少可识别的列: ' + d.missing.join(',');
            return { ok: false, code: d.reason || 'E_COLUMN_UNKNOWN', detail: detail, colMap: null };
        }
        // 列都在、但数据行单元格数与表头对不上 -> 改版信号(或外部脚本补列补到一半), 一样拒绝
        if (d.reason) {
            return { ok: false, code: d.reason, detail: shapeMsg, colMap: null };
        }
        // 可选列缺席不报错, 只是这两列不排版 —— 补进来后由结构守卫重摆
        if (d.absent.length) {
            return { ok: true, code: 'OK_NO_CALC', detail: '外部脚本的 ' + d.absent.join('/') + ' 列未注入, 已跳过', colMap: d.map, absent: d.absent };
        }
        return { ok: true, code: 'OK', detail: '', colMap: d.map, absent: [] };
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
            // 导航: flex + 显式列间距 —— 旧的 inline-block 紧挨排列会把 16 个入口挤成一坨
            'html[data-hdui-theme] ul#mainmenu{display:flex;flex-wrap:wrap;align-items:center;'
            + 'row-gap:4px;column-gap:var(--hdui-navgap);margin:0;padding:var(--hdui-navpad);'
            + 'background:var(--hdui-panel);list-style:none;}',
            'html[data-hdui-theme] ul#mainmenu li{display:block;}',
            'html[data-hdui-theme] ul#mainmenu li a{display:block;padding:var(--hdui-navitem);'
            + 'color:var(--hdui-muted);white-space:nowrap;}',
            'html[data-hdui-theme] ul#mainmenu li.selected a{color:var(--hdui-accent);}',
            'html[data-hdui-theme] table.searchbox{background:var(--hdui-panel);color:var(--hdui-fg);border:1px solid var(--hdui-line);}',
            'html[data-hdui-theme] table.searchbox td.colhead{background:var(--hdui-panel);color:var(--hdui-fg);}',
            'html[data-hdui-theme] table.searchbox td.rowfollow{background:transparent;border-color:var(--hdui-line);}',
            'html[data-hdui-theme] input.btn,html[data-hdui-theme] select,html[data-hdui-theme] input[type=text]{font-family:var(--hdui-font);font-size:var(--hdui-fs-sm);}',
            'html[data-hdui-theme] p[align="center"]{color:var(--hdui-muted);font-size:var(--hdui-fs-sm);}',
            'html[data-hdui-theme] p[align="center"] a{color:var(--hdui-link);}',
            'html[data-hdui-theme] #torrenttable{width:100%;border-collapse:collapse;background:transparent;}',
            // 把站点的 td 默认边框/底色/内边距全抹掉, 防止 card/grid 里漏出浅色格线
            'html[data-hdui-theme] table.torrents td,html[data-hdui-theme] #torrenttable td{border:0;padding:0;background:transparent;}',
            'html[data-hdui-theme] #torrenttable img{max-width:100%;}'
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
    let appliedSig = null;   // 上次成功上妆时的列签名(用来发现外部脚本加/删了列)
    let appliedAbsent = [];  // 上次上妆时缺席的可选列(面板里显示, 便于排查时序)

    function colMapSig(map) {
        if (!map) return '-';
        return Object.keys(map).sort().map(function (k) { return k + map[k]; }).join(',');
    }

    // ==================================================================
    // 「等结构就绪」窗口
    // ------------------------------------------------------------------
    // A / A/GB 是别的脚本注入的, 它什么时候跑完我们说了不算。以前只要在那个瞬间
    // 少一列就立刻弹红横幅回退 —— 用户看到的正是「点一下重试就好了」。现在改成:
    // 结构类失败先进窗口等, 结构一变就重试; 窗口内恢复就静默上妆, 超时才真回退。
    // ==================================================================
    let pendingTimer = 0;
    let pendingUntil = 0;
    let pendingTries = 0;
    let pendingNote = '';

    function stopPending() {
        if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = 0; }
        pendingUntil = 0;
        pendingTries = 0;
        pendingNote = '';
        appliedSig = null;
    }

    function armPending(note, windowMs) {
        if (pendingUntil) return; // 已在窗口内: 不续期, 免得外部脚本每动一下都往后延
        pendingUntil = Date.now() + windowMs;
        pendingTries = 0;
        pendingNote = note;
        // 等窗口期间给出可观测状态: 此刻既没上妆也没回退, 只是在等那个脚本把列补完。
        // 已经在妆上的(运行中补列补到一半)保留当前主题, 不卸 —— 否则 4s 窗口里会闪一下原站界面;
        // 首装/刷新那次 unload() 已经把主题属性删了, 这里补回 default, 免得属性缺失。
        if (!document.documentElement.dataset.hduiTheme) {
            document.documentElement.dataset.hduiTheme = DEFAULT_ID;
        }
        document.documentElement.dataset.hduiState = 'pending';
        Diag.info('STRUCT_PENDING', '结构尚未就绪(' + note + '), 等外部脚本补齐, 最多 '
            + Math.round(windowMs / 1000) + 's');
        watchStructure();
        tickPending();
    }

    function tickPending() {
        if (pendingTimer) clearTimeout(pendingTimer);
        pendingTimer = setTimeout(function () {
            pendingTimer = 0;
            try {
                if (!pendingUntil) return;
                pendingTries++;
                if (Date.now() >= pendingUntil || pendingTries > PENDING_MAX_TRIES) {
                    const note = pendingNote;
                    stopPending();
                    stopWatch();
                    Diag.error('E_STRUCT_TIMEOUT', '等待结构就绪超时: ' + note);
                    fallbackToDefault('E_STRUCT_TIMEOUT', '等待外部脚本补齐种子表结构超时(' + note + ')');
                    return;
                }
                // 到点主动试一次: 外部脚本可能已经补完但没有再触发 mutation
                const id = storeGet(STORE_THEME, DEFAULT_ID);
                if (id !== DEFAULT_ID) applyTheme(id);
                if (pendingUntil) tickPending();
            } catch (e) { Diag.fail('E_PENDING_FAILED', e); }
        }, PENDING_TICK_MS);
    }

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
        stopPending();
        unload();
        document.documentElement.dataset.hduiTheme = DEFAULT_ID;
        document.documentElement.dataset.hduiState = 'fallback';
        storeSet(STORE_ERR, { code: code, detail: detail, at: Date.now() });
        showAlert(code, detail);
        renderPanel();
    }

    /** 应用主题。结构类失败先进「等结构就绪」窗口, 不再立刻弹横幅 */
    function applyTheme(id, silentRetry) {
        const theme = themeById(id);
        if (!theme) {
            Diag.warn('UNKNOWN_THEME', '未知主题 ' + id + ', 回落默认');
            fallbackToDefault('E_UNKNOWN_THEME', '未知主题 ' + id);
            return false;
        }
        if (theme.id === DEFAULT_ID) stopPending();
        unload();
        dismissAlert();
        if (theme.id === DEFAULT_ID) {
            currentId = DEFAULT_ID;
            document.documentElement.dataset.hduiTheme = DEFAULT_ID;
            document.documentElement.dataset.hduiState = 'off';
            Diag.info('THEME_OFF', '已恢复原站默认界面');
            syncUiVars();
            dockUi();
            renderPanel();
            return true;
        }

        const v = validateContract();
        if (!v.ok) {
            Diag.error(v.code, v.detail);
            currentId = DEFAULT_ID;
            // 结构类失败: 先把「那个脚本还没把 A / A·GB 补进来」当第一嫌疑, 等一个窗口。
            // 以前这里直接弹横幅 —— 用户点重试就好了, 纯粹是时序误报。
            if (STRUCT_CODES.indexOf(v.code) >= 0) {
                armPending(v.code + ' ' + v.detail, appliedSig ? PENDING_LATE_MS : PENDING_FIRST_MS);
                return false;
            }
            fallbackToDefault(v.code, v.detail);
            return false;
        }

        try {
            stopPending();
            injectCss(STYLE_ID, buildCss(theme, v.colMap));
            paintRows(v.colMap);
            currentId = theme.id;
            appliedSig = colMapSig(v.colMap);
            appliedAbsent = v.absent || [];
            document.documentElement.dataset.hduiTheme = theme.id;
            document.documentElement.dataset.hduiState = 'applied';
            storeSet(STORE_ERR, null);
            Diag.info('THEME_ON', theme.name + '(' + theme.id + ') 已应用 [' + v.code + ']; '
                + (v.code === 'OK_NO_TABLE' ? '本页无种子表, 只应用全局样式'
                    : (v.code === 'OK_NO_CALC' ? v.detail : '列映射完整')));
            syncUiVars();
            dockUi();
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

    /**
     * 结构变了之后怎么办:
     *   - 还在等结构就绪 -> 立刻再试一次那个主题;
     *   - 列集合变了(外部脚本把 A / A·GB 补进来了, 或者撤走了) -> 重摆一次, 让 nth-child 重新对齐;
     *   - 结构真的坏了 -> 先等短窗口, 超时才回退(补列补一半的时刻不该弹横幅)。
     */
    function onStructureChange() {
        try {
            if (pendingUntil) {
                const id = storeGet(STORE_THEME, DEFAULT_ID);
                if (id !== DEFAULT_ID) applyTheme(id);
                return;
            }
            if (currentId === DEFAULT_ID) return;
            const v = validateContract();
            if (!v.ok) {
                Diag.error('E_STRUCTURE_CHANGED', '页面结构在运行中变化: ' + v.detail);
                currentId = DEFAULT_ID;
                if (STRUCT_CODES.indexOf(v.code) >= 0) {
                    armPending(v.code + ' ' + v.detail, PENDING_LATE_MS);
                    return;
                }
                fallbackToDefault('E_STRUCTURE_CHANGED', v.detail);
                return;
            }
            const sig = colMapSig(v.colMap);
            if (sig !== appliedSig) {
                Diag.info('COLS_CHANGED', '种子表列集合变化: ' + appliedSig + ' -> ' + sig);
                applyTheme(currentId);
                return;
            }
            clearPaint();
            paintRows(v.colMap);
            appliedAbsent = v.absent || [];
        } catch (e) {
            Diag.fail('E_WATCH_FAILED', e);
        }
    }

    function watchStructure() {
        stopWatch();
        const scope = document.getElementById('outer') || document.body;
        if (!scope || typeof MutationObserver !== 'function') return;
        observer = new MutationObserver(function () {
            if (watchTimer) clearTimeout(watchTimer);
            watchTimer = setTimeout(function () {
                watchTimer = 0;
                onStructureChange();
            }, 500);
        });
        observer.observe(scope, { childList: true, subtree: true });
    }

    // ==================================================================
    // 自持 UI: 内嵌开关 + 下拉面板(closed shadow, 事件不冒泡到站内)
    // ------------------------------------------------------------------
    // 入口不再是右下角浮动圆钮: 它跟其它脚本的 FAB 抢同一个位置。改为量取
    // ul#mainmenu 最后一个导航项的右边空档, 把开关摆成导航栏末尾的一个小文字钮。
    // ==================================================================
    let uiRoot = null;
    let uiShadow = null;
    let uiPanel = null;

    function el(tag, text, style) {
        const n = document.createElement(tag);
        if (text !== undefined) n.textContent = text;
        if (style) n.style.cssText = style;
        return n;
    }

    // all:initial 之后宿主是 0 内容盒, 必须显式给尺寸, 否则内容会溢出到视口外
    const HOST_BASE = 'all:initial;display:block;position:absolute;width:' + DOCK_W + 'px;'
        + 'height:' + DOCK_H + 'px;z-index:2147483000;';

    /** 量出开关该摆的位置(视口坐标): 导航栏末尾空档 -> 主框架右上 -> null(交给 fixed 兜底) */
    function dockRect() {
        const menu = document.querySelector('ul#mainmenu');
        if (menu) {
            const mr = menu.getBoundingClientRect();
            if (mr.width > 0) {
                const items = menu.querySelectorAll('li');
                const last = items.length ? items[items.length - 1] : null;
                const lr = last ? last.getBoundingClientRect() : null;
                if (lr && lr.height > 0) {
                    if (lr.right + 10 + DOCK_W <= mr.right + 1) {
                        return { left: lr.right + 10, top: lr.top + (lr.height - DOCK_H) / 2 };
                    }
                    // 该行没空档: 挪到菜单块下一行的行首
                    return { left: mr.left, top: lr.bottom + 6 };
                }
                return { left: mr.left, top: mr.top };
            }
        }
        const frame = document.querySelector('table.mainouter');
        if (frame) {
            const fr = frame.getBoundingClientRect();
            if (fr.width > 0) return { left: Math.max(8, fr.right - DOCK_W - 12), top: fr.top + 8 };
        }
        return null;
    }

    /**
     * 把开关摆到页面里(absolute + 文档坐标), 主题换了/窗口变了都要重摆。
     * 注意: 这里只改 left/top/position, 绝不用 cssText 整体重写 ——
     * cssText 会把宿主上的 --ui-* 配色变量一并清掉(它们在 HOST_BASE 里)。
     */
    function dockUi() {
        if (!uiRoot) return;
        const d = dockRect();
        if (!d) {
            uiRoot.style.position = 'fixed';
            uiRoot.style.right = '10px';
            uiRoot.style.top = '8px';
            uiRoot.style.left = 'auto';
            return;
        }
        uiRoot.style.position = 'absolute';
        uiRoot.style.right = 'auto';
        uiRoot.style.left = Math.round(d.left + window.scrollX) + 'px';
        uiRoot.style.top = Math.round(Math.max(0, d.top) + window.scrollY) + 'px';
    }

    /** 面板跟着开关走: 固定在开关下方, 空间不够就往上翻 */
    function placePanel() {
        if (!uiPanel || !uiRoot) return;
        const r = uiRoot.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const h = uiPanel.offsetHeight || 320;
        let left = Math.min(Math.max(8, r.left), Math.max(8, vw - uiPanel.offsetWidth - 8));
        let top = r.bottom + 6;
        if (top + h > vh - 8 && r.top - 6 - h > 8) top = r.top - 6 - h;
        uiPanel.style.left = Math.round(left) + 'px';
        uiPanel.style.top = Math.round(Math.max(8, top)) + 'px';
    }

    /** 自持 UI 的配色跟随当前主题(默认界面时用中性深色, 保证任何底色下都读得清) */
    function syncUiVars() {
        if (!uiRoot) return;
        const v = (themeById(currentId) || DEFAULT_THEME).vars || {};
        const pick = function (k, def) { return v[k] || def; };
        uiRoot.style.setProperty('--ui-bg', pick('--hdui-card', '#1b1e23'));
        uiRoot.style.setProperty('--ui-fg', pick('--hdui-fg', '#ece7de'));
        uiRoot.style.setProperty('--ui-muted', pick('--hdui-muted', '#8b8f96'));
        uiRoot.style.setProperty('--ui-accent', pick('--hdui-accent', '#c8a35a'));
        uiRoot.style.setProperty('--ui-line', pick('--hdui-line', '#2c3037'));
        uiRoot.style.setProperty('--ui-font', pick('--hdui-font', '"Microsoft YaHei",sans-serif'));
        setDockLabel();
    }

    function panelCss() {
        return [
            // 开关: 导航栏末尾的一个小文字钮, 不抢眼、不遮挡、不与浮动按钮抢位
            '.dock{display:flex;align-items:center;gap:4px;width:100%;height:100%;padding:0 6px;',
            'box-sizing:border-box;background:transparent;border:0;cursor:pointer;',
            'font:11px/1 var(--ui-font,"Microsoft YaHei",sans-serif);color:var(--ui-muted);',
            'white-space:nowrap;overflow:hidden;}',
            '.dock:hover,.dock:focus-visible{color:var(--ui-accent);}',
            '.dock .caret{margin-left:auto;font-size:9px;}',
            '.dock .name{overflow:hidden;text-overflow:ellipsis;}',
            // 面板: 锚在开关下方的浮层
            '.panel{position:fixed;display:none;flex-direction:column;width:268px;',
            'max-height:min(430px,calc(100vh - 24px));overflow:auto;padding:10px;',
            'background:var(--ui-bg);color:var(--ui-fg);border:1px solid var(--ui-line);',
            'border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,.35);',
            'font:12px/1.5 var(--ui-font,"Microsoft YaHei",sans-serif);z-index:2147483000;}',
            '.panel.open{display:flex;}',
            '.panel h3{margin:0 0 8px;font-size:12px;font-weight:600;color:var(--ui-muted);}',
            '.item{display:block;width:100%;text-align:left;margin-bottom:4px;padding:7px 9px;cursor:pointer;',
            'background:transparent;color:var(--ui-fg);border:1px solid var(--ui-line);border-radius:6px;',
            'font:12px/1.4 inherit;}',
            '.item:hover{border-color:var(--ui-accent);}',
            '.item[aria-pressed="true"]{border-color:var(--ui-accent);color:var(--ui-accent);}',
            '.item small{display:block;color:var(--ui-muted);font-size:10px;margin-top:2px;}',
            '.diag{margin-top:10px;border-top:1px solid var(--ui-line);padding-top:8px;color:var(--ui-muted);font-size:10px;}',
            '.diag code{color:var(--ui-accent);font-family:ui-monospace,Consolas,monospace;}',
            '.hint{margin-top:8px;color:var(--ui-muted);font-size:10px;}'
        ].join('');
    }

    function closePanel() {
        if (uiPanel) {
            uiPanel.className = 'panel';
            uiPanel.style.left = '-9999px';
            uiPanel.style.top = '-9999px';
        }
        disarmAutoClose();
    }

    function openPanel() {
        if (!uiPanel) return;
        renderPanel();
        uiPanel.className = 'panel open';
        placePanel();
        armAutoClose();
    }

    // 失焦/点页面别处就收起(只在展开期间挂监听, 收起即摘)
    let autoCloseOn = false;
    function onOutsideDown(e) {
        if (!uiPanel || uiPanel.className.indexOf('open') < 0) return;
        if (uiRoot && uiRoot.contains(e.target)) return;
        closePanel();
    }
    function armAutoClose() {
        if (autoCloseOn) return;
        autoCloseOn = true;
        document.addEventListener('mousedown', onOutsideDown, true);
        window.addEventListener('scroll', onPanelViewport, true);
    }
    function disarmAutoClose() {
        if (!autoCloseOn) return;
        autoCloseOn = false;
        document.removeEventListener('mousedown', onOutsideDown, true);
        window.removeEventListener('scroll', onPanelViewport, true);
    }

    // 两个重排入口分开注册: disarm 只摘「面板展开期间」的那些, 常驻的 resize 重摆不受影响
    let rafPanel = false;
    function onPanelViewport() {
        if (rafPanel) return;
        rafPanel = true;
        requestAnimationFrame(function () {
            rafPanel = false;
            try {
                if (!uiPanel || uiPanel.className.indexOf('open') < 0) return;
                const r = uiRoot ? uiRoot.getBoundingClientRect() : null;
                if (!r || r.bottom < 0 || r.top > window.innerHeight) closePanel();
                else placePanel();
            } catch (e) { Diag.fail('E_UI_RELAYOUT', e); }
        });
    }

    let rafDock = false;
    function onDockResize() {
        if (rafDock) return;
        rafDock = true;
        requestAnimationFrame(function () {
            rafDock = false;
            try {
                dockUi();
                if (uiPanel && uiPanel.className.indexOf('open') >= 0) placePanel();
            } catch (e) { Diag.fail('E_UI_RELAYOUT', e); }
        });
    }

    function renderPanel() {
        if (!uiShadow || !uiPanel) return;
        while (uiPanel.firstChild) uiPanel.removeChild(uiPanel.firstChild);

        uiPanel.appendChild(el('h3', ScriptName + ' · 界面主题'));

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
            btn.appendChild(el('small', t.note));
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                selectTheme(t.id);
            });
            uiPanel.appendChild(btn);
        }

        const diag = el('div', undefined, '');
        diag.className = 'diag';
        const head = el('div', undefined, '');
        head.appendChild(document.createTextNode('当前: '));
        head.appendChild(el('code', String(currentId)));
        diag.appendChild(head);

        // A / A·GB 是别的脚本注入的, 面板里说清楚它到底在不在 —— 排查时序问题全靠这一行
        const calcLine = el('div', undefined, '');
        calcLine.appendChild(document.createTextNode('A / A·GB: '));
        calcLine.appendChild(el('code', appliedAbsent.length ? '外部脚本未注入, 已跳过' : '已接管'));
        diag.appendChild(calcLine);
        if (pendingUntil) {
            diag.appendChild(el('div', '等待外部脚本补列中…'));
        }

        const err = storeGet(STORE_ERR, null);
        if (err && err.code) {
            const line = el('div', undefined, '');
            line.appendChild(document.createTextNode('上次错误: '));
            line.appendChild(el('code', String(err.code)));
            diag.appendChild(line);
        }
        const recent = Diag.list().slice(-5);
        for (let i = 0; i < recent.length; i++) {
            diag.appendChild(el('div', recent[i].level.toUpperCase() + ' ' + recent[i].code));
        }
        uiPanel.appendChild(diag);
        uiPanel.appendChild(el('div', '快捷键 Alt+Shift+T 循环切换', ''));
        if (uiPanel.className.indexOf('open') >= 0) placePanel();
    }

    function setDockLabel() {
        if (!uiShadow) return;
        const dock = uiShadow.querySelector('.dock .name');
        if (dock) dock.textContent = (themeById(currentId) || DEFAULT_THEME).name;
    }

    function mountUi() {
        if (uiRoot || !document.body) return;
        uiRoot = document.createElement('div');
        uiRoot.setAttribute('id', ROOT_ID);
        uiRoot.setAttribute('data-hdui', 'root');
        // 宿主必须显式给尺寸: all:initial 之后它是 0 内容盒, 撑不开就会溢出视口外
        uiRoot.style.cssText = HOST_BASE;
        uiShadow = uiRoot.attachShadow({ mode: 'closed' });

        const style = document.createElement('style');
        style.textContent = panelCss();
        uiShadow.appendChild(style);

        const dock = el('button', undefined, '');
        dock.className = 'dock';
        dock.setAttribute('type', 'button');
        dock.setAttribute('data-hdui', 'dock');
        dock.setAttribute('title', ScriptName + ' 界面主题');
        const name = el('span', (themeById(currentId) || DEFAULT_THEME).name, '');
        name.className = 'name';
        const caret = el('span', '▾', '');
        caret.className = 'caret';
        dock.appendChild(document.createTextNode('界面 · '));
        dock.appendChild(name);
        dock.appendChild(caret);
        dock.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (uiPanel && uiPanel.className.indexOf('open') >= 0) closePanel();
            else openPanel();
        });
        uiShadow.appendChild(dock);

        uiPanel = el('div', undefined, '');
        uiPanel.className = 'panel';
        uiPanel.setAttribute('data-hdui', 'panel');
        uiPanel.style.left = '-9999px';
        uiPanel.style.top = '-9999px';
        // 面板整体阻断冒泡: 点到我们 UI 的事件不传给站内 document 级监听
        uiPanel.addEventListener('click', function (e) { e.stopPropagation(); });
        uiPanel.addEventListener('mousedown', function (e) { e.stopPropagation(); });
        uiShadow.appendChild(uiPanel);

        document.body.appendChild(uiRoot);
        syncUiVars();
        dockUi();
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
        window.addEventListener('resize', onDockResize); // 常驻: 窗口变了要重摆内嵌开关
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
