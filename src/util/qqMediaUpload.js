const qqOfficial = require('./qqOfficial');
const crypto = require('crypto');

/**
 * QQ 官方机器人：上传图片素材，换取可在 markdown 里引用的 qqbot-media:// 链接。
 *
 * 为什么不能直接用 <img> 元素：
 * 适配器遇到 <img> 会先 flush()，图片会单独成为一条消息，
 * 无法和按钮合成一条。要合并只能把图片写进 markdown 正文。
 *
 * 官方文档（素材管理）规定的是三阶段上传，**不是** /v2/groups/{id}/files：
 *   1. POST /v2/media-images/prepare   申请上传 → presigned_url + upload_id
 *   2. PUT  <presigned_url>            直传二进制（Content-Type 必须与声明一致）
 *   3. POST /v2/media-images/complete  完成 → url: qqbot-media://image/v1/<token>
 *
 * 限制：单张 ≤10MB，格式 png/jpeg/gif/webp，单机器人上限 100 张。
 */

/** 单张图片上限（官方 10MB，这里留些余量） */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** 支持的图片格式 */
const SUPPORTED_MIME = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

/**
 * 从 segment.image 元素里解析出上传所需信息。
 * @returns {{base64: string|null, mime: string|null, bytes: number, url: string|null}}
 */
function extractImageSource(imageSegment) {
    const empty = { base64: null, mime: null, bytes: 0, url: null };
    if (!imageSegment) return empty;

    const attrs = imageSegment.attrs || {};
    const src = attrs.src || attrs.url || '';
    if (!src) return empty;

    // 公网 URL：markdown 可直接引用，无需上传
    if (/^https?:\/\//i.test(src)) {
        return { base64: null, mime: null, bytes: 0, url: src };
    }

    const m = /^data:([^;]+);base64,(.*)$/s.exec(src);
    if (!m) return empty;

    const mime = String(m[1] || '').toLowerCase();
    const base64 = m[2];
    const bytes = Math.floor(base64.length * 3 / 4);
    return { base64, mime, bytes, url: null };
}

/** mime → 扩展名 */
function extOf(mime) {
    switch (mime) {
        case 'image/png': return 'png';
        case 'image/jpeg':
        case 'image/jpg': return 'jpg';
        case 'image/gif': return 'gif';
        case 'image/webp': return 'webp';
        default: return 'png';
    }
}

function getLogger(session) {
    return (session && session.app && session.app.logger) ||
        (session && session.bot && session.bot.logger) ||
        null;
}

/**
 * 取 API 基础地址。
 *
 * 适配器的 bot.http 只设置了 `endpoint` 选项（不是 baseURL），
 * 相对路径不一定能正确拼接，所以这里显式用 bot.config.endpoint 构造绝对地址。
 */
function apiBase(bot) {
    const configured = bot && bot.config && bot.config.endpoint;
    const base = configured || 'https://api.bot.qq.com/';
    return String(base).replace(/\/+$/, '');
}

/**
 * 通过官方三阶段接口上传图片，返回 markdown 引用。
 *
 * @param {object} session koishi session
 * @param {object} imageSegment 图片元素
 * @returns {Promise<string|null>} 成功返回 qqbot-media://... ；失败返回 null（调用方退化为普通图片发送）
 */
async function uploadImageForMarkdown(session, imageSegment) {
    if (!qqOfficial.isQQOfficial(session)) return null;

    const logger = getLogger(session);
    const warn = (msg) => { try { logger && logger.warn(`[QQ图片上传] ${msg}`); } catch { } };
    const debug = (msg) => { try { logger && logger.debug(`[QQ图片上传] ${msg}`); } catch { } };

    const bot = session.bot;
    // bot.http 是带 Authorization 的实例（适配器内部用它发请求）
    if (!bot || !bot.http) { warn('session.bot 或 bot.http 不可用，退化为普通图片发送'); return null; }

    const { base64, mime, bytes, url } = extractImageSource(imageSegment);
    if (url) { debug('图片已是公网 URL，直接引用'); return url; }
    if (!base64) { warn('无法从元素中解析出图片数据'); return null; }

    const contentType = SUPPORTED_MIME.includes(mime) ? mime : 'image/png';
    if (!SUPPORTED_MIME.includes(mime)) {
        warn(`图片格式 ${mime} 不受支持，按 ${contentType} 尝试`);
    }
    if (bytes > MAX_UPLOAD_BYTES) {
        warn(`图片过大（${Math.round(bytes / 1024)}KB），退化为普通图片发送`);
        return null;
    }

    const buffer = Buffer.from(base64, 'base64');
    const md5 = crypto.createHash('md5').update(buffer).digest('hex');
    const sha1 = crypto.createHash('sha1').update(buffer).digest('hex');
    const fileName = `image_${Date.now()}.${extOf(contentType)}`;
    const base = apiBase(bot);

    try {
        // ---- 1. prepare ----
        const prepared = await bot.http.post(`${base}/v2/media-images/prepare`, {
            file_name: fileName,
            file_size: buffer.length,
            content_type: contentType,
            md5,
            sha1,
        }, { timeout: 15000 });
        const uploadId = prepared && prepared.upload_id;
        const presignedUrl = prepared && prepared.presigned_url;
        if (!uploadId || !presignedUrl) {
            warn(`prepare 未返回有效数据: ${JSON.stringify(prepared)}`);
            return null;
        }

        // ---- 2. PUT 直传（Content-Type 必须与 prepare 声明一致，否则 COS 403）----
        await bot.http.put(presignedUrl, buffer, {
            headers: { 'Content-Type': contentType },
            timeout: 30000,
        });

        // ---- 3. complete ----
        const completed = await bot.http.post(`${base}/v2/media-images/complete`, {
            upload_id: uploadId,
            md5,
        }, { timeout: 15000 });
        if (completed && completed.url) {
            debug(`上传成功: ${completed.url}`);
            return completed.url;
        }
        warn(`complete 未返回引用: ${JSON.stringify(completed)}`);
        return null;
    } catch (error) {
        const detail = error && error.response && error.response.data
            ? JSON.stringify(error.response.data)
            : (error && error.message) || String(error);
        warn(`上传失败: ${detail}`);
        return null;
    }
}

module.exports = {
    MAX_UPLOAD_BYTES,
    SUPPORTED_MIME,
    extractImageSource,
    uploadImageForMarkdown,
};
