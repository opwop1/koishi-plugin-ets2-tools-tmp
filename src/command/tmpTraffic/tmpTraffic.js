const tmpTrafficMap = require("./tmpTrafficMap");
const tmpTrafficText = require("./tmpTrafficText");
const messageRender = require("../../util/messageRender");
const qqOfficial = require("../../util/qqOfficial");
const qqMediaUpload = require("../../util/qqMediaUpload");

/**
 * 查询路况。
 *
 * 输出包装：QQ 官方机器人下把文本结果包成 qq:markdown 并附加按钮；
 * onebot 原样返回，行为与以前完全一致。
 */
module.exports = async (ctx, cfg, session, serverName) => {
    const result = await queryRaw(ctx, cfg, serverName);

    if (!qqOfficial.isQQOfficial(session) || result == null) {
        return result;
    }
    return await decorate(ctx, cfg, session, result, serverName);
};

/** 按配置分发（保持原有逻辑不变） */
async function queryRaw(ctx, cfg, serverName) {
    switch (cfg.tmpTraffic?.type) {
        case 1:
            return await tmpTrafficText(ctx, cfg, serverName);
        case 2:
            return await tmpTrafficMap(ctx, cfg, serverName);
        default:
            return '指令配置错误';
    }
}

async function decorate(ctx, cfg, session, result, serverName) {
    // 图片（热力图）：图片 + 按钮
    if (typeof result === 'object' && result.type && result.type !== 'text') {
        return await messageRender.renderImage(session, result, {
            buttons: buildButtons(serverName),
            uploader: await messageRender.buildUploader(ctx, cfg, session),
        });
    }
    const text = typeof result === 'string' ? result : String(result);
    const isError = /失败|错误|不正确|请输入/.test(text);
    return await messageRender.renderText(session, text, {
        buttons: isError ? [] : buildButtons(serverName),
        markdown: true,
    });
}

/**
 * 常用服务器快捷切换。
 * 注意：路况指令只认短别名（s1 / s2 / p / a / 美s ...），
 * 按钮里必须填「路况 s1」这种真实可用的写法，不能写服务器全名。
 */
function buildButtons(serverName) {
    const current = String(serverName || '').toLowerCase();
    const all = [
        { alias: 's1', label: 'S1 路况' },
        { alias: 's2', label: 'S2 路况' },
        { alias: 'a', label: 'Arcade' },
        { alias: 'p', label: 'ProMods' },
    ];
    // 当前所在服务器不再重复给出按钮
    const quick = all
        .filter(x => x.alias !== current)
        .slice(0, 3)
        .map(x => qqOfficial.inputButton(x.label, `路况 ${x.alias}`));

    // 每行最多 2 个，避免手机端文字被截断
    const rows = [];
    for (let i = 0; i < quick.length; i += 2) {
        rows.push(quick.slice(i, i + 2));
    }
    rows.push([qqOfficial.inputButton('欧卡服务器', '欧卡服务器')]);
    return rows;
}
