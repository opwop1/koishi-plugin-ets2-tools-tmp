module.exports = async (ctx, cfg, queryQQ) => {
  const { Name, url, token, logOutput } = cfg.mainSettings?.settings || {};

  try {
    if (logOutput) {
      ctx.logger.info(`开始查询用户 ${queryQQ} 的积分`);
    }

    const baseUrl = url || "open.vtcm.link";
    const userInfoUrl = `https://${baseUrl}/members/get?token=${token}&qq=${queryQQ}`;
    if (logOutput) {
      ctx.logger.info(`请求V2.0用户信息: ${userInfoUrl}`);
    }
    const userInfoResponse = await ctx.http.get(userInfoUrl);
    if (logOutput) {
      ctx.logger.info(`V2.0用户信息响应: ${JSON.stringify(userInfoResponse)}`);
    }

    if (userInfoResponse.code !== 200) {
      return `获取用户信息失败: ${userInfoResponse.msg || "未知错误"}`;
    }
    if (!userInfoResponse.data) {
      return `未找到QQ号 ${queryQQ} 关联的用户信息`;
    }

    const userInfo = userInfoResponse.data;
    const tmpName = userInfo.tmpName || "未知用户";
    const teamRole = userInfo.teamRole || userInfo.tmpRole || "未知职位";
    const teamId = userInfo.teamId || userInfo.uid || "未知编号";
    const rewardPoints = userInfo.rewardPoints || userInfo.point || 0;
    const joinDate = userInfo.joinDate || "未知";

    let message = `🚛 ${Name}平台 - 积分查询🚚\n`;
    message += `👤 用户: ${tmpName}\n`;
    message += `🆔 车队编号: ${teamId}\n`;
    message += `📧 QQ: ${queryQQ}\n`;
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
