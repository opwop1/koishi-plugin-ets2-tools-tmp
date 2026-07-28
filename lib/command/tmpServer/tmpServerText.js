const evmOpenApi = require('../../api/evmOpenApi');
module.exports = async (ctx, game) => {
    // 查询服务器信息
    let serverData = await evmOpenApi.serverList(ctx.http, game);
    if (serverData.error) {
        return '查询服务器失败，请稍后重试';
    }
    // 构建消息
    let message = '';
    for (let server of serverData.data) {
        // 如果前面有内容，换行
        if (message) {
            message += '\n\n';
        }
        message += '服务器: ' + (server.isOnline === 1 ? '🟢' : '⚫') + server.serverName;
        message += `\n玩家人数: ${server.playerCount}/${server.maxPlayer}`;
        if (server.queueCount > 0) {
            message += ` (队列: ${server.queueCount})`;
        }
        // 服务器特性
        let characteristicList = [];
        if (!(server.afkEnable === 1)) {
            characteristicList.push('⏱挂机');
        }
        if (server.collisionsEnable === 1) {
            characteristicList.push('💥碰撞');
        }
        if (server.speedLimiterEnable === 1) {
            characteristicList.push('🐢限速');
        }
        if (characteristicList && characteristicList.length > 0) {
            message += '\n服务器特性: ' + characteristicList.join(' ');
        }
    }
    return message;
};
