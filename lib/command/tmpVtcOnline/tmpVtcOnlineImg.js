const { segment } = require('koishi');
const { resolve } = require('path');
const common = require('../../util/common');

module.exports = async (ctx, cfg) => {
  const vtcId = cfg.tmpActivityService?.api?.vtcId;
  if (!vtcId) {
    return '请先在活动查询配置中填写 VTC ID';
  }

  let result;
  try {
    result = await ctx.http.get(`https://www.cnly.top/api/player_online/api?vtcId=${encodeURIComponent(vtcId)}`);
  } catch {
    return '查询车队在线成员失败，请稍后重试';
  }

  if (!result || result.code !== 200 || !Array.isArray(result.data)) {
    return '查询车队在线成员失败，请稍后重试';
  }

  const members = result.data;
  const onlineMembers = members.filter(item => item.isOnline);

  const rows = [];
  for (let i = 0; i < onlineMembers.length; i += 3) {
    rows.push(onlineMembers.slice(i, i + 3));
  }

  let page;
  try {
    page = await ctx.puppeteer.page();
    await page.setViewport({ width: 800, height: 1200, deviceScaleFactor: 1.5 });
    await page.goto(`file:///${resolve(__dirname, '../../resource/tmpVtcOnline.html')}`);
    await page.evaluate(`setData(${JSON.stringify({ members, onlineMembers, rows })})`);
    await common.sleep(100);
    await page.waitForNetworkIdle();
    const element = await page.$('#container');
    return segment.image(await element.screenshot({ encoding: 'binary' }), 'image/jpg');
  } catch {
    return '渲染异常，请重试';
  } finally {
    if (page) {
      await page.close();
    }
  }
};