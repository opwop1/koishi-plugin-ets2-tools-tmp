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

  const onlineMembers = result.data.filter(item => item.isOnline);
  const lines = onlineMembers.map(item => `${item.name} - ${item.serverName || '未知服务器'}`);

  return `车队在线成员（${onlineMembers.length}/${result.data.length}）\n${lines.length ? lines.join('\n') : '当前没有成员在线'}`;
};