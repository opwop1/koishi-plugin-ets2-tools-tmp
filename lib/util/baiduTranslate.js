const md5 = require('js-md5');
const translateCache = require('../database/translateCache');
const TRANSLATE_API = 'https://fanyi-api.baidu.com/api/trans/vip/translate';
module.exports = async (ctx, cfg, content, cache = true) => {
    // 没有开启百度翻译功能，直接返回文本
    if (!cfg.baiduTranslate?.enable) {
        return content;
    }
    // 如果开启了缓存，尝试从缓存中查询翻译
    if (cfg.baiduTranslate?.cacheEnable && cache) {
        let translateContent = await translateCache.getTranslate(ctx.database, md5(content));
        if (translateContent) {
            return translateContent;
        }
    }
    // 创建请求秘钥
    let randomInt = Math.floor(Math.random() * 10000);
    let sign = md5(cfg.baiduTranslate?.appId + content + randomInt + cfg.baiduTranslate?.key);
    // 调用请求
    let result = await ctx.http.get(`${TRANSLATE_API}?q=${encodeURI(content)}&from=auto&to=zh&appid=${cfg.baiduTranslate?.appId}&salt=${randomInt}&sign=${sign}`);
    // 如果翻译失败，直接返回内容
    if (result.error_code) {
        return content;
    }
    // 如果开启了缓存，将翻译内容缓存到数据库
    if (cfg.baiduTranslate?.cacheEnable && cache) {
        translateCache.save(ctx.database, md5(content), content, result.trans_result[0].dst);
    }
    return result.trans_result[0].dst;
};
