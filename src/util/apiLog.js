// API 请求日志工具：为各 API 模块提供统一的调试/错误日志
// debug 日志（请求地址、耗时）仅在插件开启调试模式时输出；
// 请求失败日志始终输出，便于排查接口异常
let logger = null
let debugMode = false

module.exports = {
    /**
     * 初始化（在插件 apply 时调用）
     */
    init(ctx, enabled) {
        logger = ctx.logger
        debugMode = !!enabled
    },
    /**
     * 记录调试日志（仅调试模式开启时输出）
     */
    debug(tag, message) {
        if (debugMode && logger) {
            logger.info(`[TMP-BOT API] [${tag}] ${message}`)
        }
    },
    /**
     * 记录接口业务层错误日志（始终输出）
     */
    error(tag, message) {
        if (logger) {
            logger.error(`[TMP-BOT API] [${tag}] ${message}`)
        }
    },
    /**
     * 发起 GET 请求并记录日志，失败时记录错误日志后抛出异常（由调用方原有 catch 处理）
     */
    async get(http, tag, url) {
        if (debugMode && logger) {
            logger.info(`[TMP-BOT API] [${tag}] GET ${url}`)
        }
        const start = Date.now()
        try {
            const result = await http.get(url)
            if (debugMode && logger) {
                logger.info(`[TMP-BOT API] [${tag}] 响应成功, 耗时: ${Date.now() - start}ms`)
            }
            return result
        } catch (e) {
            if (logger) {
                logger.error(`[TMP-BOT API] [${tag}] 请求失败: ${url} (${e.message || e})`)
            }
            throw e
        }
    }
}
