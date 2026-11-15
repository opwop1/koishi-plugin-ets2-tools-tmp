/**
 * 本地图片托管：把截图写成文件，并注册 HTTP 路由对外提供公网 URL。
 *
 * 为什么需要它：
 * - QQ 官方机器人的 qqbot-media 方案有「单机器人 100 张」上限，且**手机端不渲染**（显示 [image]）；
 * - markdown 里用**公网 https URL** 是最稳妥的（所有客户端都支持）。
 *
 * ⚠️ 路由注册的坑（实测）：
 * Koishi 的 console 插件注册了 SPA 兜底路由 `/:path(.*)`，Koa Router **按注册顺序匹配**，
 * 后注册的具体路由会被前面这个兜底吃掉（请求会返回控制台的 index.html）。
 * 所以这里**不用 ctx.server.get**，而是用 Koa 中间件 + prepend 顺序，
 * 并在中间件里自行匹配路径，确保优先于 console 的兜底。
 *
 * 依赖：Koishi 的 server 服务（koishi.yml 里需要启用 server 插件）。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/** 路由前缀 */
const ROUTE_PREFIX = '/tmp-images';

/** 已注册过中间件的 ctx（避免重复注册） */
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

/** 取 logger（容错） */
function getLogger(ctx) {
    return (ctx && ctx.logger) || null;
}

/**
 * 读取配置里的公网地址（去掉末尾斜杠）。
 *
 * 注意：QQ 官方 markdown 图片**必须是 https**。
 */
function getPublicBaseUrl(cfg) {
    const raw = cfg && cfg.qqOfficial && cfg.qqOfficial.publicBaseUrl;
    if (!raw) return null;
    const text = String(raw).trim();
    if (!text) return null;
    if (!/^https?:\/\//i.test(text)) return null;
    return text.replace(/\/+$/, '');
}

/** 当前配置是否为 https（QQ 官方要求） */
function isHttpsBaseUrl(cfg) {
    const base = getPublicBaseUrl(cfg);
    return !!base && /^https:\/\//i.test(base);
}

/** 从公网地址里取 URL 路径前缀（子路径部署时用） */
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
 * ⚠️ 两个坑（都实测过）：
 * 1. Koishi 的 console 插件注册了 SPA 兜底 `/:path(.*)`，Koa Router **按注册顺序匹配**，
 *    用 `ctx.server.get()` 注册的具体路由会被前面这个兜底吃掉（返回控制台 index.html）。
 * 2. `ctx.server` 是 `@cordisjs/plugin-server` 的 Server，**继承 @koa/router**，
 *    没有公开的 `.app` 属性；Koa 实例在私有字段 `_koa` 上。
 *
 * 所以优先把中间件插到 Koa 的 middleware 数组最前面（`_koa.middleware`），
 * 拿不到再退回 Router 注册（至少能工作，只是可能被 SPA 兜底抢先）。
 *
 * @param {object} ctx koishi context
 * @param {object} cfg 插件配置
 * @returns {string|null} 图片目录；server 服务不可用时返回 null
 */
function registerStaticRoute(ctx, cfg) {
    const log = getLogger(ctx);

    if (!ctx.server) {
        if (log) log.warn('[本地图片] ctx.server 不可用：请确认已启用 server 插件，且插件 inject 中声明了 server');
        return null;
    }
    if (registered.has(ctx)) {
        return resolveImageDir(ctx);
    }

    const dir = resolveImageDir(ctx);
    try {
        fs.mkdirSync(dir, { recursive: true });
    } catch (error) {
        if (log) log.warn(`[本地图片] 创建目录失败: ${error.message}`);
        return null;
    }

    const prefix = getPathPrefix(cfg);
    const basePath = `${prefix}${ROUTE_PREFIX}/`;

    const middleware = async (koaCtx, next) => {
        const reqPath = String(koaCtx.path || '');
        if (!reqPath.startsWith(basePath)) return next();

        const raw = reqPath.slice(basePath.length);
        // 只处理单层文件名，多级路径交给后续中间件
        if (raw.includes('/')) return next();

        const name = path.basename(raw);
        if (!/^[A-Za-z0-9_-]+\.(png|jpg|jpeg|gif|webp)$/i.test(name)) {
            koaCtx.status = 404;
            koaCtx.body = 'Not Found';
            return;
        }

        const file = path.join(dir, name);
        if (!fs.existsSync(file)) {
            koaCtx.status = 404;
            koaCtx.body = 'Not Found';
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
    };

    // 优先：插到 Koa middleware 最前面（绕开 Router 顺序问题）
    let installed = false;
    try {
        const koaApp = (ctx.server && ctx.server._koa) || (ctx.server && ctx.server.app);
        if (koaApp && Array.isArray(koaApp.middleware)) {
            koaApp.middleware.unshift(middleware);
            installed = true;
            if (log) log.debug(`[本地图片] 中间件已插入 Koa（最前），路径 ${basePath}*`);
        }
    } catch (error) {
        if (log) log.debug(`[本地图片] 插入 Koa 中间件失败: ${error.message}`);
    }

    // 回退：用 Router 注册（可能被 SPA 兜底抢先，但总比没有好）
    if (!installed && typeof ctx.server.get === 'function') {
        try {
            ctx.server.get(`${prefix}${ROUTE_PREFIX}/:name`, middleware);
            if (log) log.warn('[本地图片] 已退回 Router 注册；若图片返回控制台页面，说明被 SPA 兜底抢先，请启用 Koa 中间件方式');
        } catch (error) {
            if (log) log.warn(`[本地图片] Router 注册也失败: ${error.message}`);
            return null;
        }
    }

    if (!installed && typeof ctx.server.get !== 'function') {
        if (log) log.warn('[本地图片] ctx.server 既无 _koa 也无 get 方法，无法注册图片路由');
        return null;
    }

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
    const log = getLogger(ctx);
    if (removed > 0 && log) log.debug(`[本地图片] 已清理 ${removed} 个过期文件`);
    return removed;
}

/**
 * 把图片元素存成本地文件，返回可公网访问的 URL。
 *
 * 每一步失败都会打日志，方便定位「图片为什么退化成普通发送」。
 *
 * @param {object} ctx koishi context
 * @param {object} cfg 插件配置（需要 qqOfficial.publicBaseUrl）
 * @param {object} imageSegment 图片元素
 * @returns {Promise<string|null>} 公网 URL；未配置或失败返回 null
 */
async function saveImageForPublicUrl(ctx, cfg, imageSegment) {
    const log = getLogger(ctx);

    const baseUrl = getPublicBaseUrl(cfg);
    if (!baseUrl) {
        if (log) log.warn('[本地图片] 未配置 qqOfficial.publicBaseUrl：图片将走 QQ 官方素材上传（有 100 张上限，手机端可能显示 [image]）');
        return null;
    }

    const dir = registerStaticRoute(ctx, cfg);
    if (!dir) return null;

    const src = imageSegment && imageSegment.attrs && (imageSegment.attrs.src || imageSegment.attrs.url);
    if (!src) {
        if (log) log.warn('[本地图片] 图片元素里没有 src/url，无法保存');
        return null;
    }

    // 已是公网 URL：直接返回
    if (/^https?:\/\//i.test(src)) {
        if (log) log.debug(`[本地图片] 图片已是公网 URL，直接使用: ${src}`);
        return src;
    }

    const m = /^data:([^;]+);base64,(.*)$/s.exec(src);
    if (!m) {
        if (log) log.warn(`[本地图片] 图片既不是 data URI 也不是 http URL（src 前缀: ${String(src).slice(0, 30)}）`);
        return null;
    }

    const mime = String(m[1] || '').toLowerCase();
    const ext = mime === 'image/png' ? 'png'
        : mime === 'image/gif' ? 'gif'
            : mime === 'image/webp' ? 'webp'
                : 'jpg';

    let buffer;
    try {
        buffer = Buffer.from(m[2], 'base64');
    } catch (error) {
        if (log) log.warn(`[本地图片] base64 解码失败: ${error.message}`);
        return null;
    }
    if (!buffer.length) {
        if (log) log.warn('[本地图片] 图片内容为空');
        return null;
    }

    // 按内容 hash 命名：同一张图不重复写盘
    const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 20);
    const fileName = `${hash}.${ext}`;
    const filePath = path.join(dir, fileName);

    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, buffer);
            cleanupExpired(ctx, dir);
        } else {
            try { fs.utimesSync(filePath, new Date(), new Date()); } catch { }
        }
    } catch (error) {
        if (log) log.warn(`[本地图片] 写入文件失败: ${error.message}（目录: ${dir}）`);
        return null;
    }

    const url = `${baseUrl}${ROUTE_PREFIX}/${fileName}`;
    if (log) log.info(`[本地图片] 已保存 ${Math.round(buffer.length / 1024)}KB → ${url}`);
    return url;
}

module.exports = {
    ROUTE_PREFIX,
    MAX_AGE_MS,
    getPublicBaseUrl,
    isHttpsBaseUrl,
    getPathPrefix,
    registerStaticRoute,
    saveImageForPublicUrl,
    cleanupExpired,
    resolveImageDir,
};
