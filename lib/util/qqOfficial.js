/**
 * QQ 官方机器人（@koishijs/plugin-adapter-qq）适配层。
 *
 * 目的：在不影响 onebot 的前提下，为 QQ 官方机器人提供 markdown + 按钮消息。
 *
 * 判定依据：官方适配器的 bot.platform 为 'qq'（群聊）或 'qqguild'（频道）。
 * onebot 适配器的 platform 是 'onebot'，所以两者天然区分，互不干扰。
 *
 * 官方适配器原生支持的元素：
 * - <button-group> 包裹若干 <button>，适配器会自动切换为 markdown 消息并生成键盘
 * - <button type="input" text="指令"> 点击后把指令填进输入框
 * - <button type="link" href="..."> 跳转链接
 * - <button type="callback" id="..."> 回调（需要后端配合）
 */

const { h } = require('koishi');

const QQ_OFFICIAL_PLATFORMS = ['qq', 'qqguild'];

/**
 * 车队平台 /api/user/info/list 的固定查询参数（顺序与后端约定一致）。
 * 后端新增了 unionid / isExecutive / isManager / adminUserId 四个参数，
 * 这里集中定义，避免各处手拼漏参数。
 */
const PLATFORM_QUERY_PARAMS = {
    fixed: {
        tmpId: '',
        tmpName: '',
        teamId: '',
        state: 0,
        teamRole: '',
        isExecutive: '',
        isManager: '',
        adminUserId: '',
    },
};

/**
 * 是否来自 QQ 官方机器人适配器。
 * 注意：不能只看 platform 前缀，'qq' 与 'onebot' 是两个不同适配器。
 */
function isQQOfficial(session) {
    if (!session) return false;
    return QQ_OFFICIAL_PLATFORMS.includes(String(session.platform || ''));
}

/**
 * 判断会话所在的 bot 是否为官方适配器（比 session.platform 更可靠，
 * 因为部分事件里 platform 可能被改写）。
 */
function isQQOfficialBot(session) {
    if (!session) return false;
    if (isQQOfficial(session)) return true;
    const bot = session.bot;
    if (!bot) return false;
    return QQ_OFFICIAL_PLATFORMS.includes(String(bot.platform || '')) ||
        QQ_OFFICIAL_PLATFORMS.includes(String(bot.selfId && bot.platform || ''));
}

/**
 * 构造一个「指令按钮」：点击后把 text 填进输入框并发送。
 * 注意必须用 h() 构造真正的 Element 实例，普通对象会被
 * Element.normalize 拒绝（Invalid content）。
 * @param {string} label 按钮显示文字
 * @param {string} text  点击后实际发送的指令
 * @param {boolean} primary 是否主按钮样式
 */
function inputButton(label, text, primary) {
    return h('button', { type: 'input', text, class: primary ? 'primary' : '' }, label);
}

/**
 * 构造一个「链接按钮」。
 */
function linkButton(label, href) {
    return h('button', { type: 'link', href }, label);
}

/**
 * 构造一个「回调按钮」（需要后端配合）。
 */
function callbackButton(label, id) {
    return h('button', { type: 'callback', id }, label);
}

/**
 * 把按钮分行包裹成 button-group 元素（官方适配器据此生成键盘）。
 * @param {Array<Array<object>>} rows 每行若干按钮
 */
function buttonGroup(rows) {
    const children = [];
    for (const row of rows) {
        if (!row || row.length === 0) continue;
        for (const btn of row) children.push(btn);
        children.push(h('br'));
    }
    return h('button-group', {}, children);
}

/**
 * 组装 markdown 正文 + 按钮。
 *
 * 官方适配器把 <button-group> 之外的文本作为 markdown content 发送，
 * 所以这里直接把 markdown 字符串作为 children 传入。
 *
 * @param {string} markdown markdown 正文
 * @param {Array<Array<object>>} buttonRows 按钮行
 * @returns {Array<object>} 可直接交给 session.send 的元素数组
 */
function markdownWithButtons(markdown, buttonRows) {
    const children = [markdownBlock(markdown)];
    if (buttonRows && buttonRows.length > 0) {
        children.push(buttonGroup(buttonRows));
    }
    return children;
}

/**
 * 用 <qq:markdown> 包裹正文。
 * 新版适配器在此元素内部不转义文本，markdown 语法才能真正生效；
 * 放在外面会被 escapeMarkdown 转义成普通字符。
 */
function markdownBlock(text) {
    return h('qq:markdown', {}, [h.text(String(text == null ? '' : text))]);
}

/**
 * 「猜你想查」按钮组：一组常用查询指令，方便官方机器人用户点选。
 */
function guessButtons() {
    return [
        [inputButton('活动查询', '活动查询', true), inputButton('我的绑定', '我的绑定')],
        [inputButton('里程排行榜', '里程排行榜'), inputButton('VTC里程榜', 'vtc里程排行榜')],
        [inputButton('今日里程榜', '今日里程排行榜'), inputButton('VTC今日榜', 'vtc今日里程排行榜')],
        [inputButton('欧卡服务器', '欧卡服务器'), inputButton('路况', '路况 s1')],
    ];
}

/**
 * 从 session 里提取 QQ 官方机器人的身份信息。
 *
 * 适配器把原始事件同时挂在两处（见 @satorijs/core 的 Session.setInternal）：
 *   session.event._data = 原始 payload
 *   session.qq = Object.assign(bot.internal, 原始 payload)  ← 原始字段直接可读
 *
 * 其中：
 * - openid       = payload.author.id（== session.userId，群内身份，跨群可能不同）
 * - union_openid = payload.author.union_openid（跨群统一，需申请 union 权限才会下发）
 *
 * @returns {{openid: string|null, unionId: string|null, raw: object|null}}
 */
function getQQIdentity(session) {
    const empty = { openid: null, unionId: null, raw: null };
    if (!session || !isQQOfficial(session)) return empty;

    // 原始 payload：优先 session.qq，其次 event._data
    const raw = session.qq || (session.event && session.event._data) || null;
    const author = raw && raw.author ? raw.author : null;

    const openid = (author && (author.id || author.member_openid)) ||
        session.userId || null;

    const unionId = (author && (author.union_openid || author.union_id)) || null;

    return {
        openid: openid ? String(openid) : null,
        unionId: unionId ? String(unionId) : null,
        raw,
    };
}

/**
 * 组装一个 identity 描述对象（用于写入数据库 / 传给后端）。
 * onebot 下 openid=null、unionId=null，qq 下按实际下发填充。
 */
function buildIdentity(session) {
    const id = getQQIdentity(session);
    const platform = String(session && session.platform || '');
    return {
        platform,
        userId: session && session.userId ? String(session.userId) : null,
        openid: id.openid,
        unionId: id.unionId,
        isQQOfficial: isQQOfficial(session),
    };
}

/**
 * 构造「用哪个身份去查车队平台用户」的查询参数。
 *
 * 平台接口 /api/user/info/list 同时支持 `qq` 和 `unionid` 两种入参：
 * - onebot：平台能拿到 QQ 号，用 qq 查（行为与以前完全一致）
 * - QQ 官方机器人：只能拿到 openid/unionid，用 unionid 查
 *
 * 返回值用于拼 URL，未命中的那个参数给空字符串（与既有调用风格一致）。
 *
 * @param {object} session koishi session
 * @returns {{qq: string, unionid: string, isQQOfficial: boolean, hasIdentity: boolean}}
 */
function buildQueryIdentity(session) {
    const isOfficial = isQQOfficial(session);
    if (!isOfficial) {
        // onebot 及任何非官方平台：沿用 QQ 号
        const qq = session && session.userId ? String(session.userId) : '';
        return { qq, unionid: '', isQQOfficial: false, hasIdentity: !!qq };
    }

    const id = getQQIdentity(session);
    const unionId = id.unionId || '';
    return {
        qq: '',
        unionid: unionId,
        isQQOfficial: true,
        hasIdentity: !!unionId,
    };
}

module.exports = {
    QQ_OFFICIAL_PLATFORMS,
    isQQOfficial,
    isQQOfficialBot,
    getQQIdentity,
    buildIdentity,
    buildQueryIdentity,
    inputButton,
    linkButton,
    callbackButton,
    buttonGroup,
    markdownBlock,
    markdownWithButtons,
    guessButtons,
    PLATFORM_QUERY_PARAMS,
};
