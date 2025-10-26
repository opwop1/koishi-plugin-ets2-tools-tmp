const guildBind = require('../database/guildBind');
const truckersMpApi = require("../api/truckersMpApi");
/**
 * 绑定 TMP ID
 */
module.exports = async (ctx, cfg, session, tmpId) => {
    if (!tmpId || isNaN(tmpId)) {
        return `请输入正确的玩家编号`;
    }
    // 查询玩家信息
    let playerInfo = await truckersMpApi.player(ctx.http, tmpId);
    if (playerInfo.error) {
        return '绑定失败 (查询玩家信息失败)';
    }
    // 更新数据库
    guildBind.saveOrUpdate(ctx.database, session.platform, session.userId, tmpId);
    return `绑定成功 ( ${playerInfo.data.name} )`;
};
