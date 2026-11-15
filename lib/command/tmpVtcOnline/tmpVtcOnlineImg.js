const { segment } = require('koishi');
const { resolve } = require('path');
const common = require('../../util/common');
const imageSizeUtil = require('../../util/imageSize');
const evmOpenApi = require('../../api/evmOpenApi');

module.exports = async (ctx, cfg) => {
  const vtcId = cfg.tmpActivityService?.api?.vtcId;
  if (!vtcId) {
    return '请先在活动查询配置中填写 VTC ID';
  }

  let result;
  try {
    result = await evmOpenApi.vtcOnlineList(ctx.http, vtcId);
  } catch {
    return '查询车队在线成员失败，请稍后重试';
  }

  if (result.error || !Array.isArray(result.data)) {
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
    await page.goto(`file:///${resolve(__dirname, '../../resource/tmpVtcOnline.html')}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.evaluate(`setData(${JSON.stringify({ members, onlineMembers, rows })})`);
    await common.sleep(100);
    await page.waitForNetworkIdle({ timeout: 15000 }).catch(() => { });
    const element = await page.$('#container');
        if (!element) throw new Error('未找到容器元素（模板可能未加载完成）');
    // 把真实尺寸挂到元素上，markdown 才能写出精确宽高（否则手机端拉伸变形）
    const box = await imageSizeUtil.measureElement(page);
    const img = segment.image(await element.screenshot({ encoding: 'binary' }), "image/jpeg");
    if (box && img && img.attrs) {
        const size = imageSizeUtil.fitForTemplate('tmpVtcOnline.html', box.width, box.height);
        img.attrs.width = size.width;
        img.attrs.height = size.height;
    }
    return img;
  } catch (error) {
    ctx.logger.error(`[渲染] tmpVtcOnline 失败: ${error && error.message || error}`, error && error.stack ? error.stack : '');
    return '渲染异常，请重试';
  } finally {
    if (page) {
      await page.close();
    }
  }
};