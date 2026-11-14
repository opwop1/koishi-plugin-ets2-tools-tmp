/**
 * 本地图片托管：把截图写成文件，并注册 HTTP 路由对外提供公网 URL。
 *
 * 为什么需要它：
 * - QQ 官方机器人的 qqbot-media 方案有「单机器人 100 张」上限，且手机端不渲染；
 * - markdown 里用**公网 https URL** 是最稳妥的（所有客户端都支持）。
 *
 * 用法：配置 publicBaseUrl（如 https://bd.114512.xyz:5155）后，
 * 本模块会把图片存到 <data>/tmp-images/<hash>.png，
 * 并提供 <publicBaseUrl>/tmp-images/<hash>.png 的访问地址。
 *
 * 依赖：Koishi 的 server 服务（koishi.yml 里已有 server 插件）。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/** 路由前缀 */
const ROUTE_PREFIX = '/tmp-images';

/** 已注册过路由的 ctx（避免重复注册） */
const registered = new WeakSet();

/** 图片保留时长（毫秒）：超过自动清理，避免磁盘无限增长 */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * 计算图片存储目录。
 * 优先用 Koishi 的 baseDir/data，取不到就退到当前工作目录下的 data。
 */
function resolveImageDir(ctx) {
    const base = (ctx && ctx.baseDir) ||
        (ctx && ctx.app && ctx.app.baseDir) ||
        process.cwd();
    return path.join(base, 'data', 'tmp-images');
}

/**
 * 从公网地址里取 URL 路径前缀（子路径部署时用）。
 * 例如 https://bot.114512.xyz/koishi → '/koishi'
 *      https://bot.114512.xyz        → ''
 */
function getPathPrefix(cfg) {
    const base = getPublicBaseUrl(cfg);
    if (!base) return '';
    try {
        const u = new URL(base);
        const p = String(u.pathname || '').replace(/\/+$/, '');
        return p === '/' ? '' : p;
    } catch {
        return '';
    }
}

/**
 * 注册静态路由（幂等）。
 *
 * 路由会带上公网地址里的子路径前缀，保证「生成的 URL」和「实际挂载路径」一致。
 * 例如配置 https://bot.114512.xyz/koishi 时，路由为 /koishi/tmp-images/:name。
 *
 * @param {object} ctx koishi context
 * @param {object} cfg 插件配置
 * @returns {string|null} 图片目录；server 服务不可用时返回 null
 */
function registerStaticRoute(ctx, cfg) {
    if (!ctx.server || typeof ctx.server.get !== 'function') {
        return null;
    }
    if (registered.has(ctx)) {
        return resolveImageDir(ctx);
    }

    const dir = resolveImageDir(ctx);
    try {
        fs.mkdirSync(dir, { recursive: true });
    } catch (error) {
        ctx.logger.warn(`[本地图片] 创建目录失败: ${error.message}`);
        return null;
    }

    const prefix = getPathPrefix(cfg);
    const routePath = `${prefix}${ROUTE_PREFIX}/:name`;

    ctx.server.get(routePath, (koaCtx) => {
        const raw = String(koaCtx.params && koaCtx.params.name || '');
        // 防目录穿越：只允许安全文件名
        const name = path.basename(raw);
        if (!/^[A-Za-z0-9_-]+\.(png|jpg|jpeg|gif|webp)$/i.test(name)) {
            koaCtx.status = 404;
            return;
        }
        const file = path.join(dir, name);
        if (!fs.existsSync(file)) {
            koaCtx.status = 404;
            return;
        }
        const ext = path.extname(name).toLowerCase();
        const mime = ext === '.png' ? 'image/png'
            : ext === '.gif' ? 'image/gif'
                : ext === '.webp' ? 'image/webp'
                    : 'image/jpeg';
        koaCtx.type = mime;
        // 图片内容不变（按 hash 命名），可长缓存
        koaCtx.set('Cache-Control', 'public, max-age=86400');
        koaCtx.body = fs.createReadStream(file);
    });

    registered.add(ctx);
    return dir;
}

/**
 * 清理过期图片（按 mtime）。
 * @returns {number} 删除的文件数
 */
function cleanupExpired(ctx, dir) {
    let removed = 0;
    try {
        const now = Date.now();
        for (const name of fs.readdirSync(dir)) {
            const file = path.join(dir, name);
            try {
                const stat = fs.statSync(file);
                if (stat.isFile() && now - stat.mtimeMs > MAX_AGE_MS) {
                    fs.unlinkSync(file);
                    removed++;
                }
            } catch { }
        }
    } catch { }
    if (removed > 0 && ctx.logger) {
        ctx.logger.debug(`[本地图片] 已清理 ${removed} 个过期文件`);
    }
    return removed;
}

/**
 * 把图片元素存成本地文件，返回可公网访问的 URL。
 *
 * @param {object} ctx koishi context
 * @param {object} cfg 插件配置（需要 qqOfficial.publicBaseUrl）
 * @param {object} imageSegment 图片元素
 * @returns {Promise<string|null>} 公网 URL；未配置或失败返回 null
 */
async function saveImageForPublicUrl(ctx, cfg, imageSegment) {
    const baseUrl = getPublicBaseUrl(cfg);
    if (!baseUrl) return null;

    const dir = registerStaticRoute(ctx, cfg);
    if (!dir) return null;

    const src = imageSegment && imageSegment.attrs && (imageSegment.attrs.src || imageSegment.attrs.url);
    if (!src) return null;

    // 已是公网 URL：直接返回
    if (/^https?:\/\//i.test(src)) return src;

    const m = /^data:([^;]+);base64,(.*)$/s.exec(src);
    if (!m) return null;

    const mime = String(m[1] || '').toLowerCase();
    const ext = mime === 'image/png' ? 'png'
        : mime === 'image/gif' ? 'gif'
            : mime === 'image/webp' ? 'webp'
                : 'jpg';

    let buffer;
    try {
        buffer = Buffer.from(m[2], 'base64');
    } catch {
        return null;
    }
    if (!buffer.length) return null;

    // 按内容 hash 命名：同一张图不重复写盘
    const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 20);
    const fileName = `${hash}.${ext}`;
    const filePath = path.join(dir, fileName);

    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, buffer);
            // 顺手清理过期文件
            cleanupExpired(ctx, dir);
        } else {
            // 命中已有文件：刷新 mtime，延长保留期
            try { fs.utimesSync(filePath, new Date(), new Date()); } catch { }
        }
    } catch (error) {
        ctx.logger.warn(`[本地图片] 写入失败: ${error.message}`);
        return null;
    }

    return `${baseUrl}${ROUTE_PREFIX}/${fileName}`;
}

/**
 * 读取配置里的公网地址（去掉末尾斜杠）。
 */
function getPublicBaseUrl(cfg) {
    const raw = cfg && cfg.qqOfficial && cfg.qqOfficial.publicBaseUrl;
    if (!raw) return null;
    const text = String(raw).trim();
    if (!text) return null;
    if (!/^https?:\/\//i.test(text)) return null;
    return text.replace(/\/+$/, '');
}

module.exports = {
    ROUTE_PREFIX,
    MAX_AGE_MS,
    getPublicBaseUrl,
    getPathPrefix,
    registerStaticRoute,
    saveImageForPublicUrl,
    cleanupExpired,
    resolveImageDir,
};
