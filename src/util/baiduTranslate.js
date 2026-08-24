const md5 = require('js-md5');
const translateCache = require('../database/translateCache');
const apiLog = require('./apiLog');
const TRANSLATE_API = 'https://fanyi-api.baidu.com/api/trans/vip/translate';
module.exports = async (ctx, cfg, content, cache = true) => {
    if (!cfg.baiduTranslate.enable) {
        return content;
    }
    if (cfg.baiduTranslate.enableCache && cache) {
        let translateContent = await translateCache.getTranslate(ctx.database, md5(content));
        if (translateContent) {
            return translateContent;
        }
    }
    let randomInt = Math.floor(Math.random() * 10000);
    let sign = md5(cfg.baiduTranslate.appId + content + randomInt + cfg.baiduTranslate.key);
    let result;
    try {
        result = await ctx.http.get(`${TRANSLATE_API}?q=${encodeURI(content)}&from=auto&to=zh&appid=${cfg.baiduTranslate.appId}&salt=${randomInt}&sign=${sign}`);
    } catch (error) {
        // 翻译失败时降级返回原文，不影响主流程
        ctx.logger.error(`[TMP-BOT] 百度翻译请求失败: ${apiLog.formatError(error)}`);
        return content;
    }
    if (result.error_code) {
        ctx.logger.error(`[TMP-BOT] 百度翻译返回错误: error_code=${result.error_code}, error_msg=${result.error_msg || '无'}`);
        return content;
    }
    if (cfg.baiduTranslate.enableCache && cache) {
        translateCache.save(ctx.database, md5(content), content, result.trans_result[0].dst);
    }
    return result.trans_result[0].dst;
};
