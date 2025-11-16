const tmpQueryText = require("./tmpQueryText");
const tmpQueryImg = require("./tmpQueryImg");
module.exports = async (ctx, cfg, session, tmpId) => {
    switch (cfg.tmpQueryType) {
        case 1:
            return await tmpQueryText(ctx, cfg, session, tmpId);
        case 2:
            return await tmpQueryImg(ctx, cfg, session, tmpId);
        default:
            return '指令配置错误';
    }
};
