// API 请求日志工具：为各 API 模块提供统一的调试/错误日志
// debug 日志（请求地址、耗时）仅在插件开启调试模式时输出；
// 请求失败日志始终输出，便于排查接口异常
let logger = null
let debugMode = false
let retryCount = 2

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

// 从异常对象中尽可能提取错误信息（错误名、消息、HTTP 状态码、错误码、底层原因、响应体）
// 仅用 e.message 时，网络层异常可能只有空消息（如只显示 "Error"），需补充状态码等上下文
function formatError(e) {
    if (e == null) return '未知错误'
    const parts = []
    if (e.name && e.name !== 'Error') parts.push(e.name)
    if (e.message) parts.push(e.message)
    if (e.response && e.response.status != null) {
        parts.push(`HTTP ${e.response.status}${e.response.statusText ? ` ${e.response.statusText}` : ''}`)
    } else if (e.status != null) {
        parts.push(`HTTP ${e.status}`)
    }
    if (e.code != null && e.code !== e.status && e.code !== e.response?.status) parts.push(`code=${e.code}`)
    if (e.cause) parts.push(`cause=${e.cause.message || e.cause.code || String(e.cause)}`)
    // 响应体中的错误信息（如网关返回的 JSON 错误内容）
    const body = e.response && e.response.data
    if (body != null) {
        const text = typeof body === 'string' ? body : JSON.stringify(body)
        if (text) parts.push(`响应体: ${text.slice(0, 300)}`)
    }
    if (!parts.length) {
        // 兜底：枚举异常对象上的自定义属性（Error 标准属性不可枚举）
        const props = {}
        for (const key of Object.keys(e)) props[key] = e[key]
        parts.push(Object.keys(props).length ? JSON.stringify(props) : String(e))
    }
    return parts.join(' | ')
}

module.exports = {
    /**
     * 初始化（在插件 apply 时调用）
     */
    init(ctx, enabled, retries) {
        logger = ctx.logger
        debugMode = !!enabled
        retryCount = retries != null ? Math.max(0, retries) : 2
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
     * 格式化异常信息（提取错误名、HTTP 状态码、错误码、底层原因等），供其他模块复用
     */
    formatError,
    /**
     * 发起 GET 请求并记录日志，失败时自动重试（重试次数由配置控制），最终失败抛出异常
     * 重试间隔递增：500ms、1000ms、1500ms...
     */
    async get(http, tag, url) {
        if (debugMode && logger) {
            logger.info(`[TMP-BOT API] [${tag}] GET ${url}`)
        }
        const maxAttempts = retryCount + 1
        let lastError = null
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const start = Date.now()
            try {
                const result = await http.get(url)
                if (debugMode && logger) {
                    logger.info(`[TMP-BOT API] [${tag}] 响应成功, 耗时: ${Date.now() - start}ms${attempt > 1 ? ` (第${attempt}次尝试)` : ''}`)
                }
                return result
            } catch (e) {
                lastError = e
                const isLast = attempt >= maxAttempts
                if (logger) {
                    if (isLast) {
                        // 最终失败，输出错误日志 + 堆栈
                        logger.error(`[TMP-BOT API] [${tag}] 请求失败(已重试${retryCount}次): ${url} (${formatError(e)})`)
                        if (debugMode && e && e.stack) {
                            logger.error(`[TMP-BOT API] [${tag}] 堆栈: ${e.stack}`)
                        }
                    } else {
                        // 中间失败，输出警告（始终可见，便于观察重试情况）
                        logger.warn(`[TMP-BOT API] [${tag}] 第${attempt}/${maxAttempts}次请求失败, 将重试: ${formatError(e)}`)
                    }
                }
                if (!isLast) {
                    await sleep(500 * attempt)
                }
            }
        }
        throw lastError
    }
}
