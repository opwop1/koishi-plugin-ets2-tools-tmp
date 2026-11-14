/**
 * 查询积分。
 * @param {object|string} identity 查询身份：
 *        - { qq: '123456789' }        onebot（QQ 号）
 *        - { unionid: 'UID_xxx' }     QQ 官方机器人（unionid）
 *        - 传字符串时按 QQ 号处理（兼容旧调用）
 */
module.exports = async (ctx, cfg, identity) => {
  const { Name, url, token, logOutput } = cfg.mainSettings?.settings || {};

  // 兼容旧签名（直接传 QQ 号）
  const query = (identity && typeof identity === 'object') ? identity : { qq: identity };
  const qq = query.qq ? String(query.qq) : '';
  const unionid = query.unionid ? String(query.unionid) : '';
  const isUnionQuery = !qq && !!unionid;
  const whoText = isUnionQuery ? `unionid=${unionid}` : `QQ号 ${qq}`;

  try {
    if (logOutput) {
      ctx.logger.info(`开始查询用户 ${whoText} 的积分`);
    }

    const userInfoUrl = `https://${url}/api/user/info/list?token=${token}&page=1&limit=7&tmpId=&tmpName=&teamId=&qq=${qq}&unionid=${unionid}&state=0&teamRole=&isExecutive=&isManager=&adminUserId=`;
    if (logOutput) {
      ctx.logger.info(`请求V1.0用户信息: ${userInfoUrl}`);
    }
    const userInfoResponse = await ctx.http.post(userInfoUrl);
    if (logOutput) {
      ctx.logger.info(`V1.0用户信息响应: ${JSON.stringify(userInfoResponse)}`);
    }

    if (userInfoResponse.code !== 0) {
      return `获取用户信息失败: ${userInfoResponse.msg || "未知错误"}`;
    }
    const userList = userInfoResponse.page?.list || [];
    if (userList.length === 0) {
      return `未找到 ${whoText} 关联的用户信息`;
    }

    const userInfo = userList[0];
    const tmpName = userInfo.tmpName || "未知用户";
    const teamRole = userInfo.teamRole || userInfo.tmpRole || "未知职位";
    const teamId = userInfo.teamId || userInfo.uid || "未知编号";
    const rewardPoints = userInfo.rewardPoints || userInfo.point || 0;
    const joinDate = userInfo.joinDate || "未知";
    // 展示用 QQ：优先用接口返回的真实 QQ 号（官方机器人本地没有 QQ 号）
    const displayQQ = userInfo.qq || qq || '未绑定';

    let message = `🚛 ${Name}平台 - 积分查询🚚\n`;
    message += `👤 用户: ${tmpName}\n`;
    message += `🆔 车队编号: ${teamId}\n`;
    message += `📧 QQ: ${displayQQ}\n`;
    message += `🏆 职位: ${teamRole}\n`;
    message += `⭐ 当前积分: ${rewardPoints}\n`;
    message += `📅 加入日期: ${joinDate}`;
    return message;
  } catch (error) {
    ctx.logger.error(`积分查询过程出错: ${error}`);
    if (error.response) {
      return `请求失败: ${error.response.status} ${error.response.statusText}`;
    } else if (error.code) {
      return `网络错误: ${error.code}`;
    } else {
      return "系统错误，请稍后重试";
    }
  }
};
