const tmpServerText = require("./tmpServerText");
const tmpServerImg = require("./tmpServerImg");
/**
 * 查询服务器列表
 */
module.exports = async (ctx, cfg) => {
    switch (cfg.tmpServer?.type) {
        case 1:
            return await tmpServerText(ctx);
        case 2:
            return await tmpServerImg(ctx);
        default:
            return '指令配置错误';
    }
};
