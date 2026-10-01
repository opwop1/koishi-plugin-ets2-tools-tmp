const guildBind = require('../database/guildBind');
const truckersMpApi = require("../api/truckersMpApi");
const evmOpenApi = require('../api/evmOpenApi');
/**
 * 绑定 TMP ID（支持绑定多个：追加入库，同一编号重复绑定会提示）
 */
module.exports = async (ctx, cfg, session, tmpId) => {
    if (!tmpId || isNaN(tmpId)) {
        return `请输入正确的玩家编号`;
    }
    // 查询玩家信息
    let playerInfo = await evmOpenApi.playerInfo(ctx.http, tmpId);
    if (playerInfo.error) {
        return '绑定失败 (查询玩家信息失败)';
    }
    // 追加绑定（同一 tmpId 已绑定过则提示，不重复入库）
    const result = await guildBind.add(ctx.database, session.platform, session.userId, playerInfo.data.tmpId, playerInfo.data.name);
    if (result.exists) {
        return `该编号已在绑定列表中 ( ${playerInfo.data.name} )，无需重复绑定`;
    }
    const count = (await guildBind.list(ctx.database, session.platform, session.userId)).length;
    return `绑定成功 ( ${playerInfo.data.name} )，当前已绑定 ${count} 个编号`;
};
