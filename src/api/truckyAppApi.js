const apiLog = require('../util/apiLog')
const BASE_API = 'https://evmapi.cxnnn.cn/proxy/trucky'
// const BASE_API = 'https://api.codetabs.com/v1/proxy/?quest=https://api.truckyapp.com'

module.exports = {
  /**
   * 查询线上信息
   */
  async online (http, tmpId) {
    let result = null
    try {
      result = await apiLog.get(http, 'trucky.online', `${BASE_API}/v3/map/online?playerID=${tmpId}`)
    } catch {
      return {
        error: true
      }
    }

    // 拼接返回数据
    let data = {
      error: !result || !result.response || result.response.error
    }
    if (!data.error) {
      data.data = result.response
    }
    return data
  },
  /**
   * 查询热门交通数据
   * @param game 'ets2' 欧卡 / 'ats' 美卡
   */
  async trafficTop (http, serverName, game) {
    const gameCode = game || 'ets2'
    let result = null
    try {
      result = await apiLog.get(http, 'trucky.trafficTop', `${BASE_API}/v2/traffic/top?game=${gameCode}&server=${serverName}`)
    } catch {
      return {
        error: true
      }
    }

    // 拼接返回数据
    let data = {
      error: !result || !result.response || result.response.length <= 0
    }
    if (!data.error) {
      data.data = result.response
    }
    return data
  }
}