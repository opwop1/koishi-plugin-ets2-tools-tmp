const tmpVtcOnlineText = require('./tmpVtcOnlineText');
const tmpVtcOnlineImg = require('./tmpVtcOnlineImg');

module.exports = async (ctx, cfg) => {
  switch (cfg.tmpVtcOnline?.type) {
    case 1:
      return await tmpVtcOnlineText(ctx, cfg);
    case 2:
      return await tmpVtcOnlineImg(ctx, cfg);
    default:
      return '指令配置错误';
  }
};