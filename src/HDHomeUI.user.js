// ==UserScript==
// @name         HDHomeUI
// @name:zh-CN   HDHome 界面主题套件
// @namespace    https://github.com/ABackerNINI/TampermonkeyScripts
// @version      2026.09.19.10
// @description  HDHome 界面主题: 胶片墙(齿孔片边 · 帧号 · 做种金), 可一键切回原站默认。纯样式层, 不重建 DOM、不接管交互, 原站功能全部保留; 开关内嵌在导航栏末尾(不占悬浮位、不与其它脚本的浮动按钮打架); A/A·GB 两列由其它脚本注入, 有或没有都能上妆、补进来会自动重摆; 页面结构异常时先等结构就绪, 超时才提示并回退默认界面。
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
    const DEFAULT_ID = 'default';   // 「原站默认」: 不上妆, 用户可主动切到它
    const FIRST_ID = 'film';        // 首次安装(存储里没有值)时默认上妆的主题
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
    // 配置类错误: 不是页面结构坏了, 是 GM 存储里的值失效(主题被删 / 被手改成乱值)。
    // 与结构类分开 —— 结构类要「等窗口」, 配置类等也没用; 横幅措辞也不一样(见 showAlert)。
    const CONFIG_CODES = Object.freeze(['E_BAD_THEME']);
    // 2026.09.19.7 移除的旧 5 套。存储里还留着这些 id 的用户, 自动迁到胶片墙 ——
    // 他们本来就是「选过主题、想用主题」的人, 不该因为主题被删就退回无样式。
    const LEGACY_THEMES = Object.freeze(['reel', 'tape', 'sheet', 'swiss', 'signal']);
    const LEGACY_MIGRATE_TO = 'film';
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

    // 类别色(按类别图标 class 前缀取色, 供 --hdui-cat 写入行上, 主题可自行取用)
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
    // 图标: 站内图片位一律换成内联 SVG(data URI), 实心 + 语义色
    //   来源: .workbuddy-ai/hdui-mock/film.html —— 已在 96 / 48 / 24 / 16px 四档对照下定稿,
    //         语义与形状都经过多轮用户选型(详见 memory-bank/pitfalls.md P38~P41)。
    //   铁律: 只改 CSS 的 content / background-image, 不增删站点 DOM —— 保持纯样式层。
    // ==================================================================
    const ICONS = Object.freeze({
        /* —— 类别 7 个 —— */
        movie: '<path fill-rule="evenodd" d="M5.6 3h12.8A2.6 2.6 0 0 1 21 5.6v12.8A2.6 2.6 0 0 1 18.4 21H5.6A2.6 2.6 0 0 1 3 18.4V5.6A2.6 2.6 0 0 1 5.6 3zm1.9 3.4v11.2h1.7V6.4zm8.5 0v11.2h1.7V6.4z"/>',
        tv: '<path d="M4.6 6.4h14.8A2.6 2.6 0 0 1 22 9v7.6A2.6 2.6 0 0 1 19.4 19H4.6A2.6 2.6 0 0 1 2 16.6V9a2.6 2.6 0 0 1 2.6-2.6z"/><path d="M8.4 2.6h7.2l-1.4 3.2H9.8z"/>',
        music: '<circle cx="7.3" cy="17.4" r="3.3"/><circle cx="17.6" cy="15.7" r="3.3"/>'
            + '<rect x="9.4" y="6" width="2.3" height="11.6" rx=".4"/><rect x="19.7" y="4.3" width="2.3" height="11.6" rx=".4"/>'
            + '<path d="M9.4 6.1l12.6-1.9v2.5L9.4 8.6z"/>',
        doc: '<path d="M13.6 2.6H6.9A1.9 1.9 0 0 0 5 4.5v15A1.9 1.9 0 0 0 6.9 21.4h10.2A1.9 1.9 0 0 0 19 19.5V8z"/>'
            + '<path d="M19 8.3h-5.1V3z" fill-opacity=".5"/>'
            + '<rect x="8.2" y="11.9" width="7.6" height="1.8" rx=".9" fill-opacity=".5"/>'
            + '<rect x="8.2" y="15.6" width="5.1" height="1.8" rx=".9" fill-opacity=".5"/>',
        anime: '<path d="M12 2.4l2.75 5.9 6.35.72-4.75 4.32 1.28 6.32L12 16.6l-5.63 3.06 1.28-6.32L3 9.02l6.35-.72z"/>',
        sport: '<path fill-rule="evenodd" d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M4.2 8.4h15.6v2H4.2z M4.2 13.6h15.6v2H4.2z"/>',
        other: '<rect x="4" y="6.3" width="16" height="2.5" rx="1.25"/><rect x="4" y="10.75" width="16" height="2.5" rx="1.25"/>'
            + '<rect x="4" y="15.2" width="11" height="2.5" rx="1.25"/>',
        /* —— 表头指标 8 个 —— */
        /* 评论: 三个点必须是 evenodd 镂空 —— 同色图形叠画等于看不见(pitfalls P35) */
        comment: '<path fill-rule="evenodd" d="M2.5 6.5A2.5 2.5 0 0 1 5 4h14a2.5 2.5 0 0 1 2.5 2.5v8A2.5 2.5 0 0 1 19 17H9.5L5 21v-4H5A2.5 2.5 0 0 1 2.5 14.5z'
            + ' M4.2 10.4a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0-4.8 0z'
            + ' M9.7 10.4a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0-4.8 0z'
            + ' M15.2 10.4a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0-4.8 0z"/>',
        clock: '<path fill-rule="evenodd" d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M11 6.6h2v5.3l3.5 2.1-.9 1.6-4.6-2.8z"/>',
        /* 大小 = 硬盘: 卡尺/表盘/柱图都被读成别的语义 */
        size: '<path fill-rule="evenodd" d="M4.5 5.5h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z M6.2 9.6h7.2v3.2H6.2z"/>'
            + '<circle cx="17.2" cy="15.4" r="1.5"/>',
        up: '<path d="M12 3.6l7.2 7.2h-4.4v9.6H9.2v-9.6H4.8z"/>',
        down: '<path d="M12 20.4L4.8 13.2h4.4V3.6h5.6v9.6h4.4z"/>',
        check: '<path d="M20.4 6.3L9.9 16.8 4.2 11.1l1.85-1.85L9.9 13.1l8.65-8.65z"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4.6 20.6c0-4.1 3.3-7.4 7.4-7.4s7.4 3.3 7.4 7.4z"/>',
        rss: '<circle cx="5.8" cy="18.2" r="2.3"/>'
            + '<path d="M3.5 10.6a10.9 10.9 0 0 1 10.9 10.9h-3.3a7.6 7.6 0 0 0-7.6-7.6z"/>'
            + '<path d="M3.5 4.6a16.9 16.9 0 0 1 16.9 16.9h-3.3A13.6 13.6 0 0 0 3.5 7.9z"/>',
        /* —— 导航 16 个 —— */
        home: '<path d="M12 2.5l9 8v11.5h-5.8V15H8.8v7H3V10.5z"/>',
        forum: '<path d="M3 5.5A2.5 2.5 0 0 1 5.5 3h13A2.5 2.5 0 0 1 21 5.5v9a2.5 2.5 0 0 1-2.5 2.5H10L4 21v-4a2.5 2.5 0 0 1-1-2z"/>',
        /* 种子 = 一叠碟片; 磁铁/光盘都容易读错 */
        discs: '<path d="M3.8 17v2.6c0 1.55 3.67 2.8 8.2 2.8s8.2-1.25 8.2-2.8V17z"/><ellipse cx="12" cy="17" rx="8.2" ry="2.8"/>'
            + '<path d="M3.8 11v2.6c0 1.55 3.67 2.8 8.2 2.8s8.2-1.25 8.2-2.8V11z"/><ellipse cx="12" cy="11" rx="8.2" ry="2.8"/>'
            + '<path d="M3.8 5v2.6c0 1.55 3.67 2.8 8.2 2.8s8.2-1.25 8.2-2.8V5z"/><ellipse cx="12" cy="5" rx="8.2" ry="2.8"/>',
        live: '<circle cx="12" cy="12" r="2.7"/>'
            + '<path d="M7.2 7.2a6.8 6.8 0 0 0 0 9.6l1.5-1.5a4.7 4.7 0 0 1 0-6.6z"/>'
            + '<path d="M16.8 7.2l-1.5 1.5a4.7 4.7 0 0 1 0 6.6l1.5 1.5a6.8 6.8 0 0 0 0-9.6z"/>',
        leaf: '<path d="M20.5 3.5c-10 0-16.5 5-16.5 12 0 2.2.9 4.2 1.3 5 .3.6 1 .6 1.3 0 .4-.9 1.6-7.3 8.2-10.4 0 0-3.7 3-5.6 7.9 5.7 1.4 11.4-4.4 11.3-12.5z"/>',
        /* 断种 = 保种同一片叶形 + 右下锯齿缺角(缺口直接拼进路径, 不是内部挖孔 —— pitfalls P40) */
        wilt: '<path d="M 20.5 3.5 C 10.5 3.5, 4 8.5, 4 15.5 C 4 17.7, 4.9 19.5, 5.3 20.5 C 5.6 21.1, 6.3 21.1, 6.6 20.5 C 7 19.6, 8.2 13.2, 14.8 10.1 C 14.8 10.1, 11.1 13.1, 9.2 18 C 10.45 18.31, 11.71 18.27, 12.9 17.93 L 12.19 15.22 L 14.16 16.08 L 13.88 13.95 L 15.85 14.81 L 15.58 12.68 L 17.99 14.13 C 19.56 11.9, 20.54 8.9, 20.5 5.5 Z"/>',
        medal: '<circle cx="12" cy="9.2" r="6.6"/><path d="M12 14.4l-2.6 7 2.6-2 2.6 2z"/>',
        /* 求种 = 喇叭(吆喝求档); 放大镜更像"搜索" */
        horn: '<path d="M3.6 9.2v5.4c0 .9.7 1.6 1.6 1.6h2L15.6 22V2.2L7.2 7.6H5.2c-.9 0-1.6.7-1.6 1.6z"/>'
            + '<path d="M17.6 9.4a4.8 4.8 0 0 1 0 5.2l1.9 1.3a7.3 7.3 0 0 0 0-7.8z"/>',
        upload: '<path d="M12 2.6l6.6 6.6h-3.8v8.2H9.2V9.2H5.4z"/><rect x="3.4" y="19.2" width="17.2" height="2.8" rx="1.4"/>',
        subtitle: '<path d="M3.2 5h17.6a1.8 1.8 0 0 1 1.8 1.8v8a1.8 1.8 0 0 1-1.8 1.8H3.2A1.8 1.8 0 0 1 1.4 14.8v-8A1.8 1.8 0 0 1 3.2 5z"/>'
            + '<rect x="4.8" y="18.2" width="14.4" height="2.4" rx="1.2"/>',
        sliders: '<rect x="3" y="6.2" width="18" height="2.6" rx="1.3" fill-opacity=".5"/>'
            + '<rect x="3" y="10.7" width="18" height="2.6" rx="1.3" fill-opacity=".5"/>'
            + '<rect x="3" y="15.2" width="18" height="2.6" rx="1.3" fill-opacity=".5"/>'
            + '<circle cx="9" cy="7.5" r="2.5"/><circle cx="15.2" cy="12" r="2.5"/><circle cx="8" cy="16.5" r="2.5"/>',
        chart: '<rect x="3" y="10.5" width="4.4" height="10.5" rx="1.2"/><rect x="9.8" y="3.5" width="4.4" height="17.5" rx="1.2"/>'
            + '<rect x="16.6" y="14" width="4.4" height="7" rx="1.2"/>',
        logdoc: '<path d="M13.4 2.6H6.8A1.8 1.8 0 0 0 5 4.4v15.2a1.8 1.8 0 0 0 1.8 1.8h10.4a1.8 1.8 0 0 0 1.8-1.8V8.2z"/>'
            + '<path d="M19 8.4h-5.3V3z" fill-opacity=".5"/>',
        shield: '<path fill-rule="evenodd" d="M12 2.6l8.5 3.1v6.4c0 5.2-3.7 8.4-8.5 9.5-4.8-1.1-8.5-4.3-8.5-9.5V5.7z'
            + ' M16.6 9.4l-5.4 5.4-2.7-2.7 1.5-1.5 1.2 1.2 3.9-3.9z"/>',
        book: '<path d="M12 6.6C10.4 5.3 8.4 4.6 6 4.6H3.4v13.2H6c2.4 0 4.4.7 6 2 1.6-1.3 3.6-2 6-2h2.6V4.6H18c-2.4 0-4.4.7-6 2z"/>'
    });

    // 类别图标配色(按站内 class 前缀取色)
    const ICON_CAT = Object.freeze([
        ['c_movie', 'movie', '#e05b4a'], ['c_movies', 'movie', '#e05b4a'],
        ['c_tv', 'tv', '#5b9fd4'], ['c_tvseries', 'tv', '#5b9fd4'],
        ['c_music', 'music', '#9b7fd4'],
        ['c_document', 'doc', '#4fb89a'], ['c_doc', 'doc', '#4fb89a'],
        ['c_animate', 'anime', '#e27ba6'], ['c_anime', 'anime', '#e27ba6'],
        ['c_sport', 'sport', '#7fb84e'],
        ['c_other', 'other', '#8b857c']
    ]);

    // 表头指标配色(按语义给, 全部有彩度 —— 不留灰)
    const ICON_MET = Object.freeze({
        comments: ['comment', '#5b9fd4'],
        alive: ['clock', '#9b7fd4'],
        size: ['size', '#c98f4a'],
        seeders: ['up', '#f5b342'],
        leechers: ['down', '#e05b4a'],
        snatched: ['check', '#4fb89a'],
        user: ['user', '#7c8fd6'],
        rss: ['rss', '#c9a86a']
    });

    // 导航 16 项: [href 片段, 图标, 颜色]
    //   顺序有讲究: 先给 torrents.php 兜底(种子), 再用 mystat=keep / mystat=dead 覆盖(保种/断种)
    //   配色纪律: 16 个色位要互不混淆 —— 判据是「色相差<=8 且 饱和差<=20 且 亮度差<=15」,
    //   三者都接近才算真分不出(只看色相会把"低饱和灰 vs 高饱和金"误判成撞色)。
    //   已避开的两处坑: ① logdoc 原 #57c9a8 与 discs #4fb89a 色相完全相同(163°);
    //                  ② 橙黄区原挤了 4 个, shield 往黄推会撞 wilt —— 干脆降饱和变灰而不是挪色相。
    const ICON_NAV = Object.freeze([
        ['index.php', 'home', '#eda23c'],
        ['forums.php', 'forum', '#5b9fd4'],
        ['torrents.php', 'discs', '#4fb89a'],
        ['live.php', 'live', '#e05b4a'],
        ['mystat=keep', 'leaf', '#7fb84e'],
        ['mystat=dead', 'wilt', '#b8933a'],
        ['offers.php', 'medal', '#e27ba6'],
        ['viewrequests.php', 'horn', '#9b7fd4'],
        ['upload.php', 'upload', '#e0762c'],
        ['subtitles.php', 'subtitle', '#3fb0c4'],
        ['usercp.php', 'sliders', '#7c8fd6'],
        ['topten.php', 'chart', '#a3c14a'],
        ['log.php', 'logdoc', '#94a3b8'],
        ['rules.php', 'shield', '#a99e8b'],
        ['faq.php', 'book', '#b48ad6'],
        ['staff.php', 'user', '#d4636f']
    ]);

    /**
     * 生成内联 SVG 的 data URI(实心 + 指定色)。
     * ⚠️ 必须带 width/height: 这些图是给 `img{content:url(...)}` 用的,
     *    SVG 只写 viewBox 的话**没有固有尺寸**, 替换内容后 img 宽高会算成 0,
     *    把外面包它的 <a> 一起压没了(hit-test 失败、点不到)。主题再用自己的规则缩到 12/16px。
     */
    function iconUri(name, color) {
        const body = ICONS[name] || ICONS.other;
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="'
            + (color || '#8b857c') + '">' + body + '</svg>';
        return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
    }

    /** #rrggbb + alpha -> rgba() */
    function rgba(hex, alpha) {
        let h = String(hex).replace('#', '');
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        const r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }

    /**
     * 图标替换 CSS(类别 / 表头指标)。
     * 只写 content, 不写死尺寸 —— 各主题用更高特异性的选择器自己定 width/height。
     */
    function iconCss() {
        const out = [];
        ICON_CAT.forEach(function (x) {
            out.push('html[data-hdui-theme] #torrenttable img[class*="' + x[0] + '"]{content:'
                + iconUri(x[1], x[2])
                + ';display:inline-block;vertical-align:middle;padding:3px;box-sizing:content-box;'
                + 'border-radius:8px;background:' + rgba(x[2], 0.16) + ';}');
        });
        for (const k in ICON_MET) {
            if (!Object.prototype.hasOwnProperty.call(ICON_MET, k)) continue;
            const pair = ICON_MET[k];
            out.push('html[data-hdui-theme] #torrenttable img.' + k + '{content:' + iconUri(pair[0], pair[1]) + ';}');
        }
        // RSS 角标(标题行内的小图标)不套色块, 只换图形
        out.push('html[data-hdui-theme] #torrenttable .torrentname img{content:'
            + iconUri('rss', ICON_MET.rss[1]) + ';}');
        return out.join('\n');
    }

    /**
     * 导航图标(::before)。tape 主题用 ::before/::after 画方括号, 会冲突 —— 由 theme.navIcons 关掉。
     */
    function navIconCss() {
        const out = [
            'html[data-hdui-theme] ul#mainmenu li a{display:flex;align-items:center;gap:5px;}',
            'html[data-hdui-theme] ul#mainmenu li a::before{content:"";flex:0 0 14px;width:14px;height:14px;'
            + 'background-repeat:no-repeat;background-position:center;background-size:contain;opacity:.88;}'
        ];
        ICON_NAV.forEach(function (x) {
            out.push('html[data-hdui-theme] ul#mainmenu li a[href*="' + x[0] + '"]::before{background-image:'
                + iconUri(x[1], x[2]) + ';}');
        });
        return out.join('\n');
    }

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

    // ==================================================================
    // 主题: 胶片墙 —— 一条种子 = 一格胶片帧
    //   片基左右各一条齿孔轨道; 帧号打在左侧片边; 片头(表头)吸顶且每列可排序;
    //   做种数是唯一的视觉锚点(20px 金色 + 内嵌占比条); 数值靠字号分层, 不靠色相。
    // ==================================================================

    // 列宽: 表头与数据行共用同一套 flex-basis, 数值才能成列对齐(0 = 占满剩余宽度)
    const FILM_W = {
        type: 44, title: 0, comments: 54, alive: 64, size: 78, seeders: 72,
        leechers: 58, snatched: 64, progress: 40, a: 52, ave: 56, uploader: 104
    };
    const FILM_GAP = 10;

    /** 数据行某列的选择器; 列缺席时返回空串 —— 绝不能生成 :nth-child(undefined) */
    function tdSel(m, k) { return m[k] ? (R + ' > td' + C(m, k)) : ''; }

    /** 一组列合成一条规则; 整组都缺席时返回空串(避免产生裸 "{}") */
    function tdRule(m, keys, decl) {
        const s = keys.filter(function (k) { return !!m[k]; })
            .map(function (k) { return R + ' > td' + C(m, k); });
        return s.length ? s.join(',') + '{' + decl + '}' : '';
    }

    /** 胶片墙: 齿孔片边 + 帧号 + 吸顶片头; 数值成列右对齐, 做种数是唯一大字 */
    function filmCss(m) {
        const HOLE = '#6a5a48';   // 齿孔: 比片基明显亮, 做出"透光"感
        const GAP = FILM_GAP + 'px';

        // 片头: 原本只有图标没有栏名的列, 补中文标签(纯 CSS ::after, 不写 DOM)
        const LABEL = { comments: '评论', alive: '存活', size: '大小', seeders: '做种',
            leechers: '下载', snatched: '完成', uploader: '发布者' };
        const headLabels = [];
        Object.keys(LABEL).forEach(function (k) {
            if (!m[k]) return;
            const h = H + ' > td' + C(m, k);
            headLabels.push(h + ' a::after{content:"' + LABEL[k] + '";font-size:10.5px;letter-spacing:0;}');
            headLabels.push(h + ' a[href*="type=desc"]::after{content:"' + LABEL[k] + ' ↓";}');
            headLabels.push(h + ' a[href*="type=asc"]::after{content:"' + LABEL[k] + ' ↑";}');
        });

        // 列宽: 表头与数据行各一份
        const basis = [];
        Object.keys(FILM_W).forEach(function (k) {
            if (!m[k]) return;
            const decl = FILM_W[k] ? 'flex:0 0 ' + FILM_W[k] + 'px' : 'flex:1 1 0';
            basis.push(H + ' > td' + C(m, k) + '{' + decl + ';min-width:0;}');
            basis.push(R + ' > td' + C(m, k) + '{' + decl + ';min-width:0;}');
        });

        return [
            '#torrenttable{display:block;padding:8px 0 20px;}',
            // 片基
            '#torrenttable > tbody{display:flex;flex-direction:column;position:relative;'
            + 'counter-reset:frame;padding-left:34px;padding-right:26px;}',
            '#torrenttable > tbody::before,#torrenttable > tbody::after{content:"";position:absolute;'
            + 'top:0;bottom:0;width:11px;background-image:repeating-linear-gradient(180deg,'
            + HOLE + ' 0 9px,transparent 9px 22px);}',
            '#torrenttable > tbody::before{left:0;}',
            '#torrenttable > tbody::after{right:0;}',
            // 片头: 吸顶可排序栏
            H + '{position:sticky;top:0;z-index:6;display:flex;align-items:stretch;column-gap:' + GAP
            + ';padding:10px 0 9px;width:100%;background:var(--hdui-headbg);'
            + 'border-bottom:1px solid var(--hdui-line);font-size:10.5px;letter-spacing:.12em;'
            + 'color:var(--hdui-headfg);}',
            H + ' > td{display:block;align-self:stretch;padding:0;overflow:hidden;white-space:nowrap;}',
            H + ' > td a{display:flex;align-items:center;gap:5px;justify-content:flex-end;height:100%;'
            + 'padding:0 8px;margin:0 -8px;border-radius:7px;color:inherit;font:inherit;}',
            H + ' > td a:hover{color:var(--hdui-accent);}',
            tdSel(m, 'uploader') ? H + ' > td' + C(m, 'uploader') + ' a{justify-content:flex-start;}' : '',
            // 帧
            R + '{position:relative;display:flex;align-items:center;column-gap:' + GAP
            + ';width:100%;min-height:50px;padding:7px 10px;background:var(--hdui-card);'
            + 'border-bottom:1px solid var(--hdui-bg);}',
            R + ':hover{background:var(--hdui-rule);}',
            // 帧号: 打在左侧片边上(counter, 纯 CSS 不写 DOM)
            R + '::before{counter-increment:frame;content:counter(frame,decimal-leading-zero);'
            + 'position:absolute;left:-24px;top:50%;transform:translateY(-50%);width:18px;'
            + 'text-align:center;font-family:var(--hdui-font-num);font-size:9.5px;'
            + 'letter-spacing:.06em;color:var(--hdui-muted);}',
            // 置顶: 左侧金色内阴影(不占流, 不把列推开)
            R + '.sticky_top{box-shadow:inset 3px 0 0 var(--hdui-accent);}',
            R + ' > td{overflow:hidden;min-width:0;}',
            basis.join('\n'),
            // 标题
            // ⚠️ max-width 不能省: 站点外层是 table-layout:auto, 会被内容的 max-content 撑开 ——
            //    不限的话长标题把整页撑到 1503px(原站仅 1260), 窄屏得多横向滚 240px。
            //    900 = 固定列宽和(686) + 列间距(110) + 片基左右留白(60) 的约数, 改动列宽时要同步调。
            tdSel(m, 'title') + '{max-width:max(240px,calc(100vw - 900px));'
            + 'font-family:var(--hdui-font-title);font-size:13.5px;line-height:1.45;}',
            tdSel(m, 'title') + ' a{color:var(--hdui-fg);}',
            tdSel(m, 'title') + ' .embedded{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
            tdSel(m, 'title') + ' img{width:12px;height:12px;opacity:.55;}',
            tdSel(m, 'type') + ' img{width:16px;height:16px;}',
            // 数值成列: 等宽 + 右对齐, 靠字号分层级(不靠色相, 配色才不打架)
            tdRule(m, ['comments', 'alive', 'size', 'seeders', 'leechers', 'snatched', 'a', 'ave'],
                'text-align:right;font-family:var(--hdui-font-num);font-variant-numeric:tabular-nums;'),
            tdRule(m, ['comments', 'alive', 'a', 'ave'], 'font-size:11.5px;color:var(--hdui-muted);'),
            tdRule(m, ['leechers', 'snatched'], 'font-size:13px;color:var(--hdui-fg);'),
            tdSel(m, 'size') + '{font-size:12px;color:var(--hdui-fg);white-space:nowrap;}',
            tdSel(m, 'size') + ' br{display:none;}',
            // 做种: 唯一的大字锚点 + 内嵌占比条
            tdSel(m, 'seeders') + '{display:block;font-size:20px;line-height:1.1;font-weight:600;color:var(--hdui-accent);}',
            tdSel(m, 'seeders') + '::after{content:"";display:block;height:3px;margin-top:4px;margin-left:auto;'
            + 'border-radius:2px;width:calc(var(--hdui-ratio,0) * 100%);background:var(--hdui-accent);opacity:.85;}',
            tdSel(m, 'progress') + '{text-align:center;font-size:11px;color:var(--hdui-muted);}',
            tdSel(m, 'uploader') + '{font-size:11.5px;color:var(--hdui-muted);overflow:hidden;text-overflow:ellipsis;}',
            // 促销标记: 药丸(对应 --hdui-accent #f5b342)
            '.tags.tfree{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;'
            + 'font-size:10px;font-weight:600;letter-spacing:.04em;color:var(--hdui-accent);'
            + 'background:rgba(245,179,66,.14);vertical-align:1px;}',
            headLabels.join('\n'),
            // 标题格的内嵌表(站内自带结构, 摊平成行内)
            '#torrenttable table.torrentname{display:block;}',
            '#torrenttable table.torrentname > tbody{display:block;}',
            '#torrenttable table.torrentname > tbody > tr{display:block;}',
            '#torrenttable table.torrentname td{border:0;padding:0;display:inline;}',
            '#torrenttable table.torrentname td.rss{padding-left:8px;}',
            // 导航药丸
            'ul#mainmenu li a{border-radius:9px;font-weight:500;}',
            'ul#mainmenu li.selected a{background:var(--hdui-accent);color:#17130e;}'
        ].filter(Boolean).join('\n');
    }

    const THEMES = Object.freeze([
        {
            id: 'film', name: '胶片墙', note: '齿孔片边 · 帧号 · 做种金',
            vars: {
                '--hdui-bg': '#100e0d', '--hdui-panel': '#191512', '--hdui-card': '#201c18',
                '--hdui-fg': '#f2ede5', '--hdui-muted': '#a79e93', '--hdui-accent': '#f5b342',
                '--hdui-link': '#f2ede5', '--hdui-line': '#332c26', '--hdui-rule': '#2a241f',
                '--hdui-headbg': '#191512', '--hdui-headfg': '#a79e93',
                '--hdui-zebra1': '#201c18', '--hdui-zebra2': '#23201b',
                '--hdui-font': '"Noto Sans SC","Microsoft YaHei",system-ui,sans-serif',
                '--hdui-font-title': '"Source Han Sans CN Medium","Noto Sans SC",sans-serif',
                '--hdui-font-num': 'Bahnschrift,"DIN Alternate",Consolas,monospace',
                '--hdui-fs': '13px', '--hdui-fs-sm': '11px',
                // 导航 16 项 + 内嵌入口要放进 ~1262px 视口, 间距不能再放宽(原型 11px 会把第 16 项挤出屏)
                '--hdui-navpad': '8px 12px', '--hdui-navitem': '6px 9px', '--hdui-navgap': '2px',
                '--hdui-radius': '9px'
            },
            css: filmCss
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
            // max-width:100vw 不能省: 站点外层是固定宽布局(文档宽 ~1260), 导航条会跟着拿到 1248px;
            // flex 单行排下去, 窄屏(<1248)时后面的入口就排到视口外点不到了。
            // 原站是 inline 布局会自然换行, 换成 flex 后必须显式给上限才会 wrap。
            'html[data-hdui-theme] ul#mainmenu{display:flex;flex-wrap:wrap;align-items:center;'
            + 'row-gap:4px;column-gap:var(--hdui-navgap);margin:0;padding:var(--hdui-navpad);'
            + 'background:var(--hdui-panel);list-style:none;max-width:100vw;box-sizing:border-box;}',
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
        // 图标替换(类别 / 表头指标)—— 所有主题通用, 且放在主题 CSS 之前,
        // 让主题能用更高特异性的选择器覆盖尺寸
        out += '\n' + iconCss();
        if (theme.navIcons !== false) out += '\n' + navIconCss();
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

        // 配置类(存储值失效) ≠ 结构类(页面长得不对): 措辞要分开, 否则把人往"页面坏了"上引
        const isCfg = CONFIG_CODES.indexOf(code) >= 0;

        const txt = document.createElement('span');
        txt.setAttribute('data-hdui', 'alert-text');
        txt.textContent = '[' + ScriptName + '] ' + (isCfg ? '主题设置无效' : '页面结构与预期不符')
            + '(' + code + '), 已恢复站点默认界面。' + (detail ? ' ' + detail : '');
        box.appendChild(txt);

        const retry = document.createElement('button');
        retry.setAttribute('type', 'button');
        retry.setAttribute('data-hdui', 'alert-retry');
        retry.style.cssText = 'background:#fff;color:#7a1f1a;border:0;border-radius:3px;padding:4px 10px;cursor:pointer;font-size:12px;';
        if (isCfg) {
            // 重试是没用的(值还是那个值) —— 直接给一条能走通的路
            retry.textContent = '改用胶片墙';
            retry.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                dismissAlert();
                storeSet(STORE_THEME, LEGACY_MIGRATE_TO);
                applyTheme(LEGACY_MIGRATE_TO);
            });
        } else {
            retry.textContent = '重新尝试';
            retry.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                dismissAlert();
                applyStored(true);
            });
        }
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
                const id = storeGet(STORE_THEME, FIRST_ID);
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
        let theme = themeById(id);
        if (!theme && LEGACY_THEMES.indexOf(id) >= 0) {
            // 旧主题已移除: 静默迁到胶片墙并写回存储。
            // 不弹横幅 —— 用户没做错任何事, 是我们把主题删了。
            Diag.info('THEME_MIGRATED', '旧主题 ' + id + ' 已移除, 改用「' + LEGACY_MIGRATE_TO + '」');
            storeSet(STORE_THEME, LEGACY_MIGRATE_TO);
            id = LEGACY_MIGRATE_TO;
            theme = themeById(id);
        }
        if (!theme) {
            Diag.warn('BAD_THEME', '存储里的主题值无效: ' + id + ', 回落默认');
            fallbackToDefault('E_BAD_THEME', '存储里的主题值「' + id + '」已不存在');
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
        // 首次安装直接上妆胶片墙: 装这个脚本就是为了用它, 且面板里随时可切回「原站默认」。
        // ⚠️ 只有**无存储**时才走 FIRST_ID; 用户一旦选过(含选「原站默认」)就以存储值为准。
        const id = storeGet(STORE_THEME, FIRST_ID);
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
                const id = storeGet(STORE_THEME, FIRST_ID);
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
        const theme = themeById(storeGet(STORE_THEME, FIRST_ID));
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
            // 本脚本没有任何 Promise / async(静态校验 §10 钉死这一点), 所以这里捕获到的 rejection
            // **一定来自页面自身或其它脚本** —— 它是全局兜底, 不是我们的 bug。
            // 因此必须: ① 带上首个堆栈帧, 让人能找到真正的来源;
            //          ② 明确标注"来自外部", 否则 [HDHomeUI] 前缀会把人引到错误的脚本上。
            const r = ev && ev.reason;
            const msg = r ? String((r && r.message) || r) : 'unknown';
            let frame = '';
            if (r && r.stack) {
                const m = /^\s*at\s+(.+)$/m.exec(String(r.stack));
                if (m) frame = ' @ ' + m[1].trim().slice(0, 160);
            }
            Diag.warn('UNHANDLED_REJECTION', msg + frame
                + ' —— 来自页面或其它脚本(本脚本无异步代码), 非 HDHomeUI 故障');
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
