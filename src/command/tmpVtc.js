const truckersMpApi = require('../api/truckersMpApi')

/**
 * 查询玩家信息
 */
module.exports = async (ctx, cfg, session, vtcid) => {
  if (!vtcid || isNaN(vtcid)) {
    return `请输入正确的vtc编号`
  }

  // 查询玩家信息
  let vtcInfo = await truckersMpApi.vtc(ctx.http, vtcid)
  if (vtcInfo.error) {
    return '查询vtc信息失败，请重试'
  }

  // 拼接消息模板
  let message = ''
  message += `<img src="${vtcInfo.data.logo}"/>\n`
  message += '🆔VTC编号: ' + vtcInfo.data.id
  message += '\n📑VTC名称: ' + vtcInfo.data.name
  message += '\n📑VTC所有者id: ' + vtcInfo.data.owner_id
  message += '\n📑VTC所有者名称: ' + vtcInfo.data.owner_username
  message += '\n📑VTC创建日期: ' + vtcInfo.data.created + `(UTC)`
  message += '\n🎮VTC人数: ' + vtcInfo.data.members_count
  message += '\n🎮VTC前缀: ' + vtcInfo.data.tag
  message += `\n💼VTC主页: ${vtcInfo.data.website}`
  return message
}
