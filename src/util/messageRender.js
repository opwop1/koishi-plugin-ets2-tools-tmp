/**
 * 消息输出层：统一处理「文本 / 图片」两种呈现方式，并区分 onebot 与 QQ 官方机器人。
 *
 * 设计要点：
 * - 业务代码只关心「内容」和「要不要图片」，不用处理平台差异；
 * - onebot：图片就发图片，文本就发文本（原有行为完全不变）；
 * - QQ 官方：走「原生 markdown + keyboard」直接发送，
 *   因为走元素层无法控制按钮分行（br 无效、多个 button-group 会产生空行）。
 *
 * 所有函数都返回可交给 session.send 的内容；
 * 官方机器人下若已由本模块直接发送，则返回 undefined（Koishi 会视为「无需回复」）。
 */

const qqOfficial = require('./qqOfficial');
const qqMediaUpload = require('./qqMediaUpload');
const qqMarkdown = require('./qqMarkdown');
const localImageHost = require('./localImageHost');


/**
 * 是否应使用图片形式。
 * @param {number|string} type 1=文本，2=图片（沿用插件现有 type 约定）
 */
function wantImage(type) {
    return Number(type) === 2;
}

/**
 * 把纯文本转成一个适合 markdown 的正文。
 * 官方适配器在 <qq:markdown> 内不转义，外面的文本会被转义，
 * 所以业务文本要放进来才能保留 `**`、`#` 等语法。
 */
function markdownText(text) {
    return qqOfficial.markdownBlock(text);
}

/**
 * 文本输出。
 *
 * @param {object} session koishi session
 * @param {string} text 文本内容
 * @param {object} [opts]
 * @param {boolean} [opts.markdown] 官方机器人是否用 markdown 包裹（默认 true）
 * @param {Array<Array<object>>} [opts.buttons] 按钮行（仅官方机器人有效）
 * @returns {string|Array<object>|Promise<Symbol>}
 */
async function renderText(session, text, opts) {
    const options = opts || {};
    const body = String(text == null ? '' : text);

    // onebot 及未启用官方适配器：保持原样，绝不加任何元素
    if (!qqOfficial.isQQOfficial(session)) {
        return body;
    }

    const useMarkdown = options.markdown !== false;
    const buttons = Array.isArray(options.buttons) ? options.buttons : [];

    if (!useMarkdown && buttons.length === 0) {
        return body;
    }

    // 官方机器人：优先走原生发送（可精确控制按钮分行）
    if (typeof qqMarkdown.sendMarkdownWithButtons === 'function' && typeof session?.bot?.internal?.sendMessage === 'function') {
        const sent = await qqMarkdown.sendMarkdownWithButtons(session, {
            markdown: useMarkdown ? body : '',
            buttons,
        });
        if (sent) return undefined;
    }

    // 回退：元素层（按钮可能挤在一行，但至少能发出去）
    const children = [];
    if (useMarkdown) {
        children.push(markdownText(body));
    } else {
        children.push(require('koishi').h.text(body));
    }
    if (buttons.length > 0) {
        children.push(qqOfficial.buttonGroup(buttons));
    }
    return children;
}

/**
 * 图片 + 可选按钮的输出。
 *
 * @param {object} session
 * @param {object} imageSegment segment.image(...) 产出的图片元素
 * @param {object} [opts]
 * @param {Array<Array<object>>} [opts.buttons] 按钮行（仅官方机器人有效）
 * @param {string} [opts.caption] 图片上方的说明文本（官方机器人可选）
 * @param {function(object): Promise<string|null>} [opts.uploader]
 *        官方机器人下，用于把本地图片转成 markdown 可用 URL 的函数
 * @returns {object|Array<object>|Promise<Symbol>}
 */
async function renderImage(session, imageSegment, opts) {
    const options = opts || {};

    // onebot：原样返回图片元素，行为不变
    if (!qqOfficial.isQQOfficial(session)) {
        return imageSegment;
    }

    const buttons = Array.isArray(options.buttons) ? options.buttons : [];
    const uploader = options.uploader || options.defaultUploader;

    // 优先：上传图片 → 写进 markdown → 原生发送（图片与按钮同一条消息）
    if (typeof uploader === 'function' && options.inline !== false) {
        const inline = await renderInlineImage(session, imageSegment, buttons, { ...options, uploader });
        if (inline) return inline;
    }

    // 退化：图片一条 + 按钮一条（保持可用）
    if (buttons.length === 0) {
        return imageSegment;
    }
    const children = [imageSegment];
    if (options.caption) {
        children.push(markdownText(options.caption));
    }
    children.push(qqOfficial.buttonGroup(buttons));
    return children;
}

/**
 * 把图片塞进 markdown 正文，与按钮共用一条消息。
 * @returns {Promise<undefined|Array<object>|null>} 已直接发送时返回 undefined；退化时返回元素数组；失败返回 null
 */
async function renderInlineImage(session, imageSegment, buttons, options) {
    const log = getLogger(session);

    let imageUrl = null;
    try {
        imageUrl = await options.uploader(imageSegment);
    } catch (error) {
        if (log) log.warn(`[消息输出] 图片转换失败: ${error.message}，将退化为普通图片发送`);
        imageUrl = null;
    }

    if (!imageUrl) {
        if (log) log.debug('[消息输出] 未取得图片 URL，退化为「图片 + 按钮」两条消息');
        // 上传失败：交给调用方退化处理
        if (buttons.length === 0) return null;
        const children = [imageSegment];
        if (options.caption) children.push(markdownText(options.caption));
        children.push(qqOfficial.buttonGroup(buttons));
        return children;
    }

    // markdown：说明文字 + 图片
    const lines = [];
    if (options.caption) lines.push(options.caption);
    lines.push(`![${options.alt || 'image'}](${imageUrl})`);
    const markdown = lines.join('\n');

    // 原生发送（一条消息：图片 + 按钮）
    if (typeof session?.bot?.internal?.sendMessage === 'function') {
        const sent = await qqMarkdown.sendMarkdownWithButtons(session, { markdown, buttons });
        if (sent) {
            if (log) log.debug(`[消息输出] 已发送 markdown 图片消息（图片: ${imageUrl}）`);
            return undefined;
        }
        if (log) log.warn('[消息输出] 原生 markdown 发送失败，回退元素层');
    }

    // 回退元素层
    return qqOfficial.markdownWithButtons(markdown, buttons);
}

/** 取 logger（容错：不同环境 session 结构不同） */
function getLogger(session) {
    return (session && session.app && session.app.logger) ||
        (session && session.bot && session.bot.logger) ||
        null;
}

/**
 * 按配置的 type 选择输出形式。
 *
 * @param {object} session
 * @param {object} cfg 插件配置
 * @param {string} typePath 取 type 的路径，如 'tmpMileageRanking.type'
 * @param {object} content
 * @param {string} content.text 文本内容
 * @param {function(): Promise<object>} [content.image] 生成图片的异步函数
 * @param {Array<Array<object>>} [content.buttons] 按钮行
 * @returns {Promise<object|string|Symbol>}
 */
async function renderByType(ctx, session, cfg, typePath, content) {
    const type = readType(cfg, typePath);
    const buttons = content.buttons || [];

    if (wantImage(type) && typeof content.image === 'function') {
        const image = await content.image();
        if (image) {
            // 官方机器人：把图片转成 markdown 可引用的地址，和按钮合成一条消息
            return renderImage(session, image, {
                buttons,
                caption: content.caption,
                alt: content.alt,
                uploader: qqOfficial.isQQOfficial(session)
                    ? await buildUploader(ctx, cfg, session)
                    : null,
            });
        }
        // 图片生成失败 → 回退文本，保证有回应
    }

    return renderText(session, content.text, { buttons });
}

/**
 * 构造图片上传器：
 * 1. 配置了 qqOfficial.publicBaseUrl → 存本地文件，用公网 URL（无数量限制，手机端也可显示）
 * 2. 否则退回 QQ 官方 media-images 上传（有限制，但可用）
 */
async function buildUploader(ctx, cfg, session) {
    // 非官方机器人（onebot 等）：图片原样发送，不需要任何上传
    if (!qqOfficial.isQQOfficial(session)) {
        return null;
    }
    const log = getLogger(session);
    // 有公网域名：走本地文件 + 静态路由
    if (ctx && localImageHost.getPublicBaseUrl(cfg)) {
        return (seg) => localImageHost.saveImageForPublicUrl(ctx, cfg, seg);
    }
    // 回退：QQ 官方素材上传
    if (log) {
        log.info('[消息输出] 未配置 qqOfficial.publicBaseUrl，图片将走 QQ 官方素材上传（手机端可能显示 [image]，且有 100 张上限）');
    }
    return (seg) => qqMediaUpload.uploadImageForMarkdown(session, seg);
}

/** 读取形如 'a.b.c' 的配置路径 */
function readType(cfg, path) {
    if (!path) return 1;
    let cur = cfg;
    for (const key of String(path).split('.')) {
        if (cur == null) return 1;
        cur = cur[key];
    }
    return cur == null ? 1 : cur;
}

module.exports = {
    wantImage,
    markdownText,
    renderText,
    renderImage,
    renderByType,
    buildUploader,
    readType,
};
