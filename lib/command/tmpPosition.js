const { segment } = require('koishi')
const { resolve } = require('path')
const guildBind = require('../database/guildBind')
const tmpIdPicker = require('../util/tmpIdPicker')
const truckyAppApi = require('../api/truckyAppApi')
const truckersMpApi = require('../api/truckersMpApi')
const evmOpenApi = require('../api/evmOpenApi')
const baiduTranslate = require('../util/baiduTranslate')
const { AtsIds } = require('../util/constant')
const common = require('../util/common')

/**
 * 定位
 */
module.exports = async (ctx, cfg, session, tmpId) => {
  if (ctx.puppeteer) {
    let atUser = null;
    if (tmpId && typeof tmpId === 'string' && tmpId.includes('<at ')) {
      const ats = tmpIdPicker.parseAt(tmpId);
      if (Array.isArray(ats) && ats.length > 0) atUser = ats[0];
      else if (ats && ats.failed) atUser = { id: null, name: '' };
      if (atUser && atUser.name) tmpIdPicker.cacheAtName(session.platform, atUser.id, atUser.name);
    }
    if (atUser) {
      const queryQQ = atUser.id;
      if (!queryQQ) {
        return `无法识别@的用户`;
      }
      const atBindings = await guildBind.listOf(ctx.database, session.platform, queryQQ);
      if (atBindings.length === 0) {
        return `该用户没有绑定玩家编号`;
      }
      // 多个绑定时挂起提问（是谁 @ 的不影响回复的人；被 @ 的人回复即可）；定位不支持 all
      const picked = await tmpIdPicker.pick(ctx, session, atBindings, {
        ownerKey: queryQQ,
        ownerName: atUser.name || '',
        allowAll: false
      });
      if (picked === null) {
        return; // 已列出序号等待用户回复
      }
      if (picked.length > 1) {
        const results = [];
        for (const id of picked) {
          const r = await module.exports(ctx, cfg, session, id);
          if (r != null) results.push(r);
        }
        return results.length === 1 ? results[0] : results;
      }
      tmpId = picked[0];
    }
    // 如果没有传入tmpId，尝试从绑定记录获取（多绑定时会列出序号供选择，支持多选=发多张定位图）
    if (!tmpId) {
      const bindings = await guildBind.list(ctx.database, session.platform, session.userId)
      if (bindings.length === 0) {
        return `请输入正确的玩家编号`
      }
      const picked = await tmpIdPicker.pick(ctx, session, bindings, { allowAll: false })
      if (picked === null) {
        return // 已列出序号等待用户回复
      }
      if (picked.length > 1) {
        const results = []
        for (const id of picked) {
          const r = await module.exports(ctx, cfg, session, id)
          if (r != null) results.push(r)
        }
        return results.length === 1 ? results[0] : results
      }
      tmpId = picked[0]
    }
    // 注意：定位刻意**不支持 all**（每个绑定都要各查一次玩家信息+线上位置，会放大请求量），
    // 两处 pick 都传 allowAll:false 关掉挂起期的 all。
    if (tmpId && isNaN(tmpId)) {
      return `请输入正确的玩家编号，或绑定玩家编号`
    }

    // 查询玩家信息
    let playerInfo = await truckersMpApi.player(ctx.http, tmpId)
    if (playerInfo.error) {
      return '玩家位置信息查询失败，请重试'
    }

    // 查询线上信息
    let playerMapInfo = await truckyAppApi.online(ctx.http, tmpId)
    if (playerMapInfo.error) {
      return '玩家线上信息查询失败，请重试'
    }
    if (!playerMapInfo.data.online) {
      return '玩家离线'
    }

    // 查询周边玩家，并处理数据（美卡需显式传 game=2，接口不传默认欧卡）
    const atsServerIdList = AtsIds
    const isAts = atsServerIdList.indexOf(playerMapInfo.data.server) !== -1
    let areaPlayersData = await evmOpenApi.mapPlayerList(ctx.http, playerMapInfo.data.server,
        playerMapInfo.data.x - 4000,
        playerMapInfo.data.y + 2500,
        playerMapInfo.data.x + 4000,
        playerMapInfo.data.y - 2500,
        isAts ? 2 : undefined)
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

    // 构建地图数据（在线的美卡服务器 → 用美卡地图）
    let data = {
      mapType: isAts ? 'ats' : (promodsServerIdList.indexOf(playerMapInfo.data.server) !== -1 ? 'promods' : 'ets'),
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
      await page.setViewport({ width: 1000, height: 1000, deviceScaleFactor: 2 })
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