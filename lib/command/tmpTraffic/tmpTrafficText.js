const truckyAppApi = require('../../api/truckyAppApi');
const baiduTranslate = require('../../util/baiduTranslate');
/**
 * 服务器别名
 */
const serverNameAlias = {
    's1': 'sim1',
    's2': 'sim2',
    'p': 'eupromods1',
    'a': 'arc1',
    'S1': 'sim1',
    'S2': 'sim2',
    'P': 'eupromods1',
    'A': 'arc1'
};
/**
 * 路况程度转中文
 */
const severityToZh = {
    'Fluid': '🟢畅通',
    'Moderate': '🟠正常',
    'Congested': '🔴缓慢',
    'Heavy': '🟣拥堵'
};
/**
 * 位置类型转中文
 */
const typeToZh = {
    'City': '城市',
    'Road': '公路',
    'Intersection': '十字路口'
};
/**
 * 查询路况
 */
module.exports = async (ctx, cfg, serverName) => {
    let serverQueryName = serverNameAlias[serverName];
    if (!serverQueryName) {
        return '请输入正确的服务器名称 (s1, s2, p, a)';
    }
    let trafficData = await truckyAppApi.trafficTop(ctx.http, serverQueryName);
    if (trafficData.error) {
        return '查询路况信息失败';
    }
    // 构建消息
    let message = '';
    for (const traffic of trafficData.data) {
        if (message) {
            message += '\n\n';
        }
        message += await baiduTranslate(ctx, cfg, traffic.country);
        message += ' - ';
        let name = traffic.name.substring(0, traffic.name.lastIndexOf('(') - 1);
        let type = traffic.name.substring(traffic.name.lastIndexOf('(') + 1, traffic.name.lastIndexOf(')'));
        message += await baiduTranslate(ctx, cfg, name) + ` (${typeToZh[type] || type})`;
        message += '\n路况: ' + (severityToZh[traffic.newSeverity] || traffic.color);
        message += ' | 人数: ' + traffic.players;
    }
    return message;
};
