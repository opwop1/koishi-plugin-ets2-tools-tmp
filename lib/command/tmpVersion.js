const truckersMpApi = require("../api/truckersMpApi");
module.exports = async (ctx) => {
    // 查询版本信息
    let result = await truckersMpApi.version(ctx.http);
    if (result.error) {
        return '查询失败，请稍后再试';
    }
    // 构建消息返回
    let message = '';
    message += `TMP版本：${result.data.name}\n`;
    message += `欧卡支持版本: ${result.data.supported_game_version}\n`;
    message += `美卡支持版本: ${result.data.supported_ats_game_version}`;
    return message;
};
