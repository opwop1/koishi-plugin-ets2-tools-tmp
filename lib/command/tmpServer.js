const truckersMpApi = require('../api/truckersMpApi')

module.exports = async (ctx, cfg, game) => {
  // 查询服务器信息
  let serverData = await truckersMpApi.servers(ctx.http)
  if (serverData.error) {
    return '查询服务器失败，请稍后重试'
  }

  // 过滤服务器
  let etsServerList = serverData.data.filter(server => server.game === game)

  // 构建消息
  let message = ''
  for (let server of etsServerList) {
    // 如果前面有内容，换行
    if (message) {
      message += '\n\n'
    }

    message += '服务器: ' + ( server.online ? '🟢' : '⚫' ) + server.name
    message += `\n服务器ID: ${server.id}`
    message += `\n服务器IP: ${server.ip}`
    message += `\n玩家人数: ${server.players}/${server.maxplayers}`
    if (server.queue) {
      message += ` (队列: ${server.queue})`
    }
    // 服务器特性
    let characteristicList = []
    if (!server.afkenabled) {
      characteristicList.push('⏱挂机')
    }
    if (server.collisions) {
      characteristicList.push('💥碰撞')
    }
    if (characteristicList && characteristicList.length > 0) {
      message += '\n服务器特性: ' + characteristicList.join(' ')
    }
  }
  return message
}
