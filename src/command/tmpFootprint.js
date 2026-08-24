const { segment } = require('koishi')
const dayjs = require('dayjs')
const { resolve } = require('path')
const common = require('../util/common')
const { PromodsIds, ServerType } = require('../util/constant')
const evmOpenApi = require('../api/evmOpenApi')
const guildBind = require('../database/guildBind')

// 足迹统计数据的开始收集日期（仅用于近一年足迹图片中的提示展示）
const FOOTPRINT_DATA_START_DATE = '2026-08-19'

// 轨迹分段规则与原页面逻辑一致：距离 > 30km / 间隔 > 90s / 跨服 判定为断点
// 在 Node 侧完成分段与抽稀，避免百万级点位全量传入浏览器导致渲染崩溃
function buildTrackSegments(points, isValid, minGap) {
  const segments = []
  let current = null
  let lastKept = null
  let prev = null
  let prevTime = NaN

  for (const p of points) {
    if (!isValid(p)) continue

    const currTime = Date.parse(String(p.updateTime || '').replace(/-/g, '/'))

    if (!prev) {
      current = [{ x: p.axisX, y: p.axisY }]
      lastKept = p
    } else {
      const dist = Math.sqrt(Math.pow(p.axisX - prev.axisX, 2) + Math.pow(p.axisY - prev.axisY, 2)) * 19
      const timeDiff = isNaN(currTime) || isNaN(prevTime) ? 0 : (currTime - prevTime) / 1000

      if (dist > 30000 || timeDiff > 90 || p.serverId !== prev.serverId) {
        // 断点：若上一点被抽稀丢弃，补回作为本段终点，保证线段完整
        if (lastKept !== prev) current.push({ x: prev.axisX, y: prev.axisY })
        segments.push(current)
        current = [{ x: p.axisX, y: p.axisY }]
        lastKept = p
      } else if (Math.sqrt(Math.pow(p.axisX - lastKept.axisX, 2) + Math.pow(p.axisY - lastKept.axisY, 2)) >= minGap) {
        current.push({ x: p.axisX, y: p.axisY })
        lastKept = p
      }
    }
    prev = p
    prevTime = currTime
  }
  if (current && current.length) {
    if (prev && lastKept !== prev) current.push({ x: prev.axisX, y: prev.axisY })
    segments.push(current)
  }
  return segments
}

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

  if (date === 'year') {
    startTime = dayjs().subtract(1, 'year').startOf('year').startOf('day').format('YYYY-MM-DD HH:mm:ss');
    endTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
  }

  if (date === 'month') {
    startTime = dayjs().subtract(1, 'month').startOf('month').startOf('day').format('YYYY-MM-DD HH:mm:ss');
    endTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
  }

  if (date === 'today') {
    startTime = dayjs().startOf('day').format('YYYY-MM-DD HH:mm:ss');
    endTime = dayjs().endOf('day').format('YYYY-MM-DD HH:mm:ss');
  }

  if (date === 'sevenday') {
    startTime = dayjs().subtract(7, 'day').startOf('day').format('YYYY-MM-DD HH:mm:ss');
    endTime = dayjs().endOf('day').format('YYYY-MM-DD HH:mm:ss');
  }

  if (!startTime || !endTime) {
    return '日期传递错误';
  }

  let mapPlayerHistory = await evmOpenApi.mapPlayerHistory(ctx.http, tmpId, null, startTime, endTime)
  if (mapPlayerHistory.error) {
    return '查询玩家历史位置数据失败，请稍后重试'
  }

  // 过滤非对应服务器数据（单次遍历统计轨迹范围与有效点数，避免百万级数据产生额外数组拷贝）
  const promodsIdSet = new Set(PromodsIds)
  const isTargetServer = item => {
    if (ServerType.ets === serverType) {
      return !promodsIdSet.has(item.serverId)
    } else if (ServerType.promods === serverType) {
      return promodsIdSet.has(item.serverId)
    }
    return false
  }
  const isValid = item => isTargetServer(item) && !(item.axisX === 0 && item.axisY === 0 && item.heading === 0)

  const history = mapPlayerHistory.data || []
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  let validCount = 0
  let intervalDistance = 0
  for (const item of history) {
    if (!isValid(item)) continue
    validCount++
    // 累加该区间内的行驶距离（API distance 字段，单位米）
    intervalDistance += item.distance || 0
    if (item.axisX < minX) minX = item.axisX
    if (item.axisX > maxX) maxX = item.axisX
    if (item.axisY < minY) minY = item.axisY
    if (item.axisY > maxY) maxY = item.axisY
  }
  if (validCount === 0) {
    if (date === 'yesterday') {
      return `昨日暂无数据`;
    }
    if (date === 'today') {
      return `今日暂无数据`;
    }
    if (date === 'sevenday') {
      return `近七日暂无数据`;
    }
    if (date === 'month') {
      return `本月暂无数据`;
    }
    if (date === 'year') {
      return `本年暂无数据`;
    }
    return '暂无数据';
  }

  // 抽稀阈值自适应：按轨迹对角线的 1/350 取值（800px 宽图片约 2px 精度），下限 5（约 95 米）
  // 近一年足迹可达百万级点位，经此抽稀后传入浏览器的仅剩数千点，渲染不会崩溃
  const diagonal = Math.sqrt(Math.pow(maxX - minX, 2) + Math.pow(maxY - minY, 2))
  const minGap = Math.max(5, diagonal / 350)

  // 分段 + 抽稀
  const segments = buildTrackSegments(history, isValid, minGap)

  // 拼接数据（今日足迹展示今日里程；其余展示该区间里程（distance 累加）与玩家总里程）
  const isToday = date === 'today'
  let data = {
    mapType: ServerType.promods === serverType ? 'promods' : 'ets',
    name: playerInfo.data.name,
    smallAvatarUrl: playerInfo.data.smallAvatarUrl,
    rangeText: { today: '今日', yesterday: '昨日', sevenday: '近七日', month: '近一个月', year: '近一年' }[date] || '',
    isToday,
    mileageLabel: isToday ? '今日里程' : '该区间里程',
    mileage: isToday ? playerInfo.data.todayMileage : intervalDistance,
    totalMileage: isToday ? null : playerInfo.data.mileage,
    dataStartDate: date === 'year' ? FOOTPRINT_DATA_START_DATE : null,
    segments
  }

  let page
  try {
    page = await ctx.puppeteer.page()
    await page.setViewport({ width: 1000, height: 1000, deviceScaleFactor: 2 })
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