const tmpServerText = require("./tmpServerText");
const tmpServerImg = require("./tmpServerImg");
const messageRender = require("../../util/messageRender");
const qqOfficial = require("../../util/qqOfficial");
const qqMediaUpload = require("../../util/qqMediaUpload");

/**
 * 查询服务器列表。
 *
 * 输出包装：QQ 官方机器人下把文本结果包成 qq:markdown 并附加按钮；
 * onebot 原样返回，行为与以前完全一致。
 */
module.exports = async (ctx, cfg, session, game) => {
    const result = await queryRaw(ctx, cfg, session, game);

    if (!qqOfficial.isQQOfficial(session) || result == null) {
        return result;
    }
    return await decorate(ctx, cfg, session, result, game);
};

/** 按配置分发（保持原有逻辑不变） */
async function queryRaw(ctx, cfg, session, game) {
    switch (cfg.tmpServer?.type) {
        case 1:
            return await tmpServerText(ctx, game);
        case 2:
            return await tmpServerImg(ctx, game);
        default:
            return '指令配置错误';
    }
}

async function decorate(ctx, cfg, session, result, game) {
    // 图片元素：图片 + 按钮
    if (typeof result === 'object' && result.type && result.type !== 'text') {
        return await messageRender.renderImage(session, result, {
            buttons: buildButtons(game),
            uploader: await messageRender.buildUploader(ctx, cfg, session),
        });
    }
    const text = typeof result === 'string' ? result : String(result);
    const isError = /失败|错误|不正确/.test(text);
    return await messageRender.renderText(session, text, {
        buttons: isError ? [] : buildButtons(game),
        markdown: true,
    });
}

/** 服务器结果下方按钮：在欧卡/美卡之间快速切换 */
function buildButtons(game) {
    const isAts = game === 'ATS';
    return [
        [
            qqOfficial.inputButton(isAts ? '看欧卡' : '看美卡', isAts ? '欧卡服务器' : '美卡服务器', true),
            qqOfficial.inputButton('路况', '路况 s1'),
        ],
    ];
}
