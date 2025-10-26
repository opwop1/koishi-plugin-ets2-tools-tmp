const { segment } = require('koishi')
const { resolve } = require('path')
const guildBind = require('../database/guildBind')
const truckyAppApi = require('../api/truckyAppApi')
const truckersMpApi = require('../api/truckersMpApi')
const evmOpenApi = require('../api/evmOpenApi')
const baiduTranslate = require('../util/baiduTranslate')
const common = require('../util/common')

/**
 * 定位
 */
module.exports = async (ctx, cfg, session, tmpId) => {
  if (ctx.puppeteer) {
    if (tmpId && isNaN(tmpId)) {
      return `请输入正确的玩家编号`
    }

    // 如果没有传入tmpId，尝试从数据库查询绑定信息
    if (!tmpId) {
      let guildBindData = await guildBind.get(ctx.database, session.platform, session.userId)
      if (!guildBindData) {
        return `请输入正确的玩家编号`
      }
      tmpId = guildBindData.tmp_id
    }

    // 查询玩家信息
    let playerInfo = await truckersMpApi.player(ctx.http, tmpId)
    if (playerInfo.error) {
      return '查询玩家信息失败，请重试'
    }

    // 查询线上信息
    let playerMapInfo = await truckyAppApi.online(ctx.http, tmpId)
    if (playerMapInfo.error) {
      return '查询玩家线上信息失败，请重试'
    }
    if (!playerMapInfo.data.online) {
      return '玩家离线'
    }

    // 查询周边玩家，并处理数据
    let areaPlayersData = await evmOpenApi.mapPlayerList(ctx.http, playerMapInfo.data.server,
        playerMapInfo.data.x - 4000,
        playerMapInfo.data.y + 2500,
        playerMapInfo.data.x + 4000,
        playerMapInfo.data.y - 2500)
    let areaPlayerList = []
    if (!areaPlayersData.error) {
      areaPlayerList = areaPlayersData.data
      let index = areaPlayerList.findIndex((player) => {
        return player.tmpId.toString() === tmpId.toString()
      })
      if (index !== -1) {
        areaPlayerList.splice(index, 1)
      }
    }
    areaPlayerList.push({
      axisX: playerMapInfo.data.x,
      axisY: playerMapInfo.data.y,
      tmpId
    })

    // promods服ID集合
    let promodsServerIdList = [50, 51]

    // 构建地图数据
    let data = {
      mapType: promodsServerIdList.indexOf(playerMapInfo.data.server) !== -1 ? 'promods' : 'ets',
      avatar: playerInfo.data.smallAvatar,
      username: playerInfo.data.name,
      serverName: playerMapInfo.data.serverDetails.name,
      country: await baiduTranslate(ctx, cfg, playerMapInfo.data.location.poi.country),
      realName: await baiduTranslate(ctx, cfg, playerMapInfo.data.location.poi.realName),
      currentPlayerId: tmpId,
      centerX: playerMapInfo.data.x,
      centerY: playerMapInfo.data.y,
      playerList: areaPlayerList
    }

    let page
    try {
      page = await ctx.puppeteer.page()
      await page.setViewport({ width: 1000, height: 1000 })
      await page.goto(`file:///${resolve(__dirname, '../resource/position.html')}`)
      await page.evaluate(`setData(${JSON.stringify(data)})`)
      await common.sleep(100)
      await page.waitForNetworkIdle()
      const element = await page.$("#container");
      return (
        segment.image(await element.screenshot({
          encoding: "binary"
        }), "image/jpg")
      )
    } catch (e) {
      return '渲染异常，请重试'
    } finally {
      if (page) {
        await page.close()
      }
    }

  } else {
    return '未启用 puppeteer 服务'
  }
}