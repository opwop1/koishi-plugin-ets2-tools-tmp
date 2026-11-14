const guildBind = require('../database/guildBind');
const truckersMpApi = require("../api/truckersMpApi");
const evmOpenApi = require('../api/evmOpenApi');
const qqOfficial = require('../util/qqOfficial');
const messageRender = require('../util/messageRender');

/**
 * 绑定 TMP ID（支持绑定多个：追加入库，同一编号重复绑定会提示）
 *
 * 输出包装：QQ 官方机器人下把结果包成 qq:markdown 并附加按钮；
 * onebot 原样返回字符串，行为与以前完全一致。
 */
module.exports = async (ctx, cfg, session, tmpId) => {
    const text = await bindImpl(ctx, cfg, session, tmpId);
    return await decorate(session, text);
};

/** 实际绑定逻辑 */
async function bindImpl(ctx, cfg, session, tmpId) {
    if (!tmpId || isNaN(tmpId)) {
        return `请输入正确的玩家编号`;
    }
    // 查询玩家信息
    let playerInfo = await evmOpenApi.playerInfo(ctx.http, tmpId);
    if (playerInfo.error) {
        return '绑定失败 (查询玩家信息失败)';
    }
    // QQ 官方机器人下顺带记录 openid / union_id（onebot 下为 null，行为不变）
    const identity = qqOfficial.buildIdentity(session);
    const result = await guildBind.add(
        ctx.database, session.platform, session.userId,
        playerInfo.data.tmpId, playerInfo.data.name,
        identity.isQQOfficial ? identity : null
    );
    if (result.exists) {
        const hint = result.isDefault ? '（该编号已是你的默认绑定）' : '';
        return `该编号已在绑定列表中 ( ${playerInfo.data.name} )${hint}，无需重复绑定`;
    }
    const count = (await guildBind.listWithUnion(
        ctx.database, session.platform, session.userId, qqOfficial.buildIdentity(session)
    )).length;
    if (count === 1) {
        return `绑定成功 ( ${playerInfo.data.name} )，当前已绑定 ${count} 个编号（已自动设为默认绑定）`;
    }
    const defaultTip = result.isDefault ? '（已设为默认绑定）' : '';
    return `绑定成功 ( ${playerInfo.data.name} )${defaultTip}，当前已绑定 ${count} 个编号`;
}

/**
 * 官方机器人下包装输出（markdown + 按钮）；其它平台原样返回。
 * 失败提示（短文本）不附按钮。
 */
async function decorate(session, text) {
    if (!qqOfficial.isQQOfficial(session)) return text;
    if (typeof text !== 'string') return text;

    const isError = /失败|错误|不正确|已在绑定列表/.test(text);
    if (isError) {
        return await messageRender.renderText(session, text, { markdown: true });
    }
    const buttons = [
        [qqOfficial.inputButton('我的绑定', '我的绑定', true), qqOfficial.inputButton('查询', '查询')],
    ];
    return await messageRender.renderText(session, text, { buttons, markdown: true });
}
