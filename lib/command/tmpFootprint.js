const { segment } = require('koishi')
const dayjs = require('dayjs')
const { resolve } = require('path')
const common = require('../util/common')
const { PromodsIds, ServerType } = require('../util/constant')
const evmOpenApi = require('../api/evmOpenApi')
const guildBind = require('../database/guildBind')

module.exports = async (ctx, session, serverType, tmpId, date) => {
  if (!ctx.puppeteer) {
    return '未启用 puppeteer 服务'
  }

  if (tmpId && tmpId.startsWith("<at ")) {
    if (tmpId.startsWith('<at ')) {
      queryQQ = tmpId.replace('<at ', '');
    }
    let id = '';
    const idStart = queryQQ.indexOf('id="');
    if (idStart !== -1) {
      const valueStart = idStart + 4;
      const valueEnd = queryQQ.indexOf('"', valueStart);
      if (valueEnd !== -1) {
        id = queryQQ.substring(valueStart, valueEnd);
      }
    }
    queryQQ = id;
    let guildBindData = await guildBind.get(ctx.database, session.platform, queryQQ);
    if (!guildBindData) {
      return `该用户没有绑定玩家编号`;
    }
    tmpId = guildBindData.tmp_id;
  }

  if (tmpId && isNaN(tmpId)) {
    return `请输入正确的玩家编号，或绑定玩家编号`
  }

  // 如果没有传入tmpId，尝试从数据库查询绑定信息
  if (!tmpId) {
    let guildBindData = await guildBind.get(ctx.database, session.platform, session.userId)
    if (!guildBindData) {
      return `请输入正确的玩家编号，或绑定玩家编号`
    }
    tmpId = guildBindData.tmp_id
  }

  // 查询玩家信息
  let playerInfo = await evmOpenApi.playerInfo(ctx.http, tmpId)
  if (playerInfo.error && playerInfo.code === 10001) {
    return '玩家不存在'
  } else if (playerInfo.error) {
    return '查询玩家信息失败，请重试'
  }

  let startTime = "";
  let endTime = "";

  if (date === 'yesterday') {
    const yesterday = dayjs().subtract(1, 'day');
    startTime = yesterday.startOf('day').format('YYYY-MM-DD HH:mm:ss');
    endTime = yesterday.endOf('day').format('YYYY-MM-DD HH:mm:ss');
  }

  if (date === 'today') {
    startTime = dayjs().startOf('day').format('YYYY-MM-DD HH:mm:ss');
    endTime = dayjs().endOf('day').format('YYYY-MM-DD HH:mm:ss');
  }

  if (date === 'tenday') {
    startTime = dayjs().subtract(10, 'day').startOf('day').format('YYYY-MM-DD HH:mm:ss');
    endTime = dayjs().endOf('day').format('YYYY-MM-DD HH:mm:ss');
  }

  if (!startTime || !endTime) {
    return '日期传递错误';
  }

  let mapPlayerHistory = await evmOpenApi.mapPlayerHistory(ctx.http, tmpId, null, startTime, endTime)
  if (mapPlayerHistory.error) {
    return '查询玩家历史位置数据失败，请稍后重试'
  }

  // 过滤非对应服务器数据
  const promodsIdSet = new Set(PromodsIds)
  const mapPlayerHistoryArr = mapPlayerHistory.data.filter(item => {
    if (ServerType.ets === serverType) {
      return !promodsIdSet.has(item.serverId)
    } else if (ServerType.promods === serverType) {
      return promodsIdSet.has(item.serverId)
    }
    return false
  })
  if (mapPlayerHistoryArr.length === 0) {
    if (date === 'yesterday') {
      return `昨日暂无数据`;
    }
    if (date === 'today') {
      return `今日暂无数据`;
    }
    if (date === 'tenday') {
      return `近十天暂无数据`;
    }
    if (date === 'lastMonth') {
      return `上月暂无数据`;
    }
    if (date === 'lastThreeMonths') {
      return `近三个月暂无数据`;
    }
    return '暂无数据';
  }

  // 拼接数据
  let data = {
    mapType: ServerType.promods === serverType ? 'promods' : 'ets',
    name: playerInfo.data.name,
    smallAvatarUrl: playerInfo.data.smallAvatarUrl,
    todayMileage: playerInfo.data.todayMileage,
    points: mapPlayerHistoryArr
  }

  let page
  try {
    page = await ctx.puppeteer.page()
    await page.setViewport({ width: 1000, height: 1000 })
    await page.goto(`file:///${resolve(__dirname, '../resource/footprint.html')}`)
    await page.evaluate(`init(${JSON.stringify(data)})`)
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
  return `OK: ` + playerInfo.data.name
}