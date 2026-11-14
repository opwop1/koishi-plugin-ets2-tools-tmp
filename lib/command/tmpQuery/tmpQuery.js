const tmpQueryText = require("./tmpQueryText");
const tmpQueryImg = require("./tmpQueryImg");
const messageRender = require("../../util/messageRender");
const qqOfficial = require("../../util/qqOfficial");
const qqMediaUpload = require("../../util/qqMediaUpload");

/**
 * 玩家信息查询分发。
 *
 * 这里做一层输出包装：
 * - onebot：原样返回（纯文本字符串 / 图片元素），行为与以前完全一致；
 * - QQ 官方机器人：文本结果包成 qq:markdown，并在下方附加常用按钮。
 *
 * 注意：业务函数可能返回字符串、图片元素、或它们的数组（多绑定查询），
 * 这里只处理「最终结果」，不改变任何查询逻辑。
 */
module.exports = async (ctx, cfg, session, tmpId) => {
    const result = await queryRaw(ctx, cfg, session, tmpId);

    // 非官方机器人 / 无结果 / 已列出序号等待回复（undefined）→ 原样返回
    if (!qqOfficial.isQQOfficial(session) || result == null) {
        return result;
    }

    return await decorateForOfficial(ctx, cfg, session, result);
};

/** 按配置分发到文字版或图片版（保持原有逻辑不变） */
async function queryRaw(ctx, cfg, session, tmpId) {
    switch (cfg.tmpQuery?.type) {
        case 1:
            return await tmpQueryText(ctx, cfg, session, tmpId);
        case 2:
            return await tmpQueryImg(ctx, cfg, session, tmpId);
        default:
            return '指令配置错误';
    }
}

/**
 * 官方机器人下的输出包装。
 * - 字符串 → qq:markdown + 按钮
 * - 图片元素 → 图片 + 按钮（renderImage 内部处理）
 * - 数组 → 逐项处理（多绑定结果）
 */
async function decorateForOfficial(ctx, cfg, session, result) {
    const buttons = buildQueryButtons();

    if (Array.isArray(result)) {
        return Promise.all(result.map(item => decorateOne(ctx, cfg, session, item, buttons)));
    }
    return await decorateOne(ctx, cfg, session, result, buttons);
}

async function decorateOne(ctx, cfg, session, item, buttons) {
    if (item == null) return item;

    // 图片元素：交给 renderImage（官方机器人下会变成「图片 + 按钮」）
    if (typeof item === 'object' && item.type && item.type !== 'text') {
        return await messageRender.renderImage(session, item, {
            buttons,
            uploader: await messageRender.buildUploader(ctx, cfg, session),
        });
    }

    const text = typeof item === 'string' ? item : String(item);
    // 过短的提示语（如「0公里」「请输入正确的玩家编号」）不附加按钮，避免干扰
    if (text.length < 12) {
        return await messageRender.renderText(session, text, { markdown: true });
    }
    return await messageRender.renderText(session, text, { buttons, markdown: true });
}

/** 查询结果下方的常用按钮 */
function buildQueryButtons() {
    // 每行最多 2 个：手机端一行 4 个会把文字压成「再...」省略号
    return [
        [qqOfficial.inputButton('再查一次', '查询', true), qqOfficial.inputButton('我的绑定', '我的绑定')],
        [qqOfficial.inputButton('里程排行榜', '里程排行榜'), qqOfficial.inputButton('VTC里程榜', 'vtc里程排行榜')],
    ];
}
